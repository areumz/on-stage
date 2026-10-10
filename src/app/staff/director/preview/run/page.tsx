"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import ErrorPanel from "@/components/director/ErrorPanel";
import { ScreenHeader } from "@/components/director/ProgressCard";
import RunProgress from "@/components/director/RunProgress";
import SectionConfirm from "@/components/director/SectionConfirm";
import SequenceReview from "@/components/director/SequenceReview";
import type { ConfirmSectionsInterrupt, ReviewInterrupt } from "@/lib/python/contract";
import type { StageState } from "@/lib/stageState";

// dev 전용 쇼케이스. 실제 API 없이 SequenceFlow 의 화면별 모습만 보여 준다. 메인이 나중에 지운다.
const s = (label: string, startSec: number, endSec: number, mood = "") => ({ label, startSec, endSec, mood });
const confirmFx: ConfirmSectionsInterrupt = {
  interruptId: "i-1", kind: "confirm_sections", durationSec: 100.4,
  energyCurve: Array.from({ length: 101 }, (_, i) => 0.3 + 0.7 * Math.abs(Math.sin(i / 9))),
  sections: [s("intro", 0, 12, "차분하게 시작하는 은은한 분위기"), s("verse", 12, 37), s("chorus", 37, 67, "폭발적인 파티 분위기"), s("outro", 67, 100.4, "벅차오르는 마무리")],
};
const st = (color: string, on: number[]): StageState => ({
  color,
  camera: "front",
  spots: {
    left: { on: on[0] > 0, intensity: on[0], angle: 30, penumbra: 0.5 },
    center: { on: on[1] > 0, intensity: on[1], angle: 30, penumbra: 0.5 },
    right: { on: on[2] > 0, intensity: on[2], angle: 30, penumbra: 0.5 },
  },
  smoke: { density: 0.15, color: "#ffffff" },
});
const reviewFx: ReviewInterrupt = {
  interruptId: "r-1", kind: "review", issues: [],
  items: [
    { sectionLabel: "intro", startSec: 0, endSec: 12, transitionMs: 800, state: st("#888888", [300, 450, 300]), rationale: "차분한 도입부라 낮은 밝기를 제안했어요." },
    { sectionLabel: "chorus", startSec: 12, endSec: 40, transitionMs: 400, state: st("#e0457b", [900, 1000, 900]), rationale: "에너지가 오르는 구간이라 밝기를 높였어요." },
  ],
};

const SCREENS = ["queued", "mood", "generating", "saving", "confirm", "review", "error", "job error"] as const;
type Screen = (typeof SCREENS)[number];

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  const [screen, setScreen] = useState<Screen>("mood");
  const [since, setSince] = useState(() => Date.now());
  const [log, setLog] = useState("");
  const badge = "burn it up · AURORA";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {SCREENS.map((k) => (
          <button key={k} type="button" aria-pressed={k === screen} onClick={() => { setScreen(k); setSince(Date.now()); setLog(""); }}
            className={`rounded-full border px-3 py-1 text-xs ${k === screen ? "border-brand bg-brand/20 text-white" : "border-white/20 text-white/80"}`}>
            {k}
          </button>
        ))}
        <span className="text-xs text-white/60">{log}</span>
      </div>
      {screen === "confirm" && <SectionConfirm interrupt={confirmFx} badge={badge} submitting={false} error={null} onSubmit={() => setLog("sections 제출")} />}
      {screen === "review" && (
        <SequenceReview interrupt={reviewFx} badge={badge} feedbackCount={1} submitting={false} error={null}
          onFeedback={(t, tg) => setLog(`feedback ${t} -> [${tg}]`)} onApprove={() => setLog("approve")} onDiscard={() => setLog("discard")} />
      )}
      {screen !== "confirm" && screen !== "review" && (
        <>
          <ScreenHeader eyebrow="연출 만들기" title="진행 상태" badge={badge} />
          {screen === "error" || screen === "job error" ? (
            <ErrorPanel code={screen === "error" ? "connection_failed" : "llm_failed"} since={since} onAction={(a) => setLog(`action ${a}`)} />
          ) : (
            <RunProgress phase={screen} />
          )}
        </>
      )}
    </div>
  );
}
