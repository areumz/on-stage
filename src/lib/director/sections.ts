// 구간 확인 화면의 편집 로직(순수 함수). 서버 resume 규칙(contract.ts)을 화면에서 미리 막는 용도라
// 같은 규칙을 한 곳에 모은다. 시간은 정수 초로 편집하고, 마지막 구간 끝만 durationSec(소수 가능) 그대로 둔다.
import { labelKo } from "@/lib/director/labels";
import type { Section, SectionInput } from "@/lib/python/contract";

export const MIN_SECTION_SEC = 8;
export const MAX_SECTIONS = 12;
export const MAX_LABEL = 40;
export const MAX_MOOD = 200;
const EPS = 0.001;

// 시작 시간은 따로 들고 있지 않다 — 앞 구간 끝과 항상 같아야 하니 행에는 끝만 두면 어긋날 수 없다.
// raw 는 Python 이 준 label, text 는 입력창 값. text 가 labelKo(raw) 와 같으면(고치지 않았거나 되돌렸으면) raw 를 그대로 보낸다.
export type EditRow = { raw: string; text: string; endSec: number; mood: string };

export function fromSections(sections: Section[], durationSec: number): EditRow[] {
  return sections.map((s, i) => ({
    raw: s.label,
    text: labelKo(s.label),
    // 서버가 유효하다고 준 구간은 한 글자도 안 건드리면 검증을 통과해야 해서 반올림하지 않는다(8.5초 경계 등).
    // 정수 규칙은 사용자가 편집하는 값(setEnd·moveBoundary·split)에만 적용한다.
    endSec: i === sections.length - 1 ? durationSec : s.endSec,
    mood: s.mood,
  }));
}

export const startOf = (rows: EditRow[], i: number) => (i === 0 ? 0 : rows[i - 1].endSec);

export function toInputs(rows: EditRow[]): SectionInput[] {
  return rows.map((r, i) => ({
    label: r.text === labelKo(r.raw) ? r.raw : r.text.trim(),
    startSec: startOf(rows, i),
    endSec: r.endSec,
    mood: r.mood,
  }));
}

