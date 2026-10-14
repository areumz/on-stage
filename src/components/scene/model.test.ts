import { describe, expect, it } from "vitest";
import { DEFAULT_PRESET_SCENE, NO_SCENE, resolveScene } from "@/lib/stage/scene";
import type { SceneEdit } from "@/lib/stage/scene";
import { dropImageRefs, editView, migrateLegacy, presetView, reduceEdit, reducePreset, sameScene, sectionEdited, sectionMode, stepLevel, type EditCtx } from "./model";

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

  it("되돌리기는 선택한 구간의 먼지·반사만 지우고 배경·소품·다른 구간은 남긴다", () => {
    let e = reduceEdit(null, { type: "fx", fx: "tunnel" }, ctx);
    e = reduceEdit(e, { type: "dust", dir: -1 }, ctx);
    e = reduceEdit(e, { type: "prop", key: "drum" }, ctx);
    const other = reduceEdit(e, { type: "reflection", dir: 1 }, { ...ctx, index: 2 })!;
    const reset = reduceEdit(other, { type: "resetElements" }, ctx)!;
    expect(reset.props).toEqual(["amp", "drum", "mic"]);
    expect(reset.sections).toEqual([null, { backdrop: "tunnel" }, { reflection: 70 }]);
    expect(editView(reset, ctx)).toMatchObject({ edited: false, propsEdited: true, mode: "fx", fx: "tunnel" });
    expect(reduceEdit(reset, { type: "resetProps" }, ctx)!.props).toBeUndefined();
  });

  it("구간마다 고친 값이 따로 유지되고 sectionEdited 로 보인다", () => {
    let e = reduceEdit(null, { type: "dust", dir: 1 }, ctx); // 구간 1
    e = reduceEdit(e, { type: "dust", dir: -1 }, { ...ctx, index: 0 });
    expect(editView(e, ctx).dust).toBe(80);
    expect(editView(e, { ...ctx, index: 0 }).dust).toBe(60); // AI 값 70 에서 한 칸 내림 (구간 1 의 80 과 따로)
    expect([0, 1, 2].map((i) => sectionEdited(e, i))).toEqual([true, true, false]);
  });

  it("아무것도 안 남으면 null (AI 값으로 완전히 복귀)", () => {
    const e = reduceEdit(null, { type: "dust", dir: 1 }, ctx);
    expect(reduceEdit(e, { type: "resetElements" }, ctx)).toBeNull();
    expect(reduceEdit(reduceEdit(null, { type: "fx", fx: "bars" }, ctx), { type: "resetBackdrop" }, ctx)).toBeNull();
  });

  it("효과·이미지는 선택한 구간에만 적용되고 서로 배타적이다", () => {
    const fx = reduceEdit(null, { type: "fx", fx: "tunnel" }, ctx)!;
    expect(fx.sections).toEqual([null, { backdrop: "tunnel" }, null]);
    expect(fx.backdrop).toBeUndefined(); // 연출 전체 모드는 쓰지 않는다
    const img = reduceEdit(fx, { type: "image", image: { kind: "upload", path: "a/b.png" } }, ctx)!;
    expect(img.sections).toEqual([null, { image: { kind: "upload", path: "a/b.png" } }, null]);
  });

  it("탭 표시는 그 구간의 실제 상태(이미지 > 효과 > AI 제안)", () => {
    let e = reduceEdit(null, { type: "fx", fx: "cube" }, ctx);
    e = reduceEdit(e, { type: "image", image: { kind: "sample", id: "galaxy" } }, { ...ctx, index: 2 });
    expect([0, 1, 2].map((i) => sectionMode(e, i))).toEqual(["auto", "fx", "image"]);
    expect(editView(e, { ...ctx, index: 2 })).toMatchObject({ mode: "image", image: { kind: "sample", id: "galaxy" } });
    expect(editView(e, { ...ctx, index: 0 }).mode).toBe("auto");
    expect(reduceEdit(e, { type: "resetBackdrop" }, ctx)).toEqual({ sections: [null, null, { image: { kind: "sample", id: "galaxy" } }] });
  });

  it("모든 구간에 적용: 효과/이미지를 복사하고 먼지·반사는 각자 유지, 이미지가 없는 이미지 탭에선 아무 일도 없다", () => {
    let e = reduceEdit(null, { type: "dust", dir: 1 }, { ...ctx, index: 0 });
    e = reduceEdit(e, { type: "fx", fx: "bars" }, ctx);
    const all = reduceEdit(e, { type: "applyAll", tab: "fx" }, ctx)!;
    expect(all.sections!.map((s) => s?.backdrop)).toEqual(["bars", "bars", "bars"]);
    expect(all.sections![0]!.dust).toBe(80);
    expect(reduceEdit(null, { type: "applyAll", tab: "image" }, ctx)).toBeNull();
    const img = reduceEdit(all, { type: "image", image: { kind: "sample", id: "galaxy" } }, { ...ctx, index: 2 })!;
    expect(reduceEdit(img, { type: "applyAll", tab: "image" }, { ...ctx, index: 2 })!.sections!.map((s) => s?.image?.kind)).toEqual(["sample", "sample", "sample"]);
  });

  it("삭제: 모든 구간의 그 이미지 참조와 예전 backdrop 참조를 지운다", () => {
    const e: SceneEdit = {
      backdrop: { mode: "image", image: { kind: "upload", path: "p" } },
      sections: [{ image: { kind: "upload", path: "p" }, dust: 10 }, { image: { kind: "upload", path: "q" } }, null],
    };
    expect(dropImageRefs(e, "p")).toEqual({ sections: [{ dust: 10 }, { image: { kind: "upload", path: "q" } }, null] });
    expect(dropImageRefs({ sections: [{ image: { kind: "upload", path: "p" } }, null, null] }, "p")).toBeNull();
  });

  it("예전 형식(edit.backdrop)은 값이 없는 구간에만 복사하고 backdrop 키를 버린다", () => {
    const old: SceneEdit = { backdrop: { mode: "fx", fx: "laser" }, sections: [{ backdrop: "cube" }, { dust: 20 }, null] };
    expect(migrateLegacy(old, 3)).toEqual({ sections: [{ backdrop: "cube" }, { dust: 20, backdrop: "laser" }, { backdrop: "laser" }] });
    const img: SceneEdit = { backdrop: { mode: "image", image: { kind: "sample", id: "galaxy" } } };
    expect(migrateLegacy(img, 2)!.sections!.map((x) => x?.image?.kind)).toEqual(["sample", "sample"]);
    expect(migrateLegacy({ backdrop: { mode: "auto" } }, 2)).toBeNull();
    expect(migrateLegacy(null, 2)).toBeNull();
  });

  it("고친 값은 resolveScene 에서 AI 값보다 우선하고, 구간 이미지가 구간 효과보다 우선한다", () => {
    const e = reduceEdit(null, { type: "dust", dir: 1 }, ctx);
    const r = resolveScene({ ...ctx, edit: e });
    expect(r.dust).toBe(80);
    expect(r.backdrop).toBe("laser");
    const withImg = reduceEdit(e, { type: "image", image: { kind: "sample", id: "galaxy" } }, ctx);
    expect(resolveScene({ ...ctx, edit: withImg, imageUrlFor: () => "/x.svg" })).toMatchObject({ imageUrl: "/x.svg", backdrop: "none" });
    expect(resolveScene({ ...ctx, edit: withImg, imageUrlFor: () => null }).backdrop).toBe("laser"); // URL 이 없으면 효과로 폴백
  });
});

