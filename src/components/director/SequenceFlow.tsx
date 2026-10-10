"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ErrorPanel from "@/components/director/ErrorPanel";
import RunProgress from "@/components/director/RunProgress";
import { ScreenHeader } from "@/components/director/ProgressCard";
import SectionConfirm from "@/components/director/SectionConfirm";
import SequenceReview from "@/components/director/SequenceReview";
import { useConfirm } from "@/components/staff/ConfirmDialog";
import {
  createSequence,
  deleteSequence,
  pollSequence,
  resumeSequence,
  retrySequence,
  type ApiError,
} from "@/lib/director/api";
import { initialHint, nextHint, shouldPoll, viewFor, type RunPhase, type RunView } from "@/lib/director/runFlow";
import { usePolling } from "@/lib/director/usePolling";
import type { ResumeBody } from "@/lib/python/contract";
import { DISCARD_CONFIRM, type ActionKind } from "@/lib/python/errors";

// 화면에 보여 줄 오류. job 은 Python 작업이 error 로 멈춘 경우(다시 시도 = retry API), 아니면 HTTP·연결 오류(다시 시도 = 폴링 재개).
type Fatal = { code: string; since: number; job: boolean; draftId?: string | null };

const QUIET_RETRIES = 3; // 연결 실패는 이만큼까지 화면에 알리지 않고 다시 확인한다

