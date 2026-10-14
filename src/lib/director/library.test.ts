import { describe, expect, it } from "vitest";
import { groupByTrack } from "./library";
import type { AudioTrackSummary, SequenceSummary } from "./types";

const track = (id: string, user_id: string | null, created_at: string) =>
  ({ id, user_id, title: id, created_at }) as AudioTrackSummary;
const seq = (id: string, audioTrackId: string, status: "draft" | "approved", createdAt: string, approvedAt: string | null = null) =>
  ({ id, audioTrackId, trackTitle: audioTrackId, status, createdAt, approvedAt }) as SequenceSummary;

describe("groupByTrack", () => {
  const tracks = [track("old", "u", "2026-10-01"), track("new", "u", "2026-10-05"), track("seed", null, "2026-09-01"), track("seed2", null, "2026-09-02")];
  const seqs = [
    seq("a1", "old", "approved", "2026-10-01", "2026-10-03"),
    seq("a2", "old", "approved", "2026-10-02", "2026-10-08"),
    seq("d1", "old", "draft", "2026-10-09"),
    seq("s1", "seed2", "approved", "2026-10-01", "2026-10-02"),
    seq("gone", "deleted", "draft", "2026-10-01"),
  ];
  const groups = groupByTrack(tracks, seqs);

  it("내 곡과 연출 있는 시드 곡만, 곡 최신순", () => {
    expect(groups.map((g) => g.track.id)).toEqual(["new", "old", "seed2"]);
  });
  it("승인본은 approvedAt 최신순, 초안은 분리", () => {
    const old = groups.find((g) => g.track.id === "old")!;
    expect(old.approved.map((s) => s.id)).toEqual(["a2", "a1"]);
    expect(old.drafts.map((s) => s.id)).toEqual(["d1"]);
  });
  it("곡 없는 연출은 건너뜀", () => {
    expect(groups.flatMap((g) => [...g.drafts, ...g.approved]).some((s) => s.id === "gone")).toBe(false);
  });

  it("승인본 5개 이상도 그대로 묶고, 0개인 내 곡도 포함", () => {
    const many = Array.from({ length: 6 }, (_, i) => seq(`m${i}`, "old", "approved", "2026-10-01", `2026-10-0${i + 1}`));
    const g = groupByTrack([track("old", "u", "2026-10-01"), track("empty", "u", "2026-10-02")], many);
    expect(g.find((x) => x.track.id === "old")!.approved).toHaveLength(6);
    expect(g.find((x) => x.track.id === "empty")).toEqual({ track: expect.anything(), drafts: [], approved: [] });
  });
  it("approvedAt 이 null 이면 createdAt 으로 정렬", () => {
    const g = groupByTrack([track("t", "u", "2026-10-01")], [seq("x", "t", "approved", "2026-10-09"), seq("y", "t", "approved", "2026-10-01", "2026-10-05")]);
    expect(g[0].approved.map((s) => s.id)).toEqual(["x", "y"]);
  });
});
