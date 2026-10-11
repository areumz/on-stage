import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/audio/signedUrl", () => ({ signAudioUrl: async () => "https://signed" }));

import { loadRunContext } from "./prepare";

// Python 계약은 presets[].state 만 안다. 프리셋에 scene 이 생겨도 그쪽으로 새면 안 된다.
describe("loadRunContext", () => {
  it("Python 에 보내는 presets 는 {name, state} 뿐이다", async () => {
    const rows: Record<string, unknown> = {
      artists: { id: "a", slug: "s", name: "N", color: "#ff0000", shader_pattern: "x" },
      stage_presets: [{ name: "p", state: { x: 1 }, scene: { backdrop: "laser" }, id: "i" }],
    };
    const b = (t: string) => {
      const q: Record<string, unknown> = { select: () => q, eq: () => q, single: async () => ({ data: rows[t] }), then: (r: (v: unknown) => unknown) => Promise.resolve({ data: rows[t] }).then(r) };
      return q;
    };
    const ctx = await loadRunContext({ from: b } as never, { artist_id: "a", storage_path: "p", title: "t", mood_keywords: [], analysis: {}, duration_sec: 10 } as never);
    for (const p of ctx!.presets) expect(Object.keys(p).sort()).toEqual(["name", "state"]);
    expect(ctx!.presets).toHaveLength(1);
  });
});
