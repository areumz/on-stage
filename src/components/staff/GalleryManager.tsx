"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "@/components/staff/ConfirmDialog";
import { useAutoDismiss } from "@/lib/hooks";
import type { GalleryListItem } from "@/lib/types";

export default function GalleryManager({ artistSlug, images }: { artistSlug: string; images: GalleryListItem[] }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  useAutoDismiss(error, setError, null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일을 다시 골라도 change가 뜨도록 리셋
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const urlRes = await fetch("/api/gallery/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistSlug,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      if (!urlRes.ok) {
        const body = await urlRes.json().catch(() => ({}));
        throw new Error(
          body.error === "unsupported type" ? "지원하지 않는 파일 형식입니다 (jpeg/png/webp만)" : `업로드 준비 실패 (${urlRes.status})`
        );
      }
      const { signedUrl, path } = await urlRes.json();

      // 서명 URL로 브라우저가 Storage에 직접 PUT — 서버를 거치지 않음 (Vercel 4.5MB 바디 제한 우회)
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error(`파일 전송 실패 (${putRes.status})`);

      const createRes = await fetch("/api/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistSlug, path }),
      });
      if (!createRes.ok) throw new Error(`갤러리 등록 실패 (${createRes.status})`);

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirm("이 이미지를 삭제하시겠습니까?"))) return;
    setError(null);
    const res = await fetch(`/api/gallery/${id}`, { method: "DELETE" });
    if (res.status === 204) {
      router.refresh();
      return;
    }
    setError(res.status === 403 ? "삭제 권한이 없습니다." : `삭제 실패 (${res.status})`);
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <label className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          {uploading ? "업로드 중…" : "이미지 업로드"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={handleFileChange}
          />
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-4">
        {images.map((img) => (
          <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-surface-2">
            <Image src={img.src} alt={img.creator} fill sizes="200px" className="object-cover" />
            <button
              type="button"
              onClick={() => handleDelete(img.id)}
              className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              삭제
            </button>
          </div>
        ))}
        {images.length === 0 && <p className="col-span-4 text-sm text-gray-500">아직 업로드된 이미지가 없습니다.</p>}
      </div>
      {dialog}
    </div>
  );
}
