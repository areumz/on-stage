import { describe, expect, it } from "vitest";
import { getDemo, listDemos } from "./demo";
import { validateSequence } from "./sequenceValidate";

describe("demo", () => {
  it("데모 목록은 두 곡, 목업 순서(나만의 작은 우주 → burn it up)", () => {
    expect(listDemos()).toEqual([
      { slug: "small-universe", title: "나만의 작은 우주" },
      { slug: "burn-it-up", title: "burn it up" },
    ]);
  });

  it("모르는 슬러그는 undefined", () => {
    expect(getDemo("nope")).toBeUndefined();
  });

  // 데모 시퀀스가 저장 전 검증(§4.5 불변식)을 통과해야 재생 화면이 깨진 데이터를 만나지 않는다
  for (const { slug } of listDemos()) {
    describe(slug, () => {
      const demo = getDemo(slug)!;

      it("시퀀스가 불변식을 지킨다", () => {
        expect(validateSequence(demo.items, demo.durationSec, "#9F77DD")).toMatchObject({ ok: true });
      });

      // 에너지 곡선은 초당 1개라 길이가 곡 길이를 올림한 값이어야 한다 (옮겨 적다 틀린 값을 잡는다)
      it("에너지 곡선이 곡 길이만큼 있다", () => {
        expect(demo.energyCurve).toHaveLength(Math.ceil(demo.durationSec));
        expect(demo.energyCurve.every((v) => Number.isFinite(v) && v >= 0)).toBe(true);
      });

      it("음원 경로는 시드 폴더", () => {
        expect(demo.storagePath.startsWith("seed/")).toBe(true);
      });
    });
  }
});
