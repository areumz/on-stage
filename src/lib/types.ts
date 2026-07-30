export type City = { code: string; name: string; date: string };

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
  tracks: { no: number; title: string; duration: string }[];
};

export type Metrics = {
  totalTickets: { value: number; delta: string };
  avgBookingRate: { value: number; note: string };
  nextShow: { dday: number; venue: string };
  cityBookings: { city: string; rate: number }[];
};
