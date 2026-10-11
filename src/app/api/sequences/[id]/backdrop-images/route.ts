import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { authed, isUuid, jsonError } from "@/lib/director/http";
import { parseSceneEdit, UPLOAD_LIMIT_BYTES, UPLOAD_MIME, UPLOADS_PER_SEQUENCE } from "@/lib/stage/scene";
import { BACKDROP_BUCKET, folderOf, listAll, ownFileName } from "../../backdropStorage";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const NO_STORE = { "Cache-Control": "no-store" };

// 내 승인본만 다룬다. RLS 로 남의 연출은 안 보여 404.
async function guard(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("stage_sequences").select("status").eq("id", id).maybeSingle();
  if (error) return jsonError("internal_error", 500);
  if (!data) return jsonError("not_found", 404);
  return data.status === "approved" ? null : jsonError("not_approved", 409);
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/sequences/[id]/backdrop-images">) {
  const [{ id }, auth] = await Promise.all([ctx.params, authed()]);
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase, user } = auth;
  if (!isUuid(id)) return jsonError("not_found", 404);
  const denied = await guard(supabase, id);
  if (denied) return denied;

  const folder = folderOf(user.id, id);
  const names = await listAll(supabase, folder);
  if (!names) return jsonError("internal_error", 500);

  const images: { path: string; name: string; url: string }[] = [];
  for (const name of names.slice(0, UPLOADS_PER_SEQUENCE)) {
    const path = `${folder}/${name}`;
    const { data } = await supabase.storage.from(BACKDROP_BUCKET).createSignedUrl(path, 3600);
    if (data) images.push({ path, name, url: data.signedUrl }); // 못 만든 한 장은 건너뛴다
  }
  return Response.json({ images }, { headers: NO_STORE });
}

// 브라우저가 Storage 에 직접 PUT 한다. 여기 검사는 빨리 알려 주기 위한 것이고, 진짜 경계는 버킷 설정(5MB·mime)이다.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/sequences/[id]/backdrop-images">) {
  const [{ id }, auth] = await Promise.all([ctx.params, authed()]);
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase, user } = auth;
  if (!isUuid(id)) return jsonError("not_found", 404);

  const body = await req.json().catch(() => null);
  const { contentType, size } = body ?? {};
  if (
    typeof contentType !== "string" ||
    !(UPLOAD_MIME as readonly string[]).includes(contentType) ||
    typeof size !== "number" ||
    !Number.isFinite(size) ||
    size <= 0 ||
    size > UPLOAD_LIMIT_BYTES
  ) {
    return jsonError("invalid_image", 400);
  }
  const denied = await guard(supabase, id);
  if (denied) return denied;

  const folder = folderOf(user.id, id);
  const names = await listAll(supabase, folder);
  if (!names) return jsonError("internal_error", 500);
  // 여기는 빨리 알려 주기 위한 검사다. 최종 방어선은 스토리지 insert 정책(연출 소유 확인 + 폴더당 상한)이다.
  if (names.length >= UPLOADS_PER_SEQUENCE) return jsonError("image_limit", 409);

  const path = `${folder}/${crypto.randomUUID()}.${EXT[contentType]}`;
  const { data, error } = await supabase.storage.from(BACKDROP_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return jsonError("internal_error", 500);
  return Response.json({ path, uploadUrl: data.signedUrl }, { status: 201, headers: NO_STORE });
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/sequences/[id]/backdrop-images">) {
  const [{ id }, auth] = await Promise.all([ctx.params, authed()]);
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase, user } = auth;
  if (!isUuid(id)) return jsonError("not_found", 404);

  const path = new URL(req.url).searchParams.get("path");
  if (!ownFileName(path, folderOf(user.id, id))) return jsonError("invalid_image", 400);

  const { data: row, error } = await supabase.from("stage_sequences").select("status, items, scene_edit").eq("id", id).maybeSingle();
  if (error) return jsonError("internal_error", 500);
  if (!row) return jsonError("not_found", 404);
  if (row.status !== "approved") return jsonError("not_approved", 409);

  // 먼저 참조를 끊는다. 객체 삭제가 실패해도 화면이 사라진 이미지를 가리키지 않는다.
  const edit = parseSceneEdit(row.scene_edit, Array.isArray(row.items) ? row.items.length : 0);
  if (edit?.backdrop?.mode === "image" && edit.backdrop.image.kind === "upload" && edit.backdrop.image.path === path) {
    const { error: resetError } = await supabase
      .from("stage_sequences")
      // 원본 scene_edit 에서 backdrop 만 바꾼다(파서가 버린 깨진 부분까지 지우지 않는다)
      .update({ scene_edit: { ...(row.scene_edit as object), backdrop: { mode: "auto" } } })
      .eq("id", id)
      .eq("status", "approved")
      .eq("user_id", user.id);
    if (resetError) return jsonError("internal_error", 500);
  }
  const { error: removeError } = await supabase.storage.from(BACKDROP_BUCKET).remove([path!]);
  if (removeError) return jsonError("internal_error", 500);
  return Response.json({ ok: true });
}
