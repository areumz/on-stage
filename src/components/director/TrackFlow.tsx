"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AnalysisProgress from "@/components/director/AnalysisProgress";
import ErrorPanel from "@/components/director/ErrorPanel";
import { ScreenHeader } from "@/components/director/ProgressCard";
import { useConfirm } from "@/components/staff/ConfirmDialog";
import { createSequence, deleteSequence, pollAnalysis, startAnalysis, type AnalysisPoll, type ApiError, type Result } from "@/lib/director/api";
import type { AnalysisPhase } from "@/lib/director/analysisSteps";
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
        // 7일이 지났거나 아직 POST 전: 같은 곡으로 다시 시작해서 이어간다
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
      router.push(`/staff/director/sequences/${r.data.id}`); // 이동하는 동안 creating 화면 유지
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
    const ok = await confirm(`${DISCARD_CONFIRM.title} ${DISCARD_CONFIRM.body}`, {
      confirmLabel: DISCARD_CONFIRM.confirm,
      cancelLabel: DISCARD_CONFIRM.cancel,
    });
    if (!ok) return;
    const g = gen.current;
    setBusy(true);
    const d: Result<void> = await deleteSequence(draftId);
    if (g !== gen.current) return;
    setBusy(false);
    if (!d.ok) return fail((d.error as ApiError).code, "create", draftId);
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
