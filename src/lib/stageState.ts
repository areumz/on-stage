export type SpotState = { on: boolean; intensity: number; angle: number; penumbra: number };

export type StageState = {
  color: string;
  spots: { left: SpotState; center: SpotState; right: SpotState };
  camera: "front" | "audience" | "top";
  smoke: { density: number; color: string };
};

const CAMERAS: StageState["camera"][] = ["front", "audience", "top"];

const DEFAULT_SPOT: SpotState = { on: true, intensity: 300, angle: 0.45, penumbra: 0.6 };

export function defaultStageState(color: string): StageState {
  return {
    color,
    spots: {
      left: { ...DEFAULT_SPOT },
      center: { ...DEFAULT_SPOT },
      right: { ...DEFAULT_SPOT, on: false },
    },
    camera: "front",
    smoke: { density: 0, color: "#ffffff" },
  };
}

function isCamera(value: unknown): value is StageState["camera"] {
  return typeof value === "string" && (CAMERAS as string[]).includes(value);
}

function mergeSpot(value: unknown, fallback: SpotState): SpotState {
  if (typeof value !== "object" || value === null) return fallback;
  const v = value as Record<string, unknown>;
  return {
    on: typeof v.on === "boolean" ? v.on : fallback.on,
    intensity: typeof v.intensity === "number" ? v.intensity : fallback.intensity,
    angle: typeof v.angle === "number" ? v.angle : fallback.angle,
    penumbra: typeof v.penumbra === "number" ? v.penumbra : fallback.penumbra,
  };
}

function mergeSpots(value: unknown, fallback: StageState["spots"]): StageState["spots"] {
  if (typeof value !== "object" || value === null) return fallback;
  const v = value as Record<string, unknown>;
  return {
    left: mergeSpot(v.left, fallback.left),
    center: mergeSpot(v.center, fallback.center),
    right: mergeSpot(v.right, fallback.right),
  };
}

function mergeSmoke(value: unknown, fallback: StageState["smoke"]): StageState["smoke"] {
  if (typeof value !== "object" || value === null) return fallback;
  const v = value as Record<string, unknown>;
  return {
    density: typeof v.density === "number" ? v.density : fallback.density,
    color: typeof v.color === "string" ? v.color : fallback.color,
  };
}

// localStorage/Supabase에 저장된 값을 StageState로 복원. 필드별로 있고 타입이 맞으면 그 값을,
// 아니면 fallback의 값을 쓴다 — 필드 하나가 없거나 모양이 달라도 나머지는 유지된다(design-v2.md §5.1).
export function mergeStageState(value: unknown, fallback: StageState): StageState {
  if (typeof value !== "object" || value === null) return fallback;
  const v = value as Record<string, unknown>;
  return {
    color: typeof v.color === "string" ? v.color : fallback.color,
    spots: mergeSpots(v.spots, fallback.spots),
    camera: isCamera(v.camera) ? v.camera : fallback.camera,
    smoke: mergeSmoke(v.smoke, fallback.smoke),
  };
}

// localStorage(문자열)용 얇은 래퍼. mergeStageState 자체는 Supabase 프리셋 로드(이미 파싱된
// JSONB 객체)에도 그대로 재사용한다 — 파싱 경로가 둘이어도 병합 규칙은 하나.
export function parseStageState(raw: string | null, fallback: StageState): StageState {
  if (!raw) return fallback;
  try {
    return mergeStageState(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  }
}
