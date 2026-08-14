import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) return Response.json({ ok: false }, { status: 401 });

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email: body.email, password: body.password });
  if (error) return Response.json({ ok: false }, { status: 401 });
  return Response.json({ ok: true });
}
