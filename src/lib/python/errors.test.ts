import { describe, it, expect } from "vitest";
import { ERROR_COPY, errorCopyFor, errorKeyFor, type ErrorKey } from "./errors";

describe("ERROR_COPY", () => {
  it("모든 항목에 헤드라인·본문·주 버튼이 있다", () => {
    for (const [key, copy] of Object.entries(ERROR_COPY)) {
      expect(copy.headline, key).not.toBe("");
      expect(copy.sub, key).not.toBe("");
      expect(copy.primary.label, key).not.toBe("");
    }
  });

  // 다시 시도 연타를 막는 쿨다운은 quota 오류에만 둔다
  it("쿨다운은 llm_quota_exceeded 에만 있다", () => {
    const withCooldown = (Object.keys(ERROR_COPY) as ErrorKey[]).filter((k) => ERROR_COPY[k].primary.cooldownSec);
    expect(withCooldown).toEqual(["llm_quota_exceeded"]);
  });

  // 재시도해도 같은 결과인 오류에 "다시 시도"를 달면 사용자가 헛수고를 한다
  it("재시도해도 같은 오류는 주 버튼이 곡 다시 고르기다", () => {
    expect(ERROR_COPY.decode_failed.primary.action).toBe("pickSong");
    expect(ERROR_COPY.too_long.primary.action).toBe("pickSong");
  });
});

describe("errorKeyFor", () => {
  it("아는 코드는 그대로 돌려준다", () => {
    expect(errorKeyFor("llm_quota_exceeded")).toBe("llm_quota_exceeded");
    expect(errorKeyFor("draft_exists")).toBe("draft_exists");
  });

  it("모르는 코드·빈 값은 일반 오류 문구로 보낸다", () => {
    expect(errorKeyFor("something_new")).toBe("internal_error");
    expect(errorKeyFor(null)).toBe("internal_error");
    expect(errorKeyFor(undefined)).toBe("internal_error");
  });

  // 객체 프로토타입 키(toString 등)가 코드로 들어와도 표에서 찾지 않는다
  it("프로토타입 키는 모르는 코드로 취급한다", () => {
    expect(errorKeyFor("toString")).toBe("internal_error");
    expect(errorCopyFor("constructor")).toBe(ERROR_COPY.internal_error);
  });
});
