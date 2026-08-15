"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __appHydrated?: boolean;
  }
}

// 루트 레이아웃의 사전 파싱 방지 스크립트(layout.tsx)가 hydration 성공 신호로 쓴다.
// 이 컴포넌트가 마운트된다는 것 자체가 클라이언트 번들이 정상 파싱·실행됐다는 증거다.
export default function HydrationSignal() {
  useEffect(() => {
    window.__appHydrated = true;
  }, []);
  return null;
}
