import { describe, expect, it } from "vitest";
import { cooldownLabel, remainingSeconds } from "./cooldown";

describe("cooldown", () => {
  it("시각 차로 남은 초를 계산한다", () => {
    expect(remainingSeconds(45, 1000, 1000)).toBe(45);
    expect(remainingSeconds(45, 1000, 1999)).toBe(45);
    expect(remainingSeconds(45, 1000, 2000)).toBe(44);
    expect(remainingSeconds(45, 1000, 1000 + 44_000)).toBe(1);
  });
  it("0 아래로 내려가지 않는다", () => {
    expect(remainingSeconds(45, 0, 99_000)).toBe(0);
  });
  it("시작 시각이 now 보다 미래여도 total 을 넘지 않는다", () => {
    expect(remainingSeconds(45, 5000, 1000)).toBe(45);
  });
  it("쿨다운이 없으면 0", () => {
    expect(remainingSeconds(undefined, 0, 0)).toBe(0);
  });
  it("라벨", () => {
    expect(cooldownLabel("다시 시도", 45)).toBe("다시 시도 (45초 후)");
    expect(cooldownLabel("다시 시도", 0)).toBe("다시 시도");
  });
});
