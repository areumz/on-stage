import { describe, expect, it } from "vitest";
import { checkName, nameCount, nameLength, renameErrorKo } from "./rename";

describe("checkName", () => {
  it("공백을 정리하고, 비우면 기본 이름(null)으로 되돌린다", () => {
    expect(checkName("  내   공연  ")).toEqual({ ok: true, name: "내 공연" });
    expect(checkName("   ")).toEqual({ ok: true, name: null });
  });
  it("40자까지, 넘으면 한국어 안내", () => {
    expect(checkName("가".repeat(40)).ok).toBe(true);
    expect(checkName("가".repeat(41))).toEqual({ ok: false, message: "이름은 40자까지 쓸 수 있어요" });
  });
  it("글자 수는 코드포인트 기준(이모지 하나는 1)", () => {
    expect(nameLength("a😀")).toBe(2);
  });
});

describe("nameCount (정리한 뒤 길이 기준)", () => {
  it("공백이 많은 입력은 정리한 길이로 세고 저장 가능하면 over 가 아니다", () => {
    const raw = `${"가 ".repeat(10)}      나나`; // 원본 28자 → 정리 후 "가 가 … 가 나나" 22자
    expect(nameCount(raw)).toEqual({ over: false, count: 22 });
    expect(nameCount("   ")).toEqual({ over: false, count: 0 });
    expect(nameCount("가".repeat(40))).toEqual({ over: false, count: 40 });
  });
  it("41자 이상(정리 후)이면 over", () => {
    expect(nameCount("가".repeat(41))).toEqual({ over: true });
    expect(nameCount(`${"가".repeat(20)}${" ".repeat(10)}${"나".repeat(21)}`)).toEqual({ over: true }); // 정리 후 42자
  });
  it("원본이 40자를 넘어도 정리 후 40자 이하면 저장할 수 있다", () => {
    const raw = `${"가".repeat(20)}${" ".repeat(30)}${"나".repeat(19)}`; // 원본 69, 정리 후 40
    expect(nameCount(raw)).toEqual({ over: false, count: 40 });
    expect(checkName(raw).ok).toBe(true);
  });
});

describe("renameErrorKo", () => {
  it("코드별 문구", () => {
    expect(renameErrorKo({ code: "invalid_name", status: 400 })).toContain("40자");
    expect(renameErrorKo({ code: "connection_failed", status: 0 })).toContain("연결");
    expect(renameErrorKo({ code: "x", status: 404 })).toContain("찾을 수 없어요");
    expect(renameErrorKo({ code: "x", status: 500 })).toContain("다시 시도");
  });
});
