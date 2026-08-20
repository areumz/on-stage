import { getArtistId } from "@/lib/data";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { artistSlug, title, duration, coverFrom, coverTo } = body ?? {};
  if (!artistSlug || !title || !duration || !coverFrom || !coverTo) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const artistId = await getArtistId(supabase, artistSlug);
  if (!artistId) return Response.json({ error: "artist not found" }, { status: 404 });

  // no는 클라이언트가 안 보낸다 — 신규 트랙은 항상 맨 뒤(현재 최댓값+1)에 붙는다.
  // gallery/route.ts의 sort_order 계산과 동일 패턴.
  const { data: maxRow } = await supabase
    .from("tracks")
    .select("no")
    .eq("artist_id", artistId)
    .order("no", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNo = (maxRow?.no ?? 0) + 1;

  const { data, error } = await supabase
    .from("tracks")
    .insert({ artist_id: artistId, no: nextNo, title, duration, cover_from: coverFrom, cover_to: coverTo })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return Response.json({ error: "duplicate" }, { status: 409 });
    // 역할 스코프 RLS의 WITH CHECK 거부 — shows POST와 동일 이유(design-v2.md §7.2 참고)
    if (error.code === "42501") return Response.json({ error: "forbidden" }, { status: 403 });
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ id: data.id }, { status: 201 });
}
