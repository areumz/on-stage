import { describe, it, expect } from "vitest";
import { getSessionId, resetSessionId } from "./session";

describe("session", () => {
  it("resetSessionId는 새 id를 만들고 이후 getSessionId가 그 값을 돌려준다", () => {
    const before = getSessionId();
    const next = resetSessionId();
    expect(next).not.toBe(before);
    expect(getSessionId()).toBe(next);
  });
});
