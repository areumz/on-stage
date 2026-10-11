import { UPLOADS_PER_SEQUENCE } from "@/lib/stage/scene";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authed, getRun } = vi.hoisted(() => ({ authed: vi.fn(), getRun: vi.fn() }));
vi.mock("@/lib/director/http", async (orig) => ({ ...(await orig<typeof import("@/lib/director/http")>()), authed }));
vi.mock("@/lib/python/client", async (orig) => ({ ...(await orig<typeof import("@/lib/python/client")>()), python: { getRun } }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

import { DELETE as deleteSequence, GET as getSequence } from "./[id]/route";
import { DELETE as deleteImage, GET as getImages, POST as postImage } from "./[id]/backdrop-images/route";
import { PATCH } from "./[id]/scene/route";

const ID = "11111111-1111-4111-8111-111111111111";
const FOLDER = `u1/${ID}`;
const ctx = { params: Promise.resolve({ id: ID }) } as never;

type Cfg = {
  row?: { status: string; items?: unknown[]; scene_edit?: unknown } | null;
  files?: string[];
  updated?: number; // update 가 돌려줄 행 수
  listError?: boolean;
  removeError?: boolean;
  deleteRows?: number; // 연출 delete 가 돌려줄 행 수(0 = 남의 연출)
};

// 쓰는 supabase 호출만 흉내 낸다. updates/removed 에 쓰기를 기록한다.
function fake(cfg: Cfg) {
  const log = {
    updates: [] as Record<string, unknown>[],
    removed: [] as string[],
    uploadPaths: [] as string[],
    eqs: [] as string[], // "<op> <col>=<val>" — fake 가 필터를 적용하진 않으니 쿼리에 쓰인 조건을 기록해 확인한다
    lists: [] as { folder: string; opts: { limit?: number; offset?: number; search?: string } }[],
  };
  const row = cfg.row === undefined ? { status: "approved", items: [{}, {}] } : cfg.row;
  const from = (table: string) => {
    let op = "select";
    const b: Record<string, unknown> = {
      select: () => b,
      update: (v: Record<string, unknown>) => {
        op = "update";
        log.updates.push(v);
        return b;
      },
      delete: () => ((op = "delete"), b),
      eq: (c: string, v: unknown) => (log.eqs.push(`${op} ${c}=${v}`), b),
      maybeSingle: async () => ({ data: row, error: null }),
      single: async () => ({ data: table === "audio_tracks" ? { duration_sec: 100, artist_id: "a" } : { color: "#ff0000" }, error: null }),
      then: (res: (v: unknown) => unknown) =>
        Promise.resolve({ data: Array.from({ length: op === "update" ? (cfg.updated ?? 1) : op === "delete" ? (cfg.deleteRows ?? 1) : row ? 1 : 0 }, () => ({ id: ID })), error: null }).then(res),
    };
    return b;
  };
  const storage = {
    from: () => ({
      list: async (folder: string, opts: { limit?: number; offset?: number; search?: string } = {}) => {
        log.lists.push({ folder, opts });
        if (cfg.listError) return { data: null, error: { message: "x" } };
        const all = (cfg.files ?? []).filter((n) => !opts.search || n.includes(opts.search));
        return { data: all.slice(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 100)).map((name) => ({ name })), error: null };
      },
      remove: async (paths: string[]) => (log.removed.push(...paths), { data: [], error: cfg.removeError ? { message: "x" } : null }),
      createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://signed/${p}` }, error: null }),
      createSignedUploadUrl: async (p: string) => (log.uploadPaths.push(p), { data: { signedUrl: `https://up/${p}` }, error: null }),
    }),
  };
  authed.mockResolvedValue({ supabase: { from, storage }, user: { id: "u1" } });
  return log;
}

const req = (method: string, body?: unknown, url = "http://x/api") =>
  new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }) as never;
const patch = async (edit: unknown) => {
  const res = await PATCH(req("PATCH", { edit }), ctx);
  return [res.status, await res.json()] as const;
};

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => {
  vi.restoreAllMocks();
  authed.mockReset();
  getRun.mockReset();
});

