"use client";

import { useEffect, useState } from "react";

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
