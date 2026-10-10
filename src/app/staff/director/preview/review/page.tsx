"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import SequenceReview from "@/components/director/SequenceReview";
import type { ReviewInterrupt } from "@/lib/python/contract";
import type { StageState } from "@/lib/stageState";

// 시각 검증용 dev 전용 쇼케이스. 메인이 나중에 지운다.
const st = (color: string, camera: StageState["camera"], on: number[], density: number): StageState => ({
  color,
  camera,
  spots: {
    left: { on: on[0] > 0, intensity: on[0], angle: 30, penumbra: 0.5 },
    center: { on: on[1] > 0, intensity: on[1], angle: 30, penumbra: 0.5 },
    right: { on: on[2] > 0, intensity: on[2], angle: 30, penumbra: 0.5 },
  },
  smoke: { density, color: "#ffffff" },
});
const mk = (whole: boolean): ReviewInterrupt => ({
  interruptId: whole ? "demo-a" : "demo-b",
  kind: "review",
  items: [
    { sectionLabel: "intro", startSec: 0, endSec: 12, transitionMs: 800, state: st("#888888", "front", [300, 450, 300], 0.1), rationale: "차분한 도입부라 낮은 밝기와 중앙 위주의 은은한 조명을 제안했어요." },
    { sectionLabel: "verse", startSec: 12, endSec: 37, transitionMs: 800, state: st("#9f77dd", "front", [500, 700, 500], 0.15), rationale: "에너지가 서서히 오르는 구간이라 밝기를 단계적으로 높였어요." },
    { sectionLabel: "chorus", startSec: 37, endSec: 67, transitionMs: 400, state: st("#e0457b", "audience", [900, 1000, 900], 0.35), rationale: "연출 근거가 비어 있어요." },
    { sectionLabel: "bridge", startSec: 67, endSec: 77, transitionMs: 800, state: st("#888888", "front", [200, 400, 0], 0.12), rationale: "잠시 숨을 고르는 구간이라 조명을 다시 낮췄어요." },
    { sectionLabel: "outro", startSec: 77, endSec: 100, transitionMs: 1200, state: st("#9f77dd", "top", [600, 800, 600], 0.2), rationale: "마무리 구간으로 코러스보다는 절제된 밝기를 유지했어요." },
  ],
  issues: [
    { rule: "color_deviation_without_rationale", message: "시그니처 컬러에서 벗어났는데 근거가 없어요", idx: 2 },
    ...(whole ? [{ rule: "energy_brightness_direction", message: "곡 전체 에너지 흐름과 밝기 방향이 어긋나요", idx: null }] : []),
  ],
});

function Showcase() {
  const [count, setCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(false);
  const [whole, setWhole] = useState(false);
  const [log, setLog] = useState("");
  const btn = "rounded-full border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10";
  return (
    <main className="min-h-screen bg-bg-dark">
      <div className="flex flex-wrap gap-2 px-4 pt-4 md:px-8">
        <button className={btn} onClick={() => setCount(1)}>다시 생성 1/3</button>
        <button className={btn} onClick={() => setCount(3)}>3/3</button>
        <button className={btn} onClick={() => setSubmitting((v) => !v)}>제출 중 {submitting ? "끄기" : "켜기"}</button>
        <button className={btn} onClick={() => setErr((v) => !v)}>오류 배너 {err ? "끄기" : "켜기"}</button>
        <button className={btn} onClick={() => setWhole((v) => !v)}>곡 전체 경고 {whole ? "없애기" : "넣기"}</button>
        <span className="self-center text-xs text-white/60">{log}</span>
      </div>
      <SequenceReview
        interrupt={mk(whole)}
        badge="burn it up · AURORA"
        feedbackCount={count}
        submitting={submitting}
        error={err ? { code: "connection_failed", status: 0 } : null}
        onFeedback={(t, tg) => setLog(`feedback ${JSON.stringify(t)} -> [${tg}]`)}
        onApprove={() => setLog("approve")}
        onDiscard={() => setLog("discard")}
      />
    </main>
  );
}

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Showcase />;
}
