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
