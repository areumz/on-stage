"use client";

import { useEffect, useRef, useState } from "react";
import { useGuide } from "@/components/guide/GuideProvider";
import { chipText, DICT, errorText, errorTitle, toolStatusText } from "@/lib/guide/dictionary";

const MAX_CHARS = 200; // 에이전트 L0 한도와 맞춤
const ACCENT = "#A97FCB";

// 목업의 아이콘 배지: 연한 배경 + 테두리 + 액센트 색 선 아이콘
function Badge({ box, icon }: { box: string; icon: number }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full border border-[#A97FCB66] bg-[#A97FCB26] text-[#A97FCB] ${box}`}
    >
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-20 12 12)" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

const CHIP_BASE = "flex h-9 items-center gap-2 rounded-full border pl-3 pr-3.5 text-[12.5px]";

export default function GuidePanel() {
  const g = useGuide();
  const L = DICT[g.locale];
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const { open, setOpen } = g;
  const streaming = g.state.status === "streaming";
  const msgs = g.state.messages;
  const last = msgs.at(-1);
  const waiting = streaming && last?.role === "assistant" && !last.text && !last.retracted;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, g.state.status, open]);

  // 열면 입력으로, 닫으면 알약 버튼으로 포커스를 옮긴다
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (wasOpenRef.current) pillRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) {
    return (
      <button
        ref={pillRef}
        type="button"
        aria-expanded={false}
        onClick={() => setOpen(true)}
        className="fixed bottom-16 right-4 z-40 flex h-[52px] items-center gap-2.5 rounded-full border border-white/16 bg-[rgba(24,24,34,0.72)] pl-3.5 pr-5 text-sm font-semibold text-[#F5F5F7] backdrop-blur-xl hover:bg-[rgba(24,24,34,0.85)] md:bottom-20 md:right-8 md:pl-4 md:pr-[22px]"
      >
        <Badge box="h-[30px] w-[30px]" icon={18} />
        {L.ask}
      </button>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (streaming || !draft.trim()) return;
    g.send(draft);
    setDraft("");
  }

  // 완료된 답변과 오류만 스크린리더에 알린다(스트리밍 중 글자마다 읽지 않게)
  const announce =
    g.state.status === "error" && g.state.errorCode
      ? `${errorTitle(g.locale, g.state.errorCode)}. ${errorText(g.locale, g.state.errorCode)}`
      : g.state.status === "idle" && last?.role === "assistant"
        ? last.text
        : "";
  const code = g.state.errorCode;
  // 같은 입력을 다시 보내도 결과가 같은 오류(또는 아직 답변 중)에는 재시도를 두지 않는다
  const showRetry = !!code && !["off_topic", "too_long", "busy", "session_limit"].includes(code);

  return (
    <section
      aria-label={L.title}
      className="fixed inset-x-0 bottom-0 z-40 flex h-[70dvh] flex-col rounded-t-[28px] border border-b-0 border-white/12 bg-[rgba(18,18,26,0.92)] text-[#F5F5F7] backdrop-blur-2xl md:inset-x-auto md:bottom-[76px] md:right-8 md:h-auto md:max-h-[calc(100dvh-172px)] md:min-h-[320px] md:w-[392px] md:rounded-3xl md:border-b md:bg-[rgba(18,18,26,0.78)]"
    >
      <div aria-hidden className="flex h-[22px] shrink-0 items-center justify-center md:hidden">
        <div className="h-1 w-9 rounded-full bg-white/22" />
      </div>
      <header className="flex shrink-0 items-center gap-2.5 border-b border-white/[0.07] pb-2 pl-[18px] pr-2 md:gap-3 md:pb-3 md:pt-3.5">
        <span className="md:hidden"><Badge box="h-8 w-8" icon={18} /></span>
        <span className="hidden md:block"><Badge box="h-9 w-9" icon={20} /></span>
        <div className="min-w-0 grow">
          <h2 className="text-[15px] font-bold">{L.title}</h2>
          <p className="mt-px hidden truncate text-xs text-[#8E8E93] md:block">{L.sub}</p>
        </div>
        <div role="group" aria-label={L.language} className="flex shrink-0 rounded-full border border-white/14 bg-white/4 p-0.5">
          {(["ko", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={g.locale === l}
              onClick={() => g.setLocale(l)}
              className={`h-9 w-10 rounded-full text-xs font-bold tracking-[0.4px] md:h-8 md:w-[38px] ${
                g.locale === l ? "bg-white/14 text-[#F5F5F7]" : "bg-transparent text-[#8E8E93]"
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <button type="button" aria-label={L.close} onClick={() => setOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#8E8E93] hover:text-white">
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      <div ref={listRef} className="flex min-h-0 grow flex-col gap-3 overflow-y-auto p-[14px_16px] text-sm md:gap-3.5 md:p-[18px]">
        {msgs.length === 0 && <p className="text-[#8E8E93]">{L.empty}</p>}
        {msgs.map((m) =>
          m.role === "user" ? (
            <p key={m.id} className="max-w-[260px] self-end whitespace-pre-wrap rounded-[18px_18px_6px_18px] border border-[#A97FCB66] bg-[#A97FCB26] px-3.5 py-2.5 leading-normal md:max-w-[280px] md:py-[11px]">
              {m.text}
            </p>
          ) : (
            <div key={m.id} className="flex flex-col items-start gap-2">
              {m.toolKey && (m.text || !(streaming && m === last)) && (
                <p className="flex items-center gap-1.5 text-xs text-[#8E8E93]">
                  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2.4">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  {toolStatusText(g.locale, m.toolKey)}
                </p>
              )}
              {m.text && (
                <p className="max-w-[300px] whitespace-pre-wrap rounded-[18px_18px_18px_6px] border border-white/8 bg-white/6 px-3.5 py-2.5 leading-[1.55] md:max-w-[320px] md:py-3">
                  {m.text}
                </p>
              )}
              {m.retracted && (
                <p className="flex items-center gap-1.5 text-xs text-[#8E8E93]">
                  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v5M12 8h.01" />
                  </svg>
                  {L.retracted}
                </p>
              )}
              {m.chip?.kind === "focus" && (
                <p className={`${CHIP_BASE} border-[#A97FCB66] bg-[#A97FCB26]`}>
                  <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                    <circle cx="12" cy="12" r="8" />
                    <circle cx="12" cy="12" r="2.4" fill={ACCENT} stroke="none" />
                  </svg>
                  {chipText(g.locale, "focus", m.chip.slug)}
                </p>
              )}
              {m.chip?.kind === "navigating" && (
                <p className={`${CHIP_BASE} border-white/14 bg-white/5`}>
                  <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F5F5F7" strokeWidth="2">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                  {chipText(g.locale, "navigating", m.chip.slug)}
                </p>
              )}
              {m.chip?.kind === "failed" && (
                // 재시도는 마지막 계획만 다시 실행하므로 마지막 메시지에서만 보인다
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className={`${CHIP_BASE} border-[rgba(255,180,84,0.55)] bg-[rgba(255,180,84,0.10)]`}>
                    <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFB454" strokeWidth="2">
                      <path d="M12 4l9 16H3z" />
                      <path d="M12 10v4M12 17h.01" />
                    </svg>
                    {chipText(g.locale, "failed", m.chip.slug)}
                  </p>
                  {m === last && (
                    <button type="button" onClick={g.retryAction} className="h-9 rounded-full border border-white/18 bg-white/6 px-3.5 text-[12.5px] font-semibold">
                      {L.retry}
                    </button>
                  )}
                </div>
              )}
            </div>
          ),
        )}
        {waiting && (
          <p className="flex items-center gap-2 text-xs text-[#8E8E93]">
            <span aria-hidden className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#A97FCB]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#A97FCB] opacity-60" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#A97FCB] opacity-30" />
            </span>
            {g.state.toolKey ? toolStatusText(g.locale, g.state.toolKey) : L.toolGeneric}
          </p>
        )}
        {g.state.status === "error" && g.state.errorCode && (
          <div role="alert" className="flex max-w-[320px] flex-col gap-2.5 self-start rounded-[18px_18px_18px_6px] border border-[rgba(255,107,99,0.45)] bg-[rgba(255,107,99,0.08)] px-3.5 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FF6B63" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5M12 16h.01" />
              </svg>
              {errorTitle(g.locale, g.state.errorCode)}
            </p>
            <p className="text-[13px] leading-normal text-[#A1A1A8]">{errorText(g.locale, g.state.errorCode)}</p>
            {g.state.errorCode === "session_limit" && (
              <button type="button" onClick={g.newChat} className="h-10 self-start rounded-full border border-white/18 bg-white/8 px-[18px] text-[13px] font-semibold">
                {L.newChat}
              </button>
            )}
            {showRetry && (
              <button type="button" onClick={g.retry} className="h-10 self-start rounded-full border border-white/18 bg-white/8 px-[18px] text-[13px] font-semibold">
                {L.retry}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2.5 px-3.5 pb-3.5">
        <form onSubmit={submit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_CHARS}
            placeholder={L.placeholder}
            aria-label={L.placeholder}
            className="h-12 min-w-0 grow rounded-full border border-white/14 bg-white/5 px-[18px] text-sm text-[#F5F5F7] outline-none placeholder:text-[#8E8E93] focus:border-[#A97FCB]"
          />
          {streaming ? (
            <button type="button" aria-label={L.stop} onClick={g.stop} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/18 bg-white/8 text-[#F5F5F7]">
              <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="2.5" />
              </svg>
            </button>
          ) : (
            <button type="submit" aria-label={L.send} disabled={!draft.trim()} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#A97FCB] text-[#0F0D1B] disabled:opacity-40">
              <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          )}
        </form>
        <p className="text-center text-[11.5px] text-[#8E8E93]">{L.foot}</p>
      </div>
    </section>
  );
}
