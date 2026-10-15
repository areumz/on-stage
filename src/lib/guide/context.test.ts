// src/lib/guide/context.test.ts
import { describe, it, expect } from "vitest";
import { contextFromPath } from "./context";

describe("contextFromPath", () => {
  it("/ 는 orbit", () => {
    expect(contextFromPath("/", null)).toEqual({ view: "orbit" });
  });
  it("아티스트 페이지는 tour + slug, section이 있으면 포함", () => {
    expect(contextFromPath("/artists/aurora", null)).toEqual({ view: "tour", slug: "aurora" });
    expect(contextFromPath("/artists/aurora", "album")).toEqual({ view: "tour", slug: "aurora", section: "album" });
  });
  it("끝 슬래시를 허용한다", () => {
    expect(contextFromPath("/artists/nova/", null)).toEqual({ view: "tour", slug: "nova" });
  });
  it("그 밖의 경로는 null", () => {
    expect(contextFromPath("/staff/dashboard", null)).toBeNull();
    expect(contextFromPath("/artists", null)).toBeNull();
  });
  it("orbit에는 section을 붙이지 않는다", () => {
    expect(contextFromPath("/", "tour")).toEqual({ view: "orbit" });
  });
});
