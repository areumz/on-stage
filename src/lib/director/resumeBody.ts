// POST /api/sequences/[id]/resume 의 본문을 검사해 Python 계약(§4.4)의 ResumeBody 로 만든다.
// 구간 규칙(8초 이상, 1~12개 등)은 Python 이 검사하고 422 invalid_sections + message 로 알려 준다.
// 여기서는 모양만 본다: 타입이 틀린 값이 Python 까지 가지 않게 하고, 모르는 필드는 버린다.
import type { ResumeBody, SectionInput } from "@/lib/python/contract";

const MAX_SECTIONS = 50; // 규칙(12개)보다 넉넉한 안전 상한 — 엉뚱한 큰 본문만 막는다
export const FEEDBACK_TEXT_MAX = 500;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function parseResumeBody(raw: unknown): ResumeBody | null {
  if (!raw || typeof raw !== "object") return null;
  const { interruptId, kind, payload } = raw as Record<string, unknown>;
  if (typeof interruptId !== "string" || !interruptId) return null;
  if (kind === "approve") return { interruptId, kind };

  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;

  if (kind === "sections") {
    if (!Array.isArray(p.sections) || p.sections.length === 0 || p.sections.length > MAX_SECTIONS) return null;
    const sections: SectionInput[] = [];
    for (const s of p.sections as Record<string, unknown>[]) {
      if (!s || typeof s.label !== "string" || !isNum(s.startSec) || !isNum(s.endSec)) return null;
      if (s.mood !== undefined && typeof s.mood !== "string") return null;
      sections.push({
        label: s.label,
        startSec: s.startSec,
        endSec: s.endSec,
        ...(s.mood === undefined ? {} : { mood: s.mood }),
      });
    }
    return { interruptId, kind, payload: { sections } };
  }

  if (kind === "feedback") {
    const text = typeof p.text === "string" ? p.text.trim() : "";
    if (text.length < 1 || text.length > FEEDBACK_TEXT_MAX) return null;
    const t = p.targets;
    if (!Array.isArray(t) || t.length === 0 || t.length > MAX_SECTIONS) return null;
    if (!t.every((n) => Number.isInteger(n) && n >= 0)) return null;
    return { interruptId, kind, payload: { text, targets: [...new Set(t as number[])] } };
  }

  return null;
}
