import { describe, expect, it } from "vitest";
import { MAX_BYTES } from "./limits";
import { canonicalContentType, durationProblem, fileProblem, formatBytes, formatDuration } from "./validate";

describe("fileProblem", () => {
  it("정확히 30MiB 는 통과, 1바이트 초과는 거절", () => {
    expect(fileProblem({ name: "a.mp3", size: MAX_BYTES })).toBeNull();
    expect(fileProblem({ name: "a.mp3", size: MAX_BYTES + 1 })).toBe("too_large");
  });
  it("형식은 확장자 기준, 대소문자 무시", () => {
    expect(fileProblem({ name: "A.FLAC", size: 1 })).toBeNull();
    expect(fileProblem({ name: "a.m4a", size: 1 })).toBe("unsupported_type");
    expect(fileProblem({ name: "noext", size: 1 })).toBe("unsupported_type");
    expect(fileProblem({ name: "a.", size: 1 })).toBe("unsupported_type");
  });
  it("형식 오류가 크기 오류보다 먼저", () => {
    expect(fileProblem({ name: "a.m4a", size: MAX_BYTES + 1 })).toBe("unsupported_type");
  });
});

describe("durationProblem", () => {
  it("301 통과, 301.01 거절", () => {
    expect(durationProblem(301)).toBeNull();
    expect(durationProblem(301.01)).toBe("too_long");
  });
  it("읽지 못한 값", () => {
    for (const v of [NaN, 0, -1, Infinity]) expect(durationProblem(v)).toBe("unreadable");
  });
});

describe("canonicalContentType", () => {
  it("확장자로 정한다", () => {
    expect(canonicalContentType("Song.WAV")).toBe("audio/wav");
    expect(canonicalContentType("a.b.c.ogg")).toBe("audio/ogg");
    expect(canonicalContentType("x.mp3")).toBe("audio/mpeg");
    expect(canonicalContentType("x.flac")).toBe("audio/flac");
    expect(canonicalContentType("mp3")).toBeNull();
    expect(canonicalContentType("a.txt")).toBeNull();
  });
});

describe("format", () => {
  it("formatBytes", () => {
    expect(formatBytes(4.2 * 1024 * 1024)).toBe("4.2MB");
    expect(formatBytes(MAX_BYTES)).toBe("30.0MB");
  });
  it("formatDuration", () => {
    expect(formatDuration(100)).toBe("1:40");
    expect(formatDuration(372)).toBe("6:12");
    expect(formatDuration(5)).toBe("0:05");
  });
});
