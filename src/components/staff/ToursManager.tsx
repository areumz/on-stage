"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useConfirm } from "@/components/staff/ConfirmDialog";
import type { ShowRow } from "@/lib/types";

type KnownLocation = {
  cityCode: string;
  cityName: string;
  country: string;
  venue: string;
};

type PickerMode = "select" | "manual";
type FieldPicker = {
  cityCode: PickerMode;
  cityName: PickerMode;
  country: PickerMode;
  venue: PickerMode;
};

const SELECT_ALL: FieldPicker = {
  cityCode: "select",
  cityName: "select",
  country: "select",
  venue: "select",
};
const MANUAL_ALL: FieldPicker = {
  cityCode: "manual",
  cityName: "manual",
  country: "manual",
  venue: "manual",
};
const MANUAL_OPTION = "__manual__";

type Draft = {
  cityCode: string;
  cityName: string;
  country: string;
  venue: string;
  showDate: string;
  capacity: string;
  featured: boolean;
};

function toDraft(s: ShowRow): Draft {
  return {
    cityCode: s.city_code,
    cityName: s.city_name,
    country: s.country,
    venue: s.venue,
    showDate: s.show_date,
    capacity: String(s.capacity),
    featured: s.featured,
  };
}

const EMPTY_DRAFT: Draft = {
  cityCode: "",
  cityName: "",
  country: "",
  venue: "",
  showDate: "",
  capacity: "",
  featured: false,
};

function distinct(values: string[]): string[] {
  return [...new Set(values)];
}

async function errorMessageFor(res: Response): Promise<string> {
  if (res.status === 403) return "편집 권한이 없습니다.";
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    return body.error === "date_conflict"
      ? "해당 날짜에 예정된 공연이 있습니다."
      : "같은 날짜·도시 공연이 이미 있습니다. (회차 추가가 필요하면 문의 바랍니다)";
  }
  return `저장 실패 (${res.status})`;
}

