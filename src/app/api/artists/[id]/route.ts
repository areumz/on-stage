import { createServerSupabase } from "@/lib/supabase/server";
import { forbiddenIfNoRows } from "@/lib/routeHelpers";

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

  // 숫자 필드는 최소한 유한한 값이어야 한다(문자열 등을 Number()로 캐스팅하면 NaN이 그대로
  // 저장될 수 있음). shader_falloff/shader_speed는 폼의 min/max가 나타내는 범위(각각 0~1, 0 이상)를
  // 서버에서도 강제한다 — <form> 제출이 아니라 버튼 onClick이라 브라우저의 min/max 검증이 안 걸린다.
  // NUMERIC_KEYS는 camelCase 요청 키라 patch(snake_case 컬럼)가 아니라 FIELD_MAP으로 컬럼명을 구한다.
  for (const key of NUMERIC_KEYS) {
    const column = FIELD_MAP[key];
    if (column in patch && !Number.isFinite(patch[column])) return Response.json({ error: "bad request" }, { status: 400 });
  }
  if ("shader_falloff" in patch && ((patch.shader_falloff as number) < 0 || (patch.shader_falloff as number) > 1)) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if ("shader_speed" in patch && (patch.shader_speed as number) < 0) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const { data, error } = await supabase.from("artists").update(patch).eq("id", id).select("id");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const forbidden = forbiddenIfNoRows(data);
  if (forbidden) return forbidden;

  return Response.json({}, { status: 200 });
}
