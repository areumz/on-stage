import Link from "next/link";
import type { Artist } from "@/lib/types";

// 링크 기반이라 클라이언트 컴포넌트가 아니다 — 선택은 URL(?artist=)로 표현되고
// 서버 컴포넌트인 대시보드가 그 slug로 지표를 다시 가져온다.
export default function ArtistSelect({ artists, current }: { artists: Artist[]; current: string }) {
  return (
    <nav aria-label="아티스트 선택" className="flex flex-wrap gap-1.5">
      {artists.map((a) => {
        const active = a.slug === current;
        return (
          <Link
            key={a.slug}
            href={`/staff/dashboard?artist=${a.slug}`}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm ${
              active
                ? "bg-brand/10 font-medium text-gray-900 ring-1 ring-brand"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
            {a.name}
          </Link>
        );
      })}
    </nav>
  );
}
