"use client";

import { useSyncExternalStore } from "react";

// 궤도 카메라 포커스 요청 저장소. 에이전트 액션, ?focus= 쿼리, 아티스트 페이지에서 궤도로 돌아오는
// 경우가 모두 같은 경로를 쓴다. 요청은 모듈 변수에 남아 있어서 궤도 화면이 나중에 마운트돼도 받을 수 있고,
// takeFocus가 한 번만 돌려줘서 /로 다시 돌아왔을 때 옛 요청이 재실행되지 않는다.
export type FocusRequest = { slug: string; nonce: number };

let current: FocusRequest | null = null;
let nonce = 0;
let handled = 0;
const listeners = new Set<() => void>();

export function requestFocus(slug: string): void {
  current = { slug, nonce: ++nonce };
  listeners.forEach((l) => l());
}

export function takeFocus(): FocusRequest | null {
  if (!current || current.nonce <= handled) return null;
  handled = current.nonce;
  return current;
}

export function subscribeFocus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// 렌더를 다시 일으키는 용도. 값을 꺼내 쓰는 건 takeFocus
export function useFocusRequest(): FocusRequest | null {
  return useSyncExternalStore(subscribeFocus, () => current, () => null);
}
