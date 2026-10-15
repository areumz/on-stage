import { connection } from "next/server";
import GuidePanel from "@/components/guide/GuidePanel";
import GuideProvider from "@/components/guide/GuideProvider";
import { getArtistSlugs } from "@/lib/data";

// A탭(/, /artists/[slug]) 공용 껍데기. 이 안에서 이동해도 레이아웃이 유지되어 패널 상태가 남는다. B탭에는 실리지 않는다.
export default async function FansLayout({ children }: { children: React.ReactNode }) {
  await connection(); // env를 빌드 시점이 아니라 요청 시점에 읽도록 동적 렌더링 보장
  const apiUrl = process.env.NEXT_PUBLIC_GUIDE_API_URL;
  if (!apiUrl) return <>{children}</>;
  const artistSlugs = await getArtistSlugs();
  return (
    <GuideProvider apiUrl={apiUrl} artistSlugs={artistSlugs}>
      {children}
      <GuidePanel />
    </GuideProvider>
  );
}
