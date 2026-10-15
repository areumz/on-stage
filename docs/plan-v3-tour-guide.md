# v3 투어 가이드 연동 Implementation Plan (2a 3D 궤도 → 체크포인트 → 2b 채팅 패널)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/`의 궤도 화면을 입체(R3F)로 바꾸고(2D 폴백 유지), 에이전트와 SSE로 대화하는 채팅 패널과 `focusArtist`/`openTour` 액션 처리를 붙인다.

**Architecture:** 새 `OrbitScene3D`를 추가하고 기존 평면 `OrbitScene`은 폴백으로 남긴다. 둘 다 모듈 수준 focus 저장소를 구독해 카메라 포커스(궤도 묶음 회전)에 반응한다. 패널은 `(fans)` 라우트 그룹 레이아웃의 Provider에 두어 `/` ↔ `/artists/[slug]` 이동에도 대화가 유지된다. SSE 파싱·이벤트 검증·액션 계획·reducer는 순수 함수로 분리해 vitest로 검증한다.

**Tech Stack:** Next.js 16.2.12 (App Router), React 19.2, @react-three/fiber 9, drei 10, three 0.185, Tailwind v4, Vitest 4 (node 환경, 로직만).

**설계 문서:** `docs/design-v3-tour-guide.md` (결정 D1~D14는 거기 있다). 이 plan은 그것을 그대로 따른다.

## Global Constraints

- `AGENTS.md`: "This is NOT the Next.js you know" — Next 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 관련 문서를 읽는다 (Task 0).
- 에이전트 저장소의 `contracts/`는 **읽기 전용**. 계약 변경은 "계약 갱신 요청"(설계 §7)으로만 전달한다.
- 새 의존성 추가 금지 (zod, 상태 라이브러리 포함).
- React state를 `useFrame` 안에서 갱신하지 않는다. 카메라·회전·강조는 ref로만 (design.md §9, v2.2 Canvas 재구성 문제).
- Effect 본문에서 동기 `setState` 금지 (`react-hooks/set-state-in-effect` 린트). 외부 값은 `useSyncExternalStore`.
- 대화는 메모리에만 둔다. `sessionStorage`에는 `sessionId`만, 접근은 try/catch.
- 입력 길이 `maxLength=200`. `NEXT_PUBLIC_` 변수는 비밀이 아닌 `NEXT_PUBLIC_GUIDE_API_URL` 하나뿐.
- 커밋 메시지 끝: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
- 테스트는 로직(순수 함수)만, 환경은 node. 컴포넌트 테스트는 쓰지 않는다 (저장소 관례).
- 체크포인트 승인 전에는 파트 B의 어떤 Task도 시작하지 않는다.

## File Structure

| 파일 | 역할 | Task |
| --- | --- | --- |
| `src/lib/geometry.ts` (+`.test.ts`) | 기울기 상수, 회전 목표 각도 순수 함수 추가 | A1 |
| `src/lib/guide/orbitFocus.ts` (+test) | focus 요청 저장소 + 훅 | A2 |
| `src/components/three/orbitShared.tsx` | 반경·FOV·카메라 리그·회전 훅·`FocusFromQuery` | A3 |
| `src/components/three/OrbitScene3D.tsx` | 입체 궤도 (신규) | A3 |
| `src/components/three/OrbitScene.tsx` | 2D 폴백. 공용 모듈 사용 + focus 반응 | A5 |
| `src/app/page.tsx` | 플래그 분기, `?focus=` | A4 |
| `src/lib/guide/sse.ts` (+test) | SSE 바이트 → 메시지 파서 | B1 |
| `src/lib/guide/events.ts` (+test) | 이벤트·액션 타입, 타입 가드 | B2 |
| `src/lib/guide/guide_events_sample.json` | 에이전트 fixture 복사본 (이미 추가됨) | B2 |
| `src/lib/guide/sections.ts`, `context.ts`, `actions.ts` (+tests) | 섹션 값, context, 액션 계획 | B3 |
| `src/lib/guide/dictionary.ts` (+test) | ko/en 고정 문구 | B4 |
| `src/lib/guide/chat.ts`, `stream.ts`, `session.ts` (+tests) | reducer, fetch 스트림, 세션 id | B5 |
| `src/app/(fans)/layout.tsx`, `src/components/guide/GuideProvider.tsx` | 레이아웃·Provider | B6 |
| `src/components/fans/ArtistSectionTracker.tsx` | 현재 섹션 감지 | B7 |
| `src/components/guide/GuidePanel.tsx` | 패널 UI | B8 |

---

## Task 0: 사전 준비 — 설치, Next 문서 읽기, 실측

**Files:**
- Modify: `docs/design-v3-tour-guide.md` (§8 표의 "대응" 열에 실측 결과 기록)

- [ ] **Step 1: 의존성 설치와 기준선 확인**

```bash
npm install
npm test
npm run lint
```
Expected: 테스트·린트가 에러 없이 끝난다. 실패하면 이 plan과 무관한 기존 문제이므로 기록만 하고 멈춰서 사용자에게 알린다.

- [ ] **Step 2: `.env.local` 확인**

`ls .env.local`. 없으면 **멈추고 사용자에게 요청**한다: `SUPABASE_URL`, `SUPABASE_ANON_KEY`가 있어야 `next dev`/`next build`가 돈다(`next.config.ts`가 `SUPABASE_URL`을 읽는다). 값을 추측하거나 만들지 않는다.

- [ ] **Step 3: Next 문서 읽기**

```bash
ls node_modules/next/dist/docs
grep -ril "searchParams" node_modules/next/dist/docs | head
grep -ril "route group" node_modules/next/dist/docs | head
grep -ril "scroll" node_modules/next/dist/docs | head
```
아래 4가지를 문서에서 확인해 `docs/design-v3-tour-guide.md` §8 표에 한 줄씩 결과를 적는다:
1. `searchParams`가 page props에서 `Promise`인지 (→ A4의 `await searchParams`)
2. `router.push("/path#id")`가 도착 후 해시 위치로 스크롤하는지 (→ 아니면 B6 `execute`에 도착 후 `scrollIntoView` 추가)
3. 라우트 그룹 `(fans)`의 레이아웃이 그룹 내 페이지 이동에서 유지되는지 (→ B6)
4. 서버 컴포넌트 레이아웃이 `process.env`를 읽어 클라이언트 컴포넌트 prop으로 넘겨도 되는지 (→ B6)

문서가 이 plan의 가정과 다르면 해당 Task의 코드를 문서에 맞게 고치고, 바꾼 이유를 §8에 적는다.

- [ ] **Step 4: 커밋**

```bash
git add docs/design-v3-tour-guide.md
git commit -m "docs: record Next 16 docs findings for tour guide plan"
```
(변경이 없으면 커밋하지 않는다.)

---

# 파트 A — 2a: 3D 궤도

## Task A1: 회전 목표 각도 순수 함수 (TDD)

**Files:**
- Modify: `src/lib/geometry.ts`
- Modify: `src/lib/geometry.test.ts`

