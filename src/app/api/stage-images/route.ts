import type { NextRequest } from "next/server";
import { authed, jsonError } from "@/lib/director/http";
import { STUDIO_FOLDER, UPLOAD_LIMIT_BYTES, UPLOAD_MIME, UPLOADS_PER_STUDIO } from "@/lib/stage/scene";
import { BACKDROP_BUCKET, listAll, ownFileName, signImages } from "../sequences/backdropStorage";

// "무대 연출" 메뉴(/staff/stage)용 내 이미지. 연출과 무관해서 <uid>/studio/<uuid>.<ext> 한 폴더에 안전 상한(UPLOADS_PER_STUDIO)까지.
// 규칙은 /api/sequences/[id]/backdrop-images 와 같다(서명 URL 은 <img>/텍스처에만, no-store, 로그 금지).
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const NO_STORE = { "Cache-Control": "no-store" };
const folderOf = (userId: string) => `${userId}/${STUDIO_FOLDER}`;

export async function GET() {
  const auth = await authed();
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase, user } = auth;

  const folder = folderOf(user.id);
  const names = await listAll(supabase, folder);
  if (!names) return jsonError("internal_error", 500);

  const images = await signImages(supabase, folder, names.slice(0, UPLOADS_PER_STUDIO));
  return Response.json({ images }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const auth = await authed();
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase, user } = auth;

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

  const folder = folderOf(user.id);
  const names = await listAll(supabase, folder);
  if (!names) return jsonError("internal_error", 500);
  // 빨리 알려 주기 위한 검사다. 최종 방어선은 스토리지 insert 정책(폴더당 상한)이다.
  if (names.length >= UPLOADS_PER_STUDIO) return jsonError("image_limit", 409);

  const path = `${folder}/${crypto.randomUUID()}.${EXT[contentType]}`;
  const { data, error } = await supabase.storage.from(BACKDROP_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return jsonError("internal_error", 500);
  return Response.json({ path, uploadUrl: data.signedUrl }, { status: 201, headers: NO_STORE });
}

export async function DELETE(req: NextRequest) {
  const auth = await authed();
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase, user } = auth;

  const path = new URL(req.url).searchParams.get("path");
  if (!ownFileName(path, folderOf(user.id))) return jsonError("invalid_image", 400);

  // 먼저 이 이미지를 쓰던 내 프리셋의 image 를 비운다(다른 필드는 그대로). 객체 삭제가 실패해도 깨진 참조가 남지 않는다.
  const { data: used, error } = await supabase
    .from("stage_presets")
    .select("id, scene")
    .eq("user_id", user.id)
    .filter("scene->image->>path", "eq", path);
  if (error) return jsonError("internal_error", 500);
  for (const p of used ?? []) {
    const { error: e } = await supabase
      .from("stage_presets")
      .update({ scene: { ...(p.scene as object), image: null } })
      .eq("id", p.id)
      .eq("user_id", user.id);
    if (e) return jsonError("internal_error", 500);
  }

  const { error: removeError } = await supabase.storage.from(BACKDROP_BUCKET).remove([path!]);
  if (removeError) return jsonError("internal_error", 500);
  return Response.json({ ok: true });
}
