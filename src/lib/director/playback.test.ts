import { describe, expect, it } from "vitest";
import type { SequenceItem } from "@/lib/python/contract";
import { defaultStageState, type StageState } from "@/lib/stageState";
import { energyBars, formatTime, lerpHex, lerpState, sectionIndexAt, stateAt } from "./playback";

const mk = (color: string, mut: (s: StageState) => void = () => {}): StageState => {
  const s = defaultStageState(color);
  mut(s);
  return s;
};
const A = mk("#000000", (s) => { s.spots.right.on = false; s.spots.right.intensity = 800; });
const B = mk("#ffffff", (s) => { s.spots.right.on = true; s.spots.right.intensity = 600; s.camera = "top"; s.smoke.density = 1; });
const items: SequenceItem[] = [
  { sectionLabel: "intro", startSec: 0, endSec: 10, transitionMs: 2000, state: A, rationale: "" },
  { sectionLabel: "verse", startSec: 10, endSec: 20, transitionMs: 2000, state: B, rationale: "" },
];

describe("sectionIndexAt", () => {
  it("경계는 다음 구간, 양 끝은 clamp, 빈 배열은 -1", () => {
    expect(sectionIndexAt(items, 9.99)).toBe(0);
    expect(sectionIndexAt(items, 10)).toBe(1);
    expect(sectionIndexAt(items, -5)).toBe(0);
    expect(sectionIndexAt(items, 99)).toBe(1);
    expect(sectionIndexAt([], 3)).toBe(-1);
  });
});

describe("stateAt", () => {
  it("첫 구간은 보간 없이 시작", () => {
    expect(stateAt(items, 0)).toBe(A);
  });
  it("전환 시작은 이전 값, 중간은 보간, 끝은 목표와 같은 참조", () => {
    const start = stateAt(items, 10);
    expect(start.color).toBe("#000000");
    expect(start.camera).toBe("front");
    const mid = stateAt(items, 11); // f = 0.5
    expect(mid.color).toBe("#808080");
    expect(mid.camera).toBe("top");
    expect(mid.smoke.density).toBeCloseTo(0.5);
    expect(stateAt(items, 12)).toBe(B);
    expect(stateAt(items, 15)).toBe(B);
  });
  it("카메라는 f<0.5 에서 이전 값", () => {
    expect(stateAt(items, 10.5).camera).toBe("front");
  });
  it("off 에서 on 은 0 에서 올라가고 on 은 즉시 true", () => {
    const s = stateAt(items, 11);
    expect(s.spots.right.on).toBe(true);
    expect(s.spots.right.intensity).toBeCloseTo(300);
    expect(stateAt(items, 10).spots.right.intensity).toBe(0);
  });
  it("입력을 변형하지 않고 clamp 한다", () => {
    const copy = JSON.stringify(items);
    stateAt(items, 11);
    expect(JSON.stringify(items)).toBe(copy);
    expect(stateAt(items, -3)).toBe(A);
    expect(stateAt(items, 500)).toBe(B);
  });
  it("transitionMs 0 이면 즉시 목표", () => {
    expect(stateAt([items[0], { ...items[1], transitionMs: 0 }], 10)).toBe(B);
  });
});

describe("energyBars", () => {
  it("빈 배열·0 개는 빈 결과", () => {
    expect(energyBars([], 10)).toEqual([]);
    expect(energyBars([1], 0)).toEqual([]);
  });
  it("count 개로 줄이고 최댓값 1 로 정규화", () => {
    const bars = energyBars([1, 1, 2, 2, 4, 4], 3);
    expect(bars).toEqual([0.25, 0.5, 1]);
  });
  it("곡선보다 count 가 크거나 전부 0 이어도 안전", () => {
    expect(energyBars([2], 3)).toEqual([1, 1, 1]);
    expect(energyBars([0, 0], 2)).toEqual([0, 0]);
  });
});

describe("formatTime", () => {
  it("m:ss", () => {
    expect(formatTime(173.819)).toBe("2:53");
    expect(formatTime(-1)).toBe("0:00");
  });
});

describe("lerpHex", () => {
  it("3자리 hex 를 확장하고 잘못된 입력은 목표를 그대로 반환", () => {
    expect(lerpHex("#000", "#fff", 0.5)).toBe("#808080");
    expect(lerpHex("#000000", "#fff", 0)).toBe("#000000");
    expect(lerpHex("nope", "#123456", 0.5)).toBe("#123456");
    expect(lerpHex("#000000", "red", 0.5)).toBe("red");
  });
});

describe("lerpState on->off", () => {
  it("켜짐에서 꺼짐으로는 intensity 가 내려가고 중간엔 on 유지, f=1 은 목표", () => {
    const on = mk("#000000", (s) => { s.spots.left.on = true; s.spots.left.intensity = 800; });
    const off = mk("#000000", (s) => { s.spots.left.on = false; s.spots.left.intensity = 500; });
    const mid = lerpState(on, off, 0.5);
    expect(mid.spots.left.on).toBe(true);
    expect(mid.spots.left.intensity).toBeCloseTo(400);
    expect(lerpState(on, off, 1)).toBe(off);
  });
});

describe("transitionMs 경계", () => {
  const short = (ms: number): SequenceItem[] => [
    { ...items[0], endSec: 10 },
    { ...items[1], startSec: 10, endSec: 11, transitionMs: ms },
  ];
  it("구간 길이보다 크면 구간 길이로 clamp(끝에서 목표에 도달)", () => {
    expect(stateAt(short(5000), 10.5).color).toBe("#808080");
    expect(stateAt(short(5000), 11)).toBe(B);
  });
  it("구간 길이와 같으면 끝 경계에서 목표", () => {
    expect(stateAt(short(1000), 11)).toBe(B);
    expect(stateAt(short(1000), 10.999)).not.toBe(B);
  });
});

describe("빈 items", () => {
  it("던지지 않고 기본 상태", () => {
    expect(() => stateAt([], 3)).not.toThrow();
    expect(stateAt([], 3).camera).toBe("front");
  });
});
