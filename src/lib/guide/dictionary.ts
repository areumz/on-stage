// src/lib/guide/dictionary.ts
import type { ErrorCode } from "@/lib/guide/events";

// 안내 문구는 서버(LLM)가 만들지 않고 코드/키로 여기서 표시한다 (설계 §4).
export type Locale = "ko" | "en";

export type ChipKind = "focus" | "navigating" | "failed";
type ErrorCard = { title: string; body: string };

type UiStrings = {
  title: string; ask: string; sub: string; foot: string; close: string; placeholder: string;
  send: string; stop: string; retry: string; language: string;
  empty: string; retracted: string; newChat: string; toolGeneric: string;
  chips: Record<ChipKind, string>; // {NAME}은 slug 대문자
  tools: Record<string, string>;
  errors: Record<ErrorCode | "network", ErrorCard>;
};

export const DICT: Record<Locale, UiStrings> = {
  ko: {
    title: "투어 가이드",
    ask: "투어 가이드에게 묻기",
    sub: "아티스트와 공연을 안내해요",
    foot: "투어·아티스트 질문에 답해요 · 이 서비스는 대화를 저장하지 않아요",
    close: "투어 가이드 닫기",
    placeholder: "투어·아티스트에 대해 물어보세요",
    send: "보내기",
    stop: "답변 멈추기",
    retry: "다시 시도",
    language: "언어 / Language",
    empty: "궁금한 아티스트나 투어 일정을 물어보세요.",
    retracted: "확인되지 않은 정보는 답하지 않아요",
    newChat: "새 대화 시작",
    toolGeneric: "정보를 확인하는 중이에요",
    chips: {
      focus: "궤도 카메라가 {NAME}로 이동했어요",
      navigating: "{NAME} 투어 페이지로 이동 중",
      failed: "화면 이동에 실패했어요",
    },
    tools: {
      "tool.listArtists": "아티스트 목록을 확인했어요",
      "tool.getArtist": "아티스트 정보를 확인했어요",
      "tool.searchShows": "공연 일정을 확인했어요",
    },
    errors: {
      rate_limited: { title: "질문이 몰리고 있어요", body: "잠시 후에 다시 물어봐 주세요." },
      off_topic: { title: "이 질문은 제가 도와드리기 어려워요.", body: "아티스트, 공연, 투어 일정에 관해 다시 물어봐 주세요. 예: '서울에서 곧 공연하는 팀은?'" },
      too_long: { title: "질문이 너무 길어요", body: "200자 이내로 줄여 주세요." },
      busy: { title: "아직 답변 중이에요", body: "이전 질문에 답하는 중이에요. 잠시만 기다려 주세요." },
      session_limit: { title: "대화가 길어졌어요", body: "새 대화를 시작하면 이어서 물어볼 수 있어요." },
      upstream: { title: "답변을 불러오지 못했어요", body: "지금은 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요." },
      internal: { title: "문제가 생겼어요", body: "잠시 후 다시 시도해 주세요." },
      network: { title: "답변을 불러오지 못했어요", body: "연결이 잠깐 끊겼어요. 다시 시도를 눌러 주세요." },
    },
  },
  en: {
    title: "Tour Guide",
    ask: "Ask the Tour Guide",
    sub: "Ask about artists and shows",
    foot: "Answers about tours and artists · This service doesn't save chats",
    close: "Close tour guide",
    placeholder: "Ask about artists or the tour",
    send: "Send",
    stop: "Stop answering",
    retry: "Try again",
    language: "언어 / Language",
    empty: "Ask about an artist or the tour schedule.",
    retracted: "I don't answer with information I couldn't verify",
    newChat: "Start a new chat",
    toolGeneric: "Checking the info…",
    chips: {
      focus: "The orbit camera moved to {NAME}",
      navigating: "Heading to the {NAME} tour page",
      failed: "Couldn't change the screen",
    },
    tools: {
      "tool.listArtists": "Checked the artist list",
      "tool.getArtist": "Checked the artist info",
      "tool.searchShows": "Checked the show schedule",
    },
    errors: {
      rate_limited: { title: "Lots of questions right now", body: "Please try again in a moment." },
      off_topic: { title: "I can't help with that one.", body: "Try asking about artists, shows, or tour dates, e.g. 'Who's playing in Seoul soon?'" },
      too_long: { title: "That question is too long", body: "Please keep it under 200 characters." },
      busy: { title: "Still answering", body: "Still answering your previous question. One moment." },
      session_limit: { title: "This chat has gotten long", body: "Start a new chat to keep asking." },
      upstream: { title: "Couldn't load the answer", body: "I couldn't get an answer right now. Please try again shortly." },
      internal: { title: "Something went wrong", body: "Please try again shortly." },
      network: { title: "Couldn't load the answer", body: "The connection dropped for a moment. Tap Try again to resend." },
    },
  },
};

export function toolStatusText(locale: Locale, key: string): string {
  return DICT[locale].tools[key] ?? DICT[locale].toolGeneric;
}

export function errorText(locale: Locale, code: ErrorCode | "network"): string {
  return DICT[locale].errors[code].body;
}

export function errorTitle(locale: Locale, code: ErrorCode | "network"): string {
  return DICT[locale].errors[code].title;
}

export function chipText(locale: Locale, kind: ChipKind, slug: string): string {
  return DICT[locale].chips[kind].replace("{NAME}", slug.toUpperCase());
}
