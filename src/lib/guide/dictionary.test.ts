// src/lib/guide/dictionary.test.ts
import { describe, it, expect } from "vitest";
import { DICT, chipText, errorText, errorTitle, toolStatusText } from "./dictionary";
import { ERROR_CODES } from "./events";

describe("dictionary", () => {
  it("모든 오류 코드와 network에 ko/en 문구가 있다", () => {
    for (const locale of ["ko", "en"] as const) {
      for (const code of [...ERROR_CODES, "network" as const]) {
        expect(errorText(locale, code).length, `${locale}:${code}`).toBeGreaterThan(0);
      }
    }
  });

  it("알려진 도구 키는 전용 문구, 모르는 키는 일반 문구", () => {
    expect(toolStatusText("ko", "tool.searchShows")).not.toBe(toolStatusText("ko", "tool.unknown"));
    expect(toolStatusText("en", "tool.unknown")).toBe(DICT.en.toolGeneric);
  });

  it("패널 문구(ask/sub/foot)가 ko/en 모두 있다", () => {
    for (const locale of ["ko", "en"] as const) {
      for (const k of ["ask", "sub", "foot"] as const) expect(DICT[locale][k].length, `${locale}:${k}`).toBeGreaterThan(0);
    }
  });

  it("오류 카드 제목과 칩 문구가 ko/en 모두 있다", () => {
    for (const locale of ["ko", "en"] as const) {
      for (const code of [...ERROR_CODES, "network" as const]) {
        expect(errorTitle(locale, code).length, `${locale}:${code}`).toBeGreaterThan(0);
      }
      for (const kind of ["focus", "navigating", "failed"] as const) {
        expect(chipText(locale, kind, "aurora").length).toBeGreaterThan(0);
      }
    }
    expect(chipText("ko", "navigating", "aurora")).toContain("AURORA");
  });
});
