"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useConfirm } from "@/components/staff/ConfirmDialog";
import { neighborSwap } from "@/lib/trackOrder";
import type { TrackRow } from "@/lib/types";

// smallint 최댓값 — 실제 트랙 no가 이 값을 쓸 일이 없어 3단계 swap의 임시 홀딩값으로 안전하다.
const REORDER_TEMP_NO = 32767;

type Draft = { title: string; duration: string; coverFrom: string; coverTo: string };

function toDraft(t: TrackRow): Draft {
  return { title: t.title, duration: t.duration, coverFrom: t.cover_from, coverTo: t.cover_to };
}

const EMPTY_DRAFT: Draft = { title: "", duration: "", coverFrom: "#888888", coverTo: "#444444" };

async function errorMessageFor(res: Response): Promise<string> {
  if (res.status === 403) return "편집 권한이 없습니다.";
  if (res.status === 409) return "이미 그 순서에 다른 트랙이 있습니다.";
  return `저장 실패 (${res.status})`;
}

async function patchTrack(id: string, body: Record<string, unknown>) {
  return fetch(`/api/tracks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function TracksManager({
  artistSlug,
  tracks,
  isOwner,
}: {
  artistSlug: string;
  tracks: TrackRow[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { confirm, dialog } = useConfirm();

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

  const sorted = [...tracks].sort((a, b) => a.no - b.no);
  const editTitle = isOwner ? undefined : "관리자만 편집할 수 있습니다";

  function startEdit(t: TrackRow) {
    setEditingId(t.id);
    setDraft(toDraft(t));
  }

  async function saveEdit(id: string) {
    setBusy(true);
    setError(null);
    setSuccess(false);
    const res = await patchTrack(id, draft);
    setBusy(false);
    if (!res.ok) {
      setError(await errorMessageFor(res));
      return;
    }
    setEditingId(null);
    setSuccess(true);
    router.refresh();
  }

  async function handleAdd() {
    if (!newDraft.title.trim() || !newDraft.duration.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artistSlug, ...newDraft }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await errorMessageFor(res));
      return;
    }
    setAdding(false);
    setNewDraft(EMPTY_DRAFT);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!(await confirm("이 트랙을 삭제하시겠습니까?"))) return;
    setError(null);
    const res = await fetch(`/api/tracks/${id}`, { method: "DELETE" });
    if (res.status === 204) {
      router.refresh();
      return;
    }
    setError(res.status === 403 ? "삭제 권한이 없습니다." : `삭제 실패 (${res.status})`);
  }

  async function handleReorder(track: TrackRow, direction: "up" | "down") {
    const pair = neighborSwap(sorted, track.id, direction);
    if (!pair) return;
    const [a, b] = pair;
    setBusy(true);
    setError(null);
    // unique(artist_id, no) 제약 때문에 두 값을 직접 교환할 수 없어 임시값을 경유하는
    // 3단계로 처리한다(design-v2.md §7.3).
    const r1 = await patchTrack(a.id, { no: REORDER_TEMP_NO });
    const r2 = r1.ok ? await patchTrack(b.id, { no: a.no }) : r1;
    const r3 = r2.ok ? await patchTrack(a.id, { no: b.no }) : r2;
    setBusy(false);
    if (!r3.ok) {
      setError(await errorMessageFor(r3));
      return;
    }
    router.refresh();
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface-2">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 text-xs text-gray-500">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">제목</th>
            <th className="px-4 py-3">길이</th>
            <th className="px-4 py-3">커버 그라디언트</th>
            <th className="px-4 py-3 text-right">수정</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t, i) => (
            <tr key={t.id} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-3 text-gray-500">{t.no}</td>
              {editingId === t.id ? (
                <>
                  <td className="px-4 py-3">
                    <input
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      className="w-full rounded border border-gray-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      value={draft.duration}
                      onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
                      placeholder="3:45"
                      className="w-20 rounded border border-gray-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <input
                        type="color"
                        value={draft.coverFrom}
                        onChange={(e) => setDraft({ ...draft, coverFrom: e.target.value })}
                        className="h-7 w-7 cursor-pointer rounded border border-gray-300"
                      />
                      <input
                        type="color"
                        value={draft.coverTo}
                        onChange={(e) => setDraft({ ...draft, coverTo: e.target.value })}
                        className="h-7 w-7 cursor-pointer rounded border border-gray-300"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" disabled={busy} onClick={() => saveEdit(t.id)} className="mr-2 text-brand disabled:opacity-50">
                      저장
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-gray-500">
                      취소
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-4 py-3">{t.title}</td>
                  <td className="px-4 py-3">{t.duration}</td>
                  <td className="px-4 py-3">
                    <div className="flex h-5 w-16 overflow-hidden rounded">
                      <div className="flex-1" style={{ backgroundColor: t.cover_from }} />
                      <div className="flex-1" style={{ backgroundColor: t.cover_to }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      aria-label={`${t.title} 위로`}
                      disabled={!isOwner || busy || i === 0}
                      title={editTitle}
                      onClick={() => handleReorder(t, "up")}
                      className="px-1 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`${t.title} 아래로`}
                      disabled={!isOwner || busy || i === sorted.length - 1}
                      title={editTitle}
                      onClick={() => handleReorder(t, "down")}
                      className="px-1 disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={!isOwner}
                      title={editTitle}
                      onClick={() => startEdit(t)}
                      className="ml-2 text-brand disabled:opacity-30"
                    >
                      편집
                    </button>
                    <button
                      type="button"
                      disabled={!isOwner}
                      title={editTitle}
                      onClick={() => handleDelete(t.id)}
                      className="ml-2 text-red-500 disabled:opacity-30"
                    >
                      삭제
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
          <tr>
            <td className="px-4 py-3 text-gray-400">+</td>
            {adding ? (
              <>
                <td className="px-4 py-3">
                  <input
                    value={newDraft.title}
                    onChange={(e) => setNewDraft({ ...newDraft, title: e.target.value })}
                    placeholder="제목"
                    className="w-full rounded border border-gray-300 px-2 py-1"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    value={newDraft.duration}
                    onChange={(e) => setNewDraft({ ...newDraft, duration: e.target.value })}
                    placeholder="3:45"
                    className="w-20 rounded border border-gray-300 px-2 py-1"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <input
                      type="color"
                      value={newDraft.coverFrom}
                      onChange={(e) => setNewDraft({ ...newDraft, coverFrom: e.target.value })}
                      className="h-7 w-7 cursor-pointer rounded border border-gray-300"
                    />
                    <input
                      type="color"
                      value={newDraft.coverTo}
                      onChange={(e) => setNewDraft({ ...newDraft, coverTo: e.target.value })}
                      className="h-7 w-7 cursor-pointer rounded border border-gray-300"
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" disabled={busy} onClick={handleAdd} className="mr-2 text-brand disabled:opacity-50">
                    추가
                  </button>
                  <button type="button" onClick={() => setAdding(false)} className="text-gray-500">
                    취소
                  </button>
                </td>
              </>
            ) : (
              <td colSpan={4} className="px-4 py-3">
                <button
                  type="button"
                  disabled={!isOwner}
                  title={editTitle}
                  onClick={() => setAdding(true)}
                  className="text-sm text-brand disabled:opacity-30"
                >
                  + 트랙 추가
                </button>
              </td>
            )}
          </tr>
        </tbody>
      </table>
      {error && <p className="px-4 py-2 text-sm text-red-500">{error}</p>}
      {success && <p className="px-4 py-2 text-sm text-emerald-700">정상적으로 저장되었습니다.</p>}
      {dialog}
    </div>
  );
}