describe("PATCH /api/sequences/[id]/scene", () => {
  it("고친 값을 scene_edit 에만 저장한다(items·props 는 건드리지 않는다)", async () => {
    const log = fake({});
    const edit = { backdrop: { mode: "fx", fx: "laser" }, sections: [{ dust: 30 }, null], props: ["mic"] };
    const [status, body] = await patch(edit);
    expect(status).toBe(200);
    expect(body.sceneEdit.props).toEqual(["mic"]);
    expect(Object.keys(log.updates[0])).toEqual(["scene_edit"]);
  });

  it("update 는 id·status=approved 조건을 쓴다", async () => {
    const log = fake({});
    await patch({ props: [] });
    expect(log.eqs).toEqual(expect.arrayContaining([`update id=${ID}`, "update status=approved"]));
  });

  it("update 가 0행이면 404", async () => {
    fake({ updated: 0 });
    expect((await patch({ props: [] }))[0]).toBe(404);
  });

  it("edit 가 null 이면 scene_edit 를 null 로 되돌린다", async () => {
    const log = fake({});
    expect(await patch(null)).toEqual([200, { sceneEdit: null }]);
    expect(log.updates).toEqual([{ scene_edit: null }]);
  });

  it("초안은 409 not_approved, 저장하지 않는다", async () => {
    const log = fake({ row: { status: "draft", items: [] } });
    expect(await patch({ props: [] })).toEqual([409, { error: "not_approved" }]);
    expect(log.updates).toEqual([]);
  });

  it("내 연출이 아니면(행이 안 보이면) 404", async () => {
    fake({ row: null });
    expect((await patch({ props: [] }))[0]).toBe(404);
  });

  it("uuid 가 아니면 404", async () => {
    fake({});
    const res = await PATCH(req("PATCH", { edit: null }), { params: Promise.resolve({ id: "zz" }) } as never);
    expect(res.status).toBe(404);
  });

  it.each([
    ["본문에 edit 키가 없음", undefined],
    ["객체가 아님", "x"],
    ["빈 객체", {}],
    ["sections 길이가 items 와 다름", { sections: [null] }],
    ["props 가 배열이 아님", { props: "mic" }],
    ["props 에 모르는 키", { props: ["mic", "bogus"] }],
    ["sections 에 깨진 원소", { sections: [{ dust: 30 }, "x"] }],
    ["sections 에 빈 원소", { sections: [{ dust: 30 }, {}] }],
    ["backdrop 모양 오류", { backdrop: { mode: "fx", fx: "none" } }],
  ])("깨진 입력(%s)은 400 invalid_scene", async (_n, edit) => {
    const log = fake({});
    const res = await PATCH(req("PATCH", edit === undefined ? {} : { edit }), ctx);
    expect([res.status, (await res.json()).error]).toEqual([400, "invalid_scene"]);
    expect(log.updates).toEqual([]);
  });

  const upload = (path: string) => ({ backdrop: { mode: "image", image: { kind: "upload", path } } });
  it("내 폴더에 실제로 있는 업로드 이미지는 저장된다", async () => {
    fake({ files: ["a.png"] });
    expect((await patch(upload(`${FOLDER}/a.png`)))[0]).toBe(200);
  });
  it("업로드 존재 확인은 내 폴더에서 정확한 파일명으로 찾는다", async () => {
    const log = fake({ files: ["a.png"] });
    await patch(upload(`${FOLDER}/a.png`));
    expect(log.lists[0]).toMatchObject({ folder: FOLDER, opts: { search: "a.png" } });
  });
  it("목록 조회가 실패하면 400 이 아니라 500", async () => {
    fake({ files: ["a.png"], listError: true });
    expect((await patch(upload(`${FOLDER}/a.png`)))[0]).toBe(500);
  });
  it("폴더에 파일이 많아도(상한 밖) 이름으로 찾는다", async () => {
    fake({ files: ["1.png", "2.png", "3.png", "4.png", "5.png", "6.png", "7.png", "8.png", "z.png"] });
    expect((await patch(upload(`${FOLDER}/z.png`)))[0]).toBe(200);
  });
  it.each([
    ["남의 폴더", `u2/${ID}/a.png`],
    ["다른 연출 폴더", `u1/22222222-2222-4222-8222-222222222222/a.png`],
    ["path traversal", `${FOLDER}/../u2/a.png`],
    ["하위 경로", `${FOLDER}/x/a.png`],
    ["객체가 없음", `${FOLDER}/none.png`],
  ])("업로드 경로 거부: %s", async (_n, path) => {
    const log = fake({ files: ["a.png"] });
    const res = await PATCH(req("PATCH", { edit: upload(path) }), ctx);
    expect([res.status, (await res.json()).error]).toEqual([400, "invalid_scene"]);
    expect(log.updates).toEqual([]);
  });
});

