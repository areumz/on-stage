export const STAFF_COOKIE = "staff_auth";

// ponytail: 하드코딩 데모 계정 — 2차에서 Supabase Auth로 교체
export function validateCredentials(id: string, password: string): boolean {
  return id === "admin" && password === "1234";
}

export function staffRedirectPath(pathname: string, hasAuth: boolean): string | null {
  if (!pathname.startsWith("/staff")) return null;
  if (pathname === "/staff/login") return hasAuth ? "/staff/dashboard" : null;
  return hasAuth ? null : "/staff/login";
}
