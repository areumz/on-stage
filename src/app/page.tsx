import Header from "@/components/common/Header";
import NowTicker from "@/components/fans/NowTicker";
import OrbitScene from "@/components/three/OrbitScene";
import { getArtists } from "@/lib/data";

export default async function Home() {
  const artists = await getArtists();

  return (
    <main className="flex h-screen flex-col bg-bg-dark text-white">
      <Header dark />
      <div className="relative flex-1">
        {artists.length > 0 && <OrbitScene artists={artists} />}
        {/* 중앙 레이블명: DOM 오버레이가 캔버스보다 선명해서 이 방식으로 채택 */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <h1 className="font-serif-hero text-4xl tracking-widest">STAGE.ONE</h1>
          <p className="mt-2 text-sm text-brand-soft">{artists.length} artists · est. 2020</p>
        </div>
        <p className="absolute bottom-4 left-8 text-xs tracking-[0.2em] text-white/40">
          HOVER · CLICK TO ENTER
        </p>
      </div>
      <NowTicker items={artists.map((a) => ({ slug: a.slug, news: a.news }))} />
    </main>
  );
}
