import type { NextRequest } from "next/server";
import { authed, isUuid, jsonError, pythonFailure } from "@/lib/director/http";
import { APPROVED_LIMIT, dailyRunLimit } from "@/lib/director/limits";
import { loadRunContext } from "@/lib/director/prepare";
import type { AudioTrackRow } from "@/lib/director/types";
import { python } from "@/lib/python/client";

export const maxDuration = 60;

// 연출 만들기 시작: 초안 행을 만들고 Python /runs 를 시작. 행 id 가 곧 Python 의 threadId.
//
// 순서 중요:
//   승인본 5개 → 초안 예약(곡당 1개, DB 유니크 인덱스) → 보낼 값 모으기 → 하루 한도 → Python 호출
// - 이미 초안이 있는 요청은 하루 횟수에 포함 x
// - 실패할 수 있는 DB 조회·서명을 한도 차감 앞에서 끝냄. 차감 뒤에 실패하는 건 Python 호출뿐.
// - Python 호출이 실패하면 초안을 되돌리지만 하루 횟수는 돌려주지 x. 환불 함수 사용시 우회에 대한 우려가 있어 새는 부분 허용.
// - 데모 곡 "열기"는 이 라우트 호출 x(미리 승인된 시퀀스를 재생).
// - 시드곡으로 새 연출을 만드는 것은 실제 AI 호출이라 하루 횟수에 포함.

export async function POST(req: NextRequest) {
  const auth = await authed();
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase } = auth;

  const body = await req.json().catch(() => null);
  const audioTrackId = body?.audioTrackId;
  if (!isUuid(audioTrackId)) return jsonError("bad_request", 400);

  const { data: trackData, error: trackError } = await supabase
    .from("audio_tracks")
    .select("*")
    .eq("id", audioTrackId)
    .maybeSingle();
  if (trackError) return jsonError("internal_error", 500);
  const track = trackData as AudioTrackRow | null;
  if (!track) return jsonError("not_found", 404);
  if (track.analysis_status !== "done" || !track.analysis) return jsonError("analysis_not_ready", 409);

  // 곡당 승인본 5개 (RLS 로 내 연출만 센다). 조회가 실패하면 한도를 열어 두지 않고 막는다.
  const { count: approved, error: countError } = await supabase
    .from("stage_sequences")
    .select("id", { count: "exact", head: true })
    .eq("audio_track_id", audioTrackId)
    .eq("status", "approved");
  if (countError || approved === null) return jsonError("internal_error", 500);
  if (approved >= APPROVED_LIMIT) return jsonError("approved_limit", 409);

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

  // Python 에 보낼 값은 한도를 쓰기 전에 모두 모은다
  const context = await loadRunContext(supabase, track);
  if (!context) {
    await rollback();
    return jsonError("internal_error", 500);
  }

  // 서비스 전체 하루 한도 (태평양 시간 기준)
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

  try {
    const run = await python.startRun(draftId, context);
    return Response.json({ id: draftId, status: run.status }, { status: 201 });
  } catch (e) {
    await rollback();
    return pythonFailure(e);
  }
}
