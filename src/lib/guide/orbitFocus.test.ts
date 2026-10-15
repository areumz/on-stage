import { describe, it, expect, vi } from "vitest";
import { requestFocus, subscribeFocus, takeFocus } from "./orbitFocus";

describe("orbitFocus", () => {
  it("요청 후 takeFocus는 한 번만 돌려준다", () => {
    requestFocus("nova");
    expect(takeFocus()).toMatchObject({ slug: "nova" });
    expect(takeFocus()).toBeNull();
  });

  it("같은 slug를 다시 요청해도 새 요청으로 취급한다", () => {
    requestFocus("nova");
    const first = takeFocus();
    requestFocus("nova");
    const second = takeFocus();
    expect(second?.nonce).toBeGreaterThan(first!.nonce);
  });

  it("요청하면 구독자에게 알린다", () => {
    const listener = vi.fn();
    const off = subscribeFocus(listener);
    requestFocus("halo");
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    requestFocus("halo");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
