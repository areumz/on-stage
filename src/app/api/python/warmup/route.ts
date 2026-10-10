import { python } from "@/lib/python/client";
import { authed, jsonError, pythonFailure } from "@/lib/director/http";

// 콜드 스타트 10초 + 타임아웃을 견디도록 명시 (Vercel Hobby 는 Fluid Compute 에서 최대 300초, 꺼져 있어도 60초)
export const maxDuration = 60;

// 업로드 화면에 들어올 때 부른다: 서버를 미리 깨워 둔다. 실패해도 화면은 그대로 진행한다.
export async function GET() {
  if (!(await authed())) return jsonError("unauthorized", 401);
  try {
    await python.health();
    return Response.json({ ok: true });
  } catch (e) {
    return pythonFailure(e);
  }
}
