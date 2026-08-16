"use client";

import { useThrottledChange } from "@/lib/hooks";
import type { StageState } from "@/lib/stageState";

const DENSITY = { min: 0, max: 1, step: 0.05 };

export default function SmokeControls({ smoke, onChange }: {
  smoke: StageState["smoke"];
  onChange: (next: StageState["smoke"]) => void;
}) {

  // SpotControls와 동일한 이유로 스로틀링 적용
  const throttledOnChange = useThrottledChange(smoke, onChange);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs text-white/50">
        <span>농도</span>
        <input
          type="range"
          aria-label="스모그 농도"
          min={DENSITY.min}
          max={DENSITY.max}
          step={DENSITY.step}
          value={smoke.density}
          onChange={(e) => throttledOnChange({ density: Number(e.target.value) })}
          className="accent-brand"
        />
      </label>
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/50">색상</span>
        <input
          type="color"
          aria-label="스모그 색상"
          value={smoke.color}
          onChange={(e) => throttledOnChange({ color: e.target.value })}
          className="h-8 w-8 cursor-pointer rounded border border-white/25 bg-transparent"
        />
      </div>
    </div>
  );
}
