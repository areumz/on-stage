import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { staffRedirectPath } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // 요청 쪽 쿠키도 갱신해야 이번 요청 안에서 뒤이어 실행되는 서버 컴포넌트가
        // 갱신된 세션을 곧바로 읽는다 (응답에만 반영하면 다음 요청에서야 반영됨).
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) =>
          response.cookies.set(name, value, options)
        );
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // 쿠키를 그대로 신뢰하고 서명을 검증하지 않는 세션 조회 API 대신 getUser()를 쓴다 — 가드로 쓸 수 있는 건 이쪽뿐이다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const dest = staffRedirectPath(request.nextUrl.pathname, !!user);
  if (!dest) return response;

  const redirect = NextResponse.redirect(new URL(dest, request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = { matcher: "/staff/:path*" };
