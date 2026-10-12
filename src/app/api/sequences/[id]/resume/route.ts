import type { NextRequest } from "next/server";
import { cleanSequenceName } from "@/lib/director/format";
import { authed, isUuid, jsonError, pythonFailure } from "@/lib/director/http";
import { FEEDBACK_LIMIT } from "@/lib/director/limits";
import { parseResumeBody } from "@/lib/director/resumeBody";
import type { StageSequenceRow } from "@/lib/director/types";
import { PythonError, python } from "@/lib/python/client";

export const maxDuration = 60;

// 구간 확정(sections) · 다시 생성(feedback) · 승인(approve). interruptId 는 화면이 방금 받은 값을 그대로 보낸다
// (옛 값은 Python 이 409 stale_interrupt 로 돌려주고, 그대로 전달한다).
export async function POST(req: NextRequest, ctx: RouteContext<"/api/sequences/[id]/resume">) {
  const [{ id }, auth] = await Promise.all([ctx.params, authed()]);
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase } = auth;
  if (!isUuid(id)) return jsonError("not_found", 404);

  const raw = await req.json().catch(() => null);
  const resume = parseResumeBody(raw);
  if (!resume) return jsonError("bad_request", 400);

  // 승인할 때 이름도 같이 받을 수 있다(우리 쪽 선택 필드). Python 계약에는 payload 가 없어서 parseResumeBody 가 이미 버렸고,
  // 여기서 따로 읽어 우리 DB 에만 저장한다. 형식이 틀리면 Python 을 부르기 전에 거부한다.
  let name: string | null | undefined; // undefined = 이름을 보내지 않음
  if (resume.kind === "approve" && raw && typeof raw === "object" && "name" in raw) {
    name = cleanSequenceName((raw as { name: unknown }).name);
    if (name === undefined) return jsonError("invalid_name", 400);
  }

  const { data, error: loadError } = await supabase
    .from("stage_sequences")
    .select("status, feedback_count")
    .eq("id", id)
    .maybeSingle();
  if (loadError) return jsonError("internal_error", 500);
  const row = data as Pick<StageSequenceRow, "status" | "feedback_count"> | null;
  if (!row) return jsonError("not_found", 404);
  if (row.status !== "draft") return jsonError("not_waiting_input", 409);

  // 다시 생성은 시퀀스당 3회. Python 이 받아들인 뒤에만 차감해서, 낡은 화면(409)이나 규칙 위반(422)이 횟수를 쓰지 않게 한다.
  if (resume.kind === "feedback" && row.feedback_count >= FEEDBACK_LIMIT) return jsonError("feedback_limit", 429);

  try {
    const run = await python.resume(id, resume);
    let feedbackCount = row.feedback_count;
    if (resume.kind === "feedback") {
      // 원자적으로 +1. 동시 요청으로 한도를 넘으려 하면 null 이 오고, 그때는 올리지 않는다.
      const { data: bumped, error } = await supabase.rpc("bump_feedback", { p_id: id });
      if (error) console.error("[resume] bump_feedback 실패:", error.code);
      if (typeof bumped === "number") feedbackCount = bumped;
    }
    if (name !== undefined) {
      // 이름 저장 실패가 승인을 막지 않는다(나중에 이름 바꾸기로 고칠 수 있다). 로그엔 코드만.
      const { error } = await supabase.from("stage_sequences").update({ name }).eq("id", id).eq("user_id", auth.user.id);
      if (error) console.error("[resume] 이름 저장 실패:", error.code);
    }
    return Response.json({ status: run.status, feedbackCount }, { status: 202 });
  } catch (e) {
    if (e instanceof PythonError && e.code === "thread_not_found") {
      await supabase.from("stage_sequences").delete().eq("id", id).eq("status", "draft");
      return jsonError("thread_expired", 410);
    }
    return pythonFailure(e);
  }
}