export function formatTime(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// "1:07" 또는 "67". 그 밖의 입력은 null
export function parseTime(text: string): number | null {
  const t = text.trim();
  let m = /^(\d{1,4})$/.exec(t);
  if (m) return Number(m[1]);
  m = /^(\d{1,3}):([0-5]?\d)$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// 끝 시간 직접 입력. 마지막 행은 고정이고, 앞뒤 구간이 뒤집히거나 0초가 되는 값은 무시한다.
// 8초 미만이 되는 값은 허용한다 — 오류를 행에 보여 줘야 사용자가 고칠 수 있다.
export function setEnd(rows: EditRow[], i: number, sec: number): EditRow[] {
  if (i >= rows.length - 1 || !Number.isInteger(sec)) return rows;
  if (sec <= startOf(rows, i) || sec >= rows[i + 1].endSec) return rows;
  return rows.map((r, j) => (j === i ? { ...r, endSec: sec } : r));
}

// 드래그·키보드로 경계를 옮길 때 허용 범위. 이미 8초 규칙을 못 지키는 상태면 최소 1초만 지킨다.
export function boundaryRange(rows: EditRow[], i: number): { min: number; max: number } {
  const start = startOf(rows, i);
  const next = rows[i + 1].endSec;
  const min = start + MIN_SECTION_SEC;
  const max = next - MIN_SECTION_SEC;
  return min <= max ? { min, max } : { min: start + 1, max: next - 1 };
}

export function moveBoundary(rows: EditRow[], i: number, sec: number): EditRow[] {
  // 드래그 중 타임라인이 숨겨지면 0/0 = NaN 이 들어올 수 있다
  if (i >= rows.length - 1 || !Number.isFinite(sec)) return rows;
  const { min, max } = boundaryRange(rows, i);
  const next = Math.min(max, Math.max(min, Math.round(sec)));
  return next === rows[i].endSec ? rows : rows.map((r, j) => (j === i ? { ...r, endSec: next } : r));
}

// 위 구간과 합친다: 위 구간 끝이 이 구간 끝으로 간다(위 구간 이름·분위기 유지). 첫 행은 불가.
export function mergeUp(rows: EditRow[], i: number): EditRow[] {
  if (i <= 0 || i >= rows.length) return rows;
  return rows.flatMap((r, j) => (j === i - 1 ? [{ ...r, endSec: rows[i].endSec }] : j === i ? [] : [r]));
}

function splitPoint(rows: EditRow[], i: number): number | null {
  if (rows.length >= MAX_SECTIONS) return null;
  const start = startOf(rows, i);
  const mid = Math.round((start + rows[i].endSec) / 2);
  return mid - start >= MIN_SECTION_SEC && rows[i].endSec - mid >= MIN_SECTION_SEC ? mid : null;
}

export const canSplit = (rows: EditRow[], i: number) => splitPoint(rows, i) !== null;

// 가운데에서 둘로. 뒤쪽 조각은 이름을 그대로 물려받고 분위기는 비운다(앞 조각 분위기가 뒤까지 맞는다는 보장이 없다).
export function split(rows: EditRow[], i: number): EditRow[] {
  const mid = splitPoint(rows, i);
  if (mid === null) return rows;
  const r = rows[i];
  return [...rows.slice(0, i), { ...r, endSec: mid }, { ...r, mood: "" }, ...rows.slice(i + 1)];
}

function longestIndex(rows: EditRow[]): number {
  let best = 0;
  rows.forEach((r, i) => {
    if (r.endSec - startOf(rows, i) > rows[best].endSec - startOf(rows, best)) best = i;
  });
  return best;
}

// 구간 추가 = 가장 긴 구간 쪼개기. 12개이거나 쪼갤 수 없으면 비활성.
export const canAdd = (rows: EditRow[]) => canSplit(rows, longestIndex(rows));
export const addSection = (rows: EditRow[]) => split(rows, longestIndex(rows));

export type RowErrorKind = "short" | "label" | "mood" | "gap";
export type Validation =
  | { ok: true }
  | { ok: false; rowErrors: Record<number, string>; rowKinds: Record<number, RowErrorKind>; message?: string };

export function validateSections(sections: SectionInput[], durationSec: number): Validation {
  const rowErrors: Record<number, string> = {};
  const rowKinds: Record<number, RowErrorKind> = {};
  let message: string | undefined;
  const n = sections.length;
  if (n < 1 || n > MAX_SECTIONS) message = `구간은 1~${MAX_SECTIONS}개여야 해요`;
  sections.forEach((s, i) => {
    const len = s.endSec - s.startSec;
    const label = s.label.trim();
    const fail = (kind: RowErrorKind, text: string) => {
      rowErrors[i] = text;
      rowKinds[i] = kind;
    };
    if (n >= 2 && len < MIN_SECTION_SEC - EPS) {
      fail("short", `구간은 ${MIN_SECTION_SEC}초 이상이어야 해요 (지금 ${Math.max(0, Math.floor(len))}초) · 끝 시간을 늘리거나 이웃한 구간과 병합해 주세요`);
    } else if (label.length < 1 || label.length > MAX_LABEL) {
      fail("label", `이름은 1~${MAX_LABEL}자로 입력해 주세요`);
    } else if ((s.mood ?? "").length > MAX_MOOD) {
      fail("mood", `분위기는 ${MAX_MOOD}자 이하로 입력해 주세요`);
    } else if (i > 0 && Math.abs(s.startSec - sections[i - 1].endSec) > EPS) {
      fail("gap", "앞 구간과 시간이 이어지지 않아요");
    }
  });
  if (n > 0 && (Math.abs(sections[0].startSec) > EPS || Math.abs(sections[n - 1].endSec - durationSec) > EPS)) {
    message ??= "구간이 곡 전체(처음부터 끝까지)를 덮어야 해요";
  }
  return Object.keys(rowErrors).length || message ? { ok: false, rowErrors, rowKinds, message } : { ok: true };
}
