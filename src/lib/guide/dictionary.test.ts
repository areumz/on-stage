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

describe("off_topic 안내 문구", () => {
  it("제목+본문이 합의된 문구와 같다", () => {
    expect(`${errorTitle("ko", "off_topic")} ${errorText("ko", "off_topic")}`).toBe(
      "이 질문은 제가 도와드리기 어려워요. 아티스트, 공연, 투어 일정에 관해 다시 물어봐 주세요. 예: '서울에서 곧 공연하는 팀은?'",
    );
    expect(`${errorTitle("en", "off_topic")} ${errorText("en", "off_topic")}`).toBe(
      "I can't help with that one. Try asking about artists, shows, or tour dates, e.g. 'Who's playing in Seoul soon?'",
    );
  });
});
