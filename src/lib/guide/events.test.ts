// src/lib/guide/events.test.ts
import { describe, it, expect } from "vitest";
import sample from "./guide_events_sample.json";
import { parseGuideEvent } from "./events";

describe("parseGuideEvent — 에이전트 fixture", () => {
  const all = [...sample.success, ...sample.error, ...sample.retract_unverified];

  it("fixture의 모든 이벤트를 해석한다", () => {
    for (const item of all) {
      const e = parseGuideEvent(item.event, JSON.stringify(item.data));
      expect(e, item.event).not.toBeNull();
      expect(e!.event).toBe(item.event);
    }
  });

  it("action은 액션 객체 그대로 온다", () => {
    const e = parseGuideEvent("action", '{"type":"focusArtist","slug":"aurora"}');
    expect(e).toEqual({ event: "action", action: { type: "focusArtist", slug: "aurora" } });
  });
});

describe("parseGuideEvent — 방어", () => {
  it("깨진 JSON은 null", () => {
    expect(parseGuideEvent("text_delta", "{oops")).toBeNull();
  });
  it("모르는 이벤트 이름은 null", () => {
    expect(parseGuideEvent("weird", "{}")).toBeNull();
  });
  it("필드 타입이 틀리면 null", () => {
    expect(parseGuideEvent("text_delta", '{"text":5}')).toBeNull();
  });
  it("모르는 액션 type은 null (무시)", () => {
    expect(parseGuideEvent("action", '{"type":"teleport","slug":"x"}')).toBeNull();
  });
  it("openTour의 section은 없어도, 문자열이면 있어도 된다", () => {
    expect(parseGuideEvent("action", '{"type":"openTour","slug":"nova"}')).not.toBeNull();
    expect(parseGuideEvent("action", '{"type":"openTour","slug":"nova","section":"album"}')).toEqual({
      event: "action",
      action: { type: "openTour", slug: "nova", section: "album" },
    });
  });
  it("모르는 오류 코드는 internal로 바꾼다", () => {
    expect(parseGuideEvent("error", '{"code":"new_code"}')).toEqual({ event: "error", code: "internal" });
  });
});

describe("session_limit·highlightCity", () => {
  it("session_limit은 그대로 오류 코드로 해석한다", () => {
    expect(parseGuideEvent("error", '{"code":"session_limit"}')).toEqual({ event: "error", code: "session_limit" });
  });
  it("highlightCity 액션을 해석한다", () => {
    expect(parseGuideEvent("action", '{"type":"highlightCity","slug":"aurora","city":"SEO"}')).toEqual({
      event: "action",
      action: { type: "highlightCity", slug: "aurora", city: "SEO" },
    });
  });
});
