import { getArtistId } from "@/lib/data";
import { parsePresetScene, STUDIO_FOLDER, type PresetScene } from "@/lib/stage/scene";
import { ownFileName } from "@/app/api/sequences/backdropStorage";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const artistSlug = new URL(request.url).searchParams.get("artist");
  if (!artistSlug) return Response.json({ error: "bad request" }, { status: 400 });

  const [supabase, artistId] = await Promise.all([createServerSupabase(), getArtistId(artistSlug)]);
  if (!artistId) return Response.json({ error: "artist not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("stage_presets")
    .select("id, name, state, scene")
    .eq("artist_id", artistId)
    .order("name", { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // scene 이 null 이면 "장면 없음"이라 그대로 내림. 값이 있으면 모양이 깨졌어도 안전한 값으로 정리.
  const presets = data.map((p) => ({ ...p, scene: p.scene == null ? null : parsePresetScene(p.scene) }));
  return Response.json({ presets });
}

// 업로드 이미지는 내 <uid>/studio/<파일> 만 프리셋에 심을 수 있음. 아니면 image 를 비움(샘플은 그대로).
function ownScene(scene: PresetScene, userId: string): PresetScene {
  const img = scene.image;
  return img?.kind === "upload" && !ownFileName(img.path, `${userId}/${STUDIO_FOLDER}`) ? { ...scene, image: null } : scene;
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

  const artistId = await getArtistId(artistSlug);
  if (!artistId) return Response.json({ error: "artist not found" }, { status: 404 });

  // scene 은 선택. 키 자체를 안 보내면(또는 객체가 아니면) row 에서 빼서, overwrite upsert 가 기존 scene 을 건드리지 않게 한다.
  // 명시적 null 은 "장면 없음"으로 지움.
  const sceneRaw = body.scene;
  const sceneValid = sceneRaw === null || (typeof sceneRaw === "object" && !Array.isArray(sceneRaw));
  const row = {
    user_id: user.id,
    artist_id: artistId,
    name,
    state,
    ...(sceneValid ? { scene: sceneRaw === null ? null : ownScene(parsePresetScene(sceneRaw), user.id) } : {}),
  };

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
