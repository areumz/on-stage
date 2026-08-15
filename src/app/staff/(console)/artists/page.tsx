import { notFound } from "next/navigation";
import ArtistSelect from "@/components/staff/ArtistSelect";
import GalleryManager from "@/components/staff/GalleryManager";
import { DEFAULT_METRICS_SLUG, getArtist, getArtists, getGalleryImages } from "@/lib/data";

export default async function StaffArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).artist;
  const slug = typeof raw === "string" ? raw : DEFAULT_METRICS_SLUG;
  const [artists, artist, images] = await Promise.all([getArtists(), getArtist(slug), getGalleryImages(slug)]);
  if (!artist) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">아티스트</h1>
          <p className="mt-1 text-sm text-gray-600">{artist.name} 갤러리 관리</p>
        </div>
        <ArtistSelect artists={artists} current={slug} basePath="/staff/artists" />
      </div>

      <div className="mt-8">
        {/* key로 아티스트 전환 시 리마운트 — 안 그러면 업로드/삭제 에러 메시지가 다른 아티스트로 넘어가도 남음 */}
        <GalleryManager key={slug} artistSlug={slug} images={images} />
      </div>
    </div>
  );
}
