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
// 최신 값만 남기고 그 상한 안에서 최대 한 번만 흘려보냄.
// 100ms는 슬라이더 자체의 화면 표시(네이티브 DOM, React와 무관하게 즉시 갱신)에는 영향이 없고 3D 씬 반영만 살짝 늦춤
export function useThrottledChange<T>(onChange: (value: T) => void): (value: T) => void {
  const latest = useRef<T | null>(null);
  const scheduled = useRef(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  return useCallback((value: T) => {
    latest.current = value;
    if (scheduled.current) return;
    scheduled.current = true;
    setTimeout(() => {
      scheduled.current = false;
      onChangeRef.current(latest.current as T);
    }, 100);
  }, []);
}
