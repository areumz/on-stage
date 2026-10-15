import Header from "@/components/common/Header";
import NowTicker from "@/components/fans/NowTicker";
import OrbitScene from "@/components/three/OrbitScene";
import OrbitScene3D from "@/components/three/OrbitScene3D";
import { FocusFromQuery } from "@/components/three/orbitShared";
import { getArtists } from "@/lib/data";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ orbit?: string; focus?: string }>;
}) {
  const { orbit, focus } = await searchParams;
  const artists = await getArtists();

  // ?orbit=2d > 서버 env ORBIT_VIEW=2d > 3D. 에이전트 계약의 context.view와 이름이 겹치지 않게 "orbit".
  const use2d = (orbit ?? process.env.ORBIT_VIEW) === "2d";

  return (
    <main className="flex h-screen flex-col bg-bg-dark text-white">
      <Header dark />
      {/* min-h-0 + overflow-hidden: flex 자식은 기본으로 내용 높이 아래로 줄지 않아, 창 높이를 줄이면
          캔버스가 그대로 남아 main 밖으로 삐져나왔다. 캔버스는 absolute로 빼서 컨테이너 크기를 밀지 않게 한다. */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0">
          {artists.length > 0 && (use2d ? <OrbitScene artists={artists} /> : <OrbitScene3D artists={artists} />)}
        </div>
        {focus && <FocusFromQuery slug={focus} />}
        {/* 중앙 레이블명: DOM 오버레이가 캔버스보다 선명해서 이 방식으로 채택 */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <h1 className="font-serif-hero text-2xl tracking-widest sm:text-3xl lg:text-4xl">STAGE.ONE</h1>
          <p className="mt-2 text-xs text-brand-soft sm:text-sm">{artists.length} artists · est. 2020</p>
        </div>
        <p className="absolute bottom-4 left-8 text-xs tracking-[0.2em] text-white/40">
          HOVER · CLICK TO ENTER
        </p>
      </div>
      <NowTicker items={artists.map((a) => ({ slug: a.slug, news: a.news }))} />
    </main>
  );
}
