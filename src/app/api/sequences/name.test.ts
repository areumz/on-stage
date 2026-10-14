import { afterEach, describe, expect, it, vi } from "vitest";

const { authed, resume, createServerSupabase } = vi.hoisted(() => ({ authed: vi.fn(), resume: vi.fn(), createServerSupabase: vi.fn() }));
vi.mock("@/lib/director/http", async (orig) => ({ ...(await orig<typeof import("@/lib/director/http")>()), authed }));
vi.mock("@/lib/python/client", async (orig) => ({ ...(await orig<typeof import("@/lib/python/client")>()), python: { resume } }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase }));

import { getSequences } from "@/lib/director/data";
import { PATCH } from "./[id]/name/route";
import { POST as resumePost } from "./[id]/resume/route";

const ID = "11111111-1111-4111-8111-111111111111";
const ctx = { params: Promise.resolve({ id: ID }) } as never;

type Cfg = { rows?: number; seq?: { status: string; feedback_count: number } | null; updateError?: boolean };
function fake(cfg: Cfg = {}) {
  const log = { updates: [] as unknown[], eqs: [] as string[] };
  const from = () => {
    let op = "select";
    const b: Record<string, unknown> = {
      select: () => b,
      update: (v: unknown) => ((op = "update"), log.updates.push(v), b),
      eq: (c: string, v: unknown) => (log.eqs.push(`${op} ${c}=${v}`), b),
      maybeSingle: async () => ({ data: cfg.seq === undefined ? { status: "draft", feedback_count: 0 } : cfg.seq, error: null }),
      then: (res: (v: unknown) => unknown) =>
        Promise.resolve(
          op === "update" ? { data: Array.from({ length: cfg.rows ?? 1 }, () => ({ id: ID })), error: cfg.updateError ? { code: "x" } : null } : { data: null, error: null },
        ).then(res),
    };
    return b;
  };
  authed.mockResolvedValue({ supabase: { from }, user: { id: "u1" } });
  return log;
}
const req = (body?: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) }) as never;
afterEach(() => {
  authed.mockReset();
  resume.mockReset();
  vi.restoreAllMocks();
});

describe("PATCH /api/sequences/[id]/name", () => {
  const patch = async (body: unknown, c = ctx) => {
    const res = await PATCH(req(body), c);
    return [res.status, await res.json()] as const;
  };

  it("정리한 이름을 저장하고 돌려준다(id·user_id 조건)", async () => {
    const log = fake();
    expect(await patch({ name: "  내   첫\t무대 " })).toEqual([200, { name: "내 첫 무대" }]);
    expect(log.updates).toEqual([{ name: "내 첫 무대" }]);
    expect(log.eqs).toEqual([`update id=${ID}`, "update user_id=u1"]);
  });
  it.each([[null], ["   "], [""]])("%j 는 기본 이름으로(null 저장)", async (name) => {
    const log = fake();
    expect(await patch({ name })).toEqual([200, { name: null }]);
    expect(log.updates).toEqual([{ name: null }]);
  });
  it("40자는 통과, 41자는 400 invalid_name", async () => {
    fake();
    expect((await patch({ name: "가".repeat(40) }))[0]).toBe(200);
    expect(await patch({ name: "가".repeat(41) })).toEqual([400, { error: "invalid_name" }]);
  });
  it.each([[123], [{}], [["a"]], [undefined]])("문자열이 아닌 %j 는 400", async (name) => {
    const log = fake();
    expect((await patch({ name }))[0]).toBe(400);
    expect(log.updates).toEqual([]);
  });
  it("name 키가 없거나 본문이 없으면 400", async () => {
    fake();
    expect((await patch({}))[0]).toBe(400);
    expect((await PATCH(new Request("http://x", { method: "PATCH" }) as never, ctx)).status).toBe(400);
  });
  it("남의 연출(0행)은 404", async () => {
    fake({ rows: 0 });
    expect(await patch({ name: "a" })).toEqual([404, { error: "not_found" }]);
  });
  it("uuid 가 아니면 404, 로그인 안 했으면 401", async () => {
    fake();
    expect((await patch({ name: "a" }, { params: Promise.resolve({ id: "zz" }) } as never))[0]).toBe(404);
    authed.mockResolvedValue(null);
    expect((await patch({ name: "a" }))[0]).toBe(401);
  });
});

describe("POST /api/sequences/[id]/resume — 승인 때 이름", () => {
  const approve = (extra: object = {}) => resumePost(req({ interruptId: "t:0:approve", kind: "approve", ...extra }), ctx);
  const ok = () => resume.mockResolvedValue({ status: "running" });

  it("이름을 초안 행에 저장하고, Python 으로 가는 본문에는 name 이 없다", async () => {
    const log = fake();
    ok();
    const res = await approve({ name: "  라이브 무대 " });
    expect(res.status).toBe(202);
    expect(resume).toHaveBeenCalledWith(ID, { interruptId: "t:0:approve", kind: "approve" });
    expect(log.updates).toEqual([{ name: "라이브 무대" }]);
    expect(log.eqs).toEqual(expect.arrayContaining([`update id=${ID}`, "update user_id=u1"]));
  });
  it("name 을 보내지 않으면 행을 건드리지 않는다", async () => {
    const log = fake();
    ok();
    await approve();
    expect(log.updates).toEqual([]);
  });
  it("name 이 null 이면 null 저장", async () => {
    const log = fake();
    ok();
    await approve({ name: null });
    expect(log.updates).toEqual([{ name: null }]);
  });
  it.each([["가".repeat(41)], [5]])("잘못된 이름(%j)은 Python 을 부르기 전에 400 invalid_name", async (name) => {
    const log = fake();
    ok();
    const res = await approve({ name });
    expect([res.status, (await res.json()).error]).toEqual([400, "invalid_name"]);
    expect(resume).not.toHaveBeenCalled();
    expect(log.updates).toEqual([]);
  });
  it("Python 이 거절하면 이름도 저장하지 않는다", async () => {
    const { PythonError } = await import("@/lib/python/client");
    const log = fake();
    resume.mockRejectedValue(new PythonError(409, "stale_interrupt"));
    expect((await approve({ name: "a" })).status).toBe(409);
    expect(log.updates).toEqual([]);
  });
  it("이름 저장이 실패해도 승인은 202", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fake({ updateError: true });
    ok();
    expect((await approve({ name: "a" })).status).toBe(202);
  });
  it("다시 생성(feedback)에 name 이 섞여 와도 무시", async () => {
    const log = fake();
    ok();
    resume.mockResolvedValue({ status: "running" });
    await resumePost(req({ interruptId: "i", kind: "feedback", payload: { text: "x", targets: [0] }, name: "a" }), ctx);
    expect(log.updates).toEqual([]);
  });
});

describe("getSequences", () => {
  it("name 을 SequenceSummary 에 채운다(없으면 null)", async () => {
    const rows = [
      { id: "1", audio_track_id: "t", name: "내 이름", status: "approved", items: [{}], feedback_count: 0, approved_at: null, created_at: "2026-10-12T00:00:00Z", audio_tracks: { title: "곡" } },
      { id: "2", audio_track_id: "t", status: "draft", items: null, feedback_count: 0, approved_at: null, created_at: "2026-10-12T00:00:00Z", audio_tracks: { title: "곡" } },
    ];
    let selected = "";
    createServerSupabase.mockResolvedValue({
      from: () => ({ select: (c: string) => ((selected = c), { order: async () => ({ data: rows, error: null }) }) }),
    });
    const out = await getSequences();
    expect(selected).toContain("name");
    expect(out.map((s) => s.name)).toEqual(["내 이름", null]);
  });
});
