"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import SceneSettingsPanel from "@/components/scene/SceneSettingsPanel";
import { useSequenceScene } from "@/components/scene/useSequenceScene";
import StageScene from "@/components/three/StageScene";
import { labelKo } from "@/lib/director/labels";
import { energyBars, formatTime, sectionIndexAt, stateAt } from "@/lib/director/playback";
import type { SequenceItem } from "@/lib/python/contract";
import type { PropKey, SceneEdit } from "@/lib/stage/scene";

const CAMERA_KO = { front: "정면 (front)", audience: "객석 (audience)", top: "위에서 (top)" } as const;
const SPOTS = [["left", "Left"], ["center", "Center"], ["right", "Right"]] as const;
const BAR_COUNT = 60;
const SEEK_STEP = 5;
// StageScene 에 state 를 너무 자주 흘리면 R3F Canvas 가 재구성을 반복하다 webglcontextlost 가 난다(src/lib/hooks.ts).
// 100ms(초당 10커밋) 이하로 눌러야 안정적이라 React 상태 갱신은 이 간격으로만 한다.
const COMMIT_MS = 100;
// 부모가 10Hz 로 다시 렌더돼도 state 참조가 같으면 StageScene 재조정을 건너뛴다
const MemoScene = memo(StageScene);

type Props = {
  audioTrackId: string;
  title: string;
  artistName: string;
  accent: string;
  durationSec: number;
  items: SequenceItem[];
  energyCurve: number[];
  sequenceId: string | null; // 데모 곡은 null — 배경 설정을 서버에 저장하지 않는다
  aiProps: PropKey[] | null; // AI 가 제안한 소품 (stage_sequences.props)
  initialEdit: SceneEdit | null; // 저장된 사용자 값 (stage_sequences.scene_edit)
};

const btn = "flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-brand";

// 훅 순서 때문에 가드는 바깥 래퍼에서 한다(빈 items·길이 0 이면 stateAt/pct 가 깨진다)
export default function SequencePlayer(props: Props) {
  if (props.items.length === 0 || !(props.durationSec > 0)) {
    return <p className="rounded-2xl border border-white/10 bg-bg-dark-2 p-6 text-center text-sm text-white/60">재생할 연출이 없어요</p>;
  }
  return <Player {...props} />;
}

