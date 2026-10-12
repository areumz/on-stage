import { describe, expect, it } from "vitest";
import { checkName, nameLength, renameErrorKo } from "./rename";

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

describe("renameErrorKo", () => {
  it("코드별 문구", () => {
    expect(renameErrorKo({ code: "invalid_name", status: 400 })).toContain("40자");
    expect(renameErrorKo({ code: "connection_failed", status: 0 })).toContain("연결");
    expect(renameErrorKo({ code: "x", status: 404 })).toContain("찾을 수 없어요");
    expect(renameErrorKo({ code: "x", status: 500 })).toContain("다시 시도");
  });
});
