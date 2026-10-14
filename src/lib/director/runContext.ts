// POST /runs 의 context 를 만든다. Python 은 Supabase 를 읽지 않으므로 필요한 값은 전부 여기서 싣는다.
import type { RunContext } from "@/lib/python/contract";
import type { StageState } from "@/lib/stageState";
import type { ArtistRow, ShaderPattern } from "@/lib/types";
import type { AudioTrackRow } from "@/lib/director/types";

export function buildRunContext(input: {
  track: AudioTrackRow;
  artist: ArtistRow;
  presets: { name: string; state: unknown }[];
  audioUrl: string | null; // 없으면 분위기 해석을 건너뛴다(에러가 아니다)
}): RunContext {
  const { track, artist, presets, audioUrl } = input;
  if (!track.analysis) throw new Error("analysis is required to build a run context");

  return {
    track: {
      title: track.title,
      ...(track.genre ? { genre: track.genre } : {}),
      ...(track.mood_keywords?.length ? { moodKeywords: track.mood_keywords } : {}),
    },
    artist: {
      slug: artist.slug,
      name: artist.name,
      nameKo: artist.name_ko,
      color: artist.color,
      shader: {
        pattern: artist.shader_pattern as ShaderPattern,
        freq: Number(artist.shader_freq),
        falloff: Number(artist.shader_falloff),
        speed: Number(artist.shader_speed),
      },
    },
    presets: presets.map((p) => ({ name: p.name, state: p.state as StageState })),
    analysis: track.analysis,
    durationSec: Number(track.duration_sec),
    ...(audioUrl ? { audioUrl } : {}),
  };
}
