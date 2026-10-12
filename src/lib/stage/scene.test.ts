import { describe, expect, it } from "vitest";
import {
  autoBackdrop,
  parseBackdropSetting,
  parseProps,
  parsePresetScene,
  parseSceneEdit,
  parseSectionScene,
  presetToRender,
  resolveScene,
  sectionEnergyRatios,
  type ResolveInput,
} from "./scene";

const base: ResolveInput = { index: 1, item: {}, energyRatio: 1.2, aiProps: null, edit: null };
const urlFor = (img: { kind: string; id?: string; path?: string }) => (img.kind === "sample" ? `/backdrops/${img.id}.svg` : `https://signed/${img.path}`);

describe("parse", () => {
  it("모르는 값·범위 밖 값은 null", () => {
    expect(parseSectionScene({ backdrop: "disco", dust: 120, reflection: "5" })).toBeNull();
    expect(parseSectionScene({ backdrop: "laser", dust: 120 })).toEqual({ backdrop: "laser", dust: null, reflection: null });
    expect(parseSectionScene({ dust: 0, reflection: 100 })).toEqual({ backdrop: null, dust: 0, reflection: 100 });
  });
  it("props: null 과 [] 를 구별하고 중복·모르는 값을 버린다", () => {
    expect(parseProps(undefined)).toBeNull();
    expect(parseProps("mic")).toBeNull();
    expect(parseProps([])).toEqual([]);
    expect(parseProps(["mic", "mic", "guitar", "amp"])).toEqual(["amp", "mic"]);
  });
  it("배경 모드", () => {
    expect(parseBackdropSetting({ mode: "fx", fx: "cube" })).toEqual({ mode: "fx", fx: "cube" });
    expect(parseBackdropSetting({ mode: "fx", fx: "none" })).toBeNull();
    expect(parseBackdropSetting({ mode: "image", image: { kind: "sample", id: "galaxy" } })).not.toBeNull();
    expect(parseBackdropSetting({ mode: "image", image: { kind: "upload", path: "../x" } })).toBeNull();
    expect(parseBackdropSetting({ mode: "auto" })).toEqual({ mode: "auto" });
  });
  it("scene_edit: 구간 수가 다르면 sections 를 버린다", () => {
    expect(parseSceneEdit({ sections: [{ dust: 10 }] }, 2)).toBeNull();
    expect(parseSceneEdit({ sections: [{ dust: 10 }, null], props: [] }, 2)).toEqual({
      sections: [{ backdrop: null, dust: 10, reflection: null }, null],
      props: [],
    });
  });
  it("프리셋 scene 은 깨져도 기본값", () => {
    expect(parsePresetScene(null)).toEqual({ backdrop: "none", dust: 0, reflection: 0, props: [], image: null });
    expect(parsePresetScene({ backdrop: "tunnel", dust: 30, sampleImage: "nope" }).image).toBeNull();
    expect(parsePresetScene({ sampleImage: "galaxy" }).image).toEqual({ kind: "sample", id: "galaxy" }); // 예전 모양
    expect(parsePresetScene({ image: { kind: "upload", path: "u/studio/a.png" } }).image).toEqual({ kind: "upload", path: "u/studio/a.png" });
    expect(parsePresetScene([]).image).toBeNull();
  });
});

