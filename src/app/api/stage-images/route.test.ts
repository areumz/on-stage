import { UPLOADS_PER_STUDIO } from "@/lib/stage/scene";
import { afterEach, describe, expect, it, vi } from "vitest";

const { authed } = vi.hoisted(() => ({ authed: vi.fn() }));
vi.mock("@/lib/director/http", async (orig) => ({ ...(await orig<typeof import("@/lib/director/http")>()), authed }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

import { DELETE, GET, POST } from "./route";

const FOLDER = "u1/studio";
type Cfg = { files?: string[]; listError?: boolean; removeError?: boolean; used?: { id: string; scene: unknown }[] };

function fake(cfg: Cfg = {}) {
  const log = { updates: [] as { v: unknown; eqs: string[] }[], removed: [] as string[], uploadPaths: [] as string[], lists: [] as string[], listOpts: [] as unknown[], filters: [] as string[], selectEqs: [] as string[] };
  const from = (table: string) => {
    let op = "select";
    let cur: { v: unknown; eqs: string[] } | null = null;
    const b: Record<string, unknown> = {
      select: () => b,
      update: (v: unknown) => ((op = "update"), (cur = { v, eqs: [] }), log.updates.push(cur), b),
      eq: (c: string, v: unknown) => (op === "update" ? cur!.eqs.push(`${c}=${v}`) : log.selectEqs.push(`${table} ${c}=${v}`), b),
      filter: (c: string, _o: string, v: string) => (log.filters.push(`${c}=${v}`), b),
      then: (res: (v: unknown) => unknown) => Promise.resolve({ data: op === "update" ? null : (cfg.used ?? []), error: null }).then(res),
    };
    return b;
  };
  const storage = {
    from: () => ({
      list: async (folder: string, opts: unknown) => {
        log.lists.push(folder);
        log.listOpts.push(opts);
        return cfg.listError ? { data: null, error: { message: "x" } } : { data: (cfg.files ?? []).map((name) => ({ name })), error: null };
      },
      remove: async (p: string[]) => (log.removed.push(...p), { data: [], error: cfg.removeError ? { message: "x" } : null }),
      createSignedUrls: async (ps: string[]) => ({ data: ps.map((p) => ({ path: p, signedUrl: `https://signed/${p}`, error: null })), error: null }),
      createSignedUploadUrl: async (p: string) => (log.uploadPaths.push(p), { data: { signedUrl: `https://up/${p}` }, error: null }),
    }),
  };
  authed.mockResolvedValue({ supabase: { from, storage }, user: { id: "u1" } });
  return log;
}

const req = (method: string, body?: unknown, url = "http://x/api/stage-images") =>
  new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }) as never;
afterEach(() => authed.mockReset());