describe("backdrop-images", () => {
  const post = async (body: unknown) => {
    const res = await postImage(req("POST", body), ctx);
    return [res.status, await res.json()] as const;
  };

  const many = (n: number) => Array.from({ length: n }, (_, i) => `f${i}.png`);
  it("GET: 서명 URL 목록, no-store, 상한까지 모두", async () => {
    fake({ files: many(UPLOADS_PER_SEQUENCE + 2) });
    const res = await getImages(req("GET"), ctx);
    const { images } = await res.json();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(images).toHaveLength(UPLOADS_PER_SEQUENCE);
    expect(images[0]).toEqual({ path: `${FOLDER}/f0.png`, name: "f0.png", url: `https://signed/${FOLDER}/f0.png` });
  });

  it("POST: 내 폴더 경로로 업로드 URL 을 발급한다", async () => {
    const log = fake({});
    const [status, body] = await post({ contentType: "image/webp", size: 1000 });
    expect(status).toBe(201);
    expect(body.path).toMatch(new RegExp(`^${FOLDER}/[0-9a-f-]{36}\\.webp$`));
    expect(log.uploadPaths).toEqual([body.path]);
  });

  it.each([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]])("POST: 확장자는 contentType(%s)에서만 만든다 -> %s", async (contentType, ext) => {
    fake({});
    const [, body] = await post({ contentType, size: 10, filename: "evil.exe" });
    expect(body.path.endsWith(`.${ext}`)).toBe(true);
  });

  it.each([
    ["gif", { contentType: "image/gif", size: 10 }],
    ["5MB 초과", { contentType: "image/png", size: 5 * 1024 * 1024 + 1 }],
    ["0 바이트", { contentType: "image/png", size: 0 }],
    ["size 없음", { contentType: "image/png" }],
  ])("POST: %s 는 400 invalid_image", async (_n, body) => {
    fake({});
    expect(await post(body)).toEqual([400, { error: "invalid_image" }]);
  });

  it("POST: 이미 상한만큼 있으면 409 image_limit, 하나 모자라면 발급", async () => {
    fake({ files: many(UPLOADS_PER_SEQUENCE - 1) });
    expect((await post({ contentType: "image/png", size: 10 }))[0]).toBe(201);
    const log = fake({ files: many(UPLOADS_PER_SEQUENCE) });
    expect(await post({ contentType: "image/png", size: 10 })).toEqual([409, { error: "image_limit" }]);
    expect(log.uploadPaths).toEqual([]);
  });

  it("POST: 초안은 409 not_approved", async () => {
    fake({ row: { status: "draft" } });
    expect(await post({ contentType: "image/png", size: 10 })).toEqual([409, { error: "not_approved" }]);
  });

  const del = (path: string) => deleteImage(req("DELETE", undefined, `http://x/api?path=${encodeURIComponent(path)}`), ctx);

  it("DELETE: 그 이미지를 쓰던 배경은 auto 로 되돌린다", async () => {
    const log = fake({
      files: ["a.png"],
      row: { status: "approved", items: [{}], scene_edit: { props: ["amp"], backdrop: { mode: "image", image: { kind: "upload", path: `${FOLDER}/a.png` } } } },
    });
    expect(await (await del(`${FOLDER}/a.png`)).json()).toEqual({ ok: true });
    expect(log.updates).toEqual([{ scene_edit: { props: ["amp"], backdrop: { mode: "auto" } } }]);
    expect(log.removed).toEqual([`${FOLDER}/a.png`]);
  });

  it("DELETE: 참조 해제는 id·approved·user_id 조건이고 깨진 sections 도 그대로 둔다", async () => {
    const broken = [{ dust: 1 }]; // items 길이(1)와 같지만 파서가 모르는 모양이어도 원본을 유지한다는 점을 확인
    const log = fake({
      row: { status: "approved", items: [{}], scene_edit: { sections: broken, junk: 1, backdrop: { mode: "image", image: { kind: "upload", path: `${FOLDER}/a.png` } } } },
    });
    await del(`${FOLDER}/a.png`);
    expect(log.updates[0]).toEqual({ scene_edit: { sections: broken, junk: 1, backdrop: { mode: "auto" } } });
    expect(log.eqs).toEqual(expect.arrayContaining([`update id=${ID}`, "update status=approved", "update user_id=u1"]));
  });

  it("DELETE: 다른 이미지를 쓰고 있으면 scene_edit 는 그대로", async () => {
    const log = fake({ row: { status: "approved", items: [{}], scene_edit: { backdrop: { mode: "image", image: { kind: "upload", path: `${FOLDER}/b.png` } } } } });
    await del(`${FOLDER}/a.png`);
    expect(log.updates).toEqual([]);
    expect(log.removed).toEqual([`${FOLDER}/a.png`]);
  });

  it.each([["남의 폴더", `u2/${ID}/a.png`], ["traversal", `${FOLDER}/../a.png`], ["폴더 자체", FOLDER]])("DELETE: %s 는 400, 아무것도 지우지 않는다", async (_n, path) => {
    const log = fake({});
    const res = await del(path);
    expect([res.status, (await res.json()).error]).toEqual([400, "invalid_image"]);
    expect(log.removed).toEqual([]);
  });
});

