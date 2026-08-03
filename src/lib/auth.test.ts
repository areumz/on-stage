import { describe, it, expect } from "vitest";
import { validateCredentials, staffRedirectPath } from "./auth";

describe("validateCredentials", () => {
  it("accepts the demo account", () => {
    expect(validateCredentials("admin", "1234")).toBe(true);
  });
  it("rejects wrong credentials", () => {
    expect(validateCredentials("admin", "wrong")).toBe(false);
    expect(validateCredentials("", "")).toBe(false);
  });
});

describe("staffRedirectPath", () => {
  it("passes non-staff paths through", () => {
    expect(staffRedirectPath("/", false)).toBeNull();
    expect(staffRedirectPath("/artists/aurora", false)).toBeNull();
  });
  it("redirects unauthenticated staff pages to login", () => {
    expect(staffRedirectPath("/staff/dashboard", false)).toBe("/staff/login");
    expect(staffRedirectPath("/staff/stage", false)).toBe("/staff/login");
  });
  it("lets authenticated users into staff pages", () => {
    expect(staffRedirectPath("/staff/dashboard", true)).toBeNull();
  });
  it("sends authenticated users away from login", () => {
    expect(staffRedirectPath("/staff/login", true)).toBe("/staff/dashboard");
    expect(staffRedirectPath("/staff/login", false)).toBeNull();
  });
});
