import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/metrics", () => {
  it("returns dashboard metrics", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    // 목업(b-dashboard.png)의 수치 고정
    expect(await res.json()).toEqual({
      totalTickets: { value: 182430, delta: "▲ 12.4% vs 지난주" },
      avgBookingRate: { value: 87, note: "24개 도시 기준" },
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
});
