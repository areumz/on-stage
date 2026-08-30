// 원형 궤도 라인 좌표 — OrbitScene, TourOrbit이 공유함.
export function ringPoints(r: number): [number, number, number][] {
  return Array.from({ length: 65 }, (_, i) => {
    const t = (i / 64) * Math.PI * 2;
    return [Math.cos(t) * r, Math.sin(t) * r, 0];
  });
}

// 컨테이너 가로세로비(aspect)에서, 반경 targetRadius인 원이 수직·수평 양쪽 프레임에
// 항상 들어오는 카메라 거리(z)를 계산
// 수직 FOV가 고정이므로 거리 z에서 보이는 수직 반높이는 z*tan(fov/2), 수평 반너비는
// 그 값에 aspect를 곱한 것. aspect >= 1(가로로 넓은 화면)에서는 수평 방향이 이미 여유가
// 있으니 min(1, aspect)로 클램프해 더 당기지 않는다.
export function cameraDistanceForRadius(targetRadius: number, fovDeg: number, aspect: number): number {
  const halfFovRad = (fovDeg / 2) * (Math.PI / 180);
  return targetRadius / (Math.tan(halfFovRad) * Math.min(1, aspect));
}