export default function SequenceFlow({
  sequenceId,
  trackId,
  trackTitle,
  artistName,
  initialFeedbackCount,
  createdAt,
  demoHref,
}: {
  sequenceId: string;
  trackId: string;
  trackTitle: string;
  artistName: string;
  initialFeedbackCount: number;
  createdAt: string;
  demoHref: string;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const badge = `${trackTitle} · ${artistName}`;

  const [view, setView] = useState<RunView | null>(null); // null = 첫 확인 전
  const [hint, setHint] = useState<RunPhase>(() => initialHint(createdAt, initialFeedbackCount, Date.now()));
  const [feedbackCount, setFeedbackCount] = useState(initialFeedbackCount);
  const [fatal, setFatal] = useState<Fatal | null>(null);
  const [resumeError, setResumeError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pollKey, setPollKey] = useState(0);

  const mounted = useRef(true);
  const gen = useRef(0); // 폴링·요청 세대. 새 요청이 시작되면 이전 응답은 버린다
  const lock = useRef(false); // 중복 제출 방지
  const failures = useRef(0);
  const refreshed = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const showFatal = (code: string, job = false, draftId?: string | null) => {
    setSubmitting(false);
    setView(null);
    setFatal({ code, since: Date.now(), job, draftId });
  };

  // 단계 값을 정해 두고 서버 상태를 다시 확인하기 시작한다
  const restart = (h: RunPhase) => {
    gen.current++;
    failures.current = 0;
    setFatal(null);
    setResumeError(null);
    setSubmitting(false);
    setHint(h);
    setView({ kind: "progress", phase: h });
    setPollKey((k) => k + 1);
  };

  usePolling(
    async () => {
      const g = gen.current;
      const r = await pollSequence(sequenceId);
      if (!mounted.current || g !== gen.current) return true; // 낡은 응답. 새로 시작한 쪽이 폴링을 이어 간다
      if (!r.ok) {
        if (r.error.code === "connection_failed" && ++failures.current <= QUIET_RETRIES) return false;
        showFatal(r.error.code);
        return true;
      }
      failures.current = 0;
      const v = viewFor(r.data, hint);
      if (v.kind === "error") {
        showFatal(v.code, true);
        return true;
      }
      if (v.kind === "review" && r.data.feedbackCount !== undefined) setFeedbackCount(r.data.feedbackCount);
      setView(v);
      return !shouldPoll(v);
    },
    { enabled: !fatal && (view === null || shouldPoll(view)), resetKey: pollKey },
  );

  // 승인되어 저장까지 끝났으면 서버 페이지를 다시 그려 재생 화면을 연다
  useEffect(() => {
    if (view?.kind === "approved" && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [view, router]);

  async function resume(body: ResumeBody, after: "sections" | "feedback" | "approve") {
    if (lock.current) return;
    lock.current = true;
    const g = ++gen.current;
    setSubmitting(true);
    setResumeError(null);
    const r = await resumeSequence(sequenceId, body);
    lock.current = false;
    if (!mounted.current || g !== gen.current) return;
    if (r.ok) {
      if (after === "feedback") setFeedbackCount(r.data.feedbackCount);
      restart(nextHint(after));
      return;
    }
    const e = r.error;
    if (e.code === "stale_interrupt" || e.code === "not_waiting_input") restart(hint); // 화면이 낡았다. 바로 다시 불러온다
    else if (e.code === "invalid_sections" || e.code === "invalid_targets" || e.code === "feedback_limit") {
      setSubmitting(false);
      setResumeError(e);
    } else showFatal(e.code);
  }

  async function discard() {
    if (lock.current) return;
    lock.current = true;
    setSubmitting(true);
    const r = await deleteSequence(sequenceId);
    lock.current = false;
    if (!mounted.current) return;
    if (r.ok) router.replace(`/staff/director/tracks/${trackId}`);
    else showFatal(r.error.code);
  }

  async function startNew() {
    const r = await createSequence(trackId);
    if (!mounted.current) return;
    if (r.ok) router.replace(`/staff/director/sequences/${r.data.id}`);
    else showFatal(r.error.code, false, r.error.draftId);
  }

  async function onAction(action: ActionKind) {
    if (lock.current || !fatal) return;
    lock.current = true;
    setSubmitting(true); // ErrorPanel busy
    try {
      switch (action) {
        case "retry": {
          if (!fatal.job) return restart(hint);
          const g = ++gen.current;
          const r = await retrySequence(sequenceId);
          if (!mounted.current || g !== gen.current) return;
          if (r.ok) restart("generating");
          else showFatal(r.error.code, true);
          return;
        }
        case "resave":
        case "backToReview":
          return restart(hint);
        case "restartRun":
          return await startNew();
        case "continueDraft":
          if (fatal.draftId && fatal.draftId !== sequenceId) router.replace(`/staff/director/sequences/${fatal.draftId}`);
          else restart(hint);
          return;
        case "discardDraft": {
          const ok = await confirm(`${DISCARD_CONFIRM.title} ${DISCARD_CONFIRM.body}`, {
            confirmLabel: DISCARD_CONFIRM.confirm,
            cancelLabel: DISCARD_CONFIRM.cancel,
          });
          if (!ok || !mounted.current) return;
          // 이미 사라진 초안(draft_exists 의 다른 초안)이면 이 id 가 아니라 서버가 알려 준 id 를 지운다
          const r = await deleteSequence(fatal.draftId ?? sequenceId);
          if (!mounted.current) return;
          if (!r.ok) return showFatal(r.error.code);
          return await startNew();
        }
        case "pickSong":
        case "myLibrary":
        case "later":
          return router.push("/staff/director");
        case "demo":
          return router.push(demoHref);
        case "login":
          return router.push("/staff/login");
        case "reanalyze":
          return router.push(`/staff/director/tracks/${trackId}`);
      }
    } finally {
      lock.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  let body;
  if (fatal) {
    body = <ErrorPanel code={fatal.code} since={fatal.since} busy={submitting} onAction={onAction} />;
  } else if (view?.kind === "confirm") {
    return (
      <>
        <SectionConfirm
          interrupt={view.interrupt}
          badge={badge}
          submitting={submitting}
          error={resumeError}
          onSubmit={(sections) =>
            resume({ interruptId: view.interrupt.interruptId, kind: "sections", payload: { sections } }, "sections")
          }
        />
        {dialog}
      </>
    );
  } else if (view?.kind === "review") {
    return (
      <>
        <SequenceReview
          interrupt={view.interrupt}
          badge={badge}
          feedbackCount={feedbackCount}
          submitting={submitting}
          error={resumeError}
          onFeedback={(text, targets) =>
            resume({ interruptId: view.interrupt.interruptId, kind: "feedback", payload: { text, targets } }, "feedback")
          }
          onApprove={() => resume({ interruptId: view.interrupt.interruptId, kind: "approve" }, "approve")}
          onDiscard={discard}
        />
        {dialog}
      </>
    );
  } else {
    const phase = view?.kind === "queued" ? "queued" : view?.kind === "approved" ? "saving" : view?.kind === "progress" ? view.phase : hint;
    body = <RunProgress phase={phase} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ScreenHeader eyebrow="연출 만들기" title="진행 상태" badge={badge} />
      {body}
      {dialog}
    </div>
  );
}
