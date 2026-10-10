import { describe, expect, it } from "vitest";
import { buildRunContext } from "./runContext";
import type { ArtistRow } from "@/lib/types";
import type { AudioTrackRow } from "@/lib/director/types";

const analysis = { durationSec: 100, bpm: 90, beatsSec: [0.5], energyCurve: [0.1], onsetDensity: [1] };

const track: AudioTrackRow = {
  id: "t1",
  user_id: "u1",
  artist_id: "a1",
  title: "burn it up",
  genre: null,
  mood_keywords: null,
  storage_path: "u1/x.mp3",
  file_hash: "h",
  duration_sec: 100,
  analysis,
  analysis_status: "done",
  created_at: "2026-10-08T00:00:00Z",
};

const artist = {
  slug: "aurora",
  name: "AURORA",
  name_ko: "오로라",
  color: "#9F77DD",
  shader_pattern: "wave",
  shader_freq: 9,
  shader_falloff: 0.75,
  shader_speed: 0.5,
} as ArtistRow;

describe("buildRunContext", () => {
  it("계약서의 context 모양으로 만든다", () => {
    const ctx = buildRunContext({ track, artist, presets: [], audioUrl: null });
    expect(ctx).toEqual({
      track: { title: "burn it up" },
      artist: {
        slug: "aurora",
        name: "AURORA",
        nameKo: "오로라",
        color: "#9F77DD",
        shader: { pattern: "wave", freq: 9, falloff: 0.75, speed: 0.5 },
      },
      presets: [],
      analysis,
      durationSec: 100,
    });
  });

  // 비어 있는 선택 값은 키 자체를 보내지 않는다 (null 을 보내면 Python 검증에 걸릴 수 있다)
  it("장르·분위기 키워드·audioUrl 이 없으면 키를 뺀다", () => {
    const ctx = buildRunContext({ track, artist, presets: [], audioUrl: null });
    expect(ctx.track).not.toHaveProperty("genre");
    expect(ctx.track).not.toHaveProperty("moodKeywords");
    expect(ctx).not.toHaveProperty("audioUrl");
  });

  it("있으면 싣는다", () => {
    const ctx = buildRunContext({
      track: { ...track, genre: "K-pop", mood_keywords: ["몽환"] },
      artist,
      presets: [{ name: "기본", state: { color: "#fff" } }],
      audioUrl: "https://signed.example/x",
    });
    expect(ctx.track).toEqual({ title: "burn it up", genre: "K-pop", moodKeywords: ["몽환"] });
    expect(ctx.presets).toEqual([{ name: "기본", state: { color: "#fff" } }]);
    expect(ctx.audioUrl).toBe("https://signed.example/x");
  });

  // numeric 컬럼이 문자열로 와도 숫자로 보낸다
  it("숫자 컬럼을 숫자로 바꾼다", () => {
    const ctx = buildRunContext({
      track: { ...track, duration_sec: "173.819" as unknown as number },
      artist: { ...artist, shader_freq: "9" as unknown as number },
      presets: [],
      audioUrl: null,
    });
    expect(ctx.durationSec).toBe(173.819);
    expect(ctx.artist.shader.freq).toBe(9);
  });

  it("분석 결과가 없으면 만들지 않는다", () => {
    expect(() => buildRunContext({ track: { ...track, analysis: null }, artist, presets: [], audioUrl: null })).toThrow();
  });
});
