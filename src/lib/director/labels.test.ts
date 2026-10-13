import { describe, expect, it } from "vitest";
import { labelKo } from "./labels";

describe("labelKo", () => {
  it("자동 라벨 네 개는 한글로", () => {
    expect([labelKo("intro"), labelKo("verse"), labelKo("chorus"), labelKo("outro")]).toEqual(["인트로", "버스", "코러스", "아웃트로"]);
  });

  it("사람이 붙인 라벨과 모르는 값은 그대로", () => {
    expect(labelKo("bridge")).toBe("bridge");
    expect(labelKo("드롭")).toBe("드롭");
  });

  it("raw 면 자동 라벨도 적힌 그대로(데모 곡의 직접 붙인 이름)", () => {
    expect([labelKo("chorus", true), labelKo("intro", true), labelKo("verse1", true)]).toEqual(["chorus", "intro", "verse1"]);
  });

  // 프로토타입 키가 라벨로 들어와도 표에서 찾지 않는다
  it("프로토타입 키는 그대로", () => {
    expect(labelKo("toString")).toBe("toString");
  });
});
