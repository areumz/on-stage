import { describe, expect, it } from "vitest";
import { barPercent, cameraLabel, groupIssues, issueSectionCount, timeRange } from "./review";

const iss = (idx: number | null) => ({ rule: "clamped", message: "m", idx });

describe("review helpers", () => {
  it("경고를 구간별/곡 전체로 묶는다", () => {
    const g = groupIssues([iss(1), iss(1), iss(null), iss(9)], 3);
    expect(g.bySection.map((l) => l.length)).toEqual([0, 2, 0]);
    expect(g.whole.length).toBe(2);
  });
  it("이슈 있는 구간 수는 서로 다른 구간만 센다", () => {
    expect(issueSectionCount([iss(0), iss(0), iss(2), iss(null)], 3)).toBe(2);
    expect(issueSectionCount([], 3)).toBe(0);
  });
  it("막대 %", () => {
    expect(barPercent({ on: true, intensity: 850 })).toBe(85);
    expect(barPercent({ on: false, intensity: 850 })).toBe(0);
    expect(barPercent({ on: true, intensity: 5000 })).toBe(100);
  });
  it("카메라 라벨과 시간 범위", () => {
    expect(cameraLabel("audience")).toBe("객석 (audience)");
    expect(timeRange(0, 12)).toBe("0:00–0:12");
    expect(timeRange(77, 100.9)).toBe("1:17–1:40");
  });
});
