import { describe, it, expect } from "vitest";
import { toMetricsView } from "./metricsView";
import type { ArtistMetricsRow, ShowStatusRow } from "@/lib/types";

const baseMetrics: ArtistMetricsRow = {
  artist_id: "artist-1",
  total_tickets: 1000,
  total_tickets_prev: 800,
  avg_booking_rate: 0.865,
  city_count: 10,
  country_count: 5,
};

const show = (overrides: Partial<ShowStatusRow>): ShowStatusRow => ({
  id: "show-1",
  artist_id: "artist-1",
  city_code: "SEO",
  city_name: "서울",
  country: "South Korea",
  venue: "고척돔",
  show_date: "2026-08-20",
  capacity: 10000,
  featured: true,
  sold: 8000,
  sold_prev: 6000,
  rate: 0.8,
  ...overrides,
});

const today = new Date("2026-08-14T09:00:00Z");

describe("toMetricsView", () => {
  // 지난주 대비 증가 — 화살표(▲)와 positive(true)가 같은 계산에서 나와야 함
  it("marks a positive delta with ▲ and positive: true", () => {
    const view = toMetricsView(baseMetrics, null, [], today);
    expect(view.totalTickets).toEqual({ value: 1000, delta: "▲ 25.0% vs 지난주", positive: true });
  });

  // 지난주 대비 감소 — 화살표(▼)와 positive(false)가 같은 계산에서 나와야 함
  it("marks a negative delta with ▼ and positive: false", () => {
    const metrics = { ...baseMetrics, total_tickets: 800, total_tickets_prev: 1000 };
    const view = toMetricsView(metrics, null, [], today);
    expect(view.totalTickets).toEqual({ value: 800, delta: "▼ 20.0% vs 지난주", positive: false });
  });

  // 변화 없음(0%)도 방향이 정해져야 함 — ▲/positive:true로 취급 (증가 없음 ≠ 감소)
  it("treats a zero delta as ▲ / positive: true", () => {
    const metrics = { ...baseMetrics, total_tickets: 500, total_tickets_prev: 500 };
    const view = toMetricsView(metrics, null, [], today);
    expect(view.totalTickets).toEqual({ value: 500, delta: "▲ 0.0% vs 지난주", positive: true });
  });

  // 7일 전 스냅샷이 없는 신규 공연 — 0으로 나누면 Infinity/NaN이 되므로 별도 분기 필요
  it("does not divide by zero when total_tickets_prev is null", () => {
    const metrics = { ...baseMetrics, total_tickets: 120, total_tickets_prev: null };
    const view = toMetricsView(metrics, null, [], today);
    expect(view.totalTickets.delta).toBe("▲ 신규");
    expect(view.totalTickets.positive).toBe(true);
    expect(view.totalTickets.delta).not.toMatch(/NaN|Infinity/);
  });

  // 오늘이 공연일이면 d-day는 0
  it("computes d-day 0 for a show happening today", () => {
    const next = show({ show_date: "2026-08-14" });
    const view = toMetricsView(baseMetrics, next, [], today);
    expect(view.nextShow.dday).toBe(0);
  });

  // dday는 시각과 무관하게 달력 날짜 차이만 반영해야 함(9시 UTC라도 오늘은 오늘)
  // 지난 날짜가 들어와도(정상 경로에서는 발생하지 않지만) 음수로 계산되고 죽지 않아야 함
  it("computes a negative d-day for a date before today without crashing", () => {
    const next = show({ show_date: "2026-08-09" });
    const view = toMetricsView(baseMetrics, next, [], today);
    expect(view.nextShow.dday).toBe(-5);
  });

  // 예매율 반올림 — avg_booking_rate·show rate 둘 다 정수 퍼센트로 일관되게 반올림
  it("rounds avg booking rate and per-city rate to whole percents", () => {
    const metrics = { ...baseMetrics, avg_booking_rate: 0.865 };
    const shows = [show({ city_name: "서울", rate: 0.774 }), show({ city_name: "부산", rate: 0.776 })];
    const view = toMetricsView(metrics, null, shows, today);
    expect(view.avgBookingRate.value).toBe(87);
    expect(view.cityBookings).toEqual([
      { city: "서울", rate: 77 },
      { city: "부산", rate: 78 },
    ]);
  });

  // note는 featured 도시 수가 전체 city_count보다 적을 때만 "차트는 주요 N개" 문구를 덧붙임
  it("appends the shown-city caveat only when fewer cities are shown than city_count", () => {
    const metrics = { ...baseMetrics, city_count: 4 };
    const shows = [show({}), show({}), show({}), show({})];
    const view = toMetricsView(metrics, null, shows, today);
    expect(view.avgBookingRate.note).toBe("4개 도시 평균");
  });
});
