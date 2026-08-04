import artistsData from "@/data/artists.json";
import metricsData from "@/data/metrics.json";
import type { Artist, Metrics } from "@/lib/types";

// 검증용 바인딩: JSON 필드 누락·타입 불일치 빌드에서 잡음
const artists: Artist[] = artistsData.artists;
// 아티스트 slug → 지표. 대시보드 아티스트 선택기가 이 맵을 조회함.
const metrics: Record<string, Metrics> = metricsData;

export function getArtists(): Artist[] {
  return artists;
}

export function getArtist(slug: string): Artist | undefined {
  return artists.find((a) => a.slug === slug);
}

export const DEFAULT_METRICS_SLUG = "aurora";

export function getMetrics(slug: string): Metrics | undefined {
  // slug는 URL에서 그대로 들어오는 값. 그냥 인덱싱하면 프로토타입 체인까지 타서
  // ?slug=constructor는 함수를(500), ?slug=__proto__는 {}를(가짜 200) 돌려줄 수 있으므로 방어 코드 추가
  return Object.hasOwn(metrics, slug) ? metrics[slug] : undefined;
}
