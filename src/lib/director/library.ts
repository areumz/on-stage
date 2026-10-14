import type { AudioTrackSummary, SequenceSummary } from "./types";

export type TrackGroup = { track: AudioTrackSummary; drafts: SequenceSummary[]; approved: SequenceSummary[] };

const byDesc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);

// 내 곡 + 연출이 있는 곡(시드 곡 포함)만 곡별로 묶는다. 곡이 지워진 연출은 임시 곡을 만들지 않고 건너뛴다.
export function groupByTrack(tracks: AudioTrackSummary[], sequences: SequenceSummary[]): TrackGroup[] {
  const byTrack = new Map<string, SequenceSummary[]>();
  for (const s of sequences) byTrack.set(s.audioTrackId, [...(byTrack.get(s.audioTrackId) ?? []), s]);

  return tracks
    .filter((t) => t.user_id !== null || byTrack.has(t.id))
    .sort((a, b) => byDesc(a.created_at, b.created_at))
    .map((track) => {
      const seqs = byTrack.get(track.id) ?? [];
      return {
        track,
        drafts: seqs.filter((s) => s.status === "draft").sort((a, b) => byDesc(a.createdAt, b.createdAt)),
        approved: seqs
          .filter((s) => s.status === "approved")
          .sort((a, b) => byDesc(a.approvedAt ?? a.createdAt, b.approvedAt ?? b.createdAt)),
      };
    });
}
