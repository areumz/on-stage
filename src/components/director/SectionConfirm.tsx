"use client";

import { useMemo, useRef, useState } from "react";
import { useSectionAudio } from "@/components/director/useSectionAudio";
import type { ApiError } from "@/lib/director/api";
import {
  addSection, boundaryRange, canAdd, canSplit, formatTime, fromSections, listenWindow, MAX_LABEL, MAX_MOOD, MAX_SECTIONS, mergeUp,
  moveBoundary, parseTime, type RowErrorKind, rowIndexAt, setEnd, split, startOf, toInputs, validateSections, xToSec, type EditRow,
} from "@/lib/director/sections";
import type { ConfirmSectionsInterrupt, SectionInput } from "@/lib/python/contract";

type Props = {
  audioTrackId: string;
  interrupt: ConfirmSectionsInterrupt;
  badge: string;
  submitting: boolean;
  error: ApiError | null;
  onSubmit: (sections: SectionInput[]) => void;
};

// 새 interruptId 가 오면 편집 상태를 통째로 버린다
export default function SectionConfirm(props: Props) {
  return <Inner key={props.interrupt.interruptId} {...props} />;
}

const DOTS = ["bg-white/40", "bg-brand", "bg-sky-300", "bg-emerald-300", "bg-amber-300", "bg-pink-300"];
const BLOCKS = ["bg-white/[0.06]", "bg-brand/25", "bg-sky-300/20", "bg-emerald-300/20", "bg-amber-300/20", "bg-pink-300/20"];
const FIX: Record<RowErrorKind, string> = {
  short: "8초 이상으로 늘린",
  label: `이름을 1~${MAX_LABEL}자로 고친`,
  mood: `분위기를 ${MAX_MOOD}자 이하로 줄인`,
  gap: "구간 시간을 이어 준",
};
const btn =
  "rounded-full border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:text-white/60 disabled:opacity-50 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-soft";
const field =
  "rounded-lg border bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-soft disabled:opacity-60";

