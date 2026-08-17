"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ArtistRow } from "@/lib/types";

type ShaderPattern = "wave" | "ripple" | "grain";

type Draft = {
  color: string;
  news: string;
  tourBadge: string;
  tourTitleKo: string;
  tourYear: string;
  shaderPattern: ShaderPattern;
  shaderFreq: string;
  shaderFalloff: string;
  shaderSpeed: string;
};

function toDraft(a: ArtistRow): Draft {
  return {
    color: a.color,
    news: a.news,
    tourBadge: a.tour_badge,
    tourTitleKo: a.tour_title_ko,
    tourYear: String(a.tour_year),
    shaderPattern: a.shader_pattern as ShaderPattern,
    shaderFreq: String(a.shader_freq),
    shaderFalloff: String(a.shader_falloff),
    shaderSpeed: String(a.shader_speed),
  };
}

async function errorMessageFor(res: Response): Promise<string> {
  if (res.status === 403) return "편집 권한이 없습니다.";
  if (res.status === 400) return "입력값을 확인해주세요.";
  return `저장 실패 (${res.status})`;
}

export default function ArtistEditForm({ artist, isOwner }: { artist: ArtistRow; isOwner: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => toDraft(artist));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [success]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    const res = await fetch(`/api/artists/${artist.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        color: draft.color,
        news: draft.news,
        tourBadge: draft.tourBadge,
        tourTitleKo: draft.tourTitleKo,
        tourYear: Number(draft.tourYear),
        shaderPattern: draft.shaderPattern,
        shaderFreq: Number(draft.shaderFreq),
        shaderFalloff: Number(draft.shaderFalloff),
        shaderSpeed: Number(draft.shaderSpeed),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await errorMessageFor(res));
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  const editTitle = isOwner ? undefined : "관리자만 편집할 수 있습니다";
  const fieldClass = "w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-400";

  return (
    <div className="rounded-xl border border-gray-200 bg-surface-2 p-6">
      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          색상
          <input
            type="color"
            disabled={!isOwner}
            title={editTitle}
            value={draft.color}
            onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            className="h-9 w-16 cursor-pointer rounded border border-gray-300 disabled:cursor-not-allowed"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          NOW 뉴스
          <input
            disabled={!isOwner}
            title={editTitle}
            value={draft.news}
            onChange={(e) => setDraft({ ...draft, news: e.target.value })}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          투어 배지
          <input
            disabled={!isOwner}
            title={editTitle}
            value={draft.tourBadge}
            onChange={(e) => setDraft({ ...draft, tourBadge: e.target.value })}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          투어명
          <input
            disabled={!isOwner}
            title={editTitle}
            value={draft.tourTitleKo}
            onChange={(e) => setDraft({ ...draft, tourTitleKo: e.target.value })}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          투어 연도
          <input
            type="number"
            disabled={!isOwner}
            title={editTitle}
            value={draft.tourYear}
            onChange={(e) => setDraft({ ...draft, tourYear: e.target.value })}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          셰이더 패턴
          <select
            disabled={!isOwner}
            title={editTitle}
            value={draft.shaderPattern}
            onChange={(e) => setDraft({ ...draft, shaderPattern: e.target.value as ShaderPattern })}
            className={fieldClass}
          >
            <option value="wave">wave</option>
            <option value="ripple">ripple</option>
            <option value="grain">grain</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          셰이더 주파수
          <input
            type="number"
            step="0.1"
            disabled={!isOwner}
            title={editTitle}
            value={draft.shaderFreq}
            onChange={(e) => setDraft({ ...draft, shaderFreq: e.target.value })}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          셰이더 감쇠
          <input
            type="number"
            step="0.05"
            min={0}
            max={1}
            disabled={!isOwner}
            title={editTitle}
            value={draft.shaderFalloff}
            onChange={(e) => setDraft({ ...draft, shaderFalloff: e.target.value })}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          셰이더 속도
          <input
            type="number"
            step="0.1"
            min={0}
            disabled={!isOwner}
            title={editTitle}
            value={draft.shaderSpeed}
            onChange={(e) => setDraft({ ...draft, shaderSpeed: e.target.value })}
            className={fieldClass}
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={!isOwner || saving}
          title={editTitle}
          onClick={handleSave}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-emerald-700">정상적으로 저장되었습니다.</p>}
      </div>
    </div>
  );
}
