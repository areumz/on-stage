"use client";

import { Canvas } from "@react-three/fiber";
import { Line, Text } from "@react-three/drei";
import { useMemo, useState } from "react";
import type { Artist, City } from "@/lib/types";

function ringPoints(r: number): [number, number, number][] {
  return Array.from({ length: 65 }, (_, i) => {
    const t = (i / 64) * Math.PI * 2;
    return [Math.cos(t) * r, Math.sin(t) * r, 0];
  });
}

function CityNode({ city, color, index, count, theta, onSelect }: {
  city: City; color: string; index: number; count: number; theta: number; onSelect: (c: City) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const a = (index / count) * Math.PI * 2 + 0.6;
  const r = index % 2 === 0 ? 2.1 : 1.5; // 안/밖 궤도 교차 배치
  return (
    // 부모 그룹 회전(theta)을 상쇄해 라벨은 항상 정립 (OrbitScene 패턴의 선언형 버전)
    <group position={[Math.cos(a) * r, Math.sin(a) * r, 0]} rotation={[0, 0, -theta]} scale={hovered ? 1.2 : 1}>
      <mesh
        onClick={() => onSelect(city)}
        onPointerOver={() => { setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
      >
        <circleGeometry args={[0.34, 48]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Text position={[0, 0, 0.01]} fontSize={0.15} color="#ffffff" anchorX="center" anchorY="middle">
        {city.code}
      </Text>
    </group>
  );
}

export default function TourOrbit({ artist, progress, onSelect }: {
  artist: Artist; progress: number; onSelect: (c: City) => void;
}) {
  const rings = useMemo(() => [1.5, 2.1].map(ringPoints), []);
  const theta = progress * Math.PI * 1.5;
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
      <group rotation={[0, 0, theta]}>
        {rings.map((pts, i) => (
          <Line key={i} points={pts} color="#3a2f5e" lineWidth={1} />
        ))}
        {artist.cities.map((c, i) => (
          <CityNode key={c.code} city={c} color={artist.color} index={i} count={artist.cities.length} theta={theta} onSelect={onSelect} />
        ))}
      </group>
      {/* 중심 연도는 회전 그룹 밖 — 항상 정립 */}
      <Text position={[0, 0, 0.01]} fontSize={0.42} color="#ffffff" anchorX="center" anchorY="middle">
        {String(artist.tour.year)}
      </Text>
    </Canvas>
  );
}
