import data from "@/data/artists.json";
import type { Artist } from "@/lib/types";

// 검증용 바인딩: JSON 필드 누락·타입 불일치 빌드에서 잡음
const artists: Artist[] = data.artists;

export function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return Response.json({ artists });
  const artist = artists.find((a) => a.slug === slug);
  if (!artist) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ artist });
}
