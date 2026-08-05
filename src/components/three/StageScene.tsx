"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, SpotLight } from "@react-three/drei";
import { useEffect } from "react";

export type StageState = {
  color: string;
  spots: { left: boolean; center: boolean; right: boolean };
  angle: "front" | "audience" | "top";
};

// localStorage에 저장된 문자열을 StageState로 복원. 저장값이 없거나 깨졌으면 fallback.
export function parseStageState(raw: string | null, fallback: StageState): StageState {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as StageState;
  } catch {
    return fallback;
  }
}

const CAMERA_PRESETS: Record<StageState["angle"], [number, number, number]> = {
  front: [0, 2.5, 9],
  audience: [0, 1.2, 13],
  top: [0, 14, 0.1],
};

function CameraRig({ angle }: { angle: StageState["angle"] }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...CAMERA_PRESETS[angle]);
    camera.lookAt(0, 1.5, 0);
  }, [angle, camera]);
  return null;
}

function Spot({ x, color, on }: { x: number; color: string; on: boolean }) {
  if (!on) return null;
  return (
    <SpotLight
      position={[x, 6, 1]}
      color={color}
      intensity={300}
      angle={0.45}
      penumbra={0.6}
      attenuation={6}
      anglePower={4}
      castShadow
    />
  );
}

export default function StageScene({ state, controls = true }: { state: StageState; controls?: boolean }) {
  return (
    <Canvas shadows camera={{ position: CAMERA_PRESETS.front, fov: 50 }}>
      <CameraRig angle={state.angle} />
      <ambientLight intensity={0.15} />
      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#0b0818" />
      </mesh>
      {/* 연단 */}
      <mesh position={[0, 0.4, 0]} receiveShadow castShadow>
        <boxGeometry args={[8, 0.8, 4]} />
        <meshStandardMaterial color="#1a1533" />
      </mesh>
      {/* 배경 패널 */}
      <mesh position={[0, 3, -2.4]} receiveShadow>
        <boxGeometry args={[9, 5.5, 0.3]} />
        <meshStandardMaterial color="#13102a" />
      </mesh>
      <Spot x={-3} color={state.color} on={state.spots.left} />
      <Spot x={0} color={state.color} on={state.spots.center} />
      <Spot x={3} color={state.color} on={state.spots.right} />
      {controls && <OrbitControls makeDefault target={[0, 1.5, 0]} />}
    </Canvas>
  );
}
