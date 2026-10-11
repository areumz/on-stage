"use client";

import { useMemo, useReducer } from "react";
import { useBackdropImages, useStableScene } from "@/components/scene/hooks";
import { FX_LABELS, editView, type EditCtx, type PanelAction } from "@/components/scene/model";
import { initScene, sceneReducer } from "@/components/scene/sceneState";
import type { SceneSettingsProps } from "@/components/scene/SceneSettingsPanel";
import { labelKo } from "@/lib/director/labels";
import { formatTime } from "@/lib/director/playback";
import { saveSceneEdit, sceneErrorKo, sequenceImagesUrl } from "@/lib/director/sceneApi";
import type { SequenceItem } from "@/lib/python/contract";
import { resolveScene, sampleSrc, sectionEnergyRatios, type PropKey, type RenderScene, type SceneEdit } from "@/lib/stage/scene";

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
  const [s, send] = useReducer(sceneReducer, initialEdit, initScene);
  const ratios = useMemo(() => sectionEnergyRatios(energyCurve, items), [energyCurve, items]);
  const img = s.edit?.backdrop?.mode === "image" ? s.edit.backdrop.image : null;
  const uploads = useBackdropImages(sequenceId ? sequenceImagesUrl(sequenceId) : null, s.open || img?.kind === "upload");

  let imageUrl: string | null = null;
  if (img?.kind === "sample") imageUrl = sampleSrc(img.id);
  else if (img) imageUrl = uploads.images.find((m) => m.path === img.path)?.url ?? null;

  // 저장된 업로드 이미지의 URL 을 받기 전·못 찾았을 때는 AI 제안 장면으로 보이니 이유를 알려 준다
  let imageNote: string | null = null;
  if (img?.kind === "upload" && !imageUrl) {
    imageNote = uploads.loaded ? "고른 내 이미지를 찾을 수 없어 AI 제안으로 보여요" : uploads.loadFailed ? "내 이미지를 불러오지 못했어요" : "내 이미지를 불러오는 중…";
  }

  const ctxAt = (i: number): EditCtx => ({ index: i, sectionCount: items.length, item: items[i], energyRatio: ratios[i], aiProps });
  // 3D 는 지금 재생 구간 기준, 패널의 "요소" 는 열 때 고정한 구간 기준
  const scene: RenderScene = useStableScene(resolveScene({ ...ctxAt(index), edit: s.edit, imageUrl }));
  const panelIndex = s.open ? s.index : index;
  const panelCtx = ctxAt(panelIndex);

  const close = () => uploads.clearError();

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
    const path = await uploads.upload(file);
    if (path) send({ type: "uploaded", path, gen });
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
    aiRows: items.map((it, i) => ({
      label: `${labelKo(it.sectionLabel)} · ${formatTime(it.startSec)}`,
      what: FX_LABELS[resolveScene({ ...ctxAt(i), edit: null, imageUrl: null }).backdrop],
    })),
    uploads: sequenceId ? uploads : null,
    onUpload,
    onRemove,
    imageNote,
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
