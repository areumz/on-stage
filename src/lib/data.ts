import artistsData from "@/data/artists.json";
import metricsData from "@/data/metrics.json";
import type { Artist, Metrics } from "@/lib/types";

// 검증용 바인딩: JSON 필드 누락·타입 불일치 빌드에서 잡음
const artists: Artist[] = artistsData.artists;
// 아티스트 slug → 지표. 대시보드 아티스트 선택기가 이 맵을 조회한다.
const metrics: Record<string, Metrics> = metricsData;

export function getArtists(): Artist[] {
  return artists;
}

export function getArtist(slug: string): Artist | undefined {
  return artists.find((a) => a.slug === slug);
}

export const DEFAULT_METRICS_SLUG = "aurora";

export function getMetrics(slug: string): Metrics | undefined {
  return metrics[slug];
}
