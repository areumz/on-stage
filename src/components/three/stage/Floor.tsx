"use client";

import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import { useRef, useState } from "react";

// drei MeshReflectorMaterial 은 렌더 타깃(FBO)·BlurPass 를 useMemo 로 만들고 deps 에 반사 세기(mixStrength) 가 있어,
// 그 값을 prop 으로 바꾸면 값이 바뀔 때마다 렌더 타깃이 새로 생기고 이전 것은 해제되지 않는 누수 생김
// -> mixStrength 는 고정 prop(0)으로 한 번만 만들고, reflection 은 재질 ref 의 uniform 으로 useFrame 에서 직접 넣음.
// 반사 재질은 reflection>0 이 처음 나왔을 때 한 번만 마운트하고 그 뒤로는 안 내림 — 0 이면 숨기기만
// 한 번이라도 켠 뒤에는 숨겨도 매 프레임 반사 패스가 돈다(drei 한계).
// 반사 재질은 "바닥색 × 반사"에 조명(ambient 0.15뿐)을 곱해서 바닥색이 어두우면(#16151c) 반사가 안 보여 색을 밝게 둠.
// reflection 이 한 번도 안 켜졌거나 0 이면 기존 바닥(#16151c standard)과 완전히 같음
const FLOOR_ARGS: [number, number] = [30, 30];

function ReflectiveFloor({ reflection }: { reflection: number }) {
  const mat = useRef<{ mixStrength: number } | null>(null);
  useFrame(() => {
    if (mat.current) mat.current.mixStrength = (reflection / 100) * 12;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={FLOOR_ARGS} />
      <MeshReflectorMaterial ref={mat as never} color="#e6e4f0" fog={false} resolution={256} blur={[60, 30]} mixBlur={1} mixStrength={0} mirror={0.95} roughness={1} />
    </mesh>
  );
}

export default function Floor({ reflection }: { reflection: number }) {
  const [everOn, setEverOn] = useState(false);
  if (reflection > 0 && !everOn) setEverOn(true);
  return (
    <>
      {reflection <= 0 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={FLOOR_ARGS} />
          <meshStandardMaterial color="#16151c" emissive="#16151c" emissiveIntensity={0.3} fog={false} />
        </mesh>
      )}
      {everOn && (
        <group visible={reflection > 0}>
          <ReflectiveFloor reflection={reflection} />
        </group>
      )}
    </>
  );
}
