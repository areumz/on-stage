"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useConfirm } from "@/components/staff/ConfirmDialog";
import { FX_LABELS, PROP_LABELS, onAccent, stepLevel, type Mode, type PanelAction, type PanelView } from "@/components/scene/model";
import type { Uploads } from "@/components/scene/hooks";
import { PROP_KEYS, SAMPLE_IMAGES, sampleSrc, type Backdrop, type ImageRef } from "@/lib/stage/scene";

const MODE_LABEL: Record<Mode, string> = { auto: "AI 제안", fx: "3D 효과", image: "이미지" };
const PINK = "#D4537E";
const ACCEPT = "image/jpeg,image/png,image/webp";
const SEQ_FX: Backdrop[] = ["bars", "tunnel", "laser", "gyro", "cube"];
const PRESET_FX: Backdrop[] = [...SEQ_FX, "none"];

export type SceneSettingsProps = {
  variant: "sequence" | "preset"; // 연출(구간별, AI 제안 있음) / 무대 연출 메뉴(단일 값)
  title: string; // 곡·연출 이름
  accent: string;
  tabs: Mode[];
  view: PanelView;
  dispatch: (a: PanelAction) => void;
  sectionLabel?: string; // "요소 · {구간} 구간"
  sections?: { label: string; edited: boolean; mode: Mode }[]; // 연출: 구간 선택 줄 (프리셋은 없음)
  sectionIndex?: number;
  onSection?: (i: number) => void;
  aiCurrent?: string; // 선택한 구간의 AI 제안 효과 이름
  aiRows?: { label: string; what: string }[]; // 구간별 AI 제안 개요 (눌러서 그 구간으로 이동)
  uploads?: Uploads | null; // null·없음 = 업로드 숨김(데모, 프리셋)
  onUpload?: (file: File) => Promise<void>; // 업로드 + 성공 시 선택은 호출자가 세대 토큰으로 처리한다
  onRemove?: (path: string) => Promise<void>;
  imageNote?: string | null; // 고른 내 이미지를 아직 못 불러왔을 때 안내
  returnFocusRef?: RefObject<HTMLElement | null>; // 닫을 때 포커스를 돌려줄 버튼 (Safari 등에선 activeElement 가 body 일 수 있다)
  note?: string; // 패널 안 한 줄 안내(데모)
  saving: boolean;
  error: string | null;
  onApply: () => void;
  onCancel: () => void;
  onResetAll?: () => void; // 연출 전체를 AI 제안으로 되돌리기 (저장된 사용자 값이 있을 때만 전달)
};

const same = (a: ImageRef | null, b: ImageRef) => !!a && (a.kind === "sample" ? b.kind === "sample" && a.id === b.id : b.kind === "upload" && a.path === b.path);