describe("/api/stage-images", () => {
  it("로그인하지 않으면 401", async () => {
    authed.mockResolvedValue(null);
    expect([(await GET()).status, (await POST(req("POST", {}))).status, (await DELETE(req("DELETE"))).status]).toEqual([401, 401, 401]);
  });

  const many = (n: number) => Array.from({ length: n }, (_, i) => `f${i}.png`);
  it("GET: 내 studio 폴더만, 서명 URL, no-store, 상한까지 모두", async () => {
    const log = fake({ files: many(UPLOADS_PER_STUDIO + 2) });
    const res = await GET();
    const { images } = await res.json();
    expect(new Set(log.lists)).toEqual(new Set([FOLDER]));
    expect(log.listOpts[0]).toMatchObject({ sortBy: { column: "created_at", order: "desc" } });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(images).toHaveLength(UPLOADS_PER_STUDIO);
    expect(images[0]).toEqual({ path: `${FOLDER}/f0.png`, name: "f0.png", url: `https://signed/${FOLDER}/f0.png` });
  });

  it("GET: 목록 실패는 500", async () => {
    fake({ listError: true });
    expect((await GET()).status).toBe(500);
  });

  const post = async (body: unknown) => {
    const res = await POST(req("POST", body));
    return [res.status, await res.json()] as const;
  };
  it("POST: <uid>/studio/<uuid>.<ext> 로 업로드 URL 발급", async () => {
    const log = fake();
    const [status, body] = await post({ contentType: "image/png", size: 1000 });
    expect(status).toBe(201);
    expect(body.path).toMatch(/^u1\/studio\/[0-9a-f-]{36}\.png$/);
    expect(body.uploadUrl).toBe(`https://up/${body.path}`);
    expect(log.uploadPaths).toEqual([body.path]);
  });
  it.each([
    ["gif", { contentType: "image/gif", size: 10 }],
    ["5MB 초과", { contentType: "image/png", size: 5 * 1024 * 1024 + 1 }],
    ["0 바이트", { contentType: "image/png", size: 0 }],
    ["본문 없음", undefined],
  ])("POST: %s 는 400 invalid_image", async (_n, body) => {
    fake();
    expect(await post(body)).toEqual([400, { error: "invalid_image" }]);
  });
  it("POST: 이미 상한만큼 있으면 409 image_limit, 하나 모자라면 발급", async () => {
    fake({ files: many(UPLOADS_PER_STUDIO - 1) });
    expect((await post({ contentType: "image/png", size: 10 }))[0]).toBe(201);
    const log = fake({ files: many(UPLOADS_PER_STUDIO) });
    expect(await post({ contentType: "image/png", size: 10 })).toEqual([409, { error: "image_limit" }]);
    expect(log.uploadPaths).toEqual([]);
  });

  const del = (path: string) => DELETE(req("DELETE", undefined, `http://x/api/stage-images?path=${encodeURIComponent(path)}`));
  it.each([
    ["남의 폴더", "u2/studio/a.png"],
    ["연출 폴더", "u1/22222222-2222-4222-8222-222222222222/a.png"],
    ["traversal", `${FOLDER}/../u2/a.png`],
    ["하위 경로", `${FOLDER}/x/a.png`],
    ["폴더 자체", FOLDER],
  ])("DELETE: %s 는 400, 아무것도 건드리지 않는다", async (_n, path) => {
    const log = fake();
    const res = await del(path);
    expect([res.status, (await res.json()).error]).toEqual([400, "invalid_image"]);
    expect(log.removed).toEqual([]);
    expect(log.updates).toEqual([]);
  });
  it("DELETE: path 가 없으면 400", async () => {
    fake();
    expect((await DELETE(req("DELETE"))).status).toBe(400);
  });

  it("DELETE: 객체를 지우고, 그 이미지를 쓰던 내 프리셋은 image 만 null 로(다른 필드 보존)", async () => {
    const scene = { backdrop: "laser", dust: 5, image: { kind: "upload", path: `${FOLDER}/a.png` } };
    const log = fake({ used: [{ id: "p1", scene }] });
    expect(await (await del(`${FOLDER}/a.png`)).json()).toEqual({ ok: true });
    expect(log.selectEqs).toContain("stage_presets user_id=u1");
    expect(log.filters).toEqual([`scene->image->>path=${FOLDER}/a.png`]);
    expect(log.updates).toEqual([{ v: { scene: { backdrop: "laser", dust: 5, image: null } }, eqs: ["id=p1", "user_id=u1"] }]);
    expect(log.removed).toEqual([`${FOLDER}/a.png`]);
  });
  it("DELETE: 쓰는 프리셋이 없으면 update 없이 삭제만", async () => {
    const log = fake();
    await del(`${FOLDER}/a.png`);
    expect(log.updates).toEqual([]);
    expect(log.removed).toEqual([`${FOLDER}/a.png`]);
  });
  it("DELETE: remove 가 error 면 500", async () => {
    fake({ removeError: true });
    expect((await del(`${FOLDER}/a.png`)).status).toBe(500);
  });
});
