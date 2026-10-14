import Link from "next/link";
import { notFound } from "next/navigation";
import SequenceFlow from "@/components/director/SequenceFlow";
import SequencePlayer from "@/components/director/SequencePlayer";
import RenameField from "@/components/director/RenameField";
import { getSequence, getTrackDetail } from "@/lib/director/data";
import { listDemos } from "@/lib/director/demo";
import { sequenceName } from "@/lib/director/format";
import { isUuid } from "@/lib/director/http";
import { parseSceneEdit } from "@/lib/stage/scene";

// 같은 주소가 초안이면 진행·검토 흐름, 승인본이면 재생 화면. 승인이 끝나면 클라이언트가 router.refresh() 로 이 페이지를 리렌더링.
export default async function SequencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const row = await getSequence(id);
  if (!row) notFound();
  const detail = await getTrackDetail(row.audio_track_id, { energy: row.status === "approved" });
  if (!detail) notFound();
  const { track, artist, energyCurve } = detail;

  if (row.status === "approved") {
    const items = row.items ?? [];
    return (
      <div className="flex flex-col gap-6">
        <Link href="/staff/director" className="self-start text-sm text-brand-soft hover:text-white">
          ← 내 연출
        </Link>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-white/60">내 연출</p>
          <RenameField
            sequenceId={row.id}
            name={sequenceName(track.title, row.approved_at ?? row.created_at, row.name)}
            defaultName={sequenceName(track.title, row.approved_at ?? row.created_at)}
            as="h1"
            textClass="text-2xl font-bold tracking-tight"
          />
        </div>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">재생할 연출이 없어요</p>
        ) : (
          <SequencePlayer
            audioTrackId={track.id}
            title={track.title}
            artistName={artist?.name ?? ""}
            accent={artist?.color ?? "#9f77dd"}
            durationSec={Number(track.duration_sec)}
            items={items}
            energyCurve={energyCurve ?? []}
            sequenceId={row.id}
            aiProps={row.props}
            initialEdit={parseSceneEdit(row.scene_edit, items.length)}
          />
        )}
      </div>
    );
  }

  return (
    <SequenceFlow
      key={row.id}
      sequenceId={row.id}
      trackId={track.id}
      trackTitle={track.title}
      artistName={artist?.name ?? ""}
      initialFeedbackCount={row.feedback_count}
      createdAt={row.created_at}
      demoHref={`/staff/director/demo/${listDemos()[0]?.slug ?? ""}`}
    />
  );
}
