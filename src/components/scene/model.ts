// 배경 설정 패널의 순수 로직: 값 → 화면용 view, 동작(action) → 새 값, 렌더 값 참조 재사용 비교.
// 컴포넌트 밖에 둔 이유: reducer 모양이라 테스트하기 쉽고, 연출(SceneEdit)과 프리셋(PresetScene) 두 곳이 같은 패널을 쓴다.
import {
  PROP_KEYS,
  SAMPLE_IMAGES,
  resolveScene,
  type Backdrop,
  type Effect,
  type ImageRef,
  type PresetScene,
  type PropKey,
  type RenderScene,
  type SceneEdit,
  type SectionScene,
} from "@/lib/stage/scene";

export type Mode = "auto" | "fx" | "image";

export type PanelView = {
  mode: Mode;
  fx: Backdrop; // 3D 효과 탭에서 고른 값 (프리셋은 "none" = 없음 포함)
  image: ImageRef | null;
  dust: number;
  reflection: number;
  props: PropKey[];
  edited: boolean; // 요소(먼지·반사·소품)를 사용자가 고쳤는지 — "내가 수정함" 표시
};

export type PanelAction =
  | { type: "mode"; mode: Mode }
  | { type: "fx"; fx: Backdrop }
  | { type: "image"; image: ImageRef }
  | { type: "dust" | "reflection"; dir: 1 | -1 }
  | { type: "prop"; key: PropKey }
  | { type: "resetElements" };

export const FX_LABELS: Record<Backdrop, string> = {
  bars: "음악 막대",
  tunnel: "3D 터널",
  laser: "레이저 부채",
  gyro: "자이로 링 (3D)",
  cube: "회전 큐브 (3D)",
  none: "없음",
};
export const PROP_LABELS: Record<PropKey, string> = { amp: "앰프", drum: "드럼 단", mic: "마이크 스탠드" };

export const LEVEL_STEP = 10;

// 10 단위로 한 칸 이동. AI 값이 47 처럼 10 의 배수가 아니면 가장 가까운 눈금으로 붙는다.
export function stepLevel(v: number, dir: 1 | -1): number {
  const next = dir > 0 ? (Math.floor(v / LEVEL_STEP) + 1) * LEVEL_STEP : (Math.ceil(v / LEVEL_STEP) - 1) * LEVEL_STEP;
  return Math.min(100, Math.max(0, next));
}

const DEFAULT_FX: Effect = "gyro";
const firstSample = (): ImageRef => ({ kind: "sample", id: SAMPLE_IMAGES[0].id });
const toggleProp = (props: PropKey[], key: PropKey) => PROP_KEYS.filter((k) => (k === key ? !props.includes(k) : props.includes(k)));

// ── 연출(SceneEdit): 구간 하나를 편집 ───────────────────────────────────────────────
export type EditCtx = {
  index: number;
  sectionCount: number;
  item: SectionScene;
  energyRatio: number;
  aiProps: PropKey[] | null;
};

// 사용자 값이 섞인 최종 요소 값. 이미지는 URL 이 필요 없어 null 로 둔다.
const effective = (edit: SceneEdit | null, c: EditCtx) =>
  resolveScene({ index: c.index, item: c.item, energyRatio: c.energyRatio, aiProps: c.aiProps, edit, imageUrl: null });

export function editView(edit: SceneEdit | null, c: EditCtx): PanelView {
  const r = effective(edit, c);
  const b = edit?.backdrop;
  const mine = edit?.sections?.[c.index];
  return {
    mode: b?.mode ?? "auto",
    fx: b?.mode === "fx" ? b.fx : DEFAULT_FX,
    image: b?.mode === "image" ? b.image : null,
    dust: r.dust,
    reflection: r.reflection,
    props: r.props,
    edited: mine?.dust != null || mine?.reflection != null || edit?.props !== undefined,
  };
}

