"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DoubleSide, MeshBasicMaterial, SRGBColorSpace, TextureLoader, type Group, type Mesh, type Texture } from "three";
import type { Backdrop } from "@/lib/stage/scene";

// 뒤 벽(배경 패널 position [0,3,-2.4], 9×5.5, 두께 0.3 → 앞면 z=-2.25) 바로 앞에 그림
// gyro·cube 는 회전하면 벽 뒤로 파고들어 가려지므로 벽에서 반지름만큼만 띄우고(z -1.0/-1.1) 크기를 줄여 중앙과 스포트 빛줄기를 덜 가림
// 효과는 전부 MeshBasicMaterial(조명 영향 없음)이라 스포트라이트 세기와 무관하게 은은하게 보이고,
// 재질·지오메트리는 마운트 때 한 번만 만듦(재생 화면이 ~10Hz로 값을 바꿔도 GPU 리소스 재생성 없음).
const WALL_Z = -2.1;
const TINT = "#c9b8ff"; // RenderScene 에 색이 없어 흰색~보라 중립 톤으로 고정

// activity 변화가 튀지 않게 부드럽게 따라가는 값(ref) — 렌더가 아니라 프레임에서만 갱신
function useSmoothActivity(target: number) {
  const v = useRef(target);
  useFrame((_, dt) => {
    v.current += (target - v.current) * Math.min(1, dt * 3);
  });
  return v;
}

// react-hooks/immutability 가 훅이 돌려준 three 객체를 프레임 콜백에서 직접 고치는 걸 막아서, 값 갱신은 이 헬퍼로 할 것
export const setOpacity = (m: { opacity: number }, v: number) => {
  m.opacity = v;
};

// 효과 하나가 쓰는 재질 n개. 언마운트 때 dispose.
function useFxMaterials(n: number, wireframeFirst = false) {
  const mats = useMemo(
    () => Array.from({ length: n }, (_, i) => new MeshBasicMaterial({ color: TINT, transparent: true, opacity: 0.4, depthWrite: false, fog: false, side: DoubleSide, wireframe: wireframeFirst && i === 0 })),
    [n, wireframeFirst],
  );
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  return mats;
}

const BAR_COUNT = 16;
function Bars({ activity }: { activity: number }) {
  const act = useSmoothActivity(activity);
  const [mat] = useFxMaterials(1);
  const bars = useRef<(Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * (0.8 + act.current * 2.4);
    setOpacity(mat, 0.2 + act.current * 0.35);
    bars.current.forEach((m, i) => {
      if (!m) return;
      const h = 0.3 + (0.5 + 0.5 * Math.sin(t * 2 + i * 0.7) * Math.cos(t * 1.3 + i * 0.4)) * (1.2 + act.current * 2);
      m.scale.y = h;
      m.position.y = -2.1 + h / 2; // 바닥에 붙어 아래서 올라오는 막대
    });
  });
  return (
    <group position={[0, 3, WALL_Z]}>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <mesh key={i} ref={(m) => void (bars.current[i] = m)} position={[(i - (BAR_COUNT - 1) / 2) * 0.5, -2.1, 0]} material={mat}>
          <boxGeometry args={[0.36, 1, 0.05]} />
        </mesh>
      ))}
    </group>
  );
}

const RING_COUNT = 8;
function Tunnel({ activity }: { activity: number }) {
  const act = useSmoothActivity(activity);
  const mats = useFxMaterials(RING_COUNT);
  const rings = useRef<(Mesh | null)[]>([]);
  const phase = useRef(0);
  useFrame((_, dt) => {
    phase.current = (phase.current + dt * (0.08 + act.current * 0.4)) % 1;
    rings.current.forEach((m, i) => {
      if (!m) return;
      const p = (phase.current + i / RING_COUNT) % 1; // 0(멀리) → 1(코앞)
      const s = 0.1 + p * 1.05;
      m.scale.set(s * 1.6, s, 1);
      setOpacity(mats[i], Math.sin(Math.PI * p) * (0.35 + act.current * 0.5));
    });
  });
  return (
    <group position={[0, 3, WALL_Z]}>
      {mats.map((mat, i) => (
        <mesh key={i} ref={(m) => void (rings.current[i] = m)} material={mat}>
          <torusGeometry args={[2.1, 0.035, 6, 48]} />
        </mesh>
      ))}
    </group>
  );
}

