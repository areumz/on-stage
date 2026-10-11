// 무대 장면 확장: 배경(backdrop)·먼지(dust)·바닥 반사(reflection)·소품(props).
// StageState 와 따로 둔다 — Python 계약이 state 밖에 두었고, stage_presets.state 의 모양을 지키기 위해서다.
// 이 파일은 순수 함수만 둔다(서버·클라이언트 공용, 렌더링 코드 없음).

export const BACKDROPS = ["bars", "tunnel", "laser", "gyro", "cube", "none"] as const;
export type Backdrop = (typeof BACKDROPS)[number];
export type Effect = Exclude<Backdrop, "none">; // "3D 효과" 모드에서 고르는 값

export const PROP_KEYS = ["amp", "drum", "mic"] as const;
export type PropKey = (typeof PROP_KEYS)[number];

// 샘플 이미지: public/backdrops/<id>.svg
export const SAMPLE_IMAGES = [
  { id: "neon-city", label: "네온 도시" },
  { id: "galaxy", label: "은하수" },
  { id: "stage-lights", label: "무대 조명" },
] as const;
export type SampleId = (typeof SAMPLE_IMAGES)[number]["id"];
export const sampleSrc = (id: SampleId) => `/backdrops/${id}.svg`;

export const UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;
export const UPLOAD_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
// 제품 한도는 두지 않는다(구간이 여러 개라 3장은 부족하다). 아래 값은 스토리지 남용을 막는 안전 상한일 뿐이다.
export const UPLOADS_PER_SEQUENCE = 50;
// 기존 "무대 연출" 메뉴는 연출(시퀀스)이 없어서 사용자 폴더의 고정 하위 폴더 <user_id>/studio/ 에 올린다.
export const STUDIO_FOLDER = "studio";
export const UPLOADS_PER_STUDIO = 50;

// 구간마다 붙는 선택 필드 (계약의 items[i].backdrop/dust/reflection). null·없음 = 정하지 않음
export type SectionScene = { backdrop?: Backdrop | null; dust?: number | null; reflection?: number | null };

export type ImageRef = { kind: "sample"; id: SampleId } | { kind: "upload"; path: string };

// 연출 전체의 배경 모드. auto = 구간마다 AI 제안(또는 자동 규칙)
export type BackdropSetting = { mode: "auto" } | { mode: "fx"; fx: Effect } | { mode: "image"; image: ImageRef };

// 사용자가 고친 값(stage_sequences.scene_edit). 키가 없으면 고치지 않은 것이라 AI 값을 쓴다.
export type SceneEdit = {
  backdrop?: BackdropSetting;
  sections?: (SectionScene | null)[]; // items 와 같은 길이
  props?: PropKey[];
};

// 기존 "무대 연출" 메뉴와 stage_presets.scene 에 쓰는 단일 장면(구간이 없다).
// image 는 샘플 또는 내 업로드(<user_id>/studio/…). 값이 있으면 backdrop 대신 이미지를 뒤 벽에 띄운다.
export type PresetScene = {
  backdrop: Backdrop;
  dust: number;
  reflection: number;
  props: PropKey[];
  image: ImageRef | null;
};

export const DEFAULT_PRESET_SCENE: PresetScene = { backdrop: "none", dust: 0, reflection: 0, props: [], image: null };

// StageScene 이 그리는 최종 값. 계산은 resolveScene / presetToRender 에서 끝낸다.
export type RenderScene = {
  backdrop: Backdrop;
  dust: number; // 0~100
  reflection: number; // 0~100
  props: PropKey[];
  imageUrl: string | null; // 있으면 뒤 벽에 이미지를 띄우고 backdrop 효과는 그리지 않는다
  activity: number; // 0~1, 효과의 속도·밝기 (잔잔 0 → 격함 1)
};

export const NO_SCENE: RenderScene = { backdrop: "none", dust: 0, reflection: 0, props: [], imageUrl: null, activity: 0.5 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// ── 파싱: 모르는 값·범위 밖 값은 에러 없이 null (계약과 같은 규칙) ──────────────────

export function parseBackdrop(v: unknown): Backdrop | null {
  return typeof v === "string" && (BACKDROPS as readonly string[]).includes(v) ? (v as Backdrop) : null;
}

export function parseLevel(v: unknown): number | null {
  return isNum(v) && v >= 0 && v <= 100 ? v : null;
}

// null 과 [] 는 뜻이 다르다: null = 정하지 않음, [] = 소품 없음. 배열이 아니면 null.
export function parseProps(v: unknown): PropKey[] | null {
  if (!Array.isArray(v)) return null;
  return PROP_KEYS.filter((k) => v.includes(k));
}

export function parseSectionScene(v: unknown): SectionScene | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const out: SectionScene = { backdrop: parseBackdrop(o.backdrop), dust: parseLevel(o.dust), reflection: parseLevel(o.reflection) };
  return out.backdrop === null && out.dust === null && out.reflection === null ? null : out;
}

function parseImage(v: unknown): ImageRef | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (o.kind === "sample" && SAMPLE_IMAGES.some((s) => s.id === o.id)) return { kind: "sample", id: o.id as SampleId };
  // 경로는 서버가 소유자 폴더와 맞는지 따로 검사한다. 여기서는 모양만 본다.
  if (o.kind === "upload" && typeof o.path === "string" && o.path.length > 0 && o.path.length <= 200 && !o.path.includes("..")) {
    return { kind: "upload", path: o.path };
  }
  return null;
}

