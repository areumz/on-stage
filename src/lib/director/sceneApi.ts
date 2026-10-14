// 장면 확장(배경 설정) 호출 헬퍼. 항상 Result 를 돌려주고 예외를 던지지 않는다.
// 서명 URL(이미지 조회·업로드)은 <img src>·3D 텍스처·PUT 에만 쓰고 화면 문구·로그·저장소에 남기지 않는다.
import { uploadToSignedUrl } from "@/lib/audio/api";
import type { ApiError, Result } from "@/lib/director/api";
import { UPLOAD_LIMIT_BYTES, UPLOAD_MIME, parseSceneEdit, type SceneEdit } from "@/lib/stage/scene";

export type BackdropImage = { path: string; name: string; url: string };

async function call<T>(url: string, init?: RequestInit): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: { code: "connection_failed", status: 0 } };
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: { code: typeof body?.error === "string" ? body.error : "internal_error", status: res.status } };
  return { ok: true, data: body as T };
}

const base = (id: string) => `/api/sequences/${id}`;

// edit 가 null 이면 사용자가 고친 값을 전부 지운다(AI 제안으로 전체 되돌리기)
export async function saveSceneEdit(id: string, edit: SceneEdit | null, sectionCount: number): Promise<Result<SceneEdit | null>> {
  const r = await call<{ sceneEdit: unknown }>(`${base(id)}/scene`, { method: "PATCH", body: JSON.stringify({ edit }) });
  // 서버가 돌려준 값을 한 번 더 정리해 쓴다(모양이 깨졌으면 없는 것으로)
  return r.ok ? { ok: true, data: parseSceneEdit(r.data.sceneEdit, sectionCount) } : r;
}

// 이미지 API 는 연출별(/api/sequences/{id}/backdrop-images)과 내 무대 연출 메뉴용(/api/stage-images)이 같은 모양이라 주소만 받는다
export const sequenceImagesUrl = (id: string) => `${base(id)}/backdrop-images`;
export const STUDIO_IMAGES_URL = "/api/stage-images";

export async function listBackdropImages(url: string): Promise<Result<BackdropImage[]>> {
  const r = await call<{ images: BackdropImage[] }>(url);
  return r.ok ? { ok: true, data: Array.isArray(r.data.images) ? r.data.images : [] } : r;
}

export const deleteBackdropImage = (url: string, path: string) =>
  call<{ ok: true }>(`${url}?path=${encodeURIComponent(path)}`, { method: "DELETE" });

// 업로드: 1) 서버에서 경로·업로드 URL 받기 2) 파일을 PUT. PUT 은 audio-tracks 업로드와 같은 헬퍼(uploadToSignedUrl)를 그대로 쓴다.
export async function uploadBackdropImage(url: string, file: File): Promise<Result<{ path: string }>> {
  const made = await call<{ path: string; uploadUrl: string }>(url, {
    method: "POST",
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  if (!made.ok) return made;
  const put = await uploadToSignedUrl(made.data.uploadUrl, file, file.type, () => {}).promise;
  if (!put.ok) return { ok: false, error: { code: "upload_failed", status: 0 } };
  return { ok: true, data: { path: made.data.path } };
}

// ── 클라이언트 사전 검사(빨리 알리기용. 서버 검사가 최종) ─────────────────────────────
export function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function precheckImage(file: { type: string; size: number }): string | null {
  const problems: string[] = [];
  if (file.size > UPLOAD_LIMIT_BYTES) problems.push(`이미지는 5MB 이하여야 해요 (지금 ${megabytes(file.size)})`);
  if (!(UPLOAD_MIME as readonly string[]).includes(file.type)) problems.push("jpg, png, webp만 올릴 수 있어요");
  return problems.length ? problems.join(" · ") : null;
}

const MESSAGES: Record<string, string> = {
  connection_failed: "연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요",
  invalid_scene: "설정 값이 올바르지 않아요. 다시 고른 뒤 시도해 주세요",
  not_approved: "승인된 연출만 저장할 수 있어요",
  invalid_image: "이 이미지는 올릴 수 없어요. 5MB 이하 jpg, png, webp인지 확인해 주세요",
  image_limit: "이미지를 더 올릴 수 없어요. 안 쓰는 이미지를 지운 뒤 다시 올려 주세요",
  upload_failed: "이미지를 올리지 못했어요. 다시 시도해 주세요",
};

export function sceneErrorKo(e: ApiError, fallback = "저장하지 못했어요. 잠시 후 다시 시도해 주세요"): string {
  if (e.status === 404) return "연출을 찾을 수 없어요";
  return MESSAGES[e.code] ?? fallback;
}

// 업로드 전용 문구: 저장용 문구(not_approved 등)를 그대로 쓰면 어색하다
export function uploadErrorKo(e: ApiError): string {
  if (e.code === "not_approved") return "승인된 연출에만 이미지를 올릴 수 있어요";
  return sceneErrorKo(e, "이미지를 올리지 못했어요. 다시 시도해 주세요");
}
