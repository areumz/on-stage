"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragment = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float d = length(p * vec2(1.4, 1.0));
  float glow = smoothstep(0.75, 0.0, d);
  float wave = 0.5 + 0.5 * sin(p.x * 9.0 + uTime * 0.5) * sin(p.y * 7.0 - uTime * 0.35);
  vec3 base = vec3(0.055, 0.039, 0.122); // #0E0A1F
  vec3 col = base + uColor * glow * (0.10 + 0.10 * wave);
  gl_FragColor = vec4(col, 1.0);
}`;

function GlowPlane({ color }: { color: string }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { viewport } = useThree();
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } }),
    [color]
  );

  useFrame((_, delta) => {
    if (mat.current) mat.current.uniforms.uTime.value += delta;
  });

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry />
      <shaderMaterial ref={mat} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} />
    </mesh>
  );
}

export default function HeroBackground({ color }: { color: string }) {
  return (
    <Canvas className="absolute inset-0" camera={{ position: [0, 0, 1] }}>
      <GlowPlane color={color} />
    </Canvas>
  );
}
