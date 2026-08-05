import Link from "next/link";
import { notFound } from "next/navigation";
import TabToggle from "@/components/common/TabToggle";
import ArtistSelect from "@/components/staff/ArtistSelect";
import StageStudio from "@/components/staff/StageStudio";
import { DEFAULT_METRICS_SLUG, getArtist, getArtists, getMetrics } from "@/lib/data";

export default async function StagePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).artist;
  const slug = typeof raw === "string" ? raw : DEFAULT_METRICS_SLUG;
  const artists = getArtists();
  const artist = getArtist(slug);
  const metrics = getMetrics(slug);
  if (!artist || !metrics) notFound();

  return (
    <main className="flex h-screen flex-col bg-bg-dark text-white">
      <div className="flex flex-col gap-3 px-8 py-4">
        <div className="flex items-center justify-between">
          <Link
            href={`/staff/dashboard?artist=${slug}`}
            className="text-sm text-white/60 hover:text-white"
          >
            ← 대시보드 <span className="text-white/90">/ 무대 연출</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white/80">
              {metrics.nextShow.venue} 셋업
            </span>
            <TabToggle dark />
          </div>
        </div>
        <ArtistSelect artists={artists} current={slug} basePath="/staff/stage" dark />
      </div>
      <StageStudio artists={artists} slug={slug} defaultColor={artist.color} />
    </main>
  );
}
