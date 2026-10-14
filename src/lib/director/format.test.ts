import { describe, expect, it } from "vitest";
import { cleanSequenceName, sequenceName } from "./format";

describe("sequenceName", () => {
  it("이름이 없으면 곡 제목 · 한국 날짜와 시간", () => {
    expect(sequenceName("burn it up", "2026-10-08T03:05:00Z")).toBe("burn it up · 10월 8일 12:05");
  });
  it("UTC 로는 전날이어도 한국 날짜로 보인다", () => {
    expect(sequenceName("burn it up", "2026-10-07T20:00:00Z")).toBe("burn it up · 10월 8일 05:00");
  });
  it("같은 날 다른 시간이면 이름이 다르다", () => {
    expect(sequenceName("곡", "2026-10-08T03:00:00Z")).not.toBe(sequenceName("곡", "2026-10-08T05:30:00Z"));
  });
  it("사용자가 붙인 이름이 있으면 그대로(앞뒤 공백 제거)", () => {
    expect(sequenceName("곡", "2026-10-08T03:00:00Z", "  코러스 밝은 버전 ")).toBe("코러스 밝은 버전");
    expect(sequenceName("곡", "2026-10-08T03:00:00Z", "   ")).toBe("곡 · 10월 8일 12:00");
    expect(sequenceName("곡", "2026-10-08T03:00:00Z", null)).toBe("곡 · 10월 8일 12:00");
  });
});

describe("cleanSequenceName", () => {
  it("공백만이거나 null 이면 null(기본 이름), 문자열이 아니면 거부", () => {
    expect(cleanSequenceName(null)).toBeNull();
    expect(cleanSequenceName("   ")).toBeNull();
    expect(cleanSequenceName(5)).toBeUndefined();
    expect(cleanSequenceName(undefined)).toBeUndefined();
  });
  it("제로폭·방향 제어 문자만 있는 이름은 비어 있는 것으로 본다", () => {
    expect(cleanSequenceName("\u200b\u202e")).toBeNull();
    expect(cleanSequenceName("a\u200bb")).toBe("ab");
  });
  it("제어 문자·연속 공백 정리, 40자 초과는 거부", () => {
    expect(cleanSequenceName("a\u0000b\n  c")).toBe("a b c");
    expect(cleanSequenceName("가".repeat(40))).toBe("가".repeat(40));
    expect(cleanSequenceName("가".repeat(41))).toBeUndefined();
  });
});
