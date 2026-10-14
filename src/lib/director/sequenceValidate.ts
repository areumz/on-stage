// 승인된 시퀀스를 저장하기 전에 on-stage 가 다시 검증한다 (계약서 §4.5, 부록 A 의 불변식).
// 경계 비교에는 ±0.001초 허용 오차를 둔다 — Python 게이트와 같은 오차를 쓰지 않으면
// Python 이 통과시킨 시퀀스가 여기서 거절될 수 있다.
import type { SequenceItem } from "@/lib/python/contract";
import { parseBackdrop, parseLevel } from "@/lib/stage/scene";
import { defaultStageState, mergeStageState } from "@/lib/stageState";

const EPS = 0.001;

export type ValidateResult = { ok: true; items: SequenceItem[] } | { ok: false; reason: string };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function validateSequence(items: unknown, durationSec: number, fallbackColor: string): ValidateResult {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, reason: "items 가 비어 있다" };

  const fallback = defaultStageState(fallbackColor);
  const out: SequenceItem[] = [];

  for (const [i, raw] of items.entries()) {
    const it = raw as Record<string, unknown> | null;
    if (!it || typeof it !== "object" || typeof it.sectionLabel !== "string") return { ok: false, reason: `${i}번 항목 모양이 잘못됐다` };
    const { startSec, endSec, transitionMs } = it;
    if (!isNum(startSec) || !isNum(endSec) || !isNum(transitionMs)) return { ok: false, reason: `${i}번 항목의 시간 값이 숫자가 아니다` };
    if (!(startSec < endSec)) return { ok: false, reason: `${i}번 항목은 startSec < endSec 여야 한다` };
    // 계약서는 이 값에 허용 오차를 두지 않는다(±0.001초는 구간 경계에만). 부동소수점 잡음만 봐준다.
    if (transitionMs < 0 || transitionMs > (endSec - startSec) * 1000 + 1e-6) {
      return { ok: false, reason: `${i}번 항목의 transitionMs 가 0 ~ 구간 길이 범위를 벗어났다` };
    }
    out.push({
      sectionLabel: it.sectionLabel,
      startSec,
      endSec,
      transitionMs,
      // 깨진 필드는 기본 상태로 채워 저장한다 — 재생 화면이 깨진 값을 만나지 않게 한다
      state: mergeStageState(it.state, fallback),
      rationale: typeof it.rationale === "string" ? it.rationale : "",
      // 선택 필드: 허용값이 아니면 에러 없이 null (계약 부록 G)
      backdrop: parseBackdrop(it.backdrop),
      dust: parseLevel(it.dust),
      reflection: parseLevel(it.reflection),
    });
  }

  if (Math.abs(out[0].startSec) > EPS) return { ok: false, reason: "첫 항목은 0초에서 시작해야 한다" };
  if (Math.abs(out[out.length - 1].endSec - durationSec) > EPS) return { ok: false, reason: "마지막 항목은 곡 길이에서 끝나야 한다" };
  for (let i = 0; i < out.length - 1; i++) {
    if (Math.abs(out[i].endSec - out[i + 1].startSec) > EPS) return { ok: false, reason: `${i}번과 ${i + 1}번 항목 사이가 이어지지 않는다` };
  }
  return { ok: true, items: out };
}
