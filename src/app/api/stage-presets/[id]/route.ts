import { createServerSupabase } from "@/lib/supabase/server";
import { forbiddenIfNoRows } from "@/lib/routeHelpers";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, supabase] = await Promise.all([params, createServerSupabase()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  // 소유자 재확인은 하지 않음 — RLS(user_id = auth.uid())가 이미 검사
  const { data, error } = await supabase.from("stage_presets").delete().eq("id", id).select("id");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const forbidden = forbiddenIfNoRows(data);
  if (forbidden) return forbidden;

  return new Response(null, { status: 204 });
}