// 빈 키·전부 null 인 sections 를 치워서, 아무것도 안 고친 상태는 항상 null 이 되게 한다
export function tidy(edit: SceneEdit): SceneEdit | null {
  const out: SceneEdit = { ...edit };
  if (out.sections && out.sections.every((s) => s == null)) delete out.sections;
  if (out.backdrop?.mode === "auto") delete out.backdrop;
  return Object.keys(out).length ? out : null;
}

export function reduceEdit(edit: SceneEdit | null, a: PanelAction, c: EditCtx): SceneEdit | null {
  const next: SceneEdit = { ...edit };
  const setSection = (patch: SectionScene | null) => {
    const list = Array.from({ length: c.sectionCount }, (_, i) => edit?.sections?.[i] ?? null);
    list[c.index] = patch === null ? null : { ...list[c.index], ...patch };
    next.sections = list;
  };
  const cur = effective(edit, c);
  switch (a.type) {
    case "mode":
      if (a.mode === "auto") delete next.backdrop;
      else if (a.mode === "fx") {
        const fx = editView(edit, c).fx;
        next.backdrop = { mode: "fx", fx: fx === "none" ? DEFAULT_FX : fx };
      }
      else next.backdrop = { mode: "image", image: edit?.backdrop?.mode === "image" ? edit.backdrop.image : firstSample() };
      break;
    case "fx":
      if (a.fx !== "none") next.backdrop = { mode: "fx", fx: a.fx };
      break;
    case "image":
      next.backdrop = { mode: "image", image: a.image };
      break;
    case "dust":
      setSection({ dust: stepLevel(cur.dust, a.dir) });
      break;
    case "reflection":
      setSection({ reflection: stepLevel(cur.reflection, a.dir) });
      break;
    case "prop":
      next.props = toggleProp(cur.props, a.key);
      break;
    case "resetElements":
      setSection(null);
      delete next.props;
      break;
  }
  return tidy(next);
}

// ── 프리셋(PresetScene): 구간이 없는 단일 값 ─────────────────────────────────────────
export function presetView(s: PresetScene): PanelView {
  return {
    mode: s.image ? "image" : "fx",
    fx: s.backdrop,
    image: s.image,
    dust: s.dust,
    reflection: s.reflection,
    props: s.props,
    edited: s.dust !== 0 || s.reflection !== 0 || s.props.length > 0,
  };
}

export function reducePreset(s: PresetScene, a: PanelAction): PresetScene {
  switch (a.type) {
    case "mode":
      return a.mode === "image" ? { ...s, image: s.image ?? firstSample() } : { ...s, image: null };
    case "fx":
      return { ...s, backdrop: a.fx, image: null };
    case "image":
      return { ...s, image: a.image };
    case "dust":
      return { ...s, dust: stepLevel(s.dust, a.dir) };
    case "reflection":
      return { ...s, reflection: stepLevel(s.reflection, a.dir) };
    case "prop":
      return { ...s, props: toggleProp(s.props, a.key) };
    case "resetElements":
      return { ...s, dust: 0, reflection: 0, props: [] };
  }
}

// 지운 업로드 이미지를 쓰던 프리셋 장면은 이미지 없이(효과로) 되돌린다
export function dropPresetImage(s: PresetScene, path: string): PresetScene {
  return s.image?.kind === "upload" && s.image.path === path ? { ...s, image: null } : s;
}

// ── 렌더 값 참조 재사용 ─────────────────────────────────────────────────────────────
// 값이 같은데 새 객체가 가면 MemoScene 이 다시 그려져 webglcontextlost 위험이 있다. 그래서 필드로 비교한다.
export function sameScene(a: RenderScene, b: RenderScene): boolean {
  return (
    a.backdrop === b.backdrop &&
    a.dust === b.dust &&
    a.reflection === b.reflection &&
    a.imageUrl === b.imageUrl &&
    a.activity === b.activity &&
    a.props.length === b.props.length &&
    a.props.every((p, i) => p === b.props[i])
  );
}

// 버튼 배경이 accent 일 때 읽히는 글자색: 밝으면 어두운 글자, 어두우면 흰 글자 (상대 휘도 근사)
export function onAccent(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#0B0B10";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.55 ? "#0B0B10" : "#FFFFFF";
}
