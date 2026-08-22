// ── DB 행 타입 (supabase/migrations/*.sql과 1:1) ──────────────────────

export type ArtistRow = {
  id: string;
  slug: string;
  name: string;
  name_ko: string;
  color: string;
  initials: string;
  orbit: number;
  angle: number;
  size: number;
  news: string;
  tour_badge: string;
  tour_title_ko: string;
  tour_year: number;
  stat_tracks: number;
  shader_pattern: string;
  shader_freq: number;
  shader_falloff: number;
  shader_speed: number;
};

export type TrackRow = {
  id: string;
  artist_id: string;
  no: number;
  title: string;
  duration: string;
  cover_from: string;
  cover_to: string;
};

export type ShowRow = {
  id: string;
  artist_id: string;
  city_code: string;
  city_name: string;
  country: string;
  venue: string;
  show_date: string;
  capacity: number;
  featured: boolean;
};

export type GalleryImageRow = {
  id: string;
  artist_id: string;
  storage_path: string;
  creator: string | null;
  license: string | null;
  origin: string | null;
  sort_order: number;
  created_by: string | null;
};

// ── DB 뷰 행 타입 (supabase/migrations/*.sql의 뷰와 1:1) ──────────────

export type ArtistMetricsRow = {
  artist_id: string;
  total_tickets: number;
  total_tickets_prev: number | null;
  avg_booking_rate: number; // 0~1
  city_count: number;
};

export type ShowStatusRow = {
  id: string;
  artist_id: string;
  city_code: string;
  city_name: string;
  country: string;
  venue: string;
  show_date: string;
  capacity: number;
  featured: boolean;
  sold: number;
  sold_prev: number | null;
  rate: number; // 0~1
};

// ── 화면용 뷰 타입 (컴포넌트가 실제로 소비하는 모양 — 1차와 동일하게 유지) ──

export type City = { code: string; name: string; date: string };

// 갤러리 사진 — CC0/퍼블릭도메인/CC-BY만 사용함(NC·ND·SA 제외).
// CC-BY는 출처 표기가 조건이라 creator/origin을 화면에 노출함.
export type GalleryPhoto = {
  src: string; // Storage 공개 URL
  creator: string;
  license: string;
  origin: string; // 원본 페이지
};

// B탭 갤러리 관리 화면용 — 삭제 버튼이 id를 필요로 해서 GalleryPhoto와 분리
export type GalleryListItem = GalleryPhoto & { id: string };

export type Track = {
  no: number;
  title: string;
  duration: string;
  // 싱글 커버 — 실제 커버 아트가 없어 2스톱 그라디언트로 대체 (design.md 8장 2차에서 교체)
  cover: { from: string; to: string };
};

// A탭 HeroBackground 셰이더 패턴 3종 (design-v2.md §8)
export type ShaderPattern = "wave" | "ripple" | "grain";

export type Artist = {
  slug: string;
  name: string; // 영문 대문자 표기
  nameKo: string;
  color: string; // 시그니처 컬러 hex
  initials: string; // 노드 아바타용 3글자
  orbit: number; // 궤도 인덱스 0(안)~2(밖)
  angle: number; // 궤도 위 각도(deg)
  size: number; // 노드 반지름 배율 (AURORA가 최대)
  news: string; // NOW 티커 문구
  tour: { badge: string; titleKo: string; year: number };
  stats: { cities: number; countries: number; tracks: number };
  cities: City[];
  tracks: Track[];
  gallery: GalleryPhoto[];
  shader: { pattern: ShaderPattern; freq: number; falloff: number; speed: number };
};

export type Metrics = {
  // positive: 증감 방향. 카드 보조 텍스트 색(상승 초록 / 하락 빨강)을 정함.
  // delta 문구의 ▲▼와 같은 사실이라 route.test.ts가 둘의 일치를 검사함.
  totalTickets: { value: number; delta: string; positive: boolean };
  avgBookingRate: { value: number; note: string };
  nextShow: { dday: number; venue: string };
  cityBookings: { city: string; rate: number }[];
};
