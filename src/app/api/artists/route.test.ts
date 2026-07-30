import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/artists", () => {
  it("returns all 6 artists", async () => {
    const res = await GET(new Request("http://test/api/artists"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.artists).toHaveLength(6);
    expect(body.artists[0].slug).toBe("aurora");
  });

  it("returns single artist by slug", async () => {
    const res = await GET(new Request("http://test/api/artists?slug=nova"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.artist.name).toBe("NOVA");
    expect(body.artist.color).toBe("#D4537E");
  });

  it("404s on unknown slug", async () => {
    const res = await GET(new Request("http://test/api/artists?slug=nobody"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not found" });
  });
});
