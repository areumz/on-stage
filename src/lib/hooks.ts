"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

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

function getServerStageSnapshot() {
  return null;
}

export function writeStageState(slug: string, value: string) {
  localStorage.setItem(stageStorageKey(slug), value);
  stageListeners.forEach((listener) => listener());
}

export function useStageStateSnapshot(slug: string): string | null {
  return useSyncExternalStore(
    subscribeStageState,
    () => localStorage.getItem(stageStorageKey(slug)),
    getServerStageSnapshot,
  );
}
