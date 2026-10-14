import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PythonError } from "@/lib/python/client";

// vi.mock 은 파일 맨 위로 끌어올려지므로, 팩토리가 쓰는 mock 도 vi.hoisted 로 같이 올린다
const { authed, startRun, loadRunContext } = vi.hoisted(() => ({
  authed: vi.fn(),
  startRun: vi.fn(),
  loadRunContext: vi.fn(),
}));

vi.mock("@/lib/director/http", async (orig) => ({ ...(await orig<typeof import("@/lib/director/http")>()), authed }));
vi.mock("@/lib/python/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/python/client")>()),
  python: { startRun },
}));
vi.mock("@/lib/director/prepare", () => ({ loadRunContext }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

import { POST } from "./route";

type Cfg = {
  track?: unknown;
  trackError?: boolean;
  approved?: number | null;
  insertError?: { code: string };
  existingDraftId?: string;
  claim?: boolean | null;
  claimError?: boolean;
};

// POST /api/sequences 가 쓰는 supabase 호출만 흉내 낸다. calls 에 순서대로 기록한다.
function fakeSupabase(cfg: Cfg, calls: string[]) {
  const builder = (table: string) => {
    let op: "select" | "insert" | "delete" = "select";
    let counting = false;
    const result = () => {
      if (table === "audio_tracks") return { data: cfg.track ?? null, error: cfg.trackError ? { message: "x" } : null };
      if (op === "insert") {
        calls.push("insert");
        return cfg.insertError ? { data: null, error: cfg.insertError } : { data: { id: "draft-1" }, error: null };
      }
      if (op === "delete") {
        calls.push("delete");
        return { data: null, error: null };
      }
      if (counting) return { count: cfg.approved === undefined ? 0 : cfg.approved, error: null };
      return { data: cfg.existingDraftId ? { id: cfg.existingDraftId } : null, error: null };
    };
    const b: Record<string, unknown> = {
      select: (_c?: string, o?: { count?: string }) => {
        if (o?.count) counting = true;
        return b;
      },
      insert: () => {
        op = "insert";
        return b;
      },
      delete: () => {
        op = "delete";
        return b;
      },
      eq: () => b,
      maybeSingle: async () => result(),
      single: async () => result(),
      then: (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res),
    };
    return b;
  };
  return {
    from: builder,
    rpc: async (name: string, args: { p_limit: number }) => {
      calls.push(`rpc ${name} ${args.p_limit}`);
      return cfg.claimError ? { data: null, error: { code: "x" } } : { data: cfg.claim === undefined ? true : cfg.claim, error: null };
    },
  };
}

const TRACK_ID = "11111111-1111-4111-8111-111111111111";
const doneTrack = { id: TRACK_ID, analysis_status: "done", analysis: { durationSec: 100 } };
const context = { ctx: true };

function call(audioTrackId: string = TRACK_ID) {
  return POST(new Request("http://x/api/sequences", { method: "POST", body: JSON.stringify({ audioTrackId }) }) as never);
}

let calls: string[];
function setup(cfg: Cfg = {}) {
  calls = [];
  authed.mockResolvedValue({ supabase: fakeSupabase({ track: doneTrack, ...cfg }, calls), user: { id: "u1" } });
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  loadRunContext.mockResolvedValue(context);
  startRun.mockResolvedValue({ status: "queued" });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  authed.mockReset();
  startRun.mockReset();
  loadRunContext.mockReset();
});

describe("POST /api/sequences", () => {
  it("로그인하지 않았으면 401", async () => {
    authed.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  // uuid 가 아닌 값을 DB 에 넘기면 Postgres 오류가 나서 500 이 된다. 앞에서 400 으로 거른다.
  it("곡 id 가 uuid 가 아니면 400, DB 는 건드리지 않는다", async () => {
    setup();
    const res = await call("not-a-uuid");
    expect([res.status, (await res.json()).error]).toEqual([400, "bad_request"]);
    expect(calls).toEqual([]);
  });

  it("분석이 끝나지 않은 곡은 409 analysis_not_ready, 아무것도 만들지 않는다", async () => {
    setup({ track: { ...doneTrack, analysis_status: "running" } });
    const res = await call();
    expect([res.status, (await res.json()).error]).toEqual([409, "analysis_not_ready"]);
    expect(calls).toEqual([]);
  });

  it("곡당 승인본이 5개면 409 approved_limit, 초안도 한도 차감도 없다", async () => {
    setup({ approved: 5 });
    const res = await call();
    expect([res.status, (await res.json()).error]).toEqual([409, "approved_limit"]);
    expect(calls).toEqual([]);
  });

  // 조회가 실패했을 때 한도를 열어 두면 안 된다
  it("승인본 수를 못 세면 500 으로 막는다", async () => {
    setup({ approved: null });
    expect((await call()).status).toBe(500);
    expect(calls).toEqual([]);
  });

  it("조회 오류는 404 가 아니라 500", async () => {
    setup({ trackError: true });
    expect((await call()).status).toBe(500);
  });

  // 이미 초안이 있는 요청이 하루 횟수를 쓰면 안 된다
  it("같은 곡에 초안이 있으면 409 draft_exists 와 그 id, 하루 한도는 건드리지 않는다", async () => {
    setup({ insertError: { code: "23505" }, existingDraftId: "old-draft" });
    const res = await call();
    expect([res.status, await res.json()]).toEqual([409, { error: "draft_exists", draftId: "old-draft" }]);
    expect(calls).toEqual(["insert"]);
    expect(startRun).not.toHaveBeenCalled();
  });

  it("하루 한도를 넘으면 429 daily_limit, 예약한 초안을 지우고 Python 은 부르지 않는다", async () => {
    setup({ claim: false });
    const res = await call();
    expect([res.status, (await res.json()).error]).toEqual([429, "daily_limit"]);
    expect(calls).toEqual(["insert", "rpc claim_daily_run 5", "delete"]);
    expect(startRun).not.toHaveBeenCalled();
  });

  it("한도 값은 DAILY_RUN_LIMIT 환경변수를 따른다", async () => {
    vi.stubEnv("DAILY_RUN_LIMIT", "7");
    setup();
    await call();
    expect(calls).toContain("rpc claim_daily_run 7");
  });

  // 보낼 값을 못 모으는 실패는 하루 횟수를 쓰기 전에 일어나야 한다
  it("context 를 못 만들면 500, 한도는 차감하지 않고 초안만 되돌린다", async () => {
    loadRunContext.mockResolvedValue(null);
    setup();
    expect((await call()).status).toBe(500);
    expect(calls).toEqual(["insert", "delete"]);
  });

  it("claim 호출이 오류면 500 으로 막고 초안을 되돌린다", async () => {
    setup({ claimError: true });
    expect((await call()).status).toBe(500);
    expect(calls).toEqual(["insert", "rpc claim_daily_run 5", "delete"]);
  });

  // 알려진 허용 사항: 차감 뒤 Python 호출이 실패해도 횟수는 돌려주지 않는다 (환불 함수는 한도 우회 경로가 된다)
  it("Python 시작이 실패하면 502, 초안은 되돌리지만 하루 횟수는 이미 쓴 상태", async () => {
    startRun.mockRejectedValue(new PythonError(502, "connection_failed"));
    setup();
    const res = await call();
    expect([res.status, (await res.json()).error]).toEqual([502, "connection_failed"]);
    expect(calls).toEqual(["insert", "rpc claim_daily_run 5", "delete"]);
  });

  it("성공하면 201 과 초안 id, 순서는 초안 예약 → 한도 → Python", async () => {
    setup();
    const res = await call();
    expect([res.status, await res.json()]).toEqual([201, { id: "draft-1", status: "queued" }]);
    expect(calls).toEqual(["insert", "rpc claim_daily_run 5"]);
    expect(startRun).toHaveBeenCalledWith("draft-1", context);
  });
});
