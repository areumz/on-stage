"use client";

import type { PropKey } from "@/lib/stage/scene";

// 연단 윗면 y=0.8. 중앙(스포트라이트·무대 중심)을 비우고 가장자리/뒤쪽에 둔다.
// 단순 primitive 만 쓰고 castShadow 는 켜지 않는다.
const BODY = "#6b5cb0";
const DARK = "#3a3170";
const METAL = "#b3aed0";
// 소품은 무대 가장자리라 스포트라이트가 거의 닿지 않아(조명 ambient 0.15) 밝은 배경 앞에서 검은 그림자처럼 보였다.
// 자체 발광을 약하게 줘서 조명과 상관없이 색과 윤곽이 보이게 한다.
const GLOW = 0.45;

function Amp() {
  return (
    <group position={[-3.3, 0.8, -1.2]} rotation={[0, 0.3, 0]}>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[1, 1.2, 0.6]} />
        <meshStandardMaterial color={BODY} emissive={BODY} emissiveIntensity={GLOW} />
      </mesh>
      <mesh position={[0, 0.5, 0.31]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshStandardMaterial color={DARK} emissive={DARK} emissiveIntensity={GLOW} />
      </mesh>
    </group>
  );
}

function Drum() {
  return (
    <group position={[2.6, 0.8, -1.1]}>
      <mesh position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.5, 20]} />
        <meshStandardMaterial color={BODY} emissive={BODY} emissiveIntensity={GLOW} />
      </mesh>
      <mesh position={[-0.5, 0.95, 0.05]}>
        <cylinderGeometry args={[0.28, 0.28, 0.25, 20]} />
        <meshStandardMaterial color={BODY} emissive={BODY} emissiveIntensity={GLOW} />
      </mesh>
      <mesh position={[0.5, 0.95, 0.05]}>
        <cylinderGeometry args={[0.28, 0.28, 0.25, 20]} />
        <meshStandardMaterial color={BODY} emissive={BODY} emissiveIntensity={GLOW} />
      </mesh>
      <mesh position={[0.95, 0.6, 0.5]}>
        <cylinderGeometry args={[0.32, 0.32, 0.4, 20]} />
        <meshStandardMaterial color={BODY} emissive={BODY} emissiveIntensity={GLOW} />
      </mesh>
      <mesh position={[-1.0, 1.5, -0.1]}>
        <cylinderGeometry args={[0.4, 0.4, 0.02, 20]} />
        <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} emissive={METAL} emissiveIntensity={GLOW} />
      </mesh>
    </group>
  );
}

function Mic() {
  return (
    <group position={[-1.1, 0.8, 1.1]}>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 16]} />
        <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} emissive={METAL} emissiveIntensity={GLOW} />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 1.4, 8]} />
        <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} emissive={METAL} emissiveIntensity={GLOW} />
      </mesh>
      <mesh position={[0, 1.48, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color={DARK} emissive={DARK} emissiveIntensity={GLOW} />
      </mesh>
    </group>
  );
}

export default function StageProps({ props }: { props: readonly PropKey[] }) {
  return (
    <>
      {props.includes("amp") && <Amp />}
      {props.includes("drum") && <Drum />}
      {props.includes("mic") && <Mic />}
    </>
  );
}
