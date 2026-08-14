import type { ArtistMetricsRow, Metrics, ShowStatusRow } from "@/lib/types";

function toDayNumber(date: Date | string): number {
  if (typeof date === "string") return Date.parse(`${date}T00:00:00Z`) / 86_400_000;
  // show_date는 타임존 없는 날짜라 UTC 자정으로 취급한다(Postgres 세션도 UTC) — 서버 로컬
  // 타임존(getFullYear 등)으로 today를 뽑으면 UTC+양수 지역에서 하루 밀린다.
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000;
}

function ticketsDelta(current: number, prev: number | null): { delta: string; positive: boolean } {
  if (!prev) {
    // 7일 전 스냅샷이 없는 신규 공연 — 0으로 나누지 않는다
    return { delta: "▲ 신규", positive: true };
  }
  const pct = ((current - prev) / prev) * 100;
  const positive = pct >= 0;
  return { delta: `${positive ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}% vs 지난주`, positive };
}

function bookingNote(cityCount: number, shownCount: number): string {
  const base = `${cityCount}개 도시 평균`;
  return shownCount < cityCount ? `${base} (차트는 주요 ${shownCount}개 도시 표기)` : base;
}

// 순수 함수. I/O 금지 — 현재 날짜는 인자로 받는다 (테스트가 고정 날짜를 써야 하므로)
export function toMetricsView(
  metrics: ArtistMetricsRow,
  nextShow: ShowStatusRow | null,
  featuredShows: ShowStatusRow[],
  today: Date
): Metrics {
  return {
    totalTickets: { value: metrics.total_tickets, ...ticketsDelta(metrics.total_tickets, metrics.total_tickets_prev) },
    avgBookingRate: {
      value: Math.round(metrics.avg_booking_rate * 100),
      note: bookingNote(metrics.city_count, featuredShows.length),
    },
    nextShow: nextShow
      ? { dday: Math.round(toDayNumber(nextShow.show_date) - toDayNumber(today)), venue: nextShow.venue }
      : { dday: 0, venue: "예정된 공연 없음" },
    cityBookings: featuredShows.map((s) => ({ city: s.city_name, rate: Math.round(s.rate * 100) })),
  };
}
