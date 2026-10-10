"use client";

import { useEffect, useRef } from "react";

// 분석·연출 진행을 일정 간격으로 확인한다 (계약서: 2~3초 간격).
// tick 이 true 를 돌려주면 멈춘다(끝났거나 사람의 확인을 기다리는 상태). enabled 가 false 가 되거나
// resetKey 가 바뀌거나 컴포넌트가 사라지면 진행 중인 대기·요청 결과를 버린다.
// 첫 확인은 바로 한다. 다음 확인은 이전 요청이 끝난 뒤 intervalMs 를 기다려서 겹치지 않는다.
export function usePolling(
  tick: () => Promise<boolean | void>,
  { enabled, intervalMs = 2500, resetKey }: { enabled: boolean; intervalMs?: number; resetKey?: unknown },
): void {
  // 호출부가 매 렌더 새 함수를 넘겨도 타이머가 다시 시작되지 않게 최신 함수만 ref 로 들고 있는다 (hooks.ts 와 같은 패턴)
  const latest = useRef(tick);
  useEffect(() => {
    latest.current = tick;
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      const done = await latest.current();
      if (cancelled || done === true) return;
      timer = setTimeout(run, intervalMs);
    };
    void run();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, intervalMs, resetKey]);
}