**Interfaces:**
- Produces: `ORBIT_TILT: number` (rad), `FACE_ANGLE_3D: number`, `FACE_ANGLE_2D: number`, `shortestAngleDelta(from: number, to: number): number`, `focusRotationTarget(current: number, nodeAngle: number, faceAngle: number): number`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/lib/geometry.test.ts` 맨 아래에 추가 (import 줄은 `cameraDistanceForRadius, focusRotationTarget, shortestAngleDelta, FACE_ANGLE_3D`로 확장):

```ts
describe("shortestAngleDelta", () => {
  it("같은 각도면 0", () => {
    expect(shortestAngleDelta(1, 1)).toBeCloseTo(0);
  });
  it("2π 경계를 넘어 짧은 쪽으로 간다", () => {
    expect(shortestAngleDelta(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2);
    expect(shortestAngleDelta(Math.PI * 2 - 0.1, 0.1)).toBeCloseTo(0.2);
  });
});

describe("focusRotationTarget", () => {
  const norm = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  it("노드의 최종 월드 각도가 faceAngle이 된다", () => {
    const node = Math.PI / 3;
    const target = focusRotationTarget(0.4, node, FACE_ANGLE_3D);
    expect(norm(node + target)).toBeCloseTo(norm(FACE_ANGLE_3D));
  });

  it("회전이 여러 바퀴 누적돼도 현재 값 근처(반 바퀴 이내)에 머문다", () => {
    const current = 20;
    const target = focusRotationTarget(current, 1, FACE_ANGLE_3D);
    expect(Math.abs(target - current)).toBeLessThanOrEqual(Math.PI + 1e-9);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/geometry.test.ts`
Expected: FAIL (`focusRotationTarget`이 export되지 않음)

- [ ] **Step 3: 구현**

`src/lib/geometry.ts` 맨 아래에 추가:

```ts
// 궤도 묶음을 X축으로 기울이는 각도(rad, 약 -50°). 음수라서 -y 쪽(화면 아래)이 카메라에 가까워진다.
export const ORBIT_TILT = -0.87;
// 노드를 "정면"에 오게 할 궤도 위 각도. 3D: 기울어서 가장 가까워지는 아래쪽, 2D 폴백: 화면 위쪽.
export const FACE_ANGLE_3D = -Math.PI / 2;
export const FACE_ANGLE_2D = Math.PI / 2;

// from → to 로 가는 가장 짧은 회전량, (-π, π] 범위
export function shortestAngleDelta(from: number, to: number): number {
  const full = Math.PI * 2;
  let d = (to - from) % full;
  if (d > Math.PI) d -= full;
  if (d <= -Math.PI) d += full;
  return d;
}

// 궤도 묶음의 현재 회전(current)에서, nodeAngle(묶음 기준 노드 각도)에 있는 노드가 faceAngle에 오도록
// 가장 짧게 도는 목표 회전값. current가 여러 바퀴 누적돼 있어도 current 근처 값을 돌려준다.
export function focusRotationTarget(current: number, nodeAngle: number, faceAngle: number): number {
  return current + shortestAngleDelta(current, faceAngle - nodeAngle);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/geometry.test.ts`
Expected: PASS (기존 `cameraDistanceForRadius` 테스트 포함)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/geometry.ts src/lib/geometry.test.ts
git commit -m "feat: add orbit focus rotation helpers

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

## Task A2: focus 요청 저장소 (TDD)

**Files:**
- Create: `src/lib/guide/orbitFocus.ts`
- Create: `src/lib/guide/orbitFocus.test.ts`

**Interfaces:**
- Produces: `type FocusRequest = { slug: string; nonce: number }`, `requestFocus(slug: string): void`, `takeFocus(): FocusRequest | null`, `subscribeFocus(l: () => void): () => void`, `useFocusRequest(): FocusRequest | null`

- [ ] **Step 1: 실패하는 테스트**

```ts
// src/lib/guide/orbitFocus.test.ts
import { describe, it, expect, vi } from "vitest";
import { requestFocus, subscribeFocus, takeFocus } from "./orbitFocus";

describe("orbitFocus", () => {
  it("요청 후 takeFocus는 한 번만 돌려준다", () => {
    requestFocus("nova");
    expect(takeFocus()).toMatchObject({ slug: "nova" });
    expect(takeFocus()).toBeNull();
  });

  it("같은 slug를 다시 요청해도 새 요청으로 취급한다", () => {
    requestFocus("nova");
    const first = takeFocus();
    requestFocus("nova");
    const second = takeFocus();
    expect(second?.nonce).toBeGreaterThan(first!.nonce);
  });

  it("요청하면 구독자에게 알린다", () => {
    const listener = vi.fn();
    const off = subscribeFocus(listener);
    requestFocus("halo");
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    requestFocus("halo");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/guide/orbitFocus.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```ts
// src/lib/guide/orbitFocus.ts
"use client";

import { useSyncExternalStore } from "react";

// 궤도 카메라 포커스 요청 저장소. 에이전트 액션, ?focus= 쿼리, 아티스트 페이지에서 궤도로 돌아오는
// 경우가 모두 같은 경로를 쓴다. 요청은 모듈 변수에 남아 있어서 궤도 화면이 나중에 마운트돼도 받을 수 있고,
// takeFocus가 한 번만 돌려줘서 /로 다시 돌아왔을 때 옛 요청이 재실행되지 않는다.
export type FocusRequest = { slug: string; nonce: number };

let current: FocusRequest | null = null;
let nonce = 0;
let handled = 0;
const listeners = new Set<() => void>();

export function requestFocus(slug: string): void {
  current = { slug, nonce: ++nonce };
  listeners.forEach((l) => l());
}

export function takeFocus(): FocusRequest | null {
  if (!current || current.nonce <= handled) return null;
  handled = current.nonce;
  return current;
}

export function subscribeFocus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// 렌더를 다시 일으키는 용도. 값을 꺼내 쓰는 건 takeFocus
export function useFocusRequest(): FocusRequest | null {
  return useSyncExternalStore(subscribeFocus, () => current, () => null);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/guide/orbitFocus.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/guide/orbitFocus.ts src/lib/guide/orbitFocus.test.ts
git commit -m "feat: add orbit focus request store

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

## Task A3: 공용 모듈 + OrbitScene3D

**Files:**
- Create: `src/components/three/orbitShared.tsx`
- Create: `src/components/three/OrbitScene3D.tsx`

**Interfaces:**
- Consumes: `focusRotationTarget`, `cameraDistanceForRadius`, `ringPoints`, `ORBIT_TILT`, `FACE_ANGLE_3D` (geometry.ts); `takeFocus`, `useFocusRequest`, `requestFocus` (orbitFocus.ts)
- Produces: `RING_RADII: number[]`, `FOV_DEG: number`, `OrbitCameraRig()`, `useOrbitSpin(artists: Artist[], faceAngle: number): { groupRef: RefObject<Group | null>; rotation: RefObject<number>; focused: RefObject<string | null> }`, `FocusFromQuery({ slug }: { slug: string })`

- [ ] **Step 1: `orbitShared.tsx` 작성**

```tsx
// src/components/three/orbitShared.tsx
"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { MathUtils, type Group } from "three";
import { cameraDistanceForRadius, focusRotationTarget } from "@/lib/geometry";
import { requestFocus, takeFocus, useFocusRequest } from "@/lib/guide/orbitFocus";
import type { Artist } from "@/lib/types";

export const RING_RADII = [1.4, 2.3, 3.2];
export const FOV_DEG = 50;
// 노드 반지름·라벨이 궤도 반경보다 살짝 더 뻗어나가는 여유분
const CAMERA_MARGIN = 1.2;

const AUTO_SPEED = 0.08; // rad/s
const DAMP = 3; // 클수록 빨리 도착
const ARRIVE_EPS = 0.002;
const RESUME_AFTER_S = 8; // 도착 후 이 시간이 지나면 자동 회전 재개

// 컨테이너 가로세로비에 맞춰 궤도 전체가 프레임 안에 들어오게 카메라 거리를 다시 계산한다.
export function OrbitCameraRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const z = cameraDistanceForRadius(RING_RADII.at(-1)! * CAMERA_MARGIN, FOV_DEG, size.width / size.height);
    camera.position.set(0, 0, z);
  }, [camera, size.width, size.height]);
  return null;
}

// 궤도 묶음의 자동 회전 + focus 요청에 따른 목표 회전. 전부 ref로만 갱신한다(React state 없음).
// groupRef를 회전시킬 그룹에 연결하고, focused ref는 노드가 강조(확대) 판단에 읽는다.
export function useOrbitSpin(artists: Artist[], faceAngle: number) {
  const groupRef = useRef<Group>(null);
  const rotation = useRef(0);
  const target = useRef<number | null>(null);
  const focused = useRef<string | null>(null);
  const idle = useRef(0);
  const request = useFocusRequest();

  useEffect(() => {
    const r = takeFocus();
    if (!r) return;
    const artist = artists.find((a) => a.slug === r.slug);
    if (!artist) return;
    target.current = focusRotationTarget(rotation.current, (artist.angle * Math.PI) / 180, faceAngle);
    focused.current = artist.slug;
    idle.current = 0;
  }, [request, artists, faceAngle]);

  useFrame((_, delta) => {
    if (target.current !== null) {
      rotation.current = MathUtils.damp(rotation.current, target.current, DAMP, delta);
      if (Math.abs(target.current - rotation.current) < ARRIVE_EPS) {
        rotation.current = target.current;
        target.current = null;
      }
    } else if (focused.current) {
      idle.current += delta;
      if (idle.current > RESUME_AFTER_S) focused.current = null;
    } else {
      rotation.current += delta * AUTO_SPEED;
    }
    if (groupRef.current) groupRef.current.rotation.z = rotation.current;
  });

  return { groupRef, rotation, focused };
}

// ?focus=<slug> 로 열렸을 때 focus 요청을 한 번 보낸다(개발 확인용). 모르는 slug는 useOrbitSpin이 무시한다.
export function FocusFromQuery({ slug }: { slug: string }) {
  useEffect(() => {
    requestFocus(slug);
  }, [slug]);
  return null;
}
```

- [ ] **Step 2: `OrbitScene3D.tsx` 작성**

```tsx
// src/components/three/OrbitScene3D.tsx
"use client";

import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type RefObject } from "react";
import type { Group } from "three";
import Scene3D from "@/components/three/Scene3D";
import { FOV_DEG, OrbitCameraRig, RING_RADII, useOrbitSpin } from "@/components/three/orbitShared";
import { FACE_ANGLE_3D, ORBIT_TILT, ringPoints } from "@/lib/geometry";
import type { Artist } from "@/lib/types";

const FOCUS_SCALE = 1.35;
const HOVER_SCALE = 1.2;

function ArtistNode3D({ artist, focused }: { artist: Artist; focused: RefObject<string | null> }) {
  const router = useRouter();
  const group = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const r = RING_RADII[artist.orbit];
  const a = (artist.angle * Math.PI) / 180;
  const size = 0.32 * artist.size;
  const enter = () => router.push(`/artists/${artist.slug}`);

  useFrame(() => {
    const s = hovered ? HOVER_SCALE : focused.current === artist.slug ? FOCUS_SCALE : 1;
    group.current?.scale.setScalar(s);
  });

  return (
    <group ref={group} position={[Math.cos(a) * r, Math.sin(a) * r, 0]}>
      <mesh
        onClick={enter}
        onPointerOver={() => { setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
      >
        <sphereGeometry args={[size, 24, 24]} />
        <meshStandardMaterial color={artist.color} emissive={artist.color} emissiveIntensity={0.35} />
      </mesh>
      {/* 패널(z-40)보다 아래에 깔리도록 z-index 범위를 낮춘다 */}
      <Html center position={[0, -size - 0.3, 0]} zIndexRange={[20, 0]}>
        <button
          type="button"
          onClick={enter}
          className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] tracking-wide text-brand-soft hover:text-white focus-visible:outline-2 focus-visible:outline-brand-soft"
        >
          {artist.name}
        </button>
      </Html>
    </group>
  );
}

function Orbits3D({ artists }: { artists: Artist[] }) {
  const { groupRef, focused } = useOrbitSpin(artists, FACE_ANGLE_3D);
  const rings = useMemo(() => RING_RADII.map(ringPoints), []);
  return (
    <group rotation={[ORBIT_TILT, 0, 0]}>
      <group ref={groupRef}>
        {rings.map((pts, i) => (
          <Line key={i} points={pts} color="#3a2f5e" lineWidth={1} />
        ))}
        {artists.map((a) => (
          <ArtistNode3D key={a.slug} artist={a} focused={focused} />
        ))}
      </group>
    </group>
  );
}

export default function OrbitScene3D({ artists }: { artists: Artist[] }) {
  return (
    // 모바일 GPU 부담을 줄이려고 dpr 상한을 1.5로 (Scene3D가 canvasProps로 덮어쓰기를 허용)
    <Scene3D camera={{ position: [0, 0, 8], fov: FOV_DEG }} dpr={[1, 1.5]}>
      <OrbitCameraRig />
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 3, 5]} intensity={1.5} />
      <Orbits3D artists={artists} />
    </Scene3D>
  );
}
```

- [ ] **Step 3: 타입·린트 확인**

Run: `npx tsc --noEmit && npm run lint`
Expected: 에러 없음. 린트가 `Html`의 DOM 접근이나 ref 렌더 읽기를 지적하면 해당 줄만 규칙에 맞게 고친다(useFrame/이벤트 핸들러 안에서만 ref를 읽는다).

- [ ] **Step 4: 커밋**

```bash
git add src/components/three/orbitShared.tsx src/components/three/OrbitScene3D.tsx
git commit -m "feat: add tilted 3D orbit scene with focus support

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

## Task A4: 플래그 분기와 `?focus=`

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `OrbitScene3D`, `OrbitScene` (default exports), `FocusFromQuery`

- [ ] **Step 1: `page.tsx` 수정**

Task 0에서 `searchParams`가 `Promise`임을 확인했다는 전제. 아니면 문서에 맞게 `await`를 뺀다.

```tsx
import Header from "@/components/common/Header";
import NowTicker from "@/components/fans/NowTicker";
import OrbitScene from "@/components/three/OrbitScene";
import OrbitScene3D from "@/components/three/OrbitScene3D";
import { FocusFromQuery } from "@/components/three/orbitShared";
import { getArtists } from "@/lib/data";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ orbit?: string; focus?: string }>;
}) {
  const { orbit, focus } = await searchParams;
  const artists = await getArtists();
  // ?orbit=2d > 서버 env ORBIT_VIEW=2d > 3D. 에이전트 계약의 context.view와 이름이 겹치지 않게 "orbit".
  const use2d = (orbit ?? process.env.ORBIT_VIEW) === "2d";

  return (
    <main className="flex h-screen flex-col bg-bg-dark text-white">
      <Header dark />
      <div className="relative flex-1">
        {artists.length > 0 && (use2d ? <OrbitScene artists={artists} /> : <OrbitScene3D artists={artists} />)}
        {focus && <FocusFromQuery slug={focus} />}
        {/* 중앙 레이블명: DOM 오버레이가 캔버스보다 선명해서 이 방식으로 채택 */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <h1 className="font-serif-hero text-4xl tracking-widest">STAGE.ONE</h1>
          <p className="mt-2 text-sm text-brand-soft">{artists.length} artists · est. 2020</p>
        </div>
        <p className="absolute bottom-4 left-8 text-xs tracking-[0.2em] text-white/40">
          HOVER · CLICK TO ENTER
        </p>
      </div>
      <NowTicker items={artists.map((a) => ({ slug: a.slug, news: a.news }))} />
    </main>
  );
}
```

- [ ] **Step 2: `.env.example`에 추가**

파일 맨 아래에 추가:

```
# 궤도 화면을 평면(2D 폴백)으로 고정하려면 2d. 비우면 3D. ?orbit=2d 쿼리가 우선한다 — 서버 전용
ORBIT_VIEW=
```

- [ ] **Step 3: 확인**

Run: `npx tsc --noEmit && npm run lint`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/app/page.tsx .env.example
git commit -m "feat: switch orbit renderer by ?orbit=2d or ORBIT_VIEW and accept ?focus

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

## Task A5: 2D 폴백이 같은 공용 모듈을 쓰고 focus에 반응

**Files:**
- Modify: `src/components/three/OrbitScene.tsx`

- [ ] **Step 1: 전체를 아래로 교체**

변경점: 반경·FOV·카메라 리그를 `orbitShared`에서 가져오고, 자동 회전을 `useOrbitSpin`으로 바꾸며, focus된 노드를 확대한다. 노드 모양·라벨(Text)은 그대로다.

```tsx
"use client";

import { useFrame } from "@react-three/fiber";
import { Line, Text } from "@react-three/drei";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type RefObject } from "react";
import type { Group } from "three";
import { FACE_ANGLE_2D, ringPoints } from "@/lib/geometry";
import Scene3D from "@/components/three/Scene3D";
import { FOV_DEG, OrbitCameraRig, RING_RADII, useOrbitSpin } from "@/components/three/orbitShared";
import type { Artist } from "@/lib/types";

// 2D 폴백: 평면 렌더 그대로. 같은 focus 저장소를 구독해 포커스 시 해당 노드가 위쪽으로 돌아온다.
function ArtistNode({ artist, rotation, focused }: {
  artist: Artist; rotation: RefObject<number>; focused: RefObject<string | null>;
}) {
  const router = useRouter();
  const group = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const r = RING_RADII[artist.orbit];
  const a = (artist.angle * Math.PI) / 180;
  const size = 0.32 * artist.size;

  useFrame(() => {
    if (!group.current) return;
    // 부모 회전을 상쇄해 노드(텍스트)는 항상 정립
    group.current.rotation.z = -(rotation.current ?? 0);
    group.current.scale.setScalar(hovered ? 1.2 : focused.current === artist.slug ? 1.35 : 1);
  });

  return (
    <group position={[Math.cos(a) * r, Math.sin(a) * r, 0]}>
      <group
        ref={group}
        onClick={() => router.push(`/artists/${artist.slug}`)}
        onPointerOver={() => { setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
      >
        <mesh>
          <circleGeometry args={[size, 48]} />
          <meshBasicMaterial color={artist.color} />
        </mesh>
        {/* drei의 anchorX, anchorY 기본값이지만, 명시적으로 지정 */}
        <Text position={[0, 0, 0.01]} fontSize={size * 0.55} color="#ffffff" anchorX="center" anchorY="middle">
          {artist.initials}
        </Text>
        <Text position={[0, -size - 0.22, 0.01]} fontSize={0.16} color={hovered ? "#ffffff" : "#c7b3f0"} anchorX="center" anchorY="middle">
          {artist.name}
        </Text>
      </group>
    </group>
  );
}

function Orbits({ artists }: { artists: Artist[] }) {
  const { groupRef, rotation, focused } = useOrbitSpin(artists, FACE_ANGLE_2D);
  const rings = useMemo(() => RING_RADII.map(ringPoints), []);

  return (
    <group ref={groupRef}>
      {rings.map((pts, i) => (
        <Line key={i} points={pts} color="#3a2f5e" lineWidth={1} />
      ))}
      {artists.map((a) => (
        <ArtistNode key={a.slug} artist={a} rotation={rotation} focused={focused} />
      ))}
    </group>
  );
}

export default function OrbitScene({ artists }: { artists: Artist[] }) {
  return (
    <Scene3D camera={{ position: [0, 0, 8], fov: FOV_DEG }}>
      <OrbitCameraRig />
      <Orbits artists={artists} />
    </Scene3D>
  );
}
```

- [ ] **Step 2: 확인**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: 모두 통과

- [ ] **Step 3: 문서 갱신**

`README.md`의 A탭 설명 근처에 한 줄 추가: `?orbit=2d` 또는 `ORBIT_VIEW=2d`로 평면 궤도(폴백)를 볼 수 있다. (README 구조가 맞지 않으면 `docs/design-v3-tour-guide.md`만 갱신하고 README는 건드리지 않는다.)

- [ ] **Step 4: 커밋**

```bash
git add src/components/three/OrbitScene.tsx README.md
git commit -m "refactor: share orbit camera and spin with the 3D scene, react to focus in 2D fallback

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

# ⛔ 체크포인트 — 2a 끝, 여기서 멈춘다

**구현자는 여기서 멈추고 사용자에게 아래 표를 보여 준 뒤, 사용자가 화면을 직접 확인해 "승인"하기 전에는 파트 B를 시작하지 않는다.**
확인 방법: `npm run dev` → `http://localhost:3000`. 모바일은 DevTools 기기 에뮬레이션(375·390·768px)과 가능하면 실제 폰 1대.
★ = 핵심 항목(하나라도 실패하면 승인하지 않는다).

| # | 핵심 | 확인 항목 | 통과 기준 | 어떻게 보나 |
| --- | --- | --- | --- | --- |
| 1 | ★ | 3D 궤도가 보인다 | 구체 노드 6개, 기울어진 궤도 3개, 라벨 6개가 보이고 읽기 어렵게 겹치지 않는다 | `/` 첫 화면 |
| 2 |  | 입체감이 읽힌다 | 앞쪽 노드가 뒤쪽보다 크게 보이고, 회전하면 크기가 오르내린다 | 10초 관찰 |
| 3 | ★ | hover·클릭이 기존과 같다 | 노드에 올리면 커지고 커서가 손가락, 클릭하면 `/artists/<slug>`로 이동. 라벨 클릭도 이동 | 6명 모두 |
| 4 |  | 키보드로 들어갈 수 있다 | Tab으로 라벨에 포커스, Enter로 이동 | 키보드만 사용 |
| 5 | ★ | 모바일 레이아웃·조작 유지 | 375px에서 노드가 안 잘리고, 탭하면 진입, 중앙 문구·NOW 티커·헤더가 그대로 | 에뮬레이션 + 실기기 |
| 6 | ★ | 2D 폴백 복귀 | `/?orbit=2d`가 지금과 같은 평면 화면. env `ORBIT_VIEW=2d`로도 같다 | 주소 변경 / env 변경 후 재시작 |
| 7 | ★ | 카메라 포커스 | `/?focus=nova`로 열면 NOVA가 정면으로 돌아와 커진다. `/?focus=unknown`은 아무 일 없음. `/?orbit=2d&focus=nova`도 회전한다 | 주소창 |
| 8 |  | 프레임이 끊기지 않는다 | Performance monitor FPS: 데스크톱 55 이상, CPU 4× 느리게 30 이상 | 30초 관찰 |
| 9 | ★ | `webglcontextlost` 0건 | 아래 스니펫을 콘솔에 붙인 뒤 `/`↔`/artists/aurora`를 10회 오가고 창 크기를 바꿔도 0 | 아래 스니펫 |
| 10 |  | 다른 화면이 그대로다 | `/artists/aurora`의 Hero·투어 궤도·앨범·갤러리가 이전과 같다 | 스크롤 |
| 11 | ★ | 빌드·테스트 | `npm run lint`, `npm test`, `npm run build` 통과 | 터미널 |

콘솔 스니펫(#9) — 페이지에 붙여 넣고 새로고침 없이 조작한다:

```js
window.__lost = 0;
new MutationObserver(() => document.querySelectorAll("canvas").forEach((c) => {
  if (c.__w) return; c.__w = 1;
  c.addEventListener("webglcontextlost", () => console.warn("LOST", ++window.__lost));
})).observe(document.body, { childList: true, subtree: true });
```

체크포인트에서 노드가 잘리면(#5): `OrbitCameraRig`의 `CAMERA_MARGIN`을 올리거나 `ORBIT_TILT`를 줄인다(조정 후 재확인).
조명이 어둡거나 과하면: `OrbitScene3D`의 `ambientLight`/`directionalLight` intensity와 `emissiveIntensity`를 조정한다.

**승인 후** 다음 선행 조건을 확인하고 파트 B를 시작한다.

## 선행 조건 — 계약 갱신 C1~C5 (B9 전까지 완료돼야 함)

에이전트 저장소 쪽 작업이다. 사용자에게 아래 완료를 확인받고, **B9(연동 확인) 시작 전에** 체크한다. B1~B8은 이 작업과 무관하게 진행할 수 있다.

- [ ] C1 `context.section` 추가: `ViewContext.section?: "hero" | "tour" | "album" | "gallery"`
- [ ] C2 `openTour.section` 정의 (같은 4개 값, 생략 시 `tour`)
- [ ] C3 서버 중복 필터가 "현재 section == 목표 section"일 때만 거르도록 갱신
- [ ] C4 프롬프트의 현재 화면 표기에 section 포함
- [ ] C5 fixture에 section 포함 요청·`openTour.section` 샘플 추가

---

# 파트 B — 2b: 채팅 패널, SSE, 액션

## Task B1: SSE 파서 (TDD)

**Files:**
- Create: `src/lib/guide/sse.ts`
- Create: `src/lib/guide/sse.test.ts`

**Interfaces:**
- Produces: `type SseMessage = { event: string; data: string }`, `createSseParser(): (chunk: string) => SseMessage[]`

- [ ] **Step 1: 실패하는 테스트**

```ts
// src/lib/guide/sse.test.ts
import { describe, it, expect } from "vitest";
import { createSseParser } from "./sse";

describe("createSseParser", () => {
  it("event/data 한 쌍을 메시지로 만든다", () => {
    const parse = createSseParser();
    expect(parse('event: text_delta\ndata: {"text":"안녕"}\n\n')).toEqual([
      { event: "text_delta", data: '{"text":"안녕"}' },
    ]);
  });

  it("조각 경계에서 잘린 이벤트를 이어 붙인다", () => {
    const parse = createSseParser();
    expect(parse('event: text_del')).toEqual([]);
    expect(parse('ta\ndata: {"text":"a"}\n')).toEqual([]);
    expect(parse("\n")).toEqual([{ event: "text_delta", data: '{"text":"a"}' }]);
  });

  it("한 조각에 여러 이벤트가 있어도 순서대로 돌려준다", () => {
    const parse = createSseParser();
    const out = parse('event: a\ndata: {}\n\nevent: done\ndata: {}\n\n');
    expect(out.map((m) => m.event)).toEqual(["a", "done"]);
  });

  it("CRLF와 주석 줄을 처리한다", () => {
    const parse = createSseParser();
    expect(parse(': ping\r\nevent: done\r\ndata: {}\r\n\r\n')).toEqual([{ event: "done", data: "{}" }]);
  });

  it("data가 없는 블록은 버린다", () => {
    const parse = createSseParser();
    expect(parse("event: x\n\n")).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/guide/sse.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```ts
// src/lib/guide/sse.ts
export type SseMessage = { event: string; data: string };

// 글자 조각(chunk)을 계속 넣으면, 완성된 SSE 메시지만 돌려준다. 빈 줄이 메시지의 끝이다.
// 네트워크 조각은 메시지 중간에서 잘릴 수 있어서 미완성 부분은 버퍼에 남긴다.
export function createSseParser(): (chunk: string) => SseMessage[] {
  let buffer = "";
  return (chunk) => {
    buffer = (buffer + chunk).replace(/\r\n/g, "\n");
    const out: SseMessage[] = [];
    let end: number;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith(":")) continue;
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        let value = colon === -1 ? "" : line.slice(colon + 1);
        if (value.startsWith(" ")) value = value.slice(1);
        if (field === "event") event = value;
        else if (field === "data") data.push(value);
      }
      if (data.length > 0) out.push({ event, data: data.join("\n") });
    }
    return out;
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/guide/sse.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/guide/sse.ts src/lib/guide/sse.test.ts
git commit -m "feat: add SSE message parser

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

## Task B2: 이벤트 타입과 타입 가드 (TDD, fixture 검증)

**Files:**
- Create: `src/lib/guide/events.ts`
- Create: `src/lib/guide/events.test.ts`
- 이미 있음: `src/lib/guide/guide_events_sample.json` (에이전트 `fixtures/guide_events_sample.json`의 복사본, 수정 금지)

**Interfaces:**
- Produces: `ERROR_CODES`, `type ErrorCode`, `type UiAction`, `type GuideEvent`, `parseGuideEvent(name: string, raw: string): GuideEvent | null`

- [ ] **Step 1: 실패하는 테스트**

```ts
// src/lib/guide/events.test.ts
import { describe, it, expect } from "vitest";
import sample from "./guide_events_sample.json";
import { parseGuideEvent } from "./events";

describe("parseGuideEvent — 에이전트 fixture", () => {
  const all = [...sample.success, ...sample.error];

  it("fixture의 모든 이벤트를 해석한다", () => {
    for (const item of all) {
      const e = parseGuideEvent(item.event, JSON.stringify(item.data));
      expect(e, item.event).not.toBeNull();
      expect(e!.event).toBe(item.event);
    }
  });

  it("action은 액션 객체 그대로 온다", () => {
    const e = parseGuideEvent("action", '{"type":"focusArtist","slug":"aurora"}');
    expect(e).toEqual({ event: "action", action: { type: "focusArtist", slug: "aurora" } });
  });
});

describe("parseGuideEvent — 방어", () => {
  it("깨진 JSON은 null", () => {
    expect(parseGuideEvent("text_delta", "{oops")).toBeNull();
  });
  it("모르는 이벤트 이름은 null", () => {
    expect(parseGuideEvent("weird", "{}")).toBeNull();
  });
  it("필드 타입이 틀리면 null", () => {
    expect(parseGuideEvent("text_delta", '{"text":5}')).toBeNull();
  });
  it("모르는 액션 type은 null (무시)", () => {
    expect(parseGuideEvent("action", '{"type":"teleport","slug":"x"}')).toBeNull();
  });
  it("openTour의 section은 없어도, 문자열이면 있어도 된다", () => {
    expect(parseGuideEvent("action", '{"type":"openTour","slug":"nova"}')).not.toBeNull();
    expect(parseGuideEvent("action", '{"type":"openTour","slug":"nova","section":"album"}')).toEqual({
      event: "action",
      action: { type: "openTour", slug: "nova", section: "album" },
    });
  });
  it("모르는 오류 코드는 internal로 바꾼다", () => {
    expect(parseGuideEvent("error", '{"code":"new_code"}')).toEqual({ event: "error", code: "internal" });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/guide/events.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```ts
// src/lib/guide/events.ts
// 에이전트 계약(contracts/guide_events.py)의 SSE 이벤트·액션 모양. 프레임: `event:` 이름 + `data:` JSON.
// 일반 이벤트의 data에는 event 필드가 없고, action의 data는 액션 객체 그대로다.
export const ERROR_CODES = ["rate_limited", "off_topic", "too_long", "busy", "upstream", "internal"] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type UiAction =
  | { type: "focusArtist"; slug: string }
  | { type: "openTour"; slug: string; section?: string }
  | { type: "highlightCity"; slug: string; city: string };

export type GuideEvent =
  | { event: "tool_status"; tool: string; key: string }
  | { event: "text_delta"; text: string }
  | { event: "action"; action: UiAction }
  | { event: "retract"; reason: string }
  | { event: "error"; code: ErrorCode }
  | { event: "done" };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isStr = (v: unknown): v is string => typeof v === "string";

function toAction(d: Record<string, unknown>): UiAction | null {
  if (d.type === "focusArtist" && isStr(d.slug)) return { type: "focusArtist", slug: d.slug };
  if (d.type === "openTour" && isStr(d.slug)) {
    return isStr(d.section) ? { type: "openTour", slug: d.slug, section: d.section } : { type: "openTour", slug: d.slug };
  }
  if (d.type === "highlightCity" && isStr(d.slug) && isStr(d.city)) {
    return { type: "highlightCity", slug: d.slug, city: d.city };
  }
  return null; // 모르는 액션은 무시 (ui_actions.md 규칙 1)
}

// 해석할 수 없는 이벤트는 null — 호출부는 그냥 건너뛴다
export function parseGuideEvent(name: string, raw: string): GuideEvent | null {
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(d)) return null;
  switch (name) {
    case "tool_status":
      return isStr(d.tool) && isStr(d.key) ? { event: "tool_status", tool: d.tool, key: d.key } : null;
    case "text_delta":
      return isStr(d.text) ? { event: "text_delta", text: d.text } : null;
    case "action": {
      const action = toAction(d);
      return action ? { event: "action", action } : null;
    }
    case "retract":
      return isStr(d.reason) ? { event: "retract", reason: d.reason } : null;
    case "error":
      return isStr(d.code)
        ? { event: "error", code: (ERROR_CODES as readonly string[]).includes(d.code) ? (d.code as ErrorCode) : "internal" }
        : null;
    case "done":
      return { event: "done" };
    default:
      return null;
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/guide/events.test.ts`
Expected: PASS. JSON import가 타입 에러면 `tsconfig.json`의 `resolveJsonModule`을 확인한다(`src/data/artists.json`을 이미 import하므로 켜져 있을 것).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/guide/events.ts src/lib/guide/events.test.ts src/lib/guide/guide_events_sample.json
git commit -m "feat: add guide event types, guards and agent fixture test

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

## Task B3: 섹션 값, context, 액션 계획 (TDD)

**Files:**
- Create: `src/lib/guide/sections.ts`, `src/lib/guide/context.ts`, `src/lib/guide/actions.ts`
- Create: `src/lib/guide/context.test.ts`, `src/lib/guide/actions.test.ts`

**Interfaces:**
- Consumes: `UiAction` (events.ts)
- Produces:
  - `ARTIST_SECTIONS`, `type ArtistSection`, `isSection(v: unknown): v is ArtistSection`, `setCurrentSection(s: ArtistSection | null): void`, `getCurrentSection(): ArtistSection | null`
  - `type GuideContext = { view: "orbit" | "tour"; slug?: string; section?: ArtistSection }`, `contextFromPath(pathname: string, section: ArtistSection | null): GuideContext | null`
  - `type ActionPlan`, `planAction(action: UiAction, ctx: GuideContext | null, knownSlugs: readonly string[]): ActionPlan`

- [ ] **Step 1: `sections.ts` 작성** (단순 상수·변수라 테스트 없음)

```ts
// src/lib/guide/sections.ts
// 아티스트 페이지 섹션 값. DOM id와 같다(page.tsx의 hero, TourSection의 tour, AlbumSection의 album, GallerySection의 gallery).
export const ARTIST_SECTIONS = ["hero", "tour", "album", "gallery"] as const;
export type ArtistSection = (typeof ARTIST_SECTIONS)[number];

export function isSection(v: unknown): v is ArtistSection {
  return (ARTIST_SECTIONS as readonly unknown[]).includes(v);
}

// 현재 보고 있는 섹션. 요청을 보내는 순간에만 읽으므로 React state가 아닌 모듈 변수로 둔다
// (스크롤할 때마다 렌더가 일어나지 않게).
let current: ArtistSection | null = null;
export const setCurrentSection = (s: ArtistSection | null) => { current = s; };
export const getCurrentSection = () => current;
```

- [ ] **Step 2: 실패하는 테스트 작성**

```ts
// src/lib/guide/context.test.ts
import { describe, it, expect } from "vitest";
import { contextFromPath } from "./context";

describe("contextFromPath", () => {
  it("/ 는 orbit", () => {
    expect(contextFromPath("/", null)).toEqual({ view: "orbit" });
  });
  it("아티스트 페이지는 tour + slug, section이 있으면 포함", () => {
    expect(contextFromPath("/artists/aurora", null)).toEqual({ view: "tour", slug: "aurora" });
    expect(contextFromPath("/artists/aurora", "album")).toEqual({ view: "tour", slug: "aurora", section: "album" });
  });
  it("끝 슬래시를 허용한다", () => {
    expect(contextFromPath("/artists/nova/", null)).toEqual({ view: "tour", slug: "nova" });
  });
  it("그 밖의 경로는 null", () => {
    expect(contextFromPath("/staff/dashboard", null)).toBeNull();
    expect(contextFromPath("/artists", null)).toBeNull();
  });
  it("orbit에는 section을 붙이지 않는다", () => {
    expect(contextFromPath("/", "tour")).toEqual({ view: "orbit" });
  });
});
```

```ts
// src/lib/guide/actions.test.ts
import { describe, it, expect } from "vitest";
import { planAction } from "./actions";

const known = ["aurora", "nova"];
const orbit = { view: "orbit" as const };
const tour = (slug: string) => ({ view: "tour" as const, slug });

describe("planAction", () => {
  it("모르는 slug는 none", () => {
    expect(planAction({ type: "focusArtist", slug: "ghost" }, orbit, known)).toEqual({ kind: "none" });
    expect(planAction({ type: "openTour", slug: "ghost" }, orbit, known)).toEqual({ kind: "none" });
  });

  it("궤도에서 focusArtist는 focus", () => {
    expect(planAction({ type: "focusArtist", slug: "nova" }, orbit, known)).toEqual({ kind: "focus", slug: "nova" });
  });

  it("아티스트 페이지에서 focusArtist는 궤도로 돌아가 focus", () => {
    expect(planAction({ type: "focusArtist", slug: "nova" }, tour("aurora"), known)).toEqual({ kind: "gotoOrbit", slug: "nova" });
  });

  it("궤도에서 openTour는 focus 후 투어 섹션으로 이동", () => {
    expect(planAction({ type: "openTour", slug: "nova" }, orbit, known)).toEqual({
      kind: "navigate",
      path: "/artists/nova#tour",
      focusSlug: "nova",
    });
  });

  it("같은 아티스트 페이지에서는 스크롤", () => {
    expect(planAction({ type: "openTour", slug: "nova" }, tour("nova"), known)).toEqual({ kind: "scroll", section: "tour" });
    expect(planAction({ type: "openTour", slug: "nova", section: "album" }, tour("nova"), known)).toEqual({
      kind: "scroll",
      section: "album",
    });
  });

  it("다른 아티스트 페이지에서는 이동 (focus 연출 없음)", () => {
    expect(planAction({ type: "openTour", slug: "nova" }, tour("aurora"), known)).toEqual({
      kind: "navigate",
      path: "/artists/nova#tour",
    });
  });

  it("모르는 section은 tour로, hero는 해시 없이 이동", () => {
    expect(planAction({ type: "openTour", slug: "nova", section: "zzz" }, orbit, known)).toMatchObject({
      path: "/artists/nova#tour",
    });
    expect(planAction({ type: "openTour", slug: "nova", section: "hero" }, tour("aurora"), known)).toEqual({
      kind: "navigate",
      path: "/artists/nova",
    });
  });

  it("highlightCity는 아직 처리하지 않는다", () => {
    expect(planAction({ type: "highlightCity", slug: "nova", city: "SEO" }, orbit, known)).toEqual({ kind: "none" });
  });

  it("context가 없으면(알 수 없는 화면) 이동 계열은 none", () => {
    expect(planAction({ type: "openTour", slug: "nova" }, null, known)).toEqual({ kind: "none" });
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/guide/context.test.ts src/lib/guide/actions.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 4: 구현**

```ts
// src/lib/guide/context.ts
import { type ArtistSection } from "@/lib/guide/sections";

export type GuideContext = { view: "orbit" | "tour"; slug?: string; section?: ArtistSection };

const ARTIST_PATH = /^\/artists\/([^/]+)\/?$/;

// 주소(URL)가 유일한 진실이다. 패널이 없는 화면(staff 등)은 null
export function contextFromPath(pathname: string, section: ArtistSection | null): GuideContext | null {
  if (pathname === "/") return { view: "orbit" };
  const m = ARTIST_PATH.exec(pathname);
  if (!m) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  return section ? { view: "tour", slug, section } : { view: "tour", slug };
}
```

```ts
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

  return NONE; // highlightCity는 에이전트 4단계
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/lib/guide/context.test.ts src/lib/guide/actions.test.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/lib/guide/sections.ts src/lib/guide/context.ts src/lib/guide/actions.ts src/lib/guide/context.test.ts src/lib/guide/actions.test.ts
git commit -m "feat: add guide context builder and action planner

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

## Task B4: ko/en 고정 문구 사전 (TDD)

**Files:**
- Create: `src/lib/guide/dictionary.ts`, `src/lib/guide/dictionary.test.ts`

**Interfaces:**
- Consumes: `ERROR_CODES`, `ErrorCode` (events.ts)
- Produces: `type Locale = "ko" | "en"`, `DICT: Record<Locale, UiStrings>`, `toolStatusText(locale: Locale, key: string): string`, `errorText(locale: Locale, code: ErrorCode | "network"): string`

- [ ] **Step 1: 실패하는 테스트**

```ts
// src/lib/guide/dictionary.test.ts
import { describe, it, expect } from "vitest";
import { DICT, errorText, toolStatusText } from "./dictionary";
import { ERROR_CODES } from "./events";

describe("dictionary", () => {
  it("모든 오류 코드와 network에 ko/en 문구가 있다", () => {
    for (const locale of ["ko", "en"] as const) {
      for (const code of [...ERROR_CODES, "network" as const]) {
        expect(errorText(locale, code).length, `${locale}:${code}`).toBeGreaterThan(0);
      }
    }
  });

  it("알려진 도구 키는 전용 문구, 모르는 키는 일반 문구", () => {
    expect(toolStatusText("ko", "tool.searchShows")).not.toBe(toolStatusText("ko", "tool.unknown"));
    expect(toolStatusText("en", "tool.unknown")).toBe(DICT.en.toolGeneric);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/guide/dictionary.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// src/lib/guide/dictionary.ts
import type { ErrorCode } from "@/lib/guide/events";

// 안내 문구는 서버(LLM)가 만들지 않고 코드/키로 여기서 표시한다 (설계 §4).
export type Locale = "ko" | "en";

type UiStrings = {
  title: string; open: string; close: string; placeholder: string; send: string; stop: string; retry: string;
  empty: string; retracted: string; toolGeneric: string;
  tools: Record<string, string>;
  errors: Record<ErrorCode | "network", string>;
};

export const DICT: Record<Locale, UiStrings> = {
  ko: {
    title: "투어 가이드",
    open: "투어 가이드 열기",
    close: "닫기",
    placeholder: "아티스트나 공연 일정을 물어보세요",
    send: "보내기",
    stop: "멈추기",
    retry: "다시 시도",
    empty: "궁금한 아티스트나 투어 일정을 물어보세요.",
    retracted: "확인되지 않은 정보는 답하지 않아요.",
    toolGeneric: "정보를 확인하는 중이에요",
    tools: {
      "tool.listArtists": "아티스트 목록을 확인했어요",
      "tool.getArtist": "아티스트 정보를 확인했어요",
      "tool.searchShows": "공연 일정을 확인했어요",
    },
    errors: {
      rate_limited: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
      off_topic: "STAGE.ONE의 아티스트와 투어에 대해서만 답할 수 있어요.",
      too_long: "질문이 너무 길어요. 200자 이내로 줄여 주세요.",
      busy: "이전 질문에 답하는 중이에요. 잠시만 기다려 주세요.",
      upstream: "지금은 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.",
      internal: "문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
      network: "연결이 끊겼어요. 다시 시도해 주세요.",
    },
  },
  en: {
    title: "Tour Guide",
    open: "Open tour guide",
    close: "Close",
    placeholder: "Ask about an artist or a tour date",
    send: "Send",
    stop: "Stop",
    retry: "Try again",
    empty: "Ask about an artist or the tour schedule.",
    retracted: "I don't answer with information I couldn't verify.",
    toolGeneric: "Checking the info…",
    tools: {
      "tool.listArtists": "Checked the artist list",
      "tool.getArtist": "Checked the artist info",
      "tool.searchShows": "Checked the show schedule",
    },
    errors: {
      rate_limited: "Too many requests. Please try again in a moment.",
      off_topic: "I can only answer about STAGE.ONE artists and tours.",
      too_long: "That question is too long. Please keep it under 200 characters.",
      busy: "Still answering your previous question. One moment.",
      upstream: "I couldn't get an answer right now. Please try again shortly.",
      internal: "Something went wrong. Please try again shortly.",
      network: "The connection dropped. Please try again.",
    },
  },
};

export function toolStatusText(locale: Locale, key: string): string {
  return DICT[locale].tools[key] ?? DICT[locale].toolGeneric;
}

export function errorText(locale: Locale, code: ErrorCode | "network"): string {
  return DICT[locale].errors[code];
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/guide/dictionary.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/guide/dictionary.ts src/lib/guide/dictionary.test.ts
git commit -m "feat: add ko/en fixed message dictionary for guide panel

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

## Task B5: 대화 reducer, 스트림 클라이언트, 세션 id (TDD)

**Files:**
- Create: `src/lib/guide/chat.ts`, `src/lib/guide/chat.test.ts`
- Create: `src/lib/guide/stream.ts`, `src/lib/guide/stream.test.ts`
- Create: `src/lib/guide/session.ts`

**Interfaces:**
- Consumes: `GuideEvent`, `ErrorCode`, `parseGuideEvent` (events.ts); `createSseParser` (sse.ts); `GuideContext` (context.ts); `Locale` (dictionary.ts)
- Produces:
  - `type ChatMessage = { id: string; role: "user" | "assistant"; text: string; retracted?: boolean }`
  - `type ChatState = { messages: ChatMessage[]; status: "idle" | "streaming" | "error"; errorCode: ErrorCode | "network" | null; toolKey: string | null }`
  - `type ChatAction = { type: "send"; id: string; text: string } | { type: "event"; event: Exclude<GuideEvent, { event: "action" }> } | { type: "fail" } | { type: "aborted" } | { type: "dropFailed" }`
  - `initialChat: ChatState`, `chatReducer(state: ChatState, action: ChatAction): ChatState`, `lastUserText(state: ChatState): string | null`
  - `streamGuide(opts: { url: string; body: GuideRequestBody; signal: AbortSignal; onEvent: (e: GuideEvent) => void }): Promise<"ok" | "failed" | "aborted">`
  - `getSessionId(): string`

- [ ] **Step 1: reducer 테스트**

```ts
// src/lib/guide/chat.test.ts
import { describe, it, expect } from "vitest";
import { chatReducer, initialChat, lastUserText } from "./chat";

const send = (s = initialChat, text = "안녕", id = "m1") => chatReducer(s, { type: "send", id, text });

describe("chatReducer", () => {
  it("send는 사용자 말풍선과 빈 답변 말풍선을 만들고 streaming이 된다", () => {
    const s = send();
    expect(s.status).toBe("streaming");
    expect(s.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("text_delta는 마지막 답변에 이어 붙는다", () => {
    let s = send();
    s = chatReducer(s, { type: "event", event: { event: "text_delta", text: "가장 " } });
    s = chatReducer(s, { type: "event", event: { event: "text_delta", text: "가까운" } });
    expect(s.messages.at(-1)!.text).toBe("가장 가까운");
  });

  it("tool_status는 toolKey를 바꾸고 done에서 지운다", () => {
    let s = send();
    s = chatReducer(s, { type: "event", event: { event: "tool_status", tool: "searchShows", key: "tool.searchShows" } });
    expect(s.toolKey).toBe("tool.searchShows");
    s = chatReducer(s, { type: "event", event: { event: "done" } });
    expect(s).toMatchObject({ status: "idle", toolKey: null });
  });

  it("retract는 답변을 비우고 retracted로 표시", () => {
    let s = send();
    s = chatReducer(s, { type: "event", event: { event: "text_delta", text: "틀린 답" } });
    s = chatReducer(s, { type: "event", event: { event: "retract", reason: "x" } });
    expect(s.messages.at(-1)).toMatchObject({ text: "", retracted: true });
  });

  it("error는 status와 코드를 남기고, 비어 있는 답변 말풍선은 지운다", () => {
    let s = send();
    s = chatReducer(s, { type: "event", event: { event: "error", code: "rate_limited" } });
    expect(s).toMatchObject({ status: "error", errorCode: "rate_limited" });
    expect(s.messages.map((m) => m.role)).toEqual(["user"]);
  });

  it("텍스트가 이미 있으면 error여도 답변은 남긴다", () => {
    let s = send();
    s = chatReducer(s, { type: "event", event: { event: "text_delta", text: "부분 답변" } });
    s = chatReducer(s, { type: "event", event: { event: "error", code: "upstream" } });
    expect(s.messages.at(-1)!.text).toBe("부분 답변");
  });

  it("fail은 network 오류, aborted는 idle", () => {
    expect(chatReducer(send(), { type: "fail" })).toMatchObject({ status: "error", errorCode: "network" });
    expect(chatReducer(send(), { type: "aborted" }).status).toBe("idle");
  });

  it("dropFailed + lastUserText로 다시 시도할 수 있다", () => {
    let s = send(initialChat, "서울 공연", "m1");
    s = chatReducer(s, { type: "fail" });
    expect(lastUserText(s)).toBe("서울 공연");
    s = chatReducer(s, { type: "dropFailed" });
    expect(s.messages).toEqual([]);
    expect(s.status).toBe("idle");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/guide/chat.test.ts`
Expected: FAIL

- [ ] **Step 3: reducer 구현**

```ts
// src/lib/guide/chat.ts
import type { ErrorCode, GuideEvent } from "@/lib/guide/events";

export type ChatMessage = { id: string; role: "user" | "assistant"; text: string; retracted?: boolean };

export type ChatState = {
  messages: ChatMessage[];
  status: "idle" | "streaming" | "error";
  errorCode: ErrorCode | "network" | null;
  toolKey: string | null;
};

// action 이벤트는 reducer로 오지 않는다(Provider가 done 때 실행)
export type ChatAction =
  | { type: "send"; id: string; text: string }
  | { type: "event"; event: Exclude<GuideEvent, { event: "action" }> }
  | { type: "fail" }
  | { type: "aborted" }
  | { type: "dropFailed" };

export const initialChat: ChatState = { messages: [], status: "idle", errorCode: null, toolKey: null };

function withLast(messages: ChatMessage[], patch: (m: ChatMessage) => ChatMessage): ChatMessage[] {
  const last = messages.at(-1);
  if (!last || last.role !== "assistant") return messages;
  return [...messages.slice(0, -1), patch(last)];
}

// 빈 답변 말풍선이 오류 화면에 남아 있지 않게 지운다
function dropEmptyAssistant(messages: ChatMessage[]): ChatMessage[] {
  const last = messages.at(-1);
  return last && last.role === "assistant" && last.text === "" && !last.retracted ? messages.slice(0, -1) : messages;
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "send":
      return {
        messages: [
          ...state.messages,
          { id: action.id, role: "user", text: action.text },
          { id: `${action.id}-a`, role: "assistant", text: "" },
        ],
        status: "streaming",
        errorCode: null,
        toolKey: null,
      };
    case "event": {
      const e = action.event;
      switch (e.event) {
        case "tool_status":
          return { ...state, toolKey: e.key };
        case "text_delta":
          return { ...state, messages: withLast(state.messages, (m) => ({ ...m, text: m.text + e.text })) };
        case "retract":
          return { ...state, messages: withLast(state.messages, (m) => ({ ...m, text: "", retracted: true })) };
        case "error":
          return { ...state, status: "error", errorCode: e.code, toolKey: null, messages: dropEmptyAssistant(state.messages) };
        case "done":
          return { ...state, status: "idle", toolKey: null };
      }
      return state;
    }
    case "fail":
      return { ...state, status: "error", errorCode: "network", toolKey: null, messages: dropEmptyAssistant(state.messages) };
    case "aborted":
      return { ...state, status: "idle", toolKey: null, messages: dropEmptyAssistant(state.messages) };
    case "dropFailed": {
      // 마지막 사용자 말풍선(과 그 뒤의 답변)을 지운다 — 같은 질문을 새 요청으로 다시 보내기 위해
      const idx = state.messages.findLastIndex((m) => m.role === "user");
      return { ...state, messages: idx === -1 ? state.messages : state.messages.slice(0, idx), status: "idle", errorCode: null };
    }
  }
}

export function lastUserText(state: ChatState): string | null {
  return state.messages.findLast((m) => m.role === "user")?.text ?? null;
}
```

- [ ] **Step 4: stream 테스트**

```ts
// src/lib/guide/stream.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { streamGuide } from "./stream";
import type { GuideEvent } from "./events";

const enc = new TextEncoder();
function sseResponse(chunks: string[], init: ResponseInit = { status: 200 }) {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      chunks.forEach((s) => c.enqueue(enc.encode(s)));
      c.close();
    },
  });
  return new Response(stream, init);
}
const body = { requestId: "r", sessionId: "s", locale: "ko" as const, message: "hi" };

afterEach(() => vi.unstubAllGlobals());

describe("streamGuide", () => {
  it("조각이 이벤트 경계에서 잘려도 순서대로 이벤트를 전달한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      sseResponse([
        'event: text_delta\ndata: {"text":"가',
        '"}\n\nevent: action\ndata: {"type":"focusArtist","slug":"aurora"}\n\n',
        "event: done\ndata: {}\n\n",
      ]),
    ));
    const got: GuideEvent[] = [];
    const r = await streamGuide({ url: "http://x/guide/stream", body, signal: new AbortController().signal, onEvent: (e) => got.push(e) });
    expect(r).toBe("ok");
    expect(got.map((e) => e.event)).toEqual(["text_delta", "action", "done"]);
  });

  it("HTTP 오류는 failed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 422 })));
    const r = await streamGuide({ url: "http://x", body, signal: new AbortController().signal, onEvent: () => {} });
    expect(r).toBe("failed");
  });

  it("네트워크 예외는 failed, abort된 경우는 aborted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    expect(await streamGuide({ url: "http://x", body, signal: new AbortController().signal, onEvent: () => {} })).toBe("failed");

    const ctrl = new AbortController();
    ctrl.abort();
    expect(await streamGuide({ url: "http://x", body, signal: ctrl.signal, onEvent: () => {} })).toBe("aborted");
  });
});
```

- [ ] **Step 5: 실패 확인**

Run: `npx vitest run src/lib/guide/stream.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 6: stream·session 구현**

```ts
// src/lib/guide/stream.ts
import type { GuideContext } from "@/lib/guide/context";
import type { Locale } from "@/lib/guide/dictionary";
import { parseGuideEvent, type GuideEvent } from "@/lib/guide/events";
import { createSseParser } from "@/lib/guide/sse";

export type GuideRequestBody = {
  requestId: string;
  sessionId: string;
  locale: Locale;
  message: string;
  context?: GuideContext;
};

// POST 본문이 있어서 EventSource는 못 쓰고 fetch 스트림으로 읽는다. 취소는 signal.abort().
export async function streamGuide(opts: {
  url: string;
  body: GuideRequestBody;
  signal: AbortSignal;
  onEvent: (e: GuideEvent) => void;
}): Promise<"ok" | "failed" | "aborted"> {
  try {
    const res = await fetch(opts.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(opts.body),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) return "failed";
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parse = createSseParser();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const m of parse(decoder.decode(value, { stream: true }))) {
        const e = parseGuideEvent(m.event, m.data);
        if (e) opts.onEvent(e);
      }
    }
    return "ok";
  } catch {
    return opts.signal.aborted ? "aborted" : "failed";
  }
}
```

```ts
// src/lib/guide/session.ts
const KEY = "guide-session";
let memo: string | null = null;

// 브라우저 sessionStorage의 UUID. 서버는 이 값을 신뢰하지 않는다(회전 가능).
// 저장소 접근이 막힌 환경(사생활 보호 모드 등)에서는 메모리 값으로 대신한다.
export function getSessionId(): string {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
    return id;
  } catch {
    return (memo ??= crypto.randomUUID());
  }
}
```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest run src/lib/guide`
Expected: guide 폴더의 모든 테스트 PASS

- [ ] **Step 8: 커밋**

```bash
git add src/lib/guide
git commit -m "feat: add chat reducer, guide stream client and session id

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

## Task B6: `(fans)` 라우트 그룹, 레이아웃, Provider

**Files:**
- Move: `src/app/page.tsx` → `src/app/(fans)/page.tsx`, `src/app/artists` → `src/app/(fans)/artists`
- Create: `src/app/(fans)/layout.tsx`
- Create: `src/components/guide/GuideProvider.tsx`
- Modify: `src/lib/data.ts` (슬러그 목록 조회 추가)
- Modify: `.env.example`

**Interfaces:**
- Consumes: B1~B5의 모든 모듈, `requestFocus`, `getCurrentSection`
- Produces: `GuideProvider({ apiUrl, artistSlugs, children })`, `useGuide(): GuideApi`

```ts
type GuideApi = {
  state: ChatState;
  open: boolean;
  setOpen: (v: boolean) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  send: (text: string) => void;
  stop: () => void;
  retry: () => void;
};
```

- [ ] **Step 1: 파일 이동 (내용 변경 없음, `@/` 별칭이라 import 수정 불필요)**

```bash
mkdir -p "src/app/(fans)"
git mv src/app/page.tsx "src/app/(fans)/page.tsx"
git mv src/app/artists "src/app/(fans)/artists"
npx tsc --noEmit
```
Expected: 에러 없음. 주소(`/`, `/artists/aurora`)는 변하지 않는다.

- [ ] **Step 2: `getArtistSlugs` 추가**

`src/lib/data.ts`의 `getArtist` 함수 바로 아래에 추가 (패널이 slug 검증용으로만 쓰므로 트랙·갤러리 조인을 피한다):

```ts
// 가이드 패널의 액션 slug 재검증용. getArtists와 달리 조인 없이 slug만 읽는다.
export async function getArtistSlugs(): Promise<string[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("artists").select("slug");
  if (error) throw new Error(`getArtistSlugs: ${error.message}`);
  return byArtistDisplayOrder(data as { slug: string }[]).map((r) => r.slug);
}
```

- [ ] **Step 3: 레이아웃 작성**

```tsx
// src/app/(fans)/layout.tsx
import GuidePanel from "@/components/guide/GuidePanel";
import GuideProvider from "@/components/guide/GuideProvider";
import { getArtistSlugs } from "@/lib/data";

// A탭(/, /artists/[slug]) 공용 껍데기. 레이아웃은 이 안에서 이동해도 유지되므로
// 패널의 대화와 열림 상태가 사라지지 않는다. B탭(/staff)에는 실리지 않는다.
export default async function FansLayout({ children }: { children: React.ReactNode }) {
  const apiUrl = process.env.NEXT_PUBLIC_GUIDE_API_URL;
  // 에이전트 주소가 없으면 패널 없이 기존 화면만 보여 준다
  if (!apiUrl) return <>{children}</>;
  const artistSlugs = await getArtistSlugs();
  return (
    <GuideProvider apiUrl={apiUrl} artistSlugs={artistSlugs}>
      {children}
      <GuidePanel />
    </GuideProvider>
  );
}
```

- [ ] **Step 4: Provider 작성**

```tsx
// src/components/guide/GuideProvider.tsx
"use client";

import { useRouter } from "next/navigation";
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

  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); }, []);

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
```

- [ ] **Step 5: `.env.example`에 추가**

```
# 투어 가이드 에이전트(FastAPI) 주소. 브라우저가 직접 호출해서 NEXT_PUBLIC_ 이 필요하다 — 비밀 값이 아니다.
# 비우면 패널이 나타나지 않는다. 로컬 예: http://localhost:8000
NEXT_PUBLIC_GUIDE_API_URL=
```

- [ ] **Step 6: 확인**

`GuidePanel`은 B8에서 만든다. 이 단계에서는 타입 검사를 B8 후로 미루고 **B8까지 이어서 진행한 뒤** 함께 검증·커밋한다(B6·B7·B8은 한 커밋 단위로 묶는다).

## Task B7: 섹션 추적기와 hero id

**Files:**
- Create: `src/components/fans/ArtistSectionTracker.tsx`
- Modify: `src/app/(fans)/artists/[slug]/page.tsx`

- [ ] **Step 1: 추적기 작성**

```tsx
// src/components/fans/ArtistSectionTracker.tsx
"use client";

import { useEffect } from "react";
import { ARTIST_SECTIONS, isSection, setCurrentSection } from "@/lib/guide/sections";

// 화면 세로 가운데 선을 지나고 있는 섹션을 "현재 섹션"으로 기록한다. UI는 없다.
// rootMargin이 위아래 50%를 잘라 가운데 한 줄만 남기므로, 그 줄에 걸린 섹션만 intersecting이 된다.
export default function ArtistSectionTracker() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && isSection(e.target.id)) setCurrentSection(e.target.id);
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    ARTIST_SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => {
      io.disconnect();
      setCurrentSection(null);
    };
  }, []);
  return null;
}
```

- [ ] **Step 2: 아티스트 페이지에 연결**

`src/app/(fans)/artists/[slug]/page.tsx`에서:
1. import 추가: `import ArtistSectionTracker from "@/components/fans/ArtistSectionTracker";`
2. Hero `<section className="relative flex h-screen flex-col">`를 `<section id="hero" className="relative flex h-screen flex-col">`로 변경
3. `<main>` 안 맨 앞에 `<ArtistSectionTracker />` 추가

## Task B8: 패널 UI

**Files:**
- Create: `src/components/guide/GuidePanel.tsx`

- [ ] **Step 1: 패널 작성**

```tsx
// src/components/guide/GuidePanel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useGuide } from "@/components/guide/GuideProvider";
import { DICT, errorText, toolStatusText } from "@/lib/guide/dictionary";

const MAX_CHARS = 200; // 에이전트 L0 한도와 맞춤

export default function GuidePanel() {
  const g = useGuide();
  const L = DICT[g.locale];
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const streaming = g.state.status === "streaming";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [g.state.messages, g.state.toolKey, g.open]);

  if (!g.open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => g.setOpen(true)}
        className="fixed bottom-20 right-4 z-40 rounded-full bg-brand px-4 py-3 text-sm font-medium text-white shadow-lg hover:opacity-90 md:right-6"
      >
        {L.open}
      </button>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (streaming || !draft.trim()) return;
    g.send(draft);
    setDraft("");
  }

  return (
    <section
      aria-label={L.title}
      // 모바일: 하단 시트, 데스크톱: 오른쪽 아래 패널. 갤러리 라이트박스(z-50)보다 아래.
      className="fixed inset-x-0 bottom-0 z-40 flex h-[70dvh] flex-col rounded-t-2xl border border-white/15 bg-bg-dark/85 text-white backdrop-blur-md md:inset-x-auto md:bottom-6 md:right-6 md:h-[32rem] md:w-96 md:rounded-2xl"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold">{L.title}</h2>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-full border border-white/20 text-xs">
            {(["ko", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={g.locale === l}
                onClick={() => g.setLocale(l)}
                className={`px-2 py-1 ${g.locale === l ? "bg-brand text-white" : "text-white/60 hover:text-white"}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button type="button" aria-label={L.close} onClick={() => g.setOpen(false)} className="px-2 text-white/60 hover:text-white">
            ✕
          </button>
        </div>
      </header>

      <div ref={listRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {g.state.messages.length === 0 && <p className="text-white/50">{L.empty}</p>}
        {g.state.messages.map((m) => (
          <p
            key={m.id}
            className={`whitespace-pre-wrap rounded-2xl px-3 py-2 ${
              m.role === "user" ? "ml-8 bg-brand/30" : "mr-8 bg-white/10"
            }`}
          >
            {m.retracted ? L.retracted : m.text || (streaming && m.role === "assistant" ? "…" : "")}
          </p>
        ))}
        {streaming && g.state.toolKey && <p className="text-xs text-brand-soft">{toolStatusText(g.locale, g.state.toolKey)}</p>}
        {g.state.status === "error" && g.state.errorCode && (
          <p className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/80">
            {errorText(g.locale, g.state.errorCode)}{" "}
            {g.state.errorCode !== "off_topic" && g.state.errorCode !== "too_long" && (
              <button type="button" onClick={g.retry} className="ml-1 underline">
                {L.retry}
              </button>
            )}
          </p>
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_CHARS}
          placeholder={L.placeholder}
          className="min-w-0 flex-1 rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-soft"
        />
        {streaming ? (
          <button type="button" onClick={g.stop} className="rounded-lg border border-white/30 px-3 text-sm hover:border-white">
            {L.stop}
          </button>
        ) : (
          <button type="submit" disabled={!draft.trim()} className="rounded-lg bg-brand px-3 text-sm font-medium disabled:opacity-40">
            {L.send}
          </button>
        )}
      </form>
    </section>
  );
}
```

- [ ] **Step 2: 검증 (B6·B7·B8 합산)**

```bash
npx tsc --noEmit
npm run lint
npm test
```
Expected: 모두 통과. `useGuide`의 `send` 래핑(`(t) => void send(t)`)이나 reducer 린트 경고가 나오면 규칙에 맞게 고친다.

- [ ] **Step 3: 커밋**

```bash
git add -A src/app src/components/guide src/components/fans/ArtistSectionTracker.tsx src/lib/data.ts .env.example
git commit -m "feat: add tour guide panel, provider and artist section tracker

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

## Task B9: 로컬 에이전트 연동 확인

**선행 조건:** 위 "C1~C5 완료 확인"이 모두 체크돼 있어야 한다. 하나라도 미완료면 시작하지 않고 사용자에게 알린다. (B1~B8은 C1~C5와 무관하게 끝낼 수 있다.)

- [ ] **Step 1: 에이전트 서버 실행 (에이전트 저장소 루트에서)**

```bash
PYTHONPATH=src:. uv run --env-file .env uvicorn --factory tour_guide.main:build_app --port 8000
curl -s http://localhost:8000/health
```
Expected: `{"status":"ok"}`. 에이전트 `.env`의 `ALLOWED_ORIGINS` 기본값은 `http://localhost:3000`.

- [ ] **Step 2: on-stage 환경 설정 후 실행**

`.env.local`에 `NEXT_PUBLIC_GUIDE_API_URL=http://localhost:8000` 추가 → `npm run dev` (환경 변수는 서버 재시작 후 반영).

- [ ] **Step 3: 시나리오 확인 (사용자가 화면으로 확인)**

| # | 시나리오 | 기대 결과 |
| --- | --- | --- |
| 1 | `/`에서 패널 열기 | 버튼이 NOW 티커 위에 보이고, 열면 시트/패널이 뜬다. 네트워크 탭에 `/health` 1회 |
| 2 | "AURORA 다음 공연 알려줘" | 글자가 스트리밍되고, tool 상태 문구가 한 줄 보인다 |
| 3 | "NOVA에 대해 알려줘"(궤도에서) | 답변 끝에 NOVA가 정면으로 돌아와 커진다 (`focusArtist`) |
| 4 | "AURORA 투어 일정 보여줘"(궤도에서) | 포커스 후 `/artists/aurora#tour`로 이동하고 투어 섹션이 보인다. 패널 대화가 유지된다 |
| 5 | 아티스트 페이지에서 앨범 섹션을 보다가 "투어 일정 보여줘" | 요청 본문의 `context.section`이 `album`이고, 투어 섹션으로 스크롤된다 (C3 반영 확인) |
| 6 | 다른 아티스트 페이지에서 "NOVA 보여줘" | `/`로 이동해 NOVA 포커스, 또는 `openTour`면 NOVA 페이지로 이동 |
| 7 | 영어 토글 후 영어 질문 | 영어로 답하고 고정 문구(상태·오류)도 영어 |
| 8 | 답변 중 "멈추기" | 스트림이 끊기고 입력창이 돌아온다. 같은 세션의 다음 질문이 정상 동작 |
| 9 | 에이전트 서버를 끈 채 질문 | "연결이 끊겼어요" + "다시 시도". 서버를 켜고 다시 시도하면 성공 |
| 10 | 201자 이상 입력 시도 | 입력창이 200자에서 막힌다 |
| 11 | `/staff/dashboard`로 이동 | 패널이 보이지 않는다 |
| 12 | 라이트박스(갤러리 사진 열기) | 라이트박스가 패널 위를 덮는다 |

- [ ] **Step 4: 최종 검증**

```bash
npm run lint && npm test && npm run build
```
Expected: 모두 통과

- [ ] **Step 5: 결과 정리 후 커밋**

시나리오 결과(통과/실패)를 `docs/design-v3-tour-guide.md` 끝에 "§12 연동 확인 결과"로 적고 커밋한다.

```bash
git add docs/design-v3-tour-guide.md
git commit -m "docs: record tour guide integration check results

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review 결과 (작성자 점검)

- **설계 커버리지:** D1·D2(A3), D3(A4), D4(A3 dpr·분할), D5(A1·A2·A3·A5), D6·D7(B3·B7), D8·D9(B3 `planAction`, B6 `execute`), D10(B6), D11(B5 reducer + B6 Context), D12(B1·B2·B5), D13(B6 `runAction`), D14(B6 locale·env). 체크포인트 11개는 설계 §3과 동일하고 ★ 표시는 #1,3,5,6,7,9,11.
- **계약 사실 반영:** SSE `event:`/`data:` 형식, `action` data가 액션 객체 그대로임, 오류 코드 6종, `retract`는 사전 문구로 교체(B4·B5).
- **알려진 가정(Task 0에서 문서로 확인):** `searchParams`가 Promise, `router.push` 해시 스크롤, 레이아웃 유지. 어긋나면 해당 Task의 코드를 문서에 맞춰 수정한다.
- **설계 대비 단순화:** 카메라 dolly 제거(설계 문서에 반영함), focus 강조는 React state 없이 ref로.
