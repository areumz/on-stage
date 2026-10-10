import DemoTracks from "@/components/director/DemoTracks";
import Library from "@/components/director/Library";
import { ScreenHeader } from "@/components/director/ProgressCard";
import UploadPanel from "@/components/director/UploadPanel";
import { getArtistChoices, getAudioTracks, getSequences } from "@/lib/director/data";

// 무대 연출 디렉터 시작 화면: 곡 올리기 + 데모 곡, 그 아래 내 연출(곡별 초안·저장본).
// ?artist=<slug> 로 들어오면 그 아티스트가 기본 선택된다(/staff/stage 와 같은 규칙).
export default async function DirectorHomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).artist;
  const defaultArtistSlug = typeof raw === "string" ? raw : undefined;
  const [artists, tracks, sequences] = await Promise.all([getArtistChoices(), getAudioTracks(), getSequences()]);

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-6">
        <ScreenHeader eyebrow="시작 · 분석 요청" title="곡 올리기" badge="무대 연출 디렉터" />
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <UploadPanel artists={artists} defaultArtistSlug={defaultArtistSlug} />
          <DemoTracks />
        </div>
      </section>
      <Library tracks={tracks} sequences={sequences} />
    </div>
  );
}
