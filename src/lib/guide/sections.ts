// src/lib/guide/sections.ts
// 아티스트 페이지 섹션 값. DOM id와 같다(page.tsx의 hero, TourSection의 tour, AlbumSection의 album, GallerySection의 gallery).
export const ARTIST_SECTIONS = ["hero", "tour", "album", "gallery"] as const;
export type ArtistSection = (typeof ARTIST_SECTIONS)[number];

export function isSection(v: unknown): v is ArtistSection {
  return (ARTIST_SECTIONS as readonly unknown[]).includes(v);
}

// 현재 보고 있는 섹션. 요청을 보내는 순간에만 읽으므로 React state가 아닌 모듈 변수로 둔다
// (스크롤할 때마다 렌더가 일어나지 않게).
let current: ArtistSection | null = null;
export const setCurrentSection = (s: ArtistSection | null) => { current = s; };
export const getCurrentSection = () => current;
