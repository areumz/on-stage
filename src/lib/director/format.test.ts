import { describe, expect, it } from "vitest";
import { sequenceName } from "./format";

describe("sequenceName", () => {
  it("곡 제목 · 월 일", () => {
    expect(sequenceName("burn it up", "2026-10-08T03:00:00Z")).toBe("burn it up · 10월 8일");
  });

  // UTC 로는 아직 전날이어도 한국에서는 다음 날이다
  it("한국 시간 기준 날짜", () => {
    expect(sequenceName("burn it up", "2026-10-07T20:00:00Z")).toBe("burn it up · 10월 8일");
  });
});