export default function SceneSettingsPanel(p: SceneSettingsProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const uid = useId();
  const { view, accent, uploads } = p;

  const { confirm, dialog } = useConfirm();
  const [announce, setAnnounce] = useState(""); // 사용자가 ± 를 눌렀을 때만 읽어 주는 알림
  const memory = useRef<{ idx?: number; fx?: Backdrop; image?: ImageRef }>({ idx: p.sectionIndex, fx: view.mode === "fx" ? view.fx : undefined, image: view.image ?? undefined }); // 탭을 오가도 (구간별로) 마지막 선택을 기억
  const blocked = p.saving || !!uploads?.busy; // 저장·업로드·삭제 중에는 닫기·적용을 막는다

  // 열릴 때 제목으로 포커스를 옮기고, 닫히면 열었던 버튼으로 돌려준다
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const returnTo = p.returnFocusRef;
    headingRef.current?.focus();
    return () => (returnTo?.current ?? opener)?.focus?.();
  }, [p.returnFocusRef]);

  // Esc: 포커스가 body 여도 닫히게 document 레벨로 듣는다. 확인창이 떠 있으면 그쪽이 먼저 쓴다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || blocked || document.querySelector('[aria-modal="true"]')) return;
      p.onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [blocked, p.onCancel]); // eslint-disable-line react-hooks/exhaustive-deps -- p 전체가 아니라 onCancel 만 쓴다

  function act(a: PanelAction) {
    if (memory.current.idx !== p.sectionIndex) memory.current = { idx: p.sectionIndex, fx: view.mode === "fx" ? view.fx : undefined, image: view.image ?? undefined }; // 구간이 바뀌면 그 구간 값부터
    if (a.type === "fx") memory.current.fx = a.fx;
    if (a.type === "image") memory.current.image = a.image;
    if (a.type === "dust" || a.type === "reflection") {
      const cur = a.type === "dust" ? view.dust : view.reflection;
      setAnnounce(`${a.type === "dust" ? "먼지" : "바닥 반사"} ${stepLevel(cur, a.dir)}%`);
    }
    if (a.type === "mode" && a.mode === "fx" && memory.current.fx) return p.dispatch({ type: "fx", fx: memory.current.fx });
    if (a.type === "mode" && a.mode === "image") {
      const m = memory.current.image;
      if (m && (m.kind === "sample" || uploads?.images.some((x) => x.path === m.path))) return p.dispatch({ type: "image", image: m });
    }
    p.dispatch(a);
  }

  const on = (selected: boolean) => ({
    borderColor: selected ? accent : "rgba(255,255,255,0.12)",
    background: selected ? `${accent}22` : "rgba(255,255,255,0.04)",
  });
  const tile = "relative flex w-full flex-col items-start gap-1.5 rounded-xl border p-1.5 text-left text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-brand";
  const check = <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-black" aria-hidden>✓</span>;

  function onTabKey(e: React.KeyboardEvent, i: number) {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + p.tabs.length) % p.tabs.length;
    tabRefs.current[n]?.focus();
    act({ type: "mode", mode: p.tabs[n] });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일을 다시 골라도 change 가 오게
    if (!file || !p.onUpload) return;
    await p.onUpload(file);
    headingRef.current?.focus(); // 눌렀던 버튼이 비활성화돼도 포커스가 body 로 날아가지 않게
  }

  // 삭제는 되돌릴 수 없어서 먼저 묻는다. 삭제에 성공했을 때만 선택이 바뀐다(호출자가 최신 상태 기준으로 처리).
  async function onRemove(path: string) {
    if (!p.onRemove) return;
    if (!(await confirm(`삭제하면 되돌릴 수 없어요.${p.variant === "sequence" ? " 이 이미지를 쓰는 구간은 AI 제안으로 돌아가요." : ""}`, { title: "이 이미지를 삭제할까요?", confirmLabel: "삭제" }))) return;
    await p.onRemove(path);
    headingRef.current?.focus();
  }

  const fxList = p.variant === "sequence" ? SEQ_FX : PRESET_FX;
  const tag = view.edited ? "내가 수정함" : p.variant === "sequence" ? "AI 제안" : "기본값";
  const resetLabel = p.variant === "sequence" ? "이 구간만 AI 제안으로 되돌리기" : "기본값으로 되돌리기";
  const meters = [
    { key: "dust", label: "먼지", value: view.dust },
    { key: "reflection", label: "바닥 반사", value: view.reflection },
  ] as const;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${uid}-h`}
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[55dvh] flex-col rounded-t-2xl border border-white/10 bg-[#17171D] text-white shadow-2xl md:inset-x-auto md:bottom-4 md:right-4 md:top-4 md:max-h-none md:w-[460px] md:rounded-2xl"
    >
      <div className="shrink-0 px-5 pb-3 pt-4">
        <h2 id={`${uid}-h`} ref={headingRef} tabIndex={-1} className="text-xl font-bold outline-none">배경 설정</h2>
        <p className="mt-0.5 truncate text-sm text-white/60">{p.title}</p>
      </div>

      <fieldset disabled={p.saving} className="contents">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-3">
        {p.note && <p className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white">{p.note}</p>}
        {p.imageNote && <p role="status" className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white">{p.imageNote}</p>}
        <p role="status" className="sr-only">{announce}</p>

        <div role="tablist" aria-label="배경 모드" className="flex gap-2">
          {p.tabs.map((m, i) => (
            <button
              key={m}
              ref={(el) => { tabRefs.current[i] = el; }}
              type="button"
              role="tab"
              id={`${uid}-t-${m}`}
              aria-selected={view.mode === m}
              aria-controls={`${uid}-p`}
              tabIndex={view.mode === m ? 0 : -1}
              onClick={() => act({ type: "mode", mode: m })}
              onKeyDown={(e) => onTabKey(e, i)}
              style={on(view.mode === m)}
              className="min-h-10 flex-1 rounded-full border px-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-brand"
            >
              {view.mode === m && <span aria-hidden>✓ </span>}
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`${uid}-p`} aria-labelledby={`${uid}-t-${view.mode}`} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          {view.mode === "auto" && (
            <>
              <p className="text-[15px] font-bold">{p.aiCurrent ? `이 구간은 AI가 "${p.aiCurrent}"로 골랐어요` : "AI가 곡 분위기에 맞춰 먼저 골랐어요"}</p>
              <p className="text-[13px] leading-relaxed text-white/70">
                이 구간에는 AI 제안이 쓰여요. 마음에 들면 그대로 두고, 아니면 &quot;3D 효과&quot;나 &quot;이미지&quot;로 이 구간만 바꿀 수 있어요. 아래는 구간별 AI 제안이에요. 누르면 그 구간으로 이동해요.
              </p>
              <ul className="flex flex-col gap-2">
                {p.aiRows?.map((r, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      aria-pressed={p.sectionIndex === i}
                      onClick={() => p.onSection?.(i)}
                      className="flex min-h-10 w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-left text-[13px] focus-visible:outline-2 focus-visible:outline-brand"
                      style={p.sectionIndex === i ? { borderColor: accent } : undefined}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded" style={{ background: accent }} aria-hidden />
                      <span className="flex-1 truncate text-white/70">{p.sectionIndex === i ? "✓ " : ""}{r.label}</span>
                      <span className="font-semibold">{r.what}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {view.mode === "fx" && (
            <>
              <p className="text-[15px] font-bold">{p.variant === "sequence" ? "이 구간의 3D 효과를 골라요" : "3D 효과를 골라요"}</p>
              <p className="text-[13px] leading-relaxed text-white/70">
                {p.variant === "sequence" ? "고른 효과가 위에서 선택한 구간에 쓰여요. 잔잔한 구간은 느리고 어둡게, 시끄러운 구간은 빠르고 밝게 움직여요. 모든 구간에 쓰려면 아래 버튼을 눌러요." : "고른 효과가 뒤 벽에 쓰여요. 없음을 고르면 배경 없이 무대만 보여요."}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {fxList.map((f) => {
                  const sel = view.fx === f;
                  return (
                    <button key={f} type="button" aria-pressed={sel} onClick={() => act({ type: "fx", fx: f })} style={on(sel)} className={`${tile} min-h-10 p-2 text-[13px]`}>
                      <span className="h-12 w-full rounded-lg border border-white/10" style={{ background: fxThumb(f, accent) }} aria-hidden />
                      {FX_LABELS[f]}
                      {sel && check}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view.mode === "image" && (
            <>
              <p className="text-[15px] font-bold">이미지를 뒤 벽에 띄워요</p>
              <p className="text-[13px] leading-relaxed text-white/70">{uploads ? "샘플 이미지를 고르거나, 내 이미지를 올려 쓸 수 있어요." : "샘플 이미지를 골라요."}</p>
              <p className="text-[11px] font-semibold tracking-wide text-white/60">샘플 이미지</p>
              <div className="grid grid-cols-3 gap-2">
                {SAMPLE_IMAGES.map((s) => {
                  const ref: ImageRef = { kind: "sample", id: s.id };
                  const sel = same(view.image, ref);
                  return (
                    <button key={s.id} type="button" aria-pressed={sel} onClick={() => act({ type: "image", image: ref })} style={on(sel)} className={`${tile} min-h-10`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- 정적 SVG 썸네일이라 최적화 대상이 아니다 */}
                      <img src={sampleSrc(s.id)} alt="" className="h-14 w-full rounded-lg object-cover" />
                      {s.label}
                      {sel && check}
                    </button>
                  );
                })}
              </div>

              {uploads && (
                <>
                  <p className="mt-1 text-[11px] font-semibold tracking-wide text-white/60">내 이미지{uploads.images.length > 0 ? ` ${uploads.images.length}장` : ""}</p>
                  {/* 이미지가 많아질 수 있어 이 목록만 패널 안에서 따로 스크롤한다 */}
                  <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-0.5">
                    <button
                      type="button"
                      disabled={uploads.busy || uploads.full}
                      onClick={() => fileRef.current?.click()}
                      style={uploads.error ? { borderColor: PINK, background: `${PINK}14` } : undefined}
                      className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/25 bg-white/5 p-2 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      <span className="text-xl leading-none" aria-hidden>+</span>
                      {uploads.busy ? "처리 중…" : uploads.full ? "더 올릴 수 없어요" : "이미지 올리기"}
                    </button>
                    <input ref={fileRef} type="file" accept={ACCEPT} aria-label="내 이미지 파일 선택" className="sr-only" tabIndex={-1} onChange={onFile} />
                    {uploads.images.map((m) => {
                      const ref: ImageRef = { kind: "upload", path: m.path };
                      const sel = same(view.image, ref);
                      return (
                        <div key={m.path} className="flex flex-col">
                          <button type="button" aria-pressed={sel} onClick={() => act({ type: "image", image: ref })} style={on(sel)} className={`${tile} min-h-10`}>
                            {/* eslint-disable-next-line @next/next/no-img-element -- 서명 URL 이라 next/image 를 거치지 않는다 */}
                            <img src={m.url} alt="" onError={uploads.refresh} className="h-14 w-full rounded-lg object-cover" />
                            <span className="w-full truncate">{m.name}</span>
                            {sel && check}
                          </button>
                          {/* 삭제는 타일 밖(아래)에 둔다: 썸네일을 가리지 않고, 선택 ✓ 와 모서리가 겹치지 않는다 */}
                          <button
                            type="button"
                            aria-label={`${m.name} 삭제`}
                            disabled={uploads.busy}
                            onClick={() => onRemove(m.path)}
                            className="min-h-10 text-xs font-semibold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand"
                            style={{ color: PINK }}
                          >
                            × 삭제
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {(uploads.error || uploads.loadFailed) && (
                    <p role="alert" className="rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold leading-relaxed" style={{ color: PINK, borderColor: `${PINK}40`, background: `${PINK}1a` }}>
                      {uploads.error ?? "내 이미지를 불러오지 못했어요"}
                    </p>
                  )}
                  <p className="text-xs leading-relaxed text-white/60">5MB 이하 · jpg, png, webp · 내가 올린 이미지는 나만 볼 수 있어요. 저작권이 있는 이미지는 올리지 마세요.</p>
                </>
              )}
            </>
          )}
          {p.variant === "sequence" && (view.mode === "fx" || view.mode === "image") && (
            <button type="button" onClick={() => act({ type: "applyAll" })} className="min-h-10 self-start rounded-full border border-white/20 px-4 text-[13px] font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-brand">
              모든 구간에 적용
            </button>
          )}
        </div>

        {p.sections && (
          <div className="flex flex-col gap-1.5">
            <p id={`${uid}-sec`} className="text-[11px] font-semibold tracking-wide text-white/60">고칠 구간</p>
            <div role="group" aria-labelledby={`${uid}-sec`} className="flex flex-wrap gap-2">
              {p.sections.map((sec, i) => {
                const sel = p.sectionIndex === i;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={sel}
                    onClick={() => p.onSection?.(i)}
                    style={on(sel)}
                    className={`min-h-10 rounded-full border px-3.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-brand ${sel ? "text-white" : "text-white/70"}`}
                  >
                    {sel && <span aria-hidden>✓ </span>}
                    {sec.label}
                    {sec.mode !== "auto" && <span className="ml-1.5 text-[11px] font-normal text-white/60">{sec.mode === "fx" ? "효과" : "이미지"}</span>}
                    {sec.edited && (
                      <>
                        <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: "#E8A23B" }} aria-hidden />
                        <span className="sr-only"> (수정함)</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-bold">요소{p.sectionLabel ? ` · ${p.sectionLabel} 구간` : ""}</p>
            <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={view.edited ? { color: "#E8A23B", borderColor: "#E8A23B66" } : { color: "#4FD1A1", borderColor: "#4FD1A166" }}>
              {tag}
            </span>
          </div>
          {meters.map((m) => (
            <div key={m.key} className="flex items-center gap-2.5">
              <span className="w-16 shrink-0 text-[13px] text-white/70">{m.label}</span>
              <button type="button" aria-label={`${m.label} 줄이기`} disabled={m.value <= 0} onClick={() => act({ type: m.key, dir: -1 })} className="h-10 w-10 shrink-0 rounded-full border border-white/15 bg-white/5 text-lg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-brand">−</button>
              <div className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
                <div className="h-full" style={{ width: `${m.value}%`, background: accent }} />
              </div>
              <button type="button" aria-label={`${m.label} 늘리기`} disabled={m.value >= 100} onClick={() => act({ type: m.key, dir: 1 })} className="h-10 w-10 shrink-0 rounded-full border border-white/15 bg-white/5 text-lg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-brand">+</button>
              <span className="w-10 shrink-0 text-right text-[13px] tabular-nums">{m.value}%</span>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-[13px] text-white/70">소품</span>
            {p.variant === "sequence" && <span className="order-last w-full text-[11px] text-white/60">곡 전체에 적용돼요{view.propsEdited ? " · 내가 수정함" : ""}</span>}
            {PROP_KEYS.map((k) => {
              const sel = view.props.includes(k);
              return (
                <button key={k} type="button" aria-pressed={sel} onClick={() => act({ type: "prop", key: k })} style={on(sel)} className={`min-h-10 rounded-full border px-3.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-brand ${sel ? "text-white" : "text-white/60"}`}>
                  {sel && <span aria-hidden>✓ </span>}
                  {PROP_LABELS[k]}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4">
            <button type="button" onClick={() => act({ type: "resetElements" })} className="min-h-10 text-[13px] font-semibold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand" style={{ color: accent }}>
              {resetLabel}
            </button>
            {p.variant === "sequence" && view.propsEdited && (
              <button type="button" onClick={() => act({ type: "resetProps" })} className="min-h-10 text-[13px] font-semibold text-white/70 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand">
                소품도 AI 제안으로
              </button>
            )}
            {p.onResetAll && (
              <button type="button" onClick={p.onResetAll} disabled={p.saving} className="min-h-10 text-[13px] font-semibold text-white/60 underline-offset-2 hover:underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand">
                이 연출 전체를 AI 제안으로
              </button>
            )}
          </div>
        </div>
      </div>
      </fieldset>

      <div className="shrink-0 border-t border-white/10 px-5 py-3">
        {p.error && <p role="alert" className="mb-2 text-[13px] font-semibold" style={{ color: PINK }}>{p.error}</p>}
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={p.onCancel} disabled={blocked} className="min-h-11 rounded-full border border-white/15 bg-white/10 px-6 text-sm font-semibold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand">취소</button>
          <button type="button" onClick={p.onApply} disabled={blocked} aria-busy={p.saving} className="min-h-11 rounded-full px-7 text-sm font-bold disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-white" style={{ background: accent, color: onAccent(accent) }}>
            {p.saving ? "저장 중…" : p.error ? "다시 시도" : "적용"}
          </button>
        </div>
      </div>
      {dialog}
    </div>
  );
}

// 효과 썸네일: 실제 3D 가 아니라 모양만 보여 주는 그라데이션
function fxThumb(f: Backdrop, c: string): string {
  const base = "#0e0e16";
  switch (f) {
    case "bars": return `linear-gradient(0deg, ${c}, #2a2150)`;
    case "tunnel": return `radial-gradient(circle, transparent 20%, ${c}66 22%, transparent 24%, transparent 40%, ${c}55 42%, transparent 44%, transparent 60%, ${c}44 62%, transparent 64%), ${base}`;
    case "laser": return `conic-gradient(from 300deg at 50% 100%, transparent 0deg, ${PINK} 4deg, transparent 8deg, transparent 20deg, ${c} 24deg, transparent 28deg, transparent 40deg, ${PINK} 44deg, transparent 48deg, transparent 60deg, ${c} 64deg, transparent 68deg, transparent 80deg, ${PINK} 84deg, transparent 88deg), ${base}`;
    case "gyro": return `radial-gradient(circle at 50% 50%, #fff 6%, ${c} 12%, transparent 14%, transparent 34%, ${c}aa 36%, transparent 40%, transparent 56%, ${PINK}aa 58%, transparent 62%), ${base}`;
    case "cube": return `linear-gradient(135deg, ${c}66, ${PINK}55), ${base}`;
    default: return base;
  }
}
