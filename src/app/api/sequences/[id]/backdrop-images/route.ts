import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { authed, isUuid, jsonError } from "@/lib/director/http";
import { UPLOAD_LIMIT_BYTES, UPLOAD_MIME, UPLOADS_PER_SEQUENCE } from "@/lib/stage/scene";
import { BACKDROP_BUCKET, folderOf, listAll, ownFileName, signImages } from "../../backdropStorage";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const NO_STORE = { "Cache-Control": "no-store" };

// 내 승인본만 다룬다. RLS 로 남의 연출은 안 보여 404.
async function guard(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("stage_sequences").select("status").eq("id", id).maybeSingle();
  if (error) return jsonError("internal_error", 500);
  if (!data) return jsonError("not_found", 404);
  return data.status === "approved" ? null : jsonError("not_approved", 409);
}

// 이 path 를 쓰던 곳(구간별 image, 예전 형식의 연출 전체 backdrop)만 바꾼 scene_edit 를 돌려줌. 참조가 없으면 null.
// 원본에서 해당 키만 고침 — 파서가 버릴 깨진 부분이나 다른 구간·필드는 삭제 x
function dropReference(raw: unknown, path: string): Record<string, unknown> | null {
  if (typeof raw !== "object" || raw === null) return null;
  const edit = { ...(raw as Record<string, unknown>) };
  let changed = false;
  const uses = (img: unknown) => (img as { kind?: string; path?: string } | null)?.kind === "upload" && (img as { path?: string }).path === path;
  const b = edit.backdrop as { mode?: string; image?: unknown } | undefined;
  if (b?.mode === "image" && uses(b.image)) {
    edit.backdrop = { mode: "auto" };
    changed = true;
  }
  if (Array.isArray(edit.sections)) {
    edit.sections = edit.sections.map((s: unknown) => {
      if (typeof s !== "object" || s === null || !uses((s as { image?: unknown }).image)) return s;
      changed = true;
      const rest = { ...(s as Record<string, unknown>) };
      delete rest.image;
      return Object.keys(rest).length ? rest : null;
    });
  }
  return changed ? edit : null;
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

  const images = await signImages(supabase, folder, names.slice(0, UPLOADS_PER_SEQUENCE));
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
  // 빨리 알려 주기 위한 검사. 최종 방어선은 스토리지 insert 정책(연출 소유 확인 + 폴더당 상한).
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

  // 참조 해제. 객체 삭제가 실패해도 화면이 사라진 이미지를 가리키지 않도록
  const cleaned = dropReference(row.scene_edit, path!);
  if (cleaned) {
    const { error: resetError } = await supabase
      .from("stage_sequences")
      .update({ scene_edit: cleaned })
      .eq("id", id)
      .eq("status", "approved")
      .eq("user_id", user.id);
    if (resetError) return jsonError("internal_error", 500);
  }
  const { error: removeError } = await supabase.storage.from(BACKDROP_BUCKET).remove([path!]);
  if (removeError) return jsonError("internal_error", 500);
  return Response.json({ ok: true });
}
