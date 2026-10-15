"use client";

import { useFrame } from "@react-three/fiber";
import { Line, Text } from "@react-three/drei";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type RefObject } from "react";
import type { Group } from "three";
import { FACE_ANGLE_2D, ringPoints } from "@/lib/geometry";
import Scene3D from "@/components/three/Scene3D";
import { FOV_DEG, OrbitCameraRig, RING_RADII, useOrbitSpin } from "@/components/three/orbitShared";
import type { Artist } from "@/lib/types";

const FOCUS_SCALE = 1.35;
const HOVER_SCALE = 1.2;

function ArtistNode({ artist, rotation, focused }: {
  artist: Artist; rotation: RefObject<number>; focused: RefObject<string | null>;
}) {
  const router = useRouter();
  const group = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const r = RING_RADII[artist.orbit];
  const a = (artist.angle * Math.PI) / 180;
  const size = 0.32 * artist.size;

  useFrame(() => {
    // 부모 회전을 상쇄해 노드(텍스트)는 항상 정립
    if (!group.current) return;
    group.current.rotation.z = -(rotation.current ?? 0);
    group.current.scale.setScalar(hovered ? HOVER_SCALE : focused.current === artist.slug ? FOCUS_SCALE : 1);
  });

  return (
    <group position={[Math.cos(a) * r, Math.sin(a) * r, 0]}>
      <group
        ref={group}
        onClick={() => router.push(`/artists/${artist.slug}`)}
        onPointerOver={() => { setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
      >
        <mesh>
          <circleGeometry args={[size, 48]} />
          <meshBasicMaterial color={artist.color} />
        </mesh>
        {/* drei의 anchorX, anchorY 기본값이지만, 명시적으로 지정 */}
        <Text position={[0, 0, 0.01]} fontSize={size * 0.55} color="#ffffff" anchorX="center" anchorY="middle">
          {artist.initials}
        </Text>
        <Text position={[0, -size - 0.22, 0.01]} fontSize={0.16} color={hovered ? "#ffffff" : "#c7b3f0"} anchorX="center" anchorY="middle">
          {artist.name}
        </Text>
      </group>
    </group>
  );
}

function Orbits({ artists }: { artists: Artist[] }) {
  const { groupRef, rotation, focused } = useOrbitSpin(artists, FACE_ANGLE_2D);
  const rings = useMemo(() => RING_RADII.map(ringPoints), []);

  return (
    <group ref={groupRef}>
      {rings.map((pts, i) => (
        <Line key={i} points={pts} color="#3a2f5e" lineWidth={1} />
      ))}
      {artists.map((a) => (
        <ArtistNode key={a.slug} artist={a} rotation={rotation} focused={focused} />
      ))}
    </group>
  );
}

export default function OrbitScene({ artists }: { artists: Artist[] }) {
  return (
    <Scene3D camera={{ position: [0, 0, 8], fov: FOV_DEG }}>
      <OrbitCameraRig />
      <Orbits artists={artists} />
    </Scene3D>
  );
}
