import { createServerSupabase } from "@/lib/supabase/server";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, supabase] = await Promise.all([params, createServerSupabase()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  // 소유자 재확인은 하지 않음 — RLS(user_id = auth.uid())가 이미 검사
  const { data, error } = await supabase.from("stage_presets").delete().eq("id", id).select("id");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // RLS가 막은 DELETE는 예외가 아니라 0행 삭제로 돌아온다 — 그대로 204를 주면 타인 프리셋 삭제
  // 시도가 성공한 것처럼 보이므로 0행이면 403으로 답한다 (gallery/[id]/route.ts와 동일 패턴)
  if (!data || data.length === 0) return Response.json({ error: "forbidden" }, { status: 403 });

  return new Response(null, { status: 204 });
}
