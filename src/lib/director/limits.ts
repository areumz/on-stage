// 무대 연출 디렉터의 한도. 숫자는 여기 한 곳에서만 정한다.
export const APPROVED_LIMIT = 5; // 곡당 저장 가능한 승인본
export const FEEDBACK_LIMIT = 3; // 시퀀스(초안)당 다시 생성 — DB 의 bump_feedback 함수와 같은 값
const DEFAULT_DAILY_RUN_LIMIT = 2;

// 서비스 전체 하루 "연출 만들기" 한도. 환경변수 DAILY_RUN_LIMIT, 비었거나 잘못된 값이면 2.
// 다시 생성과 데모 곡은 세지 않는다. 0 은 "오늘은 아무도 못 만든다"로 그대로 존중한다.
export function dailyRunLimit(raw: string | undefined = process.env.DAILY_RUN_LIMIT): number {
  const n = Number(raw?.trim());
  return raw?.trim() && Number.isInteger(n) && n >= 0 ? n : DEFAULT_DAILY_RUN_LIMIT;
}
