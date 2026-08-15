import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 앱에서 Supabase에 닿는 유일한 진입점. 요청마다 새로 만든다 — 클라이언트를 재사용하지 말 것
// (createServerClient 문서 권고).
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component 렌더 중 호출된 경우 — 쿠키를 못 쓴다. 세션 갱신은 proxy.ts(Task 6)가 담당
        }
      },
    },
  });
}
