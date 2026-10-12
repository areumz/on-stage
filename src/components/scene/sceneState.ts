// 재생 화면 장면 상태의 순수 reducer. 패널 열기·취소·저장·이미지 업로드/삭제가 서로 어긋나지 않게 한곳에서 정한다.
// gen(패널 세대)은 패널을 열고 닫을 때마다 올라간다 — 업로드를 시작한 세대와 달라지면 결과를 버린다.
import { dropImageRefs, migrateLegacy, reduceEdit, type EditCtx, type PanelAction } from "@/components/scene/model";
import type { SceneEdit } from "@/lib/stage/scene";

export type SceneState = {
  saved: SceneEdit | null; // 마지막으로 저장된 값 (취소하면 여기로 복귀)
  edit: SceneEdit | null; // 지금 3D 에 보이는 값 (패널을 연 채 미리보기)
  open: boolean;
  gen: number;
  index: number; // 패널을 열 때 고정한 구간 (재생이 흘러가도 편집 대상은 그대로)
  saving: boolean;
  error: string | null;
};

export type SceneEvent =
  | { type: "open"; index: number }
  | { type: "section"; index: number }
  | { type: "panel"; action: PanelAction; ctx: EditCtx }
  | { type: "resetAll" }
  | { type: "cancel" }
  | { type: "saving" }
  | { type: "saved"; data: SceneEdit | null }
  | { type: "saveFailed"; message: string }
  | { type: "uploaded"; path: string; gen: number; ctx: EditCtx }
  | { type: "imageRemoved"; path: string };

// 예전 형식(연출 전체 배경)은 열자마자 구간별 값으로 바꿔 둔다 — 이후 UI 는 구간 값만 다룬다
export const initScene = (initial: SceneEdit | null, sectionCount: number): SceneState => {
  const edit = migrateLegacy(initial, sectionCount);
  return { saved: edit, edit, open: false, gen: 0, index: 0, saving: false, error: null };
};

export function sceneReducer(s: SceneState, ev: SceneEvent): SceneState {
  switch (ev.type) {
    case "open":
      return s.open ? s : { ...s, open: true, gen: s.gen + 1, index: ev.index, error: null };
    case "section": // 패널 안에서 편집할 구간을 고른다 (재생 위치와 무관)
      return s.open ? { ...s, index: ev.index } : s;
    case "panel":
      return s.open && !s.saving ? { ...s, edit: reduceEdit(s.edit, ev.action, ev.ctx) } : s;
    case "resetAll":
      return s.open && !s.saving ? { ...s, edit: null } : s;
    case "cancel":
      return s.saving ? s : { ...s, edit: s.saved, open: false, gen: s.gen + 1, error: null };
    case "saving":
      return { ...s, saving: true, error: null };
    case "saved":
      return { ...s, saved: ev.data, edit: ev.data, open: false, saving: false, gen: s.gen + 1, error: null };
    case "saveFailed":
      return { ...s, saving: false, error: ev.message };
    case "uploaded":
      // 닫힌 패널·다른 세대의 업로드 결과가 3D 에 적용되면 안 된다
      if (!s.open || s.saving || ev.gen !== s.gen) return s;
      // 업로드한 이미지는 패널 안에서 편집 중인 구간의 배경으로 고른다
      return { ...s, edit: reduceEdit(s.edit, { type: "image", image: { kind: "upload", path: ev.path } }, ev.ctx) };
    case "imageRemoved":
      return { ...s, saved: dropImageRefs(s.saved, ev.path), edit: dropImageRefs(s.edit, ev.path) };
  }
}
