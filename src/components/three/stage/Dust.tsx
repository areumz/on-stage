"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { setOpacity } from "@/components/three/stage/Backdrop";
import { BufferAttribute, BufferGeometry, PointsMaterial } from "three";

const MAX = 300;
const setRange = (g: BufferGeometry, n: number) => g.setDrawRange(0, n);
const frac = (n: number) => n - Math.floor(n);

// dust 0 이면 씬 그래프에 아예 안 올림(Smoke 와 같은 패턴). 입자 300개를 한 번만 만들고
// dust 값은 drawRange(몇 개를 그릴지)와 투명도로만 반영 — 값이 바뀌어도 버퍼 재생성 없음.
function DustPoints({ dust }: { dust: number }) {
  const { geo, base } = useMemo(() => {
    // 렌더 순수성을 위해 Math.random 대신 고정 해시로 흩뿌림
    const base = new Float32Array(MAX * 3);
    for (let i = 0; i < MAX; i++) {
      base[i * 3] = (frac(Math.sin(i * 12.9898) * 43758.5453) - 0.5) * 14;
      base[i * 3 + 1] = 0.3 + frac(Math.sin(i * 78.233) * 12345.678) * 6;
      base[i * 3 + 2] = -2 + frac(Math.sin(i * 39.346) * 9876.543) * 8;
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(base.slice(), 3));
    return { geo, base };
  }, []);
  const mat = useMemo(() => new PointsMaterial({ color: "#e8defa", size: 0.06, transparent: true, depthWrite: false, fog: false }), []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );

  const ratio = useRef(dust / 100);
  useFrame(({ clock }, dt) => {
    ratio.current += (dust / 100 - ratio.current) * Math.min(1, dt * 3);
    setRange(geo, Math.max(1, Math.round(ratio.current * MAX)));
    setOpacity(mat, 0.2 + ratio.current * 0.5);
    const t = clock.elapsedTime * 0.15;
    const pos = geo.getAttribute("position") as BufferAttribute;
    for (let i = 0; i < MAX; i++) {
      pos.setXYZ(i, base[i * 3] + Math.sin(t + i) * 0.4, base[i * 3 + 1] + Math.sin(t * 1.3 + i * 1.7) * 0.3, base[i * 3 + 2] + Math.cos(t + i * 0.6) * 0.4);
    }
    pos.needsUpdate = true;
  });

  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

// dust 0 이면 훅·geometry·useFrame 이 아예 없게 바깥 래퍼에서 막음
export default function Dust({ dust }: { dust: number }) {
  if (dust <= 0) return null;
  return <DustPoints dust={dust} />;
}
