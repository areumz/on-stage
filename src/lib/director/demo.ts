// 데모 곡: 미리 분석되고 미리 승인된 예시 시퀀스를 AI 를 부르지 않고 재생한다.
// 데이터는 src/data/director/ 의 JSON(시드 곡 분석 결과 + 규칙 기반 예시 시퀀스)이다.
// 곡 이름·음원 경로는 demos.json 한 곳에서 정하고, scripts/seed-director.mjs 도 같은 파일을 읽는다.
import demos from "@/data/director/demos.json";
import burnAnalysis from "@/data/director/Burn-it-up.json";
import burnSequence from "@/data/director/Burn-it-up.sequence.json";
import smallAnalysis from "@/data/director/Small-universe.json";
import smallSequence from "@/data/director/Small-universe.sequence.json";
import type { SequenceItem } from "@/lib/python/contract";
import { parseProps, type PropKey } from "@/lib/stage/scene";

type DemoMeta = (typeof demos)[number];

export type Demo = {
  slug: string;
  title: string;
  storagePath: string;
  artistSlug: string;
  durationSec: number;
  items: SequenceItem[];
  energyCurve: number[];
  aiProps: PropKey[] | null; // 시퀀스 JSON 의 result.props (AI 제안 소품, 없으면 null)
};

// JSON import 는 literal 타입으로 좁혀져 SequenceItem 과 바로 맞지 않는다. 모양은 sequenceValidate 로 테스트가 보장한다.
const DATA: Record<string, { analysis: { durationSec: number; analysis: { energyCurve: number[] } }; items: SequenceItem[]; props: unknown }> = {
  "Burn-it-up": { analysis: burnAnalysis, items: burnSequence.result.items as unknown as SequenceItem[], props: (burnSequence.result as { props?: unknown }).props },
  "Small-universe": { analysis: smallAnalysis, items: smallSequence.result.items as unknown as SequenceItem[], props: (smallSequence.result as { props?: unknown }).props },
};

function toDemo(meta: DemoMeta): Demo | undefined {
  const data = DATA[meta.file];
  if (!data) return undefined;
  return {
    slug: meta.slug,
    title: meta.title,
    storagePath: meta.storagePath,
    artistSlug: meta.artistSlug,
    durationSec: data.analysis.durationSec,
    items: data.items,
    energyCurve: data.analysis.analysis.energyCurve,
    aiProps: parseProps(data.props),
  };
}

export function listDemos(): { slug: string; title: string }[] {
  return demos.map(({ slug, title }) => ({ slug, title }));
}

export function getDemo(slug: string): Demo | undefined {
  const meta = demos.find((d) => d.slug === slug);
  return meta ? toDemo(meta) : undefined;
}
