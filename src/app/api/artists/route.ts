import { getArtist, getArtists } from "@/lib/data";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return Response.json({ artists: await getArtists() });
  const artist = await getArtist(slug);
  if (!artist) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ artist });
}
