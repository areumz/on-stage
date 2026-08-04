// 원형 궤도 라인 좌표 — OrbitScene, TourOrbit이 공유함.
export function ringPoints(r: number): [number, number, number][] {
  return Array.from({ length: 65 }, (_, i) => {
    const t = (i / 64) * Math.PI * 2;
    return [Math.cos(t) * r, Math.sin(t) * r, 0];
  });
}
