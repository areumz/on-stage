import { describe, expect, it } from "vitest";
import { DEFAULT_PRESET_SCENE, NO_SCENE, resolveScene } from "@/lib/stage/scene";
import { editView, presetView, reduceEdit, reducePreset, sameScene, stepLevel, type EditCtx } from "./model";

const ctx: EditCtx = { index: 1, sectionCount: 3, item: { backdrop: "laser", dust: 70, reflection: 60 }, energyRatio: 1.2, aiProps: ["amp", "mic"] };

describe("stepLevel", () => {
  it("10 단위로 움직이고 0~100 에 머문다", () => {
    expect(stepLevel(70, 1)).toBe(80);
    expect(stepLevel(70, -1)).toBe(60);
    expect(stepLevel(47, 1)).toBe(50);
    expect(stepLevel(47, -1)).toBe(40);
    expect(stepLevel(100, 1)).toBe(100);
    expect(stepLevel(0, -1)).toBe(0);
  });
});

describe("연출 편집", () => {
  it("고치기 전엔 AI 값이 보이고 edited 가 아니다", () => {
    const v = editView(null, ctx);
    expect(v).toMatchObject({ mode: "auto", dust: 70, reflection: 60, props: ["amp", "mic"], edited: false });
  });

  it("먼지는 해당 구간에만 저장되고 다른 구간은 null", () => {
    const e = reduceEdit(null, { type: "dust", dir: 1 }, ctx)!;
    expect(e.sections).toEqual([null, { dust: 80 }, null]);
    expect(editView(e, ctx)).toMatchObject({ dust: 80, edited: true });
  });

  it("소품은 곡 전체(edit.props) 에 저장된다", () => {
    const e = reduceEdit(null, { type: "prop", key: "drum" }, ctx)!;
    expect(e.props).toEqual(["amp", "drum", "mic"]);
    expect(reduceEdit(e, { type: "prop", key: "amp" }, ctx)!.props).toEqual(["drum", "mic"]);
  });

  it("AI 제안으로 되돌리기는 이 구간과 소품만 지우고 배경 모드는 남긴다", () => {
    let e = reduceEdit(null, { type: "mode", mode: "fx" }, ctx);
    e = reduceEdit(e, { type: "dust", dir: -1 }, ctx);
    e = reduceEdit(e, { type: "prop", key: "drum" }, { ...ctx, index: 0 });
    const other = reduceEdit(e, { type: "reflection", dir: 1 }, { ...ctx, index: 2 })!;
    const reset = reduceEdit(other, { type: "resetElements" }, ctx)!;
    expect(reset.props).toBeUndefined();
    expect(reset.sections).toEqual([null, null, { reflection: 70 }]);
    expect(reset.backdrop).toEqual({ mode: "fx", fx: "gyro" });
  });

  it("아무것도 안 남으면 null (AI 값으로 완전히 복귀)", () => {
    const e = reduceEdit(null, { type: "dust", dir: 1 }, ctx);
    expect(reduceEdit(e, { type: "resetElements" }, ctx)).toBeNull();
    expect(reduceEdit(reduceEdit(null, { type: "mode", mode: "fx" }, ctx), { type: "mode", mode: "auto" }, ctx)).toBeNull();
  });

  it("모드 전환: 이미지는 처음엔 첫 샘플, 효과 선택은 유지", () => {
    expect(reduceEdit(null, { type: "mode", mode: "image" }, ctx)!.backdrop).toEqual({ mode: "image", image: { kind: "sample", id: "neon-city" } });
    const fx = reduceEdit(null, { type: "fx", fx: "tunnel" }, ctx)!;
    expect(editView(fx, ctx)).toMatchObject({ mode: "fx", fx: "tunnel" });
    expect(editView(reduceEdit(fx, { type: "image", image: { kind: "upload", path: "a/b.png" } }, ctx), ctx).image).toEqual({ kind: "upload", path: "a/b.png" });
  });

  it("고친 값은 resolveScene 에서 AI 값보다 우선한다", () => {
    const e = reduceEdit(null, { type: "dust", dir: 1 }, ctx);
    const r = resolveScene({ ...ctx, edit: e, imageUrl: null });
    expect(r.dust).toBe(80);
    expect(r.backdrop).toBe("laser");
  });
});

describe("프리셋 편집", () => {
  it("이미지 모드는 샘플·내 업로드 모두 고를 수 있고, 효과를 고르면 이미지가 풀린다", () => {
    const img = reducePreset(DEFAULT_PRESET_SCENE, { type: "mode", mode: "image" });
    expect(presetView(img)).toMatchObject({ mode: "image", image: { kind: "sample", id: "neon-city" } });
    expect(reducePreset(img, { type: "image", image: { kind: "upload", path: "x" } }).image).toEqual({ kind: "upload", path: "x" });
    expect(reducePreset(img, { type: "fx", fx: "bars" })).toMatchObject({ backdrop: "bars", image: null });
  });

  it("먼지·소품·되돌리기", () => {
    let s = reducePreset(DEFAULT_PRESET_SCENE, { type: "dust", dir: 1 });
    s = reducePreset(s, { type: "prop", key: "mic" });
    expect(s).toMatchObject({ dust: 10, props: ["mic"] });
    expect(presetView(s).edited).toBe(true);
    expect(reducePreset(s, { type: "resetElements" })).toEqual(DEFAULT_PRESET_SCENE);
  });
});

describe("sameScene", () => {
  it("필드가 같으면 같고 하나라도 다르면 다르다", () => {
    expect(sameScene(NO_SCENE, { ...NO_SCENE, props: [] })).toBe(true);
    expect(sameScene(NO_SCENE, { ...NO_SCENE, props: ["amp"] })).toBe(false);
    expect(sameScene(NO_SCENE, { ...NO_SCENE, dust: 1 })).toBe(false);
  });
});
