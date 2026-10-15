import { describe, expect, it } from "vitest";
import { createSseParser } from "./sse";

describe("createSseParser", () => {
  it("parses one event/data pair", () => {
    const p = createSseParser();
    expect(p('event: text_delta\ndata: {"text":"hi"}\n\n')).toEqual([
      { event: "text_delta", data: '{"text":"hi"}' },
    ]);
  });
  it("joins messages split across chunk boundaries", () => {
    const p = createSseParser();
    expect(p("event: text_de")).toEqual([]);
    expect(p('lta\ndata: {"te')).toEqual([]);
    expect(p('xt":"hi"}\n')).toEqual([]);
    expect(p("\n")).toEqual([{ event: "text_delta", data: '{"text":"hi"}' }]);
  });
  it("returns several events from one chunk in order", () => {
    const p = createSseParser();
    expect(p("event: a\ndata: 1\n\nevent: b\ndata: 2\n\n")).toEqual([
      { event: "a", data: "1" },
      { event: "b", data: "2" },
    ]);
  });
  it("handles CRLF and comment lines", () => {
    const p = createSseParser();
    expect(p(": keepalive\r\n\r\nevent: done\r\n: c\r\ndata: {}\r\n\r\n")).toEqual([
      { event: "done", data: "{}" },
    ]);
  });
  it("drops blocks without data", () => {
    const p = createSseParser();
    expect(p("event: ping\n\nevent: done\ndata: {}\n\n")).toEqual([
      { event: "done", data: "{}" },
    ]);
  });
});
