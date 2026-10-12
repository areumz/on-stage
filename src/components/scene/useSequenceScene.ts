"use client";

import { useCallback, useMemo, useReducer } from "react";
import { useBackdropImages, useStableScene } from "@/components/scene/hooks";
import { FX_LABELS, type Mode, editView, sectionEdited, sectionMode, usesUpload, type EditCtx, type PanelAction } from "@/components/scene/model";
import { initScene, sceneReducer } from "@/components/scene/sceneState";
import type { SceneSettingsProps } from "@/components/scene/SceneSettingsPanel";
import { useAutoDismiss } from "@/lib/hooks";
import { labelKo } from "@/lib/director/labels";
import { formatTime } from "@/lib/director/playback";
import { saveSceneEdit, sceneErrorKo, sequenceImagesUrl } from "@/lib/director/sceneApi";
import type { SequenceItem } from "@/lib/python/contract";
import { resolveScene, sampleSrc, sectionEnergyRatios, type ImageRef, type PropKey, type RenderScene, type SceneEdit } from "@/lib/stage/scene";

type Input = {
  sequenceId: string | null; // null = 데모 곡: 서버에 저장하지 않고 이 화면에서만 유지
  items: SequenceItem[];
  energyCurve: number[];
  aiProps: PropKey[] | null;
  initialEdit: SceneEdit | null;
  index: number; // 지금 재생 중인 구간
};

// 재생 화면의 장면 상태. 상태 전이는 sceneReducer(순수, 테스트됨)가 정하고 여기선 서버 호출과 값 계산만 한다.
export function useSequenceScene({ sequenceId, items, energyCurve, aiProps, initialEdit, index }: Input) {
  const [s, send] = useReducer(sceneReducer, null, () => initScene(initialEdit, items.length));
  const ratios = useMemo(() => sectionEnergyRatios(energyCurve, items), [energyCurve, items]);
  const uploads = useBackdropImages(sequenceId ? sequenceImagesUrl(sequenceId) : null, s.open || usesUpload(s.edit));
  // 구간 이미지의 URL: 샘플은 정적 경로, 내 이미지는 목록(path → 서명 URL)에서 찾고 없으면 null(효과로 폴백)
  const imageUrlFor = (ref: ImageRef): string | null => (ref.kind === "sample" ? sampleSrc(ref.id) : (uploads.images.find((m) => m.path === ref.path)?.url ?? null));

  const ctxAt = (i: number): EditCtx => ({ index: i, sectionCount: items.length, item: items[i], energyRatio: ratios[i], aiProps });
  // 패널이 열려 있으면 3D 미리보기도 선택한 구간 장면으로 보여 준다(그리는 값만 바뀌고 오디오·재생 위치·무대 상태는 건드리지 않는다).
  // 닫으면 다시 재생 구간을 따라간다.
  const panelIndex = s.open ? s.index : index;
  const scene: RenderScene = useStableScene(resolveScene({ ...ctxAt(panelIndex), edit: s.edit, imageUrlFor }));
  const panelCtx = ctxAt(panelIndex);

  // 이 구간이 고른 내 이미지의 URL 을 받기 전·못 찾았을 때는 효과(AI 제안)로 보이니 이유를 알려 준다
  const mineImg = s.edit?.sections?.[panelIndex]?.image;
  let imageNote: string | null = null;
  if (mineImg?.kind === "upload" && !imageUrlFor(mineImg)) {
    imageNote = uploads.loaded ? "고른 내 이미지를 찾을 수 없어 AI 제안으로 보여요" : uploads.loadFailed ? "내 이미지를 불러오지 못했어요" : "내 이미지를 불러오는 중…";
  }

  const close = () => uploads.clearError();
  // 안내는 몇 초 뒤 저절로 사라진다 (setter 는 항상 같은 참조여야 한다)
  const clearNotice = useCallback(() => send({ type: "clearNotice" }), []);
  useAutoDismiss(s.notice, clearNotice, null, 4000);

  async function apply() {
    if (uploads.busy) return;
    if (!sequenceId) {
      send({ type: "saved", data: s.edit });
      return close();
    }
    send({ type: "saving" });
    const r = await saveSceneEdit(sequenceId, s.edit, items.length);
    if (!r.ok) return send({ type: "saveFailed", message: sceneErrorKo(r.error) });
    send({ type: "saved", data: r.data });
    close();
  }

  async function onUpload(file: File) {
    const gen = s.gen; // 시작한 패널 세대. 그 사이 닫히면 결과를 적용하지 않는다
    const name = labelKo(items[panelCtx.index].sectionLabel);
    const ctx = panelCtx; // 올리기 시작한 구간 — 그 사이 다른 구간을 골라도 이 구간의 배경이 된다
    const path = await uploads.upload(file);
    if (path) send({ type: "uploaded", path, gen, ctx, name });
  }

  async function onRemove(path: string) {
    if (await uploads.remove(path)) send({ type: "imageRemoved", path });
  }

  const panel: Omit<SceneSettingsProps, "title" | "accent"> = {
    variant: "sequence",
    tabs: ["auto", "fx", "image"],
    view: editView(s.edit, panelCtx),
    dispatch: (action: PanelAction) => send({ type: "panel", action, ctx: panelCtx }),
    sectionLabel: labelKo(items[panelIndex].sectionLabel),
    sections: items.map((it, i) => ({ name: labelKo(it.sectionLabel), label: `${labelKo(it.sectionLabel)} · ${formatTime(it.startSec)}`, edited: sectionEdited(s.edit, i), mode: sectionMode(s.edit, i) })),
    sectionIndex: panelIndex,
    tab: s.tab,
    onTab: (tab: Mode) => send({ type: "tab", tab }),
    onSection: (i: number) => send({ type: "section", index: i }),
    aiCurrent: FX_LABELS[resolveScene({ ...panelCtx, edit: null }).backdrop],
    aiRows: items.map((it, i) => ({
      label: `${labelKo(it.sectionLabel)} · ${formatTime(it.startSec)}`,
      what: FX_LABELS[resolveScene({ ...ctxAt(i), edit: null }).backdrop],
    })),
    uploads: sequenceId ? uploads : null,
    onUpload,
    onRemove,
    imageNote,
    notice: s.notice,
    note: sequenceId ? undefined : "데모 곡은 저장되지 않아요",
    saving: s.saving,
    error: s.error,
    onApply: apply,
    onCancel: () => {
      if (uploads.busy) return;
      send({ type: "cancel" });
      close();
    },
    onResetAll: s.edit ? () => send({ type: "resetAll" }) : undefined,
  };

  return { scene, open: s.open, openPanel: () => send({ type: "open", index }), panel, imageNote };
}
