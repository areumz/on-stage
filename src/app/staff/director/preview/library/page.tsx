"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import Library from "@/components/director/Library";
import type { AudioTrackSummary, SequenceSummary } from "@/lib/director/types";

// dev 전용 쇼케이스. 메인이 나중에 지운다.
const t = (id: string, title: string, user_id: string | null, analysis_status: AudioTrackSummary["analysis_status"], created_at: string) =>
  ({ id, title, user_id, analysis_status, created_at, artist_id: null, genre: null, mood_keywords: null, storage_path: "", file_hash: null, duration_sec: 100 }) as unknown as AudioTrackSummary;
const q = (id: string, audioTrackId: string, trackTitle: string, status: "draft" | "approved", day: number, fb = 0) =>
  ({ id, audioTrackId, trackTitle, status, feedbackCount: fb, sectionCount: 4 + (day % 3), createdAt: `2026-10-0${day}T03:00:00Z`, approvedAt: status === "approved" ? `2026-10-0${day}T05:00:00Z` : null }) as SequenceSummary;

const tracks = [
  t("t1", "burn it up", "u", "done", "2026-10-01T00:00:00Z"),
  t("t2", "밤하늘 버전", "u", "done", "2026-10-03T00:00:00Z"),
  t("t3", "새 곡", "u", "running", "2026-10-05T00:00:00Z"),
  t("seed", "데모 곡", null, "done", "2026-09-01T00:00:00Z"), // 연출 없는 시드 곡: 제외됨
];
const sequences = [
  ...[1, 2, 3, 4, 5].map((d) => q(`a${d}`, "t1", "burn it up", "approved", d, d % 4)),
  q("d1", "t2", "밤하늘 버전", "draft", 6, 1),
];

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  const [empty, setEmpty] = useState(false);
  const [fail, setFail] = useState(false);
  return (
    <div className="min-h-screen bg-bg-dark">
      <div className="flex gap-2 p-4">
        <button type="button" onClick={() => setEmpty(!empty)} className="rounded border border-white/20 px-3 py-1 text-sm text-white">{empty ? "목록 보기" : "빈 상태 보기"}</button>
        <button type="button" onClick={() => setFail(!fail)} className="rounded border border-white/20 px-3 py-1 text-sm text-white">삭제 {fail ? "실패" : "성공"} 중 (전환)</button>
      </div>
      <Library
        tracks={empty ? [tracks[3]] : tracks}
        sequences={empty ? [] : sequences}
        onDelete={async () => {
          await new Promise((r) => setTimeout(r, 800)); // 삭제 중 버튼 비활성 확인용
          return fail ? { ok: false, error: { code: "internal_error", status: 500 } } : { ok: true, data: undefined };
        }}
      />
    </div>
  );
}
