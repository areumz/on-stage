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

// 궤도 묶음의 X축 기울기(rad, 약 -50°). 음수라 -y쪽(화면 아래)이 카메라에 가까워진다.
export const ORBIT_TILT = -(50 * Math.PI) / 180;
// 포커스된 노드가 놓일 "정면" 각도: 3D(기울임)는 화면 아래 -π/2, 2D 폴백은 위쪽 π/2.
export const FACE_ANGLE_3D = -Math.PI / 2;
export const FACE_ANGLE_2D = Math.PI / 2;

// from → to의 가장 짧은 각도 차. 결과 범위 (-π, π].
export function shortestAngleDelta(from: number, to: number): number {
  const TAU = Math.PI * 2;
  const d = (((to - from) % TAU) + TAU) % TAU;
  return d > Math.PI ? d - TAU : d;
}

// 노드의 최종 각도(nodeAngle + 회전값)가 faceAngle이 되는 회전값 중 current에서 가장 가까운 것.
export function focusRotationTarget(current: number, nodeAngle: number, faceAngle: number): number {
  return current + shortestAngleDelta(current, faceAngle - nodeAngle);
}

// 타원(가로 반경 rx, 세로 반경 ry)이 수직·수평 양쪽 프레임에 들어오는 카메라 거리.
// 궤도를 기울이면 세로 폭만 줄어 같은 프레임에서 더 크게(가까이) 그릴 수 있다. ry === rx 이면
// cameraDistanceForRadius 와 같은 값이다.
export function cameraDistanceForEllipse(rx: number, ry: number, fovDeg: number, aspect: number): number {
  const tanHalf = Math.tan((fovDeg / 2) * (Math.PI / 180));
  return Math.max(ry / tanHalf, rx / (tanHalf * aspect));
}
