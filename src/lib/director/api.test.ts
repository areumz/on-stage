import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSequence, deleteSequence, pollSequence, resumeSequence } from "./api";

const fetchMock = vi.fn();

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("director api", () => {
  it("성공하면 data 를 돌려준다", async () => {
    fetchMock.mockResolvedValue(json({ status: "approved" }));
    expect(await pollSequence("s1")).toEqual({ ok: true, data: { status: "approved" } });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/sequences/s1");
  });

  it("서버의 error 코드와 상태를 그대로 전달한다", async () => {
    fetchMock.mockResolvedValue(json({ error: "draft_exists", draftId: "old" }, 409));
    expect(await createSequence("t1")).toEqual({
      ok: false,
      error: { code: "draft_exists", status: 409, message: undefined, draftId: "old" },
    });
  });

  it("규칙 위반 message 를 전달한다", async () => {
    fetchMock.mockResolvedValue(json({ error: "invalid_sections", message: "구간은 8초 이상" }, 422));
    const r = await resumeSequence("s1", { interruptId: "i", kind: "approve" });
    expect(r).toMatchObject({ ok: false, error: { code: "invalid_sections", message: "구간은 8초 이상" } });
  });

  it("네트워크 실패는 예외 없이 connection_failed", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await pollSequence("s1")).toEqual({ ok: false, error: { code: "connection_failed", status: 0 } });
  });

  it("본문이 JSON 이 아닌 오류는 일반 오류", async () => {
    fetchMock.mockResolvedValue(new Response("<html>x</html>", { status: 500 }));
    expect(await pollSequence("s1")).toMatchObject({ ok: false, error: { code: "internal_error", status: 500 } });
  });

  it("204 는 성공(본문 없음)", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await deleteSequence("s1")).toEqual({ ok: true, data: undefined });
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("POST 는 JSON 본문과 헤더를 보낸다", async () => {
    fetchMock.mockResolvedValue(json({ id: "s1", status: "queued" }, 201));
    await createSequence("t1");
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"audioTrackId":"t1"}');
    expect(init.headers["Content-Type"]).toBe("application/json");
  });
});
