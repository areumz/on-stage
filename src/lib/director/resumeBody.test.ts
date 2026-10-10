import { describe, expect, it } from "vitest";
import { parseResumeBody } from "./resumeBody";

const id = "t1:0:confirm_sections";

describe("parseResumeBody", () => {
  it("approve 는 payload 없이 통과", () => {
    expect(parseResumeBody({ interruptId: id, kind: "approve" })).toEqual({ interruptId: id, kind: "approve" });
  });

  it("interruptId 가 없거나 비어 있으면 거절", () => {
    expect(parseResumeBody({ kind: "approve" })).toBeNull();
    expect(parseResumeBody({ interruptId: "", kind: "approve" })).toBeNull();
    expect(parseResumeBody(null)).toBeNull();
    expect(parseResumeBody("x")).toBeNull();
  });

  it("모르는 kind 는 거절", () => {
    expect(parseResumeBody({ interruptId: id, kind: "nope" })).toBeNull();
  });

  describe("sections", () => {
    const sections = [
      { label: "intro", startSec: 0, endSec: 20, mood: "차분" },
      { label: "chorus", startSec: 20, endSec: 40 },
    ];

    it("모양이 맞으면 통과하고 mood 는 있을 때만 싣는다", () => {
      const r = parseResumeBody({ interruptId: id, kind: "sections", payload: { sections } });
      expect(r).toEqual({ interruptId: id, kind: "sections", payload: { sections } });
    });

    it("모르는 필드는 버린다", () => {
      const r = parseResumeBody({ interruptId: id, kind: "sections", payload: { sections: [{ ...sections[0], x: 1 }] } });
      expect(r && "payload" in r && (r.payload as { sections: object[] }).sections[0]).not.toHaveProperty("x");
    });

    it("시간이 숫자가 아니면 거절 (규칙 위반이 아니라 모양 오류)", () => {
      expect(parseResumeBody({ interruptId: id, kind: "sections", payload: { sections: [{ label: "a", startSec: "0", endSec: 9 }] } })).toBeNull();
      expect(parseResumeBody({ interruptId: id, kind: "sections", payload: { sections: [{ label: "a", startSec: 0, endSec: NaN }] } })).toBeNull();
    });

    it("빈 목록·너무 큰 목록은 거절", () => {
      expect(parseResumeBody({ interruptId: id, kind: "sections", payload: { sections: [] } })).toBeNull();
      const many = Array.from({ length: 51 }, (_, i) => ({ label: "a", startSec: i, endSec: i + 1 }));
      expect(parseResumeBody({ interruptId: id, kind: "sections", payload: { sections: many } })).toBeNull();
    });
  });

  describe("feedback", () => {
    it("텍스트는 앞뒤 공백을 지우고, 대상은 중복을 없앤다", () => {
      const r = parseResumeBody({ interruptId: id, kind: "feedback", payload: { text: "  더 밝게  ", targets: [2, 2, 0] } });
      expect(r).toEqual({ interruptId: id, kind: "feedback", payload: { text: "더 밝게", targets: [2, 0] } });
    });

    it("빈 텍스트·공백뿐인 텍스트·500자 초과는 거절", () => {
      expect(parseResumeBody({ interruptId: id, kind: "feedback", payload: { text: "   ", targets: [0] } })).toBeNull();
      expect(parseResumeBody({ interruptId: id, kind: "feedback", payload: { text: "a".repeat(501), targets: [0] } })).toBeNull();
      expect(parseResumeBody({ interruptId: id, kind: "feedback", payload: { text: "a".repeat(500), targets: [0] } })).not.toBeNull();
    });

    it("대상이 없거나 음수·소수·문자면 거절", () => {
      for (const targets of [[], [-1], [1.5], ["0"], "0", undefined]) {
        expect(parseResumeBody({ interruptId: id, kind: "feedback", payload: { text: "x", targets } }), JSON.stringify(targets)).toBeNull();
      }
    });
  });
});
