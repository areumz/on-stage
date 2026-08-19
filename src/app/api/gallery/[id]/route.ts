import { createServerSupabase } from "@/lib/supabase/server";
import { forbiddenIfNoRows } from "@/lib/routeHelpers";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, supabase] = await Promise.all([params, createServerSupabase()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  // 소유자 재확인은 하지 않음 — RLS(created_by = auth.uid())가 이미 검사
  // DB 행 → Storage 객체 순서로 지움: 행 삭제가 인가 게이트라 권한 없으면 Storage를 안 건드림
  const { data, error } = await supabase.from("gallery_images").delete().eq("id", id).select("storage_path");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const forbidden = forbiddenIfNoRows(data);
  if (forbidden) return forbidden;

  const { error: removeError } = await supabase.storage.from("gallery").remove([data[0].storage_path]);
  if (removeError) return Response.json({ error: removeError.message }, { status: 500 });

  return new Response(null, { status: 204 });
}
