"use client";

import type { StageState } from "@/lib/stageState";
import type { Artist } from "@/lib/types";

const SPOTS = [
  ["left", "Left spot"],
  ["center", "Center spot"],
  ["right", "Right spot"],
] as const;

const ANGLES = [
  ["front", "정면 (Front)"],
  ["audience", "객석 뷰 (Audience)"],
  ["top", "탑 뷰 (Top)"],
] as const;

export default function StageControls({ artists, state, onChange }: {
  artists: Artist[];
  state: StageState;
  onChange: (s: StageState) => void;
}) {
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-8 border-l border-white/10 bg-bg-dark-2 px-6 py-8 text-white">
      <section>
        <p className="text-sm text-white/50">조명 프리셋</p>
        <div className="mt-3 flex flex-wrap gap-3">
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
        </div>
      </section>

      <section>
        <p className="text-sm text-white/50">조명 전원</p>
        <div className="mt-3 flex flex-col gap-3">
          {SPOTS.map(([key, label]) => {
            const on = state.spots[key];
            return (
              <div key={key} className="flex items-center justify-between">
                <span className={on ? "text-white" : "text-white/50"}>{label}</span>
                <button
                  role="switch"
                  aria-checked={on}
                  aria-label={label}
                  onClick={() => onChange({ ...state, spots: { ...state.spots, [key]: !on } })}
                  className={`h-6 w-11 rounded-full p-0.5 transition-colors ${on ? "bg-brand" : "bg-white/20"}`}
                >
                  <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <p className="text-sm text-white/50">카메라 앵글</p>
        <div className="mt-3 flex flex-col gap-2.5">
          {ANGLES.map(([key, label]) => (
            <button
              key={key}
              aria-pressed={state.angle === key}
              onClick={() => onChange({ ...state, angle: key })}
              className={`rounded-lg py-2.5 text-sm ${
                state.angle === key ? "bg-brand font-medium text-white" : "border border-white/25 text-white/70 hover:border-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
