import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { toMetricsView } from "@/lib/metricsView";
import type {
  Artist,
  ArtistMetricsRow,
  ArtistRow,
  GalleryImageRow,
  GalleryListItem,
  Metrics,
  ShowRow,
  ShowStatusRow,
  TrackRow,
} from "@/lib/types";

const ARTIST_SELECT = "*, tracks(*), shows(*), gallery_images(*)";

type ArtistJoinRow = ArtistRow & {
  tracks: TrackRow[];
  shows: ShowRow[];
  gallery_images: GalleryImageRow[];
};

function orderedArtistQuery(supabase: SupabaseClient) {
  return supabase
    .from("artists")
    .select(ARTIST_SELECT)
    .order("no", { referencedTable: "tracks" })
    .order("show_date", { referencedTable: "shows" })
    .order("sort_order", { referencedTable: "gallery_images" });
}

function toGalleryPhoto(g: GalleryImageRow, supabase: SupabaseClient) {
  return {
    src: supabase.storage.from("gallery").getPublicUrl(g.storage_path).data.publicUrl,
    creator: g.creator ?? "",
    license: g.license ?? "",
    origin: g.origin ?? "",
  };
}

function toArtist(row: ArtistJoinRow, supabase: SupabaseClient): Artist {
  return {
    slug: row.slug,
    name: row.name,
    nameKo: row.name_ko,
    color: row.color,
    initials: row.initials,
    orbit: row.orbit,
    angle: row.angle,
    size: row.size,
    news: row.news,
    tour: { badge: row.tour_badge, titleKo: row.tour_title_ko, year: row.tour_year },
    stats: {
      cities: row.shows.length,
      countries: new Set(row.shows.map((s) => s.country)).size,
      tracks: row.stat_tracks,
    },
    cities: row.shows.flatMap((s) => (s.featured ? [{ code: s.city_code, name: s.city_name, date: s.show_date }] : [])),
    tracks: row.tracks.map((t) => ({
      no: t.no,
      title: t.title,
      duration: t.duration,
      cover: { from: t.cover_from, to: t.cover_to },
    })),
    gallery: row.gallery_images.map((g) => toGalleryPhoto(g, supabase)),
  };
}

export async function getArtists(): Promise<Artist[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await orderedArtistQuery(supabase);
  if (error) throw new Error(`getArtists: ${error.message}`);
  return (data as ArtistJoinRow[]).map((row) => toArtist(row, supabase));
}

export async function getArtist(slug: string): Promise<Artist | undefined> {
  const supabase = await createServerSupabase();
  const { data, error } = await orderedArtistQuery(supabase).eq("slug", slug).maybeSingle();
  if (error) throw new Error(`getArtist: ${error.message}`);
  return data ? toArtist(data as ArtistJoinRow, supabase) : undefined;
}

export const DEFAULT_METRICS_SLUG = "aurora";

export async function getArtistId(supabase: SupabaseClient, slug: string): Promise<string | undefined> {
  const { data, error } = await supabase.from("artists").select("id").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`getArtistId: ${error.message}`);
  return data?.id;
}

export async function getArtistMetrics(slug: string): Promise<ArtistMetricsRow | undefined> {
  const supabase = await createServerSupabase();
  const artistId = await getArtistId(supabase, slug);
  if (!artistId) return undefined;
  const { data, error } = await supabase.from("artist_metrics").select("*").eq("artist_id", artistId).maybeSingle();
  if (error) throw new Error(`getArtistMetrics: ${error.message}`);
  return data ?? undefined;
}

export async function getNextShow(slug: string): Promise<ShowStatusRow | null> {
  const supabase = await createServerSupabase();
  const artistId = await getArtistId(supabase, slug);
  if (!artistId) return null;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("show_status")
    .select("*")
    .eq("artist_id", artistId)
    .gte("show_date", today)
    .order("show_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getNextShow: ${error.message}`);
  return data ?? null;
}

// 대시보드 '도시별 예매 현황' 차트용. A탭 투어 궤도와 같은 featured 도시 집합을 재사용해
// "표기 도시 수"가 화면마다 따로 노는 걸 막는다.
export async function getFeaturedShows(slug: string): Promise<ShowStatusRow[]> {
  const supabase = await createServerSupabase();
  const artistId = await getArtistId(supabase, slug);
  if (!artistId) return [];
  const { data, error } = await supabase
    .from("show_status")
    .select("*")
    .eq("artist_id", artistId)
    .eq("featured", true)
    .order("show_date", { ascending: true });
  if (error) throw new Error(`getFeaturedShows: ${error.message}`);
  return data ?? [];
}

export async function getMetrics(slug: string): Promise<Metrics | undefined> {
  const metrics = await getArtistMetrics(slug);
  if (!metrics) return undefined;
  const [nextShow, featuredShows] = await Promise.all([getNextShow(slug), getFeaturedShows(slug)]);
  return toMetricsView(metrics, nextShow, featuredShows, new Date());
}

// 헤더/사이드바 라벨 + 편집 게이트용 role 판정. app_metadata.role이 "owner"면 관리자, 그 외(공유 데모 계정 포함)는 게스트
export async function getStaffRole(): Promise<{ isOwner: boolean; label: "관리자" | "게스트" }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.app_metadata?.role === "owner";
  return { isOwner, label: isOwner ? "관리자" : "게스트" };
}

// B탭 투어 일정 관리 화면 목록. getGalleryImages와 동일 패턴(원본 행 그대로, 화면용 타입 변환 없음).
export async function getShows(slug: string): Promise<ShowRow[]> {
  const supabase = await createServerSupabase();
  const artistId = await getArtistId(supabase, slug);
  if (!artistId) return [];
  const { data, error } = await supabase
    .from("shows")
    .select("*")
    .eq("artist_id", artistId)
    .order("show_date", { ascending: true });
  if (error) throw new Error(`getShows: ${error.message}`);
  return data ?? [];
}

// /staff/tours 폼의 위치 선택 드롭다운용. 아티스트 구분 없이 전체 shows에서 (도시코드, 도시명, 국가,
// 베뉴) 조합 기준으로 중복 제거한 목록 — 오타 방지가 목적이라 이미 한 번이라도 쓰인 조합만 노출한다.
// 같은 도시라도 베뉴가 다르면(아티스트마다 해시로 다른 베뉴가 나옴) 별개 옵션으로 남긴다.
// supabase-js에 다중 컬럼 DISTINCT가 없어 전체를 읽어와 JS에서 직접 중복 제거한다.
export async function getKnownLocations(): Promise<{ cityCode: string; cityName: string; country: string; venue: string }[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("shows").select("city_code, city_name, country, venue").order("city_code");
  if (error) throw new Error(`getKnownLocations: ${error.message}`);
  const seen = new Map(
    (data ?? []).map((row) => [
      `${row.city_code}::${row.venue}`,
      { cityCode: row.city_code, cityName: row.city_name, country: row.country, venue: row.venue },
    ]),
  );
  return [...seen.values()];
}

// B탭 갤러리 관리 화면 목록. id를 포함해 GalleryPhoto보다 하나 더 (삭제 버튼 필요로 함).
export async function getGalleryImages(slug: string): Promise<GalleryListItem[]> {
  const supabase = await createServerSupabase();
  const artistId = await getArtistId(supabase, slug);
  if (!artistId) return [];
  const { data, error } = await supabase
    .from("gallery_images")
    .select("*")
    .eq("artist_id", artistId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`getGalleryImages: ${error.message}`);
  return (data as GalleryImageRow[]).map((g) => ({ id: g.id, ...toGalleryPhoto(g, supabase) }));
}
