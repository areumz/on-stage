// 연출 이름: 사용자가 붙인 이름(name)이 있으면 그것, 없으면 "곡 제목 · 10월 8일 14:30".
// 날짜·시간은 승인한 때(초안이면 만든 때). 서버 시간대와 상관없이 한국 시간으로 보인다.
// 같은 날 여러 개를 만들어도 구분되도록 시간까지 붙인다.
export const SEQUENCE_NAME_MAX = 40;

export function sequenceName(trackTitle: string, isoDate: string, custom?: string | null): string {
  const mine = custom?.trim();
  if (mine) return mine;
  const d = new Date(isoDate);
  const date = d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" });
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Seoul" });
  return `${trackTitle} · ${date} ${time}`;
}

// 사용자가 입력한 이름을 저장 가능한 값으로 정리한다. 공백만 있거나 비어 있으면 null(= 기본 이름), 길면 거부(undefined).
// 제어 문자와 제로폭·방향 제어 문자는 제거하고(이름이 비어 보이거나 표시가 뒤집히는 것을 막는다) 연속 공백은 하나로 줄인다.
export function cleanSequenceName(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g, "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return [...s].length <= SEQUENCE_NAME_MAX ? s : undefined;
}
