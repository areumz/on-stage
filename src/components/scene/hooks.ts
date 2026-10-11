"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sameScene } from "@/components/scene/model";
import { deleteBackdropImage, listBackdropImages, precheckImage, uploadBackdropImage, uploadErrorKo, type BackdropImage } from "@/lib/director/sceneApi";
import { UPLOADS_PER_SEQUENCE, type RenderScene } from "@/lib/stage/scene";

// 값이 같으면 이전 참조를 그대로 돌려준다 — 렌더 중 setState 는 React 가 허용하는 "파생 상태" 패턴이다.
export function useStableScene(next: RenderScene): RenderScene {
  const [kept, setKept] = useState(next);
  if (kept !== next && !sameScene(kept, next)) setKept(next);
  return kept;
}

export type Uploads = {
  images: BackdropImage[];
  busy: boolean; // 업로드·삭제 중
  error: string | null;
  upload: (file: File) => Promise<string | null>; // 성공하면 새 이미지 path
  remove: (path: string) => Promise<boolean>; // 성공했을 때만 true
  clearError: () => void;
  loaded: boolean; // 목록을 한 번이라도 받았는지
  loadFailed: boolean; // 목록을 못 받음
  full: boolean;
  refresh: () => void; // 서명 URL 이 만료됐을 때(썸네일 로드 실패) 새로 받기
};

// 내가 올린 배경 이미지(url = 연출별 또는 내 무대 연출용 이미지 API 주소). enabled 가 true 가 될 때(패널을 열거나 업로드 이미지를 쓰는 연출) 목록을 받는다.
// 서명 URL 은 images 상태에만 있고 문구·로그·저장소로 보내지 않는다.
export function useBackdropImages(url: string | null, enabled: boolean, limit: number = UPLOADS_PER_SEQUENCE): Uploads {
  const [images, setImages] = useState<BackdropImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // 서명 GET URL 은 1시간 뒤 만료된다. 재생 화면을 오래 켜 둬도 3D 텍스처가 깨지지 않게 45분마다 새로 받는다.
  useEffect(() => {
    if (!url || !enabled) return;
    let cancelled = false;
    const load = (first: boolean) =>
      listBackdropImages(url).then((r) => {
        if (cancelled) return;
        if (r.ok) {
          setImages(r.data);
          setLoaded(true);
          setLoadFailed(false);
        } else if (first) setLoadFailed(true);
      });
    load(true);
    const timer = setInterval(() => load(false), 45 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [url, enabled]);

  const lastReload = useRef(0);
  const reload = useCallback(() => {
    if (!url || Date.now() - lastReload.current < 10000) return; // 실패가 반복돼도 10초에 한 번만
    lastReload.current = Date.now();
    listBackdropImages(url).then((r) => r.ok && setImages(r.data));
  }, [url]);

  const refresh = useCallback(async (id: string) => {
    const r = await listBackdropImages(id);
    if (r.ok) setImages(r.data);
    return r.ok;
  }, []);

  const upload = useCallback(
    async (file: File) => {
      if (!url) return null;
      const problem = precheckImage(file);
      if (problem) {
        setError(problem);
        return null;
      }
      setBusy(true);
      setError(null);
      const r = await uploadBackdropImage(url, file);
      if (!r.ok) {
        setError(uploadErrorKo(r.error));
        setBusy(false);
        return null;
      }
      if (!(await refresh(url))) setError("올린 이미지를 불러오지 못했어요");
      setBusy(false);
      return r.data.path;
    },
    [url, refresh],
  );

  const remove = useCallback(
    async (path: string) => {
      if (!url) return false;
      setBusy(true);
      setError(null);
      const r = await deleteBackdropImage(url, path);
      if (r.ok) setImages((xs) => xs.filter((x) => x.path !== path));
      else setError("이미지를 지우지 못했어요. 다시 시도해 주세요");
      setBusy(false);
      return r.ok;
    },
    [url],
  );

  const clearError = useCallback(() => setError(null), []);

  return { images, busy, error, upload, remove, clearError, loaded, loadFailed, full: images.length >= limit, refresh: reload };
}
