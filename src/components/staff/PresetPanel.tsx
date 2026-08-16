"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/staff/ConfirmDialog";
import { writeStageState } from "@/lib/hooks";
import { mergeStageState, type StageState } from "@/lib/stageState";

type Preset = { id: string; name: string; state: StageState };

function sortedByName(presets: Preset[]): Preset[] {
  return [...presets].sort((a, b) => a.name.localeCompare(b.name));
}

async function postPreset(artistSlug: string, name: string, state: StageState, overwrite: boolean) {
  return fetch("/api/stage-presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artistSlug, name, state, overwrite }),
  });
}

export default function PresetPanel({ artistSlug, state, onChange }: {
  artistSlug: string;
  state: StageState;
  onChange: (next: StageState) => void;
}) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stage-presets?artist=${artistSlug}`)
      .then((res) => {
        if (!res.ok) throw new Error(`불러오기 실패 (${res.status})`);
        return res.json();
      })
      .then((body: { presets: Preset[] }) => {
        if (!cancelled) setPresets(sortedByName(body.presets ?? []));
      })
      .catch(() => {
        if (!cancelled) setError("프리셋을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [artistSlug]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(timer);
  }, [error]);

  // 이름 클릭 → 즉시 적용(confirm·로딩 표시 없음, design-v2.md §5.3). 불러온 값을 씬에 반영하는
  // 동시에 작업 중 상태(localStorage)도 갱신해, 이 프리셋이 다음 작업의 새 기준점이 되게 한다.
  function handleLoad(preset: Preset) {
    const merged = mergeStageState(preset.state, state);
    writeStageState(artistSlug, JSON.stringify(merged));
    onChange(merged);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      let res = await postPreset(artistSlug, trimmed, state, false);
      if (res.status === 409) {
        if (!(await confirm("이미 있는 이름입니다. 덮어쓸까요?"))) return;
        res = await postPreset(artistSlug, trimmed, state, true);
      }
      if (!res.ok) throw new Error(`저장 실패 (${res.status})`);
      const { id } = await res.json();
      setPresets((prev) => sortedByName([...prev.filter((p) => p.name !== trimmed), { id, name: trimmed, state }]));
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirm("이 프리셋을 삭제하시겠습니까?"))) return;
    const res = await fetch(`/api/stage-presets/${id}`, { method: "DELETE" });
    if (res.status === 204) {
      setPresets((prev) => prev.filter((p) => p.id !== id));
      return;
    }
    setError(res.status === 403 ? "삭제 권한이 없습니다." : `삭제 실패 (${res.status})`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="text"
          aria-label="프리셋 이름"
          placeholder="프리셋 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-white/25 bg-transparent px-3 py-1.5 text-sm text-white placeholder:text-white/40"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          저장
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {loading ? (
        <p className="text-xs text-white/40">불러오는 중…</p>
      ) : presets.length === 0 ? (
        <p className="text-xs text-white/40">저장된 프리셋이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {presets.map((preset) => (
            <li key={preset.id} className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: preset.state.color }} />
              <button
                type="button"
                onClick={() => handleLoad(preset)}
                className="min-w-0 flex-1 truncate text-left text-sm text-white/80 hover:text-white"
              >
                {preset.name}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(preset.id)}
                aria-label={`${preset.name} 삭제`}
                className="shrink-0 text-xs text-white/40 hover:text-red-400"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
      {dialog}
    </div>
  );
}