describe("DELETE /api/sequences/[id]", () => {
  it("남의 연출(지운 행이 없음)이면 이미지를 건드리지 않는다", async () => {
    const log = fake({ files: ["a.png"], deleteRows: 0 });
    expect((await deleteSequence(req("DELETE"), ctx)).status).toBe(403);
    expect(log.lists).toEqual([]);
    expect(log.removed).toEqual([]);
  });

  it("remove 가 error 를 돌려줘도 204", async () => {
    fake({ files: ["a.png"], removeError: true });
    expect((await deleteSequence(req("DELETE"), ctx)).status).toBe(204);
  });

  it("목록 조회가 실패해도(null) 204, 지우지 않는다", async () => {
    const log = fake({ listError: true });
    expect((await deleteSequence(req("DELETE"), ctx)).status).toBe(204);
    expect(log.removed).toEqual([]);
  });

  it("100개를 넘는 폴더도 페이지를 넘겨 모두 지운다", async () => {
    const files = Array.from({ length: 250 }, (_, i) => `f${i}.png`);
    const log = fake({ files });
    await deleteSequence(req("DELETE"), ctx);
    expect(log.removed).toHaveLength(250);
    expect(log.lists.map((l) => l.opts.offset)).toEqual([0, 100, 200]);
    expect(log.lists.every((l) => l.folder === FOLDER)).toBe(true);
  });

  it("연출을 지우면 그 폴더의 배경 이미지도 지운다", async () => {
    const log = fake({ files: ["a.png", "b.png"] });
    expect((await deleteSequence(req("DELETE"), ctx)).status).toBe(204);
    expect(log.removed).toEqual([`${FOLDER}/a.png`, `${FOLDER}/b.png`]);
  });

  it("이미지 삭제가 실패해도 삭제 응답은 성공", async () => {
    fake({ files: ["a.png"] });
    const { supabase } = await authed();
    supabase.storage.from = () => ({ list: async () => { throw new Error("boom"); } });
    expect((await deleteSequence(req("DELETE"), ctx)).status).toBe(204);
  });
});

describe("승인 저장(saveApproved)이 props 를 그대로 저장한다", () => {
  const item = { sectionLabel: "A", startSec: 0, endSec: 100, transitionMs: 0, state: {}, rationale: "" };
  async function approve(props: unknown) {
    const log = fake({ row: { status: "draft", items: [] } });
    getRun.mockResolvedValue({ status: "done", result: { items: [item], props } });
    const res = await getSequence(req("GET"), ctx);
    return { res, update: log.updates[0] };
  }
  it.each([[["guitar"]], [["guitar", "x"]]])("아는 키가 없는 비어 있지 않은 배열 %j 은 null", async (props) => {
    expect((await approve(props)).update.props).toBeNull();
  });
  it("아는 키와 모르는 키가 섞이면 아는 키만", async () => {
    expect((await approve(["mic", "guitar"])).update.props).toEqual(["mic"]);
  });
  it.each([[null], [[]], [["drum", "mic"]], [undefined]])("props=%j", async (props) => {
    const { update } = await approve(props);
    expect(update).toBeDefined();
    expect(update.props).toEqual(props === undefined ? null : props);
    // null 과 [] 를 구별하는 게 요점
    if (Array.isArray(props)) expect(Array.isArray(update.props)).toBe(true);
  });
});
