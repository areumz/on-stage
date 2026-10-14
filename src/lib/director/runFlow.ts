import type { SequencePoll } from "@/lib/director/api";
import type { ConfirmSectionsInterrupt, ReviewInterrupt } from "@/lib/python/contract";

// 연출 진행 화면 결정. 서버 poll 에는 단계 정보가 없어서(running 만 온다) 어느 단계인지는 로컬이 기대하는 값(hint)으로 정한다.
export type RunPhase = "mood" | "generating" | "saving";

export type RunView =
  | { kind: "approved" }
  | { kind: "queued" }
  | { kind: "progress"; phase: RunPhase }
  | { kind: "confirm"; interrupt: ConfirmSectionsInterrupt }
  | { kind: "review"; interrupt: ReviewInterrupt; feedbackCount: number }
  | { kind: "error"; code: string };

export function viewFor(poll: SequencePoll, hint: RunPhase): RunView {
  switch (poll.status) {
    case "approved":
      return { kind: "approved" };
    case "queued":
      return { kind: "queued" };
    case "running":
      return { kind: "progress", phase: hint };
    case "waiting_input": {
      const i = poll.interrupt;
      if (i?.kind === "confirm_sections") return { kind: "confirm", interrupt: i };
      if (i?.kind === "review") return { kind: "review", interrupt: i, feedbackCount: poll.feedbackCount ?? 0 };
      return { kind: "progress", phase: hint };
    }
    case "error":
      return { kind: "error", code: poll.error ?? "internal_error" };
    case "done":
      // 서버가 done 을 approved/save_failed 로 바꿔 주지만 방어
      return { kind: "progress", phase: "saving" };
  }
}

const MOOD_WINDOW_MS = 90_000;

// 페이지를 다시 열면 어느 단계인지 알 수 없어서 하는 추정: 막 만든 초안이면 분위기 해석, 아니면 연출 생성.
export function initialHint(createdAt: string, feedbackCount: number, now: number): RunPhase {
  const age = now - new Date(createdAt).getTime();
  return feedbackCount === 0 && age <= MOOD_WINDOW_MS ? "mood" : "generating";
}

export function nextHint(afterResume: "sections" | "feedback" | "approve"): RunPhase {
  return afterResume === "approve" ? "saving" : "generating";
}

export function shouldPoll(view: RunView): boolean {
  return view.kind === "queued" || view.kind === "progress";
}

type Err = { code: string; status: number };

// 서버가 일시적으로 못 받는 경우(연결 실패·5xx). 작업은 서버에서 계속 돌 수 있어서 바로 오류로 바꾸지 않는다.
// save_failed 500 은 저장 실패라는 확정된 결과라 제외한다.
export function isTransient(e: Err): boolean {
  return e.code !== "save_failed" && (e.status === 0 || e.status >= 500 || e.code === "connection_failed");
}

// 콜드 스타트(최대 약 10초)를 넘기도록 2.5초 간격으로 5번
export const QUIET_RETRIES = 5;

export function pollErrorAction(e: Err, failures: number): "quiet" | "show" {
  return isTransient(e) && failures <= QUIET_RETRIES ? "quiet" : "show";
}

// 승인 후 검증 실패(422 save_failed)는 다시 저장해도 같아서 다른 코드로 보여 준다
export function displayCode(e: Err): string {
  return e.status === 422 && e.code === "save_failed" ? "result_invalid" : e.code;
}

// refetch: 화면이 낡음 / inline: 화면 유지 + 문구 / keep: 일시 오류라 화면(사용자 편집)을 유지 / fatal: 오류 패널
export function resumeErrorAction(e: Err): "refetch" | "inline" | "keep" | "fatal" {
  if (["stale_interrupt", "not_waiting_input", "kind_mismatch"].includes(e.code)) return "refetch";
  if (["invalid_sections", "invalid_targets", "feedback_limit"].includes(e.code)) return "inline";
  if (isTransient(e)) return "keep";
  return "fatal";
}
