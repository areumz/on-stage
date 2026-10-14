"use client";

import { useEffect, useEffectEvent } from "react";

// 분석·연출 진행을 일정 간격으로 확인한다 (계약서: 2~3초 간격).
// tick 이 true 를 돌려주면 멈춘다(끝났거나 사람의 확인을 기다리는 상태). enabled 가 false 가 되거나
// resetKey 가 바뀌거나 컴포넌트가 사라지면 진행 중인 대기·요청 결과를 버린다.
// 첫 확인은 바로 한다. 다음 확인은 이전 요청이 끝난 뒤 intervalMs 를 기다려서 겹치지 않는다.
export function usePolling(
  tick: () => Promise<boolean | void>,
  { enabled, intervalMs = 2500, resetKey }: { enabled: boolean; intervalMs?: number; resetKey?: unknown },
): void {
  // 호출부가 매 렌더 새 함수를 넘겨도 타이머가 다시 시작되지 않게 Effect Event 로 감싼다.
  // 항상 최신 tick 을 부르지만 effect 의 의존성에는 들어가지 않는다.
  const latestTick = useEffectEvent(tick);

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    void (async () => {
      while (!ctrl.signal.aborted) {
        const done = await latestTick();
        if (ctrl.signal.aborted || done === true) return;
        await sleep(intervalMs, ctrl.signal);
      }
    })();
    return () => ctrl.abort(); // 대기 중인 타이머도 같이 멈춘다
  }, [enabled, intervalMs, resetKey]);
}

// signal 이 중단되면 기다리던 타이머를 지우고 바로 끝난다
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
