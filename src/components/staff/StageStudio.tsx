"use client";

import StageControls from "@/components/staff/StageControls";
import StageScene from "@/components/three/StageScene";
import { useStageStateSnapshot, writeStageState } from "@/lib/hooks";
import { defaultStageState, parseStageState, type StageState } from "@/lib/stageState";
import type { Artist } from "@/lib/types";

export default function StageStudio({
  artists,
  slug,
  defaultColor,
}: {
  artists: Artist[];
  slug: string;
  defaultColor: string;
}) {
  const saved = useStageStateSnapshot(slug);
  const state = parseStageState(saved, defaultStageState(defaultColor));

  function handleChange(next: StageState) {
    writeStageState(slug, JSON.stringify(next));
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="relative flex-1">
        <StageScene state={state} />
        <p className="absolute bottom-4 left-6 text-xs tracking-[0.2em] text-white/40">
          DRAG TO ORBIT · SCROLL TO ZOOM
        </p>
      </div>
      <StageControls artists={artists} state={state} onChange={handleChange} />
    </div>
  );
}
