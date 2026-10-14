// 재생 화면 장면 상태의 순수 reducer. 패널 열기·취소·저장·이미지 업로드/삭제가 서로 어긋나지 않게 한곳에서 정한다.
// gen(패널 세대)은 패널을 열고 닫을 때마다 올라간다 — 업로드를 시작한 세대와 달라지면 결과를 버린다.
import { dropImageRefs, migrateLegacy, reduceEdit, sectionMode, type EditCtx, type Mode, type PanelAction } from "@/components/scene/model";
import type { SceneEdit } from "@/lib/stage/scene";

export type SceneState = {
  saved: SceneEdit | null; // 마지막으로 저장된 값 (취소하면 여기로 복귀)
  edit: SceneEdit | null; // 지금 3D 에 보이는 값 (패널을 연 채 미리보기)
  open: boolean;
  gen: number;
  tab: Mode; // 패널에서 보고 있는 탭. 보기일 뿐이라 탭을 바꿔도 값은 그대로이고, 구간을 고르면 그 구간의 실제 상태로 맞춘다
  index: number; // 패널을 열 때 고정한 구간 (재생이 흘러가도 편집 대상은 그대로)
  saving: boolean;
  error: string | null;
  notice: string | null; // 짧은 안내(예: 다른 구간을 보는 동안 업로드가 끝난 경우)
};

export type SceneEvent =
  | { type: "open"; index: number }
  | { type: "section"; index: number }
  | { type: "tab"; tab: Mode }
  | { type: "panel"; action: PanelAction; ctx: EditCtx }
  | { type: "resetAll" }
  | { type: "cancel" }
  | { type: "saving" }
  | { type: "saved"; data: SceneEdit | null }
  | { type: "saveFailed"; message: string }
  | { type: "uploaded"; path: string; gen: number; ctx: EditCtx; name: string } // name = 시작한 구간 이름
  | { type: "clearNotice" }
  | { type: "imageRemoved"; path: string };

// 예전 형식(연출 전체 배경)은 열자마자 구간별 값으로 바꿔 둔다 — 이후 UI 는 구간 값만 다룬다
export const initScene = (initial: SceneEdit | null, sectionCount: number): SceneState => {
  const edit = migrateLegacy(initial, sectionCount);
  return { saved: edit, edit, open: false, gen: 0, tab: "auto", index: 0, saving: false, error: null, notice: null };
};

export function sceneReducer(s: SceneState, ev: SceneEvent): SceneState {
  switch (ev.type) {
    case "open":
      return s.open ? s : { ...s, open: true, gen: s.gen + 1, index: ev.index, tab: sectionMode(s.edit, ev.index), error: null, notice: null };
    case "section": // 패널 안에서 편집할 구간을 고른다 (재생 위치와 무관)
      return s.open ? { ...s, index: ev.index, tab: sectionMode(s.edit, ev.index) } : s;
    case "tab":
      return s.open ? { ...s, tab: ev.tab } : s;
    case "panel":
      return s.open && !s.saving ? { ...s, edit: reduceEdit(s.edit, ev.action, ev.ctx) } : s;
    case "resetAll":
      return s.open && !s.saving ? { ...s, edit: null } : s;
    case "cancel":
      return s.saving ? s : { ...s, edit: s.saved, open: false, gen: s.gen + 1, error: null, notice: null };
    case "saving":
      return { ...s, saving: true, error: null };
    case "saved":
      return { ...s, saved: ev.data, edit: ev.data, open: false, saving: false, gen: s.gen + 1, error: null, notice: null };
    case "saveFailed":
      return { ...s, saving: false, error: ev.message };
    case "uploaded":
      // 닫힌 패널·다른 세대의 업로드 결과가 3D 에 적용되면 안 된다
      if (!s.open || s.saving || ev.gen !== s.gen) return s;
      // 업로드한 이미지는 패널 안에서 편집 중인 구간의 배경으로 고른다
      return {
        ...s,
        edit: reduceEdit(s.edit, { type: "image", image: { kind: "upload", path: ev.path } }, ev.ctx),
        // 지금 보는 구간이 아니면 어디에 들어갔는지 알려 준다
        notice: ev.ctx.index === s.index ? null : `${ev.name} 구간에 이미지를 넣었어요`,
      };
    case "clearNotice":
      return s.notice ? { ...s, notice: null } : s;
    case "imageRemoved":
      return { ...s, saved: dropImageRefs(s.saved, ev.path), edit: dropImageRefs(s.edit, ev.path) };
  }
}
