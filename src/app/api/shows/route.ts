import { getArtistId } from "@/lib/data";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { artistSlug, cityCode, cityName, country, venue, showDate, capacity } = body ?? {};
  if (!artistSlug || !cityCode || !cityName || !country || !venue || !showDate || !capacity) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const capacityNum = Number(capacity);
  if (!Number.isFinite(capacityNum) || capacityNum <= 0) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const artistId = await getArtistId(artistSlug);
  if (!artistId) return Response.json({ error: "artist not found" }, { status: 404 });

  // 같은 아티스트가 같은 날짜에 이미 공연이 있는지 먼저 확인
  const { data: sameDateShows } = await supabase
    .from("shows")
    .select("city_code")
    .eq("artist_id", artistId)
    .eq("show_date", showDate);
  if (sameDateShows && sameDateShows.length > 0) {
    const sameCity = sameDateShows.some((s) => s.city_code === cityCode);
    return Response.json({ error: sameCity ? "duplicate" : "date_conflict" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("shows")
    .insert({
      artist_id: artistId,
      city_code: cityCode,
      city_name: cityName,
      country,
      venue,
      show_date: showDate,
      capacity: capacityNum,
      featured: Boolean(body.featured),
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return Response.json({ error: "duplicate" }, { status: 409 });
    // 역할 스코프 RLS의 WITH CHECK 거부 — 데모 계정 등 오너가 아닌 세션의 insert는 조용히
    // 실패하지 않고 이 에러 코드를 던진다(DELETE/PATCH의 "0행"과 다른 경로, design-v2.md §7.2)
    if (error.code === "42501") return Response.json({ error: "forbidden" }, { status: 403 });
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ id: data.id }, { status: 201 });
}
