import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabase } = vi.hoisted(() => ({ supabase: { from: vi.fn(), auth: { getUser: vi.fn() } } }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => supabase }));
vi.mock("@/lib/data", () => ({ getArtistId: async () => "artist-1" }));

import { GET, POST } from "./route";

let inserted: Record<string, unknown> | null;
beforeEach(() => {
  inserted = null;
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

const post = (body: unknown) => POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }));
function mockInsert() {
  supabase.from.mockReturnValue({
    insert: (row: Record<string, unknown>) => ((inserted = row), { select: () => ({ single: async () => ({ data: { id: "p1" }, error: null }) }) }),
  });
}

describe("stage-presets", () => {
  it("GET: scene 이 null 이면 null 그대로, 있으면 정리해서 내린다", async () => {
    const rows = [
      { id: "1", name: "a", state: {}, scene: null },
      { id: "2", name: "b", state: {}, scene: { backdrop: "bogus", dust: 500, props: ["mic", "x"] } },
    ];
    supabase.from.mockReturnValue({ select: () => ({ eq: () => ({ order: async () => ({ data: rows, error: null }) }) }) });
    const { presets } = await (await GET(new Request("http://x?artist=s"))).json();
    expect(presets[0].scene).toBeNull();
    expect(presets[1].scene).toEqual({ backdrop: "none", dust: 0, reflection: 0, props: ["mic"], image: null });
  });

  it("POST: scene 없는 기존 요청도 그대로 동작(scene 키 없음)", async () => {
    mockInsert();
    expect((await post({ artistSlug: "s", name: "n", state: { a: 1 } })).status).toBe(201);
    expect(inserted).toMatchObject({ state: { a: 1 } });
  });

  it("POST: overwrite 인데 scene 이 없으면 row 에 scene 키가 없다(기존 값 유지)", async () => {
    let row: Record<string, unknown> | null = null;
    supabase.from.mockReturnValue({
      upsert: (r: Record<string, unknown>) => ((row = r), { select: () => ({ single: async () => ({ data: { id: "p1" }, error: null }) }) }),
    });
    await post({ artistSlug: "s", name: "n", state: {}, overwrite: true });
    expect(row).not.toBeNull();
    expect("scene" in row!).toBe(false);
  });

  it.each([["배열", []], ["문자열", "x"]])("POST: scene 이 %s 이면 400 이 아니라 무시(키 제외)", async (_n, scene) => {
    mockInsert();
    expect((await post({ artistSlug: "s", name: "n", state: {}, scene })).status).toBe(201);
    expect("scene" in inserted!).toBe(false);
  });

  it("POST: scene 이 명시적 null 이면 null 로 저장", async () => {
    mockInsert();
    await post({ artistSlug: "s", name: "n", state: {}, scene: null });
    expect(inserted).toMatchObject({ scene: null });
  });

  it("POST: scene 은 parsePresetScene 으로 정리해 저장", async () => {
    mockInsert();
    await post({ artistSlug: "s", name: "n", state: {}, scene: { backdrop: "laser", dust: 40, reflection: 9, props: ["drum"], image: { kind: "sample", id: "galaxy" }, extra: 1 } });
    expect(inserted?.scene).toEqual({ backdrop: "laser", dust: 40, reflection: 9, props: ["drum"], image: { kind: "sample", id: "galaxy" } });
  });

  it("POST: 예전 sampleImage 도 image 로 읽어 저장", async () => {
    mockInsert();
    await post({ artistSlug: "s", name: "n", state: {}, scene: { sampleImage: "galaxy" } });
    expect((inserted?.scene as { image: unknown }).image).toEqual({ kind: "sample", id: "galaxy" });
  });

  const withImage = async (image: unknown) => {
    mockInsert();
    await post({ artistSlug: "s", name: "n", state: {}, scene: { image } });
    return (inserted?.scene as { image: unknown }).image;
  };
  it("POST: 내 studio 업로드 경로는 그대로 저장", async () => {
    const image = { kind: "upload", path: "u1/studio/a.png" };
    expect(await withImage(image)).toEqual(image);
  });
  it.each([
    ["남의 폴더", "u2/studio/a.png"],
    ["연출 폴더", "u1/22222222-2222-4222-8222-222222222222/a.png"],
    ["하위 경로", "u1/studio/x/a.png"],
    ["traversal", "u1/studio/../u2/a.png"],
    ["폴더 자체", "u1/studio"],
  ])("POST: 업로드 경로 %s 는 image=null 로 정리", async (_n, path) => {
    expect(await withImage({ kind: "upload", path })).toBeNull();
  });
});
