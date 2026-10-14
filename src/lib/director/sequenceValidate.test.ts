import { describe, expect, it } from "vitest";
import { validateSequence } from "./sequenceValidate";
import { defaultStageState } from "@/lib/stageState";

const state = defaultStageState("#9F77DD");

function item(startSec: number, endSec: number, transitionMs = 2000) {
  return { sectionLabel: "intro", startSec, endSec, transitionMs, state, rationale: "r" };
}

const ok = [item(0, 62), item(62, 114), item(114, 173.819)];

describe("validateSequence", () => {
  it("불변식을 지키면 통과한다", () => {
    const r = validateSequence(ok, 173.819, "#9F77DD");
    expect(r.ok).toBe(true);
  });

  it("0.001초 이내 오차는 허용한다", () => {
    const r = validateSequence([item(0.0005, 62), item(62.0008, 100)], 100.0009, "#9F77DD");
    expect(r.ok).toBe(true);
  });

  it("빈 배열·배열이 아닌 값은 거절", () => {
    expect(validateSequence([], 10, "#fff").ok).toBe(false);
    expect(validateSequence(null, 10, "#fff").ok).toBe(false);
  });

  it("첫 항목이 0초가 아니면 거절", () => {
    expect(validateSequence([item(1, 10)], 10, "#fff")).toMatchObject({ ok: false });
  });

  it("마지막 항목이 곡 길이에서 끝나지 않으면 거절", () => {
    expect(validateSequence([item(0, 9)], 10, "#fff")).toMatchObject({ ok: false });
  });

  it("구간 사이가 벌어지거나 겹치면 거절", () => {
    expect(validateSequence([item(0, 5), item(6, 10)], 10, "#fff")).toMatchObject({ ok: false });
    expect(validateSequence([item(0, 6), item(5, 10)], 10, "#fff")).toMatchObject({ ok: false });
  });

  it("startSec >= endSec 이면 거절", () => {
    expect(validateSequence([item(0, 0)], 0, "#fff")).toMatchObject({ ok: false });
  });

  it("transitionMs 가 음수이거나 구간 길이를 넘으면 거절", () => {
    expect(validateSequence([item(0, 10, -1)], 10, "#fff")).toMatchObject({ ok: false });
    expect(validateSequence([item(0, 10, 10001)], 10, "#fff")).toMatchObject({ ok: false });
    expect(validateSequence([item(0, 10, 10000)], 10, "#fff").ok).toBe(true);
  });

  // 시간 값이 문자열로 들어오면 비교가 조용히 틀린다
  it("숫자가 아닌 시간 값은 거절", () => {
    const bad = { ...item(0, 10), endSec: "10" };
    expect(validateSequence([bad], 10, "#fff")).toMatchObject({ ok: false });
  });

  it("깨진 state 는 기본 상태로 채워서 저장한다", () => {
    const r = validateSequence([{ ...item(0, 10), state: { color: 123, camera: "wide" } }], 10, "#112233");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items[0].state.color).toBe("#112233");
      expect(r.items[0].state.camera).toBe("front");
    }
  });
});
