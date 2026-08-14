// 멱등 시드. npm run seed로 실행 (node --env-file=.env.local).
// 원본은 src/data/artists.json · public/gallery/*.jpg — DB로 옮겨도 지우지 않는다 (§4.7 주의).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// README에 공개되는 계정이라 코드에 고정한다 (§4.4 — 오너 계정만 비밀번호를 비공개로 둔다)
const DEMO_EMAIL = "demo@onstage.local";
const DEMO_PASSWORD = "demo1234";

// artists.json에 없는 셰이더 파라미터 4개. slug별 고정 매핑 (§4.1 default 기준, 아티스트마다 다르게)
const SHADER_BY_SLUG = {
  aurora: { pattern: "wave", freq: 9, falloff: 0.75, speed: 0.5 },
  velvet: { pattern: "ripple", freq: 7, falloff: 0.65, speed: 0.4 },
  nova: { pattern: "grain", freq: 12, falloff: 0.85, speed: 0.7 },
  halo: { pattern: "wave", freq: 6, falloff: 0.55, speed: 0.35 },
  lumen: { pattern: "ripple", freq: 10, falloff: 0.7, speed: 0.55 },
  echo: { pattern: "grain", freq: 14, falloff: 0.9, speed: 0.8 },
};

// artists.json의 cities[]에 있는 도시(4개 이하, featured)의 국가. shows를 stats.cities 개수까지
// 채우려면 여기 없는 도시도 필요하다 — 아래 EXTRA_CITY_POOL이 그 나머지를 댄다 (결정 2 참조).
const COUNTRY_BY_CODE = {
  SEO: "South Korea", BUS: "South Korea", ICN: "South Korea", DJN: "South Korea", DGU: "South Korea",
  TYO: "Japan", OSA: "Japan",
  LA: "USA",
  LDN: "UK",
  TPE: "Taiwan",
  HKG: "Hong Kong",
  BKK: "Thailand",
  SIN: "Singapore",
};

// stats.cities가 cities[] 길이(최대 4)보다 많은 아티스트(아우로라 24 등)를 채우기 위한 추가 도시 풀.
// COUNTRY_BY_CODE와 코드가 겹치지 않는다.
const EXTRA_CITY_POOL = [
  { code: "NYC", name: "뉴욕", country: "USA" },
  { code: "PAR", name: "파리", country: "France" },
  { code: "BER", name: "베를린", country: "Germany" },
  { code: "MAD", name: "마드리드", country: "Spain" },
  { code: "ROM", name: "로마", country: "Italy" },
  { code: "TOR", name: "토론토", country: "Canada" },
  { code: "SYD", name: "시드니", country: "Australia" },
  { code: "MEL", name: "멜버른", country: "Australia" },
  { code: "AMS", name: "암스테르담", country: "Netherlands" },
  { code: "STO", name: "스톡홀름", country: "Sweden" },
  { code: "VIE", name: "비엔나", country: "Austria" },
  { code: "ZUR", name: "취리히", country: "Switzerland" },
  { code: "DXB", name: "두바이", country: "UAE" },
  { code: "MNL", name: "마닐라", country: "Philippines" },
  { code: "JKT", name: "자카르타", country: "Indonesia" },
  { code: "KUL", name: "쿠알라룸푸르", country: "Malaysia" },
  { code: "MEX", name: "멕시코시티", country: "Mexico" },
  { code: "SAO", name: "상파울루", country: "Brazil" },
  { code: "BUE", name: "부에노스아이레스", country: "Argentina" },
  { code: "CHI", name: "시카고", country: "USA" },
  { code: "SFO", name: "샌프란시스코", country: "USA" },
  { code: "VAN", name: "밴쿠버", country: "Canada" },
  { code: "GLA", name: "글래스고", country: "UK" },
  { code: "MAN", name: "맨체스터", country: "UK" },
  { code: "MIL", name: "밀라노", country: "Italy" },
  { code: "LIS", name: "리스본", country: "Portugal" },
  { code: "WAR", name: "바르샤바", country: "Poland" },
  { code: "HEL", name: "헬싱키", country: "Finland" },
  { code: "OSL", name: "오슬로", country: "Norway" },
  { code: "AUC", name: "오클랜드", country: "New Zealand" },
];

