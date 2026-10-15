"use client";

import { useEffect, useRef, useState } from "react";
import { useGuide } from "@/components/guide/GuideProvider";
import { DICT, errorText, toolStatusText } from "@/lib/guide/dictionary";

const MAX_CHARS = 200; // 에이전트 L0 한도와 맞춤

function Icon({ className }: { className: string }) {
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full bg-[#A97FCB] ${className}`}>
      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="#0F0D1B" strokeWidth="2">
        <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-20 12 12)" />
        <circle cx="12" cy="12" r="2" fill="#0F0D1B" stroke="none" />
      </svg>
    </span>
  );
}

export default function GuidePanel() {
  const g = useGuide();
  const L = DICT[g.locale];
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const streaming = g.state.status === "streaming";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [g.state.messages, g.state.toolKey, g.open]);

  if (!g.open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => g.setOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-[52px] items-center gap-2.5 rounded-full border border-white/15 bg-[rgba(24,24,34,0.72)] py-0 pl-2 pr-5 text-sm font-medium text-white backdrop-blur-xl hover:bg-[rgba(24,24,34,0.85)] md:right-6"
      >
        <Icon className="h-9 w-9" />
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

  return (
    <section
      aria-label={L.title}
      className="fixed inset-x-0 bottom-0 z-40 flex h-[70dvh] flex-col rounded-t-[28px] border border-white/12 bg-[rgba(18,18,26,0.78)] text-white backdrop-blur-2xl md:inset-x-auto md:bottom-20 md:right-6 md:h-[34rem] md:w-[392px] md:rounded-3xl"
    >
      <div aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-full bg-white/22 md:hidden" />
      <header className="flex items-center gap-3 px-4 py-2 md:pt-3">
        <Icon className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold">{L.title}</h2>
          <p className="truncate text-xs text-[#8E8E93]">{L.sub}</p>
        </div>
        <div className="flex overflow-hidden rounded-full border border-white/15 text-xs">
          {(["ko", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={g.locale === l}
              onClick={() => g.setLocale(l)}
              className={`px-2.5 py-1.5 ${g.locale === l ? "bg-white/14 text-white" : "text-white/60 hover:text-white"}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <button type="button" aria-label={L.close} onClick={() => g.setOpen(false)} className="h-11 w-11 shrink-0 text-white/60 hover:text-white">
          ✕
        </button>
      </header>

      <div ref={listRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {g.state.messages.length === 0 && <p className="text-[#8E8E93]">{L.empty}</p>}
        {g.state.messages.map((m, i) => {
          const isLast = i === g.state.messages.length - 1;
          const tool = m.role === "assistant" && isLast && g.state.toolKey;
          return (
            <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              {tool && (
                <p className="mb-1 flex items-center gap-1.5 text-xs text-[#8E8E93]">
                  <svg aria-hidden viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="#34C759" strokeWidth="2.2">
                    <path d="M3 8.5l3 3 7-7" />
                  </svg>
                  {toolStatusText(g.locale, tool)}
                </p>
              )}
              {(m.retracted || m.text || m.role === "user" || streaming) && (
                <p
                  className={`whitespace-pre-wrap border px-3.5 py-2.5 leading-relaxed ${
                    m.role === "user"
                      ? "max-w-[280px] rounded-[18px_18px_6px_18px] border-[#A97FCB66] bg-[#A97FCB26]"
                      : "max-w-[320px] rounded-[18px_18px_18px_6px] border-white/8 bg-white/6"
                  }`}
                >
                  {m.retracted ? L.retracted : m.text || "…"}
                </p>
              )}
            </div>
          );
        })}
        {g.state.status === "error" && g.state.errorCode && (
          <p className="rounded-xl border border-white/15 px-3 py-2 text-xs text-white/80">
            {errorText(g.locale, g.state.errorCode)}
            {g.state.errorCode !== "off_topic" && g.state.errorCode !== "too_long" && (
              <button type="button" onClick={g.retry} className="ml-2 underline">
                {L.retry}
              </button>
            )}
          </p>
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2 px-3 pt-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_CHARS}
          placeholder={L.placeholder}
          aria-label={L.placeholder}
          className="h-12 min-w-0 flex-1 rounded-full border border-white/15 bg-white/6 px-4 text-sm outline-none placeholder:text-[#8E8E93] focus:border-[#A97FCB]"
        />
        {streaming ? (
          <button type="button" aria-label={L.stop} onClick={g.stop} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#A97FCB]">
            <span aria-hidden className="h-3.5 w-3.5 rounded-[3px] bg-[#0F0D1B]" />
          </button>
        ) : (
          <button type="submit" aria-label={L.send} disabled={!draft.trim()} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#A97FCB] disabled:opacity-40">
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#0F0D1B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
      </form>
      <p className="px-4 pb-3 pt-2 text-center text-[11.5px] text-[#8E8E93]">{L.foot}</p>
    </section>
  );
}
