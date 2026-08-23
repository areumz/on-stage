"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import Scene3D from "@/components/three/Scene3D";
import type { Artist, ShaderPattern } from "@/lib/types";

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragment = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uFreq;
uniform float uFalloff;
uniform float uSpeed;
uniform int uPattern; // 0=wave, 1=ripple, 2=grain
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float d = length(p * vec2(1.4, 1.0));

  // intensity: uColor에 곱할 최종 진폭. wave(기존)는 0.10~0.20 폭을 그대로 둬서 회귀 보존.
  // ripple/grain은 원래 없던 패턴이라 회귀 제약이 없고, 이 폭이 좁으면
  // 패턴 구조(링·알갱이)가 다 눌려 육안으로 안 보이므로 훨씬 넓게 잡는다.
  float intensity;
  if (uPattern == 0) {
    // wave(기존) — 격자형 간섭무늬. 기존 9.0/7.0 비율을 uFreq*(7.0/9.0)로 유지 —
    // freq=9(기본값)일 때 정확히 7.0이 나와 회귀가 없다(0.78 같은 소수 근사는 9*0.78=7.02로 어긋남)
    float wave = 0.5 + 0.5 * sin(p.x * uFreq + uTime * uSpeed) * sin(p.y * uFreq * (7.0 / 9.0) - uTime * uSpeed * 0.7);
    intensity = 0.10 + 0.10 * wave;
  } else if (uPattern == 1) {
    // ripple(신규) — 중심에서 퍼지는 동심원. glow용 d를 재사용해 추가 연산이 거의 없다.
    // 배율 6.0 — falloff 반경 안에 링을 여러 개(freq=7 기준 약 4~5개) 채워야 링 여러 개가 반복되는 것이 눈에 띈다.
    // 배율이 낮으면(예: 2.0) 링이 1~2개뿐이라 그냥 더 밝은 덩어리로 보이고 무늬로 안 읽힌다(실측으로 확인)
    float ripple = 0.5 + 0.5 * sin(d * uFreq * 6.0 - uTime * uSpeed * 2.0);
    intensity = 0.05 + 0.35 * ripple;
  } else {
    // grain(신규) — 의사난수 기반 알갱이 질감. 부드러운 파동이 아니라 거친 텍스처
    // 대비를 셋 중 가장 크게 잡는다
    float grain = fract(sin(dot(p * uFreq, vec2(12.9898, 78.233)) + uTime * uSpeed) * 43758.5453);
    intensity = 0.40 * grain;
  }

  // falloff=0을 폼·서버 둘 다 허용하는데, edge0(uFalloff)==edge1(0.0)이면 smoothstep이
  // 0으로 나누는 정의되지 않은 연산이 돼 화면이 깨진다 — 최솟값으로 살짝 띄워 방지
  float glow = smoothstep(max(uFalloff, 0.001), 0.0, d);
  vec3 base = vec3(0.055, 0.039, 0.122); // #0E0A1F
  vec3 col = base + uColor * glow * intensity;
  gl_FragColor = vec4(col, 1.0);
}`;

const PATTERN_INDEX: Record<ShaderPattern, number> = { wave: 0, ripple: 1, grain: 2 };

// types.ts의 Artist.shader와 모양이 어긋나지 않도록 별도로 다시 선언하지 않고 그대로 재사용
type ShaderParams = Artist["shader"];

function GlowPlane({ color, shader }: { color: string; shader: ShaderParams }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { viewport } = useThree();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uFreq: { value: shader.freq },
      uFalloff: { value: shader.falloff },
      uSpeed: { value: shader.speed },
      // PATTERN_INDEX에 없는 값(DB 컬럼엔 CHECK 제약이 없어 이론상 가능)이 들어와도 undefined를
      // uniform int에 넘기지 않도록 wave(0)로 기본 처리
      uPattern: { value: PATTERN_INDEX[shader.pattern] ?? 0 },
    }),
    [color, shader.pattern, shader.freq, shader.falloff, shader.speed]
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

export default function HeroBackground({ color, shader }: { color: string; shader: ShaderParams }) {
  return (
    <Scene3D className="absolute inset-0" camera={{ position: [0, 0, 1] }}>
      <GlowPlane color={color} shader={shader} />
    </Scene3D>
  );
}
