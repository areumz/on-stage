import { describe, it, expect } from "vitest";
import { POST } from "./route";

function loginReq(body: unknown) {
  return new Request("http://test/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/login", () => {
  it("sets auth cookie on valid credentials", async () => {
    const res = await POST(loginReq({ id: "admin", password: "1234" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("staff_auth=ok");
  });
  it("401s on invalid credentials", async () => {
    const res = await POST(loginReq({ id: "admin", password: "nope" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
  it("401s on malformed body", async () => {
    const res = await POST(new Request("http://test/api/login", { method: "POST", body: "not json" }));
    expect(res.status).toBe(401);
  });
});
