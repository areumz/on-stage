import { notFound } from "next/navigation";
import ArtistEditForm from "@/components/staff/ArtistEditForm";
import ArtistSelect from "@/components/staff/ArtistSelect";
import GalleryManager from "@/components/staff/GalleryManager";
import TracksManager from "@/components/staff/TracksManager";
import { DEFAULT_METRICS_SLUG, getArtistRow, getArtists, getGalleryImages, getStaffRole, getTracks } from "@/lib/data";

export default async function StaffArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).artist;
  const slug = typeof raw === "string" ? raw : DEFAULT_METRICS_SLUG;
  const [artists, artistRow, tracks, images, { isOwner }] = await Promise.all([
    getArtists(),
    getArtistRow(slug),
    getTracks(slug),
    getGalleryImages(slug),
    getStaffRole(),
  ]);
  if (!artistRow) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">아티스트</h1>
          <p className="mt-1 text-sm text-gray-600">{artistRow.name} 편집 · 트랙 · 갤러리 관리</p>
        </div>
        <ArtistSelect artists={artists} current={slug} basePath="/staff/artists" />
      </div>

      <div className="mt-8">
        <ArtistEditForm key={slug} artist={artistRow} isOwner={isOwner} />
      </div>

      <div className="mt-8">
        <h2 className="font-medium">트랙</h2>
        <div className="mt-3">
          <TracksManager key={slug} artistSlug={slug} tracks={tracks} isOwner={isOwner} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-medium">갤러리</h2>
        <div className="mt-3">
          {/* key로 아티스트 전환 시 리마운트 — 안 그러면 업로드/삭제 에러 메시지가 다른 아티스트로 넘어가도 남음 */}
          <GalleryManager key={slug} artistSlug={slug} images={images} />
        </div>
      </div>
    </div>
  );
}
