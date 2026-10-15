// src/lib/guide/actions.test.ts
import { describe, it, expect } from "vitest";
import { planAction } from "./actions";

const known = ["aurora", "nova"];
const orbit = { view: "orbit" as const };
const tour = (slug: string) => ({ view: "tour" as const, slug });

describe("planAction", () => {
  it("모르는 slug는 none", () => {
    expect(planAction({ type: "focusArtist", slug: "ghost" }, orbit, known)).toEqual({ kind: "none" });
    expect(planAction({ type: "openTour", slug: "ghost" }, orbit, known)).toEqual({ kind: "none" });
  });

  it("궤도에서 focusArtist는 focus", () => {
    expect(planAction({ type: "focusArtist", slug: "nova" }, orbit, known)).toEqual({ kind: "focus", slug: "nova" });
  });

  it("아티스트 페이지에서 focusArtist는 궤도로 돌아가 focus", () => {
    expect(planAction({ type: "focusArtist", slug: "nova" }, tour("aurora"), known)).toEqual({ kind: "gotoOrbit", slug: "nova" });
  });

  it("궤도에서 openTour는 focus 후 투어 섹션으로 이동", () => {
    expect(planAction({ type: "openTour", slug: "nova" }, orbit, known)).toEqual({
      kind: "navigate",
      path: "/artists/nova#tour",
      focusSlug: "nova",
    });
  });

  it("같은 아티스트 페이지에서는 스크롤", () => {
    expect(planAction({ type: "openTour", slug: "nova" }, tour("nova"), known)).toEqual({ kind: "scroll", section: "tour" });
    expect(planAction({ type: "openTour", slug: "nova", section: "album" }, tour("nova"), known)).toEqual({
      kind: "scroll",
      section: "album",
    });
  });

  it("다른 아티스트 페이지에서는 이동 (focus 연출 없음)", () => {
    expect(planAction({ type: "openTour", slug: "nova" }, tour("aurora"), known)).toEqual({
      kind: "navigate",
      path: "/artists/nova#tour",
    });
  });

  it("모르는 section은 tour로, hero는 해시 없이 이동", () => {
    expect(planAction({ type: "openTour", slug: "nova", section: "zzz" }, orbit, known)).toMatchObject({
      path: "/artists/nova#tour",
    });
    expect(planAction({ type: "openTour", slug: "nova", section: "hero" }, tour("aurora"), known)).toEqual({
      kind: "navigate",
      path: "/artists/nova",
    });
  });

  it("highlightCity는 아직 처리하지 않는다", () => {
    expect(planAction({ type: "highlightCity", slug: "nova", city: "SEO" }, orbit, known)).toEqual({ kind: "none" });
  });

  it("context가 없으면(알 수 없는 화면) 이동 계열은 none", () => {
    expect(planAction({ type: "openTour", slug: "nova" }, null, known)).toEqual({ kind: "none" });
  });
});
