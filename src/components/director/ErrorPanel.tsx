"use client";

import { useState } from "react";
import { errorCopyFor, type ActionKind } from "@/lib/python/errors";
import { cooldownLabel } from "@/lib/director/cooldown";
import { useCooldown } from "@/lib/director/useCooldown";

// 목업 tint 색. 어두운 배경 위에서 아이콘 대비가 충분한 값.
const TINT = { amber: "#E8A23B", rose: "#D4537E" } as const;

export default function ErrorPanel({
  code,
  onAction,
  busy = false,
  since,
}: {
  code: string | null | undefined;
  onAction: (action: ActionKind) => void;
  busy?: boolean;
  /** 오류 발생 시각(ms). 같은 코드가 다시 와도 부모가 갱신하면 쿨다운이 다시 시작된다. 없으면 마운트 시각. */
  since?: number;
}) {
  const [mountedAt] = useState(() => Date.now());
  const copy = errorCopyFor(code);
  const remaining = useCooldown(copy.primary.cooldownSec, since ?? mountedAt);
  const color = TINT[copy.tint];

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-bg-dark-2 p-5 text-white md:p-8">
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-full border-2"
        style={{ borderColor: color, color }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M12 5v9M12 19v.01" />
        </svg>
      </span>
      {/* alert 는 문구 영역에만: 버튼 라벨이 1초마다 바뀌어도 스크린리더가 패널을 다시 읽지 않게 */}
      <div role="alert">
        <h2 className="mt-4 text-xl font-semibold md:text-3xl">{copy.headline}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70 md:text-base">{copy.sub}</p>
      </div>

      <div className="mt-6 flex flex-col gap-3 md:flex-row">
        <button
          type="button"
          disabled={busy || remaining > 0}
          onClick={() => onAction(copy.primary.action)}
          className="rounded-lg bg-brand px-5 py-3 text-sm font-medium text-bg-dark hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cooldownLabel(copy.primary.label, remaining)}
        </button>
        {copy.secondary && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction(copy.secondary!.action)}
            className="rounded-lg border border-white/25 px-5 py-3 text-sm text-white/80 hover:border-white hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.secondary.label}
          </button>
        )}
      </div>

      <p className="mt-6 rounded-lg bg-white/5 px-4 py-3 text-xs leading-relaxed text-white/70 md:text-sm">{copy.hint}</p>
    </div>
  );
}
