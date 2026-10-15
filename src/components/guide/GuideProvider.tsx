// src/components/guide/GuideProvider.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore,
} from "react";
import { planAction, type ActionPlan } from "@/lib/guide/actions";
import { chatReducer, initialChat, lastUserText, type ChatState } from "@/lib/guide/chat";
import { contextFromPath } from "@/lib/guide/context";
import type { Locale } from "@/lib/guide/dictionary";
import type { UiAction } from "@/lib/guide/events";
import { requestFocus } from "@/lib/guide/orbitFocus";
import { getCurrentSection } from "@/lib/guide/sections";
import { requestHighlight } from "@/lib/guide/cityHighlight";
import { getSessionId, resetSessionId } from "@/lib/guide/session";
import { streamGuide } from "@/lib/guide/stream";

const FOCUS_MS = 700; // 궤도에서 openTour: 카메라가 도착할 시간을 주고 이동
const DUPLICATE_MS = 3000;

export type GuideApi = {
  state: ChatState;
  open: boolean;
  setOpen: (v: boolean) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  send: (text: string) => void;
  stop: () => void;
  retry: () => void;
  retryAction: () => void;
  newChat: () => void;
};

const Ctx = createContext<GuideApi | null>(null);

export function useGuide(): GuideApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGuide must be used inside GuideProvider");
  return v;
}

// 패널이 없는 곳(가이드 비활성)에서도 쓸 수 있는 읽기 전용 접근자
export function useGuideOptional(): GuideApi | null {
  return useContext(Ctx);
}

