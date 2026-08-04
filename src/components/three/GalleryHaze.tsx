"use client";

// 무대 조명 먼지 — 사진은 그대로 두고 그리드 뒤에 얹는 장식 레이어.
// 떠다니는 파티클은 drei의 Sparkles가 정확히 이 용도라 직접 셰이더를 짤 필요가 없음.

import { Canvas } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";

export default function GalleryHaze({ color }: { color: string }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <Canvas camera={{ position: [0, 0, 9], fov: 50 }}>
        <Sparkles count={220} scale={[16, 12, 6]} size={3} speed={0.15} opacity={0.55} color={color} />
      </Canvas>
    </div>
  );
}
