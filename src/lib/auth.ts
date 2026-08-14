export function staffRedirectPath(pathname: string, hasAuth: boolean): string | null {
  if (!pathname.startsWith("/staff")) return null;
  if (pathname === "/staff/login") return hasAuth ? "/staff/dashboard" : null;
  return hasAuth ? null : "/staff/login";
}
