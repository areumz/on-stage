"use client";

// dev 전용 쇼케이스. 메인이 나중에 지운다.
import { notFound } from "next/navigation";
import { useState } from "react";
import UploadView, { type UploadViewProps } from "@/components/director/UploadView";

const artists = [
  { id: "1", slug: "aurora", name: "AURORA", color: "#9f77dd" },
  { id: "2", slug: "velvet", name: "VELVET", color: "#D4537E" },
  { id: "3", slug: "nova", name: "NOVA", color: "#1D9E75" },
];
const base = { artists, artistId: "1", title: "burn it up" };
const STATES: { label: string; props: Partial<UploadViewProps> }[] = [
  { label: "기본", props: { phase: "idle" } },
  { label: "끌어다 놓는 중", props: { phase: "drag" } },
  { label: "파일 선택 완료", props: { phase: "ready", fileLine: "burn it up.mp3 · 4.2MB · 1:40" } },
  { label: "올리는 중", props: { phase: "uploading", fileLine: "burn it up.mp3 · 4.2MB · 1:40", pct: 63 } },
  { label: "서버 오류", props: { phase: "ready", fileLine: "burn it up.mp3 · 4.2MB · 1:40", serverError: { headline: "서버에 연결하지 못했어요", sub: "잠시 후 다시 시도해 주세요." } } },
  { label: "파일이 너무 커요", props: { phase: "idle", fileLine: "live-set.wav · 48.6MB", problem: { headline: "파일이 너무 커요", sub: "30MB 이하의 파일만 올릴 수 있어요. wav는 용량이 커서 3분 안팎을 권장해요. 파일을 줄이거나 다른 곡을 골라주세요." } } },
  { label: "지원하지 않는 형식", props: { phase: "idle", fileLine: "voice-memo.m4a · 3.1MB", problem: { headline: "지원하지 않는 형식이에요", sub: "mp3, wav, flac, ogg 파일만 올릴 수 있어요." } } },
  { label: "곡이 너무 길어요", props: { phase: "idle", fileLine: "mix.mp3 · 8.0MB · 6:12", problem: { headline: "곡이 너무 길어요", sub: "5분 이하의 곡만 분석할 수 있어요. 더 짧은 곡을 골라주세요." } } },
];

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Showcase />;
}

function Showcase() {
  const [i, setI] = useState(0);
  const [title, setTitle] = useState(base.title);
  const [artistId, setArtistId] = useState("1");
  const noop = () => {};
  return (
    <main className="min-h-screen bg-bg-dark p-4 text-white md:p-8">
      <div className="mb-4 flex flex-wrap gap-2">
        {STATES.map((s, n) => (
          <button key={s.label} type="button" onClick={() => setI(n)} aria-pressed={n === i}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${n === i ? "border-brand bg-brand/20" : "border-white/10 bg-white/5 text-white/70"}`}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="max-w-2xl">
        <UploadView
          {...base}
          phase="idle"
          title={title}
          artistId={artistId}
          onFile={noop}
          onDragChange={noop}
          onArtist={setArtistId}
          onTitle={setTitle}
          onSubmit={noop}
          onCancel={noop}
          onReset={noop}
          {...STATES[i].props}
        />
      </div>
    </main>
  );
}