describe("resolveScene", () => {
  it("값이 모두 없으면 자동 규칙(에너지 비) 과 기본 소품", () => {
    const r = resolveScene(base);
    expect(r.backdrop).toBe("laser");
    expect(r.props).toEqual(["mic"]);
    expect(r.imageUrl).toBeNull();
  });
  it("AI 값 > 자동 규칙, 사용자 값 > AI 값", () => {
    expect(resolveScene({ ...base, item: { backdrop: "cube", dust: 5 } }).backdrop).toBe("cube");
    const mine = resolveScene({ ...base, item: { backdrop: "cube", dust: 5 }, edit: { sections: [null, { dust: 77 }] } });
    expect(mine.dust).toBe(77);
    expect(mine.backdrop).toBe("cube"); // 고치지 않은 필드는 AI 값
  });
  it("props: 사용자 [] 는 소품 없음, AI [] 도 소품 없음, AI null 은 기본값", () => {
    expect(resolveScene({ ...base, aiProps: [], edit: null }).props).toEqual([]);
    expect(resolveScene({ ...base, aiProps: ["amp"], edit: { props: [] } }).props).toEqual([]);
    expect(resolveScene({ ...base, aiProps: null }).props).toEqual(["mic"]);
  });
  it("구간에서 고른 효과·이미지가 그 구간에만 적용된다", () => {
    const edit = { sections: [{ backdrop: "cube" as const }, { image: { kind: "sample" as const, id: "galaxy" as const } }] };
    const first = resolveScene({ ...base, index: 0, item: { backdrop: "bars" }, edit, imageUrlFor: urlFor });
    expect(first.backdrop).toBe("cube");
    expect(first.imageUrl).toBeNull();
    const second = resolveScene({ ...base, index: 1, item: { backdrop: "bars" }, edit, imageUrlFor: urlFor });
    expect(second).toMatchObject({ backdrop: "none", imageUrl: "/backdrops/galaxy.svg" });
    // 고치지 않은 구간은 AI 값
    expect(resolveScene({ ...base, index: 2, item: { backdrop: "bars" }, edit, imageUrlFor: urlFor }).backdrop).toBe("bars");
  });
  it("이미지 URL 을 아직 못 구했으면 AI 효과로 폴백", () => {
    const edit = { sections: [null, { image: { kind: "upload" as const, path: "u/s/a.png" } }] };
    expect(resolveScene({ ...base, item: { backdrop: "bars" }, edit }).backdrop).toBe("bars");
    expect(resolveScene({ ...base, item: { backdrop: "bars" }, edit, imageUrlFor: () => null }).imageUrl).toBeNull();
    expect(resolveScene({ ...base, item: { backdrop: "bars" }, edit, imageUrlFor: urlFor }).imageUrl).toBe("https://signed/u/s/a.png");
  });
  it("예전 형식(연출 전체 모드)도 구간 값이 없을 때만 적용", () => {
    const whole = { backdrop: { mode: "fx" as const, fx: "tunnel" as const } };
    expect(resolveScene({ ...base, item: { backdrop: "bars" }, edit: whole }).backdrop).toBe("tunnel");
    expect(resolveScene({ ...base, item: { backdrop: "bars" }, edit: { ...whole, sections: [null, { backdrop: "cube" }] } }).backdrop).toBe("cube");
    const wholeImg = { backdrop: { mode: "image" as const, image: { kind: "sample" as const, id: "galaxy" as const } } };
    expect(resolveScene({ ...base, edit: wholeImg, imageUrlFor: urlFor })).toMatchObject({ backdrop: "none", imageUrl: "/backdrops/galaxy.svg" });
  });
});

describe("energy", () => {
  it("구간 에너지 비", () => {
    const curve = [1, 1, 1, 1, 3, 3, 3, 3]; // 평균 2
    expect(sectionEnergyRatios(curve, [{ startSec: 0, endSec: 4 }, { startSec: 4, endSec: 8 }])).toEqual([0.5, 1.5]);
    expect(sectionEnergyRatios(null, [{ startSec: 0, endSec: 4 }])).toEqual([1]);
    expect(autoBackdrop(0.5)).toBe("gyro");
    expect(autoBackdrop(1)).toBe("bars");
  });
  it("프리셋 장면 → 렌더 값", () => {
    const base = { backdrop: "cube" as const, dust: 10, reflection: 20, props: ["amp" as const] };
    expect(presetToRender({ ...base, image: { kind: "sample", id: "galaxy" } })).toMatchObject({ backdrop: "none", imageUrl: "/backdrops/galaxy.svg", props: ["amp"] });
    const up = { ...base, image: { kind: "upload" as const, path: "u/studio/a.png" } };
    expect(presetToRender(up, "https://signed")).toMatchObject({ backdrop: "none", imageUrl: "https://signed" });
    expect(presetToRender(up)).toMatchObject({ backdrop: "cube", imageUrl: null }); // URL 을 못 만들면 효과로 폴백
  });
});
