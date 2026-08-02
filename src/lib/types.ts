export type City = { code: string; name: string; date: string };

// 갤러리 사진 — CC0/퍼블릭도메인/CC-BY만 사용한다(NC·ND·SA 제외).
// CC-BY는 출처 표기가 조건이라 creator/origin을 화면에 노출한다.
export type GalleryPhoto = {
  src: string; // public/ 기준 경로
  creator: string;
  license: string;
  origin: string; // 원본 페이지
};

export type Track = {
  no: number;
  title: string;
  duration: string;
  // 싱글 커버 — 실제 커버 아트가 없어 2스톱 그라디언트로 대체 (design.md 8장 2차에서 교체)
  cover: { from: string; to: string };
};

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
};

export type Metrics = {
  totalTickets: { value: number; delta: string };
  avgBookingRate: { value: number; note: string };
  nextShow: { dday: number; venue: string };
  cityBookings: { city: string; rate: number }[];
};
