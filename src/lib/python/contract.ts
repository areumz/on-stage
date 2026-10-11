// Python 서비스(stage-director-agent) API 계약의 타입. 기준은 인수 문서(on-stage-handoff) §2~§5.
// 키는 모두 camelCase. Python 은 Supabase 를 읽지 않으므로 필요한 값은 전부 요청 본문에 싣는다.
import type { Backdrop, PropKey } from "@/lib/stage/scene";
import type { StageState } from "@/lib/stageState";
import type { ShaderPattern } from "@/lib/types";

// /analyze 와 /runs 의 status. waiting_input 은 /runs 에만 있다.
export type AnalyzeStatus = "queued" | "running" | "done" | "error";
export type RunStatus = AnalyzeStatus | "waiting_input";

// ── /analyze ───────────────────────────────────────────────

export type Analysis = {
  durationSec: number;
  bpm: number;
  beatsSec: number[];
  energyCurve: number[]; // 초당 1개
  onsetDensity: number[]; // 초당 1개
};

export type AnalyzeBody = {
  jobId: string;
  status: AnalyzeStatus;
  // 0~1 단계 값(0.1 → 0.4 → 1.0)이라 퍼센트로 쓰지 않는다. status 가 error 면 무시한다.
  progress: number | null;
  result: { fileHash: string; analysis: Analysis } | null;
  error: string | null;
};

// ── /runs ──────────────────────────────────────────────────

export type Section = { label: string; startSec: number; endSec: number; mood: string };
export type SectionInput = { label: string; startSec: number; endSec: number; mood?: string };

export type SequenceItem = {
  sectionLabel: string;
  startSec: number;
  endSec: number;
  // 구간 i 가 시작될 때 items[i-1].state 에서 items[i].state 로 보간하는 데 걸리는 시간(ms)
  transitionMs: number;
  state: StageState;
  rationale: string;
  // 선택 필드(부록 G). 없거나 null 이면 "정하지 않음"
  backdrop?: Backdrop | null;
  dust?: number | null;
  reflection?: number | null;
};

export type Issue = { rule: string; message: string; idx: number | null };

export type ConfirmSectionsInterrupt = {
  interruptId: string;
  kind: "confirm_sections";
  sections: Section[];
  energyCurve: number[];
  durationSec: number;
};

export type ReviewInterrupt = {
  interruptId: string;
  kind: "review";
  items: SequenceItem[];
  issues: Issue[];
  props?: PropKey[] | null;
};

export type Interrupt = ConfirmSectionsInterrupt | ReviewInterrupt;

export type RunResult = { sections: Section[]; items: SequenceItem[]; issues: Issue[]; props?: PropKey[] | null };

export type RunBody = {
  threadId: string;
  status: RunStatus;
  interrupt: Interrupt | null;
  result: RunResult | null;
  error: string | null;
};

export type RunContext = {
  track: { title: string; genre?: string; moodKeywords?: string[] };
  artist: {
    slug: string;
    name: string;
    nameKo: string;
    color: string;
    shader: { pattern: ShaderPattern; freq: number; falloff: number; speed: number };
  };
  presets: { name: string; state: StageState }[];
  analysis: Analysis;
  durationSec: number;
  // 있으면 곡 전체 오디오로 구간별 분위기를 해석한다. 서명 URL 이라 비밀처럼 다룬다.
  audioUrl?: string;
};

export type ResumeBody =
  | { interruptId: string; kind: "sections"; payload: { sections: SectionInput[] } }
  | { interruptId: string; kind: "feedback"; payload: { text: string; targets: number[] } }
  | { interruptId: string; kind: "approve" };

// 작업 status 가 error 일 때 error 에 담기는 코드(§5.2)
export type PythonJobError =
  | "llm_failed"
  | "llm_quota_exceeded"
  | "internal_error"
  | "interrupted"
  | "audio_unavailable"
  | "decode_failed"
  | "too_long";
