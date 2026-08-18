import Link from "next/link";
import { notFound } from "next/navigation";
import ArtistSelect from "@/components/staff/ArtistSelect";
import { DEFAULT_METRICS_SLUG, getArtist, getArtists, getShowStatusList } from "@/lib/data";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = params.artist;
  const slug = typeof raw === "string" ? raw : DEFAULT_METRICS_SLUG;
  // 편집 상태가 없는 조회 전용 화면이라 정렬도 클라이언트 상태(useState) 대신 URL 쿼리로 처리
  const sortDir = params.sort === "desc" ? "desc" : "asc";
  const [artists, artist, showsRaw] = await Promise.all([getArtists(), getArtist(slug), getShowStatusList(slug)]);
  if (!artist) notFound();

  const shows = sortDir === "asc" ? showsRaw : [...showsRaw].reverse();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">티켓 현황</h1>
          <p className="mt-1 text-sm text-gray-600">{artist.name} 공연별 판매율 · 조회 전용</p>
        </div>
        <ArtistSelect artists={artists} current={slug} basePath="/staff/tickets" />
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-gray-200 bg-surface-2">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-200 text-xs font-semibold text-gray-700">
            <tr>
              <th className="px-4 py-3">
                <Link
                  href={`/staff/tickets?artist=${slug}&sort=${sortDir === "asc" ? "desc" : "asc"}`}
                  aria-label={sortDir === "asc" ? "날짜 내림차순으로 정렬" : "날짜 오름차순으로 정렬"}
                  className="flex items-center gap-1 hover:text-gray-900"
                >
                  날짜 <span aria-hidden>{sortDir === "asc" ? "▲" : "▼"}</span>
                </Link>
              </th>
              <th className="px-4 py-3">도시</th>
              <th className="px-4 py-3">베뉴</th>
              <th className="px-4 py-3">정원</th>
              <th className="px-4 py-3">판매량</th>
              <th className="px-4 py-3">예매율</th>
            </tr>
          </thead>
          <tbody>
            {shows.map((s) => (
              <tr key={s.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3">{s.show_date}</td>
                <td className="px-4 py-3">{s.city_name}</td>
                <td className="px-4 py-3">{s.venue}</td>
                <td className="px-4 py-3">{s.capacity.toLocaleString()}</td>
                <td className="px-4 py-3">{s.sold.toLocaleString()}</td>
                <td className="px-4 py-3">{Math.round(s.rate * 100)}%</td>
              </tr>
            ))}
            {shows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  등록된 공연이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
