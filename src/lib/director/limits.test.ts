import { describe, expect, it } from "vitest";
import { dailyRunLimit } from "./limits";

describe("dailyRunLimit", () => {
  it("값이 없거나 비어 있으면 기본 5", () => {
    expect(dailyRunLimit(undefined)).toBe(5);
    expect(dailyRunLimit("")).toBe(5);
    expect(dailyRunLimit("   ")).toBe(5);
  });

  it("정수면 그 값을 쓴다", () => {
    expect(dailyRunLimit("7")).toBe(7);
    expect(dailyRunLimit(" 3 ")).toBe(3);
  });

  // 0 을 기본값으로 덮어쓰면 "오늘은 막는다"는 설정을 못 한다
  it("0 은 그대로 0", () => {
    expect(dailyRunLimit("0")).toBe(0);
  });

  it("음수·소수·문자는 기본값으로 돌아간다", () => {
    expect(dailyRunLimit("-1")).toBe(5);
    expect(dailyRunLimit("1.5")).toBe(5);
    expect(dailyRunLimit("abc")).toBe(5);
  });
});
