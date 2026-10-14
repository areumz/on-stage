import { MAX_BYTES, MAX_DURATION_BLOCK_SEC, MAX_TITLE_LENGTH } from "@/lib/audio/limits";
import { canonicalContentType, extensionOf } from "@/lib/audio/validate";
import { authed, isUuid, jsonError } from "@/lib/director/http";

// 행을 먼저 만들고 서명 업로드 URL 을 받는다. 브라우저가 Storage 에 직접 PUT 하므로 Vercel 바디 제한과 무관하다.
// 여기 검사는 빨리 알려주기 위한 것이고, 진짜 경계는 버킷 설정과 DB check 다.
export async function POST(request: Request) {
  const auth = await authed();
  if (!auth) return jsonError("unauthorized", 401);
  const { supabase, user } = auth;

  const body = await request.json().catch(() => null);
  const { artistId, filename, size, durationSec } = body ?? {};
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (
    !isUuid(artistId) ||
    typeof filename !== "string" ||
    typeof size !== "number" ||
    !Number.isFinite(size) ||
    size <= 0 ||
    typeof durationSec !== "number" ||
    !Number.isFinite(durationSec) ||
    durationSec <= 0 ||
    durationSec > MAX_DURATION_BLOCK_SEC ||
    title.length < 1 ||
    title.length > MAX_TITLE_LENGTH
  ) {
    return jsonError("bad_request", 400);
  }
  // contentType 은 클라이언트 값을 받지 않고 확장자로 정한다
  const ext = extensionOf(filename);
  if (!ext || !canonicalContentType(filename)) return jsonError("unsupported_type", 415);
  if (size > MAX_BYTES) return jsonError("too_large", 413);

  const { data: artist, error: artistError } = await supabase.from("artists").select("id").eq("id", artistId).maybeSingle();
  if (artistError) return jsonError("internal_error", 500);
  if (!artist) return jsonError("artist_not_found", 404);

  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { data: track, error: insertError } = await supabase
    .from("audio_tracks")
    .insert({ artist_id: artistId, title, storage_path: path, duration_sec: durationSec })
    .select("id")
    .single();
  if (insertError || !track) return jsonError("internal_error", 500);

  const { data: signed, error: signError } = await supabase.storage.from("audio-tracks").createSignedUploadUrl(path);
  if (signError || !signed) {
    // 업로드할 수 없는 행이 남지 않게 지운다
    await supabase.from("audio_tracks").delete().eq("id", track.id);
    return jsonError("internal_error", 500);
  }

  return Response.json({ trackId: track.id, signedUrl: signed.signedUrl }, { status: 201 });
}
