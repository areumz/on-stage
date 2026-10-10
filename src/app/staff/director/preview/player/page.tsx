"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import SequencePlayer from "@/components/director/SequencePlayer";
import type { SequenceItem } from "@/lib/python/contract";
import { defaultStageState } from "@/lib/stageState";

// dev 전용 쇼케이스. 메인이 나중에 지운다. audioTrackId 가 가짜라 소리 없이 재생되는 경로를 본다.
const st = (color: string, cam: "front" | "audience" | "top", smoke: number, on: [boolean, boolean, boolean], i: number) => {
  const s = defaultStageState(color);
  s.camera = cam;
  s.smoke = { density: smoke, color: "#ffffff" };
  (["left", "center", "right"] as const).forEach((k, n) => { s.spots[k] = { on: on[n], intensity: i, angle: 0.45, penumbra: 0.6 }; });
  return s;
};
const it = (sectionLabel: string, startSec: number, endSec: number, state: SequenceItem["state"]): SequenceItem => ({ sectionLabel, startSec, endSec, transitionMs: 2000, state, rationale: "" });
const ITEMS: SequenceItem[] = [
  it("intro", 0, 62, st("#9f77dd", "front", 0.1, [false, true, false], 250)),
  it("verse", 62, 114, st("#4aa8ff", "audience", 0.3, [true, true, false], 450)),
  it("chorus", 114, 129, st("#ff4d8d", "top", 0.7, [true, true, true], 900)),
  it("outro", 129, 173.819, st("#ffb347", "front", 0.2, [true, false, true], 350)),
];
const LEVEL = [0.3, 0.55, 1, 0.45];
const CURVE = Array.from({ length: 174 }, (_, s) => LEVEL[ITEMS.findIndex((x) => s < x.endSec)] * (0.7 + 0.3 * Math.abs(Math.sin(s / 4))));

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  const [accent, setAccent] = useState("#9f77dd");
  return (
    <main className="min-h-screen bg-bg-dark p-4 text-white md:p-8">
      <div className="mb-4 flex gap-2">
        {["#9f77dd", "#ff4d8d", "#4aa8ff"].map((c) => (
          <button key={c} type="button" aria-label={`accent ${c}`} onClick={() => setAccent(c)} className="h-8 w-8 rounded-full border border-white/20" style={{ background: c }} />
        ))}
      </div>
      <SequencePlayer audioTrackId="preview-fake" title="Preview Song" artistName="Preview Artist" accent={accent} durationSec={173.819} items={ITEMS} energyCurve={CURVE} />
    </main>
  );
}
