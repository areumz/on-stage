// 서버 컴포넌트용 조회. 내 곡·시드 곡과 내 연출을 읽는다 (RLS 가 범위를 정한다).
// 연출 이름은 컬럼이 없다: sequenceName(trackTitle, 날짜) 로 만든다 (format.ts).
import { createServerSupabase } from "@/lib/supabase/server";
import type { AudioTrackSummary, SequenceSummary, StageSequenceRow } from "@/lib/director/types";

const TRACK_COLUMNS =
  "id, user_id, artist_id, title, genre, mood_keywords, storage_path, file_hash, duration_sec, analysis_status, created_at";

// 내 곡 + 시드 곡(user_id 가 null). 시드가 아닌 곡은 최신순.
export async function getTracks(): Promise<AudioTrackSummary[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("audio_tracks").select(TRACK_COLUMNS).order("created_at", { ascending: false });
  if (error) throw new Error(`getTracks: ${error.message}`);
  return (data ?? []) as AudioTrackSummary[];
}

export async function getTrack(id: string): Promise<AudioTrackSummary | undefined> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("audio_tracks").select(TRACK_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`getTrack: ${error.message}`);
  return (data as AudioTrackSummary | null) ?? undefined;
}

type SequenceJoin = Omit<StageSequenceRow, "user_id"> & { audio_tracks: { title: string } | { title: string }[] | null };

function toSummary(r: SequenceJoin): SequenceSummary {
  const track = Array.isArray(r.audio_tracks) ? r.audio_tracks[0] : r.audio_tracks;
  return {
    id: r.id,
    audioTrackId: r.audio_track_id,
    trackTitle: track?.title ?? "",
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
    .select("id, audio_track_id, status, items, feedback_count, approved_at, created_at, audio_tracks(title)")
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
