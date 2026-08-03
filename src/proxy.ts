import { NextResponse, type NextRequest } from "next/server";
import { STAFF_COOKIE, staffRedirectPath } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const hasAuth = request.cookies.get(STAFF_COOKIE)?.value === "ok";
  const dest = staffRedirectPath(request.nextUrl.pathname, hasAuth);
  if (dest) return NextResponse.redirect(new URL(dest, request.url));
  return NextResponse.next();
}

export const config = { matcher: "/staff/:path*" };
