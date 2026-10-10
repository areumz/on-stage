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
import { FEEDBACK_LIMIT } from "@/lib/director/limits";
import {
  displayCode,
  initialHint,
  nextHint,
  pollErrorAction,
  resumeErrorAction,
  shouldPoll,
  viewFor,
  type RunPhase,
  type RunView,
} from "@/lib/director/runFlow";
import { usePolling } from "@/lib/director/usePolling";
import type { ResumeBody } from "@/lib/python/contract";
import { DISCARD_CONFIRM, type ActionKind } from "@/lib/python/errors";

// 화면에 보여 줄 오류. job 은 Python 작업이 error 로 멈춘 경우(다시 시도 = retry API), 아니면 HTTP·연결 오류(다시 시도 = 폴링 재개).
type Fatal = { code: string; since: number; job: boolean; draftId?: string | null };

const STUCK_MS = 10_000; // 승인 뒤 이 시간 안에 재생 화면으로 바뀌지 않으면 직접 열 수 있게 한다

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
  const [stuck, setStuck] = useState(false);

  const mounted = useRef(true);
  const gen = useRef(0); // 폴링·요청 세대. 새 요청이 시작되면 이전 응답은 버린다
  const lock = useRef(false); // 중복 제출 방지
  const failures = useRef(0);
  const refreshed = useRef(false);
  const submittedId = useRef<string | null>(null); // 방금 제출한 interruptId. 서버가 아직 상태를 안 바꿨을 때 같은 화면이 되살아나는 것을 막는다
  const focusRef = useRef<HTMLDivElement>(null);
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
        if (pollErrorAction(r.error, ++failures.current) === "quiet") return false;
        showFatal(displayCode(r.error));
        return true;
      }
      failures.current = 0;
      let v = viewFor(r.data, hint);
      if ((v.kind === "confirm" || v.kind === "review") && v.interrupt.interruptId === submittedId.current) v = { kind: "progress", phase: hint };
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

  // 새 화면(확인·검토·오류)이 나타나면 키보드·스크린리더 사용자가 알 수 있게 영역으로 포커스를 옮긴다
  const focusKey = fatal ? `f${fatal.since}` : view?.kind === "confirm" || view?.kind === "review" ? view.interrupt.interruptId : null;
  useEffect(() => {
    if (focusKey) focusRef.current?.focus();
  }, [focusKey]);

  // 재생 화면으로 바뀌지 않으면(refresh 실패 등) 직접 열 버튼을 보여 준다. 바뀌면 이 컴포넌트가 사라진다.
  const approved = view?.kind === "approved";
  useEffect(() => {
    if (!approved) return;
    const t = setTimeout(() => setStuck(true), STUCK_MS);
    return () => clearTimeout(t);
  }, [approved]);

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
      submittedId.current = body.interruptId;
      if (after === "feedback") setFeedbackCount(r.data.feedbackCount);
      restart(nextHint(after));
      return;
    }
    const e = r.error;
    const act = resumeErrorAction(e);
    if (act === "refetch") {
      submittedId.current = null;
      restart(hint); // 화면이 낡았다. 바로 다시 불러온다
    } else if (act === "fatal") showFatal(displayCode(e));
    else {
      // inline·keep: 화면(사용자가 고친 내용)을 유지하고 다시 제출할 수 있게 한다
      if (e.code === "feedback_limit") setFeedbackCount(FEEDBACK_LIMIT); // 다른 탭에서 이미 다 썼을 수 있다
      setSubmitting(false);
      setResumeError(e);
    }
  }

  async function discard() {
    if (lock.current) return;
    lock.current = true;
    setSubmitting(true);
    const r = await deleteSequence(sequenceId);
    lock.current = false;
    if (!mounted.current) return;
    if (r.ok) router.replace(`/staff/director/tracks/${trackId}`); // 이동 중에는 submitting 유지
    else showFatal(r.error.code);
  }

  // 이동하면 true (호출부는 busy 를 풀지 않는다)
  async function startNew(): Promise<boolean> {
    const r = await createSequence(trackId);
    if (!mounted.current) return false;
    if (r.ok) {
      router.replace(`/staff/director/sequences/${r.data.id}`);
      return true;
    }
    showFatal(r.error.code, false, r.error.draftId);
    return false;
  }

  async function onAction(action: ActionKind) {
    if (lock.current || !fatal) return;
    lock.current = true;
    setSubmitting(true); // ErrorPanel busy
    let leaving = false; // 이동하는 동안은 같은 버튼이 다시 눌리지 않게 busy·lock 을 유지한다
    const go = (fn: () => void) => {
      leaving = true;
      fn();
    };
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
          leaving = await startNew();
          return;
        case "continueDraft":
          if (fatal.draftId && fatal.draftId !== sequenceId) go(() => router.replace(`/staff/director/sequences/${fatal.draftId}`));
          else restart(hint);
          return;
        case "discardDraft": {
          const ok = await confirm(`${DISCARD_CONFIRM.title} ${DISCARD_CONFIRM.body}`, {
            confirmLabel: DISCARD_CONFIRM.confirm,
            cancelLabel: DISCARD_CONFIRM.cancel,
          });
          if (!ok || !mounted.current) return;
          // draft_exists 면 막고 있는 다른 초안을, 아니면 이 초안을 지운다
          const r = await deleteSequence(fatal.draftId ?? sequenceId);
          if (!mounted.current) return;
          // 이미 없는 초안(403·404)이면 지우려던 목적은 이뤄졌다
          if (!r.ok && r.error.status !== 403 && r.error.status !== 404) return showFatal(r.error.code);
          leaving = await startNew();
          return;
        }
        case "pickSong":
        case "myLibrary":
        case "later":
          return go(() => router.push("/staff/director"));
        case "demo":
          return go(() => router.push(demoHref));
        case "login":
          return go(() => router.push("/staff/login"));
        case "reanalyze":
          return go(() => router.push(`/staff/director/tracks/${trackId}`));
      }
    } finally {
      if (!leaving) {
        lock.current = false;
        if (mounted.current) setSubmitting(false);
      }
    }
  }

  let body;
  if (fatal) {
    body = <ErrorPanel code={fatal.code} since={fatal.since} busy={submitting} onAction={onAction} />;
  } else if (view?.kind === "confirm") {
    body = (
      <SectionConfirm
        interrupt={view.interrupt}
        badge={badge}
        submitting={submitting}
        error={resumeError}
        onSubmit={(sections) =>
          resume({ interruptId: view.interrupt.interruptId, kind: "sections", payload: { sections } }, "sections")
        }
      />
    );
  } else if (view?.kind === "review") {
    body = (
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
    );
  } else {
    const phase = view?.kind === "queued" ? "queued" : approved ? "saving" : view?.kind === "progress" ? view.phase : hint;
    body = (
      <>
        <RunProgress phase={phase} />
        {stuck && approved && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="self-start rounded-lg bg-brand px-5 py-3 text-sm font-medium text-bg-dark hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            재생 화면 열기
          </button>
        )}
      </>
    );
  }

  const withHeader = fatal || !(view?.kind === "confirm" || view?.kind === "review");
  return (
    <div ref={focusRef} tabIndex={-1} className="flex flex-col gap-6 outline-none">
      {withHeader && <ScreenHeader eyebrow="연출 만들기" title="진행 상태" badge={badge} />}
      {body}
      {dialog}
    </div>
  );
}
