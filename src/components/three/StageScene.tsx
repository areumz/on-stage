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
//
// Cloud의 opacity를 smoke.density에 묶음. drei Cloud는 opacity가 바뀔 때마다 구름 조각 배치를
// 통째로 재계산해서(내부 useMemo 의존성에 opacity 포함) 고정값으로 뒀었는데, 그러면 fog만
// 반응하고 눈에 띄는 구름 뭉치 크기는 슬라이더와 무관해져 "화면이 밝아지기만 하지 연기가 짙어지는
// 느낌이 안 드는 문제가 있었음. `SmokeControls`의 `onChange`가 이미
// `useThrottledChange`로 100ms(초당 10커밋)까지 눌려 있어서(webglcontextlost 재발 방지, 위
// Task 3 수정 이력 참조) opacity 재계산도 그 이하 빈도로만 일어나 안전하다 — 재검증 완료.
function Smoke({ smoke }: { smoke: StageState["smoke"] }) {
  if (smoke.density === 0) return null;
  return (
    <>
      <fogExp2 attach="fog" args={[smoke.color, smoke.density * 0.06]} />
      <Clouds texture="/textures/cloud.png">
        <Cloud position={[0, 1, 2]} bounds={[4, 1.2, 1.5]} volume={3} opacity={smoke.density * 0.6} color={smoke.color} speed={0.2} />
      </Clouds>
    </>
  );
}

// drei SpotLight의 눈에 보이는 빛줄기(VolumetricMesh)는 angle/attenuation/anglePower/opacity만 받고
// intensity/penumbra는 안 받음 — intensity를 그대로 줘도 실제 THREE.SpotLight의 조도(주변 바닥·연단이
// 받는 빛)만 바뀌고 빛줄기 모양엔 반영되지 않아 "슬라이더가 안 먹는 것처럼" 보임 (실측: 0과 1000이
// 픽셀 단위로 동일). intensity는 빛줄기의 opacity에도 매핑해 밝기 변화가 눈에 보이게 함.
// penumbra는 VolumetricMesh 쪽에 대응하는 파라미터가 없어 빛줄기 모양에는 반영할 수 없음 —
// 새 셰이더를 쓰지 않는 한(설계 제약) 실제 조도에만 영향을 줌.
function Spot({ x, color, spot }: { x: number; color: string; spot: SpotState }) {
  if (!spot.on) return null;
  return (
    <SpotLight
      position={[x, 6, 1]}
      color={color}
      intensity={spot.intensity}
      angle={spot.angle}
      penumbra={spot.penumbra}
      opacity={spot.intensity / 1000}
      attenuation={6}
      anglePower={4}
      castShadow
    />
  );
}

export default function StageScene({ state, controls = true }: { state: StageState; controls?: boolean }) {
  return (
    <Scene3D shadows notifyContextLoss dpr={[1, 1.5]} camera={{ position: CAMERA_PRESETS.front, fov: 50 }}>
      <CameraRig cameraAngle={state.camera} />
      <ambientLight intensity={0.15} />
      {/* 바닥 — 30×30이라 먼 가장자리가 카메라에서 아주 먼 상태. 안개를 그대로 적용하면 지평선이
          순백으로 뻗어나가 버려서(스모그가 아니라 바닥이 사라지는 것처럼 보임) fog를 끔*/}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#0b0818" fog={false} />
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
