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
  d.setUTCDate(d.getUTCDate() + days);
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

// 도시 배열의 원래 순서(=featured 우선, 그중에서도 항상 서울이 0번)로 날짜·venue를 정하면
// "다음 공연"이 전 아티스트에서 항상 같은 도시·같은 venue가 된다. artist+도시 해시로 순위를 다시
// 매겨 날짜를, 별도 해시로 venue 접미사를 골라 배열 위치와의 우연한 결합을 끊는다.
function rankCitiesByHash(artist, cities) {
  return [...cities]
    .map((city) => ({ city, key: hashCode(artist.slug + city.code) }))
    .sort((a, b) => a.key - b.key)
    .map(({ city }) => city);
}

// 전체 공연이 개별적으로 단조 비감소면 아티스트 합계도 절대 감소할 수 없다(합의 단조성).
// 1차 목업과 metricsView 테스트 둘 다 감소(▼) 사례를 전제하므로, 일부 아티스트를 결정론적으로
// "냉각기"로 지정해 그 아티스트 공연 대부분이 최근 1주일 새 소폭 환불성 하락을 겪게 한다.
function isCoolingArtist(artist) {
  return hashCode(`${artist.slug}::cooling`) % 4 === 0; // slug 해시라 재시드해도 항상 같은 아티스트
}

// shows는 upsert가 아니라 삭제 후 재생성 (결정 2 — show_date가 유니크 키의 일부라 실행마다 새 행이 됨).
// ticket_sales는 FK cascade로 함께 지워지므로 별도 삭제가 필요 없다.
async function recreateShowsAndSales(artist, artistId, today) {
  const { error: delError } = await supabase.from("shows").delete().eq("artist_id", artistId);
  assertNoError(delError, `shows delete (${artist.slug})`);

  const cities = buildCityList(artist);
  const n = cities.length;
  const ranked = rankCitiesByHash(artist, cities);
  const showRows = ranked.map((city, rank) => ({
    artist_id: artistId,
    city_code: city.code,
    city_name: city.name,
    country: city.country,
    venue: `${city.name} ${VENUE_SUFFIXES[hashCode(`${artist.slug}:${city.code}::venue`) % VENUE_SUFFIXES.length]}`,
    show_date: toDateString(addDays(today, Math.round(((rank + 1) * 180) / (n + 1)))),
    capacity: Math.max(2000, 20000 - rank * 700),
    featured: city.featured,
  }));

  const { data: shows, error: insError } = await supabase.from("shows").insert(showRows).select("id, city_code, capacity");
  assertNoError(insError, `shows insert (${artist.slug})`);

  const cooling = isCoolingArtist(artist);
  const salesRows = [];
  for (const show of shows) {
    // 결정론적 최종 예매율 0.55~0.95
    const rate = 0.55 + (0.4 * (hashCode(artist.slug + show.city_code) % 100)) / 100;
    const peakSold = Math.round(show.capacity * Math.min(rate, 0.98));
    // 시작 비율을 고정값(0.45)으로 두면 모든 공연의 램프 '모양'이 같아져서, 14일 선형 보간에서
    // day13/day6 비율이 공연·아티스트와 무관하게 항상 같은 상수가 된다(그래서 전 아티스트가
    // 똑같이 "+42.1%"로 나왔었다). 공연마다 다른 시작 비율을 줘서 증가 폭 자체가 달라지게 한다.
    const startRatio = 0.3 + (hashCode(`${artist.slug}:${show.city_code}::startratio`) % 30) / 100;
    const startSold = Math.round(peakSold * startRatio);

    // 공연별로 확률적(해시 % N)으로 골랐더니 공연 수가 적은 아티스트(lumen 5개)는 표본이 작아
    // 기대 비율(~80%)에서 크게 벗어나 절반도 안 덮이고, 성장폭(30~60%)이 하락폭(3~8%)보다 커서
    // 아티스트 합계가 여전히 양수로 남았다. 냉각기 아티스트는 공연 수와 무관하게 전부 하락시켜
    // 합계가 항상 음수가 되도록 한다 — 하락폭 자체는 공연마다 해시로 다르게 유지한다.
    if (!cooling) {
      // 14일 내내 단조 비감소 — 개막을 앞두고 꾸준히 팔리는 일반적인 경우
      let prevSold = 0;
      for (let d = 0; d < 14; d++) {
        const raw = Math.round(startSold + ((peakSold - startSold) * d) / 13);
        const sold = Math.max(raw, prevSold);
        prevSold = sold;
        salesRows.push({ show_id: show.id, recorded_on: toDateString(addDays(today, d - 13)), sold });
      }
    } else {
      // 환불 시나리오 — 1주차는 peak까지 증가, 2주차는 소폭 하락. sold_prev(7일 전=day6)가
      // sold(오늘=day13)보다 커져서 이 공연은 실제로 감소한다.
      const dipAmount = Math.round(peakSold * (0.03 + (hashCode(`${artist.slug}:${show.city_code}::dipsize`) % 6) / 100));
      let prevSold = 0;
      for (let d = 0; d < 7; d++) {
        const raw = Math.round(startSold + ((peakSold - startSold) * d) / 6);
        const sold = Math.max(raw, prevSold);
        prevSold = sold;
        salesRows.push({ show_id: show.id, recorded_on: toDateString(addDays(today, d - 13)), sold });
      }
      for (let d = 7; d < 14; d++) {
        const sold = Math.round(peakSold - (dipAmount * (d - 6)) / 7);
        salesRows.push({ show_id: show.id, recorded_on: toDateString(addDays(today, d - 13)), sold });
      }
    }
  }
  const { error: salesError } = await supabase.from("ticket_sales").insert(salesRows);
  assertNoError(salesError, `ticket_sales insert (${artist.slug})`);

  console.log(
    `shows/ticket_sales: ${artist.slug} — ${shows.length}개 공연, ${salesRows.length}행 스냅샷${cooling ? " (냉각기)" : ""}`
  );
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
  // 로컬 자정(setHours)을 만든 뒤 toDateString의 toISOString()으로 UTC 변환하면, UTC+지역
  // (KST 등)에서는 그 순간 UTC로는 아직 전날이라 모든 날짜가 하루 밀린다. UTC 자정으로 바로 잡는다.
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

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
