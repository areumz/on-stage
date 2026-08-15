import { DEFAULT_METRICS_SLUG, getMetrics } from "@/lib/data";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? DEFAULT_METRICS_SLUG;
  const metrics = await getMetrics(slug);
  if (!metrics) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(metrics);
}
