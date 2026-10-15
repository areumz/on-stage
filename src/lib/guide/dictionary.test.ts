// src/lib/guide/dictionary.test.ts
import { describe, it, expect } from "vitest";
import { DICT, errorText, toolStatusText } from "./dictionary";
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
});
