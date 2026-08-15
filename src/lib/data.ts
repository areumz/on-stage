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

// 헤더/사이드바에 표시할 역할 라벨. app_metadata.role이 "owner"면 관리자, 그 외(공유 데모 계정 포함)는 게스트
export async function getStaffRoleLabel(): Promise<"관리자" | "게스트"> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.app_metadata?.role === "owner" ? "관리자" : "게스트";
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
