"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import UploadView, { type UploadNotice, type UploadPhase } from "@/components/director/UploadView";
import { createTrack, deleteTrack, uploadToSignedUrl } from "@/lib/audio/api";
import { canonicalContentType, durationProblem, fileProblem, formatBytes, formatDuration } from "@/lib/audio/validate";
import { MAX_TITLE_LENGTH } from "@/lib/audio/limits";
import { warmup } from "@/lib/director/api";
import type { ArtistChoice } from "@/lib/director/data";
import { errorCopyFor } from "@/lib/python/errors";

const FILE_PROBLEMS: Record<"unsupported_type" | "too_large" | "too_long", UploadNotice> = {
  too_large: {
    headline: "파일이 너무 커요",
    sub: "30MB 이하의 파일만 올릴 수 있어요. wav는 용량이 커서 3분 안팎을 권장해요. 파일을 줄이거나 다른 곡을 골라주세요.",
  },
  unsupported_type: { headline: "지원하지 않는 형식이에요", sub: "mp3, wav, flac, ogg 파일만 올릴 수 있어요." },
  too_long: { headline: "곡이 너무 길어요", sub: "5분 이하의 곡만 분석할 수 있어요. 더 짧은 곡을 골라주세요." },
};

// <audio> 메타데이터로 길이를 읽는다. 읽지 못하면 NaN (확장자만 바꾼 파일, 깨진 파일 등)
function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (v: number) => {
      clearTimeout(timer);
      audio.removeAttribute("src");
      URL.revokeObjectURL(url);
      resolve(v);
    };
    const timer = setTimeout(() => done(NaN), 10_000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => done(audio.duration);
    audio.onerror = () => done(NaN);
    audio.src = url;
  });
}

const stripExt = (name: string) => name.replace(/\.[^.]+$/, "");

export default function UploadPanel({ artists, defaultArtistSlug }: { artists: ArtistChoice[]; defaultArtistSlug?: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [problem, setProblem] = useState<UploadNotice>();
  const [serverError, setServerError] = useState<UploadNotice>();
  const [pct, setPct] = useState(0);
  const [title, setTitle] = useState("");
  const [artistId, setArtistId] = useState(
    () => (artists.find((a) => a.slug === defaultArtistSlug) ?? artists[0])?.id ?? "",
  );
  // 취소 시 진행 중인 단계를 중단하려고 들고 있는다
  const run = useRef<{ cancelled: boolean; active?: boolean; uploaded?: boolean; trackId?: string; abort?: () => void }>({
    cancelled: false,
  });
  const picking = useRef(0); // 길이 읽는 중 새 파일이 오면 이전 결과를 버린다

  useEffect(() => {
    void warmup();
  }, []);

  // 업로드 도중 화면을 떠나면(사이드바 이동 등) 이어서 올리다가 끝난 뒤 갑자기 이동하지 않도록 중단하고 행을 정리한다.
  // 업로드를 마치고 router.push 로 떠나는 경우(uploaded)는 정리하지 않는다. 탭을 닫는 경우는 보장할 수 없다.
  useEffect(
    () => () => {
      const r = run.current;
      if (!r.active || r.uploaded || r.cancelled) return;
      r.cancelled = true;
      r.abort?.();
      if (r.trackId) void deleteTrack(r.trackId);
    },
    [],
  );

  function reset() {
    picking.current++;
    setFile(null);
    setDurationSec(0);
    setProblem(undefined);
    setServerError(undefined);
    setPhase("idle");
  }

  async function onFile(f: File) {
    const id = ++picking.current;
    setFile(null);
    setDurationSec(0); // 이전 파일의 길이가 이 파일 칩에 붙지 않게
    setServerError(undefined);
    const fp = fileProblem(f);
    if (fp) {
      setProblem(FILE_PROBLEMS[fp]);
      setFile(f);
      setPhase("idle");
      return;
    }
    setProblem(undefined);
    setPhase("checking");
    const sec = await readDuration(f);
    if (id !== picking.current) return;
    const dp = durationProblem(sec);
    setFile(f);
    if (dp) {
      const e = errorCopyFor("decode_failed");
      setProblem(dp === "too_long" ? FILE_PROBLEMS.too_long : { headline: e.headline, sub: e.sub });
      setDurationSec(dp === "too_long" ? sec : 0);
      setPhase("idle");
      return;
    }
    setDurationSec(sec);
    setTitle(stripExt(f.name).slice(0, MAX_TITLE_LENGTH));
    setPhase("ready");
  }

  async function submit() {
    const contentType = file && canonicalContentType(file.name);
    if (!file || !contentType) return;
    const r = { cancelled: false, active: true } as typeof run.current;
    run.current = r;
    setServerError(undefined);
    setPct(0);
    setPhase("uploading");

    const fail = (code: string) => {
      const c = errorCopyFor(code);
      setServerError({ headline: c.headline, sub: c.sub });
      setPhase("ready");
    };

    const created = await createTrack({ artistId, title: title.trim(), filename: file.name, size: file.size, durationSec });
    if (!created.ok) {
      if (!r.cancelled) fail(created.error.code);
      return;
    }
    r.trackId = created.data.trackId;
    if (r.cancelled) {
      void deleteTrack(r.trackId);
      return;
    }
    const up = uploadToSignedUrl(created.data.signedUrl, file, contentType, setPct);
    r.abort = up.abort;
    const res = await up.promise;
    if (r.cancelled) return; // cancel() 이 행 정리까지 한다
    if (!res.ok) {
      void deleteTrack(r.trackId);
      fail("connection_failed");
      return;
    }
    r.uploaded = true; // 이동하면서 언마운트되어도 정리하지 않는다
    router.push(`/staff/director/tracks/${r.trackId}`);
  }

  function cancel() {
    const r = run.current;
    r.cancelled = true;
    r.abort?.();
    if (r.trackId) void deleteTrack(r.trackId);
    setPhase("ready");
  }

  const fileLine = file
    ? `${file.name} · ${formatBytes(file.size)}${durationSec > 0 ? ` · ${formatDuration(durationSec)}` : ""}`
    : undefined;

  return (
    <UploadView
      phase={dragging && phase === "idle" ? "drag" : phase}
      fileLine={fileLine}
      problem={problem}
      serverError={serverError}
      pct={pct}
      artists={artists}
      artistId={artistId}
      title={title}
      onFile={onFile}
      onDragChange={setDragging}
      onArtist={setArtistId}
      onTitle={setTitle}
      onSubmit={submit}
      onCancel={cancel}
      onReset={reset}
    />
  );
}
