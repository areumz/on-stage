import { describe, expect, it } from "vitest";
import { precheckImage, sceneErrorKo } from "./sceneApi";

describe("precheckImage", () => {
  it("5MB 이하 jpg·png·webp 는 통과", () => {
    expect(precheckImage({ type: "image/png", size: 5 * 1024 * 1024 })).toBeNull();
    expect(precheckImage({ type: "image/webp", size: 1 })).toBeNull();
  });
  it("크기·형식 문제를 한국어로 알린다", () => {
    expect(precheckImage({ type: "image/jpeg", size: 6.2 * 1024 * 1024 })).toBe("이미지는 5MB 이하여야 해요 (지금 6.2MB)");
    expect(precheckImage({ type: "image/gif", size: 10 })).toBe("jpg, png, webp만 올릴 수 있어요");
    expect(precheckImage({ type: "image/gif", size: 6 * 1024 * 1024 })).toContain(" · ");
  });
});

describe("sceneErrorKo", () => {
  it("코드별 문구, 모르는 코드는 기본 문구", () => {
    expect(sceneErrorKo({ code: "image_limit", status: 409 })).toContain("더 올릴 수 없어요");
    expect(sceneErrorKo({ code: "x", status: 404 })).toBe("연출을 찾을 수 없어요");
    expect(sceneErrorKo({ code: "zzz", status: 500 })).toContain("다시 시도");
  });
});
