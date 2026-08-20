import { createServerSupabase } from "@/lib/supabase/server";
import { forbiddenIfNoRows } from "@/lib/routeHelpers";

const FIELD_MAP: Record<string, string> = {
  cityCode: "city_code",
  cityName: "city_name",
  country: "country",
  venue: "venue",
  showDate: "show_date",
  capacity: "capacity",
  featured: "featured",
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, supabase] = await Promise.all([params, createServerSupabase()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "bad request" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (key in body) patch[column] = key === "capacity" ? Number(body[key]) : body[key];
  }
  if (Object.keys(patch).length === 0) return Response.json({ error: "bad request" }, { status: 400 });

  // POST와 동일한 기준 — capacity가 바뀌는 요청이면 유한한 양수인지 확인한다. 이게 없으면
  // 0/음수/빈 값이 DB의 capacity > 0 제약에 걸려 정제 안 된 500으로 노출된다.
  if ("capacity" in patch && (!Number.isFinite(patch.capacity) || (patch.capacity as number) <= 0)) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  // 날짜나 도시가 바뀌는 경우에만 충돌을 재확인한다 — POST와 동일한 규칙(같은 도시면 막고 "회차 추가는
  // 문의", 다른 도시면 무조건 막음). capacity 등 다른 필드만 바뀌는 흔한 경우는 조회를 건너뛴다.
  if ("show_date" in patch || "city_code" in patch) {
    const { data: current } = await supabase.from("shows").select("artist_id, city_code, show_date").eq("id", id).maybeSingle();
    if (current) {
      const finalDate = (patch.show_date as string | undefined) ?? current.show_date;
      const finalCity = (patch.city_code as string | undefined) ?? current.city_code;
      const { data: sameDateShows } = await supabase
        .from("shows")
        .select("city_code")
        .eq("artist_id", current.artist_id)
        .eq("show_date", finalDate)
        .neq("id", id);
      if (sameDateShows && sameDateShows.length > 0) {
        const sameCity = sameDateShows.some((s) => s.city_code === finalCity);
        return Response.json({ error: sameCity ? "duplicate" : "date_conflict" }, { status: 409 });
      }
    }
  }

  const { data, error } = await supabase.from("shows").update(patch).eq("id", id).select("id");
  if (error) {
    if (error.code === "23505") return Response.json({ error: "duplicate" }, { status: 409 });
    return Response.json({ error: error.message }, { status: 500 });
  }
  const forbidden = forbiddenIfNoRows(data);
  if (forbidden) return forbidden;

  return Response.json({}, { status: 200 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, supabase] = await Promise.all([params, createServerSupabase()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  // 소유자 재확인은 하지 않음 — RLS(역할 스코프)가 이미 검사
  const { data, error } = await supabase.from("shows").delete().eq("id", id).select("id");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const forbidden = forbiddenIfNoRows(data);
  if (forbidden) return forbidden;

  return new Response(null, { status: 204 });
}
