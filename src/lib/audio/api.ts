// 브라우저용 업로드 호출. 서명 URL 은 PUT 에만 쓰고 어디에도 남기지 않는다.
import type { Result } from "@/lib/director/api";

export async function createTrack(input: {
  artistId: string;
  title: string;
  filename: string;
  size: number;
  durationSec: number;
}): Promise<Result<{ trackId: string; signedUrl: string }>> {
  let res: Response;
  try {
    res = await fetch("/api/audio-tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: { code: "connection_failed", status: 0 } };
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: { code: typeof body?.error === "string" ? body.error : "internal_error", status: res.status } };
  }
  return { ok: true, data: body };
}

// fetch 는 업로드 진행률을 못 줘서 XHR 을 쓴다. 실패·중단은 reject 가 아니라 ok:false 로 돌려준다.
export function uploadToSignedUrl(
  signedUrl: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void,
): { promise: Promise<{ ok: boolean }>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<{ ok: boolean }>((resolve) => {
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300 });
    xhr.onerror = () => resolve({ ok: false });
    xhr.onabort = () => resolve({ ok: false });
    xhr.send(file);
  });
  return { promise, abort: () => xhr.abort() };
}

export async function deleteTrack(id: string): Promise<void> {
  await fetch(`/api/audio-tracks/${id}`, { method: "DELETE" }).catch(() => {});
}
