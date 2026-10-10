import { authed, isUuid, jsonError } from "@/lib/director/http";
import { forbiddenIfNoRows } from "@/lib/routeHelpers";

// 업로드 취소·실패 때 행과 Storage 객체를 정리한다. RLS 가 내 행만 허용한다.
// 분석을 시작하기 전(pending)인 곡만 지운다: 이미 분석·승인된 곡을 지우면 연출(stage_sequences)까지 cascade 로 사라진다.
export async function DELETE(_request: Request, ctx: RouteContext<"/api/audio-tracks/[id]">) {
  const auth = await authed();
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase } = auth;
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError("not_found", 404);

  const { data, error } = await supabase.from("audio_tracks").delete().eq("id", id).eq("analysis_status", "pending").select("storage_path");
  if (error) return jsonError("internal_error", 500);
  const denied = forbiddenIfNoRows(data);
  if (denied) return denied;

  // 객체 삭제가 실패해도 행 삭제는 유지한다
  const { error: removeError } = await supabase.storage.from("audio-tracks").remove([data[0].storage_path]);
  if (removeError) console.error("[audio-tracks] storage remove failed:", removeError.message);

  return new Response(null, { status: 204 });
}
