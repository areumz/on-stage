"use client";

import { useEffect } from "react";
import { ARTIST_SECTIONS, isSection, setCurrentSection } from "@/lib/guide/sections";

// 화면 세로 가운데 선을 지나고 있는 섹션을 "현재 섹션"으로 기록한다. UI는 없다.
export default function ArtistSectionTracker() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && isSection(e.target.id)) setCurrentSection(e.target.id);
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    ARTIST_SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => {
      io.disconnect();
      setCurrentSection(null);
    };
  }, []);
  return null;
}