// select면 항상 전체 목록이 뜨는 진짜 <select>, "[직접 입력]"을 고르면 빈 텍스트 인풋으로 전환
// 데이터로 값이 채워지는 것과 어느 위젯을 보여줄지는 서로 독립이라, 다른 필드가 이 필드의
// 값을 자동으로 채워도(cityCode 선택 시 나머지 3개) 위젯 모드는 그대로 유지.
function comboField({
  value,
  onChange,
  options,
  mode,
  setMode,
  placeholder,
  width,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  mode: PickerMode;
  setMode: (m: PickerMode) => void;
  placeholder: string;
  width: string;
}) {
  if (mode === "select") {
    return (
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value === MANUAL_OPTION) {
            setMode("manual");
            return;
          }
          onChange(e.target.value);
        }}
        className={`${width} rounded border border-gray-300 bg-white px-1 py-1 text-sm`}
      >
        <option value="" disabled>
          선택
        </option>
        {options.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
        <option value={MANUAL_OPTION}>직접 입력</option>
      </select>
    );
  }
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${width} rounded border border-gray-300 px-2 py-1`}
    />
  );
}

export default function ToursManager({
  artistSlug,
  shows,
  knownLocations,
  isOwner,
}: {
  artistSlug: string;
  shows: ShowRow[];
  knownLocations: KnownLocation[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editPicker, setEditPicker] = useState<FieldPicker>(MANUAL_ALL);
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY_DRAFT);
  const [addPicker, setAddPicker] = useState<FieldPicker>(SELECT_ALL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(timer);
  }, [error]);

  const sorted = [...shows].sort((a, b) =>
    sortDir === "asc"
      ? a.show_date.localeCompare(b.show_date)
      : b.show_date.localeCompare(a.show_date),
  );
  const editTitle = isOwner ? undefined : "관리자만 편집할 수 있습니다";

  function startEdit(s: ShowRow) {
    setEditingId(s.id);
    setDraft(toDraft(s));
    setEditPicker(MANUAL_ALL);
  }

  function startAdd() {
    setAdding(true);
    setNewDraft(EMPTY_DRAFT);
    setAddPicker(SELECT_ALL);
  }

  async function saveEdit(id: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/shows/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, capacity: Number(draft.capacity) }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await errorMessageFor(res));
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function handleAdd() {
    if (
      !newDraft.cityCode.trim() ||
      !newDraft.venue.trim() ||
      !newDraft.showDate ||
      !newDraft.capacity
    )
      return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/shows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artistSlug,
        ...newDraft,
        capacity: Number(newDraft.capacity),
      }),
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
    if (!(await confirm("이 공연을 삭제하시겠습니까?"))) return;
    setError(null);
    const res = await fetch(`/api/shows/${id}`, { method: "DELETE" });
    if (res.status === 204) {
      router.refresh();
      return;
    }
    setError(
      res.status === 403
        ? "삭제 권한이 없습니다."
        : `삭제 실패 (${res.status})`,
    );
  }

  // 지금까지 정해진(select 모드로 고른) 필드들과 전부 일치하는 knownLocations 부분집합.
  // 필드가 비어 있으면 그 필드는 조건에서 빠진다 — 아무것도 안 골랐으면 전체가 후보.
  function poolFor(fields: Draft): KnownLocation[] {
    return knownLocations.filter(
      (l) =>
        (!fields.cityCode || l.cityCode === fields.cityCode) &&
        (!fields.cityName || l.cityName === fields.cityName) &&
        (!fields.country || l.country === fields.country) &&
        (!fields.venue || l.venue === fields.venue),
    );
  }

  // 4개 필드 중 어느 걸 먼저 골라도 같은 규칙으로 나머지를 다룸 
  function fillFrom(
    fieldKey: keyof KnownLocation,
    value: string,
    fields: Draft,
  ): Draft {
    const next = { ...fields, [fieldKey]: value };
    const matches = poolFor(next);
    if (matches.length !== 1) return next;
    const picked = matches[0];
    return {
      ...next,
      cityCode: picked.cityCode,
      cityName: picked.cityName,
      country: picked.country,
      venue: picked.venue,
    };
  }

  function editableRow(
    fields: Draft,
    onChange: (d: Draft) => void,
    picker: FieldPicker,
    setPicker: (p: FieldPicker) => void,
  ) {
    // 지금까지 고른 필드들로 좁힌 후보 — 비어 있으면(모순되는 조합) 전체 목록으로 폴백해
    // select가 옵션 없이 텅 비지 않게 한다.
    const narrowed = poolFor(fields);
    const pool = narrowed.length > 0 ? narrowed : knownLocations;

    // "직접 입력"으로 전환하면 select로 골랐던 값도 같이 지운다 — placeholder가 보이는
    // 빈 인풋에서 새로 타이핑하게 한다(고른 값이 그대로 남아있으면 신규 도시를 입력하는
    // 건지 기존 값을 고친 건지 헷갈린다).
    function switchToManual() {
      setPicker(MANUAL_ALL);
      onChange({
        ...fields,
        cityCode: "",
        cityName: "",
        country: "",
        venue: "",
      });
    }

    return (
      <>
        <td className="px-4 py-3">
          <input
            type="date"
            value={fields.showDate}
            onChange={(e) => onChange({ ...fields, showDate: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </td>
        <td className="px-4 py-3">
          {comboField({
            value: fields.cityCode,
            onChange: (v) => onChange(fillFrom("cityCode", v, fields)),
            options: distinct(pool.map((l) => l.cityCode)),
            mode: picker.cityCode,
            setMode: switchToManual,
            placeholder: "ICN",
            width: "w-20",
          })}
        </td>
        <td className="px-4 py-3">
          {comboField({
            value: fields.cityName,
            onChange: (v) => onChange(fillFrom("cityName", v, fields)),
            options: distinct(pool.map((l) => l.cityName)),
            mode: picker.cityName,
            setMode: switchToManual,
            placeholder: "서울",
            width: "w-24",
          })}
        </td>
        <td className="px-4 py-3">
          {comboField({
            value: fields.country,
            onChange: (v) => onChange(fillFrom("country", v, fields)),
            options: distinct(pool.map((l) => l.country)),
            mode: picker.country,
            setMode: switchToManual,
            placeholder: "대한민국",
            width: "w-28",
          })}
        </td>
        <td className="px-4 py-3">
          {comboField({
            value: fields.venue,
            onChange: (v) => onChange(fillFrom("venue", v, fields)),
            options: distinct(pool.map((l) => l.venue)),
            mode: picker.venue,
            setMode: switchToManual,
            placeholder: "고척스카이돔",
            width: "w-36",
          })}
        </td>
        <td className="px-4 py-3">
          <input
            type="number"
            min={1}
            value={fields.capacity}
            onChange={(e) => onChange({ ...fields, capacity: e.target.value })}
            className="w-20 rounded border border-gray-300 px-2 py-1"
          />
        </td>
        <td className="px-4 py-3 text-center">
          <input
            type="checkbox"
            checked={fields.featured}
            onChange={(e) =>
              onChange({ ...fields, featured: e.target.checked })
            }
          />
        </td>
      </>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface-2">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-200 text-xs font-semibold text-gray-700">
            <tr>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() =>
                    setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                  }
                  aria-label={
                    sortDir === "asc"
                      ? "날짜 내림차순으로 정렬"
                      : "날짜 오름차순으로 정렬"
                  }
                  className="flex items-center gap-1 hover:text-gray-900"
                >
                  날짜 <span aria-hidden>{sortDir === "asc" ? "▲" : "▼"}</span>
                </button>
              </th>
              <th className="px-4 py-3">도시코드</th>
              <th className="px-4 py-3">도시</th>
              <th className="px-4 py-3">국가</th>
              <th className="px-4 py-3">베뉴</th>
              <th className="px-4 py-3">수용인원</th>
              <th className="px-4 py-3 text-center">메인 노출</th>
              <th className="px-4 py-3 text-right">수정</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id} className="border-b border-gray-100 last:border-0">
                {editingId === s.id ? (
                  <>
                    {editableRow(draft, setDraft, editPicker, setEditPicker)}
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => saveEdit(s.id)}
                        className="mr-2 text-brand disabled:opacity-50"
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-gray-500"
                      >
                        취소
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">{s.show_date}</td>
                    <td className="px-4 py-3">{s.city_code}</td>
                    <td className="px-4 py-3">{s.city_name}</td>
                    <td className="px-4 py-3">{s.country}</td>
                    <td className="px-4 py-3">{s.venue}</td>
                    <td className="px-4 py-3">{s.capacity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      {s.featured ? "✓" : ""}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={!isOwner}
                        title={editTitle}
                        onClick={() => startEdit(s)}
                        className="text-brand disabled:opacity-30"
                      >
                        편집
                      </button>
                      <button
                        type="button"
                        disabled={!isOwner}
                        title={editTitle}
                        onClick={() => handleDelete(s.id)}
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
              {adding ? (
                <>
                  {editableRow(newDraft, setNewDraft, addPicker, setAddPicker)}
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleAdd}
                      className="mr-2 text-brand disabled:opacity-50"
                    >
                      추가
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdding(false)}
                      className="text-gray-500"
                    >
                      취소
                    </button>
                  </td>
                </>
              ) : (
                <td colSpan={8} className="px-4 py-3">
                  <button
                    type="button"
                    disabled={!isOwner}
                    title={editTitle}
                    onClick={startAdd}
                    className="text-sm text-brand disabled:opacity-30"
                  >
                    + 공연 추가
                  </button>
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
      {error && <p className="px-4 py-2 text-sm text-red-500">{error}</p>}
      {dialog}
    </div>
  );
}
