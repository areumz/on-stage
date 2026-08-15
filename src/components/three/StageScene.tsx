"use client";

import { useThree } from "@react-three/fiber";
import { Cloud, Clouds, OrbitControls, SpotLight } from "@react-three/drei";
import { useEffect } from "react";
import Scene3D from "@/components/three/Scene3D";
import type { SpotState, StageState } from "@/lib/stageState";

const CAMERA_PRESETS: Record<StageState["camera"], [number, number, number]> = {
  front: [0, 2.5, 9],
  audience: [0, 1.2, 13],
  top: [0, 14, 0.1],
};

function CameraRig({ cameraAngle }: { cameraAngle: StageState["camera"] }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...CAMERA_PRESETS[cameraAngle]);
    camera.lookAt(0, 1.5, 0);
  }, [cameraAngle, camera]);
  return null;
}

// density === 0이면 씬 그래프에 아예 안 올림 — opacity 0으로만 두면 예산을 쓰면서 남아 있음
// smoke.density(0~1, UI 슬라이더 스케일)를 그대로 넣으면 FogExp2·Cloud 둘 다 이 씬 규모(연단
// 8×0.8×4, 카메라 9~14 거리)에 비해 과하게 짙어져 무대가 하얗게 덮임 — 씬에 맞는 범위로 눌러줌
function Smoke({ smoke }: { smoke: StageState["smoke"] }) {
  if (smoke.density === 0) return null;
  return (
    <>
      <fogExp2 attach="fog" args={[smoke.color, smoke.density * 0.1]} />
      <Clouds texture="/textures/cloud.png">
        <Cloud position={[0, 1, 2]} bounds={[4, 1.2, 1.5]} volume={3} opacity={smoke.density * 0.6} color={smoke.color} speed={0.2} />
      </Clouds>
    </>
  );
}

function Spot({ x, color, spot }: { x: number; color: string; spot: SpotState }) {
  if (!spot.on) return null;
  return (
    <SpotLight
      position={[x, 6, 1]}
      color={color}
      intensity={spot.intensity}
      angle={spot.angle}
      penumbra={spot.penumbra}
      attenuation={6}
      anglePower={4}
      castShadow
    />
  );
}

export default function StageScene({ state, controls = true }: { state: StageState; controls?: boolean }) {
  return (
    <Scene3D shadows camera={{ position: CAMERA_PRESETS.front, fov: 50 }}>
      <CameraRig cameraAngle={state.camera} />
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
      <Smoke smoke={state.smoke} />
      <Spot x={-3} color={state.color} spot={state.spots.left} />
      <Spot x={0} color={state.color} spot={state.spots.center} />
      <Spot x={3} color={state.color} spot={state.spots.right} />
      {controls && <OrbitControls makeDefault target={[0, 1.5, 0]} />}
    </Scene3D>
  );
}
