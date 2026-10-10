"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AnalysisProgress from "@/components/director/AnalysisProgress";
import ErrorPanel from "@/components/director/ErrorPanel";
import { ScreenHeader } from "@/components/director/ProgressCard";
import { useConfirm } from "@/components/staff/ConfirmDialog";
import { createSequence, deleteSequence, pollAnalysis, startAnalysis, type AnalysisPoll, type Result } from "@/lib/director/api";
import { canRestartJob, deleteAlreadyGone, type AnalysisPhase } from "@/lib/director/analysisSteps";
import { usePolling } from "@/lib/director/usePolling";
import { DISCARD_CONFIRM, type ActionKind } from "@/lib/python/errors";

const WAKING_AFTER_MS = 2000; // 이보다 오래 응답이 없으면 서버가 자고 있다고 본다
const MAX_POLL_FAILURES = 3; // 연결 실패는 이 횟수까지 조용히 다시 시도한다

type Shown = AnalysisPhase | "starting"; // starting: 첫 응답 전(2초 안). 목업에 없어 running 으로 그린다
type Failure = { code: string; stage: "analysis" | "create"; since: number; draftId?: string | null };

export default function TrackFlow({
  trackId,
  title,
  artistName,
  initialStatus,
  demoHref,
}: {
  trackId: string;
  title: string;
  artistName: string;
  initialStatus: "pending" | "running" | "done" | "error";
  demoHref: string;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [phase, setPhase] = useState<Shown>(initialStatus === "done" ? "done" : "starting");
  const [progress, setProgress] = useState<number | null>(null);
  const [polling, setPolling] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0); // 분석을 처음부터 다시 시작할 때 폴링을 재시작하려는 키
  // 요청이 돌아왔을 때 이미 화면을 떠났거나 새 시도로 넘어갔으면 결과를 버리기 위한 세대 번호
  const gen = useRef(0);
  const creating = useRef(false);
  const pollFailures = useRef(0);
  const restarts = useRef(0); // job_not_found 로 다시 시작한 횟수. 분석 시도마다 초기화
  const discarding = useRef(false); // 확인창이 열려 있는 동안 연타 방지

  const fail = (code: string, stage: Failure["stage"], draftId?: string | null) => {
    setPolling(false);
    setFailure({ code, stage, draftId, since: Date.now() });
  };

  // 분석 시작·재시작 응답을 화면에 반영한다. 폴링을 계속해야 하면 true.
  const apply = (r: Result<AnalysisPoll>): boolean => {
    if (!r.ok) {
      fail(r.error.code, "analysis");
      return false;
    }
    const d = r.data;
    if (d.status === "error") {
      fail(d.error ?? "internal_error", "analysis");
      return false;
    }
    if (d.status === "done") {
      setPhase("done");
      setPolling(false);
      return false;
    }
    setPhase(d.status);
    setProgress(d.progress);
    setPolling(true);
    return true;
  };

  async function kickoff() {
    const g = ++gen.current;
    pollFailures.current = 0;
    restarts.current = 0;
    // 첫 응답이 늦으면 서버 깨우는 중 화면을 보여 준다
    const timer = setTimeout(() => {
      if (g === gen.current) setPhase("waking");
    }, WAKING_AFTER_MS);
    const r = await startAnalysis(trackId);
    clearTimeout(timer);
    if (g === gen.current) apply(r);
  }

  useEffect(() => {
    const generation = gen; // ref 객체 자체는 바뀌지 않는다
    if (initialStatus !== "done") void kickoff();
    return () => {
      generation.current++; // 언마운트: 진행 중인 요청 결과 버림
    };
    // 마운트 때 한 번만 시작한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  usePolling(
    async () => {
      const g = gen.current;
      let r = await pollAnalysis(trackId);
      if (g !== gen.current) return true;
      if (!r.ok && r.error.code === "job_not_found") {
        // 7일이 지났거나 아직 POST 전: 같은 곡으로 한 번만 다시 시작해서 이어간다. 그래도 404 면 무한 POST 대신 오류로 보낸다
        if (!canRestartJob(restarts.current)) {
          fail("job_not_found", "analysis");
          return true;
        }
        restarts.current++;
        r = await startAnalysis(trackId);
        if (g !== gen.current) return true;
        return !apply(r);
      }
      if (!r.ok && r.error.code === "connection_failed" && ++pollFailures.current < MAX_POLL_FAILURES) return false;
      pollFailures.current = 0;
      return !apply(r);
    },
    { enabled: polling && !failure, resetKey: round },
  );

  async function create() {
    if (creating.current) return;
    creating.current = true;
    const g = gen.current;
    setFailure(null);
    setPhase("creating");
    const r = await createSequence(trackId);
    creating.current = false;
    if (g !== gen.current) return;
    if (r.ok) {
      // replace: 뒤로 가기로 "creating" 만 남은 곡 화면에 돌아오지 않게 한다. 이동하는 동안 creating 화면 유지
      router.replace(`/staff/director/sequences/${r.data.id}`);
      return;
    }
    setPhase("done");
    fail(r.error.code, "create", r.error.draftId);
  }

  function restartAnalysis() {
    setFailure(null);
    setPhase("starting");
    setProgress(null);
    setPolling(false);
    setRound((n) => n + 1);
    void kickoff();
  }

  async function discardAndCreate(draftId: string) {
    if (discarding.current) return;
    discarding.current = true;
    const ok = await confirm(`${DISCARD_CONFIRM.title} ${DISCARD_CONFIRM.body}`, {
      confirmLabel: DISCARD_CONFIRM.confirm,
      cancelLabel: DISCARD_CONFIRM.cancel,
    });
    if (!ok) {
      discarding.current = false;
      return;
    }
    const g = gen.current;
    setBusy(true);
    const d: Result<void> = await deleteSequence(draftId);
    discarding.current = false;
    if (g !== gen.current) return;
    setBusy(false);
    // 다른 탭에서 이미 지웠으면(404) 목적은 달성된 것이라 이어서 만든다
    if (!d.ok && !deleteAlreadyGone(d.error.status)) return fail(d.error.code, "create", draftId);
    void create();
  }

  function onAction(action: ActionKind) {
    const library = () => router.push("/staff/director");
    switch (action) {
      case "retry":
        return failure?.stage === "create" ? void create() : restartAnalysis();
      case "reanalyze":
        return restartAnalysis();
      case "pickSong":
      case "myLibrary":
        return library();
      case "demo":
        return router.push(demoHref);
      case "login":
        return router.push("/staff/login");
      case "continueDraft":
        return failure?.draftId ? router.push(`/staff/director/sequences/${failure.draftId}`) : library();
      case "discardDraft":
        return failure?.draftId ? void discardAndCreate(failure.draftId) : library();
      default:
        // restartRun·backToReview·resave·later 는 이 화면의 오류 문구에 쓰이지 않는다. 눌러도 반응이 없는 것보다
        // 목록으로 보내는 쪽이 안전하다(여기서 retry 를 하면 이미 승인·생성된 것을 다시 만들 수 있다)
        return library();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ScreenHeader eyebrow="작업 상태 · 진행" title="진행 상태" badge={`${title} · ${artistName}`} />
      {failure ? (
        <ErrorPanel code={failure.code} since={failure.since} busy={busy} onAction={onAction} />
      ) : (
        <AnalysisProgress phase={phase === "starting" ? "running" : phase} progress={progress} onCreate={create} />
      )}
      {dialog}
    </div>
  );
}
