// Python /runs 에 보낼 context 를 모은다 (연출 만들기와 오류 뒤 재시도가 같이 쓴다).
// 서명 URL 은 요청마다 새로 만든다. 못 만들면 분위기 해석만 건너뛴다(에러가 아니다).
import type { SupabaseClient } from "@supabase/supabase-js";
import { signAudioUrl } from "@/lib/audio/signedUrl";
import { buildRunContext } from "@/lib/director/runContext";
import type { AudioTrackRow } from "@/lib/director/types";
import type { RunContext } from "@/lib/python/contract";
import type { ArtistRow } from "@/lib/types";

// 아티스트를 못 찾으면 null. 호출하는 쪽이 500 으로 처리한다.
export async function loadRunContext(supabase: SupabaseClient, track: AudioTrackRow): Promise<RunContext | null> {
  const [{ data: artist }, { data: presets }] = await Promise.all([
    supabase.from("artists").select("*").eq("id", track.artist_id).single(),
    supabase.from("stage_presets").select("name, state").eq("artist_id", track.artist_id),
  ]);
  if (!artist) return null;
  const audioUrl = await signAudioUrl(supabase, track.storage_path);
  return buildRunContext({ track, artist: artist as ArtistRow, presets: presets ?? [], audioUrl });
}
