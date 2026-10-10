import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PythonError } from "@/lib/python/client";

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

import { pythonFailure } from "./http";

async function out(e: unknown) {
  const r = pythonFailure(e);
  return { status: r.status, body: await r.json() };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("pythonFailure", () => {
  it("설정이 없으면 일반 오류로 보이고 원인은 숨긴다", async () => {
    expect(await out(new PythonError(500, "not_configured"))).toEqual({ status: 500, body: { error: "internal_error" } });
  });

  it("bad_gateway 와 connection_failed 는 연결 실패 문구", async () => {
    expect(await out(new PythonError(502, "bad_gateway"))).toEqual({ status: 502, body: { error: "connection_failed" } });
    expect(await out(new PythonError(502, "connection_failed"))).toEqual({ status: 502, body: { error: "connection_failed" } });
  });

  it("구간·대상 규칙 위반은 Python 의 message 를 그대로 보여 준다", async () => {
    expect(await out(new PythonError(422, "invalid_sections", "구간은 8초 이상"))).toEqual({
      status: 422,
      body: { error: "invalid_sections", message: "구간은 8초 이상" },
    });
    expect(await out(new PythonError(422, "invalid_targets", "범위 밖"))).toMatchObject({ body: { message: "범위 밖" } });
  });

  // 서명 URL 이 message 에 담겨 브라우저로 나가면 안 된다. 사용자가 고칠 수 있는 오류도 아니다.
  it("invalid_audio_url 은 message 없이 일반 오류로 바꾼다", async () => {
    expect(await out(new PythonError(422, "invalid_audio_url", "https://x/?token=SECRET"))).toEqual({
      status: 500,
      body: { error: "internal_error" },
    });
  });

  it("본문 모양 오류(invalid_request)도 일반 오류", async () => {
    expect(await out(new PythonError(422, "invalid_request"))).toEqual({ status: 500, body: { error: "internal_error" } });
  });

  it("message 를 허용하지 않는 코드는 message 를 버린다", async () => {
    expect(await out(new PythonError(409, "stale_interrupt", "내부 설명"))).toEqual({ status: 409, body: { error: "stale_interrupt" } });
  });

  it("알 수 없는 예외는 500 이고 예외 내용을 응답에 싣지 않는다", async () => {
    const r = await out(new Error("db password is hunter2"));
    expect(r).toEqual({ status: 500, body: { error: "internal_error" } });
  });
});
