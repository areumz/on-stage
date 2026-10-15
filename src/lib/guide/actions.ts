// src/lib/guide/actions.ts
import type { GuideContext } from "@/lib/guide/context";
import type { UiAction } from "@/lib/guide/events";
import { isSection, type ArtistSection } from "@/lib/guide/sections";

// 액션을 "무엇을 할지"로 바꾸기만 한다(실행은 Provider). 순수 함수라 테스트하기 쉽다.
export type ActionPlan =
  | { kind: "none" }
  | { kind: "focus"; slug: string }
  | { kind: "gotoOrbit"; slug: string }
  | { kind: "scroll"; section: ArtistSection }
  | { kind: "highlight"; slug: string; city: string }
  | { kind: "navigate"; path: string; focusSlug?: string };

const NONE: ActionPlan = { kind: "none" };

function artistPath(slug: string, section: ArtistSection): string {
  return section === "hero" ? `/artists/${slug}` : `/artists/${slug}#${section}`;
}

// 실행 직전의 재검증: slug는 서버가 내려준 아티스트 목록에 있어야 하고, 이동 경로는 내부 경로로만 만든다.
export function planAction(action: UiAction, ctx: GuideContext | null, knownSlugs: readonly string[]): ActionPlan {
  if (!ctx || !knownSlugs.includes(action.slug)) return NONE;

  if (action.type === "focusArtist") {
    return ctx.view === "orbit" ? { kind: "focus", slug: action.slug } : { kind: "gotoOrbit", slug: action.slug };
  }

  if (action.type === "openTour") {
    // 모르는 section 값은 tour로 (액션 이름이 openTour이므로)
    const section: ArtistSection = isSection(action.section) ? action.section : "tour";
    if (ctx.view === "tour" && ctx.slug === action.slug) return { kind: "scroll", section };
    const path = artistPath(action.slug, section);
    return ctx.view === "orbit" ? { kind: "navigate", path, focusSlug: action.slug } : { kind: "navigate", path };
  }

  // highlightCity: 해당 아티스트의 투어 페이지에서만. 없는 도시 코드는 화면에서 조용히 무시된다
  if (ctx.view === "tour" && ctx.slug === action.slug) return { kind: "highlight", slug: action.slug, city: action.city };
  return NONE;
}
