// 업로드 전 검사 (순수 함수). 브라우저와 route handler 가 같이 쓴다.
import { CONTENT_TYPES, MAX_BYTES, MAX_DURATION_BLOCK_SEC } from "./limits";

export type FileProblem = "unsupported_type" | "too_large";
export type DurationProblem = "unreadable" | "too_long";

// 확장자가 없거나 점으로 끝나면 null
export function extensionOf(name: string): string | null {
  const i = name.lastIndexOf(".");
  if (i < 0 || i === name.length - 1) return null;
  return name.slice(i + 1).toLowerCase();
}

export function canonicalContentType(name: string): string | null {
  const ext = extensionOf(name);
  return ext && Object.hasOwn(CONTENT_TYPES, ext) ? CONTENT_TYPES[ext] : null;
}

export function fileProblem({ name, size }: { name: string; size: number }): FileProblem | null {
  if (!canonicalContentType(name)) return "unsupported_type";
  return size > MAX_BYTES ? "too_large" : null;
}

export function durationProblem(sec: number): DurationProblem | null {
  if (!Number.isFinite(sec) || sec <= 0) return "unreadable";
  return sec > MAX_DURATION_BLOCK_SEC ? "too_long" : null;
}

// 화면 표기는 MB 로 통일 (검사 기준인 MiB 와 어긋나도 4.2 같은 한 자리 표기라 무방)
export function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function formatDuration(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
