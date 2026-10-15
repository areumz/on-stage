// src/lib/guide/dictionary.ts
import type { ErrorCode } from "@/lib/guide/events";

// 안내 문구는 서버(LLM)가 만들지 않고 코드/키로 여기서 표시한다 (설계 §4).
export type Locale = "ko" | "en";

type UiStrings = {
  title: string; ask: string; sub: string; foot: string; open: string; close: string; placeholder: string; send: string; stop: string; retry: string;
  empty: string; retracted: string; toolGeneric: string;
  tools: Record<string, string>;
  errors: Record<ErrorCode | "network", string>;
};

export const DICT: Record<Locale, UiStrings> = {
  ko: {
    title: "투어 가이드",
    ask: "투어 가이드에게 묻기",
    sub: "아티스트와 공연을 안내해요",
    foot: "투어·아티스트 질문에 답해요 · 이 서비스는 대화를 저장하지 않아요",
    open: "투어 가이드 열기",
    close: "닫기",
    placeholder: "아티스트나 공연 일정을 물어보세요",
    send: "보내기",
    stop: "멈추기",
    retry: "다시 시도",
    empty: "궁금한 아티스트나 투어 일정을 물어보세요.",
    retracted: "확인되지 않은 정보는 답하지 않아요.",
    toolGeneric: "정보를 확인하는 중이에요",
    tools: {
      "tool.listArtists": "아티스트 목록을 확인했어요",
      "tool.getArtist": "아티스트 정보를 확인했어요",
      "tool.searchShows": "공연 일정을 확인했어요",
    },
    errors: {
      rate_limited: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
      off_topic: "STAGE.ONE의 아티스트와 투어에 대해서만 답할 수 있어요.",
      too_long: "질문이 너무 길어요. 200자 이내로 줄여 주세요.",
      busy: "이전 질문에 답하는 중이에요. 잠시만 기다려 주세요.",
      upstream: "지금은 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.",
      internal: "문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
      network: "연결이 끊겼어요. 다시 시도해 주세요.",
    },
  },
  en: {
    title: "Tour Guide",
    ask: "Ask the Tour Guide",
    sub: "Ask about artists and shows",
    foot: "Answers about tours and artists · This service doesn't save chats",
    open: "Open tour guide",
    close: "Close",
    placeholder: "Ask about an artist or a tour date",
    send: "Send",
    stop: "Stop",
    retry: "Try again",
    empty: "Ask about an artist or the tour schedule.",
    retracted: "I don't answer with information I couldn't verify.",
    toolGeneric: "Checking the info…",
    tools: {
      "tool.listArtists": "Checked the artist list",
      "tool.getArtist": "Checked the artist info",
      "tool.searchShows": "Checked the show schedule",
    },
    errors: {
      rate_limited: "Too many requests. Please try again in a moment.",
      off_topic: "I can only answer about STAGE.ONE artists and tours.",
      too_long: "That question is too long. Please keep it under 200 characters.",
      busy: "Still answering your previous question. One moment.",
      upstream: "I couldn't get an answer right now. Please try again shortly.",
      internal: "Something went wrong. Please try again shortly.",
      network: "The connection dropped. Please try again.",
    },
  },
};

export function toolStatusText(locale: Locale, key: string): string {
  return DICT[locale].tools[key] ?? DICT[locale].toolGeneric;
}

export function errorText(locale: Locale, code: ErrorCode | "network"): string {
  return DICT[locale].errors[code];
}
