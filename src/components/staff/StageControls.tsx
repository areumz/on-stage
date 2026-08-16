"use client";

import PresetPanel from "@/components/staff/PresetPanel";
import SmokeControls from "@/components/staff/SmokeControls";
import SpotControls from "@/components/staff/SpotControls";
import type { StageState } from "@/lib/stageState";
import type { Artist } from "@/lib/types";

const SPOTS = [
  ["left", "Left spot"],
  ["center", "Center spot"],
  ["right", "Right spot"],
] as const;

const CAMERAS = [
  ["front", "정면 (Front)"],
  ["audience", "객석 뷰 (Audience)"],
  ["top", "탑 뷰 (Top)"],
] as const;

export default function StageControls({ artists, artistSlug, state, onChange }: {
  artists: Artist[];
  artistSlug: string;
  state: StageState;
  onChange: (s: StageState) => void;
}) {
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-8 overflow-y-auto border-l border-white/10 bg-bg-dark-2 px-6 py-8 text-white">
      <section>
        <p className="text-sm text-white/50">조명 프리셋</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {artists.map((a) => (
            <button
              key={a.slug}
              aria-label={`조명 색상 ${a.name}`}
              aria-pressed={state.color === a.color}
              onClick={() => onChange({ ...state, color: a.color })}
              className={`h-10 w-10 rounded-lg ${state.color === a.color ? "ring-2 ring-white" : ""}`}
              style={{ backgroundColor: a.color }}
            />
          ))}
          <input
            type="color"
            aria-label="조명 색상 직접 선택"
            value={state.color}
            onChange={(e) => onChange({ ...state, color: e.target.value })}
            className="h-10 w-10 cursor-pointer rounded-lg border border-white/25 bg-transparent"
          />
        </div>
      </section>

      <section>
        <p className="text-sm text-white/50">조명 전원 · 세부 조절</p>
        <div className="mt-3 flex flex-col gap-5">
          {SPOTS.map(([key, label]) => (
            <SpotControls
              key={key}
              label={label}
              spot={state.spots[key]}
              onChange={(next) => onChange({ ...state, spots: { ...state.spots, [key]: next } })}
            />
          ))}
        </div>
      </section>

      <section>
        <p className="text-sm text-white/50">카메라 앵글</p>
        <div className="mt-3 flex flex-col gap-2.5">
          {CAMERAS.map(([key, label]) => (
            <button
              key={key}
              aria-pressed={state.camera === key}
              onClick={() => onChange({ ...state, camera: key })}
              className={`rounded-lg py-2.5 text-sm ${
                state.camera === key ? "bg-brand font-medium text-white" : "border border-white/25 text-white/70 hover:border-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="text-sm text-white/50">스모그</p>
        <div className="mt-3">
          <SmokeControls smoke={state.smoke} onChange={(next) => onChange({ ...state, smoke: next })} />
        </div>
      </section>

      <section>
        <p className="text-sm text-white/50">프리셋</p>
        <div className="mt-3">
          <PresetPanel artistSlug={artistSlug} state={state} onChange={onChange} />
        </div>
      </section>
    </aside>
  );
}
