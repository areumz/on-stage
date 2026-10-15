// src/lib/guide/chat.ts
import type { ErrorCode, GuideEvent } from "@/lib/guide/events";

export type ChatMessage = { id: string; role: "user" | "assistant"; text: string; retracted?: boolean };

export type ChatState = {
  messages: ChatMessage[];
  status: "idle" | "streaming" | "error";
  errorCode: ErrorCode | "network" | null;
  toolKey: string | null;
};

// action 이벤트는 reducer로 오지 않는다(Provider가 done 때 실행)
export type ChatAction =
  | { type: "send"; id: string; text: string }
  | { type: "event"; event: Exclude<GuideEvent, { event: "action" }> }
  | { type: "fail" }
  | { type: "aborted" }
  | { type: "dropFailed" };

export const initialChat: ChatState = { messages: [], status: "idle", errorCode: null, toolKey: null };

function withLast(messages: ChatMessage[], patch: (m: ChatMessage) => ChatMessage): ChatMessage[] {
  const last = messages.at(-1);
  if (!last || last.role !== "assistant") return messages;
  return [...messages.slice(0, -1), patch(last)];
}

// 빈 답변 말풍선이 오류 화면에 남아 있지 않게 지운다
function dropEmptyAssistant(messages: ChatMessage[]): ChatMessage[] {
  const last = messages.at(-1);
  return last && last.role === "assistant" && last.text === "" && !last.retracted ? messages.slice(0, -1) : messages;
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "send":
      return {
        messages: [
          ...state.messages,
          { id: action.id, role: "user", text: action.text },
          { id: `${action.id}-a`, role: "assistant", text: "" },
        ],
        status: "streaming",
        errorCode: null,
        toolKey: null,
      };
    case "event": {
      const e = action.event;
      switch (e.event) {
        case "tool_status":
          return { ...state, toolKey: e.key };
        case "text_delta":
          return { ...state, messages: withLast(state.messages, (m) => ({ ...m, text: m.text + e.text })) };
        case "retract":
          return { ...state, messages: withLast(state.messages, (m) => ({ ...m, text: "", retracted: true })) };
        case "error":
          return { ...state, status: "error", errorCode: e.code, toolKey: null, messages: dropEmptyAssistant(state.messages) };
        case "done":
          return { ...state, status: "idle", toolKey: null };
      }
      return state;
    }
    case "fail":
      return { ...state, status: "error", errorCode: "network", toolKey: null, messages: dropEmptyAssistant(state.messages) };
    case "aborted":
      return { ...state, status: "idle", toolKey: null, messages: dropEmptyAssistant(state.messages) };
    case "dropFailed": {
      // 마지막 사용자 말풍선(과 그 뒤의 답변)을 지운다 — 같은 질문을 새 요청으로 다시 보내기 위해
      const idx = state.messages.findLastIndex((m) => m.role === "user");
      return { ...state, messages: idx === -1 ? state.messages : state.messages.slice(0, idx), status: "idle", errorCode: null };
    }
  }
}

export function lastUserText(state: ChatState): string | null {
  return state.messages.findLast((m) => m.role === "user")?.text ?? null;
}
