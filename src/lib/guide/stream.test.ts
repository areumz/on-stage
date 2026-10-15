import { describe, it, expect, vi, afterEach } from "vitest";
import { streamGuide } from "./stream";
import type { GuideEvent } from "./events";

const enc = new TextEncoder();
function sseResponse(chunks: string[], init: ResponseInit = { status: 200 }) {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      chunks.forEach((s) => c.enqueue(enc.encode(s)));
      c.close();
    },
  });
  return new Response(stream, init);
}
const body = { requestId: "r", sessionId: "s", locale: "ko" as const, message: "hi" };

afterEach(() => vi.unstubAllGlobals());

describe("streamGuide", () => {
  it("조각이 이벤트 경계에서 잘려도 순서대로 이벤트를 전달한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      sseResponse([
        'event: text_delta\ndata: {"text":"가',
        '"}\n\nevent: action\ndata: {"type":"focusArtist","slug":"aurora"}\n\n',
        "event: done\ndata: {}\n\n",
      ]),
    ));
    const got: GuideEvent[] = [];
    const r = await streamGuide({ url: "http://x/guide/stream", body, signal: new AbortController().signal, onEvent: (e) => got.push(e) });
    expect(r).toBe("ok");
    expect(got.map((e) => e.event)).toEqual(["text_delta", "action", "done"]);
  });

  it("HTTP 오류는 failed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 422 })));
    const r = await streamGuide({ url: "http://x", body, signal: new AbortController().signal, onEvent: () => {} });
    expect(r).toBe("failed");
  });

  it("네트워크 예외는 failed, abort된 경우는 aborted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    expect(await streamGuide({ url: "http://x", body, signal: new AbortController().signal, onEvent: () => {} })).toBe("failed");

    const ctrl = new AbortController();
    ctrl.abort();
    expect(await streamGuide({ url: "http://x", body, signal: ctrl.signal, onEvent: () => {} })).toBe("aborted");
  });
});
