import { describe, it, expect } from "vitest";
import { cameraDistanceForRadius, shortestAngleDelta, focusRotationTarget, FACE_ANGLE_3D, FACE_ANGLE_2D } from "./geometry";

// OrbitScene 실사용값: 바깥 궤도 반경(3.2) * 여유 배율(1.2) — 노드 반지름·라벨이 궤도보다
// 살짝 더 뻗어나가는 부분까지 프레임에 담기 위한 실효 반경. 배율 자체는 호출부(OrbitScene)
// 책임이라 이 함수는 최종 반경만 받는다.
const EFFECTIVE_RADIUS = 3.2 * 1.2;
const FOV_DEG = 50;

describe("cameraDistanceForRadius", () => {
  it("aspect=1일 때 기존 하드코딩 카메라 거리(z=8)와 거의 같다", () => {
    const z = cameraDistanceForRadius(EFFECTIVE_RADIUS, FOV_DEG, 1);
    expect(Math.abs(z - 8)).toBeLessThan(0.5);
  });

  it("좁은 화면(aspect=0.55)에서도 수평 반너비가 targetRadius 이상이 되게 카메라를 당긴다", () => {
    const aspect = 0.55;
    const z = cameraDistanceForRadius(EFFECTIVE_RADIUS, FOV_DEG, aspect);
    const halfHeight = z * Math.tan((FOV_DEG / 2) * (Math.PI / 180));
    const halfWidth = halfHeight * aspect;
    expect(halfWidth).toBeGreaterThanOrEqual(EFFECTIVE_RADIUS - 1e-6);
  });

  // 가로로 넓어질수록(aspect > 1) 수평 방향은 이미 여유가 있으니 더 당길 필요 없다 — min(1, aspect) 클램프
  it("aspect가 1보다 큰 와이드 화면에서는 aspect=1일 때와 정확히 같은 z를 쓴다", () => {
    const zSquare = cameraDistanceForRadius(EFFECTIVE_RADIUS, FOV_DEG, 1);
    const zWide = cameraDistanceForRadius(EFFECTIVE_RADIUS, FOV_DEG, 1.78);
    expect(zWide).toBe(zSquare);
  });
});

const TAU = Math.PI * 2;
const norm = (a: number) => ((a % TAU) + TAU) % TAU;
// 2π 경계 근처 비교용: 각도 차이를 (-π, π]로 접어 절댓값을 본다
const angDiff = (a: number, b: number) => Math.abs(shortestAngleDelta(a, b));

describe("shortestAngleDelta", () => {
  it("같은 각도면 0", () => {
    expect(shortestAngleDelta(1.2, 1.2)).toBe(0);
  });
  it("2π 경계를 넘어 짧은 쪽으로 돈다", () => {
    expect(shortestAngleDelta(0.1, TAU - 0.1)).toBeCloseTo(-0.2, 9);
    expect(shortestAngleDelta(TAU - 0.1, 0.1)).toBeCloseTo(0.2, 9);
  });
  it("결과는 (-π, π] 범위", () => {
    expect(shortestAngleDelta(0, Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(shortestAngleDelta(0, -Math.PI)).toBeCloseTo(Math.PI, 9);
  });
});

describe("focusRotationTarget", () => {
  const cases: [number, number, number][] = [
    [0, 1, FACE_ANGLE_3D],
    [20, 2.5, FACE_ANGLE_3D],
    [-13, 5.9, FACE_ANGLE_2D],
    [7, 0, FACE_ANGLE_2D],
  ];
  it.each(cases)("current=%d nodeAngle=%d: 노드가 faceAngle에 오고 반 바퀴 이내", (current, nodeAngle, face) => {
    const t = focusRotationTarget(current, nodeAngle, face);
    expect(norm(nodeAngle + t)).toBeCloseTo(norm(face), 9);
    expect(angDiff(t, current)).toBeLessThanOrEqual(Math.PI + 1e-9);
    expect(Math.abs(t - current)).toBeLessThanOrEqual(Math.PI + 1e-9);
  });
});
