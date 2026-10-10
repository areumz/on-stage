import { describe, expect, it } from "vitest";
import { initialHint, nextHint, shouldPoll, viewFor } from "./runFlow";
import type { ConfirmSectionsInterrupt, ReviewInterrupt } from "@/lib/python/contract";

const confirm: ConfirmSectionsInterrupt = { interruptId: "a", kind: "confirm_sections", sections: [], energyCurve: [], durationSec: 10 };
const review: ReviewInterrupt = { interruptId: "b", kind: "review", items: [], issues: [] };

describe("viewFor", () => {
  it("상태별 화면", () => {
    expect(viewFor({ status: "approved" }, "mood")).toEqual({ kind: "approved" });
    expect(viewFor({ status: "queued" }, "mood")).toEqual({ kind: "queued" });
    expect(viewFor({ status: "running" }, "generating")).toEqual({ kind: "progress", phase: "generating" });
    expect(viewFor({ status: "done" }, "mood")).toEqual({ kind: "progress", phase: "saving" });
  });
  it("waiting_input 은 interrupt 종류로 갈린다", () => {
    expect(viewFor({ status: "waiting_input", interrupt: confirm }, "mood")).toEqual({ kind: "confirm", interrupt: confirm });
    expect(viewFor({ status: "waiting_input", interrupt: review, feedbackCount: 2 }, "mood")).toEqual({ kind: "review", interrupt: review, feedbackCount: 2 });
    expect(viewFor({ status: "waiting_input", interrupt: review }, "mood")).toMatchObject({ feedbackCount: 0 });
    expect(viewFor({ status: "waiting_input", interrupt: null }, "saving")).toEqual({ kind: "progress", phase: "saving" });
    expect(viewFor({ status: "waiting_input" }, "mood")).toEqual({ kind: "progress", phase: "mood" });
  });
  it("error 는 코드를 넘기고 없으면 internal_error", () => {
    expect(viewFor({ status: "error", error: "llm_failed" }, "mood")).toEqual({ kind: "error", code: "llm_failed" });
    expect(viewFor({ status: "error", error: null }, "mood")).toEqual({ kind: "error", code: "internal_error" });
    expect(viewFor({ status: "error" }, "mood")).toEqual({ kind: "error", code: "internal_error" });
  });
});

describe("initialHint", () => {
  const now = Date.parse("2026-10-10T00:10:00Z");
  it("90초 경계", () => {
    expect(initialHint("2026-10-10T00:08:30Z", 0, now)).toBe("mood"); // 정확히 90초
    expect(initialHint("2026-10-10T00:08:29Z", 0, now)).toBe("generating"); // 91초
    expect(initialHint("2026-10-10T00:09:59Z", 0, now)).toBe("mood");
  });
  it("다시 생성한 적 있으면 generating", () => {
    expect(initialHint("2026-10-10T00:09:59Z", 1, now)).toBe("generating");
  });
});

it("nextHint", () => {
  expect(nextHint("sections")).toBe("generating");
  expect(nextHint("feedback")).toBe("generating");
  expect(nextHint("approve")).toBe("saving");
});

it("shouldPoll", () => {
  expect(shouldPoll({ kind: "queued" })).toBe(true);
  expect(shouldPoll({ kind: "progress", phase: "mood" })).toBe(true);
  for (const v of [{ kind: "approved" }, { kind: "error", code: "x" }, { kind: "confirm", interrupt: confirm }, { kind: "review", interrupt: review, feedbackCount: 0 }] as const)
    expect(shouldPoll(v)).toBe(false);
});

import { displayCode, isTransient, pollErrorAction, QUIET_RETRIES, resumeErrorAction } from "./runFlow";

describe("오류 분기", () => {
  it("일시 오류", () => {
    expect(isTransient({ code: "connection_failed", status: 0 })).toBe(true);
    expect(isTransient({ code: "internal_error", status: 502 })).toBe(true);
    expect(isTransient({ code: "save_failed", status: 500 })).toBe(false);
    expect(isTransient({ code: "not_found", status: 404 })).toBe(false);
  });
  it("폴링은 횟수까지만 조용히", () => {
    const e = { code: "connection_failed", status: 0 };
    expect(pollErrorAction(e, QUIET_RETRIES)).toBe("quiet");
    expect(pollErrorAction(e, QUIET_RETRIES + 1)).toBe("show");
    expect(pollErrorAction({ code: "unauthorized", status: 401 }, 1)).toBe("show");
  });
  it("displayCode", () => {
    expect(displayCode({ code: "save_failed", status: 422 })).toBe("result_invalid");
    expect(displayCode({ code: "save_failed", status: 500 })).toBe("save_failed");
  });
  it("resume 분기", () => {
    expect(resumeErrorAction({ code: "kind_mismatch", status: 409 })).toBe("refetch");
    expect(resumeErrorAction({ code: "stale_interrupt", status: 409 })).toBe("refetch");
    expect(resumeErrorAction({ code: "feedback_limit", status: 429 })).toBe("inline");
    expect(resumeErrorAction({ code: "invalid_sections", status: 422 })).toBe("inline");
    expect(resumeErrorAction({ code: "connection_failed", status: 0 })).toBe("keep");
    expect(resumeErrorAction({ code: "internal_error", status: 500 })).toBe("keep");
    expect(resumeErrorAction({ code: "thread_expired", status: 410 })).toBe("fatal");
  });
});
