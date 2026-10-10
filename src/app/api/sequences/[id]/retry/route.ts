import type { NextRequest } from "next/server";
import { authed, jsonError, pythonFailure } from "@/lib/director/http";
import { loadRunContext } from "@/lib/director/prepare";
import type { AudioTrackRow, StageSequenceRow } from "@/lib/director/types";
import { PythonError, python } from "@/lib/python/client";

export const maxDuration = 60;

// 오류(interrupted, llm_failed 등)로 멈춘 초안의 "다시 시도". 같은 threadId 로 POST /runs 를 다시 보내면
// Python 이 마지막 체크포인트에서 이어서 한다. 같은 연출을 이어가는 것이라 하루 한도는 다시 세지 않는다.
//
// 한도를 우회하는 길이 되지 않게, Python 이 error 라고 한 초안에서만 다시 보낸다:
// 스레드가 사라졌는데 다시 POST 하면 새 스레드가 시작되어 한도 없이 새 연출이 돌기 때문이다.
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/sequences/[id]/retry">) {
  const [{ id }, auth] = await Promise.all([ctx.params, authed()]);
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase } = auth;

  const { data, error } = await supabase.from("stage_sequences").select("*").eq("id", id).maybeSingle();
  if (error) return jsonError("internal_error", 500);
  const row = data as StageSequenceRow | null;
  if (!row) return jsonError("not_found", 404);
  if (row.status !== "draft") return jsonError("not_waiting_input", 409);

  try {
    const current = await python.getRun(id);
    // 오류가 아니면 다시 보낼 게 없다. 지금 상태를 그대로 알려 주면 화면이 이어서 폴링한다.
    if (current.status !== "error") {
      return Response.json({ status: current.status, feedbackCount: row.feedback_count });
    }

    const { data: trackData, error: trackError } = await supabase
      .from("audio_tracks")
      .select("*")
      .eq("id", row.audio_track_id)
      .maybeSingle();
    if (trackError) return jsonError("internal_error", 500);
    const track = trackData as AudioTrackRow | null;
    if (!track?.analysis) return jsonError("analysis_not_ready", 409);

    const context = await loadRunContext(supabase, track);
    if (!context) return jsonError("internal_error", 500);

    const run = await python.startRun(id, context);
    return Response.json({ status: run.status, feedbackCount: row.feedback_count }, { status: 202 });
  } catch (e) {
    if (e instanceof PythonError && e.code === "thread_not_found") {
      await supabase.from("stage_sequences").delete().eq("id", id).eq("status", "draft");
      return jsonError("thread_expired", 410);
    }
    return pythonFailure(e);
  }
}
