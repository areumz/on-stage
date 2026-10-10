// 무대 연출 디렉터 route handler 들이 같이 쓰는 인증·오류 응답 헬퍼.
// 응답 오류는 항상 { error: <코드> } — 코드는 src/lib/python/errors.ts 의 ErrorKey 와 맞춘다.
import { PythonError } from "@/lib/python/client";
import { createServerSupabase } from "@/lib/supabase/server";

export async function authed() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export type Authed = NonNullable<Awaited<ReturnType<typeof authed>>>;

export function jsonError(code: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ error: code, ...extra }, { status });
}

// 사용자에게 보여 줘도 되는 Python message 가 붙는 코드들
const WITH_MESSAGE = new Set(["invalid_sections", "invalid_targets", "invalid_audio_url"]);

// Python 호출 실패를 클라이언트 응답으로 바꾼다. 상세 원인은 서버 로그에만 있다.
export function pythonFailure(e: unknown): Response {
  if (e instanceof PythonError) {
    const code = e.code === "not_configured" ? "internal_error" : e.code === "bad_gateway" ? "connection_failed" : e.code;
    return jsonError(code, e.status, WITH_MESSAGE.has(code) && e.detail ? { message: e.detail } : {});
  }
  console.error("[director] unexpected error:", e instanceof Error ? e.message : "unknown");
  return jsonError("internal_error", 500);
}
