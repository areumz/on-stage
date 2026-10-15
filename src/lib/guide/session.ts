// src/lib/guide/session.ts
const KEY = "guide-session";
let memo: string | null = null;

// 브라우저 sessionStorage의 UUID. 저장소 접근이 막힌 환경에서는 메모리 값으로 대신한다.
export function getSessionId(): string {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
    return id;
  } catch {
    return (memo ??= crypto.randomUUID());
  }
}
