"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import GalleryHaze from "@/components/three/GalleryHaze";
import type { Artist } from "@/lib/types";

const no = (i: number) => String(i + 1).padStart(2, "0");

// 타일과 라이트박스 언더레이가 반드시 같은 최적화 URL을 받도록 sizes를 공유
const TILE_SIZES = "(min-width: 1024px) 306px, 33vw";

// 라이트박스는 타일(w=384)과 다른 크기(w=1080)를 요청해 캐시가 어긋남
// 이미 캐시된 썸네일을 깔아 두고 고해상도가 도착하면 위에 겹쳐 선명해지게 함
function LightboxImage({ src, alt }: { src: string; alt: string }) {
  const [sharp, setSharp] = useState(false);
  return (
    <div className="animate-lightbox relative aspect-[4/5] h-[70vh] overflow-hidden rounded-xl">
      {/* 1.4배 확대라 원래도 크게 흐리지 않음 — 약한 블러로 선명해지는 전환만 자연스럽게 */}
      <Image src={src} alt="" aria-hidden fill sizes={TILE_SIZES} className="scale-105 object-cover blur-[3px]" />
      <Image
        src={src}
        alt={alt}
        fill
        sizes="60vw"
        onLoad={() => setSharp(true)}
        className={`object-cover transition-opacity duration-500 ${sharp ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

function Tile({ src, alt, color, index, caption, onOpen }: {
  src: string; alt: string; color: string; index: number; caption: string; onOpen: () => void;
}) {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, on: false });

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setTilt({
          rx: -((e.clientY - r.top) / r.height - 0.5) * 12,
          ry: ((e.clientX - r.left) / r.width - 0.5) * 12,
          on: true,
        });
      }}
      onMouseLeave={() => setTilt({ rx: 0, ry: 0, on: false })}
      className="group relative aspect-[4/5] overflow-hidden rounded-xl"
      style={{
        transform: `perspective(700px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${tilt.on ? 1.03 : 1})`,
        boxShadow: tilt.on ? `0 24px 60px -18px ${color}aa` : undefined,
        transition: "box-shadow 0.3s, transform 0.15s",
        // 이미지 로드 전 배경 — 아티스트 컬러 그라디언트
        background: `linear-gradient(${135 + index * 30}deg, ${color}${["33", "55", "22", "44", "66", "2a"][index]}, #13102A)`,
      }}
    >
      <Image src={src} alt={alt} fill sizes={TILE_SIZES} className="object-cover" />
      <span className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/85 to-transparent p-4 text-left transition-transform duration-300 group-hover:translate-y-0">
        <span className="block text-sm font-medium" style={{ color }}>LIVE #{no(index)}</span>
        <span className="block text-xs text-white/60">{caption}</span>
      </span>
    </button>
  );
}

export default function GallerySection({ artist }: { artist: Artist }) {
  const photos = artist.gallery;
  const [open, setOpen] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open === null) d.close();
    else if (!d.open) d.showModal();
  }, [open]);

  const step = (delta: number) =>
    setOpen((i) => (i === null ? i : (i + delta + photos.length) % photos.length));

  return (
    <section id="gallery" className="relative py-32">
      {/* 무대 조명 먼지 — 그리드 뒤 전체 폭에 깔림 */}
      <GalleryHaze color={artist.color} />
      <div className="relative mx-auto max-w-5xl px-8">
        <p className="text-xs tracking-[0.25em] text-brand-soft">SECTION 04 · GALLERY</p>
        <h2 className="mt-4 font-serif-kr text-5xl">갤러리</h2>
        <div className="mt-12 grid grid-cols-3 gap-4">
          {photos.map((photo, i) => (
            <Tile
              key={photo.src}
              src={photo.src}
              alt={`${artist.name} 공연 이미지 ${i + 1}`}
              color={artist.color}
              index={i}
              caption={artist.tour.titleKo}
              onOpen={() => setOpen(i)}
            />
          ))}
        </div>
        {/* AI 생성 이미지(echo/halo)는 저작권 표기 대상이 아니라 생성 사실만 밝힘
            그 외는 CC-BY 출처 표기가 라이선스 조건이라 촬영자·링크를 노출 */}
        {photos.every((p) => p.license === "AI") ? (
          <p className="mt-6 text-xs text-white/35">이미지: AI로 생성됨 (Google Gemini)</p>
        ) : (
          <p className="mt-6 text-xs leading-relaxed text-white/35">
            사진{" "}
            {photos.map((photo, i) => (
              <span key={photo.src}>
                {i > 0 && " · "}
                <a
                  href={photo.origin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-white/20 underline-offset-2 hover:text-white/70"
                >
                  {photo.creator}
                </a>{" "}
                ({photo.license})
              </span>
            ))}
          </p>
        )}
      </div>

      <dialog
        ref={dialog}
        aria-label="이미지 확대보기"
        onClose={() => setOpen(null)}
        onClick={(e) => { if (e.target === dialog.current) setOpen(null); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        // m-auto: Tailwind preflight가 margin을 0으로 리셋해 dialog 기본 중앙 정렬이 죽는다
        className="m-auto max-h-none max-w-none bg-transparent p-4 text-white backdrop:bg-black/85"
      >
        {open !== null && (
          <div className="flex flex-col items-center gap-6">
            {/* key로 리마운트해 넘길 때마다 전환 애니메이션과 선명해짐이 다시 돈다 */}
            <LightboxImage key={open} src={photos[open].src} alt={`${artist.name} 공연 이미지 ${open + 1}`} />
            <div className="flex items-center gap-8">
              <button type="button" onClick={() => step(-1)} aria-label="이전 이미지" className="text-2xl text-white/60 hover:text-white">
                ‹
              </button>
              <span className="font-serif-hero text-lg tracking-widest">
                <span style={{ color: artist.color }}>{no(open)}</span>
                <span className="text-white/40"> / {String(photos.length).padStart(2, "0")}</span>
              </span>
              <button type="button" onClick={() => step(1)} aria-label="다음 이미지" className="text-2xl text-white/60 hover:text-white">
                ›
              </button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
