// 배경 이미지 Storage(stage-backdrops) 공용 헬퍼. 경로: <user_id>/<sequence_id>/<uuid>.<ext>
// 서명 URL 은 <img>/3D 텍스처에만 쓴다 — DB·로그·오류 메시지에 남기지 않는다.
import type { SupabaseClient } from "@supabase/supabase-js";

export const BACKDROP_BUCKET = "stage-backdrops";
export const folderOf = (userId: string, sequenceId: string) => `${userId}/${sequenceId}`;

// 폴더 전체 이름. 한도보다 많이 쌓인 폴더도 끝까지 읽는다(정리용). 실패는 null.
export async function listAll(supabase: SupabaseClient, folder: string): Promise<string[] | null> {
  const PAGE = 100;
  const all: string[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase.storage.from(BACKDROP_BUCKET).list(folder, { limit: PAGE, offset: page * PAGE });
    if (error || !data) return null;
    all.push(...data.map((o) => o.name).filter((n) => n && !n.startsWith(".")));
    if (data.length < PAGE) return all;
  }
  return all; // ponytail: 5000개 상한. 그 이상은 정책(폴더당 UPLOADS_PER_* 상한)상 나올 수 없다.
}

// 파일 하나가 있는지 정확한 이름으로 찾는다(목록 상한에 걸리지 않게 search 사용). 실패는 null.
export async function fileExists(supabase: SupabaseClient, folder: string, name: string): Promise<boolean | null> {
  const { data, error } = await supabase.storage.from(BACKDROP_BUCKET).list(folder, { limit: 10, search: name });
  if (error || !data) return null;
  return data.some((o) => o.name === name);
}

// "<folder>/<파일명>" 모양(한 단계, 이중 슬래시·.. 없음)만 내 폴더 경로로 인정한다.
export function ownFileName(path: unknown, folder: string): string | null {
  if (typeof path !== "string" || !path.startsWith(`${folder}/`)) return null;
  const name = path.slice(folder.length + 1);
  return name && !name.includes("/") && name !== ".." && name !== "." ? name : null;
}
