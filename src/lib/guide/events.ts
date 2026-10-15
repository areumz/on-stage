// src/lib/guide/events.ts
// 에이전트 계약(contracts/guide_events.py)의 SSE 이벤트·액션 모양. 프레임: `event:` 이름 + `data:` JSON.
// 일반 이벤트의 data에는 event 필드가 없고, action의 data는 액션 객체 그대로다.
export const ERROR_CODES = ["rate_limited", "off_topic", "too_long", "busy", "session_limit", "upstream", "internal"] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type UiAction =
  | { type: "focusArtist"; slug: string }
  | { type: "openTour"; slug: string; section?: string }
  | { type: "highlightCity"; slug: string; city: string };

export type GuideEvent =
  | { event: "tool_status"; tool: string; key: string }
  | { event: "text_delta"; text: string }
  | { event: "action"; action: UiAction }
  | { event: "retract"; reason: string }
  | { event: "error"; code: ErrorCode }
  | { event: "done" };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isStr = (v: unknown): v is string => typeof v === "string";

function toAction(d: Record<string, unknown>): UiAction | null {
  if (d.type === "focusArtist" && isStr(d.slug)) return { type: "focusArtist", slug: d.slug };
  if (d.type === "openTour" && isStr(d.slug)) {
    return isStr(d.section) ? { type: "openTour", slug: d.slug, section: d.section } : { type: "openTour", slug: d.slug };
  }
  if (d.type === "highlightCity" && isStr(d.slug) && isStr(d.city)) {
    return { type: "highlightCity", slug: d.slug, city: d.city };
  }
  return null; // 모르는 액션은 무시 (ui_actions.md 규칙 1)
}

// 해석할 수 없는 이벤트는 null — 호출부는 그냥 건너뛴다
export function parseGuideEvent(name: string, raw: string): GuideEvent | null {
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(d)) return null;
  switch (name) {
    case "tool_status":
      return isStr(d.tool) && isStr(d.key) ? { event: "tool_status", tool: d.tool, key: d.key } : null;
    case "text_delta":
      return isStr(d.text) ? { event: "text_delta", text: d.text } : null;
    case "action": {
      const action = toAction(d);
      return action ? { event: "action", action } : null;
    }
    case "retract":
      return isStr(d.reason) ? { event: "retract", reason: d.reason } : null;
    case "error":
      return isStr(d.code)
        ? { event: "error", code: (ERROR_CODES as readonly string[]).includes(d.code) ? (d.code as ErrorCode) : "internal" }
        : null;
    case "done":
      return { event: "done" };
    default:
      return null;
  }
}
