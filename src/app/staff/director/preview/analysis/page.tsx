"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import AnalysisProgress from "@/components/director/AnalysisProgress";
import type { AnalysisPhase } from "@/lib/director/analysisSteps";

// 시각 검증용 dev 전용 쇼케이스. 메인이 나중에 지운다.
const CASES: { label: string; phase: AnalysisPhase; progress: number | null }[] = [
  { label: "waking", phase: "waking", progress: null },
  { label: "queued", phase: "queued", progress: null },
  { label: "running null", phase: "running", progress: null },
  { label: "running 0.1", phase: "running", progress: 0.1 },
  { label: "running 0.4", phase: "running", progress: 0.4 },
  { label: "running 1.0", phase: "running", progress: 1 },
  { label: "done", phase: "done", progress: 1 },
  { label: "creating", phase: "creating", progress: null },
];

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  const [i, setI] = useState(0);
  const [clicks, setClicks] = useState(0);
  const c = CASES[i];
  return (
    <main className="min-h-screen bg-bg-dark p-4 text-white md:p-8">
      <div className="mb-6 flex flex-wrap gap-2">
        {CASES.map((x, n) => (
          <button
            key={x.label}
            type="button"
            aria-pressed={n === i}
            onClick={() => setI(n)}
            className={`rounded-full px-3 py-1.5 text-xs ${n === i ? "bg-brand text-bg-dark" : "border border-white/25 text-white/70"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <p className="mb-4 text-sm text-white/70">연출 만들기 클릭 횟수: {clicks}</p>
      <AnalysisProgress phase={c.phase} progress={c.progress} onCreate={() => setClicks((n) => n + 1)} />
    </main>
  );
}
