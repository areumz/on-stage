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
import { getSessionId } from "@/lib/guide/session";
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
};

const Ctx = createContext<GuideApi | null>(null);

export function useGuide(): GuideApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGuide must be used inside GuideProvider");
  return v;
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

  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); }, []);

  // router.push는 해시 스크롤이 문서화돼 있지 않아서, 도착(경로 변경) 뒤 한 번 직접 스크롤한다
  useEffect(() => {
    const id = pendingScrollRef.current;
    if (!id) return;
    pendingScrollRef.current = null;
    const raf = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }));
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  const execute = useCallback((plan: ActionPlan) => {
    switch (plan.kind) {
      case "focus":
        requestFocus(plan.slug);
        break;
      case "gotoOrbit":
        requestFocus(plan.slug);
        router.push("/");
        break;
      case "scroll":
        document.getElementById(plan.section)?.scrollIntoView({ behavior: "smooth" });
        break;
      case "navigate":
        pendingScrollRef.current = plan.path.split("#")[1] ?? null;
        if (plan.focusSlug) {
          requestFocus(plan.focusSlug);
          if (navTimerRef.current) clearTimeout(navTimerRef.current);
          navTimerRef.current = setTimeout(() => router.push(plan.path), FOCUS_MS);
        } else {
          router.push(plan.path);
        }
        break;
      case "none":
        break;
    }
  }, [router]);

  const runAction = useCallback((action: UiAction) => {
    // 같은 액션이 연달아 오면 무시 (서버 필터는 view+slug만 본다)
    const key = JSON.stringify(action);
    const now = Date.now();
    if (lastActionRef.current?.key === key && now - lastActionRef.current.at < DUPLICATE_MS) return;
    lastActionRef.current = { key, at: now };
    try {
      const ctx = contextFromPath(window.location.pathname, getCurrentSection());
      execute(planAction(action, ctx, artistSlugs));
    } catch {
      // 실행 실패는 삼킨다: 답변은 이미 화면에 있다
    }
  }, [artistSlugs, execute]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    dispatch({ type: "send", id: crypto.randomUUID(), text });

    let pendingAction: UiAction | null = null;
    let ended = false;
    const result = await streamGuide({
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
        dispatch({ type: "event", event: e });
        // 액션은 답변이 정상 종료(done)된 뒤에만 실행한다
        if (e.event === "done" && pendingAction) runAction(pendingAction);
      },
    });
    busyRef.current = false;
    if (result === "aborted") dispatch({ type: "aborted" });
    else if (!ended) dispatch({ type: "fail" });
  }, [apiUrl, locale, runAction]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

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
    () => ({ state, open, setOpen, locale, setLocale, send: (t) => void send(t), stop, retry }),
    [state, open, setOpen, locale, send, stop, retry],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
