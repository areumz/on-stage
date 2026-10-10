import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { authed, jsonError, pythonFailure } from "@/lib/director/http";
import { validateSequence } from "@/lib/director/sequenceValidate";
import type { StageSequenceRow } from "@/lib/director/types";
import { PythonError, python } from "@/lib/python/client";
import type { RunResult } from "@/lib/python/contract";
import { forbiddenIfNoRows } from "@/lib/routeHelpers";

export const maxDuration = 60;

// 초안을 만든 직후에는 Python 이 아직 그 스레드를 모를 수 있다(콜드 스타트로 POST /runs 가 늦게 도착,
// 같은 곡을 두 번 요청한 탭이 먼저 폴링). 이 시간 안의 404 는 "만료"가 아니라 "아직 시작 전"으로 본다.
const STARTUP_GRACE_MS = 90_000;

// 조회 오류와 "없음"을 구분한다. 일시적인 DB 오류가 "사라진 연출"로 보이면 안 된다.
async function loadSequence(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("stage_sequences").select("*").eq("id", id).maybeSingle();
  return { row: (data as StageSequenceRow | null) ?? null, failed: !!error };
}

// 승인된 결과를 검증하고 저장한다. 같은 결과로 몇 번을 불러도 같은 상태가 된다(멱등).
// 저장에 실패하면 save_failed 를 돌려주고, 화면이 같은 GET 을 다시 부르면 Python 에서 같은 결과를
// 다시 받아 재시도한다 (결과는 서버에 7일 남지만 약속은 승인 후 24시간).
async function saveApproved(supabase: SupabaseClient, row: StageSequenceRow, result: RunResult): Promise<Response> {
  const { data: track } = await supabase
    .from("audio_tracks")
    .select("duration_sec, artist_id")
    .eq("id", row.audio_track_id)
    .single();
  const { data: artist } = track
    ? await supabase.from("artists").select("color").eq("id", track.artist_id).single()
    : { data: null };
  if (!track || !artist) return jsonError("save_failed", 500);

  const checked = validateSequence(result.items, Number(track.duration_sec), artist.color);
  if (!checked.ok) {
    console.error("[sequences] 승인 결과 검증 실패:", checked.reason);
    return jsonError("save_failed", 422, { reason: "invalid_result", message: checked.reason });
  }

  const { data, error } = await supabase
    .from("stage_sequences")
    .update({ status: "approved", items: checked.items, approved_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "draft")
    .select("id");
  if (error) {
    console.error("[sequences] 승인 저장 실패:", error.code);
    return jsonError("save_failed", 500);
  }
  // 0행: 다른 탭이 먼저 저장했거나 그사이 지워졌다
  if (data.length === 0 && (await loadSequence(supabase, row.id)).row?.status !== "approved") return jsonError("not_found", 404);
  return Response.json({ status: "approved" });
}

// 진행 폴링. 승인본은 Python 을 부르지 않고 DB 상태만 돌려준다.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/sequences/[id]">) {
  const [{ id }, auth] = await Promise.all([ctx.params, authed()]);
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase } = auth;

  const { row, failed } = await loadSequence(supabase, id);
  if (failed) return jsonError("internal_error", 500);
  if (!row) return jsonError("not_found", 404);
  if (row.status === "approved") return Response.json({ status: "approved" });

  try {
    const run = await python.getRun(id);
    if (run.status === "done") {
      return run.result ? await saveApproved(supabase, row, run.result) : jsonError("internal_error", 502);
    }
    return Response.json({
      status: run.status,
      interrupt: run.interrupt,
      error: run.error,
      feedbackCount: row.feedback_count,
    });
  } catch (e) {
    if (e instanceof PythonError && e.code === "thread_not_found") {
      if (Date.now() - new Date(row.created_at).getTime() < STARTUP_GRACE_MS) {
        return Response.json({ status: "queued", interrupt: null, error: null, feedbackCount: row.feedback_count });
      }
      // Python 은 "존재한 적 없음"과 "7일 방치로 삭제됨"을 구별하지 못한다. 초안에 대해서만 만료로 보고 지운다.
      await supabase.from("stage_sequences").delete().eq("id", id).eq("status", "draft");
      return jsonError("thread_expired", 410);
    }
    return pythonFailure(e);
  }
}

// 초안 버리기와 저장된 연출 삭제가 같은 라우트다. RLS 가 내 행만 지운다. Python thread 는 따로 지우지 않는다(24시간 뒤 정리).
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/sequences/[id]">) {
  const [{ id }, auth] = await Promise.all([ctx.params, authed()]);
  if (!auth) return jsonError("unauthorized", 401);

  const { data, error } = await auth.supabase.from("stage_sequences").delete().eq("id", id).select("id");
  if (error) return jsonError("internal_error", 500);
  const forbidden = forbiddenIfNoRows(data);
  if (forbidden) return forbidden;
  return new Response(null, { status: 204 });
}
