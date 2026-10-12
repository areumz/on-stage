import { describe, expect, it } from "vitest";
import type { SceneEdit } from "@/lib/stage/scene";
import { onAccent, type EditCtx } from "./model";
import { initScene, sceneReducer, type SceneEvent, type SceneState } from "./sceneState";

const ctx: EditCtx = { index: 1, sectionCount: 3, item: {}, energyRatio: 1, aiProps: null };
const run = (s: SceneState, ...evs: SceneEvent[]) => evs.reduce(sceneReducer, s);
const up = (path: string): SceneEdit => ({ sections: [null, { image: { kind: "upload", path } }, null] });
const init = (e: SceneEdit | null = null) => initScene(e, 3);

describe("sceneReducer", () => {
  it("취소하면 열 때 값으로 돌아가고 패널이 닫힌다", () => {
    const s = run(init(), { type: "open", index: 1 }, { type: "panel", action: { type: "dust", dir: 1 }, ctx });
    expect(s.edit).not.toBeNull();
    const c = run(s, { type: "cancel" });
    expect(c).toMatchObject({ edit: null, saved: null, open: false });
  });

  it("적용 실패하면 열린 채 편집값과 오류가 남고, 재시도 성공하면 저장값이 된다", () => {
    let s = run(init(), { type: "open", index: 1 }, { type: "panel", action: { type: "dust", dir: 1 }, ctx }, { type: "saving" });
    expect(sceneReducer(s, { type: "cancel" }).open).toBe(true); // 저장 중엔 취소·편집 불가
    expect(sceneReducer(s, { type: "panel", action: { type: "dust", dir: 1 }, ctx })).toBe(s);
    const edited = s.edit;
    s = run(s, { type: "saveFailed", message: "저장하지 못했어요" });
    expect(s).toMatchObject({ open: true, saving: false, error: "저장하지 못했어요", edit: edited, saved: null });
    s = run(s, { type: "saving" }, { type: "saved", data: edited });
    expect(s).toMatchObject({ open: false, saved: edited, edit: edited, error: null });
  });

  it("패널 안에서 구간을 고르면 그 구간이 편집 대상이 되고 구간별 draft 가 유지된다", () => {
    let s = run(init(), { type: "open", index: 0 });
    s = run(s, { type: "panel", action: { type: "dust", dir: 1 }, ctx: { ...ctx, index: 0 } }, { type: "section", index: 2 });
    expect(s.index).toBe(2);
    s = run(s, { type: "panel", action: { type: "reflection", dir: 1 }, ctx: { ...ctx, index: 2 } }, { type: "section", index: 0 });
    expect(s.edit?.sections?.[0]?.dust).toBeDefined();
    expect(s.edit?.sections?.[2]?.reflection).toBeDefined();
    expect(sceneReducer(init(), { type: "section", index: 1 }).index).toBe(0); // 닫힌 패널은 무시
  });

  it("열 때 구간을 고정한다", () => {
    expect(run(init(), { type: "open", index: 2 }).index).toBe(2);
  });

  it("업로드 중 취소하면 완료된 이미지는 적용되지 않는다", () => {
    const opened = run(init(), { type: "open", index: 0 });
    const gen = opened.gen;
    const closed = run(opened, { type: "cancel" });
    expect(run(closed, { type: "uploaded", path: "a/1.png", gen, ctx }).edit).toBeNull();
    // 다시 열어도 이전 세대의 결과는 버린다
    expect(run(closed, { type: "open", index: 0 }, { type: "uploaded", path: "a/1.png", gen, ctx }).edit).toBeNull();
  });

  it("같은 세대의 업로드는 배경으로 적용된다", () => {
    const s = run(init(), { type: "open", index: 0 });
    expect(run(s, { type: "uploaded", path: "a/1.png", gen: s.gen, ctx }).edit).toEqual(up("a/1.png"));
  });

  it("이미지 삭제는 저장값과 편집값의 같은 참조를 AI 제안으로 정리한다", () => {
    const s = run(init(up("a/1.png")), { type: "open", index: 0 }, { type: "imageRemoved", path: "a/1.png" });
    expect(s).toMatchObject({ saved: null, edit: null });
  });

  it("삭제 중 다른 이미지를 골랐으면 그 선택은 유지된다", () => {
    const s = run(init(up("a/1.png")), { type: "open", index: 0 });
    const picked = run(s, { type: "panel", action: { type: "image", image: { kind: "upload", path: "a/2.png" } }, ctx });
    const after = run(picked, { type: "imageRemoved", path: "a/1.png" });
    expect(after.edit).toEqual(up("a/2.png"));
    expect(after.saved).toBeNull();
  });
});

describe("onAccent", () => {
  it("밝은 색엔 어두운 글자, 어두운 색엔 흰 글자", () => {
    expect(onAccent("#FFE066")).toBe("#0B0B10");
    expect(onAccent("#1D1D6B")).toBe("#FFFFFF");
  });
});
