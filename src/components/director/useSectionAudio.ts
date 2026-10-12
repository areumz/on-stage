"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 서명 URL 은 1시간짜리라, 오래 열어 둔 화면에서 만료된 URL 로 재생하지 않도록 50분이 지나면 새로 받는다.
const URL_TTL_MS = 50 * 60 * 1000;
const TICK_MS = 100; // 위치 표시는 초당 10번만 갱신한다(화면 전체가 다시 그려지므로)

// 구간 확인 화면 전용 재생기. 재생 화면(SequencePlayer)과 독립이라 3D·타이머 모드가 없다.
// 자동 재생은 하지 않는다 — play/playFrom 이 호출될 때만 소리가 난다.
// 서명 URL 은 audio.src 에만 두고 상태·로그로 내보내지 않는다.
export function useSectionAudio(audioTrackId: string, durationSec: number) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const ready = useRef(false); // src 설정 + 메타데이터 로드 완료
  const urlAt = useRef(0);
  const busy = useRef(false);
  const dead = useRef(false);
  const pos = useRef(0);
  const stopAt = useRef<number | null>(null); // '경계 듣기' 의 끝 시각
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  const get = useCallback(() => {
    if (audio.current) return audio.current;
    const a = new Audio();
    a.preload = "none";
    a.addEventListener("pause", () => setPlaying(false));
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
  }, []);

  // 서명 URL 을 받아 src 에만 설정하고, 메타데이터가 온 뒤에 위치를 맞춘다(src 직후 play 하면 0초 소리가 먼저 난다)
  const attach = useCallback(async (a: HTMLAudioElement, t: number) => {
    ready.current = false;
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
    urlAt.current = Date.now();
    ready.current = true;
  }, [audioTrackId]);

  const playFrom = useCallback(async (from: number, to: number | null = null) => {
    if (busy.current) return;
    busy.current = true;
    setFailed(false);
    try {
      const a = get();
      const t = Math.min(durationSec, Math.max(0, from));
      if (!ready.current || Date.now() - urlAt.current > URL_TTL_MS) await attach(a, t);
      if (dead.current) return;
      a.currentTime = t;
      stopAt.current = to;
      pos.current = t;
      setTime(t);
      await a.play();
      if (!dead.current) setPlaying(true);
    } catch {
      // 사용자 제스처가 fetch 로 끊겼을 때(NotAllowedError)도 src 는 준비돼 있어 다시 누르면 바로 재생된다
      if (!dead.current) {
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
        if (stopAt.current !== null && a.currentTime >= stopAt.current) {
          stopAt.current = null;
          a.pause();
          return;
        }
        if (now - last >= TICK_MS) {
          last = now;
          setTime(a.currentTime);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // 화면을 떠나면 멈추고 src 를 비운다(서명 URL 이 남지 않게)
  useEffect(() => {
    dead.current = false;
    return () => {
      dead.current = true;
      ready.current = false;
      const a = audio.current;
      audio.current = null;
      if (a) {
        a.pause();
        a.removeAttribute("src");
        a.load();
      }
    };
  }, []);

  return { time, playing, failed, toggle, seek, playFrom };
}