const BEAM_COUNT = 7;
function Laser({ activity }: { activity: number }) {
  const act = useSmoothActivity(activity);
  const [mat] = useFxMaterials(1);
  const beams = useRef<(Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * (0.4 + act.current * 1.6);
    setOpacity(mat, 0.2 + act.current * 0.4);
    beams.current.forEach((g, i) => {
      if (g) g.rotation.z = (i - (BEAM_COUNT - 1) / 2) * 0.28 + Math.sin(t + i * 0.5) * 0.18; // 부채꼴이 좌우로 흔들림
    });
  });
  return (
    <group position={[0, 1, WALL_Z]}>
      {Array.from({ length: BEAM_COUNT }, (_, i) => (
        <group key={i} ref={(g) => void (beams.current[i] = g)}>
          {/* 빔은 부채 중심(아래)에서 위로 뻗는다 */}
          <mesh position={[0, 2.4, 0]} material={mat}>
            <boxGeometry args={[0.04, 4.8, 0.02]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Gyro({ activity }: { activity: number }) {
  const act = useSmoothActivity(activity);
  const mats = useFxMaterials(3);
  const g = useRef<Group>(null);
  const rings = useRef<(Mesh | null)[]>([]);
  useFrame((_, dt) => {
    const sp = 0.2 + act.current * 1.2; // 회전 속도 = 0.2 + activity*1.2
    mats.forEach((m) => setOpacity(m, 0.3 + act.current * 0.4));
    rings.current.forEach((m, i) => {
      if (!m) return;
      m.rotation.x += dt * sp * (i === 0 ? 1 : 0.4);
      m.rotation.y += dt * sp * (i === 1 ? 1.2 : 0.3);
      m.rotation.z += dt * sp * (i === 2 ? 1 : 0.2);
    });
  });
  return (
    <group ref={g} position={[0, 3, -1]}>
      {[1.2, 0.9, 0.6].map((r, i) => (
        <mesh key={i} ref={(m) => void (rings.current[i] = m)} material={mats[i]}>
          <torusGeometry args={[r, 0.04, 8, 64]} />
        </mesh>
      ))}
    </group>
  );
}

function Cube({ activity }: { activity: number }) {
  const act = useSmoothActivity(activity);
  const mats = useFxMaterials(2, true);
  const outer = useRef<Mesh>(null);
  const inner = useRef<Mesh>(null);
  useFrame((_, dt) => {
    const sp = 0.2 + act.current * 1.2;
    setOpacity(mats[0], 0.4 + act.current * 0.5);
    setOpacity(mats[1], 0.08 + act.current * 0.15);
    for (const m of [outer.current, inner.current]) {
      if (!m) continue;
      m.rotation.x += dt * sp * 0.7;
      m.rotation.y += dt * sp;
    }
  });
  return (
    <group position={[0, 3, -1.1]}>
      <mesh ref={outer} material={mats[0]}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
      </mesh>
      <mesh ref={inner} material={mats[1]}>
        <boxGeometry args={[0.7, 0.7, 0.7]} />
      </mesh>
    </group>
  );
}

// 이미지 벽 — imageUrl 은 서명 URL이라 로그를 남기지 않음. 로드 실패·지연이면 아무것도 안 그림
// url 이 바뀌면 새 이미지가 올 때까지 이전 이미지를 유지하고, 교체된 뒤에 이전 텍스처를 dispose
// 이미지는 뒤 벽(9×5.5) 전체를 cover 로 채움: 비율이 다르면 넘치는 쪽을 가운데 기준으로 자름(늘어나지 않음).
const WALL_W = 9;
const WALL_H = 5.5;
type Loaded = { tex: Texture; w: number; h: number };
function ImageWall({ url }: { url: string }) {
  const [shown, setShown] = useState<Loaded | null>(null);
  useEffect(() => {
    let cancelled = false;
    new TextureLoader().load(
      url,
      (t) => {
        if (cancelled) return t.dispose();
        t.colorSpace = SRGBColorSpace;
        const img = t.image as { width: number; height: number };
        const wall = WALL_W / WALL_H;
        const ratio = img.width / img.height;
        if (ratio > wall) {
          t.repeat.set(wall / ratio, 1);
          t.offset.set((1 - wall / ratio) / 2, 0);
        } else {
          t.repeat.set(1, ratio / wall);
          t.offset.set(0, (1 - ratio / wall) / 2);
        }
        setShown({ tex: t, w: WALL_W, h: WALL_H });
      },
      undefined,
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [url]);
  // shown 이 바뀌면(=새 텍스처로 교체된 뒤) 이전 것을, 언마운트 땐 마지막 것을 해제
  useEffect(() => () => shown?.tex.dispose(), [shown]);
  if (!shown) return null;
  return (
    <mesh position={[0, 3, WALL_Z - 0.04]}>
      <planeGeometry args={[shown.w, shown.h]} />
      <meshBasicMaterial map={shown.tex} toneMapped={false} fog={false} />
    </mesh>
  );
}

// 모션 줄이기 설정이면 activity 를 낮게 고정 — matchMedia 는 useSyncExternalStore 로 구독
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useReducedMotion() {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED_QUERY).matches, () => false);
}

export default function StageBackdrop({ backdrop, imageUrl, activity: rawActivity }: { backdrop: Backdrop; imageUrl: string | null; activity: number }) {
  const activity = useReducedMotion() ? 0.1 : rawActivity;
  if (imageUrl) return <ImageWall url={imageUrl} />;
  switch (backdrop) {
    case "bars":
      return <Bars activity={activity} />;
    case "tunnel":
      return <Tunnel activity={activity} />;
    case "laser":
      return <Laser activity={activity} />;
    case "gyro":
      return <Gyro activity={activity} />;
    case "cube":
      return <Cube activity={activity} />;
    default:
      return null;
  }
}
