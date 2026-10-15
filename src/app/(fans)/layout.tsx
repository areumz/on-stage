import GuidePanel from "@/components/guide/GuidePanel";
import GuideProvider from "@/components/guide/GuideProvider";
import { getArtistSlugs } from "@/lib/data";

// A탭(/, /artists/[slug]) 공용 껍데기. 이 안에서 이동해도 레이아웃이 유지되어 패널 상태가 남는다. B탭에는 실리지 않는다.
export default async function FansLayout({ children }: { children: React.ReactNode }) {
  // NEXT_PUBLIC_*는 빌드 시점에 인라인되는 값이다(런타임 env가 아님). 값을 바꾸면 다시 빌드해야 한다.
  const apiUrl = process.env.NEXT_PUBLIC_GUIDE_API_URL;
  if (!apiUrl) return <>{children}</>;
  let artistSlugs: string[];
  try {
    artistSlugs = await getArtistSlugs();
  } catch (e) {
    // 가이드가 사이트 전체를 죽이지 않게 한다
    console.error("guide: getArtistSlugs failed", e instanceof Error ? e.message : "unknown");
    return <>{children}</>;
  }
  return (
    <GuideProvider apiUrl={apiUrl} artistSlugs={artistSlugs}>
      {children}
      <GuidePanel />
    </GuideProvider>
  );
}
