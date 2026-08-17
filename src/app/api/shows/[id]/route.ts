import { createServerSupabase } from "@/lib/supabase/server";

const FIELD_MAP: Record<string, string> = {
  cityCode: "city_code",
  cityName: "city_name",
  country: "country",
  venue: "venue",
  showDate: "show_date",
  capacity: "capacity",
  featured: "featured",
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, supabase] = await Promise.all([params, createServerSupabase()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "bad request" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (key in body) patch[column] = key === "capacity" ? Number(body[key]) : body[key];
  }
  if (Object.keys(patch).length === 0) return Response.json({ error: "bad request" }, { status: 400 });

  const { data, error } = await supabase.from("shows").update(patch).eq("id", id).select("id");
  if (error) {
    if (error.code === "23505") return Response.json({ error: "duplicate" }, { status: 409 });
    return Response.json({ error: error.message }, { status: 500 });
  }
  // RLS가 막은 UPDATE는 예외가 아니라 0행 수정으로 돌아온다 — 그대로 200을 주면 권한 없는
  // 시도가 성공한 것처럼 보이므로 0행이면 403으로 답한다 (gallery/[id]/route.ts와 동일 패턴)
  if (!data || data.length === 0) return Response.json({ error: "forbidden" }, { status: 403 });

  return Response.json({}, { status: 200 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, supabase] = await Promise.all([params, createServerSupabase()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  // 소유자 재확인은 하지 않음 — RLS(역할 스코프)가 이미 검사
  const { data, error } = await supabase.from("shows").delete().eq("id", id).select("id");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return Response.json({ error: "forbidden" }, { status: 403 });

  return new Response(null, { status: 204 });
}
