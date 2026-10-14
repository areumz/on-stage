import { describe, expect, it } from "vitest";
import { analysisView, canRestartJob, deleteAlreadyGone } from "./analysisSteps";

const states = (p: number | null) => analysisView("running", p).steps.map((s) => s.state).join();

describe("analysisView", () => {
  it("running: progress 단계 매핑과 경계값", () => {
    for (const p of [null, 0, 0.1, 0.39, -1, NaN]) expect(states(p)).toBe("done,now,todo,todo");
    for (const p of [0.4, 0.7, 0.99]) expect(states(p)).toBe("done,done,now,todo");
    for (const p of [1, 1.5]) expect(states(p)).toBe("done,done,done,now");
  });
  it("done 은 네 단계 모두 완료", () => {
    expect(analysisView("done", 1).steps.every((s) => s.state === "done")).toBe(true);
  });
  it("waking·queued·creating 은 첫 단계가 진행 중", () => {
    for (const ph of ["waking", "queued", "creating"] as const) {
      const v = analysisView(ph, null);
      expect(v.steps).toHaveLength(3);
      expect(v.steps.map((s) => s.state)).toEqual(["now", "todo", "todo"]);
    }
    expect(analysisView("creating", null).headline).toBe("연출 만들기를 시작하고 있어요");
  });
});

describe("재시작·삭제 판단", () => {
  it("job_not_found 재시작은 한 번만", () => {
    expect(canRestartJob(0)).toBe(true);
    expect(canRestartJob(1)).toBe(false);
  });
  it("삭제 404 는 이미 지워진 것", () => {
    expect(deleteAlreadyGone(404)).toBe(true);
    expect(deleteAlreadyGone(500)).toBe(false);
  });
});
