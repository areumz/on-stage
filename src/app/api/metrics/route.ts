import data from "@/data/metrics.json";
import type { Metrics } from "@/lib/types";

// 검증용 바인딩: JSON의 필드 누락·타입 불일치를 빌드에서 잡는다.
// (초과 필드는 잡지 못한다 — TS의 excess property check는 객체 리터럴에만 적용됨)
const metrics: Metrics = data;

export function GET() {
  return Response.json(metrics);
}
