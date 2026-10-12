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
  edited: boolean; // (연출) 이 구간의 먼지·반사를 사용자가 고쳤는지 — "내가 수정함" 표시. 프리셋은 요소 전체
  propsEdited: boolean; // (연출) 소품(곡 전체)을 사용자가 고쳤는지
};

export type PanelAction =
  | { type: "mode"; mode: Mode }
  | { type: "fx"; fx: Backdrop }
  | { type: "image"; image: ImageRef }
  | { type: "dust" | "reflection"; dir: 1 | -1 }
  | { type: "prop"; key: PropKey }
  | { type: "resetElements" } // 연출: 선택한 구간의 먼지·반사만 / 프리셋: 요소 전체
  | { type: "resetProps" }
  | { type: "applyAll" }; // 연출: 이 구간의 효과/이미지를 모든 구간에 (프리셋엔 없음) // 연출: 곡 전체 소품의 사용자 값만

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

// 이 구간의 배경 상태: 구간 이미지 > 구간 효과 > AI 제안
export const sectionMode = (edit: SceneEdit | null, i: number): Mode => {
  const m = edit?.sections?.[i];
  return m?.image ? "image" : m?.backdrop ? "fx" : "auto";
};

// 구간 i 에 사용자가 먼지·반사를 고쳤는지 (구간 목록의 "수정함" 표시용)
export const sectionEdited = (edit: SceneEdit | null, i: number): boolean => edit?.sections?.[i]?.dust != null || edit?.sections?.[i]?.reflection != null;

// 사용자 값이 섞인 최종 요소 값. 이미지 URL 은 필요 없다(요소 값만 본다).
const effective = (edit: SceneEdit | null, c: EditCtx) =>
  resolveScene({ index: c.index, item: c.item, energyRatio: c.energyRatio, aiProps: c.aiProps, edit });

export function editView(edit: SceneEdit | null, c: EditCtx): PanelView {
  const r = effective(edit, c);
  const mine = edit?.sections?.[c.index];
  return {
    mode: sectionMode(edit, c.index),
    fx: mine?.backdrop ?? DEFAULT_FX,
    image: mine?.image ?? null,
    dust: r.dust,
    reflection: r.reflection,
    props: r.props,
    edited: mine?.dust != null || mine?.reflection != null,
    propsEdited: edit?.props !== undefined,
  };
}

// null·undefined 키를 걷어 낸다. 남는 게 없으면 null (서버는 구간 원소를 null 이거나 유효한 객체로만 받는다)
function cleanSection(sec: SectionScene | null | undefined): SectionScene | null {
  if (!sec) return null;
  const out: SectionScene = {};
  if (sec.backdrop != null) out.backdrop = sec.backdrop;
  if (sec.image != null) out.image = sec.image;
  if (sec.dust != null) out.dust = sec.dust;
  if (sec.reflection != null) out.reflection = sec.reflection;
  return Object.keys(out).length ? out : null;
}

// 빈 구간을 치워서 아무것도 안 고친 상태는 항상 null 이 되게 한다.
// 연출 전체 모드(edit.backdrop)는 UI 가 더 이상 쓰지 않으므로 항상 버린다(예전 값은 migrateLegacy 가 구간으로 옮긴다).
export function tidy(edit: SceneEdit): SceneEdit | null {
  const out: SceneEdit = { ...edit };
  delete out.backdrop;
  if (out.sections) {
    out.sections = out.sections.map(cleanSection);
    if (out.sections.every((s) => s == null)) delete out.sections;
  }
  return Object.keys(out).length ? out : null;
}

// 예전 형식(edit.backdrop = 연출 전체 모드)을 구간별 값으로 바꾼다: 구간에 값이 없는 구간에만 복사하고 backdrop 키는 버린다.
export function migrateLegacy(edit: SceneEdit | null, sectionCount: number): SceneEdit | null {
  const b = edit?.backdrop;
  if (!edit || !b) return edit;
  if (b.mode === "auto") return tidy(edit);
  const sections = Array.from({ length: sectionCount }, (_, i) => {
    const mine = edit.sections?.[i] ?? null;
    if (mine?.image || mine?.backdrop) return mine;
    return { ...mine, ...(b.mode === "fx" ? { backdrop: b.fx } : { image: b.image }) };
  });
  return tidy({ ...edit, sections });
}

// 지운 업로드 이미지를 가리키는 모든 구간(과 예전 형식 backdrop)에서 참조를 걷어 낸다 (그 구간은 AI 제안으로 돌아간다)
export function dropImageRefs(edit: SceneEdit | null, path: string): SceneEdit | null {
  if (!edit) return edit;
  const hit = (r: ImageRef | null | undefined) => r?.kind === "upload" && r.path === path;
  const next: SceneEdit = { ...edit };
  if (edit.backdrop?.mode === "image" && hit(edit.backdrop.image)) delete next.backdrop;
  if (edit.sections) next.sections = edit.sections.map((s) => (s && hit(s.image) ? { ...s, image: null } : s));
  return tidy(next);
}

// 이미지가 있는 구간이 하나라도 업로드 이미지를 쓰는지 (목록을 미리 받아 둘지 정하는 데 쓴다)
export const usesUpload = (edit: SceneEdit | null): boolean => !!edit?.sections?.some((s) => s?.image?.kind === "upload");

export function reduceEdit(edit: SceneEdit | null, a: PanelAction, c: EditCtx): SceneEdit | null {
  const next: SceneEdit = { ...edit };
  const list = () => Array.from({ length: c.sectionCount }, (_, i) => edit?.sections?.[i] ?? null);
  // 선택한 구간 하나만 patch (null 값은 그 키를 지운다)
  const setSection = (patch: SectionScene) => {
    const l = list();
    l[c.index] = { ...l[c.index], ...patch };
    next.sections = l;
  };
  const mine = edit?.sections?.[c.index];
  const cur = effective(edit, c);
  switch (a.type) {
    case "mode":
      if (a.mode === "auto") setSection({ backdrop: null, image: null });
      else if (a.mode === "fx") setSection({ backdrop: mine?.backdrop ?? DEFAULT_FX, image: null });
      else setSection({ image: mine?.image ?? firstSample(), backdrop: null });
      break;
    case "fx":
      if (a.fx !== "none") setSection({ backdrop: a.fx, image: null });
      break;
    case "image":
      setSection({ image: a.image, backdrop: null });
      break;
    case "applyAll": {
      // 선택한 구간의 효과/이미지를 모든 구간에 복사(먼지·반사는 각자 유지). AI 제안 상태면 할 일이 없다.
      if (!mine?.backdrop && !mine?.image) break;
      next.sections = list().map((s) => ({ ...s, backdrop: mine.backdrop ?? null, image: mine.image ?? null }));
      break;
    }
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
      setSection({ dust: null, reflection: null }); // 배경(효과·이미지)은 그대로 둔다
      break;
    case "resetProps":
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
    propsEdited: false,
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
    case "resetProps":
      return { ...s, props: [] };
    case "applyAll":
      return s;
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
