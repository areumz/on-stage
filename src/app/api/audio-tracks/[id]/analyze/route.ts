import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { signAudioUrl } from "@/lib/audio/signedUrl";
import { authed, jsonError, pythonFailure } from "@/lib/director/http";
import type { AnalysisStatus, AudioTrackRow } from "@/lib/director/types";
import type { AnalyzeBody } from "@/lib/python/contract";
import { PythonError, python } from "@/lib/python/client";

export const maxDuration = 60;

// 클라이언트에는 진행 상태만 준다. analysis(큰 배열)와 서명 URL 은 내보내지 않는다.
function toClient(body: { status: string; progress: number | null; error: string | null }) {
  // status 가 error 일 때 progress 는 의미 없다 (끊긴 분석이 1.0 을 남길 수 있다)
  return Response.json({
    status: body.status,
    progress: body.status === "error" ? null : body.progress,
    error: body.error,
  });
}

const DONE = { status: "done", progress: 1, error: null } as const;

// 조회 오류와 "없음"을 구분한다. 일시적인 DB 오류가 "없는 곡"으로 보이면 안 된다.
async function loadTrack(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("audio_tracks").select("*").eq("id", id).maybeSingle();
  return { track: (data as AudioTrackRow | null) ?? null, failed: !!error };
}

const DB_STATUS: Record<string, AnalysisStatus> = { queued: "pending", running: "running", error: "error" };

// Python 상태를 audio_tracks 에 반영한다. done 의 저장은 멱등이다(같은 값을 다시 써도 같다).
// 반영하지 못하면 응답을 만들지 않고 Response 를 돌려준다.
async function sync(supabase: SupabaseClient, track: AudioTrackRow, body: AnalyzeBody): Promise<Response | null> {
  let patch: Record<string, unknown> | null = null;
  // done 인데 결과가 없으면 성공처럼 넘기지 않는다 (다음 단계가 analysis_not_ready 로 막힌다)
  if (body.status === "done" && !body.result) return jsonError("internal_error", 502);
  if (body.status === "done" && body.result) {
    patch = {
      analysis: body.result.analysis,
      file_hash: body.result.fileHash,
      duration_sec: body.result.analysis.durationSec,
      analysis_status: "done",
    };
  } else if (DB_STATUS[body.status] && DB_STATUS[body.status] !== track.analysis_status) {
    patch = { analysis_status: DB_STATUS[body.status] };
  }
  if (!patch) return null;

  // RLS 가 내 곡만 고친다. 0행이면 남의 곡이다.
  const { data, error } = await supabase.from("audio_tracks").update(patch).eq("id", track.id).select("id");
  if (error) {
    console.error("[analyze] audio_tracks 저장 실패:", error.code);
    return jsonError("internal_error", 500);
  }
  return data.length === 0 ? jsonError("forbidden", 403) : null;
}

// 분석 시작. 같은 id 로 다시 POST 해도 안전하다(Python 이 멱등으로 처리): 오류 뒤 "다시 시도"도 이 라우트다.
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/audio-tracks/[id]/analyze">) {
  const [{ id }, auth] = await Promise.all([ctx.params, authed()]);
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase } = auth;

  const { track, failed } = await loadTrack(supabase, id);
  if (failed) return jsonError("internal_error", 500);
  if (!track) return jsonError("not_found", 404);
  // 시드 곡과 이미 끝난 곡은 Python 을 부르지 않는다
  if (track.analysis_status === "done" && track.analysis) return Response.json(DONE);

  // 서명 URL 은 요청마다 새로 만들어 Python 에만 보낸다 (저장·로그 금지)
  const audioUrl = await signAudioUrl(supabase, track.storage_path);
  if (!audioUrl) {
    // 기록은 최선만 한다(시드 곡은 RLS 로 0행). 어느 쪽이든 화면에는 같은 오류를 보여 준다.
    await supabase.from("audio_tracks").update({ analysis_status: "error" }).eq("id", id);
    return Response.json({ status: "error", progress: null, error: "audio_unavailable" });
  }

  try {
    const body = await python.startAnalyze(id, audioUrl);
    const failed = await sync(supabase, track, body);
    return failed ?? toClient(body);
  } catch (e) {
    return pythonFailure(e);
  }
}

// 진행 폴링. 탭을 닫았다 와도 결과는 Python 에 7일 남아 있어 여기서 받아 저장한다.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/audio-tracks/[id]/analyze">) {
  const [{ id }, auth] = await Promise.all([ctx.params, authed()]);
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase } = auth;

  const { track, failed } = await loadTrack(supabase, id);
  if (failed) return jsonError("internal_error", 500);
  if (!track) return jsonError("not_found", 404);
  if (track.analysis_status === "done" && track.analysis) return Response.json(DONE);

  try {
    const body = await python.getAnalyze(id);
    const failed = await sync(supabase, track, body);
    return failed ?? toClient(body);
  } catch (e) {
    // 7일이 지났거나 아직 POST 하지 않은 곡이다. 화면이 같은 id 로 다시 POST 하게 한다.
    if (e instanceof PythonError && e.code === "job_not_found") return jsonError("job_not_found", 404);
    return pythonFailure(e);
  }
}
