import type { NextRequest } from "next/server";
import { signAudioUrl } from "@/lib/audio/signedUrl";
import { authed, jsonError, pythonFailure } from "@/lib/director/http";
import { APPROVED_LIMIT, dailyRunLimit } from "@/lib/director/limits";
import { buildRunContext } from "@/lib/director/runContext";
import type { AudioTrackRow } from "@/lib/director/types";
import { python } from "@/lib/python/client";
import type { ArtistRow } from "@/lib/types";

export const maxDuration = 60;

// 연출 만들기 시작: 초안 행을 만들고 Python /runs 를 시작한다. 행 id 가 곧 Python 의 threadId 다.
// 한도 검사 순서가 중요하다:
//   승인본 5개 → 초안 예약(곡당 1개, DB 유니크 인덱스) → 하루 한도 → Python 호출
// 이미 초안이 있는 요청이 하루 횟수를 쓰지 않게 하고, 한도·호출 실패 때는 예약한 초안을 되돌린다.
export async function POST(req: NextRequest) {
  const auth = await authed();
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase } = auth;

  const body = await req.json().catch(() => null);
  const audioTrackId = body?.audioTrackId;
  if (typeof audioTrackId !== "string" || !audioTrackId) return jsonError("bad_request", 400);

  const { data: trackData } = await supabase.from("audio_tracks").select("*").eq("id", audioTrackId).maybeSingle();
  const track = trackData as AudioTrackRow | null;
  if (!track) return jsonError("not_found", 404);
  if (track.analysis_status !== "done" || !track.analysis) return jsonError("analysis_not_ready", 409);

  // 곡당 승인본 5개 (RLS 로 내 연출만 센다)
  const { count: approved } = await supabase
    .from("stage_sequences")
    .select("id", { count: "exact", head: true })
    .eq("audio_track_id", audioTrackId)
    .eq("status", "approved");
  if ((approved ?? 0) >= APPROVED_LIMIT) return jsonError("approved_limit", 409);

  // 초안 예약. 같은 곡에 내 초안이 있으면 유니크 인덱스(user_id, audio_track_id where draft)가 막는다.
  // 먼저 조회하지 않고 insert 의 위반을 쓰면 동시 요청에도 뚫리지 않는다.
  const { data: draft, error: insertError } = await supabase
    .from("stage_sequences")
    .insert({ audio_track_id: audioTrackId })
    .select("id")
    .single();
  if (insertError || !draft) {
    if (insertError?.code === "23505") {
      const { data: existing } = await supabase
        .from("stage_sequences")
        .select("id")
        .eq("audio_track_id", audioTrackId)
        .eq("status", "draft")
        .maybeSingle();
      return jsonError("draft_exists", 409, { draftId: existing?.id ?? null });
    }
    console.error("[sequences] 초안 생성 실패:", insertError?.code);
    return jsonError("internal_error", 500);
  }
  const draftId: string = draft.id;
  const rollback = () => supabase.from("stage_sequences").delete().eq("id", draftId);

  // 서비스 전체 하루 한도 (태평양 시간 기준). 데모 곡·다시 생성은 이 경로를 타지 않는다.
  const { data: claimed, error: claimError } = await supabase.rpc("claim_daily_run", { p_limit: dailyRunLimit() });
  if (claimError) {
    console.error("[sequences] claim_daily_run 실패:", claimError.code);
    await rollback();
    return jsonError("internal_error", 500);
  }
  if (claimed !== true) {
    await rollback();
    return jsonError("daily_limit", 429);
  }

  // Python 에 보낼 값은 전부 여기서 모은다
  const [{ data: artist }, { data: presets }] = await Promise.all([
    supabase.from("artists").select("*").eq("id", track.artist_id).single(),
    supabase.from("stage_presets").select("name, state").eq("artist_id", track.artist_id),
  ]);
  if (!artist) {
    await rollback();
    return jsonError("internal_error", 500);
  }
  // 분위기 해석용 서명 URL. 못 만들면 해석만 건너뛴다(에러가 아니다).
  const audioUrl = await signAudioUrl(supabase, track.storage_path);

  try {
    const run = await python.startRun(
      draftId,
      buildRunContext({ track, artist: artist as ArtistRow, presets: presets ?? [], audioUrl }),
    );
    return Response.json({ id: draftId, status: run.status }, { status: 201 });
  } catch (e) {
    await rollback();
    return pythonFailure(e);
  }
}
