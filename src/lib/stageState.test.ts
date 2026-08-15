import { describe, it, expect } from "vitest";
import { defaultStageState, mergeStageState, parseStageState } from "./stageState";

const fallback = defaultStageState("#9F77DD");

describe("defaultStageState", () => {
  it("starts with left+center on, right off, front camera, smoke off", () => {
    expect(defaultStageState("#D4537E")).toEqual({
      color: "#D4537E",
      spots: {
        left: { on: true, intensity: 300, angle: 0.45, penumbra: 0.6 },
        center: { on: true, intensity: 300, angle: 0.45, penumbra: 0.6 },
        right: { on: false, intensity: 300, angle: 0.45, penumbra: 0.6 },
      },
      camera: "front",
      smoke: { density: 0, color: "#ffffff" },
    });
  });
});

describe("parseStageState", () => {
  // 저장값 자체가 없는 최초 방문 케이스
  it("returns fallback when raw is null", () => {
    expect(parseStageState(null, fallback)).toBe(fallback);
  });

  // localStorage 값이 깨진 JSON일 수 있다(수동 편집, 저장 중 중단 등)
  it("falls back on malformed JSON", () => {
    expect(parseStageState("{not valid json", fallback)).toBe(fallback);
  });

  // 온전한 v2 저장값은 그대로 복원돼야 한다
  it("restores a fully valid saved state as-is", () => {
    const saved = defaultStageState("#378ADD");
    saved.camera = "audience";
    saved.spots.right.on = true;
    expect(parseStageState(JSON.stringify(saved), fallback)).toEqual(saved);
  });
});

describe("mergeStageState", () => {
  // 1차(구버전) 저장값: spots가 boolean, 카메라 키가 angle. color만 유지되고 나머지는 기본값으로
  // 리셋되는 게 합의된 동작이다(design-v2.md §5.1) — boolean→on 변환 전용 로직은 만들지 않는다
  it("keeps color but resets spots/camera for a 1차 saved value (boolean spots, angle key)", () => {
    const legacy = {
      color: "#378ADD",
      spots: { left: true, center: true, right: false },
      angle: "audience",
    };
    expect(mergeStageState(legacy, fallback)).toEqual({
      color: "#378ADD",
      spots: fallback.spots,
      camera: fallback.camera,
      smoke: fallback.smoke,
    });
  });

  // smoke가 추가되기 전(v2 초기)에 저장된 값 — smoke만 기본값이고 나머지 필드는 그대로 유지된다
  it("keeps existing fields and defaults only smoke when smoke is missing", () => {
    const preSmoke = {
      color: "#111111",
      spots: {
        left: { on: false, intensity: 500, angle: 0.7, penumbra: 0.2 },
        center: { on: true, intensity: 200, angle: 0.3, penumbra: 0.9 },
        right: { on: true, intensity: 100, angle: 0.2, penumbra: 0.1 },
      },
      camera: "top",
    };
    expect(mergeStageState(preSmoke, fallback)).toEqual({
      ...preSmoke,
      smoke: fallback.smoke,
    });
  });

  // spots.left에 on만 저장돼 있고 나머지 3개 필드가 없는 경우 — on은 유지, 나머지만 기본값
  it("keeps a spot's present field and defaults only the missing ones", () => {
    const partial = {
      color: fallback.color,
      spots: { left: { on: false }, center: fallback.spots.center, right: fallback.spots.right },
      camera: fallback.camera,
      smoke: fallback.smoke,
    };
    expect(mergeStageState(partial, fallback)).toEqual({
      ...fallback,
      spots: { ...fallback.spots, left: { ...fallback.spots.left, on: false } },
    });
  });

  // camera가 열거값 밖의 문자열이면 기본값으로 — 나머지 필드는 그대로 유지
  it("falls back to default camera when the saved value isn't a known preset", () => {
    const bad = { ...fallback, camera: "diagonal" };
    expect(mergeStageState(bad, fallback)).toEqual({ ...fallback, camera: fallback.camera });
  });

  // null·문자열은 typeof 가드에서 바로 fallback을 참조 그대로 반환한다
  it("returns fallback when value is null or not an object", () => {
    expect(mergeStageState(null, fallback)).toBe(fallback);
    expect(mergeStageState("nope", fallback)).toBe(fallback);
  });

  // 배열은 typeof로는 object라 필드별 병합 경로를 타지만, 인식되는 필드가 없어 전부 기본값으로
  // 채워진다 — 값은 fallback과 같지만 참조는 새로 만들어진 객체다
  it("falls back field-by-field (new object, same values) when value is an array", () => {
    expect(mergeStageState([1, 2, 3], fallback)).toEqual(fallback);
  });
});
