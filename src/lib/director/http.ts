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

// uuid 가 아닌 id 를 그대로 DB 에 넘기면 Postgres 오류가 나서 400/404 가 아니라 500 이 된다. 라우트 앞에서 거른다.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export function jsonError(code: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ error: code, ...extra }, { status });
}

// 사용자에게 보여 줘도 되는 Python message 가 붙는 코드들. invalid_audio_url 은 뺀다:
// 사용자가 고칠 수 있는 오류가 아니고(우리가 만든 URL), message 에 서명 URL 이 담길 수 있다.
const WITH_MESSAGE = new Set(["invalid_sections", "invalid_targets"]);

// Python 호출 실패를 클라이언트 응답으로 바꾼다. 상세 원인은 서버 로그에만 있다.
export function pythonFailure(e: unknown): Response {
  if (e instanceof PythonError) {
    const code = e.code === "not_configured" ? "internal_error" : e.code === "bad_gateway" ? "connection_failed" : e.code;
    // 우리가 만든 요청을 Python 이 거절한 경우(invalid_audio_url, 본문 모양 오류)는 사용자가 고칠 수 없다. 일반 오류로 보인다.
    if (code === "invalid_audio_url" || code === "invalid_request") return jsonError("internal_error", 500);
    return jsonError(code, e.status, WITH_MESSAGE.has(code) && e.detail ? { message: e.detail } : {});
  }
  console.error("[director] unexpected error:", e instanceof Error ? e.message : "unknown");
  return jsonError("internal_error", 500);
}
