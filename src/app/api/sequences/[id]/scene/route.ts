import type { NextRequest } from "next/server";
import { authed, isUuid, jsonError } from "@/lib/director/http";
import { parseBackdrop, parseBackdropSetting, parseLevel, parseSceneEdit, parseSectionScene, PROP_KEYS } from "@/lib/stage/scene";
import { fileExists, folderOf, ownFileName } from "../../backdropStorage";

// 구간 한 칸이 온전한지: null 이거나, 보낸 값(null 은 "정하지 않음"으로 허용)이 각각 허용값이고 하나라도 의미가 있어야함.
function validSection(s: unknown): boolean {
  if (s === null) return true;
  if (typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  const ok = (v: unknown, parse: (x: unknown) => unknown) => v === undefined || v === null || parse(v) !== null;
  return (
    ok(o.backdrop, parseBackdrop) &&
    ok(o.dust, parseLevel) &&
    ok(o.reflection, parseLevel) &&
    ok(o.image, (x) => parseSectionScene({ image: x })) &&
    parseSectionScene(s) !== null
  );
}

// 사용자가 고친 장면을 저장한다. AI 값(items·props)은 건드리지 않는다 — "AI 제안으로 되돌리기"가 가능해야 해서
// 고친 값만 scene_edit 에 둔다. body { edit: SceneEdit | null }, null = 전부 되돌리기.
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/sequences/[id]/scene">) {
  const [{ id }, auth] = await Promise.all([ctx.params, authed()]);
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase, user } = auth;
  if (!isUuid(id)) return jsonError("not_found", 404);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !("edit" in body)) return jsonError("invalid_scene", 400);
  const raw: unknown = body.edit;

  // RLS 로 내 연출만 보인다
  const { data: row, error } = await supabase.from("stage_sequences").select("status, items").eq("id", id).maybeSingle();
  if (error) return jsonError("internal_error", 500);
  if (!row) return jsonError("not_found", 404);
  if (row.status !== "approved") return jsonError("not_approved", 409);

  let edit = null;
  if (raw !== null) {
    edit = parseSceneEdit(raw, Array.isArray(row.items) ? row.items.length : 0);
    // 파서는 깨진 부분을 조용히 버림. 저장 요청에서는 보낸 값이 하나라도 깨졌으면 거절해 UI 가 알게함.
    const sent = (raw ?? {}) as Record<string, unknown>;
    const n = Array.isArray(row.items) ? row.items.length : 0;
    const strict =
      (sent.props === undefined || (Array.isArray(sent.props) && sent.props.every((k) => (PROP_KEYS as readonly unknown[]).includes(k)))) &&
      (sent.sections === undefined ||
        (Array.isArray(sent.sections) && sent.sections.length === n && sent.sections.every(validSection))) &&
      (sent.backdrop === undefined || parseBackdropSetting(sent.backdrop) !== null);
    if (!edit || !strict || (["backdrop", "sections", "props"] as const).some((k) => sent[k] !== undefined && edit![k] === undefined)) {
      return jsonError("invalid_scene", 400);
    }
    // 업로드 이미지는 연출 전체(예전 형식)와 구간별 모두 내 폴더에 실제로 있는 것만 허용. 샘플은 그대로.
    const refs = [edit.backdrop?.mode === "image" ? edit.backdrop.image : null, ...(edit.sections ?? []).map((s) => s?.image ?? null)];
    for (const image of refs) {
      if (image?.kind !== "upload") continue;
      const folder = folderOf(user.id, id);
      const name = ownFileName(image.path, folder);
      if (!name) return jsonError("invalid_scene", 400);
      const found = await fileExists(supabase, folder, name);
      if (found === null) return jsonError("internal_error", 500);
      if (!found) return jsonError("invalid_scene", 400);
    }
  }

  const { data, error: updateError } = await supabase
    .from("stage_sequences")
    .update({ scene_edit: edit })
    .eq("id", id)
    .eq("status", "approved")
    .select("id");
  if (updateError) return jsonError("internal_error", 500);
  if (!data || data.length === 0) return jsonError("not_found", 404);
  return Response.json({ sceneEdit: edit });
}
