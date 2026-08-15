import { createServerSupabase } from "@/lib/supabase/server";

// 버킷 file_size_limit(supabase/migrations/*_init.sql)과 맞춘 값. 라우트 검사는 사용자에게
// 빨리 알려주기 위한 것일 뿐 — 진짜 신뢰 경계는 버킷 설정이다 (§4.5).
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const artistSlug = body?.artistSlug;
  const filename = body?.filename;
  const contentType = body?.contentType;
  const size = body?.size;
  if (!artistSlug || !filename || !contentType || typeof size !== "number") {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(contentType)) {
    return Response.json({ error: "unsupported type" }, { status: 415 });
  }
  if (size > MAX_SIZE) {
    return Response.json({ error: "file too large" }, { status: 413 });
  }

  const ext = filename.includes(".") ? filename.split(".").pop() : "jpg";
  const path = `${artistSlug}/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage.from("gallery").createSignedUploadUrl(path);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ signedUrl: data.signedUrl, path: data.path });
}
