import Link from "next/link";
import type { Artist } from "@/lib/types";

export default function ArtistSelect({
  artists,
  current,
  basePath = "/staff/dashboard",
  dark = false,
}: {
  artists: Artist[];
  current: string;
  basePath?: string;
  dark?: boolean;
}) {
  const active = dark
    ? "bg-brand/20 font-medium text-white ring-1 ring-brand"
    : "bg-brand/10 font-medium text-gray-900 ring-1 ring-brand";
  const idle = dark
    ? "text-white/60 hover:bg-white/10 hover:text-white"
    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900";

  return (
    <nav aria-label="아티스트 선택" className="flex flex-wrap gap-1.5">
      {artists.map((a) => {
        const isActive = a.slug === current;
        return (
          <Link
            key={a.slug}
            href={`${basePath}?artist=${a.slug}`}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm ${
              isActive ? active : idle
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
