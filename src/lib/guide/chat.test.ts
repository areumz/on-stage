import { describe, it, expect } from "vitest";
import sample from "./guide_events_sample.json";
import { parseGuideEvent } from "./events";
import { chatReducer, initialChat, lastUserText } from "./chat";

const send = (s = initialChat, text = "안녕", id = "m1") => chatReducer(s, { type: "send", id, text });

describe("chatReducer", () => {
  it("send는 사용자 말풍선과 빈 답변 말풍선을 만들고 streaming이 된다", () => {
    const s = send();
    expect(s.status).toBe("streaming");
    expect(s.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("text_delta는 마지막 답변에 이어 붙는다", () => {
    let s = send();
    s = chatReducer(s, { type: "event", event: { event: "text_delta", text: "가장 " } });
    s = chatReducer(s, { type: "event", event: { event: "text_delta", text: "가까운" } });
    expect(s.messages.at(-1)!.text).toBe("가장 가까운");
  });

  it("tool_status는 toolKey를 바꾸고 done에서 지운다", () => {
    let s = send();
    s = chatReducer(s, { type: "event", event: { event: "tool_status", tool: "searchShows", key: "tool.searchShows" } });
    expect(s.toolKey).toBe("tool.searchShows");
    s = chatReducer(s, { type: "event", event: { event: "done" } });
    expect(s).toMatchObject({ status: "idle", toolKey: null });
  });

  it("tool_status의 키는 현재 답변 말풍선에 남고 done 뒤에도 유지된다", () => {
    let s = send();
    s = chatReducer(s, { type: "event", event: { event: "tool_status", tool: "searchShows", key: "tool.searchShows" } });
    s = chatReducer(s, { type: "event", event: { event: "done" } });
    expect(s.messages.at(-1)!.toolKey).toBe("tool.searchShows");
  });

  it("chip은 마지막 답변 말풍선에 붙는다", () => {
    let s = send();
    s = chatReducer(s, { type: "event", event: { event: "done" } });
    s = chatReducer(s, { type: "chip", chip: { kind: "focus", slug: "aurora" } });
    expect(s.messages.at(-1)!.chip).toEqual({ kind: "focus", slug: "aurora" });
    expect(s.messages[0].chip).toBeUndefined();
  });

  it("retract는 답변을 비우고 retracted로 표시", () => {
    let s = send();
    s = chatReducer(s, { type: "event", event: { event: "text_delta", text: "틀린 답" } });
    s = chatReducer(s, { type: "event", event: { event: "retract", reason: "x" } });
    expect(s.messages.at(-1)).toMatchObject({ text: "", retracted: true });
  });

  it("fixture retract_unverified: text_delta → retract → done 뒤 입력창이 돌아온다", () => {
    let s = send();
    for (const item of sample.retract_unverified) {
      s = chatReducer(s, { type: "event", event: parseGuideEvent(item.event, JSON.stringify(item.data))! as never });
    }
    expect(s.status).toBe("idle");
    expect(s.messages.at(-1)).toMatchObject({ text: "", retracted: true });
  });

  it("error는 status와 코드를 남기고, 비어 있는 답변 말풍선은 지운다", () => {
    let s = send();
    s = chatReducer(s, { type: "event", event: { event: "error", code: "rate_limited" } });
    expect(s).toMatchObject({ status: "error", errorCode: "rate_limited" });
    expect(s.messages.map((m) => m.role)).toEqual(["user"]);
  });

  it("텍스트가 이미 있으면 error여도 답변은 남긴다", () => {
    let s = send();
    s = chatReducer(s, { type: "event", event: { event: "text_delta", text: "부분 답변" } });
    s = chatReducer(s, { type: "event", event: { event: "error", code: "upstream" } });
    expect(s.messages.at(-1)!.text).toBe("부분 답변");
  });

  it("fail은 network 오류, aborted는 idle", () => {
    expect(chatReducer(send(), { type: "fail" })).toMatchObject({ status: "error", errorCode: "network" });
    expect(chatReducer(send(), { type: "aborted" }).status).toBe("idle");
  });

  it("dropFailed + lastUserText로 다시 시도할 수 있다", () => {
    let s = send(initialChat, "서울 공연", "m1");
    s = chatReducer(s, { type: "fail" });
    expect(lastUserText(s)).toBe("서울 공연");
    s = chatReducer(s, { type: "dropFailed" });
    expect(s.messages).toEqual([]);
    expect(s.status).toBe("idle");
  });
});

describe("reset (새 대화 시작)", () => {
  it("session_limit 뒤 reset하면 대화창이 비고 idle로 돌아온다", () => {
    let s = send();
    s = chatReducer(s, { type: "event", event: { event: "error", code: "session_limit" } });
    expect(s).toMatchObject({ status: "error", errorCode: "session_limit" });
    s = chatReducer(s, { type: "reset" });
    expect(s).toEqual(initialChat);
  });
});
