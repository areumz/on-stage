"use client";

import { useRef } from "react";
import type { ArtistChoice } from "@/lib/director/data";
import { ACCEPT, MAX_TITLE_LENGTH } from "@/lib/audio/limits";

// 순수 표현 컴포넌트. 상태는 UploadPanel(또는 쇼케이스)이 props 로 준다.
export type UploadPhase = "idle" | "drag" | "checking" | "ready" | "uploading";
export type UploadNotice = { headline: string; sub: string };

export type UploadViewProps = {
  phase: UploadPhase;
  fileLine?: string; // "이름 · 4.2MB · 1:40"
  problem?: UploadNotice; // 파일 검사 오류 (idle 에서 파일 칩과 함께 표시)
  serverError?: UploadNotice; // 서버·네트워크 오류 (ready 에서 다시 누를 수 있다)
  pct?: number;
  artists: ArtistChoice[];
  artistId: string;
  title: string;
  onFile: (file: File) => void;
  onDragChange: (dragging: boolean) => void;
  onArtist: (id: string) => void;
  onTitle: (title: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onReset: () => void;
};

const CHIPS = ["mp3 · wav · flac · ogg", "최대 30MB", "5분 이하", "wav는 3분 안팎 권장"];
const btnGhost =
  "rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const btnBrand =
  "rounded-full bg-brand px-7 py-3 text-sm font-bold text-bg-dark hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50";

export default function UploadView(p: UploadViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const drag = p.phase === "drag";
  const headline =
    p.phase === "drag" ? "여기에 놓으세요"
    : p.phase === "ready" ? "이 곡으로 분석할까요?"
    : p.phase === "uploading" ? "곡을 올리고 있어요"
    : p.phase === "checking" ? "파일을 확인하고 있어요"
    : "곡 파일을 끌어다 놓거나 선택하세요";
  const showPick = p.phase === "idle" || p.phase === "drag";

  return (
    <section className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (showPick && !drag) p.onDragChange(true);
        }}
        onDragLeave={(e) => {
          // 자식 요소로 넘어갈 때 깜빡이지 않게 영역을 완전히 벗어날 때만 해제
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) p.onDragChange(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          p.onDragChange(false);
          const f = e.dataTransfer.files[0];
          if (f && showPick) p.onFile(f);
        }}
        className={`flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed p-6 text-center md:p-8 ${
          p.problem ? "border-[#D4537E]/60 bg-white/[0.03]" : drag ? "border-brand bg-brand/10" : "border-white/20 bg-white/[0.03]"
        }`}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9f77dd" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
        <h2 className="text-xl font-bold md:text-[22px]" aria-live="polite">{headline}</h2>

        {p.fileLine && (
          <div className="max-w-full break-all rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm tabular-nums text-white/80">
            {p.fileLine}
          </div>
        )}

        {p.problem && <Notice notice={p.problem} />}

        {p.phase === "uploading" && (
          <>
            <div className="flex w-full max-w-sm flex-col gap-2 text-left">
              <div className="flex justify-between text-sm text-white/70">
                <span>올리는 중</span>
                <span className="font-semibold tabular-nums text-white">{p.pct ?? 0}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="업로드 진행률"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={p.pct ?? 0}
                className="h-2 overflow-hidden rounded-full bg-white/10"
              >
                <div className="h-full rounded-full bg-brand" style={{ width: `${p.pct ?? 0}%` }} />
              </div>
            </div>
            <button type="button" onClick={p.onCancel} className={btnGhost}>취소</button>
          </>
        )}

        {p.phase === "ready" && (
          <>
            <div className="flex w-full max-w-sm flex-col gap-4 text-left">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-xs font-semibold text-white/70">아티스트 (등록된 {p.artists.length}명 중 선택)</legend>
                <div className="flex flex-wrap gap-2">
                  {p.artists.map((a) => (
                    <label
                      key={a.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                        a.id === p.artistId ? "border-brand bg-brand/20 text-white" : "border-white/15 bg-white/5 text-white/70 hover:text-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="artist"
                        value={a.id}
                        checked={a.id === p.artistId}
                        onChange={() => p.onArtist(a.id)}
                        className="sr-only"
                      />
                      <span className="size-2 rounded-full" style={{ background: a.color }} aria-hidden="true" />
                      {a.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-white/70">
                곡 제목 (기본값은 파일 이름)
                <input
                  value={p.title}
                  maxLength={MAX_TITLE_LENGTH}
                  placeholder="곡 제목"
                  onChange={(e) => p.onTitle(e.target.value)}
                  className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm font-normal text-white placeholder:text-white/50 focus-visible:outline-2 focus-visible:outline-brand"
                />
              </label>
            </div>
            {p.serverError && <Notice notice={p.serverError} />}
            <div className="flex flex-wrap justify-center gap-2.5">
              <button type="button" onClick={p.onReset} className={btnGhost}>다른 파일 선택</button>
              <button type="button" onClick={p.onSubmit} disabled={!p.title.trim() || !p.artistId} className={btnBrand}>
                분석 시작 →
              </button>
            </div>
          </>
        )}

        {showPick && (
          <button type="button" onClick={() => inputRef.current?.click()} className={btnBrand}>파일 선택</button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          tabIndex={-1}
          aria-label="곡 파일"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ""; // 같은 파일을 다시 골라도 change 가 뜨게
            if (f) p.onFile(f);
          }}
        />

        <ul className="flex flex-wrap justify-center gap-2">
          {CHIPS.map((c) => (
            <li key={c} className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-white/70">{c}</li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-white/60">곡을 올리면 서버가 구간을 분석해요. 파일은 올리기 전에 형식·크기·길이를 먼저 확인해요.</p>
    </section>
  );
}

function Notice({ notice }: { notice: UploadNotice }) {
  return (
    <div role="alert" className="max-w-md rounded-2xl border border-[#D4537E]/40 bg-[#D4537E]/10 px-4 py-3 text-left">
      <div className="mb-1 text-sm font-bold text-[#f08aae]">{notice.headline}</div>
      <div className="text-[13px] leading-relaxed text-white/80">{notice.sub}</div>
    </div>
  );
}
