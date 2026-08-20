import { notFound } from "next/navigation";
import ArtistSelect from "@/components/staff/ArtistSelect";
import ToursManager from "@/components/staff/ToursManager";
import { DEFAULT_METRICS_SLUG, getArtist, getArtists, getKnownLocations, getShows, getStaffRole } from "@/lib/data";

export default async function ToursPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).artist;
  const slug = typeof raw === "string" ? raw : DEFAULT_METRICS_SLUG;
  const [artists, artist, shows, knownLocations, { isOwner }] = await Promise.all([
    getArtists(),
    getArtist(slug),
    getShows(slug),
    getKnownLocations(),
    getStaffRole(),
  ]);
  if (!artist) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">투어 일정</h1>
          <p className="mt-1 text-sm text-gray-600">{artist.name} 공연 관리</p>
        </div>
        <ArtistSelect artists={artists} current={slug} basePath="/staff/tours" />
      </div>

      <div className="mt-8">
        <ToursManager key={slug} artistSlug={slug} shows={shows} knownLocations={knownLocations} isOwner={isOwner} />
      </div>
    </div>
  );
}
