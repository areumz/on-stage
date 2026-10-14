// 서버 컴포넌트용 조회. 내 곡·시드 곡과 내 연출을 읽는다 (RLS 가 범위를 정한다).
// 연출 이름은 컬럼이 없다: sequenceName(trackTitle, 날짜) 로 만든다 (format.ts).
import { byArtistDisplayOrder } from "@/lib/data";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AudioTrackSummary, SequenceSummary, StageSequenceRow } from "@/lib/director/types";

// 업로드 화면의 "아티스트 선택(등록된 6명)"용. audio_tracks.artist_id 에 uuid 가 필요해서 id 를 같이 준다.
export type ArtistChoice = { id: string; slug: string; name: string; color: string };

export async function getArtistChoices(): Promise<ArtistChoice[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("artists").select("id, slug, name, color");
  if (error) throw new Error(`getArtistChoices: ${error.message}`);
  return byArtistDisplayOrder((data ?? []) as ArtistChoice[]);
}

const TRACK_COLUMNS =
  "id, user_id, artist_id, title, genre, mood_keywords, storage_path, file_hash, duration_sec, analysis_status, created_at";

// 내 곡 + 시드 곡(user_id 가 null). 시드가 아닌 곡은 최신순.
export async function getAudioTracks(): Promise<AudioTrackSummary[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("audio_tracks").select(TRACK_COLUMNS).order("created_at", { ascending: false });
  if (error) throw new Error(`getAudioTracks: ${error.message}`);
  return (data ?? []) as AudioTrackSummary[];
}

export async function getAudioTrack(id: string): Promise<AudioTrackSummary | undefined> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("audio_tracks").select(TRACK_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`getAudioTrack: ${error.message}`);
  return (data as AudioTrackSummary | null) ?? undefined;
}

type SequenceJoin = Omit<StageSequenceRow, "user_id"> & { audio_tracks: { title: string } | { title: string }[] | null };

function toSummary(r: SequenceJoin): SequenceSummary {
  const track = Array.isArray(r.audio_tracks) ? r.audio_tracks[0] : r.audio_tracks;
  return {
    id: r.id,
    audioTrackId: r.audio_track_id,
    trackTitle: track?.title ?? "",
    name: r.name ?? null,
    status: r.status,
    feedbackCount: r.feedback_count,
    sectionCount: r.items?.length ?? 0,
    createdAt: r.created_at,
    approvedAt: r.approved_at,
  };
}

// 내 연출 전부(초안 + 승인본), 최신순. Library 가 곡별로 묶어 보여 준다.
export async function getSequences(): Promise<SequenceSummary[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("stage_sequences")
    .select("id, audio_track_id, name, status, items, feedback_count, approved_at, created_at, audio_tracks(title)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getSequences: ${error.message}`);
  return ((data ?? []) as unknown as SequenceJoin[]).map(toSummary);
}

// 재생·검토 화면용: items 까지 포함한 한 건.
export async function getSequence(id: string): Promise<(StageSequenceRow & { trackTitle: string }) | undefined> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("stage_sequences")
    .select("*, audio_tracks(title)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getSequence: ${error.message}`);
  if (!data) return undefined;
  const { audio_tracks, ...row } = data as StageSequenceRow & { audio_tracks: SequenceJoin["audio_tracks"] };
  const track = Array.isArray(audio_tracks) ? audio_tracks[0] : audio_tracks;
  return { ...row, trackTitle: track?.title ?? "" };
}

// 곡 한 건의 화면용 상세: 아티스트(이름·색)와 재생 타임라인용 에너지 곡선까지. analysis 전체는 크기가 커서 내보내지 않는다.
export type TrackDetail = {
  track: AudioTrackSummary;
  artist: { slug: string; name: string; color: string } | null;
  energyCurve: number[] | null;
};

// energy: true 일 때만 analysis(큰 jsonb)를 읽어 energyCurve 를 채운다. 진행 화면은 필요 없으니 기본은 읽지 않는다.
export async function getTrackDetail(id: string, { energy = false }: { energy?: boolean } = {}): Promise<TrackDetail | undefined> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("audio_tracks")
    .select(`${TRACK_COLUMNS}, ${energy ? "analysis, " : ""}artists(slug, name, color)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getTrackDetail: ${error.message}`);
  if (!data) return undefined;
  const { analysis, artists, ...track } = data as unknown as AudioTrackSummary & {
    analysis: { energyCurve?: number[] } | null;
    artists: TrackDetail["artist"] | NonNullable<TrackDetail["artist"]>[] | null;
  };
  return {
    track,
    artist: (Array.isArray(artists) ? artists[0] : artists) ?? null,
    energyCurve: analysis?.energyCurve ?? null,
  };
}
