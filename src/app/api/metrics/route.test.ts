import { describe, it, expect } from "vitest";
import { getArtists, getMetrics } from "@/lib/data";
import { GET } from "./route";

const req = (qs = "") => new Request(`http://test/api/metrics${qs}`);

describe("GET /api/metrics", () => {
  it("defaults to AURORA when no slug is given", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    // 목업(b-dashboard.png)의 수치 고정
    expect(await res.json()).toEqual({
      totalTickets: { value: 182430, delta: "▲ 12.4% vs 지난주", positive: true },
      avgBookingRate: { value: 87, note: "24개 도시 평균 (차트는 주요 5개 도시 표기)" },
      nextShow: { dday: 3, venue: "서울 · 고척돔" },
      cityBookings: [
        { city: "서울", rate: 95 },
        { city: "도쿄", rate: 78 },
        { city: "LA", rate: 86 },
        { city: "런던", rate: 64 },
        { city: "파리", rate: 71 },
      ],
    });
  });

  it("returns metrics for the requested artist", async () => {
    const res = await GET(req("?slug=echo"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.avgBookingRate.value).toBe(94);
    expect(body.cityBookings.map((c: { city: string }) => c.city)).toEqual(["서울", "부산"]);
  });

  it("404s on unknown slug", async () => {
    const res = await GET(req("?slug=nobody"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not found" });
  });

  // slug는 URL에서 온 값이라 객체 인덱싱이 프로토타입 체인을 타면 안 된다.
  // 가드가 없으면 constructor/toString은 직렬화 불가 함수로 500, __proto__는 {}로 200이 된다.
  it("404s on prototype chain keys", async () => {
    for (const slug of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      const res = await GET(req(`?slug=${slug}`));
      expect(res.status, `?slug=${slug}`).toBe(404);
      expect(await res.json()).toEqual({ error: "not found" });
    }
  });

  // 대시보드 아티스트 선택기가 레이블 6팀을 전부 보여주므로,
  // 지표가 빠진 아티스트가 있으면 선택하는 순간 404가 된다.
  it("has metrics for every artist in the label", async () => {
    for (const artist of getArtists()) {
      const res = await GET(req(`?slug=${artist.slug}`));
      expect(res.status, `${artist.slug} has no metrics`).toBe(200);
    }
  });

  // 화살표(사람이 읽는 문구)와 positive(카드 색을 정하는 플래그)는 같은 사실을 두 번 적는다.
  // 어긋나면 하락을 초록으로 칠하는 식이 되므로 데이터 쪽에서 묶어둔다.
  it("keeps the delta arrow and the positive flag in agreement", () => {
    for (const artist of getArtists()) {
      const { delta, positive } = getMetrics(artist.slug)!.totalTickets;
      expect(delta.startsWith(positive ? "▲" : "▼"), `${artist.slug}: "${delta}" vs positive=${positive}`).toBe(
        true
      );
    }
  });
});
