"use client";

import { useState } from "react";
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
  const [sheetOpen, setSheetOpen] = useState(false);

  function handleChange(next: StageState) {
    writeStageState(slug, JSON.stringify(next));
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="relative flex-1 overflow-hidden">
        <StageScene state={state} />
        <p className="absolute bottom-4 left-6 text-xs tracking-[0.2em] text-white/40">
          DRAG TO ORBIT · SCROLL TO ZOOM
        </p>
        {/* md 미만에서만 뜨는 토글 — 시트가 열리면 뒤로 가려지므로 열려 있을 땐 렌더하지 않음 */}
        {!sheetOpen && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="absolute bottom-4 right-4 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white md:hidden"
          >
            조정하기
          </button>
        )}
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setSheetOpen(false)} />
      )}

      <div
        className={`${sheetOpen ? "block" : "hidden"} fixed inset-x-0 bottom-0 z-30 max-h-[75vh] overflow-y-auto md:contents`}
      >
        <StageControls artists={artists} artistSlug={slug} state={state} onChange={handleChange} />
      </div>
    </div>
  );
}
