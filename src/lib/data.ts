import artistsData from "@/data/artists.json";
import type { Artist } from "@/lib/types";

// 검증용 바인딩: JSON 필드 누락·타입 불일치 빌드에서 잡음
const artists: Artist[] = artistsData.artists;

export function getArtists(): Artist[] {
  return artists;
}

export function getArtist(slug: string): Artist | undefined {
  return artists.find((a) => a.slug === slug);
}