describe("탭은 보기일 뿐이고 값은 항목을 눌러야 바뀐다", () => {
  const cube: EditCtx = { ...ctx, item: { backdrop: "cube", dust: 70, reflection: 60 } };
  const gyro: EditCtx = { ...ctx, item: { backdrop: "gyro" } };

  it("③ 3D 효과 탭은 AI 가 cube 인 구간에서 cube 가 선택돼 있고 AI 제안 값으로 표시된다", () => {
    const v = editView(null, cube);
    expect(v).toMatchObject({ fx: "cube", aiFx: "cube", backdropEdited: false, mode: "auto" });
  });

  it("이미지 탭은 이미지 값이 없으면 '없음'(image null)이 기본이고, AI 가 gyro 여도 샘플이 선택되지 않는다", () => {
    expect(editView(null, gyro)).toMatchObject({ image: null, aiFx: "gyro", fx: "gyro" });
  });

  it("④ 효과 '없음'은 backdrop none 으로 저장되고 그 구간 배경이 사라진다", () => {
    const e = reduceEdit(null, { type: "fx", fx: "none" }, cube)!;
    expect(e.sections).toEqual([null, { backdrop: "none" }, null]);
    expect(editView(e, cube)).toMatchObject({ fx: "none", mode: "fx", backdropEdited: true });
    expect(resolveScene({ ...cube, edit: e }).backdrop).toBe("none");
  });

  it("③ 이미지 '없음'은 구간 image 만 지우고 효과는 유지한다", () => {
    let e = reduceEdit(null, { type: "fx", fx: "tunnel" }, cube);
    e = reduceEdit({ ...e, sections: [null, { backdrop: "tunnel", image: { kind: "sample", id: "galaxy" } }, null] }, { type: "clearImage" }, cube);
    expect(e!.sections).toEqual([null, { backdrop: "tunnel" }, null]);
    expect(reduceEdit(reduceEdit(null, { type: "image", image: { kind: "sample", id: "galaxy" } }, cube), { type: "clearImage" }, cube)).toBeNull();
  });

  it("AI 배경 되돌리기는 효과·이미지만 지우고 먼지·반사는 남긴다", () => {
    let e = reduceEdit(null, { type: "dust", dir: 1 }, cube);
    e = reduceEdit(e, { type: "image", image: { kind: "sample", id: "galaxy" } }, cube);
    expect(reduceEdit(e, { type: "resetBackdrop" }, cube)!.sections).toEqual([null, { dust: 80 }, null]);
  });

  it("모든 구간에 적용: fx 탭은 AI 제안 값도 복사하고, 이미지 탭은 이미지가 없으면 아무 일도 없다", () => {
    const all = reduceEdit(null, { type: "applyAll", tab: "fx" }, cube)!;
    expect(all.sections!.map((s) => s?.backdrop)).toEqual(["cube", "cube", "cube"]);
    expect(reduceEdit(null, { type: "applyAll", tab: "image" }, cube)).toBeNull();
  });
});

describe("프리셋 편집", () => {
  it("이미지 모드는 샘플·내 업로드 모두 고를 수 있고, 효과를 고르면 이미지가 풀린다", () => {
    const img = reducePreset(DEFAULT_PRESET_SCENE, { type: "image", image: { kind: "sample", id: "neon-city" } });
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
