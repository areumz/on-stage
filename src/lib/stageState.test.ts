import { describe, it, expect } from "vitest";
import { defaultStageState, parseStageState } from "./stageState";

const fallback = defaultStageState("#9F77DD");

describe("defaultStageState", () => {
  it("starts with left+center on, right off, front angle", () => {
    expect(defaultStageState("#D4537E")).toEqual({
      color: "#D4537E",
      spots: { left: true, center: true, right: false },
      angle: "front",
    });
  });
});

describe("parseStageState", () => {
  it("returns fallback when raw is null", () => {
    expect(parseStageState(null, fallback)).toBe(fallback);
  });

  it("restores a valid saved state", () => {
    const saved = { color: "#378ADD", spots: { left: false, center: true, right: true }, angle: "audience" as const };
    expect(parseStageState(JSON.stringify(saved), fallback)).toEqual(saved);
  });

  it("falls back on malformed JSON", () => {
    expect(parseStageState("{not valid json", fallback)).toBe(fallback);
  });

  it("falls back on a value with the wrong shape", () => {
    expect(parseStageState("null", fallback)).toBe(fallback);
    expect(parseStageState("[1,2,3]", fallback)).toBe(fallback);
    expect(parseStageState(JSON.stringify({ color: "#fff" }), fallback)).toBe(fallback);
  });

  it("falls back when spots has the wrong value types", () => {
    const bad = { color: "#fff", spots: { left: "yes", center: 1, right: null }, angle: "front" };
    expect(parseStageState(JSON.stringify(bad), fallback)).toBe(fallback);
  });

  it("falls back when angle isn't a known preset", () => {
    const bad = { color: "#fff", spots: { left: true, center: true, right: false }, angle: "diagonal" };
    expect(parseStageState(JSON.stringify(bad), fallback)).toBe(fallback);
  });
});
