import { notFound } from "next/navigation";
import Link from "next/link";
import TabToggle from "@/components/common/TabToggle";
import HeroBackground from "@/components/three/HeroBackground";
import { getArtist } from "@/lib/data";

export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artist = getArtist(slug);
  if (!artist) notFound();

  return (
    <main className="bg-bg-dark text-white">
      {/* Hero */}
      <section className="relative flex h-screen flex-col">
        <div className="absolute inset-0">
          <HeroBackground color={artist.color} />
        </div>
        <div className="relative z-10 flex items-center justify-between px-8 py-5">
          <Link href="/" className="text-sm text-white/60 hover:text-white">
            ← 레이블 <span className="text-white/90">/ {artist.name}</span>
          </Link>
          <TabToggle dark />
        </div>
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
          <span className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-brand-soft">
            {artist.tour.badge}
          </span>
          <h1 className="mt-6 font-serif-hero text-[10rem] leading-none">
            {artist.name}
          </h1>
          <p className="mt-4 font-serif-kr text-3xl" style={{ color: artist.color }}>
            {artist.tour.titleKo}
          </p>
          <div className="mt-10 flex gap-4">
            <a href="#tour" className="rounded-lg bg-brand px-6 py-3 font-medium text-white hover:opacity-90">
              투어 일정 보기 →
            </a>
            <a href="#album" className="rounded-lg border border-white/30 px-6 py-3 font-medium hover:border-white">
              앨범 듣기
            </a>
          </div>
          <div className="mt-14 flex gap-16">
            {[
              [artist.stats.cities, "cities"],
              [artist.stats.countries, "countries"],
              [artist.stats.tracks, "tracks"],
            ].map(([v, label]) => (
              <div key={label}>
                <p className="text-3xl font-bold">{v}</p>
                <p className="text-sm text-white/50">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-12 text-xs tracking-[0.3em] text-white/40">SCROLL ↓</p>
        </div>
      </section>
      {/* Task 6: TourSection / AlbumSection / GallerySection가 여기에 추가됨 */}
    </main>
  );
}
