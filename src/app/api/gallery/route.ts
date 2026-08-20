import { getArtistId } from "@/lib/data";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const artistSlug = body?.artistSlug;
  const path = body?.path;
  if (!artistSlug || !path) return Response.json({ error: "bad request" }, { status: 400 });

  const artistId = await getArtistId(artistSlug);
  if (!artistId) return Response.json({ error: "artist not found" }, { status: 404 });

  // sort_order를 안 주면 기본값 0으로 깔려 기존 이미지들과 뒤섞임
  // 맨 뒤에 붙도록 현재 최댓값+1을 계산해서 넣음
  const { data: maxRow } = await supabase
    .from("gallery_images")
    .select("sort_order")
    .eq("artist_id", artistId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("gallery_images")
    // created_by는 세션 uid로 서버가 채운다 — 클라이언트가 보낸 값을 신뢰하지 않는다 (§4.6 주의 4)
    .insert({
      artist_id: artistId,
      storage_path: path,
      creator: body.creator || null,
      license: body.license || null,
      origin: body.origin || null,
      sort_order: nextSortOrder,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ id: data.id }, { status: 201 });
}
