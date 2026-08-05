export type StageState = {
  color: string;
  spots: { left: boolean; center: boolean; right: boolean };
  angle: "front" | "audience" | "top";
};

const STAGE_ANGLES: StageState["angle"][] = ["front", "audience", "top"];

export function defaultStageState(color: string): StageState {
  return { color, spots: { left: true, center: true, right: false }, angle: "front" };
}

function isStageState(value: unknown): value is StageState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.color !== "string") return false;
  if (typeof v.angle !== "string" || !STAGE_ANGLES.includes(v.angle as StageState["angle"])) return false;
  const spots = v.spots;
  if (typeof spots !== "object" || spots === null) return false;
  const s = spots as Record<string, unknown>;
  return typeof s.left === "boolean" && typeof s.center === "boolean" && typeof s.right === "boolean";
}

// localStorage에 저장된 문자열을 StageState로 복원. 저장값이 없거나, JSON이 깨졌거나,
// 파싱은 되지만 모양이 다르면(예: 예전 스키마로 남은 값) fallback.
export function parseStageState(raw: string | null, fallback: StageState): StageState {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return isStageState(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
