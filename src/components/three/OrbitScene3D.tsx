// src/components/three/OrbitScene3D.tsx
"use client";

import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type RefObject } from "react";
import type { Group } from "three";
import Scene3D from "@/components/three/Scene3D";
import { FOV_DEG, OrbitCameraRig, RING_RADII, useOrbitSpin } from "@/components/three/orbitShared";
import { FACE_ANGLE_3D, ORBIT_TILT, ringPoints } from "@/lib/geometry";
import type { Artist } from "@/lib/types";

// 50° 기울인 궤도의 세로 폭 ≈ sin(50°)=0.77, 앞쪽이 원근으로 커지는 몫을 더해 0.9
const ORBIT_VERTICAL_SCALE = 0.9;
const FOCUS_SCALE = 1.35;
const HOVER_SCALE = 1.2;

function ArtistNode3D({ artist, focused }: { artist: Artist; focused: RefObject<string | null> }) {
  const router = useRouter();
  const group = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const r = RING_RADII[artist.orbit];
  const a = (artist.angle * Math.PI) / 180;
  const size = 0.32 * artist.size;
  const enter = () => router.push(`/artists/${artist.slug}`);

  useFrame(() => {
    const s = hovered ? HOVER_SCALE : focused.current === artist.slug ? FOCUS_SCALE : 1;
    group.current?.scale.setScalar(s);
  });

  return (
    <group ref={group} position={[Math.cos(a) * r, Math.sin(a) * r, 0]}>
      <mesh
        onClick={enter}
        onPointerOver={() => { setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
      >
        <sphereGeometry args={[size, 24, 24]} />
        <meshStandardMaterial color={artist.color} emissive={artist.color} emissiveIntensity={0.35} />
      </mesh>
      {/* 패널(z-40)보다 아래에 깔리도록 z-index 범위를 낮춘다 */}
      <Html center position={[0, -size - 0.3, 0]} zIndexRange={[20, 0]}>
        <button
          type="button"
          onClick={enter}
          className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] tracking-wide text-brand-soft hover:text-white focus-visible:outline-2 focus-visible:outline-brand-soft"
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
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 3, 5]} intensity={1.5} />
      <Orbits3D artists={artists} />
    </Scene3D>
  );
}
