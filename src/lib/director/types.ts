// DB 행 타입 (supabase/migrations/20261009000000_stage_director.sql 과 1:1)
import type { Analysis, SequenceItem } from "@/lib/python/contract";
import type { PropKey, SceneEdit } from "@/lib/stage/scene";

export type AnalysisStatus = "pending" | "running" | "done" | "error";

export type AudioTrackRow = {
  id: string;
  user_id: string | null; // null = 시드 곡
  artist_id: string;
  title: string;
  genre: string | null;
  mood_keywords: string[] | null;
  storage_path: string;
  file_hash: string | null;
  duration_sec: number;
  analysis: Analysis | null;
  analysis_status: AnalysisStatus;
  created_at: string;
};

// 목록용. analysis 는 크기가 커서 뺀다.
export type AudioTrackSummary = Omit<AudioTrackRow, "analysis">;

export type StageSequenceRow = {
  id: string; // = Python 의 threadId
  user_id: string;
  audio_track_id: string;
  status: "draft" | "approved";
  items: SequenceItem[] | null; // 승인 전 null
  feedback_count: number;
  props: PropKey[] | null; // AI 가 제안한 소품. null = 정하지 않음, [] = 소품 없음
  scene_edit: SceneEdit | null; // 사용자가 재생 화면에서 고친 값. AI 값보다 우선
  approved_at: string | null;
  created_at: string;
};

// Library 목록용: 연출 이름은 "곡 제목 · 날짜"로 만들어 보여 주므로 컬럼이 없다.
export type SequenceSummary = {
  id: string;
  audioTrackId: string;
  trackTitle: string;
  status: "draft" | "approved";
  feedbackCount: number;
  sectionCount: number; // 승인본만 의미 있음, 초안은 0
  createdAt: string;
  approvedAt: string | null;
};
