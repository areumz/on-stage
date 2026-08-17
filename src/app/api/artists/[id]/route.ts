import { createServerSupabase } from "@/lib/supabase/server";

const FIELD_MAP: Record<string, string> = {
  color: "color",
  news: "news",
  tourBadge: "tour_badge",
  tourTitleKo: "tour_title_ko",
  tourYear: "tour_year",
  shaderPattern: "shader_pattern",
  shaderFreq: "shader_freq",
  shaderFalloff: "shader_falloff",
  shaderSpeed: "shader_speed",
};
const NUMERIC_KEYS = new Set(["tourYear", "shaderFreq", "shaderFalloff", "shaderSpeed"]);
const SHADER_PATTERNS = new Set(["wave", "ripple", "grain"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, supabase] = await Promise.all([params, createServerSupabase()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "bad request" }, { status: 400 });

  // shaderPattern은 DB 컬럼이 text라 제약이 없다 — 얕은 검증 원칙 안에서 타입(허용값 3종)만 확인한다.
  if ("shaderPattern" in body && !SHADER_PATTERNS.has(body.shaderPattern)) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (key in body) patch[column] = NUMERIC_KEYS.has(key) ? Number(body[key]) : body[key];
  }
  if (Object.keys(patch).length === 0) return Response.json({ error: "bad request" }, { status: 400 });

  const { data, error } = await supabase.from("artists").update(patch).eq("id", id).select("id");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  // RLS가 막은 UPDATE는 예외가 아니라 0행 수정으로 돌아온다 — 그대로 200을 주면 권한 없는
  // 시도가 성공한 것처럼 보이므로 0행이면 403으로 답한다 (gallery/[id]/route.ts와 동일 패턴)
  if (!data || data.length === 0) return Response.json({ error: "forbidden" }, { status: 403 });

  return Response.json({}, { status: 200 });
}
