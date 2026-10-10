import { notFound } from "next/navigation";
import TrackFlow from "@/components/director/TrackFlow";
import { getTrackDetail } from "@/lib/director/data";
import { listDemos } from "@/lib/director/demo";
import { isUuid } from "@/lib/director/http";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const detail = await getTrackDetail(id);
  if (!detail) notFound();
  const demo = listDemos()[0];
  return (
    <TrackFlow
      trackId={id}
      title={detail.track.title}
      artistName={detail.artist?.name ?? ""}
      initialStatus={detail.track.analysis_status}
      demoHref={demo ? `/staff/director/demo/${demo.slug}` : "/staff/director"}
    />
  );
}
