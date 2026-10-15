// src/lib/guide/stream.ts
import type { GuideContext } from "@/lib/guide/context";
import type { Locale } from "@/lib/guide/dictionary";
import { parseGuideEvent, type GuideEvent } from "@/lib/guide/events";
import { createSseParser } from "@/lib/guide/sse";

export type GuideRequestBody = {
  requestId: string;
  sessionId: string;
  locale: Locale;
  message: string;
  context?: GuideContext;
};

// POST 본문이 있어서 EventSource는 못 쓰고 fetch 스트림으로 읽는다. 취소는 signal.abort().
export async function streamGuide(opts: {
  url: string;
  body: GuideRequestBody;
  signal: AbortSignal;
  onEvent: (e: GuideEvent) => void;
}): Promise<"ok" | "failed" | "aborted"> {
  try {
    const res = await fetch(opts.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(opts.body), // context가 undefined면 필드가 빠진다
      signal: opts.signal,
    });
    if (!res.ok || !res.body) {
      void res.body?.cancel().catch(() => {});
      return "failed";
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parse = createSseParser();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const m of parse(decoder.decode(value, { stream: true }))) {
        const e = parseGuideEvent(m.event, m.data);
        if (e) opts.onEvent(e);
        if (e && (e.event === "done" || e.event === "error")) {
          // 프록시가 연결을 열어 둬도 done에서 끝낸다
          await reader.cancel().catch(() => {});
          return "ok";
        }
      }
    }
    return "ok";
  } catch {
    return opts.signal.aborted ? "aborted" : "failed";
  }
}
