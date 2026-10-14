"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { renameSequence, type Result } from "@/lib/director/api";
import { SEQUENCE_NAME_MAX } from "@/lib/director/format";
import { checkName, nameCount, renameErrorKo } from "@/lib/director/rename";

type Props = {
  sequenceId: string;
  name: string; // 지금 보여 주는 이름 (사용자 이름 또는 기본 이름)
  defaultName: string; // 비우고 저장하면 돌아가는 기본 이름 "곡 제목 · 날짜 시간"
  as?: "p" | "h1";
  textClass?: string;
  // 쇼케이스에서 실제 API 를 부르지 않기 위한 주입점
  onRename?: (id: string, name: string | null) => Promise<Result<{ name: string | null }>>;
};

// 내 연출 목록과 재생 화면 제목이 같이 쓰는 이름 바꾸기: 이름 옆 버튼 → 그 자리에서 입력(Enter 저장 / Esc 취소).
export default function RenameField({ sequenceId, name, defaultName, as: Tag = "p", textClass = "font-semibold", onRename = renameSequence }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null); // 저장 직후 새로고침이 끝나기 전까지 보여 줄 이름
  // 새 name prop 이 오면(새로고침 완료) 옛 saved 를 버린다 — 렌더 중 파생 상태 패턴
  const [seenName, setSeenName] = useState(name);
  if (seenName !== name) {
    setSeenName(name);
    setSaved(null);
  }
  const inputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const shown = saved ?? name;

  // 편집이 시작되면 입력으로, 끝나면(저장·취소 모두) 눌렀던 버튼으로 포커스를 옮긴다 — 닫은 직후엔 버튼이 아직 없어서 effect 에서 한다
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (wasEditing.current) openRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  function open() {
    setValue(shown);
    setError(null);
    setEditing(true);
  }

  function close() {
    setEditing(false);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (value.trim() === shown) return close(); // 바꾼 게 없으면 그대로 닫는다(기본 이름이 직접 입력한 이름으로 굳어지지 않게)
    const check = checkName(value);
    if (!check.ok) return setError(check.message);
    setSaving(true);
    setError(null);
    const r = await onRename(sequenceId, check.name);
    setSaving(false);
    if (!r.ok) return setError(renameErrorKo(r.error));
    setSaved(r.data.name ?? defaultName);
    close();
    router.refresh();
  }

  const count = nameCount(value);

  if (!editing) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <Tag className={`min-w-0 break-words ${textClass}`}>{shown}</Tag>
        <button
          ref={openRef}
          type="button"
          onClick={open}
          aria-label={`${shown} 이름 바꾸기`}
          className="min-h-10 rounded-full px-3 text-sm font-medium text-brand-soft hover:text-white focus-visible:outline-2 focus-visible:outline-brand"
        >
          이름 바꾸기
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="flex w-full min-w-0 flex-col gap-1.5" aria-label="연출 이름 바꾸기">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`rn-${sequenceId}`} className="sr-only">연출 이름</label>
        <input
          id={`rn-${sequenceId}`}
          ref={inputRef}
          value={value}
          readOnly={saving} // disabled 는 포커스를 잃게 하므로 저장 중에는 읽기 전용으로
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && !saving && (e.stopPropagation(), close())}
          aria-describedby={`rn-${sequenceId}-help`}
          aria-invalid={!!error || count.over}
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/25 bg-transparent px-3 text-base text-white placeholder:text-white/40 focus-visible:outline-2 focus-visible:outline-brand read-only:opacity-60 md:text-sm"
        />
        <button type="submit" aria-disabled={saving} className="min-h-10 rounded-full bg-brand px-4 text-sm font-semibold text-bg-dark hover:opacity-90 focus-visible:outline-2 focus-visible:outline-white aria-disabled:opacity-60">
          {saving ? "저장 중…" : error ? "다시 시도" : "저장"}
        </button>
        <button type="button" aria-disabled={saving} onClick={() => !saving && close()} className="min-h-10 rounded-full border border-white/20 px-4 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-brand aria-disabled:opacity-60">
          취소
        </button>
      </div>
      <p id={`rn-${sequenceId}-help`} className={`text-xs ${count.over ? "text-rose-300" : "text-white/60"}`}>
        {count.over ? `${SEQUENCE_NAME_MAX}자를 넘었어요` : `${count.count}/${SEQUENCE_NAME_MAX}자`} · 비우고 저장하면 기본 이름(곡 제목 · 날짜 시간)으로 돌아가요
      </p>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    </form>
  );
}
