// 데모(시드) 곡을 audio_tracks 에 넣는다. `npm run seed:director` (node --env-file=.env.local).
// 멱등: storage_path 가 같으면 갱신한다. 공연·티켓을 다시 만드는 기존 `npm run seed` 와 분리했다.
// 음원은 Storage(audio-tracks/seed/)에 이미 올라가 있어야 한다. 이 스크립트는 올리지 않고 있는지만 확인한다.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const demos = JSON.parse(readFileSync("src/data/director/demos.json", "utf-8"));

function fail(context, error) {
  throw new Error(`${context}: ${error.message}`);
}

async function main() {
  const { data: files, error: listError } = await supabase.storage.from("audio-tracks").list("seed", { limit: 100 });
  if (listError) fail("storage list", listError);
  const present = new Set(files.map((f) => `seed/${f.name}`));

  for (const demo of demos) {
    const { fileHash, durationSec, analysis } = JSON.parse(readFileSync(`src/data/director/${demo.file}.json`, "utf-8"));

    const { data: artist, error: artistError } = await supabase.from("artists").select("id").eq("slug", demo.artistSlug).single();
    if (artistError) fail(`artist (${demo.artistSlug})`, artistError);

    const { error } = await supabase.from("audio_tracks").upsert(
      {
        user_id: null, // 시드 곡: 모든 사용자가 읽고 아무도 고치지 못한다
        artist_id: artist.id,
        title: demo.title,
        storage_path: demo.storagePath,
        file_hash: fileHash,
        duration_sec: durationSec,
        analysis,
        analysis_status: "done",
      },
      { onConflict: "storage_path" },
    );
    if (error) fail(`audio_tracks upsert (${demo.slug})`, error);

    console.log(`audio_tracks: ${demo.slug} upsert${present.has(demo.storagePath) ? "" : " — 경고: Storage 에 음원이 없다 (" + demo.storagePath + ")"}`);
  }
  console.log("데모 시드 완료");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
