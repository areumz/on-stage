import { describe, expect, it } from "vitest";
import {
  addSection, boundaryRange, canAdd, formatTime, canSplit, fromSections, listenWindow, mergeUp, rowIndexAt, xToSec, moveBoundary, parseTime, setEnd, split, toInputs, validateSections,
  type EditRow,
} from "./sections";

const sec = (label: string, startSec: number, endSec: number, mood = "") => ({ label, startSec, endSec, mood });
const base = () =>
  fromSections([sec("intro", 0, 12, "a"), sec("verse", 12, 37), sec("chorus", 37, 67), sec("outro", 67, 100.4)], 100.4);
const ends = (rows: EditRow[]) => rows.map((r) => r.endSec);

describe("parseTime", () => {
  it("m:ss 와 초 숫자를 읽고 나머지는 null", () => {
    expect(parseTime("1:07")).toBe(67);
    expect(parseTime(" 67 ")).toBe(67);
    expect(parseTime("0:5")).toBe(5);
    expect(parseTime("1:75")).toBeNull();
    expect(parseTime("abc")).toBeNull();
    expect(parseTime("1.5")).toBeNull();
    expect(parseTime("")).toBeNull();
  });
});

describe("fromSections / toInputs", () => {
  it("고치지 않은 행은 raw label, 고친 행은 trim 한 입력값을 보낸다", () => {
    const rows = base();
    expect(rows[0].text).toBe("intro");
    rows[1] = { ...rows[1], text: "  드롭 " };
    const out = toInputs(rows);
    expect(out.map((s) => s.label)).toEqual(["intro", "드롭", "chorus", "outro"]);
    expect(out[1].startSec).toBe(12);
    expect(out[3].endSec).toBe(100.4);
  });
});

describe("고치지 않은 행", () => {
  it("지웠다 같은 이름으로 되돌리면 raw 를 보낸다", () => {
    const rows = base();
    rows[0] = { ...rows[0], text: "" };
    expect(toInputs(rows)[0].label).toBe("");
    rows[0] = { ...rows[0], text: "intro" };
    expect(toInputs(rows)[0].label).toBe("intro");
  });
  it("서버가 유효하다고 준 구간은 그대로 검증을 통과한다", () => {
    const ex = [sec("intro", 0, 8.5), sec("outro", 8.5, 16.5)];
    expect(validateSections(toInputs(fromSections(ex, 16.5)), 16.5)).toEqual({ ok: true });
    for (let k = 0; k < 300; k++) {
      const n = 2 + (k % 6);
      // 각 구간 길이를 8 이상 소수로 만들어 이어 붙인다
      const lens = Array.from({ length: n }, (_, j) => 8 + ((k * (j + 3) * 0.37) % 5));
      const total = lens.reduce((a, b) => a + b, 0);
      let at = 0;
      const secs = lens.map((l, j) => {
        const end = j === n - 1 ? total : at + l;
        const s0 = sec("verse", at, end);
        at = end;
        return s0;
      });
      expect(validateSections(toInputs(fromSections(secs, total)), total)).toEqual({ ok: true });
    }
  });
});

describe("setEnd", () => {
  it("다음 구간 시작이 같이 움직인다", () => {
    const out = toInputs(setEnd(base(), 0, 15));
    expect(out[1].startSec).toBe(15);
  });
  it("마지막 행, 뒤집힘, 비정수는 무시", () => {
    const rows = base();
    expect(setEnd(rows, 3, 90)).toBe(rows);
    expect(setEnd(rows, 1, 12)).toBe(rows);
    expect(setEnd(rows, 1, 67)).toBe(rows);
    expect(setEnd(rows, 1, 20.5)).toBe(rows);
  });
  it("8초 미만도 허용해 오류로 보여 준다", () => {
    expect(ends(setEnd(base(), 0, 5))[0]).toBe(5);
  });
});

