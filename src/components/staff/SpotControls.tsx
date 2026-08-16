"use client";

import { useThrottledChange } from "@/lib/hooks";
import type { SpotState } from "@/lib/stageState";

// penumbra는 UI에서 제거 — drei SpotLight의 시각적 빛줄기(VolumetricMesh)가 penumbra를 받지 않아
// 슬라이더를 움직여도 화면이 안 바뀜. SpotState 타입·기본값(0.6)은 그대로 두고 UI에서만 우선 제거함
const SLIDERS: { key: "intensity" | "angle"; label: string; min: number; max: number; step: number }[] = [
  { key: "intensity", label: "밝기", min: 0, max: 1000, step: 10 },
  { key: "angle", label: "조명각", min: 0.1, max: 1, step: 0.05 },
];

export default function SpotControls({ label, spot, onChange }: {
  label: string;
  spot: SpotState;
  onChange: (next: SpotState) => void;
}) {
  // 슬라이더 드래그는 input 이벤트를 rAF보다 훨씬 자주 쏜다 — 매번 그대로 3D 씬까지 흘려보내면
  // <Canvas>가 재구성을 따라잡지 못해 webglcontextlost가 난다(실측). 프레임당 최대 한 번만 반영
  const throttledOnChange = useThrottledChange(onChange);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className={spot.on ? "text-white" : "text-white/50"}>{label}</span>
        <button
          role="switch"
          aria-checked={spot.on}
          aria-label={label}
          onClick={() => onChange({ ...spot, on: !spot.on })}
          className={`h-6 w-11 rounded-full p-0.5 transition-colors ${spot.on ? "bg-brand" : "bg-white/20"}`}
        >
          <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${spot.on ? "translate-x-5" : ""}`} />
        </button>
      </div>
      {SLIDERS.map(({ key, label: sliderLabel, min, max, step }) => (
        <label key={key} className="flex flex-col gap-1 text-xs text-white/50">
          <span>{sliderLabel}</span>
          <input
            type="range"
            aria-label={`${label} ${sliderLabel}`}
            min={min}
            max={max}
            step={step}
            value={spot[key]}
            onChange={(e) => throttledOnChange({ ...spot, [key]: Number(e.target.value) })}
            className="accent-brand"
          />
        </label>
      ))}
    </div>
  );
}
