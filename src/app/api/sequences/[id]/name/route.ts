import type { NextRequest } from "next/server";
import { authed, isUuid, jsonError } from "@/lib/director/http";
import { cleanSequenceName } from "@/lib/director/format";

// 연출 이름 바꾸기. 초안·승인본 모두 가능하다. 공백이거나 null 이면 기본 이름으로 되돌린다(name = null).
// body { name: string | null } → { name: 정리된 값 }
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/sequences/[id]/name">) {
  const [{ id }, auth] = await Promise.all([ctx.params, authed()]);
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase, user } = auth;
  if (!isUuid(id)) return jsonError("not_found", 404);

  const body = await req.json().catch(() => null);
  const name = body && typeof body === "object" && "name" in body ? cleanSequenceName(body.name) : undefined;
  if (name === undefined) return jsonError("invalid_name", 400);

  const { data, error } = await supabase.from("stage_sequences").update({ name }).eq("id", id).eq("user_id", user.id).select("id");
  if (error) return jsonError("internal_error", 500);
  if (!data || data.length === 0) return jsonError("not_found", 404); // 남의 연출은 RLS 로 0행
  return Response.json({ name });
}
