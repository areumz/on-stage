// audio-tracks 버킷의 서명 URL. 서명 URL 은 비밀번호처럼 다룬다:
// DB 에 저장하지 않고, 로그에 남기지 않고, 화면에 텍스트로 보여 주지 않는다. 요청마다 새로 만든다.
import type { SupabaseClient } from "@supabase/supabase-js";

// Python 분석은 앞 작업 뒤에 줄을 설 수 있어서 30분 이상 (계약서 §3.1)
export const SIGNED_URL_SECONDS = 30 * 60;

export async function signAudioUrl(
  supabase: SupabaseClient,
  storagePath: string,
  seconds: number = SIGNED_URL_SECONDS,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from("audio-tracks").createSignedUrl(storagePath, seconds);
  return error || !data ? null : data.signedUrl;
}
