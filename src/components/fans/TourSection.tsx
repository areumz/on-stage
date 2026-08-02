"use client";

import { useEffect, useRef, useState } from "react";
import TourOrbit from "@/components/three/TourOrbit";
import { useSectionScroll } from "@/lib/hooks";
import type { Artist, City } from "@/lib/types";

// badge("● World Tour 2026 · 24 cities")에 이미 아티스트별 투어명이 있어
// 별도 필드를 추가하지 않고 여기서 뽑아 쓴다. year는 badge 안에서 유일한 4자리 숫자라
// 그 앞부분만 자르면 투어명이 남는다.
function tourTypeFrom(badge: string, year: number) {
  return badge.replace("●", "").split(String(year))[0].trim();
}

export default function TourSection({ artist }: { artist: Artist }) {
  const ref = useRef<HTMLElement | null>(null);
  const progress = useSectionScroll(ref);
  const [selected, setSelected] = useState<City | null>(null);

  // 선택된 도시가 있을 때, 궤도(캔버스)·정보 카드가 아닌 바깥을 클릭하면 선택 해제
  useEffect(() => {
    if (!selected) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setSelected(null);
    };
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, [selected]);

  return (
    <section id="tour" ref={ref} className="grid min-h-screen grid-cols-2 items-center gap-8 px-16">
      <div>
        <p className="text-xs tracking-[0.25em] text-brand-soft">SECTION 02 · TOUR</p>
        <h2 className="mt-4 font-serif-hero text-4xl leading-snug">
          {artist.name} {artist.tour.year}
          <br />
          {tourTypeFrom(artist.tour.badge, artist.tour.year)} ({artist.stats.cities} Cities)
        </h2>
        <p className="mt-6 text-white/60">
          이번 투어의 주요 도시가 궤도를 그립니다.<br />도시를 클릭하면 그날의 공연 정보를 확인할 수 있습니다.
        </p>
        {selected ? (
          <p className="mt-6 rounded-lg border border-white/15 px-4 py-3 text-sm">
            <span style={{ color: artist.color }}>{selected.code}</span>
            <span className="ml-3 text-white">{selected.name}</span>
            <span className="ml-3 text-white/50">{selected.date}</span>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => alert("준비중입니다")}
            className="mt-6 w-full rounded-lg border border-white/15 px-4 py-3 text-left text-sm text-white/70 transition-colors hover:border-white/30 hover:text-white"
          >
            전체 공연 정보 확인
          </button>
        )}
      </div>
      <div className="h-[70vh]">
        <TourOrbit artist={artist} progress={progress} onSelect={setSelected} />
      </div>
    </section>
  );
}
