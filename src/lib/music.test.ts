import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import artists from "@/data/artists.json";
import { MUSIC } from "./music";

describe("MUSIC", () => {
  it("매핑된 음원 파일이 public에 실제로 있다", () => {
    for (const files of Object.values(MUSIC)) {
      for (const src of Object.values(files)) {
        expect(existsSync(path.join("public", src)), src).toBe(true);
      }
    }
  });

  it("매핑된 트랙 번호가 아티스트 트랙에 있다", () => {
    for (const [slug, files] of Object.entries(MUSIC)) {
      const nos = artists.artists.find((a) => a.slug === slug)!.tracks.map((t) => t.no);
      for (const no of Object.keys(files)) expect(nos).toContain(Number(no));
    }
  });
});
