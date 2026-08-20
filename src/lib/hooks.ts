"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** 섹션 상단이 뷰포트 하단에 닿을 때 0 → 섹션 하단이 뷰포트 상단에 닿을 때 1 */
export function useSectionScroll(ref: React.RefObject<HTMLElement | null>): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height + window.innerHeight;
      const passed = window.innerHeight - rect.top;
      setProgress(Math.min(1, Math.max(0, passed / total)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [ref]);

  return progress;
}

// 무대 연출 설정(localStorage, 아티스트별) — useSyncExternalStore로 구독.
// useEffect에서 setState를 직접 호출하는 방식은 react-hooks/set-state-in-effect에 걸림
// (effect 본문에서의 동기 setState는 금지 — 외부 저장소 동기화는 useSyncExternalStore를 쓰는 것이 권장됨
const stageListeners = new Set<() => void>();

function stageStorageKey(slug: string) {
  return `stage-state:${slug}`;
}

function subscribeStageState(listener: () => void) {
  stageListeners.add(listener);
  return () => stageListeners.delete(listener);
}

export function writeStageState(slug: string, value: string) {
  localStorage.setItem(stageStorageKey(slug), value);
  stageListeners.forEach((listener) => listener());
}

export function useStageStateSnapshot(slug: string): string | null {
  return useSyncExternalStore(
    subscribeStageState,
    () => localStorage.getItem(stageStorageKey(slug)),
    () => null,
  );
}

// range 슬라이더를 드래그하면 input 이벤트가 잦음. 매번 그대로 R3F 씬(StageScene → Canvas)까지
// 흘려보내면 R3F의 <Canvas>가 렌더마다 재구성을 반복하다 webglcontextlost를 일으키는 것 확인
// rAF(16ms) 간격으로 눌러도 재현됐고, 100ms(초당 10커밋)에서야 안정적으로 사라짐.
// 100ms는 슬라이더 자체의 화면 표시(네이티브 DOM, React와 무관하게 즉시 갱신)에는 영향이 없고
// 3D 씬 반영만 살짝 늦춤.
//
// 부분 패치(patch)만 받아 대기 중인 값 위에 계속 얕게 병합한다 — 처음엔 호출부가 `{ ...spot, [key]:
// 값 }`처럼 전체 객체를 새로 만들었는데, 그 `spot`이 100ms 대기 구간 동안은 아직 커밋 전이라 오래된
// (stale) 값이었다. 같은 컴포넌트에서 필드 두 개를 100ms 안에 번갈아 조작하면(예: 밝기 드래그 직후
// 조명각 드래그) 나중 호출이 그 stale 값으로 전체 객체를 다시 만들어 먼저 바뀐 필드를 덮어써 사라지는
// 버그가 실사용에서 재현됐다. 대기 구간의 시작 시점 `current`를 커밋 시점까지 고정해두고, 그 위에
// 패치들을 누적 병합해 커밋하면 어떤 순서로 필드를 만져도 서로 지우지 않는다.
// 저장 성공/실패 메시지를 일정 시간 뒤 자동으로 지운다. setValue는 useState의 setter라 항상
// 안정된 참조이므로 effect가 value 변화에만 반응해도 안전하다(원래 각 컴포넌트에 흩어져 있던
// `useEffect(() => { if (!x) return; setTimeout(() => setX(empty), 3000); ... }, [x])`를 하나로 모음).
export function useAutoDismiss<T>(value: T, setValue: (v: T) => void, emptyValue: T, ms = 3000): void {
  useEffect(() => {
    if (value === emptyValue) return;
    const timer = setTimeout(() => setValue(emptyValue), ms);
    return () => clearTimeout(timer);
  }, [value, setValue, emptyValue, ms]);
}

export function useThrottledChange<T extends object>(current: T, onChange: (value: T) => void): (patch: Partial<T>) => void {
  const pending = useRef<Partial<T>>({});
  const scheduled = useRef(false);
  const latestRef = useRef({ current, onChange });
  useEffect(() => {
    latestRef.current = { current, onChange };
  });

  return useCallback((patch: Partial<T>) => {
    pending.current = { ...pending.current, ...patch };
    if (scheduled.current) return;
    scheduled.current = true;
    setTimeout(() => {
      scheduled.current = false;
      const { current, onChange } = latestRef.current;
      const merged = { ...current, ...pending.current };
      pending.current = {};
      onChange(merged);
    }, 100);
  }, []);
}
