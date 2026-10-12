// 무대 연출 메뉴(/staff/stage) 패널의 순수 reducer. 저장값은 localStorage 쪽에 있고, 여기서는 "열어서 고치는 중인 값(draft)"만 다룬다.
// gen(패널 세대)은 열고 닫을 때마다 올라간다 — 업로드를 시작한 세대와 달라지면 결과를 버린다(재생 화면 패널과 같은 규칙).
import { dropPresetImage, reducePreset, type Mode, type PanelAction } from "@/components/scene/model";
import type { PresetScene } from "@/lib/stage/scene";

export type StudioState = { draft: PresetScene | null; gen: number; tab: Mode }; // tab = 보고 있는 탭(값과 별개) // draft 가 있으면 패널이 열려 있다

export type StudioEvent =
  | { type: "open"; saved: PresetScene }
  | { type: "panel"; action: PanelAction }
  | { type: "tab"; tab: Mode }
  | { type: "close" } // 취소·적용 모두 draft 를 닫는다 (적용은 호출자가 먼저 저장한다)
  | { type: "uploaded"; path: string; gen: number }
  | { type: "imageRemoved"; path: string };

export const initStudio: StudioState = { draft: null, gen: 0, tab: "fx" };

export function studioReducer(s: StudioState, ev: StudioEvent): StudioState {
  switch (ev.type) {
    case "open":
      return s.draft ? s : { draft: ev.saved, gen: s.gen + 1, tab: ev.saved.image ? "image" : "fx" };
    case "tab":
      return s.draft ? { ...s, tab: ev.tab } : s;
    case "panel":
      return s.draft ? { ...s, draft: reducePreset(s.draft, ev.action) } : s;
    case "close":
      return { ...s, draft: null, gen: s.gen + 1 };
    case "uploaded":
      if (!s.draft || ev.gen !== s.gen) return s;
      return { ...s, draft: { ...s.draft, image: { kind: "upload", path: ev.path } } };
    case "imageRemoved":
      return s.draft ? { ...s, draft: dropPresetImage(s.draft, ev.path) } : s;
  }
}
