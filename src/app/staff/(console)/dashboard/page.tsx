import { notFound } from "next/navigation";
import ArtistSelect from "@/components/staff/ArtistSelect";
import CityChart from "@/components/staff/CityChart";
import MetricCard from "@/components/staff/MetricCard";
import StagePreviewCard from "@/components/staff/StagePreviewCard";
import { DEFAULT_METRICS_SLUG, getArtist, getArtists, getMetrics } from "@/lib/data";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).artist;
  const slug = typeof raw === "string" ? raw : DEFAULT_METRICS_SLUG;
  const artist = getArtist(slug);
  const metrics = getMetrics(slug);
  if (!artist || !metrics) notFound();

  return (
    <div>
      {/* A/B 토글은 (console)/layout.tsx가 그림 */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">대시보드</h1>
          <p className="mt-1 text-sm text-gray-600">
            {artist.tour.titleKo} {artist.tour.year} · 실시간
          </p>
        </div>
        <ArtistSelect artists={getArtists()} current={slug} />
      </div>

      <div className="mt-8 grid grid-cols-3 gap-5">
        <MetricCard
          title="총 티켓 판매"
          value={metrics.totalTickets.value.toLocaleString()}
          sub={metrics.totalTickets.delta}
          positive={metrics.totalTickets.positive}
        />
        <MetricCard
          title="평균 예매율"
          value={`${metrics.avgBookingRate.value}%`}
          sub={metrics.avgBookingRate.note}
        />
        <MetricCard
          title="다음 공연"
          value={`D-${metrics.nextShow.dday}`}
          sub={metrics.nextShow.venue}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-5">
        <div className="rounded-xl border border-gray-200 bg-surface-2 p-6">
          <h2 className="font-medium">도시별 예매 현황</h2>
          <div className="mt-4">
            <CityChart data={metrics.cityBookings} color={artist.color} />
          </div>
        </div>
        {/* 다크 톤 반전 카드 — A탭 무드 미리보기 */}
        <StagePreviewCard slug={slug} color={artist.color} />
      </div>
    </div>
  );
}
