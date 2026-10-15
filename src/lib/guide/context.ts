// src/lib/guide/context.ts
import { type ArtistSection } from "@/lib/guide/sections";

export type GuideContext = { view: "orbit" | "tour"; slug?: string; section?: ArtistSection };

const ARTIST_PATH = /^\/artists\/([^/]+)\/?$/;

// 주소(URL)가 유일한 진실이다. 패널이 없는 화면(staff 등)은 null
export function contextFromPath(pathname: string, section: ArtistSection | null): GuideContext | null {
  if (pathname === "/") return { view: "orbit" };
  const m = ARTIST_PATH.exec(pathname);
  if (!m) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  return section ? { view: "tour", slug, section } : { view: "tour", slug };
}
