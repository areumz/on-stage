import { signAudioUrl } from "@/lib/audio/signedUrl";
import { authed, isUuid, jsonError } from "@/lib/director/http";

// 재생 시점마다 1시간짜리 서명 URL 을 새로 만들어 돌려준다. 저장·캐시·로그 금지(비밀번호처럼 취급).
export async function GET(_request: Request, ctx: RouteContext<"/api/audio-tracks/[id]/play">) {
  const auth = await authed();
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase } = auth;
  const { id } = await ctx.params;

  if (!isUuid(id)) return jsonError("not_found", 404);

  // RLS: 내 곡 또는 시드 곡만 보인다
  const { data, error } = await supabase.from("audio_tracks").select("storage_path").eq("id", id).maybeSingle();
  if (error) return jsonError("internal_error", 500);
  if (!data) return jsonError("not_found", 404);

  const url = await signAudioUrl(supabase, data.storage_path, 3600);
  if (!url) return jsonError("audio_unavailable", 502);
  return Response.json({ url }, { headers: { "Cache-Control": "no-store" } });
}