describe("moveBoundary", () => {
  it("이웃 구간이 8초 밑으로 줄지 않게 막는다", () => {
    expect(ends(moveBoundary(base(), 0, 1))[0]).toBe(8);
    expect(ends(moveBoundary(base(), 0, 99))[0]).toBe(29);
  });
  it("소수 입력은 반올림", () => {
    expect(ends(moveBoundary(base(), 1, 40.6))[1]).toBe(41);
  });
});

describe("mergeUp", () => {
  it("위 구간 끝이 이 구간 끝이 된다", () => {
    const out = mergeUp(base(), 2);
    expect(out.map((r) => r.raw)).toEqual(["intro", "verse", "outro"]);
    expect(ends(out)).toEqual([12, 67, 100.4]);
  });
  it("첫 행은 불가", () => {
    const rows = base();
    expect(mergeUp(rows, 0)).toBe(rows);
  });
});

describe("split / add", () => {
  it("가운데에서 정수 초로 나눈다", () => {
    const out = split(base(), 2); // 37~67 -> 52
    expect(ends(out)).toEqual([12, 37, 52, 67, 100.4]);
    expect(out[3].raw).toBe("chorus");
  });
  it("두 조각 중 하나라도 8초 미만이면 불가", () => {
    const rows = base();
    expect(canSplit(rows, 0)).toBe(false); // 12초 -> 6+6
    expect(split(rows, 0)).toBe(rows);
  });
  it("추가는 가장 긴 구간을 쪼개고 12개면 막는다", () => {
    const rows = base(); // 가장 긴: 37~67(30) vs 67~100.4(33.4)
    expect(ends(addSection(rows))).toEqual([12, 37, 67, 84, 100.4]);
    let many = base();
    while (canAdd(many)) many = addSection(many);
    expect(many.length).toBeLessThanOrEqual(12);
    const full = fromSections(Array.from({ length: 12 }, (_, i) => sec("verse", i * 20, (i + 1) * 20)), 240);
    expect(canAdd(full)).toBe(false);
    expect(addSection(full)).toBe(full);
  });
});

describe("validateSections", () => {
  it("정상", () => {
    expect(validateSections(toInputs(base()), 100.4)).toEqual({ ok: true });
  });
  it("8초 미만 행 문구", () => {
    const r = validateSections(toInputs(setEnd(base(), 2, 43)), 100.4);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.rowErrors[2]).toBe("구간은 8초 이상이어야 해요 (지금 6초) · 끝 시간을 늘리거나 이웃한 구간과 병합해 주세요");
  });
  it("구간 하나면 8초 규칙 없음", () => {
    expect(validateSections([sec("a", 0, 5)], 5)).toEqual({ ok: true });
  });
  it("라벨·분위기·개수·범위", () => {
    const rows = toInputs(base());
    rows[0].label = "   ";
    rows[1].mood = "x".repeat(201);
    const r = validateSections(rows, 100.4);
    expect(!r.ok && Object.keys(r.rowErrors)).toEqual(["0", "1"]);
    expect(validateSections(rows.slice(0, 2), 100.4)).toMatchObject({ ok: false, message: expect.any(String) });
    const many = Array.from({ length: 13 }, (_, i) => sec("v", i * 10, (i + 1) * 10));
    expect(validateSections(many, 130)).toMatchObject({ ok: false, message: expect.stringContaining("12") });
  });
  it("앞 구간과 끊기면 오류", () => {
    const rows = toInputs(base());
    rows[1].startSec = 14;
    expect(validateSections(rows, 100.4)).toMatchObject({ ok: false, rowErrors: { 1: expect.any(String) } });
  });
});

