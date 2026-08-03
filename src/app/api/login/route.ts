import { NextResponse } from "next/server";
import { STAFF_COOKIE, validateCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !validateCredentials(body.id, body.password)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_COOKIE, "ok", { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
