"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 서명 URL 은 1시간짜리라, 오래 열어 둔 화면에서 만료된 URL 로 재생하지 않도록 50분이 지나면 새로 받는다.
const URL_TTL_MS = 50 * 60 * 1000;
// 메타데이터가 오지 않는 환경(iOS 등)에서 영영 멈추지 않게 기다리는 시간을 제한한다.
const META_TIMEOUT_MS = 10000;
const TICK_MS = 100; // 위치 표시는 초당 10번만 갱신한다(화면 전체가 다시 그려지므로)

// 구간 확인 화면 전용 재생기. 재생 화면(SequencePlayer)과 독립이라 3D·타이머 모드가 없다.
// 자동 재생은 하지 않는다 — play/playFrom 이 호출될 때만 소리가 난다.
// 서명 URL 은 audio.src 에만 두고 상태·로그로 내보내지 않는다.
export function useSectionAudio(audioTrackId: string, durationSec: number) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const ready = useRef(false); // src 설정 + 메타데이터 로드 완료
  const pending = useRef<Promise<void> | null>(null); // 진행 중인 URL 받기(미리 받기와 클릭이 겹쳐도 한 번만)
  const urlAt = useRef(0);
  const busy = useRef(false);
  const pos = useRef(0);
  const gen = useRef(0); // seek 횟수 — 요청 도중 들어온 seek 이 먼저 누른 위치를 덮어쓰지 않게 한다
  const stopAt = useRef<number | null>(null); // '경계 듣기' 의 끝 시각
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(false); // 한 번이라도 재생했는지(안내 문구용)
  const [failed, setFailed] = useState(false);

  // 백그라운드 탭에선 rAF 가 멈추므로 rAF 와 timeupdate 양쪽에서 부른다. 멈추기 직전 최종 위치를 화면에 맞춘다.
  const stopIfDue = useCallback((a: HTMLAudioElement) => {
    if (stopAt.current === null || a.currentTime < stopAt.current) return false;
    stopAt.current = null;
    pos.current = a.currentTime;
    setTime(a.currentTime);
    a.pause();
    return true;
  }, []);

  const get = useCallback(() => {
    if (audio.current) return audio.current;
    const a = new Audio();
    a.preload = "metadata";
    a.addEventListener("pause", () => setPlaying(false));
    a.addEventListener("timeupdate", () => stopIfDue(a));
    a.addEventListener("ended", () => {
      pos.current = 0;
      a.currentTime = 0;
      setTime(0);
      setPlaying(false);
    });
    // 재생 중 만료·디코드 오류: 다음 재생 때 URL 을 새로 받도록 표시하고 안내만 보인다
    a.addEventListener("error", () => {
      if (!ready.current) return;
      ready.current = false;
      setPlaying(false);
      setFailed(true);
    });
    audio.current = a;
    return a;
  }, [stopIfDue]);

  // 서명 URL 을 받아 src 에만 설정하고 메타데이터를 기다린다. 위치는 호출한 쪽이 play 직전에 맞춘다.
  const attach = useCallback((a: HTMLAudioElement) => {
    pending.current ??= (async () => {
      ready.current = false;
      const res = await fetch(`/api/audio-tracks/${audioTrackId}/play`);
      if (!res.ok) throw new Error("play route");
      const { url } = (await res.json()) as { url: string };
      if (audio.current !== a) throw new Error("unmounted"); // 언마운트(또는 StrictMode 재마운트)됐다
      let onMeta = () => {};
      let onErr = () => {};
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await new Promise<void>((resolve, reject) => {
          onMeta = () => resolve();
          onErr = () => reject(new Error("audio"));
          a.addEventListener("loadedmetadata", onMeta);
          a.addEventListener("error", onErr);
          timer = setTimeout(() => reject(new Error("timeout")), META_TIMEOUT_MS);
          a.src = url;
          a.load();
        });
      } finally {
        clearTimeout(timer);
        a.removeEventListener("loadedmetadata", onMeta);
        a.removeEventListener("error", onErr);
      }
      if (audio.current !== a) throw new Error("unmounted");
      urlAt.current = Date.now();
      ready.current = true;
    })().finally(() => {
      pending.current = null;
    });
    return pending.current;
  }, [audioTrackId]);

  const playFrom = useCallback(async (from: number, to: number | null = null) => {
    if (busy.current) return;
    busy.current = true;
    setFailed(false);
    const a = get();
    try {
      const g = gen.current;
      // 미리 받아 둔 URL 이 있으면 await 없이 바로 play() 해서 같은 클릭(사용자 제스처) 안에서 재생한다
      if (!ready.current || Date.now() - urlAt.current > URL_TTL_MS) await attach(a);
      if (audio.current !== a) return;
      // 받는 동안 seek 이 있었으면 그 위치가 마지막 요청이다
      const moved = gen.current !== g;
      const t = moved ? pos.current : Math.min(durationSec, Math.max(0, from));
      a.currentTime = t;
      stopAt.current = moved ? null : to;
      pos.current = t;
      setTime(t);
      await a.play();
      if (audio.current === a) {
        setPlaying(true);
        setPlayed(true);
      }
    } catch {
      // 제스처가 끊겨 NotAllowedError 가 나도 src 는 준비돼 있어 다시 누르면 바로 재생된다
      if (audio.current === a) {
        setFailed(true);
        setPlaying(false);
      }
    } finally {
      busy.current = false;
    }
  }, [attach, durationSec, get]);

  const pause = useCallback(() => {
    audio.current?.pause();
    stopAt.current = null;
  }, []);

  const toggle = useCallback(() => {
    if (playing) pause();
    else void playFrom(pos.current >= durationSec ? 0 : pos.current);
  }, [durationSec, pause, playFrom, playing]);

  const seek = useCallback((sec: number) => {
    const t = Math.min(durationSec, Math.max(0, sec));
    gen.current += 1;
    pos.current = t;
    stopAt.current = null;
    setTime(t);
    if (ready.current && audio.current) audio.current.currentTime = t;
  }, [durationSec]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const a = audio.current;
      if (a) {
        pos.current = a.currentTime;
        if (stopIfDue(a)) return;
        if (now - last >= TICK_MS) {
          last = now;
          setTime(a.currentTime);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, stopIfDue]);

  // 마운트 때 URL 을 조용히 미리 받아 둔다(실패해도 무시 — 누를 때 다시 시도). 소리는 나지 않는다.
  // 화면을 떠나면 멈추고 src 를 비운다(서명 URL 이 남지 않게).
  useEffect(() => {
    attach(get()).catch(() => {});
    return () => {
      ready.current = false;
      pending.current = null;
      const a = audio.current;
      audio.current = null;
      if (a) {
        a.pause();
        a.removeAttribute("src");
        a.load();
      }
    };
  }, [attach, get]);

  return { time, playing, played, failed, toggle, seek, playFrom };
}
