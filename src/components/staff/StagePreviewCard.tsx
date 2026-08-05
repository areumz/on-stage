"use client";

import Link from "next/link";
import { useState } from "react";
import StageScene from "@/components/three/StageScene";
import { useStageStateSnapshot } from "@/lib/hooks";
import { defaultStageState, parseStageState } from "@/lib/stageState";

export default function StagePreviewCard({ slug, color }: { slug: string; color: string }) {
  const [previewing, setPreviewing] = useState(false);
  const saved = useStageStateSnapshot(slug);
  const state = parseStageState(saved, defaultStageState(color));

  return (
    <div className="flex flex-col rounded-xl bg-bg-dark p-6 text-white">
      <h2 className="font-medium">무대 연출</h2>
      <p className="mt-1 text-sm text-white/60">3D 씬 컨트롤</p>
      <div className="mt-4 flex flex-1 items-center justify-center overflow-hidden rounded-lg bg-bg-dark-2">
        {previewing ? (
          <StageScene state={state} controls={false} />
        ) : (
          <span className="h-16 w-16 rounded-full bg-brand/60 ring-8 ring-brand/20" />
        )}
      </div>
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          aria-pressed={previewing}
          onClick={() => setPreviewing((v) => !v)}
          className="flex-1 rounded-lg border border-white/25 py-2.5 text-center text-sm hover:border-white"
        >
          {previewing ? "미리보기 닫기" : "미리보기"}
        </button>
        <Link
          href={`/staff/stage?artist=${slug}`}
          className="flex-1 rounded-lg bg-brand py-2.5 text-center text-sm font-medium hover:opacity-90"
        >
          열기 →
        </Link>
      </div>
    </div>
  );
}
