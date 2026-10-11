import { describe, expect, it } from "vitest";
import { DEFAULT_PRESET_SCENE, type PresetScene } from "@/lib/stage/scene";
import { dropPresetImage, presetView, reducePreset } from "./model";
import { initStudio, studioReducer, type StudioEvent } from "./studioState";

const run = (...evs: StudioEvent[]) => evs.reduce(studioReducer, initStudio);
const upScene: PresetScene = { ...DEFAULT_PRESET_SCENE, image: { kind: "upload", path: "u/studio/1.png" } };

describe("프리셋 장면 reducer (이미지)", () => {
  it("이미지 탭에서 샘플과 내 업로드를 모두 고를 수 있다", () => {
    const s = reducePreset(DEFAULT_PRESET_SCENE, { type: "mode", mode: "image" });
    expect(presetView(s).image).toEqual({ kind: "sample", id: "neon-city" });
    expect(reducePreset(s, { type: "image", image: upScene.image! }).image).toEqual(upScene.image);
    expect(reducePreset(upScene, { type: "fx", fx: "bars" })).toMatchObject({ backdrop: "bars", image: null });
  });
  it("지운 업로드를 쓰던 장면만 이미지가 풀린다", () => {
    expect(dropPresetImage(upScene, "u/studio/1.png").image).toBeNull();
    expect(dropPresetImage(upScene, "other")).toBe(upScene);
  });
});

describe("studioReducer", () => {
  it("취소하면 draft 가 사라진다(저장값은 건드리지 않음)", () => {
    expect(run({ type: "open", saved: DEFAULT_PRESET_SCENE }, { type: "panel", action: { type: "dust", dir: 1 } }, { type: "close" }).draft).toBeNull();
  });
  it("업로드 중 닫으면 완료된 이미지는 적용되지 않는다", () => {
    const opened = run({ type: "open", saved: DEFAULT_PRESET_SCENE });
    const gen = opened.gen;
    const closed = studioReducer(opened, { type: "close" });
    expect(studioReducer(closed, { type: "uploaded", path: "p", gen }).draft).toBeNull();
    expect(run({ type: "open", saved: DEFAULT_PRESET_SCENE }, { type: "close" }, { type: "open", saved: DEFAULT_PRESET_SCENE }, { type: "uploaded", path: "p", gen }).draft?.image).toBeNull();
  });
  it("같은 세대의 업로드는 선택되고, 삭제하면 풀린다", () => {
    const s = run({ type: "open", saved: DEFAULT_PRESET_SCENE });
    const up = studioReducer(s, { type: "uploaded", path: "p", gen: s.gen });
    expect(up.draft?.image).toEqual({ kind: "upload", path: "p" });
    expect(studioReducer(up, { type: "imageRemoved", path: "p" }).draft?.image).toBeNull();
  });
});