describe("경계 케이스", () => {
  it("setEnd 음수·0 무시", () => {
    const rows = base();
    expect(setEnd(rows, 1, -3)).toBe(rows);
    expect(setEnd(rows, 0, 0)).toBe(rows);
  });
  it("moveBoundary NaN/Infinity 무시", () => {
    const rows = base();
    expect(moveBoundary(rows, 0, NaN)).toBe(rows);
    expect(moveBoundary(rows, 0, Infinity)).toBe(rows);
  });
  it("boundaryRange: 좁으면 1초 여유만 지킨다", () => {
    const rows = setEnd(base(), 0, 5); // 0~5, 5~37
    expect(boundaryRange(rows, 0)).toEqual({ min: 8, max: 29 });
    const tight = fromSections([sec("a", 0, 5), sec("b", 5, 12), sec("c", 12, 40)], 40);
    expect(boundaryRange(tight, 0)).toEqual({ min: 1, max: 11 });
  });
  it("분할 뒤 조각은 raw/text 를 물려받고 mood 는 비운다", () => {
    const out = split(base(), 1);
    expect(out[1]).toMatchObject({ raw: "verse", text: "verse", mood: "" });
    expect(toInputs(out)[2].label).toBe("verse");
  });
  it("마지막 구간 소수 endSec 의 분할", () => {
    const rows = fromSections([sec("a", 0, 10), sec("b", 10, 25.9)], 25.9); // 15.9 -> mid 18, 뒤 7.9
    expect(canSplit(rows, 1)).toBe(false);
    const ok = fromSections([sec("a", 0, 10), sec("b", 10, 26.5)], 26.5); // mid 18, 8 / 8.5
    expect(ends(split(ok, 1))).toEqual([10, 18, 26.5]);
  });
  it("라벨 40/41자, mood 200자", () => {
    const rows = toInputs(base());
    rows[0].label = "가".repeat(40);
    rows[1].mood = "x".repeat(200);
    expect(validateSections(rows, 100.4)).toEqual({ ok: true });
    rows[0].label = "가".repeat(41);
    expect(validateSections(rows, 100.4)).toMatchObject({ ok: false, rowKinds: { 0: "label" } });
  });
  it("EPS 경계", () => {
    const a = [sec("a", 0, 7.9995), sec("b", 7.9995, 20)];
    expect(validateSections(a, 20)).toEqual({ ok: true });
    const b = [sec("a", 0, 7.998), sec("b", 7.998, 20)];
    expect(validateSections(b, 20)).toMatchObject({ ok: false, rowKinds: { 0: "short" } });
  });
  it("formatTime", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(59.9)).toBe("0:59");
    expect(formatTime(67)).toBe("1:07");
    expect(formatTime(600)).toBe("10:00");
  });
});

describe("듣기 헬퍼", () => {
  const rows = [
    { raw: "a", text: "a", endSec: 20, mood: "" },
    { raw: "b", text: "b", endSec: 50, mood: "" },
  ];
  it("rowIndexAt: 편집 값 기준, 경계는 다음 행, 끝은 마지막 행", () => {
    expect(rowIndexAt(rows, 0)).toBe(0);
    expect(rowIndexAt(rows, 19.9)).toBe(0);
    expect(rowIndexAt(rows, 20)).toBe(1);
    expect(rowIndexAt(rows, 50)).toBe(1);
    expect(rowIndexAt(rows, 999)).toBe(1);
  });
  it("xToSec: 비율 변환과 범위 자르기, 폭 0 방어", () => {
    expect(xToSec(150, 100, 200, 60)).toBe(15);
    expect(xToSec(0, 100, 200, 60)).toBe(0);
    expect(xToSec(900, 100, 200, 60)).toBe(60);
    expect(xToSec(5, 0, 0, 60)).toBe(0);
  });
  it("listenWindow: 2초 전 ~ 3초 뒤, 곡 범위 안", () => {
    expect(listenWindow(30, 100)).toEqual({ from: 28, to: 33 });
    expect(listenWindow(1, 100)).toEqual({ from: 0, to: 4 });
    expect(listenWindow(99, 100)).toEqual({ from: 97, to: 100 });
  });
});