export function parseBackdropSetting(v: unknown): BackdropSetting | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (o.mode === "auto") return { mode: "auto" };
  if (o.mode === "fx") {
    const fx = parseBackdrop(o.fx);
    return fx && fx !== "none" ? { mode: "fx", fx } : null;
  }
  if (o.mode === "image") {
    const image = parseImage(o.image);
    return image ? { mode: "image", image } : null;
  }
  return null;
}

// 저장된 scene_edit 를 읽는다(DB 값이라 모양이 깨졌을 수 있다). 깨진 부분은 없는 것으로 본다.
export function parseSceneEdit(v: unknown, sectionCount: number): SceneEdit | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const out: SceneEdit = {};
  const backdrop = parseBackdropSetting(o.backdrop);
  if (backdrop) out.backdrop = backdrop;
  if (Array.isArray(o.sections) && o.sections.length === sectionCount) out.sections = o.sections.map(parseSectionScene);
  const props = parseProps(o.props);
  if (props) out.props = props;
  return Object.keys(out).length ? out : null;
}

export function parsePresetScene(v: unknown): PresetScene {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return DEFAULT_PRESET_SCENE;
  const o = v as Record<string, unknown>;
  // 예전 모양({ sampleImage: "<id>" })도 읽는다
  const legacy = SAMPLE_IMAGES.find((s) => s.id === o.sampleImage);
  return {
    backdrop: parseBackdrop(o.backdrop) ?? "none",
    dust: parseLevel(o.dust) ?? 0,
    reflection: parseLevel(o.reflection) ?? 0,
    props: parseProps(o.props) ?? [],
    image: parseImage(o.image) ?? (legacy ? { kind: "sample", id: legacy.id } : null),
  };
}

// ── 해석: 사용자 값 > AI 값 > 자동 규칙 ───────────────────────────────────────────

// 구간 평균 에너지 / 곡 평균 에너지 (Python 의 "에너지 비"와 같은 뜻). 계산할 수 없으면 1.
export function sectionEnergyRatios(energyCurve: number[] | null | undefined, sections: { startSec: number; endSec: number }[]): number[] {
  if (!energyCurve || energyCurve.length === 0) return sections.map(() => 1);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const total = mean(energyCurve);
  if (!(total > 0)) return sections.map(() => 1);
  return sections.map((s) => {
    const slice = energyCurve.slice(Math.max(0, Math.floor(s.startSec)), Math.max(Math.floor(s.startSec) + 1, Math.ceil(s.endSec)));
    return slice.length ? mean(slice) / total : 1;
  });
}

// AI 가 정하지 않았을 때의 자동 규칙(에너지 비 기준): 잔잔하면 느린 자이로, 중간이면 막대, 격하면 레이저
export function autoBackdrop(ratio: number): Backdrop {
  return ratio < 0.9 ? "gyro" : ratio <= 1.1 ? "bars" : "laser";
}
export const autoDust = (ratio: number) => Math.round(clamp(ratio * 50, 10, 90));
export const autoReflection = (ratio: number) => Math.round(clamp(ratio * 45, 10, 85));
export const autoActivity = (ratio: number) => clamp((ratio - 0.4) / 1.2, 0, 1);
export const DEFAULT_PROPS: PropKey[] = ["mic"]; // AI 도 사용자도 정하지 않았을 때

export type ResolveInput = {
  index: number;
  item: SectionScene; // items[index] 의 선택 필드 (없으면 {})
  energyRatio: number;
  aiProps: PropKey[] | null; // stage_sequences.props
  edit: SceneEdit | null; // stage_sequences.scene_edit
  imageUrl: string | null; // edit.backdrop 이 image 일 때 호출자가 만든 URL (샘플은 sampleSrc, 업로드는 서명 URL)
};

export function resolveScene(i: ResolveInput): RenderScene {
  const mine = i.edit?.sections?.[i.index] ?? null;
  const setting = i.edit?.backdrop ?? { mode: "auto" as const };
  const ai = {
    backdrop: i.item.backdrop ?? autoBackdrop(i.energyRatio),
    dust: i.item.dust ?? autoDust(i.energyRatio),
    reflection: i.item.reflection ?? autoReflection(i.energyRatio),
  };
  let backdrop: Backdrop = mine?.backdrop ?? ai.backdrop;
  let imageUrl: string | null = null;
  if (setting.mode === "fx") backdrop = setting.fx;
  else if (setting.mode === "image" && i.imageUrl) {
    imageUrl = i.imageUrl;
    backdrop = "none";
  }
  return {
    backdrop,
    dust: mine?.dust ?? ai.dust,
    reflection: mine?.reflection ?? ai.reflection,
    props: i.edit?.props ?? i.aiProps ?? DEFAULT_PROPS,
    imageUrl,
    activity: autoActivity(i.energyRatio),
  };
}

// uploadUrl: image 가 내 업로드일 때 호출자가 만든 서명 URL. 못 만들었으면 이미지 없이 backdrop 효과로 그린다.
export function presetToRender(s: PresetScene, uploadUrl: string | null = null): RenderScene {
  const imageUrl = s.image?.kind === "sample" ? sampleSrc(s.image.id) : s.image?.kind === "upload" ? uploadUrl : null;
  return {
    backdrop: imageUrl ? "none" : s.backdrop,
    dust: s.dust,
    reflection: s.reflection,
    props: s.props,
    imageUrl,
    activity: 0.5,
  };
}
