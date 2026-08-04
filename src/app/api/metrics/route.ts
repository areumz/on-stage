import { DEFAULT_METRICS_SLUG, getMetrics } from "@/lib/data";

export function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? DEFAULT_METRICS_SLUG;
  const metrics = getMetrics(slug);
  if (!metrics) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(metrics);
}
