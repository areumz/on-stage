"use client";

// R3F 방향 프로토타입: 사진은 그대로 두고 뒤에 무대 조명 먼지(헤이즈)만 깐다.
// 셰이더로 사진을 왜곡하지 않으므로 이미지가 뭉개지지 않는다.

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const COUNT = 220;
const SPAN_X = 16;
const SPAN_Y = 12;

const vertex = /* glsl */ `
attribute float aSize;
varying float vFade;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * (12.0 / -mv.z);
  // 위로 갈수록 옅어져 조명 먼지처럼 사라진다
  vFade = 1.0 - abs(position.y) / ${(SPAN_Y / 2).toFixed(1)};
}`;

const fragment = /* glsl */ `
uniform vec3 uColor;
varying float vFade;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vFade * 0.55;
  gl_FragColor = vec4(uColor, a);
}`;

// 렌더 중 Math.random()은 순수하지 않아(하이드레이션 불일치) 결정적 해시를 쓴다
function rand(i: number): number {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function Motes({ color }: { color: string }) {
  const points = useRef<THREE.Points>(null);
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(color) } }), [color]);

  const { positions, sizes } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (rand(i * 4) - 0.5) * SPAN_X;
      positions[i * 3 + 1] = (rand(i * 4 + 1) - 0.5) * SPAN_Y;
      positions[i * 3 + 2] = (rand(i * 4 + 2) - 0.5) * 5;
      sizes[i] = 1 + rand(i * 4 + 3) * 3;
    }
    return { positions, sizes };
  }, []);

  useFrame((_, dt) => {
    const attr = points.current?.geometry.attributes.position as THREE.BufferAttribute | undefined;
    if (!attr) return;
    for (let i = 0; i < COUNT; i++) {
      const y = attr.getY(i) + dt * 0.22;
      attr.setY(i, y > SPAN_Y / 2 ? -SPAN_Y / 2 : y);
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function GalleryHaze({ color }: { color: string }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <Canvas camera={{ position: [0, 0, 9], fov: 50 }}>
        <Motes color={color} />
      </Canvas>
    </div>
  );
}
