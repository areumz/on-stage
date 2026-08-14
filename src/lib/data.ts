import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import metricsData from "@/data/metrics.json";
import type { Artist, ArtistRow, GalleryImageRow, Metrics, ShowRow, TrackRow } from "@/lib/types";

// 아티스트 slug → 지표. 대시보드 아티스트 선택기가 이 맵을 조회함.
// TODO(Task 5): DB의 artist_metrics 뷰로 교체. 그때까지 JSON 경로를 유지해 대시보드가 깨지지 않게 한다.
const metrics: Record<string, Metrics> = metricsData;

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
    cities: row.shows
      .filter((s) => s.featured)
      .map((s) => ({ code: s.city_code, name: s.city_name, date: s.show_date })),
    tracks: row.tracks.map((t) => ({
      no: t.no,
      title: t.title,
      duration: t.duration,
      cover: { from: t.cover_from, to: t.cover_to },
    })),
    gallery: row.gallery_images.map((g) => ({
      src: supabase.storage.from("gallery").getPublicUrl(g.storage_path).data.publicUrl,
      creator: g.creator ?? "",
      license: g.license ?? "",
      origin: g.origin ?? "",
    })),
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

export function getMetrics(slug: string): Metrics | undefined {
  // slug는 URL에서 그대로 들어오는 값. 그냥 인덱싱하면 프로토타입 체인까지 타서
  // ?slug=constructor는 함수를(500), ?slug=__proto__는 {}를(가짜 200) 돌려줄 수 있으므로 방어 코드 추가
  return Object.hasOwn(metrics, slug) ? metrics[slug] : undefined;
}
