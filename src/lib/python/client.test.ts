import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PythonError, pythonFetch } from "./client";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("PYTHON_SERVICE_URL", "https://python.example.test");
  vi.stubEnv("INTERNAL_API_KEY", "test-key");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function failure(): Promise<PythonError> {
  try {
    await pythonFetch("/x");
  } catch (e) {
    return e as PythonError;
  }
  throw new Error("expected failure");
}

describe("pythonFetch", () => {
  it("키 헤더와 JSON 본문을 보내고 응답을 돌려준다", async () => {
    fetchMock.mockResolvedValue(json({ ok: 1 }));
    const out = await pythonFetch("/runs", { method: "POST", body: { a: 1 } });
    expect(out).toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://python.example.test/runs");
    expect(init.headers["X-Internal-Key"]).toBe("test-key");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe('{"a":1}');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  // /health 는 키가 필요 없다. 필요 없는 곳에 키를 보내지 않는다.
  it("auth: false 면 키 헤더를 보내지 않고 키가 없어도 된다", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "");
    fetchMock.mockResolvedValue(json({ status: "ok" }));
    await pythonFetch("/health", { auth: false });
    expect(fetchMock.mock.calls[0][1].headers["X-Internal-Key"]).toBeUndefined();
  });

  it("환경변수가 없으면 호출 없이 not_configured", async () => {
    vi.stubEnv("PYTHON_SERVICE_URL", "");
    const e = await failure();
    expect(e.code).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("연결 실패·시간 초과는 502 connection_failed", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const e = await failure();
    expect([e.status, e.code]).toEqual([502, "connection_failed"]);
  });

  it("detail 코드와 message 를 그대로 전달한다", async () => {
    fetchMock.mockResolvedValue(json({ detail: "invalid_sections", message: "구간은 8초 이상" }, 422));
    const e = await failure();
    expect([e.status, e.code, e.detail]).toEqual([422, "invalid_sections", "구간은 8초 이상"]);
  });

  it("409 stale_interrupt 는 상태를 유지한다", async () => {
    fetchMock.mockResolvedValue(json({ detail: "stale_interrupt" }, 409));
    const e = await failure();
    expect([e.status, e.code]).toEqual([409, "stale_interrupt"]);
  });

  // 키가 틀린 건 우리 설정 문제다. 사용자에게는 일반 오류로 보이고 원인은 서버 로그에만 남긴다.
  it("401 은 500 internal_error 로 바꾼다", async () => {
    fetchMock.mockResolvedValue(json({ detail: "unauthorized" }, 401));
    const e = await failure();
    expect([e.status, e.code]).toEqual([500, "internal_error"]);
  });

  it("5xx 와 JSON 이 아닌 응답은 502", async () => {
    fetchMock.mockResolvedValue(new Response("<html>bad gateway</html>", { status: 503 }));
    const e = await failure();
    expect([e.status, e.code]).toEqual([502, "bad_gateway"]);
  });

  it("422 본문 오류(배열 detail)는 invalid_request", async () => {
    fetchMock.mockResolvedValue(json({ detail: [{ loc: ["body"], msg: "Field required" }] }, 422));
    const e = await failure();
    expect([e.status, e.code]).toEqual([422, "invalid_request"]);
  });

  // 서명 URL 이 로그에 남으면 안 된다
  it("오류 로그에 요청 본문을 남기지 않는다", async () => {
    fetchMock.mockResolvedValue(json({ detail: "invalid_audio_url" }, 422));
    await pythonFetch("/analyze", { method: "POST", body: { audioUrl: "https://secret.example/?token=SECRET" } }).catch(() => {});
    const logged = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.flat().join(" ");
    expect(logged).not.toContain("SECRET");
    expect(logged).not.toContain("test-key");
  });
});