const VENUE_SUFFIXES = ["아레나", "스타디움", "공연장", "홀"];

function hashCode(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function assertNoError(error, context) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

// 아티스트별로 stats.cities 개수만큼 도시 목록을 만든다. 앞쪽은 artists.json의 cities(featured=true),
// 나머지는 EXTRA_CITY_POOL에서 slug 기반 오프셋으로 결정론적으로 채운다 (주의 4번 — 난수 금지).
function buildCityList(artist) {
  const featured = artist.cities.map((c) => ({
    code: c.code,
    name: c.name,
    country: COUNTRY_BY_CODE[c.code],
    featured: true,
  }));
  const extraNeeded = artist.stats.cities - featured.length;
  if (extraNeeded <= 0) return featured;

  const offset = hashCode(artist.slug) % EXTRA_CITY_POOL.length;
  const extra = [];
  for (let i = 0; i < extraNeeded; i++) {
    const pick = EXTRA_CITY_POOL[(offset + i) % EXTRA_CITY_POOL.length];
    extra.push({ code: pick.code, name: pick.name, country: pick.country, featured: false });
  }
  return [...featured, ...extra];
}

async function upsertArtists(artistsJson) {
  const rows = artistsJson.artists.map((a) => {
    const shader = SHADER_BY_SLUG[a.slug];
    return {
      slug: a.slug,
      name: a.name,
      name_ko: a.nameKo,
      color: a.color,
      initials: a.initials,
      orbit: a.orbit,
      angle: a.angle,
      size: a.size,
      news: a.news,
      tour_badge: a.tour.badge,
      tour_title_ko: a.tour.titleKo,
      tour_year: a.tour.year,
      stat_tracks: a.stats.tracks,
      shader_pattern: shader.pattern,
      shader_freq: shader.freq,
      shader_falloff: shader.falloff,
      shader_speed: shader.speed,
    };
  });
  const { data, error } = await supabase.from("artists").upsert(rows, { onConflict: "slug" }).select("id, slug");
  assertNoError(error, "artists upsert");

  const idBySlug = new Map(data.map((row) => [row.slug, row.id]));
  console.log(`artists: ${data.length}행 upsert`);
  return idBySlug;
}

async function upsertTracks(artist, artistId) {
  const rows = artist.tracks.map((t) => ({
    artist_id: artistId,
    no: t.no,
    title: t.title,
    duration: t.duration,
    cover_from: t.cover.from,
    cover_to: t.cover.to,
  }));
  const { error } = await supabase.from("tracks").upsert(rows, { onConflict: "artist_id,no" });
  assertNoError(error, `tracks upsert (${artist.slug})`);
}

// shows는 upsert가 아니라 삭제 후 재생성 (결정 2 — show_date가 유니크 키의 일부라 실행마다 새 행이 됨).
// ticket_sales는 FK cascade로 함께 지워지므로 별도 삭제가 필요 없다.
async function recreateShowsAndSales(artist, artistId, today) {
  const { error: delError } = await supabase.from("shows").delete().eq("artist_id", artistId);
  assertNoError(delError, `shows delete (${artist.slug})`);

  const cities = buildCityList(artist);
  const n = cities.length;
  const showRows = cities.map((city, i) => ({
    artist_id: artistId,
    city_code: city.code,
    city_name: city.name,
    country: city.country,
    venue: `${city.name} ${VENUE_SUFFIXES[i % VENUE_SUFFIXES.length]}`,
    show_date: toDateString(addDays(today, Math.round(((i + 1) * 180) / (n + 1)))),
    capacity: Math.max(2000, 20000 - i * 700),
    featured: city.featured,
  }));

  const { data: shows, error: insError } = await supabase.from("shows").insert(showRows).select("id, city_code, capacity");
  assertNoError(insError, `shows insert (${artist.slug})`);

  const salesRows = [];
  for (const show of shows) {
    // 결정론적 최종 예매율 0.55~0.95, 14일에 걸쳐 단조 증가하는 판매량을 만든다.
    const rate = 0.55 + (0.4 * (hashCode(artist.slug + show.city_code) % 100)) / 100;
    const finalSold = Math.round(show.capacity * Math.min(rate, 0.98));
    const startSold = Math.round(finalSold * 0.45);
    let prevSold = 0;
    for (let d = 0; d < 14; d++) {
      const raw = Math.round(startSold + ((finalSold - startSold) * d) / 13);
      const sold = Math.max(raw, prevSold);
      prevSold = sold;
      salesRows.push({
        show_id: show.id,
        recorded_on: toDateString(addDays(today, d - 13)),
        sold,
      });
    }
  }
  const { error: salesError } = await supabase.from("ticket_sales").insert(salesRows);
  assertNoError(salesError, `ticket_sales insert (${artist.slug})`);

  console.log(`shows/ticket_sales: ${artist.slug} — ${shows.length}개 공연, ${salesRows.length}행 스냅샷`);
}

async function uploadGallery(artist, artistId) {
  const rows = [];
  for (let i = 0; i < artist.gallery.length; i++) {
    const img = artist.gallery[i];
    const filename = path.basename(img.src);
    const storagePath = `${artist.slug}/${filename}`;
    const bytes = readFileSync(path.join("public/gallery", filename));

    const { error: uploadError } = await supabase.storage
      .from("gallery")
      .upload(storagePath, bytes, { contentType: "image/jpeg", upsert: true });
    assertNoError(uploadError, `storage upload (${storagePath})`);

    rows.push({
      artist_id: artistId,
      storage_path: storagePath,
      creator: img.creator || null,
      license: img.license || null,
      origin: img.origin || null,
      sort_order: i,
      created_by: null, // 시드 행 — 방문자가 못 지운다 (§4.5)
    });
  }
  const { error } = await supabase.from("gallery_images").upsert(rows, { onConflict: "storage_path" });
  assertNoError(error, `gallery_images upsert (${artist.slug})`);
  console.log(`gallery: ${artist.slug} — ${rows.length}장 업로드`);
}

// createUser를 그냥 부르면 두 번째 실행에서 "User already registered"로 죽는다.
// listUsers로 존재를 먼저 확인해 없으면 생성, 있으면 갱신 — 시드가 계정 속성의 단일 진실 공급원이다.
async function upsertAccount(email, password, appMetadata) {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers();
  assertNoError(listError, `listUsers (${email})`);
  const existing = list.users.find((u) => u.email === email);

  if (!existing) {
    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: appMetadata,
    });
    assertNoError(error, `createUser (${email})`);
    console.log(`account: ${email} 생성`);
  } else {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      app_metadata: appMetadata,
    });
    assertNoError(error, `updateUserById (${email})`);
    console.log(`account: ${email} 갱신`);
  }
}

async function main() {
  const artistsJson = JSON.parse(readFileSync("src/data/artists.json", "utf-8"));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const idBySlug = await upsertArtists(artistsJson);

  for (const artist of artistsJson.artists) {
    const artistId = idBySlug.get(artist.slug);
    await upsertTracks(artist, artistId);
    await recreateShowsAndSales(artist, artistId, today);
    await uploadGallery(artist, artistId);
  }

  await upsertAccount(DEMO_EMAIL, DEMO_PASSWORD, {});
  await upsertAccount(process.env.SEED_OWNER_EMAIL, process.env.SEED_OWNER_PASSWORD, { role: "owner" });

  console.log("시드 완료");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
