import { createServerSupabase } from "@/lib/supabase/server";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  // 소유자 재확인은 하지 않음 — RLS(created_by = auth.uid())가 이미 검사
  // DB 행 → Storage 객체 순서로 지움: 행 삭제가 인가 게이트라 권한 없으면 Storage를 안 건드림
  const { data, error } = await supabase.from("gallery_images").delete().eq("id", id).select("storage_path");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // RLS가 막은 DELETE는 예외가 아니라 0행 삭제로 돌아온다. 그대로 204를 주면 시드 이미지를
  // 지우려던 시도가 성공한 것처럼 보이므로, 0행이면 403으로 답한다.
  if (!data || data.length === 0) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { error: removeError } = await supabase.storage.from("gallery").remove([data[0].storage_path]);
  if (removeError) return Response.json({ error: removeError.message }, { status: 500 });

  return new Response(null, { status: 204 });
}
