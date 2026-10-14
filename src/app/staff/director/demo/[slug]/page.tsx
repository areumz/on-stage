import Link from "next/link";
import { notFound } from "next/navigation";
import SequencePlayer from "@/components/director/SequencePlayer";
import { getDemo } from "@/lib/director/demo";
import { createServerSupabase } from "@/lib/supabase/server";

// 데모 곡 재생. (분석 결과와 시퀀스는 JSON 으로 들어 있어 Python 을 부르지 않음)
export default async function DemoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const demo = getDemo(slug);
  if (!demo) notFound();

  const supabase = await createServerSupabase();
  const [{ data: artist }, { data: track }] = await Promise.all([
    supabase.from("artists").select("name, color").eq("slug", demo.artistSlug).maybeSingle(),
    supabase.from("audio_tracks").select("id").eq("storage_path", demo.storagePath).maybeSingle(),
  ]);
  if (!artist) notFound();

  if (!track) {
    // 시드 스크립트(npm run seed:director)를 아직 실행하지 않은 상태
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-lg font-bold">데모 곡이 아직 준비되지 않았어요</h1>
        <p className="mt-2 text-sm text-white/70">관리자가 시드를 실행하면 열려요.</p>
        <Link href="/staff/director" className="mt-4 inline-block text-sm text-brand-soft hover:text-white">
          ← 곡 올리기로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <SequencePlayer
      audioTrackId={track.id}
      title={demo.title}
      artistName={artist.name}
      accent={artist.color}
      durationSec={demo.durationSec}
      items={demo.items}
      energyCurve={demo.energyCurve}
      sequenceId={null}
      aiProps={demo.aiProps}
      initialEdit={null}
    />
  );
}
