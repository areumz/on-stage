"use client";

import { useGuideOptional } from "@/components/guide/GuideProvider";

// 가이드 패널이 열리면 궤도 장면을 옆(모바일은 위)으로 비켜 준다. 래퍼에만 transform을 주고
// 캔버스 컨테이너 크기는 바꾸지 않는다(R3F 캔버스 리사이즈가 webglcontextlost를 일으킨 적이 있다).
export default function OrbitStage({ children }: { children: React.ReactNode }) {
  const open = useGuideOptional()?.open ?? false;
  return (
    <div
      className={`absolute inset-0 transition-transform duration-[600ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${
        open ? "max-md:-translate-y-[34dvh] max-md:scale-[0.62] md:-translate-x-[min(150px,12vw)]" : ""
      }`}
    >
      {children}
    </div>
  );
}
