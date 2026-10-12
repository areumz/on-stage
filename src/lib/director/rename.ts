// 연출 이름 입력 검사와 오류 문구 (화면용, 서버 검사가 최종). 정리 규칙은 cleanSequenceName 한 곳을 쓴다.
import type { ApiError } from "@/lib/director/api";
import { SEQUENCE_NAME_MAX, cleanSequenceName } from "@/lib/director/format";

export type NameCheck = { ok: true; name: string | null } | { ok: false; message: string };

// name null = 기본 이름으로 되돌린다(비웠을 때)
export function checkName(raw: string): NameCheck {
  const name = cleanSequenceName(raw);
  if (name === undefined) return { ok: false, message: `이름은 ${SEQUENCE_NAME_MAX}자까지 쓸 수 있어요` };
  return { ok: true, name };
}

export const nameLength = (raw: string): number => [...raw].length;

// 글자 수 표시용: 저장될 값(정리한 뒤, 코드포인트) 기준. 정리 뒤에도 40자를 넘으면 정확한 수 없이 over 만 알린다.
export type NameCount = { over: false; count: number } | { over: true };
export function nameCount(raw: string): NameCount {
  const c = checkName(raw);
  return c.ok ? { over: false, count: c.name ? nameLength(c.name) : 0 } : { over: true };
}

export function renameErrorKo(e: ApiError): string {
  if (e.code === "invalid_name") return `이름은 ${SEQUENCE_NAME_MAX}자까지 쓸 수 있어요`;
  if (e.code === "connection_failed") return "연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요";
  if (e.status === 404) return "연출을 찾을 수 없어요";
  return "이름을 바꾸지 못했어요. 잠시 뒤에 다시 시도해 주세요";
}