function Player({ audioTrackId, title, artistName, accent, durationSec, items, energyCurve, sequenceId, aiProps, initialEdit }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const tRef = useRef(0);
  const clock = useRef({ t: 0, at: 0 }); // 타이머 모드 기준점
  const audioOk = useRef(false); // 오디오가 실제로 재생 가능한 상태
  const srcReady = useRef(false); // src 설정 + 메타데이터 로드 완료
  const muted = useRef(false); // 음원 포기 후 타이머 전용
  const attaching = useRef(false);
  const lastRecover = useRef(0);
  const dead = useRef(false);
  const playingRef = useRef(false);
  const busy = useRef(false);
  const lastCommit = useRef(0);
  const trailing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [time, setTime] = useState(0);
  const [stage, setStage] = useState(() => stateAt(items, 0));
  const [playing, setPlaying] = useState(false);
  const [silent, setSilent] = useState(false);
  const [tapAgain, setTapAgain] = useState(false);

  const bars = useMemo(() => energyBars(energyCurve, BAR_COUNT), [energyCurve]);
  const idx = sectionIndexAt(items, time);
  const cur = items[idx];
  // 구간이 바뀔 때만 값이 달라지고, 같으면 같은 참조라 MemoScene 이 다시 그려지지 않는다
  const lk = (label: string) => labelKo(label, sequenceId === null); // 데모 곡은 적힌 이름 그대로
  const sceneCtl = useSequenceScene({ sequenceId, items, energyCurve, aiProps, initialEdit, index: idx });
  const openerRef = useRef<HTMLButtonElement>(null); // 패널을 닫을 때 포커스를 돌려줄 버튼
  const stageBoxRef = useRef<HTMLDivElement>(null);
  const openScene = () => {
    sceneCtl.openPanel();
    // 모바일은 패널이 하단 시트라 3D 와 재생 버튼이 위쪽에 보이도록 스크롤한다
    if (window.matchMedia("(max-width: 767px)").matches) stageBoxRef.current?.scrollIntoView({ block: "start" });
  };
  const pct = (t: number) => `${Math.min(100, Math.max(0, (t / durationSec) * 100))}%`;

  // 위치선·tRef 는 즉시, React 상태는 COMMIT_MS 로 눌러서 갱신. 눌린 마지막 값은 trailing 타이머로 반드시 반영.
  // force 는 일시정지·끝처럼 표시와 3D 를 맞춰야 할 때만.
  const apply = useCallback(
    (t: number) => {
      if (trailing.current) clearTimeout(trailing.current);
      trailing.current = null;
      lastCommit.current = performance.now();
      setTime(t);
      setStage(stateAt(items, t)); // 전환 구간이 아니면 같은 참조라 bail-out
    },
    [items],
  );

  const commit = useCallback(
    (t: number, force: boolean) => {
      tRef.current = t;
      if (lineRef.current) lineRef.current.style.left = `${Math.min(100, Math.max(0, (t / durationSec) * 100))}%`;
      const wait = COMMIT_MS - (performance.now() - lastCommit.current);
      if (force || wait <= 0) return apply(t);
      trailing.current ??= setTimeout(() => apply(tRef.current), wait);
    },
    [apply, durationSec],
  );

  const seek = useCallback(
    (sec: number, force = false) => {
      const t = Math.min(durationSec, Math.max(0, sec));
      clock.current = { t, at: performance.now() };
      if (audioOk.current && audioRef.current) audioRef.current.currentTime = t;
      commit(t, force);
    },
    [commit, durationSec],
  );

  const fallbackToSilent = useCallback(() => {
    muted.current = true;
    audioOk.current = false;
    clock.current = { t: tRef.current, at: performance.now() };
    setSilent(true);
  }, []);

  // 서명 URL 을 새로 받아 audio.src 에만 설정하고 메타데이터가 올 때까지 기다린 뒤 위치를 맞춘다
  // (src 설정 직후 play 하면 0초 소리가 먼저 나온다).
  const attach = useCallback(async (a: HTMLAudioElement, t: number) => {
    attaching.current = true;
    srcReady.current = false;
    try {
      const res = await fetch(`/api/audio-tracks/${audioTrackId}/play`);
      if (!res.ok) throw new Error("play route");
      const { url } = (await res.json()) as { url: string };
      if (dead.current) throw new Error("unmounted");
      await new Promise<void>((resolve, reject) => {
        a.addEventListener("loadedmetadata", () => resolve(), { once: true });
        a.addEventListener("error", () => reject(new Error("audio")), { once: true });
        a.src = url;
        a.load();
      });
      if (dead.current) throw new Error("unmounted");
      a.currentTime = t;
      srcReady.current = true;
    } finally {
      attaching.current = false;
    }
  }, [audioTrackId]);

  // URL 만료·재생 중 오류: 한 번은 URL 을 다시 받아 이어 가고, 그래도 안 되면(10초 안에 또 오류 포함) 무음.
  const recover = useCallback(async () => {
    const a = audioRef.current;
    if (!a || dead.current || muted.current || attaching.current) return;
    const now = performance.now();
    if (now - lastRecover.current < 10000) return fallbackToSilent();
    lastRecover.current = now;
    audioOk.current = false;
    clock.current = { t: tRef.current, at: now }; // 복구되는 동안은 타이머로 이어 감
    try {
      await attach(a, tRef.current);
      if (playingRef.current) await a.play();
      if (dead.current) return;
      audioOk.current = true;
    } catch {
      if (!dead.current) fallbackToSilent();
    }
  }, [attach, fallbackToSilent]);

  useEffect(() => {
    playingRef.current = playing;
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const a = audioRef.current;
      const useAudio = audioOk.current && a;
      const t = useAudio ? a.currentTime : clock.current.t + (performance.now() - clock.current.at) / 1000;
      if (t >= durationSec || (useAudio && a.ended)) {
        a?.pause();
        setPlaying(false);
        seek(0, true);
        return;
      }
      commit(t, false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, commit, seek, durationSec]);

  useEffect(() => {
    const a = audioRef.current;
    dead.current = false;
    return () => {
      dead.current = true;
      if (trailing.current) clearTimeout(trailing.current);
      srcReady.current = false;
      audioOk.current = false;
      if (a) {
        a.pause();
        a.removeAttribute("src");
        a.load();
      }
    };
  }, []);

  async function toggle() {
    const a = audioRef.current;
    if (busy.current || !a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      commit(tRef.current, true); // 표시와 3D 를 마지막 위치에 맞춘다
      return;
    }
    busy.current = true;
    setTapAgain(false);
    if (tRef.current >= durationSec) seek(0, true);
    try {
      if (!muted.current) {
        try {
          if (!srcReady.current) await attach(a, tRef.current);
          if (dead.current) return;
          await a.play();
          audioOk.current = true;
        } catch (e) {
          if (dead.current) return;
          if (e instanceof DOMException && e.name === "NotAllowedError" && srcReady.current) {
            // fetch 뒤라 사용자 제스처가 끊겼다. src 는 준비됐으니 다음 클릭에서 바로 play 한다.
            setTapAgain(true);
            return;
          }
          fallbackToSilent();
        }
      }
      clock.current = { t: tRef.current, at: performance.now() };
      setPlaying(true);
    } finally {
      busy.current = false;
    }
  }

  const seekFromPointer = (e: React.PointerEvent) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (r && r.width > 0) seek(((e.clientX - r.left) / r.width) * durationSec);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const k: Record<string, number> = {
      ArrowLeft: tRef.current - SEEK_STEP,
      ArrowRight: tRef.current + SEEK_STEP,
      PageDown: tRef.current - 30,
      PageUp: tRef.current + 30,
      Home: 0,
      End: durationSec,
    };
    if (!(e.key in k)) return;
    seek(k[e.key]);
    e.preventDefault();
  };
  const prev = () => seek(items[time - cur.startSec > 2 || idx === 0 ? idx : idx - 1].startSec);
  const next = () => idx < items.length - 1 && seek(items[idx + 1].startSec);

  // 눈금은 최대 6개 안팎이 되게 30초 단위로 간격을 넓히고, 오른쪽 끝에 닿는 라벨은 뺀다
  const tickStep = Math.max(30, Math.ceil(durationSec / 6 / 30) * 30);
  const ticks = Array.from({ length: Math.floor(durationSec / tickStep) + 1 }, (_, i) => i * tickStep).filter((t) => t / durationSec < 0.92);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <audio ref={audioRef} preload="none" className="hidden" onError={() => srcReady.current && recover()} />

      <aside className="order-2 flex flex-col gap-3 md:order-1 md:w-[320px] md:shrink-0">
        <section className="flex items-center gap-4 rounded-2xl border border-white/10 bg-bg-dark-2 p-4">
          <div className="h-20 w-20 shrink-0 rounded-xl" style={{ background: `linear-gradient(135deg, ${accent}, #1a1533)` }} aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-white">{title}</p>
            <p className="truncate text-sm text-white/60">{artistName} · 시그니처 컬러</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden />
              분석 완료 · {formatTime(durationSec)}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-bg-dark-2 p-4" aria-live="polite">
          <p className="text-xs font-semibold tracking-wide text-white/60">현재 구간</p>
          <p className="mt-1 text-lg font-bold text-white">{lk(cur.sectionLabel)}</p>
          <p className="text-sm text-white/60">
            {formatTime(cur.startSec)}–{formatTime(cur.endSec)} · {Math.round(cur.endSec - cur.startSec)}초
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-bg-dark-2 p-4">
          <p className="text-xs font-semibold tracking-wide text-white/60">무대 상태</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {SPOTS.map(([key, name]) => {
              const s = stage.spots[key];
              const size = 10 + (s.intensity / 1000) * 14;
              return (
                <div key={key} className="flex flex-col items-center gap-1.5">
                  <div className="flex h-6 items-center">
                    <span
                      className={`rounded-full ${s.on ? "" : "bg-white/20"}`}
                      style={s.on ? { width: size, height: size, background: stage.color, boxShadow: `0 0 ${size}px ${(s.intensity / 1000) * 6}px ${stage.color}` } : { width: 10, height: 10 }}
                    />
                  </div>
                  <span className="text-xs text-white/60">{name}</span>
                </div>
              );
            })}
          </div>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-white/60">카메라</dt><dd className="text-white">{CAMERA_KO[stage.camera]}</dd></div>
            <div className="flex justify-between"><dt className="text-white/60">스모크</dt><dd className="text-white">{Math.round(stage.smoke.density * 100)}%</dd></div>
          </dl>
        </section>
      </aside>

      <div className="order-1 flex min-w-0 flex-1 flex-col gap-3 md:order-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-white/60">무대 연출 디렉터 › <span className="font-semibold text-white">{title}</span></p>
          <span className="rounded-full bg-brand/20 px-3 py-1 text-xs font-semibold text-white">3단계 · 시퀀스 재생</span>
        </div>

        <section className="rounded-2xl border border-white/10 bg-bg-dark-2 p-4">
          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label="재생 위치"
            aria-valuemin={0}
            aria-valuemax={Math.round(durationSec)}
            aria-valuenow={Math.floor(time)}
            aria-valuetext={`${formatTime(time)} / ${formatTime(durationSec)}, ${lk(cur.sectionLabel)}`}
            onKeyDown={onKey}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seekFromPointer(e); }}
            onPointerMove={(e) => e.buttons === 1 && seekFromPointer(e)}
            className="relative h-[130px] cursor-pointer touch-none overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-brand"
          >
            {items.map((it, i) => (
              <div
                key={i}
                className="absolute inset-y-0 border-l border-white/10"
                style={{ left: pct(it.startSec), width: pct(it.endSec - it.startSec), background: i === idx ? `${accent}33` : i % 2 ? "#ffffff0d" : "#ffffff05" }}
              />
            ))}
            <div className="absolute inset-x-0 bottom-0 flex h-full items-end gap-px px-px">
              {bars.map((v, i) => (
                <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${Math.max(4, v * 100)}%`, background: accent, opacity: 0.55 }} />
              ))}
            </div>
            <div ref={lineRef} className="absolute inset-y-0 w-0.5 bg-white" style={{ left: 0 }} />
          </div>
          <div className="relative mt-1 h-4 text-[11px] text-white/60" aria-hidden>
            {ticks.map((t) => (
              <span key={t} className="absolute" style={{ left: pct(t) }}>{formatTime(t)}</span>
            ))}
          </div>
        </section>

        <div ref={stageBoxRef} className="h-60 scroll-mt-2 overflow-hidden rounded-2xl border border-white/10 bg-bg-dark md:h-[360px]">
          <MemoScene state={stage} controls={false} scene={sceneCtl.scene} />
        </div>

        <div className="flex items-center justify-end gap-3">
          {sceneCtl.imageNote && <p role="status" className="text-xs text-white/60">{sceneCtl.imageNote}</p>}
          <button
            ref={openerRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={sceneCtl.open}
            onClick={openScene}
            className="min-h-10 rounded-full border border-white/15 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-brand"
          >
            배경 설정
          </button>
        </div>
        {sceneCtl.open && <SceneSettingsPanel title={title} accent={accent} returnFocusRef={openerRef} {...sceneCtl.panel} />}

        {(silent || tapAgain) && (
          <p role="status" className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white">
            {tapAgain ? "재생 버튼을 한 번 더 눌러 주세요" : "음원을 불러오지 못해 소리 없이 재생해요"}
          </p>
        )}

        <div className="flex items-center justify-center gap-3">
          <button type="button" aria-label="이전 구간" onClick={prev} className={btn}>⟪</button>
          <button type="button" aria-label={playing ? "일시정지" : "재생"} onClick={toggle} className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-bg-dark hover:opacity-90 focus-visible:outline-2 focus-visible:outline-brand">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
              {playing ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M7 4l13 8-13 8z" />}
            </svg>
          </button>
          <button type="button" aria-label="다음 구간" onClick={next} className={btn}>⟫</button>
          <span className="ml-2 text-sm tabular-nums text-white/60">{formatTime(time)} / {formatTime(durationSec)}</span>
        </div>

        <ul className="flex flex-wrap gap-2">
          {items.map((it, i) => (
            <li key={i}>
              <button
                type="button"
                aria-current={i === idx}
                onClick={() => seek(it.startSec)}
                className={`rounded-full border px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-brand ${i === idx ? "border-brand bg-brand/20 font-semibold text-white" : "border-white/10 text-white/60 hover:text-white"}`}
              >
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: it.state.color }} aria-hidden />
                {lk(it.sectionLabel)} · {formatTime(it.startSec)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