const noopSubscribe = () => () => {};
const detectLocale = (): Locale => (navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en");

export default function GuideProvider({
  apiUrl,
  artistSlugs,
  children,
}: {
  apiUrl: string;
  artistSlugs: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, dispatch] = useReducer(chatReducer, initialChat);
  const [open, setOpenState] = useState(false);
  const [localeOverride, setLocale] = useState<Locale | null>(null);
  const detected = useSyncExternalStore(noopSubscribe, detectLocale, () => "ko" as Locale);
  const locale = localeOverride ?? detected;

  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const warmedRef = useRef(false);
  const lastActionRef = useRef<{ key: string; at: number } | null>(null);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingScrollRef = useRef<string | null>(null);
  const lastPlanRef = useRef<{ plan: ActionPlan; slug: string } | null>(null);

  const clearNav = useCallback(() => {
    if (navTimerRef.current) clearTimeout(navTimerRef.current);
    navTimerRef.current = null;
  }, []);

  // 언마운트: 진행 중인 스트림을 끊고 이동 타이머를 지운다
  useEffect(() => () => {
    clearNav();
    abortRef.current?.abort();
  }, [clearNav]);

  // router.push는 해시 스크롤이 문서화돼 있지 않아서, 도착(경로 변경) 뒤 한 번 직접 스크롤한다.
  // 경로가 바뀌면 대기 중인 이동 타이머도 끝난 것이다.
  useEffect(() => {
    clearNav();
    const id = pendingScrollRef.current;
    if (!id) return;
    pendingScrollRef.current = null;
    const raf = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }));
    return () => cancelAnimationFrame(raf);
  }, [pathname, clearNav]);

  // 같은 경로(해시만 다름)면 바로 스크롤하고, 다른 경로면 도착 뒤 스크롤하도록 표시하고 이동한다
  const go = useCallback((path: string) => {
    const [target, hash] = path.split("#");
    if (target === window.location.pathname) {
      if (hash) document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    pendingScrollRef.current = hash ?? null;
    router.push(path);
  }, [router]);

  const execute = useCallback((plan: ActionPlan) => {
    switch (plan.kind) {
      case "focus":
        requestFocus(plan.slug);
        break;
      case "gotoOrbit":
        requestFocus(plan.slug);
        go("/");
        break;
      case "scroll":
        document.getElementById(plan.section)?.scrollIntoView({ behavior: "smooth" });
        break;
      case "highlight":
        document.getElementById("tour")?.scrollIntoView({ behavior: "smooth" });
        requestHighlight(plan.slug, plan.city);
        break;
      case "navigate":
        clearNav();
        if (plan.focusSlug) {
          requestFocus(plan.focusSlug);
          navTimerRef.current = setTimeout(() => {
            try {
              go(plan.path);
            } catch {
              dispatch({ type: "chip", chip: { kind: "failed", slug: plan.focusSlug! } });
            }
          }, FOCUS_MS);
        } else {
          go(plan.path);
        }
        break;
      case "none":
        break;
    }
  }, [go, clearNav]);

  // 실행하고 칩을 남긴다. 실패해도 답변은 이미 화면에 있다.
  const perform = useCallback((plan: ActionPlan, slug: string) => {
    if (plan.kind === "none") return;
    lastPlanRef.current = { plan, slug };
    try {
      execute(plan);
      // 같은 페이지 안 스크롤은 화면 이동이 아니므로 칩을 남기지 않는다
      if (plan.kind !== "scroll" && plan.kind !== "highlight") {
        const kind = plan.kind === "focus" || plan.kind === "gotoOrbit" ? "focus" : "navigating";
        dispatch({ type: "chip", chip: { kind, slug } });
      }
    } catch {
      dispatch({ type: "chip", chip: { kind: "failed", slug } });
    }
  }, [execute]);

  const runAction = useCallback((action: UiAction) => {
    // 같은 액션이 연달아 오면 무시 (서버 필터는 view+slug만 본다)
    const key = JSON.stringify(action);
    const now = Date.now();
    if (lastActionRef.current?.key === key && now - lastActionRef.current.at < DUPLICATE_MS) return;
    lastActionRef.current = { key, at: now };
    try {
      const ctx = contextFromPath(window.location.pathname, getCurrentSection());
      perform(planAction(action, ctx, artistSlugs), action.slug);
    } catch {
      dispatch({ type: "chip", chip: { kind: "failed", slug: action.slug } });
    }
  }, [artistSlugs, perform]);

  const retryAction = useCallback(() => {
    const last = lastPlanRef.current;
    if (last) perform(last.plan, last.slug);
  }, [perform]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;
    clearNav();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    dispatch({ type: "send", id: crypto.randomUUID(), text });

    let pendingAction: UiAction | null = null;
    let ended = false;
    let result: Awaited<ReturnType<typeof streamGuide>> = "failed";
    try {
      result = await streamGuide({
      url: `${apiUrl}/guide/stream`,
      signal: ctrl.signal,
      body: {
        requestId: crypto.randomUUID(),
        sessionId: getSessionId(),
        locale,
        message: text,
        context: contextFromPath(window.location.pathname, getCurrentSection()) ?? undefined,
      },
      onEvent: (e) => {
        if (e.event === "action") {
          pendingAction = e.action;
          return;
        }
        if (e.event === "done" || e.event === "error") ended = true;
        // 상한에 닿은 세션은 더 못 쓴다 — 다음 전송은 새 sessionId로 간다(대화창은 "새 대화 시작" 때 비운다)
        if (e.event === "error" && e.code === "session_limit") resetSessionId();
        dispatch({ type: "event", event: e });
        // 액션은 답변이 정상 종료(done)된 뒤에만 실행한다
        if (e.event === "done" && pendingAction) runAction(pendingAction);
      },
    });
    } finally {
      busyRef.current = false;
    }
    if (result === "aborted") dispatch({ type: "aborted" });
    else if (!ended) dispatch({ type: "fail" });
  }, [apiUrl, locale, runAction, clearNav]);

  const stop = useCallback(() => {
    clearNav();
    abortRef.current?.abort();
  }, [clearNav]);

  const newChat = useCallback(() => {
    clearNav();
    abortRef.current?.abort();
    resetSessionId();
    dispatch({ type: "reset" });
  }, [clearNav]);

  const retry = useCallback(() => {
    const text = lastUserText(state);
    if (!text) return;
    dispatch({ type: "dropFailed" });
    void send(text);
  }, [state, send]);

  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    // 첫 열기 때 한 번만 서버를 깨운다(콜드 스타트 완화). 실패는 무시.
    if (v && !warmedRef.current) {
      warmedRef.current = true;
      fetch(`${apiUrl}/health`).catch(() => {});
    }
  }, [apiUrl]);

  const value = useMemo<GuideApi>(
    () => ({ state, open, setOpen, locale, setLocale, send: (t) => void send(t), stop, retry, retryAction, newChat }),
    [state, open, setOpen, locale, send, stop, retry, retryAction, newChat],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
