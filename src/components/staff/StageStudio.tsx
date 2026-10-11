"use client";

import { useMemo, useReducer, useRef, useState } from "react";
import SceneSettingsPanel from "@/components/scene/SceneSettingsPanel";
import { useBackdropImages } from "@/components/scene/hooks";
import { presetView, dropPresetImage, type PanelAction } from "@/components/scene/model";
import { initStudio, studioReducer } from "@/components/scene/studioState";
import StageControls from "@/components/staff/StageControls";
import StageScene from "@/components/three/StageScene";
import { useSceneSnapshot, useStageStateSnapshot, writeScene, writeStageState } from "@/lib/hooks";
import { STUDIO_IMAGES_URL } from "@/lib/director/sceneApi";
import { UPLOADS_PER_STUDIO, parsePresetScene, presetToRender, type PresetScene } from "@/lib/stage/scene";
import { defaultStageState, parseStageState, type StageState } from "@/lib/stageState";
import type { Artist } from "@/lib/types";

export default function StageStudio({
  artists,
  slug,
  defaultColor,
}: {
  artists: Artist[];
  slug: string;
  defaultColor: string;
}) {
  const saved = useStageStateSnapshot(slug);
  const state = parseStageState(saved, defaultStageState(defaultColor));
  const [sheetOpen, setSheetOpen] = useState(false);
  const sceneButtonRef = useRef<HTMLButtonElement>(null); // 패널을 닫을 때 포커스를 돌려줄 버튼

  // 장면(배경·먼지·반사·소품)은 stage-state 와 따로 저장한다. 파싱 결과는 저장값이 바뀔 때만 새로 만든다.
  const sceneRaw = useSceneSnapshot(slug);
  const savedScene = useMemo(() => {
    try {
      return parsePresetScene(sceneRaw ? JSON.parse(sceneRaw) : null);
    } catch {
      return parsePresetScene(null); // 깨진 저장값은 기본값으로
    }
  }, [sceneRaw]);
  // 패널을 연 동안은 draft 가 바로 3D 에 반영되고, 적용해야 저장된다. 취소하면 버린다.
  const [studio, send] = useReducer(studioReducer, initStudio);
  const draft = studio.draft;
  const scene = draft ?? savedScene;

  // 내 이미지(서명 URL 은 이 상태에만 둔다. localStorage·프리셋에는 path 만 저장). 프리셋을 불러올 때 지워진 이미지를 걸러 내려고 늘 목록을 받는다.
  const uploads = useBackdropImages(STUDIO_IMAGES_URL, true, UPLOADS_PER_STUDIO);
  const upload = scene.image?.kind === "upload" ? scene.image : null;
  const uploadUrl = upload ? (uploads.images.find((m) => m.path === upload.path)?.url ?? null) : null;
  // URL 이 없으면 효과로 그려지니 이유를 알려 준다
  const imageNote = upload && !uploadUrl ? (uploads.loaded ? "고른 내 이미지를 찾을 수 없어요" : uploads.loadFailed ? "내 이미지를 불러오지 못했어요" : "내 이미지를 불러오는 중…") : null;
  const renderScene = useMemo(() => presetToRender(scene, uploadUrl), [scene, uploadUrl]);

  function handleChange(next: StageState) {
    writeStageState(slug, JSON.stringify(next));
  }
  const saveScene = (next: PresetScene) => writeScene(slug, JSON.stringify(next));

  async function onUpload(file: File) {
    const gen = studio.gen; // 시작한 패널 세대. 그 사이 닫히면 결과를 적용하지 않는다
    const path = await uploads.upload(file);
    if (path) send({ type: "uploaded", path, gen });
  }

  async function onRemove(path: string) {
    if (!(await uploads.remove(path))) return;
    send({ type: "imageRemoved", path });
    saveScene(dropPresetImage(savedScene, path)); // 저장된 장면이 이 이미지를 쓰고 있었으면 효과로 되돌린다
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="relative flex-1 overflow-hidden">
        <StageScene state={state} scene={renderScene} />
        {imageNote && <p role="status" className="absolute bottom-10 left-6 text-xs text-white/70">{imageNote}</p>}
        <p className="absolute bottom-4 left-6 text-xs tracking-[0.2em] text-white/40">
          DRAG TO ORBIT · SCROLL TO ZOOM
        </p>
        {/* md 미만에서만 뜨는 토글 — 시트가 열리면 뒤로 가려지므로 열려 있을 땐 렌더하지 않음 */}
        {!sheetOpen && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="absolute bottom-4 right-4 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white md:hidden"
          >
            조정하기
          </button>
        )}
      </div>

      {sheetOpen && (
        <button type="button" aria-label="조정 패널 닫기" className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setSheetOpen(false)} />
      )}

      <div
        className={`${sheetOpen ? "block" : "hidden"} fixed inset-x-0 bottom-0 z-30 max-h-[75vh] overflow-y-auto md:contents`}
      >
        <StageControls
          artists={artists}
          artistSlug={slug}
          state={state}
          onChange={handleChange}
          scene={savedScene}
          onSceneChange={saveScene}
          onOpenScene={() => send({ type: "open", saved: savedScene })}
          hasUpload={(path) => !uploads.loaded || uploads.images.some((m) => m.path === path)}
          sceneButtonRef={sceneButtonRef}
        />
      </div>
      {draft && (
        <SceneSettingsPanel
          variant="preset"
          title={`${artists.find((a) => a.slug === slug)?.name ?? ""} 무대 연출`}
          accent={defaultColor}
          returnFocusRef={sceneButtonRef}
          tabs={["fx", "image"]}
          view={presetView(draft)}
          dispatch={(action: PanelAction) => send({ type: "panel", action })}
          uploads={uploads}
          onUpload={onUpload}
          onRemove={onRemove}
          imageNote={imageNote}
          saving={false}
          error={null}
          onApply={() => {
            if (uploads.busy) return;
            saveScene(draft);
            uploads.clearError();
            send({ type: "close" });
          }}
          onCancel={() => {
            if (uploads.busy) return;
            uploads.clearError();
            send({ type: "close" });
          }}
        />
      )}
    </div>
  );
}
