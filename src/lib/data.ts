import artistsData from "@/data/artists.json";
import type { Artist } from "@/lib/types";

const artists: Artist[] = artistsData.artists;

export function getArtists(): Artist[] {
  return artists;
}

export function getArtist(slug: string): Artist | undefined {
  return artists.find((a) => a.slug === slug);
}
