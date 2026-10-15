// src/components/three/orbitShared.tsx
"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { MathUtils, type Group } from "three";
import { cameraDistanceForEllipse, focusRotationTarget } from "@/lib/geometry";
import { requestFocus, takeFocus, useFocusRequest } from "@/lib/guide/orbitFocus";
import type { Artist } from "@/lib/types";

// 안쪽 반경은 중앙 문구(STAGE.ONE)가 들어갈 자리를 비워 두는 값이다
export const RING_RADII = [1.9, 2.55, 3.2];
export const FOV_DEG = 50;
// 노드 반지름·라벨이 궤도 반경보다 살짝 더 뻗어나가는 여유분
const CAMERA_MARGIN = 1.2;

const AUTO_SPEED = 0.08; // rad/s
const DAMP = 3; // 클수록 빨리 도착
const ARRIVE_EPS = 0.002;
const RESUME_AFTER_S = 8; // 도착 후 이 시간이 지나면 자동 회전 재개

// 컨테이너 가로세로비에 맞춰 궤도 전체가 프레임 안에 들어오게 카메라 거리를 다시 계산한다.
// verticalScale: 궤도 세로 폭 비율(기울인 3D는 1보다 작게, 평면 2D는 1)
export function OrbitCameraRig({ verticalScale = 1 }: { verticalScale?: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const r = RING_RADII.at(-1)! * CAMERA_MARGIN;
    const z = cameraDistanceForEllipse(r, r * verticalScale, FOV_DEG, size.width / size.height);
    camera.position.set(0, 0, z);
  }, [camera, size.width, size.height, verticalScale]);
  return null;
}

// 궤도 묶음의 자동 회전 + focus 요청에 따른 목표 회전. 전부 ref로만 갱신한다(React state 없음).
// groupRef를 회전시킬 그룹에 연결하고, focused ref는 노드가 강조(확대) 판단에 읽는다.
export function useOrbitSpin(artists: Artist[], faceAngle: number) {
  const groupRef = useRef<Group>(null);
  const rotation = useRef(0);
  const target = useRef<number | null>(null);
  const focused = useRef<string | null>(null);
  const idle = useRef(0);
  const request = useFocusRequest();

  useEffect(() => {
    const r = takeFocus();
    if (!r) return;
    const artist = artists.find((a) => a.slug === r.slug);
    if (!artist) return;
    target.current = focusRotationTarget(rotation.current, (artist.angle * Math.PI) / 180, faceAngle);
    focused.current = artist.slug;
    idle.current = 0;
  }, [request, artists, faceAngle]);

  useFrame((_, delta) => {
    if (target.current !== null) {
      rotation.current = MathUtils.damp(rotation.current, target.current, DAMP, delta);
      if (Math.abs(target.current - rotation.current) < ARRIVE_EPS) {
        rotation.current = target.current;
        target.current = null;
      }
    } else if (focused.current) {
      idle.current += delta;
      if (idle.current > RESUME_AFTER_S) focused.current = null;
    } else {
      rotation.current += delta * AUTO_SPEED;
    }
    if (groupRef.current) groupRef.current.rotation.z = rotation.current;
  });

  return { groupRef, rotation, focused };
}

// ?focus=<slug> 로 열렸을 때 focus 요청을 한 번 보낸다(개발 확인용). 모르는 slug는 useOrbitSpin이 무시한다.
export function FocusFromQuery({ slug }: { slug: string }) {
  useEffect(() => {
    requestFocus(slug);
  }, [slug]);
  return null;
}
