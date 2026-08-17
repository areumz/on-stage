import { createServerSupabase } from "@/lib/supabase/server";

const FIELD_MAP: Record<string, string> = {
  no: "no",
  title: "title",
  duration: "duration",
  coverFrom: "cover_from",
  coverTo: "cover_to",
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
    if (key in body) patch[column] = key === "no" ? Number(body[key]) : body[key];
  }
  if (Object.keys(patch).length === 0) return Response.json({ error: "bad request" }, { status: 400 });

  // swap 로직은 여기 없다 — Task 7의 TracksManager가 임시값 경유 3단계로 이 라우트를 세 번
  // 호출한다. 이 라우트는 받은 값을 그대로 update만 한다(design-v2.md §7.3 "구현 에이전트 주의").
  const { data, error } = await supabase.from("tracks").update(patch).eq("id", id).select("id");
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
  const { data, error } = await supabase.from("tracks").delete().eq("id", id).select("id");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return Response.json({ error: "forbidden" }, { status: 403 });

  return new Response(null, { status: 204 });
}
