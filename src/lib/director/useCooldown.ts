"use client";

import { useEffect, useState } from "react";
import { remainingSeconds } from "./cooldown";

// 오류가 발생한 시각(startedAt, ms)부터 남은 초를 돌려준다. startedAt 이 새로 오면 다시 시작한다.
// effect 본문에서 동기 setState 를 못 쓰므로(react-hooks/set-state-in-effect) now 는
// interval 콜백에서만 갱신한다. 새 startedAt 이 now 보다 미래면 경과는 0 으로 잘라 total 로 보인다.
export function useCooldown(seconds: number | undefined, startedAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  const remaining = remainingSeconds(seconds, startedAt, now);
  const active = remaining > 0;

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, startedAt]);

  return remaining;
}
