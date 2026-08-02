"use client";

import { useRef, useState } from "react";
import type { Artist, Track } from "@/lib/types";

const EQ_HEIGHTS = [10, 16, 12, 18, 8];
const DRAG_STEP = 40; // 이만큼 끌 때마다 한 장씩

const no = (n: number) => String(n).padStart(2, "0");

// 3D 회전·밝기·크기만 필요해 R3F 대신 CSS transform으로 만든다(캔버스 없이 선명하고,
// 이 페이지에 이미 떠 있는 WebGL 컨텍스트 3개에 하나를 더 얹지 않는다).
function Coverflow({ tracks, active, onActive }: {
  tracks: Track[]; active: number; onActive: (i: number) => void;
}) {
  const dragFrom = useRef<number | null>(null);
  const dragged = useRef(false);
  const clamp = (i: number) => Math.max(0, Math.min(tracks.length - 1, i));

  return (
    <div
      className="relative mt-14 h-60 cursor-grab touch-pan-y select-none [perspective:1000px] active:cursor-grabbing"
      onPointerDown={(e) => { dragFrom.current = e.clientX; dragged.current = false; }}
      onPointerMove={(e) => {
        if (dragFrom.current === null) return;
        const dx = e.clientX - dragFrom.current;
        if (Math.abs(dx) < DRAG_STEP) return;
        // 오른쪽으로 끌면 왼쪽(이전) 커버가 앞으로 온다
        onActive(clamp(active + (dx > 0 ? -1 : 1)));
        dragFrom.current = e.clientX;
        dragged.current = true;
      }}
      onPointerUp={() => { dragFrom.current = null; }}
      onPointerLeave={() => { dragFrom.current = null; }}
    >
      {tracks.map((track, i) => {
        const offset = i - active;
        const away = Math.abs(offset);
        const front = offset === 0;
        // 좌우 한 장씩만 보이고 나머지는 뒤에 숨는다 — 숨은 카드는 조작 대상에서 뺀다
        const shown = away <= 1;
        return (
          <button
            key={track.no}
            type="button"
            data-cover={i}
            aria-hidden={!shown}
            tabIndex={shown ? 0 : -1}
            onClick={() => { if (!dragged.current) onActive(i); }}
            className="absolute left-1/2 top-1/2 h-52 w-52 overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-soft"
            style={{
              transform: `translate(-50%, -50%) translateX(${offset * 72}%) rotateY(${offset * 35}deg) scale(${front ? 1 : 0.82})`,
              filter: `brightness(${front ? 1 : 0.5})`,
              opacity: shown ? 1 : 0,
              pointerEvents: shown ? "auto" : "none",
              zIndex: 10 - away,
              background: `linear-gradient(160deg, ${track.cover.from}, ${track.cover.to})`,
              boxShadow: front ? `0 24px 60px -20px ${track.cover.from}` : undefined,
              transition: "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.4s, opacity 0.4s, box-shadow 0.4s",
            }}
          >
            {/* 커버 그라디언트가 밝은 트랙에서도 글자가 읽히도록 하단 스크림 */}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-4 pb-4 pt-12 text-left">
              <span className="block font-serif-hero text-xl leading-tight text-white">
                {track.title}
              </span>
              <span className="mt-1 block text-[11px] tracking-[0.2em] text-white/75">
                {no(track.no)} · {track.duration}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function AlbumSection({ artist }: { artist: Artist }) {
  // 트랙 hover / 커버 클릭 / 드래그가 모두 이 하나를 바꾼다 —
  // 그래서 어느 경로로 바뀌든 커버와 트랙 행이 같이 반응한다 (CSS :hover를 쓰지 않는 이유)
  const [active, setActive] = useState(0);

  return (
    <section id="album" className="mx-auto min-h-screen max-w-3xl px-8 py-32">
      <p className="text-xs tracking-[0.25em] text-brand-soft">SECTION 03 · DISCOGRAPHY</p>
      <h2 className="mt-4 font-serif-kr text-5xl">디스코그래피</h2>

      <Coverflow tracks={artist.tracks} active={active} onActive={setActive} />

      <ul className="mt-14 divide-y divide-white/10">
        {artist.tracks.map((t, i) => {
          const on = i === active;
          return (
            <li
              key={t.no}
              data-track={i}
              data-active={on}
              onMouseEnter={() => setActive(i)}
              className={`-mx-4 flex items-baseline gap-6 rounded-lg px-4 py-5 transition-colors ${on ? "bg-brand/10" : ""}`}
            >
              <span className="relative w-8 shrink-0 font-serif-hero text-2xl" style={{ color: artist.color }}>
                <span className={`transition-opacity ${on ? "opacity-0" : "opacity-100"}`}>
                  {no(t.no)}
                </span>
                {/* 재생 아이콘 — 시각 장식만, 실제 재생은 범위 밖 */}
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                  className={`absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 transition-opacity ${on ? "opacity-100" : "opacity-0"}`}
                >
                  <path d="M5 3.5v13l11-6.5-11-6.5z" />
                </svg>
              </span>
              <span className="flex-1 text-lg">{t.title}</span>
              {/* 오디오 바 — 순수 장식 (실제 오디오 데이터 아님) */}
              <span
                aria-hidden="true"
                className={`flex items-end gap-[3px] transition-opacity ${on ? "opacity-100" : "opacity-0"}`}
              >
                {EQ_HEIGHTS.map((h, j) => (
                  <span
                    key={j}
                    className="w-0.5 origin-bottom animate-eq rounded-full bg-brand"
                    style={{ height: h, animationDelay: `${j * -0.15}s` }}
                  />
                ))}
              </span>
              <span className="text-sm text-white/40">{t.duration}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
