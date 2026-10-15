// src/components/three/OrbitScene3D.tsx
"use client";

import { Html, Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type RefObject } from "react";
import { AdditiveBlending, CanvasTexture, Color, Vector3, type Group, type MeshStandardMaterial, type PerspectiveCamera } from "three";
import Scene3D from "@/components/three/Scene3D";
import { FOV_DEG, OrbitCameraRig, RING_RADII, useOrbitSpin } from "@/components/three/orbitShared";
import { FACE_ANGLE_3D, ORBIT_TILT, ringPoints } from "@/lib/geometry";
import type { Artist } from "@/lib/types";

// 50° 기울인 궤도의 세로 폭 ≈ sin(50°)=0.77, 앞쪽이 원근으로 커지는 몫을 더해 0.9
const ORBIT_VERTICAL_SCALE = 0.9;
const FOCUS_SCALE = 1.35;
const HOVER_SCALE = 1.2;

// 노드 뒤에 깔리는 부드러운 빛번짐. 흰색 방사형 그라디언트를 만들어 두고 아티스트 색으로 물들인다.
let glowTexture: CanvasTexture | null = null;
function getGlowTexture(): CanvasTexture {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const g = canvas.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.6)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.18)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTexture = new CanvasTexture(canvas);
  return glowTexture;
}

// 앞쪽(카메라에 가까운) 노드는 또렷하게, 뒤쪽은 흐리게 — 목업의 앞/뒤 불투명도(1 / 0.62)
// 투명도로 흐리게 하면 구체 뒤의 궤도선이 비쳐 보여서, 불투명 재질의 색을 배경색 쪽으로 섞어 흐리게 한다.
const BACK_OPACITY = 0.62;
const BG_COLOR = new Color("#0e0a1f"); // globals.css의 --color-bg-dark
const DEPTH_RANGE = 3; // 이 범위(월드 z)에서 뒤→앞으로 보간

function ArtistNode3D({ artist, focused }: { artist: Artist; focused: RefObject<string | null> }) {
  const router = useRouter();
  const group = useRef<Group>(null);
  const material = useRef<MeshStandardMaterial>(null);
  const nameEl = useRef<HTMLButtonElement>(null);
  const initialsEl = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const r = RING_RADII[artist.orbit];
  const a = (artist.angle * Math.PI) / 180;
  const size = 0.32 * artist.size;
  const enter = () => router.push(`/artists/${artist.slug}`);
  const tmp = useMemo(() => new Vector3(), []);
  const baseColor = useMemo(() => new Color(artist.color), [artist.color]);
  const { camera, size: view } = useThree();

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.scale.setScalar(hovered ? HOVER_SCALE : focused.current === artist.slug ? FOCUS_SCALE : 1);
    // 월드 z가 클수록 카메라에 가깝다
    g.getWorldPosition(tmp);
    // 이름표는 3D 안에서 오프셋을 주면 기울어진 궤도·원근 때문에 옆으로 밀린다. 노드의 화면상 반지름(px)을
    // 카메라 거리에서 계산해 CSS로 바로 아래에 내린다.
    const dist = camera.position.distanceTo(tmp);
    const fov = ((camera as PerspectiveCamera).fov * Math.PI) / 180;
    const pxPerUnit = view.height / (2 * dist * Math.tan(fov / 2));
    if (nameEl.current) {
      nameEl.current.style.transform = `translateY(${size * g.scale.x * pxPerUnit + 16}px)`;
    }
    const t = Math.min(1, Math.max(0, (tmp.z + DEPTH_RANGE / 2) / DEPTH_RANGE));
    const opacity = BACK_OPACITY + (1 - BACK_OPACITY) * t;
    if (material.current) {
      material.current.color.copy(BG_COLOR).lerp(baseColor, opacity);
      material.current.emissive.copy(BG_COLOR).lerp(baseColor, opacity);
    }
    if (nameEl.current) nameEl.current.style.opacity = String(opacity);
    if (initialsEl.current) initialsEl.current.style.opacity = String(opacity);
  });

  return (
    <group ref={group} position={[Math.cos(a) * r, Math.sin(a) * r, 0]}>
      <sprite renderOrder={1} scale={[size * 3.4, size * 3.4, 1]}>
        <spriteMaterial map={getGlowTexture()} color={artist.color} transparent depthWrite={false} blending={AdditiveBlending} opacity={0.55} />
      </sprite>
      {/* 기울어진 궤도선이 노드 앞쪽을 가로지르면 선 조각이 구체 위로 삐져나와 보인다. 노드를 선보다 나중에 그려 항상 덮는다 */}
      <mesh
        renderOrder={2}
        onClick={enter}
        onPointerOver={() => { setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
      >
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial ref={material} color={artist.color} emissive={artist.color} emissiveIntensity={0.16} roughness={0.85} metalness={0} transparent depthTest={false} />
      </mesh>
      {/* 패널(z-40)보다 아래에 깔리도록 z-index 범위를 낮춘다 */}
      <Html center zIndexRange={[20, 0]} pointerEvents="none">
        <span
          ref={initialsEl}
          className="select-none whitespace-nowrap font-semibold text-white/90"
          style={{ fontSize: `${Math.round(10 + artist.size * 5)}px` }}
        >
          {artist.initials}
        </span>
      </Html>
      <Html center zIndexRange={[20, 0]}>
        <button
          ref={nameEl}
          type="button"
          onClick={enter}
          className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.15em] text-[#CFC6E6] sm:text-xs sm:tracking-[0.2em] hover:text-white focus-visible:outline-2 focus-visible:outline-brand-soft"
        >
          {artist.name}
        </button>
      </Html>
    </group>
  );
}

function Orbits3D({ artists }: { artists: Artist[] }) {
  const { groupRef, focused } = useOrbitSpin(artists, FACE_ANGLE_3D);
  const rings = useMemo(() => RING_RADII.map(ringPoints), []);
  return (
    <group rotation={[ORBIT_TILT, 0, 0]}>
      <group ref={groupRef}>
        {rings.map((pts, i) => (
          <Line key={i} points={pts} color="#3a2f5e" lineWidth={1} />
        ))}
        {artists.map((a) => (
          <ArtistNode3D key={a.slug} artist={a} focused={focused} />
        ))}
      </group>
    </group>
  );
}

export default function OrbitScene3D({ artists }: { artists: Artist[] }) {
  return (
    // 모바일 GPU 부담을 줄이려고 dpr 상한을 1.5로 (Scene3D가 canvasProps로 덮어쓰기를 허용)
    <Scene3D camera={{ position: [0, 0, 8], fov: FOV_DEG }} dpr={[1, 1.5]}>
      <OrbitCameraRig verticalScale={ORBIT_VERTICAL_SCALE} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[-3, 4, 5]} intensity={2.2} />
      <Orbits3D artists={artists} />
    </Scene3D>
  );
}
