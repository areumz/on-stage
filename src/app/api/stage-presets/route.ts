import { getArtistId } from "@/lib/data";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const artistSlug = new URL(request.url).searchParams.get("artist");
  if (!artistSlug) return Response.json({ error: "bad request" }, { status: 400 });

  const supabase = await createServerSupabase();
  const artistId = await getArtistId(supabase, artistSlug);
  if (!artistId) return Response.json({ error: "artist not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("stage_presets")
    .select("id, name, state")
    .eq("artist_id", artistId)
    .order("name", { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ presets: data });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const artistSlug = body?.artistSlug;
  const name = body?.name;
  const state = body?.state;
  if (!artistSlug || !name || !state) return Response.json({ error: "bad request" }, { status: 400 });

  const artistId = await getArtistId(supabase, artistSlug);
  if (!artistId) return Response.json({ error: "artist not found" }, { status: 404 });

  const row = { user_id: user.id, artist_id: artistId, name, state };

  if (body.overwrite) {
    const { data, error } = await supabase
      .from("stage_presets")
      .upsert(row, { onConflict: "user_id,artist_id,name" })
      .select("id")
      .single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ id: data.id }, { status: 201 });
  }

  const { data, error } = await supabase.from("stage_presets").insert(row).select("id").single();
  if (error) {
    // 23505 = unique_violation (user_id, artist_id, name) — overwrite 없이 같은 이름 재저장 시도
    if (error.code === "23505") return Response.json({ error: "duplicate" }, { status: 409 });
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ id: data.id }, { status: 201 });
}