// 끝 시간 입력: 유효한 값이면 타이핑 즉시 반영한다(모바일에서 키보드를 닫지 않고 바로 "이대로 진행"을 눌러도 입력이 전송되도록).
// 받아들일 수 없는 값은 blur 때 원래 값으로 되돌리고, 그동안 오류 표시(rejected)를 부모가 보여 준다.
function TimeInput({ value, disabled, rejected, label, describedBy, onCommit }: {
  value: number; disabled: boolean; rejected: boolean; label: string; describedBy?: string; onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      aria-invalid={rejected || undefined}
      aria-describedby={describedBy}
      inputMode="text"
      placeholder="m:ss"
      disabled={disabled}
      value={draft ?? formatTime(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        onCommit(e.target.value);
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className={`${field} w-16 text-center tabular-nums ${rejected ? "border-rose-400" : "border-white/15"}`}
    />
  );
}

function Timeline({ rows, durationSec, energy, disabled, onMove, playTime, activeIdx, onSeek }: {
  rows: EditRow[]; durationSec: number; energy: number[]; disabled: boolean; onMove: (i: number, sec: number) => void;
  playTime: number; activeIdx: number | null; onSeek: (sec: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const max = Math.max(...energy, 0) || 1;
  const pct = (s: number) => `${(s / durationSec) * 100}%`;
  const ticks = Array.from({ length: Math.floor(durationSec / 20) + 1 }, (_, k) => k * 20);

  const drag = (i: number, e: React.PointerEvent) => {
    if (!track.current || e.buttons === 0) return;
    const r = track.current.getBoundingClientRect();
    onMove(i, ((e.clientX - r.left) / r.width) * durationSec);
  };
  const key = (i: number, e: React.KeyboardEvent) => {
    const { min, max } = boundaryRange(rows, i);
    const now = rows[i].endSec;
    const to: Record<string, number> = {
      ArrowRight: now + (e.shiftKey ? 10 : 1), ArrowUp: now + (e.shiftKey ? 10 : 1),
      ArrowLeft: now - (e.shiftKey ? 10 : 1), ArrowDown: now - (e.shiftKey ? 10 : 1),
      PageUp: now + 10, PageDown: now - 10, Home: min, End: max,
    };
    if (!(e.key in to)) return;
    e.preventDefault();
    onMove(i, to[e.key]);
  };

  return (
    <div className="hidden rounded-2xl border border-white/10 bg-bg-dark-2 px-6 pb-3 pt-8 md:block">
      {/* 막대 빈 곳을 누르면 그 위치로 이동한다. 경계 핸들은 pointerdown 을 막아 기존 드래그가 그대로 동작한다. */}
      <div
        ref={track}
        className="relative h-24 cursor-pointer"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const r = track.current?.getBoundingClientRect();
          if (r) onSeek(xToSec(e.clientX, r.left, r.width, durationSec));
        }}
      >
        <div className="absolute inset-0 flex items-end" aria-hidden>
          {/* 소수점이 긴 퍼센트는 브라우저가 스타일을 반올림해 읽어서 서버 HTML 과 어긋난다(하이드레이션 불일치). 소수 첫째 자리로 맞춘다. */}
          {energy.map((v, k) => (
            <div key={k} className="flex-1 bg-white/15" style={{ height: `${Math.max(4, Math.round((v / max) * 1000) / 10)}%` }} />
          ))}
        </div>
        {rows.map((r, i) => (
          <div
            key={i}
            className={`absolute inset-y-0 flex items-center justify-center overflow-hidden border text-xs text-white ${BLOCKS[i % BLOCKS.length]} ${i === activeIdx ? "border-amber-300" : "border-white/10"}`}
            style={{ left: pct(startOf(rows, i)), width: pct(r.endSec - startOf(rows, i)) }}
          >
            <span className="truncate px-1">{r.text}</span>
          </div>
        ))}
        {rows.slice(0, -1).map((r, i) => {
          const { min, max: hi } = boundaryRange(rows, i);
          return (
            <div
              key={i}
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-disabled={disabled}
              aria-label={`${i + 1}번 구간과 ${i + 2}번 구간의 경계`}
              aria-orientation="horizontal"
              aria-valuemin={min}
              aria-valuemax={hi}
              aria-valuenow={Math.min(hi, Math.max(min, r.endSec))}
              aria-valuetext={formatTime(Math.min(hi, Math.max(min, r.endSec)))}
              onKeyDown={(e) => !disabled && key(i, e)}
              onPointerDown={(e) => {
                if (disabled) return;
                e.stopPropagation(); // 막대 클릭 이동으로 번지지 않게
                e.currentTarget.setPointerCapture(e.pointerId);
                e.currentTarget.focus();
              }}
              onPointerMove={(e) => !disabled && drag(i, e)}
              className="group absolute -inset-y-0 z-10 -ml-3 flex w-6 cursor-ew-resize touch-none justify-center focus-visible:outline-none"
              style={{ left: pct(r.endSec) }}
            >
              <span className="relative h-full w-0.5 bg-white">
                <span className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rounded-full bg-white group-focus-visible:ring-4 group-focus-visible:ring-brand" />
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs tabular-nums text-white/80">{formatTime(r.endSec)}</span>
              </span>
            </div>
          );
        })}
        {/* 재생 위치선: 경계 핸들(흰 가는 선+원)과 다르게 굵은 호박색 선+아래 삼각형. 포인터는 통과시킴. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 z-20 -ml-[1.5px] w-[3px] bg-amber-300" style={{ left: pct(Math.min(playTime, durationSec)) }}>
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-amber-300" />
        </div>
      </div>
      <div className="relative mt-2 h-4 text-xs tabular-nums text-white/60" aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2 first:translate-x-0" style={{ left: pct(t) }}>
            {formatTime(t)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Inner({ audioTrackId, interrupt, badge, submitting, error, onSubmit }: Props) {
  const { durationSec } = interrupt;
  const player = useSectionAudio(audioTrackId, durationSec);
  const [rows, setRows] = useState<EditRow[]>(() => fromSections(interrupt.sections, durationSec));
  const inputs = useMemo(() => toInputs(rows), [rows]);
  const check = useMemo(() => validateSections(inputs, durationSec), [inputs, durationSec]);
  const rowErrors = check.ok ? {} : check.rowErrors;
  const kinds = new Set(check.ok ? [] : Object.values(check.rowKinds));
  const errorCount = Object.keys(rowErrors).length;
  const blocked = !check.ok;
  const emptyMood = rows.filter((r) => r.mood.trim() === "").length;
  // 재생 위치가 속한 구간은 확정 전 편집 값(rows) 기준으로 계산한다
  const activeIdx = player.playing || player.time > 0 ? rowIndexAt(rows, player.time) : null;
  const [scrub, setScrub] = useState<number | null>(null); // 슬라이더를 잡고 있는 동안은 100ms 갱신이 값을 덮지 않게 로컬 값을 쓴다
  const [rejected, setRejected] = useState<number | null>(null);
  const patch = (i: number, p: Partial<EditRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const reason = !check.ok ? check.message ?? `고쳐야 할 구간이 ${errorCount}개 있어요` : undefined;
  const fixes = (Object.keys(FIX) as RowErrorKind[]).filter((k) => kinds.has(k)).map((k) => FIX[k]).join(" · ");

  return (
    <div className="flex flex-col gap-6 text-white">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs text-white/60">연출 만들기 · 확인 1/2</p>
            <h1 className="mt-1 text-2xl font-bold">구간 확인</h1>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-white/70">
            분석된 구간을 확인해 주세요. 경계를 드래그하거나 끝 시간을 숫자로 입력해 조정하고, 이름과 분위기도 직접 고칠 수 있어요.
            병합은 위 구간과 합치고, 분할은 구간 가운데에서 둘로 나눠요(나눈 두 구간이 모두 8초 이상일 때만).
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">{badge}</span>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
            구간은 8초 이상 · 최대 {MAX_SECTIONS}개 · 이름 {MAX_LABEL}자 · 분위기 {MAX_MOOD}자
          </span>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-400/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error.code === "invalid_sections" && error.message ? error.message : "잠시 뒤에 다시 시도해 주세요"}
        </p>
      )}

      <section aria-label="구간 듣기" className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-bg-dark-2 p-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="재생"
            aria-pressed={player.playing}
            onClick={player.toggle}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-bg-dark hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft"
          >
            <span aria-hidden>{player.playing ? "❚❚" : "▶"}</span>
          </button>
          <input
            type="range"
            aria-label="재생 위치"
            aria-valuetext={`${formatTime(player.time)} / ${formatTime(durationSec)}`}
            min={0}
            max={Math.floor(durationSec)}
            step={1}
            value={Math.min(scrub ?? Math.floor(player.time), Math.floor(durationSec))}
            onChange={(e) => {
              setScrub(Number(e.target.value));
              player.seek(Number(e.target.value));
            }}
            onPointerUp={() => setScrub(null)}
            onPointerCancel={() => setScrub(null)}
            onKeyUp={() => setScrub(null)}
            onBlur={() => setScrub(null)}
            className="h-10 min-w-0 flex-1 accent-amber-300"
          />
          <span aria-hidden className="shrink-0 text-xs tabular-nums text-white/80">
            {formatTime(player.time)} / {formatTime(durationSec)}
          </span>
        </div>
        <p role="status" className="sr-only">
          {player.played ? (player.playing ? "재생 중" : "일시정지") : ""}
        </p>
        {player.failed && (
          <p role="alert" className="text-xs text-rose-300">소리를 불러오지 못했어요. 다시 눌러 시도해 주세요</p>
        )}
        <p className="text-xs text-white/60">재생 버튼을 눌러야 소리가 나요. 막대를 눌러 위치를 옮기고, 각 구간의 &quot;경계 듣기&quot;로 끝 경계 앞뒤를 들어 볼 수 있어요.</p>
      </section>

      <Timeline
        playTime={player.time}
        activeIdx={activeIdx}
        onSeek={player.seek}
        rows={rows}
        durationSec={durationSec}
        energy={interrupt.energyCurve}
        disabled={submitting}
        onMove={(i, sec) => setRows((rs) => moveBoundary(rs, i, sec))}
      />

      <section aria-labelledby="sections-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="sections-heading" className="text-sm text-white/70">구간 목록 · {rows.length}개</h2>
          {errorCount > 0 && (
            <span className="rounded-full border border-rose-400/50 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
              고쳐야 할 구간이 {errorCount}개 있어요 · {fixes} 뒤 다시 진행해 주세요
            </span>
          )}
        </div>
        {check.ok === false && check.message && (
          <p role="alert" className="text-sm text-rose-300">{check.message}</p>
        )}
        <p className="text-xs text-white/60">끝 시간은 m:ss 또는 초 숫자로 입력해요. 앞뒤 구간과 겹치지 않는 시간이어야 해요.</p>
        {emptyMood > 0 && (
          <span className="self-start rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs text-amber-200">
            분위기가 비어 있는 구간 {emptyMood}개 · 직접 입력하면 연출에 반영돼요 (비워 둬도 진행할 수 있어요)
          </span>
        )}

        <ol className="flex flex-col gap-2">
          {rows.map((r, i) => {
            const start = startOf(rows, i);
            const last = i === rows.length - 1;
            const err = rowErrors[i];
            const timeBad = rejected === i;
            const errId = `row-err-${i}`;
            const timeId = `row-time-${i}`;
            const common = { "aria-invalid": err ? true : undefined, "aria-describedby": err ? errId : undefined };
            return (
              <li key={i} className="flex flex-col gap-1">
                <div className={`flex flex-col gap-3 rounded-2xl border bg-bg-dark-2 p-3 md:flex-row md:items-center ${err ? "border-rose-400/70" : i === activeIdx ? "border-amber-300/70" : "border-white/10"}`}>
                  <div className="flex items-center gap-3">
                    <span aria-hidden className={`size-2 shrink-0 rounded-full ${err ? "bg-rose-400" : DOTS[i % DOTS.length]}`} />
                    <input
                      {...common}
                      aria-label={`${i + 1}번 구간 이름`}
                      value={r.text}
                      maxLength={MAX_LABEL}
                      disabled={submitting}
                      onChange={(e) => patch(i, { text: e.target.value })}
                      className={`${field} w-32 min-w-0 flex-1 font-semibold md:flex-none ${err ? "border-rose-400" : "border-white/15"}`}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm tabular-nums text-white/80">
                    <span>{formatTime(start)}</span>
                    <span aria-hidden>→</span>
                    {last ? (
                      <span className="w-16 text-center">{formatTime(r.endSec)}</span>
                    ) : (
                      <TimeInput
                        label={`${i + 1}번 구간 끝 시간 (분:초 또는 초)`}
                        value={r.endSec}
                        disabled={submitting}
                        rejected={timeBad || !!err}
                        describedBy={[err && errId, timeBad && timeId].filter(Boolean).join(" ") || undefined}
                        onCommit={(text) => {
                          const sec = parseTime(text);
                          const next = sec === null ? rows : setEnd(rows, i, sec);
                          setRejected(next === rows ? i : null);
                          if (next !== rows) setRows(next);
                        }}
                      />
                    )}
                    <span className="text-white/60">({Math.round(r.endSec - start)}초)</span>
                    {i === activeIdx && <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-xs text-amber-200">{player.playing ? "재생 중" : "현재 위치"}</span>}
                  </div>
                  <input
                    {...common}
                    aria-label={`${i + 1}번 구간 분위기`}
                    value={r.mood}
                    maxLength={MAX_MOOD}
                    placeholder="분위기를 직접 입력하면 연출에 반영돼요"
                    disabled={submitting}
                    onChange={(e) => patch(i, { mood: e.target.value })}
                    className={`${field} min-w-0 flex-1 ${r.mood.trim() === "" ? "border-dashed border-amber-300/50" : "border-white/15"}`}
                  />
                  <div className="flex flex-wrap gap-2">
                    {!last && (
                      <button
                        type="button"
                        className={`${btn} min-h-10`}
                        aria-label={`${i + 1}번 구간 끝 경계 앞뒤 듣기`}
                        onClick={() => {
                          const w = listenWindow(r.endSec, durationSec);
                          void player.playFrom(w.from, w.to);
                        }}
                      >
                        경계 듣기
                      </button>
                    )}
                    <button type="button" className={`${btn} min-h-10`} disabled={submitting || i === 0} onClick={() => setRows((rs) => mergeUp(rs, i))}>
                      병합
                    </button>
                    <button type="button" className={`${btn} min-h-10`} disabled={submitting || !canSplit(rows, i)} onClick={() => setRows((rs) => split(rs, i))}>
                      분할
                    </button>
                  </div>
                </div>
                {err && <p id={errId} className="px-2 text-xs text-rose-300">{err}</p>}
                {timeBad && (
                  <p id={timeId} className="px-2 text-xs text-rose-300">
                    앞뒤 구간과 겹치지 않는 시간을 m:ss 로 입력해 주세요 (입력을 마치면 원래 값으로 돌아가요)
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
        <button type="button" className={`${btn} px-5 py-3 text-sm font-semibold`} disabled={submitting || !canAdd(rows)} onClick={() => setRows(addSection)}>
          + 구간 추가 ({rows.length}/{MAX_SECTIONS})
        </button>
        <button
          type="button"
          disabled={submitting || blocked}
          title={reason}
          onClick={() => onSubmit(inputs)}
          className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-bg-dark hover:bg-brand-soft disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft"
        >
          {submitting ? "진행 중…" : "이대로 진행 →"}
        </button>
      </div>
    </div>
  );
}
