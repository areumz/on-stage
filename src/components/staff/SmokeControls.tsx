"use client";

import { useThrottledChange } from "@/lib/hooks";
import type { StageState } from "@/lib/stageState";

const DENSITY = { min: 0, max: 1, step: 0.05 };

export default function SmokeControls({ smoke, onChange }: {
  smoke: StageState["smoke"];
  onChange: (next: StageState["smoke"]) => void;
}) {
  // 이유는 SpotControls와 동일 — 드래그 중 매 input마다 3D 씬까지 흘려보내면 webglcontextlost가 난다
  const throttledOnChange = useThrottledChange(onChange);

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
          onChange={(e) => throttledOnChange({ ...smoke, density: Number(e.target.value) })}
          className="accent-brand"
        />
      </label>
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/50">색상</span>
        <input
          type="color"
          aria-label="스모그 색상"
          value={smoke.color}
          onChange={(e) => onChange({ ...smoke, color: e.target.value })}
          className="h-8 w-8 cursor-pointer rounded border border-white/25 bg-transparent"
        />
      </div>
    </div>
  );
}
