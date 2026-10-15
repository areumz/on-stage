# ON-STAGE 3차 구현 계획 v3 — 투어 가이드 에이전트 연동 (Implementation Plan v3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> 이 문서는 **2a(궤도 3D 교체)** 와 **2b 프런트(채팅 패널·SSE·액션)** 를 한 파일에 잇는다.
> 2a 끝에 **체크포인트(정지선)** 가 있고, 화면을 확인하기 전에는 2b를 시작하지 않는다.

**Goal:** `/`의 궤도 화면을 입체(R3F)로 바꾸고(평면 2D 폴백 유지), 에이전트와 SSE로 대화하는 채팅 패널과 `focusArtist`·`openTour` 액션 처리를 붙인다.

**Architecture:** 새 `OrbitScene3D`를 추가하고 기존 평면 `OrbitScene`은 폴백으로 남긴다. 두 씬은 모듈 수준 focus 저장소를 구독해 카메라 포커스(궤도 묶음 회전)에 반응한다. 패널은 `(fans)` 라우트 그룹 레이아웃의 Provider에 두어 `/` ↔ `/artists/[slug]` 이동에도 대화가 유지된다. SSE 파싱·이벤트 검증·액션 계획·reducer는 순수 함수로 분리해 vitest로 검증한다.

**Tech Stack:** Next.js 16.2.12 (App Router) / React 19.2.4 / `@react-three/fiber` 9 · `three` · `@react-three/drei` 10 / Tailwind CSS 4 / vitest (node 환경, 순수 함수만)

**승인된 설계:** [`docs/design-v3-tour-guide.md`](./design-v3-tour-guide.md). 결정 D1~D14와 근거의 **단일 진실 공급원은 그 문서다.** 이 계획은 그것을 구현 단위로 쪼갠 것이다.

**브랜치:** `feat/tour-guide-agent`

---

## Global Constraints

모든 Task에 적용된다. 이 절의 요구사항은 각 Task의 완료조건에 암묵적으로 포함된다.

### 프로젝트 규칙

- **`AGENTS.md`:** Next 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 관련 문서를 읽는다(Task 0).
- **에이전트 저장소의 `contracts/`는 읽기 전용이다.** 계약 변경은 설계 §7의 "계약 갱신 요청"으로만 전달한다.
- **새 의존성 추가 금지.** zod·상태 라이브러리를 포함한다. 이벤트 검증은 손으로 쓴 타입 가드 + 에이전트 fixture 테스트로 한다.
- **`useFrame` 안에서 React state를 갱신하지 않는다.** 회전·강조·포커스는 ref로만 처리한다(design.md §9, v2.2 Canvas 재구성 문제).
- **Effect 본문의 동기 `setState` 금지**(`react-hooks/set-state-in-effect`). 외부 값은 `useSyncExternalStore` 패턴을 쓴다(`src/lib/hooks.ts`의 `stageListeners`와 동일).
- **대화는 메모리에만 둔다.** `sessionStorage`에는 `sessionId`만 두고 접근은 try/catch로 감싼다.
- **입력 길이 `maxLength=200`**(에이전트 L0 한도).
- **`NEXT_PUBLIC_`은 `NEXT_PUBLIC_GUIDE_API_URL` 하나만 허용**한다(비밀이 아닌 URL, 브라우저가 직접 호출).
- **테스트는 로직(순수 함수)만, 환경은 node.** 컴포넌트 테스트는 쓰지 않는다(저장소 관례).
- **TDD:** 순수 함수 Task는 실패하는 테스트 → 실패 확인 → 구현 → 통과 확인 순서를 지킨다.
- **체크포인트 승인 전에는 파트 B의 어떤 Task도 시작하지 않는다.**
- 커밋 컨벤션: Conventional Commits(`feat:` `fix:` `refactor:` `docs:`), 소문자 명령형.

### 범위 밖 (선제 구현 금지)

설계 §11을 그대로 따른다. 특히 손이 갈 만한 것:

- `TourOrbit.tsx`(아티스트 페이지의 도시 궤도)를 3D로 바꾸는 것 — 4단계 `highlightCity` 때 재검토한다.
- 카메라 dolly(포커스 시 카메라 당김), 드래그 자유 회전(`OrbitControls`), 장식 파티클, 자동 품질 조절.
- DOM/CSS 전용 2D 폴백(WebGL이 안 되는 브라우저 대응).
- 추천 칩, `busy`·세션 턴 상한, `highlightCity` 처리 — 에이전트 4단계 항목.
- 대화 저장, 상태 라이브러리.

---

## 파일 구조 (최종 목표)

```
src/
├── app/
│   └── (fans)/                          # 신규 라우트 그룹 — 주소는 변하지 않는다
│       ├── layout.tsx                   # 신규 — Provider + 패널 (Task B6)
│       ├── page.tsx                     # 이동 + 수정 — 플래그 분기, ?focus= (Task A4, B6)
│       └── artists/[slug]/page.tsx      # 이동 + 수정 — id="hero", 추적기 (Task B6, B7)
├── lib/
│   ├── geometry.ts                      # 수정 — 기울기·회전 목표 함수 (Task A1)
│   ├── geometry.test.ts                 # 수정 — TDD (Task A1)
│   ├── data.ts                          # 수정 — getArtistSlugs() (Task B6)
│   └── guide/                           # 신규
│       ├── orbitFocus.ts / .test.ts     # focus 요청 저장소 (Task A2)
│       ├── sse.ts / .test.ts            # SSE 파서 (Task B1)
│       ├── events.ts / .test.ts         # 이벤트·액션 타입 가드 (Task B2)
│       ├── guide_events_sample.json     # 에이전트 fixture 복사본, 수정 금지 (Task B2)
│       ├── sections.ts                  # 섹션 값·현재 섹션 (Task B3)
│       ├── context.ts / .test.ts        # context 만들기 (Task B3)
│       ├── actions.ts / .test.ts        # 액션 계획 (Task B3)
│       ├── dictionary.ts / .test.ts     # ko/en 고정 문구 (Task B4)
│       ├── chat.ts / .test.ts           # 대화 reducer (Task B5)
│       ├── stream.ts / .test.ts         # fetch 스트림 클라이언트 (Task B5)
│       └── session.ts                   # sessionId (Task B5)
└── components/
    ├── three/
    │   ├── orbitShared.tsx              # 신규 — 반경·FOV·카메라 리그·회전 훅·FocusFromQuery (Task A3)
    │   ├── OrbitScene3D.tsx             # 신규 — 입체 궤도 (Task A3)
    │   └── OrbitScene.tsx               # 수정 — 2D 폴백, 공용 모듈 사용 + focus 반응 (Task A5)
    ├── guide/
    │   ├── GuideProvider.tsx            # 신규 — 상태·스트림·액션 실행 (Task B6)
    │   └── GuidePanel.tsx               # 신규 — 패널 UI (Task B8)
    └── fans/
        └── ArtistSectionTracker.tsx     # 신규 — 현재 섹션 감지 (Task B7)
```

`.env.example`에는 `ORBIT_VIEW`(Task A4)와 `NEXT_PUBLIC_GUIDE_API_URL`(Task B6)이 추가된다.

---

## Task 순서와 의존관계

```
Task 0   사전 준비 (npm install, Next 문서, 실측)
 ↓
Task A1  geometry 회전 목표 함수 (TDD)
Task A2  focus 요청 저장소 (TDD)
 ↓
Task A3  공용 모듈 + OrbitScene3D
Task A4  플래그 분기와 ?focus=
Task A5  2D 폴백 갱신
 ↓
⛔ 체크포인트 — 사용자 확인·승인 (이 선을 넘기 전에 파트 B 금지)
 ↓
Task B1  SSE 파서 (TDD)            ┐
Task B2  이벤트 타입 가드 (TDD)     │ 서로 독립 — 순서 무관
Task B3  섹션·context·액션 계획 (TDD)│
Task B4  ko/en 사전 (TDD)          ┘
Task B5  대화 reducer·스트림·세션 (TDD, B2·B4 필요)
Task B6  (fans) 그룹 이동 + Provider (B1~B5 필요)
Task B7  섹션 추적기 + hero id
Task B8  패널 UI (B6 필요)
   ↓ (선행 조건: 계약 갱신 C1~C5 완료)
Task B9  로컬 에이전트 연동 확인
```

A1·A2는 서로 독립이다. A3은 A1·A2에 의존하고, A4·A5는 A3 이후 어느 순서든 된다. B6·B7·B8은 한 커밋 단위로 묶는다(B8의 `GuidePanel`이 있어야 B6의 레이아웃이 타입 검사를 통과한다).

---

### Task 0: 사전 준비 — 설치, Next 문서 읽기, 실측

**Files:**

- Modify: `docs/design-v3-tour-guide.md` (§8 표의 "대응" 열에 실측 결과 기록)

**왜**: `node_modules`가 설치돼 있지 않아 `AGENTS.md`가 요구하는 Next 16 문서를 아직 읽지 못했다. 이 계획의 몇 가지 가정을 문서로 확인해야 한다.

**주의**:

1. `.env.local`이 없으면 **멈추고 사용자에게 요청한다.** `next dev`·`next build`는 `SUPABASE_URL`(`next.config.ts`가 읽음)과 `SUPABASE_ANON_KEY`가 있어야 돈다. 값을 추측하거나 만들지 않는다.
2. 문서가 이 계획의 가정과 다르면 해당 Task를 문서에 맞게 고치고, 바꾼 이유를 설계 §8에 적는다.

- [ ] **Step 1: 의존성 설치와 기준선 확인** — `npm install` 후 `npm test`, `npm run lint`. 실패하면 이 계획과 무관한 기존 문제이므로 기록만 하고 사용자에게 알린다
- [ ] **Step 2: `.env.local` 존재 확인** — 없으면 사용자에게 요청
- [ ] **Step 3: Next 문서에서 4가지 확인** (`node_modules/next/dist/docs/`) - `searchParams`가 page props에서 `Promise`인지 → Task A4의 `await searchParams` 여부 - `router.push("/path#id")`가 도착 후 해시 위치로 스크롤하는지 → 아니면 Task B6 실행부에 도착 후 `scrollIntoView` 추가 - 라우트 그룹 `(fans)`의 레이아웃이 그룹 내 페이지 이동에서 유지되는지 → Task B6 - 서버 컴포넌트 레이아웃이 `process.env`를 읽어 클라이언트 컴포넌트 prop으로 넘겨도 되는지 → Task B6
- [ ] **Step 4: 결과를 설계 §8에 기록하고 커밋** (변경이 없으면 커밋하지 않는다)

**완료조건:**

- `npm test`, `npm run lint` 기준선이 통과(또는 기존 실패가 기록됨)
- 위 4가지 확인 결과가 설계 §8에 적혀 있다

---

# 파트 A — 2a: 3D 궤도

### Task A1: 회전 목표 각도 순수 함수 (TDD)

**Files:**

- Modify: `src/lib/geometry.ts`
- Modify: `src/lib/geometry.test.ts`

**Interfaces:**

- Produces: `ORBIT_TILT: number`(rad, 약 -50°), `FACE_ANGLE_3D: number`(-π/2), `FACE_ANGLE_2D: number`(π/2), `shortestAngleDelta(from: number, to: number): number`(결과 범위 (-π, π]), `focusRotationTarget(current: number, nodeAngle: number, faceAngle: number): number`

**왜**: 설계 D5. 포커스는 카메라를 옮기는 대신 궤도 묶음을 돌려 해당 노드가 정면에 오게 한다. 자동 회전이 계속 누적되므로 "가장 짧은 방향으로 도는 목표값" 계산이 핵심이고, 순수 함수라 vitest로 검증한다.

**주의**:

1. 노드의 최종 월드 각도 = `nodeAngle + 회전값`. 이 값이 `faceAngle`과 같아지도록 목표 회전값을 구한다.
2. 회전값은 자동 회전으로 여러 바퀴 누적될 수 있다. 결과는 항상 `current` 근처(반 바퀴 이내)여야 한다 — 되감기 방지.
3. `ORBIT_TILT`는 음수다: X축으로 기울였을 때 -y쪽(화면 아래)이 카메라에 가까워져 "정면"이 `-π/2`가 된다. 2D 폴백은 기울이지 않으므로 화면 위쪽(`π/2`)을 정면으로 쓴다.

- [ ] **Step 1: 실패하는 테스트 추가** — `shortestAngleDelta`: 같은 각도면 0, 2π 경계를 넘어 짧은 쪽으로(`0.1 → 2π-0.1`은 -0.2, 반대는 +0.2). `focusRotationTarget`: 반환값을 적용한 노드의 최종 각도가 `faceAngle`과 같다(2π 정규화 후 비교), `current=20`처럼 크게 누적돼도 `|target - current| ≤ π`
- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/geometry.test.ts`. Expected: FAIL (export 없음)
- [ ] **Step 3: 최소 구현**
- [ ] **Step 4: 통과 확인** — 기존 `cameraDistanceForRadius` 테스트 포함 전부 PASS
- [ ] **Step 5: 커밋** — `feat: add orbit focus rotation helpers`

**완료조건:**

- 새 테스트 전부 통과, 기존 geometry 테스트 회귀 없음

---

### Task A2: focus 요청 저장소 (TDD)

**Files:**

- Create: `src/lib/guide/orbitFocus.ts`
- Create: `src/lib/guide/orbitFocus.test.ts`

**Interfaces:**

- Produces: `type FocusRequest = { slug: string; nonce: number }`, `requestFocus(slug: string): void`, `takeFocus(): FocusRequest | null`, `subscribeFocus(l: () => void): () => void`, `useFocusRequest(): FocusRequest | null`

**왜**: 설계 §2.4. 에이전트 액션·`?focus=` 쿼리·아티스트 페이지에서 궤도로 돌아오는 경우가 모두 같은 경로로 궤도 씬에 포커스를 요청한다. 요청은 모듈 변수에 남아 씬이 나중에 마운트돼도 받을 수 있어야 한다.

**주의**:

1. `takeFocus`는 **한 번만** 요청을 돌려준다 — `/`로 다시 돌아왔을 때 옛 요청이 재실행되면 안 된다.
2. 같은 slug를 다시 요청해도 새 요청(`nonce` 증가)으로 취급한다 — 같은 아티스트를 다시 포커스할 수 있어야 한다.
3. 요청하면 구독자에게 알린다(`useSyncExternalStore`로 렌더를 일으키는 용도). 값을 꺼내 쓰는 쪽은 `takeFocus`다.
4. 파일 맨 위에 `"use client"`(훅 포함).

- [ ] **Step 1: 실패하는 테스트 작성** — ① 요청 후 `takeFocus`는 한 번만 값을 주고 두 번째는 `null`, ② 같은 slug 재요청 시 `nonce`가 증가, ③ 요청 시 구독자가 한 번 호출되고 해제 후엔 호출되지 않음
- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/guide/orbitFocus.test.ts`. Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `feat: add orbit focus request store`

**완료조건:**

- 새 테스트 3건 통과

---

### Task A3: 공용 모듈 + OrbitScene3D

**Files:**

- Create: `src/components/three/orbitShared.tsx`
- Create: `src/components/three/OrbitScene3D.tsx`

**Interfaces:**

- Consumes: `focusRotationTarget`, `cameraDistanceForRadius`, `ringPoints`, `ORBIT_TILT`, `FACE_ANGLE_3D`(geometry.ts), `takeFocus`·`useFocusRequest`·`requestFocus`(orbitFocus.ts)
- Produces: `RING_RADII`, `FOV_DEG`, `OrbitCameraRig()`, `useOrbitSpin(artists: Artist[], faceAngle: number): { groupRef, rotation, focused }`(세 값 모두 ref), `FocusFromQuery({ slug })`

**왜**: 설계 D1·D2·D4·D5. 기존 평면 `OrbitScene`을 건드리지 않고 입체 씬을 새 파일로 추가한다. 두 씬이 반경·FOV·카메라 리그·회전 로직을 공유하도록 공용 모듈을 만든다.

**주의**:

1. **모양(D1):** 궤도 3개를 한 묶음으로 `ORBIT_TILT`만큼 기울이고, 노드는 구체(`sphereGeometry`, 분할 24×24) + 아티스트 `color` 발광. 조명은 앰비언트 1 + 방향광 1뿐이다(그림자·후처리 없음).
2. **라벨:** drei `<Html>`의 `<button>`으로 만든다(키보드 포커스·클릭 진입). `zIndexRange`를 낮춰(`[20, 0]`) 패널(z-40) 아래에 깔리게 한다 — 기본값은 매우 커서 패널을 덮는다.
3. **회전 훅:** 자동 회전, focus 요청 소비(`takeFocus`), 목표 회전으로의 감속(`MathUtils.damp`), 도착 후 약 8초 뒤 자동 회전 재개 — 전부 ref + `useFrame`으로 처리하고 **React state를 쓰지 않는다.** 강조(확대 1.35배)와 hover(1.2배)도 `useFrame`에서 `scale`로 적용한다.
4. **모바일(D4):** `OrbitScene3D`는 `Scene3D`에 `dpr={[1, 1.5]}`를 넘긴다(`Scene3D`가 `canvasProps`로 덮어쓰기를 이미 허용한다).
5. **카메라:** 기존 `cameraDistanceForRadius`를 그대로 재사용한다. 기울이면 세로 폭이 줄어 더 안전하다. 체크포인트에서 잘리면 `CAMERA_MARGIN`을 조정한다.
6. 노드 hover(커서 손가락)·클릭(`/artists/[slug]` 이동)은 기존과 같게 유지한다.
7. `FocusFromQuery`는 마운트 시 `requestFocus(slug)`를 한 번 호출한다. 모르는 slug는 회전 훅이 무시한다.

- [ ] **Step 1: `orbitShared.tsx` 작성** — 상수, `OrbitCameraRig`(기존 `OrbitScene`의 리그를 옮김), `useOrbitSpin`, `FocusFromQuery`
- [ ] **Step 2: `OrbitScene3D.tsx` 작성** — 노드 컴포넌트, 기울인 궤도 묶음, `Scene3D` 래핑
- [ ] **Step 3: `npx tsc --noEmit && npm run lint` 통과 확인** — ref를 렌더 중에 읽었다는 린트가 나오면 `useFrame`·이벤트 핸들러 안에서만 읽도록 고친다
- [ ] **Step 4: 커밋** — `feat: add tilted 3D orbit scene with focus support`

**완료조건:**

- 타입 검사·린트 통과
- (체크포인트에서 확인) 입체 궤도가 표시되고 포커스가 동작한다

---

### Task A4: 플래그 분기와 `?focus=`

**Files:**

- Modify: `src/app/page.tsx`
- Modify: `.env.example`

**Interfaces:**

- Consumes: `OrbitScene3D`, `OrbitScene`(default export), `FocusFromQuery`

**왜**: 설계 D3. 문제가 생기면 평면 궤도로 돌아갈 수 있어야 하고, 에이전트가 없어도 포커스 동작을 눈으로 확인할 수 있어야 한다.

**주의**:

1. **우선순위:** `?orbit=2d` > 서버 환경변수 `ORBIT_VIEW=2d` > 기본 3D. `page.tsx`는 서버 컴포넌트라 `searchParams`와 서버 env를 그대로 읽는다 — `NEXT_PUBLIC_`을 쓰지 않아 브라우저에 노출되지 않는다.
2. 쿼리 이름을 `view`로 하지 않는다 — 에이전트 계약의 `context.view`(`orbit | tour`)와 헷갈린다.
3. `searchParams`가 `Promise`인지는 Task 0의 확인 결과를 따른다.
4. `?focus=<slug>`는 `FocusFromQuery`를 렌더해 요청을 보낸다. 중앙 문구·티커 등 나머지 레이아웃은 그대로 둔다.

- [ ] **Step 1: `page.tsx`에서 `searchParams` 읽기, 플래그에 따라 `OrbitScene`/`OrbitScene3D` 선택, `?focus=` 처리**
- [ ] **Step 2: `.env.example`에 `ORBIT_VIEW` 설명 추가**
- [ ] **Step 3: `npx tsc --noEmit && npm run lint` 통과 확인**
- [ ] **Step 4: 커밋** — `feat: switch orbit renderer by ?orbit=2d or ORBIT_VIEW and accept ?focus`

**완료조건:**

- 타입 검사·린트 통과
- `/`는 3D, `/?orbit=2d`는 평면(기존 화면)

---

### Task A5: 2D 폴백이 공용 모듈을 쓰고 focus에 반응

**Files:**

- Modify: `src/components/three/OrbitScene.tsx`
- Modify: `README.md` (A탭 설명에 `?orbit=2d` 한 줄. 구조가 맞지 않으면 설계 문서만 갱신)

**왜**: 설계 D5. 액션은 렌더러와 무관하므로 2D 폴백도 같은 포커스 요청에 반응해야 한다(3D가 지연돼도 2b를 먼저 진행할 수 있어야 한다).

**주의**:

1. **노드 모양·라벨(평면 원판 + 이니셜 + `Text`)은 바꾸지 않는다.** 폴백이므로 현재 화면과 동일해야 한다.
2. 바뀌는 것은 세 가지뿐이다: 반경·FOV·카메라 리그를 `orbitShared`에서 가져오기, 자동 회전을 `useOrbitSpin(artists, FACE_ANGLE_2D)`로 교체, 포커스된 노드의 확대(1.35배)를 `useFrame`에서 적용.
3. 기존의 "부모 회전 상쇄(텍스트 정립)" 동작은 유지한다 — 훅이 돌려주는 `rotation` ref를 쓴다.
4. 확대는 JSX `scale` prop이 아니라 `useFrame`에서 한 곳에서만 적용한다(두 곳에서 적용하면 서로 덮어쓴다).

- [ ] **Step 1: `OrbitScene.tsx`를 공용 모듈 기반으로 정리**
- [ ] **Step 2: `npx tsc --noEmit && npm run lint && npm test` 통과 확인**
- [ ] **Step 3: README 한 줄 추가**
- [ ] **Step 4: 커밋** — `refactor: share orbit camera and spin with the 3D scene, react to focus in 2D fallback`

**완료조건:**

- 타입·린트·테스트 통과
- `/?orbit=2d`가 이전과 같은 모습이고, `/?orbit=2d&focus=nova`에서 NOVA가 위쪽으로 돌아와 커진다

---

# ⛔ 체크포인트 — 2a 끝, 여기서 멈춘다

**구현자는 여기서 멈추고 사용자에게 아래 표를 보여 준 뒤, 사용자가 화면을 직접 확인해 승인하기 전에는 파트 B를 시작하지 않는다.**

확인 방법: `npm run dev` → `http://localhost:3000`. 모바일은 DevTools 기기 에뮬레이션(375·390·768px)과 가능하면 실제 폰 1대.
★ = 핵심 항목(하나라도 실패하면 승인하지 않는다).

| #   | 핵심 | 확인 항목                 | 통과 기준                                                                                                                 | 어떻게 보나                    |
| --- | ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | ★    | 3D 궤도가 보인다          | 구체 노드 6개, 기울어진 궤도 3개, 라벨 6개가 보이고 읽기 어렵게 겹치지 않는다                                             | `/` 첫 화면                    |
| 2   |      | 입체감이 읽힌다           | 앞쪽 노드가 뒤쪽보다 크게 보이고, 회전하면 크기가 오르내린다                                                              | 10초 관찰                      |
| 3   | ★    | hover·클릭이 기존과 같다  | 노드에 올리면 커지고 커서가 손가락, 클릭하면 `/artists/<slug>`로 이동. 라벨 클릭도 이동                                   | 6명 모두                       |
| 4   |      | 키보드로 들어갈 수 있다   | Tab으로 라벨에 포커스, Enter로 이동                                                                                       | 키보드만 사용                  |
| 5   | ★    | 모바일 레이아웃·조작 유지 | 375px에서 노드가 안 잘리고, 탭하면 진입, 중앙 문구·NOW 티커·헤더가 그대로                                                 | 에뮬레이션 + 실기기            |
| 6   | ★    | 2D 폴백 복귀              | `/?orbit=2d`가 지금과 같은 평면 화면. env `ORBIT_VIEW=2d`로도 같다                                                        | 주소 변경 / env 변경 후 재시작 |
| 7   | ★    | 카메라 포커스             | `/?focus=nova`로 열면 NOVA가 정면으로 돌아와 커진다. `/?focus=unknown`은 아무 일 없음. `/?orbit=2d&focus=nova`도 회전한다 | 주소창                         |
| 8   |      | 프레임이 끊기지 않는다    | Performance monitor FPS: 데스크톱 55 이상, CPU 4× 느리게 30 이상                                                          | 30초 관찰                      |
| 9   | ★    | `webglcontextlost` 0건    | 아래 스니펫을 콘솔에 붙인 뒤 `/`↔`/artists/aurora`를 10회 오가고 창 크기를 바꿔도 0                                       | 아래 스니펫                    |
| 10  |      | 다른 화면이 그대로다      | `/artists/aurora`의 Hero·투어 궤도·앨범·갤러리가 이전과 같다                                                              | 스크롤                         |
| 11  | ★    | 빌드·테스트               | `npm run lint`, `npm test`, `npm run build` 통과                                                                          | 터미널                         |

**#9 콘솔 스니펫** — 페이지에 붙여 넣고 새로고침 없이 조작한다. `window.__lost`가 0이어야 한다. 구현은 `canvas`에 `webglcontextlost` 리스너를 `MutationObserver`로 붙이고 발생 시 `console.warn("LOST", ++window.__lost)`를 찍는 몇 줄짜리 코드다. (Next의 클라이언트 이동은 페이지를 새로 로드하지 않으므로 이동 중에도 계속 감시된다. 새로고침하면 다시 붙인다.)

**실패 시 조정:**

- 노드가 잘리면(#5): `orbitShared`의 `CAMERA_MARGIN`을 올리거나 `ORBIT_TILT`를 줄인다(조정 후 재확인).
- 조명이 어둡거나 과하면: `OrbitScene3D`의 조명 intensity와 노드 `emissiveIntensity`를 조정한다.

## 선행 조건 — 계약 갱신 C1~C5 (Task B9 시작 전까지 완료)

에이전트 저장소 쪽 작업이다. 사용자에게 완료를 확인받고 **Task B9 시작 전에** 체크한다. B1~B8은 이 작업과 무관하게 진행할 수 있다. 상세 내용은 설계 §7이다.

- [ ] **C1** `context.section` 추가 — `ViewContext.section?: "hero" | "tour" | "album" | "gallery"`
- [ ] **C2** `openTour.section` 정의 — 같은 4개 값, 생략하면 `tour`
- [ ] **C3** 서버 중복 필터를 "현재 section == 목표 section"일 때만 거르도록 갱신 (지금은 `view=tour`이고 slug가 같으면 `openTour`를 안 보내서 앨범을 보던 사용자가 "투어 보여줘" 해도 스크롤이 안 일어난다)
- [ ] **C4** 프롬프트의 현재 화면 표기에 section 포함
- [ ] **C5** fixture에 section이 들어간 요청·`openTour.section` 샘플 추가

---

# 파트 B — 2b: 채팅 패널, SSE, 액션

### Task B1: SSE 파서 (TDD)

**Files:**

- Create: `src/lib/guide/sse.ts`
- Create: `src/lib/guide/sse.test.ts`

**Interfaces:**

- Produces: `type SseMessage = { event: string; data: string }`, `createSseParser(): (chunk: string) => SseMessage[]`

**왜**: 설계 D12. `POST` 본문이 있어 `EventSource`를 쓸 수 없고 `fetch` 스트림을 직접 읽어야 한다. 네트워크 조각은 메시지 중간에서 잘릴 수 있어 파서가 버퍼를 가져야 한다.

**주의**:

1. 프레임 형식: `event:` 줄에 이벤트 이름, `data:` 줄에 JSON, **빈 줄이 메시지의 끝**이다(에이전트 계약).
2. `\r\n`을 정규화하고, `:`로 시작하는 주석 줄은 건너뛴다. `data`가 없는 블록은 버린다.
3. 미완성 부분은 다음 조각이 올 때까지 버퍼에 남긴다.

- [ ] **Step 1: 실패하는 테스트 작성** — ① 한 쌍을 메시지로, ② 이름/본문이 조각 경계에서 잘려도 이어 붙임, ③ 한 조각에 여러 이벤트가 있어도 순서대로, ④ CRLF + 주석 줄, ⑤ `data` 없는 블록은 버림
- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/guide/sse.test.ts`. Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `feat: add SSE message parser`

**완료조건:**

- 새 테스트 5건 통과

---

### Task B2: 이벤트 타입과 타입 가드 (TDD, fixture 검증)

**Files:**

- Create: `src/lib/guide/events.ts`
- Create: `src/lib/guide/events.test.ts`
- 복사 추가: `src/lib/guide/guide_events_sample.json` (에이전트 `contracts/fixtures/guide_events_sample.json`의 사본, **수정 금지**)

**Interfaces:**

- Produces: `ERROR_CODES`(6종), `type ErrorCode`, `type UiAction`(focusArtist | openTour | highlightCity), `type GuideEvent`(6종), `parseGuideEvent(name: string, raw: string): GuideEvent | null`

**왜**: 설계 D12·§9. 서버가 보낸 값을 그대로 믿지 않고 모양을 검사해 알 수 없는 것은 무시한다(액션 규칙 1·4).

**주의**:

1. 일반 이벤트의 `data`에는 `event` 필드가 **없다**(`{"text": "..."}`). `action`의 `data`는 **액션 객체 그대로**다(`{"type":"focusArtist","slug":"aurora"}`) — `action` 키로 감싸지 않는다.
2. 해석할 수 없으면 `null`을 돌려주고 호출부는 건너뛴다: 깨진 JSON, 모르는 이벤트 이름, 필드 타입 불일치, **모르는 액션 `type`**.
3. 모르는 오류 코드는 `internal`로 바꾼다.
4. `openTour.section`은 없어도 되고, 문자열이면 보존한다.
5. fixture 테스트는 `success`·`error` 배열의 모든 이벤트가 해석되는지 확인한다.

- [ ] **Step 1: 실패하는 테스트 작성** — fixture 전부 해석, `action` 객체 형태, 깨진 JSON/모르는 이름/타입 불일치/모르는 액션 → `null`, `openTour`의 `section` 유무, 모르는 오류 코드 → `internal`
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — JSON import 타입 에러가 나면 `tsconfig.json`의 `resolveJsonModule`을 확인한다(`artists.json`을 이미 import하므로 켜져 있을 것)
- [ ] **Step 5: 커밋** — `feat: add guide event types, guards and agent fixture test`

**완료조건:**

- 새 테스트 통과, fixture 파일이 원본과 같다(수정하지 않음)

---

### Task B3: 섹션 값, context, 액션 계획 (TDD)

**Files:**

- Create: `src/lib/guide/sections.ts`, `src/lib/guide/context.ts`, `src/lib/guide/actions.ts`
- Create: `src/lib/guide/context.test.ts`, `src/lib/guide/actions.test.ts`

**Interfaces:**

- Consumes: `UiAction`(events.ts)
- Produces:
  - `ARTIST_SECTIONS`(`hero|tour|album|gallery`), `type ArtistSection`, `isSection(v: unknown): v is ArtistSection`, `setCurrentSection(s: ArtistSection | null): void`, `getCurrentSection(): ArtistSection | null`
  - `type GuideContext = { view: "orbit" | "tour"; slug?: string; section?: ArtistSection }`, `contextFromPath(pathname: string, section: ArtistSection | null): GuideContext | null`
  - `type ActionPlan = none | focus | gotoOrbit | scroll | navigate`, `planAction(action: UiAction, ctx: GuideContext | null, knownSlugs: readonly string[]): ActionPlan`

**왜**: 설계 D6~D9. 어디를 보고 있는지(`context`)와 액션이 무엇을 해야 하는지(`planAction`)는 판단 로직이라 순수 함수로 분리해 검증한다. 실행(`router.push` 등)은 Provider가 한다.

**주의**:

1. **섹션 값은 DOM id와 같다**: `hero`, `tour`, `album`, `gallery`.
2. **현재 섹션은 React state가 아닌 모듈 변수**다 — 요청을 보내는 순간에만 읽으므로 스크롤마다 렌더가 일어나지 않게 한다.
3. **`contextFromPath`:** `/` → `{view:"orbit"}`(section 안 붙임), `/artists/<slug>`(끝 슬래시 허용) → `{view:"tour", slug, section?}`, 그 밖(staff 등) → `null`. 주소(URL)가 유일한 진실이다.
4. **`planAction` 규칙:**
   - `ctx`가 `null`이거나 `slug`가 `knownSlugs`에 없으면 `none`(실행 전 재검증)
   - `focusArtist`: 궤도면 `focus`, 아티스트 페이지면 `gotoOrbit`
   - `openTour`: `section`이 모르는 값이면 `tour`. 같은 아티스트 페이지면 `scroll`, 궤도면 `navigate`(+`focusSlug`), 다른 아티스트 페이지면 `navigate`(포커스 연출 없음)
   - 경로는 `/artists/<slug>#<section>`, `hero`는 해시 없이 `/artists/<slug>`. **외부 URL은 절대 만들지 않는다.**
   - `highlightCity`는 `none`(에이전트 4단계)

- [ ] **Step 1: `sections.ts` 작성** (상수·변수라 테스트 없음)
- [ ] **Step 2: 실패하는 테스트 작성** — `context`: `/`, 아티스트 페이지(section 유무), 끝 슬래시, `/staff/…`·`/artists` → `null`, orbit에는 section 미포함. `actions`: 모르는 slug → none, 궤도 focus, 아티스트 페이지 focus → gotoOrbit, 궤도 openTour(navigate+focusSlug), 같은 페이지 scroll(기본 tour / album), 다른 페이지 navigate, 모르는 section → tour, hero → 해시 없음, highlightCity → none, ctx null → none
- [ ] **Step 3: 실패 확인** — Run: `npx vitest run src/lib/guide/context.test.ts src/lib/guide/actions.test.ts`
- [ ] **Step 4: 구현**
- [ ] **Step 5: 통과 확인**
- [ ] **Step 6: 커밋** — `feat: add guide context builder and action planner`

**완료조건:**

- 새 테스트 통과

---

### Task B4: ko/en 고정 문구 사전 (TDD)

**Files:**

- Create: `src/lib/guide/dictionary.ts`, `src/lib/guide/dictionary.test.ts`

**Interfaces:**

- Consumes: `ERROR_CODES`, `ErrorCode`(events.ts)
- Produces: `type Locale = "ko" | "en"`, `DICT: Record<Locale, UiStrings>`, `toolStatusText(locale, key): string`, `errorText(locale, code: ErrorCode | "network"): string`

**왜**: 안내 문구는 서버(LLM)가 만들지 않고 코드·키로 프런트 사전이 표시한다(설계 §4, 에이전트 계약).

**주의**:

1. **모든 오류 코드(6종)와 `network`에 ko/en 문구가 있어야 한다** — `busy`도 4단계 전이지만 미리 넣는다.
2. 도구 키는 `tool.listArtists`·`tool.getArtist`·`tool.searchShows`. 모르는 키는 일반 문구로 대체한다.
3. `off_topic`·`too_long` 문구는 재시도 버튼 없이도 이해되게 쓴다(같은 입력을 다시 보내도 같은 결과).
4. 패널의 고정 문구(제목·열기·닫기·플레이스홀더·보내기·멈추기·다시 시도·빈 상태·`retract` 대체 문구)도 같은 사전에 둔다.

- [ ] **Step 1: 실패하는 테스트 작성** — 모든 `ERROR_CODES` + `network`가 ko/en 모두 비어 있지 않음, 알려진 도구 키는 전용 문구·모르는 키는 일반 문구
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `feat: add ko/en fixed message dictionary for guide panel`

**완료조건:**

- 새 테스트 통과

---

### Task B5: 대화 reducer, 스트림 클라이언트, 세션 id (TDD)

**Files:**

- Create: `src/lib/guide/chat.ts`, `src/lib/guide/chat.test.ts`
- Create: `src/lib/guide/stream.ts`, `src/lib/guide/stream.test.ts`
- Create: `src/lib/guide/session.ts`

**Interfaces:**

- Consumes: `GuideEvent`·`ErrorCode`·`parseGuideEvent`(events.ts), `createSseParser`(sse.ts), `GuideContext`(context.ts), `Locale`(dictionary.ts)
- Produces:
  - `ChatMessage`, `ChatState`(`messages`, `status: idle|streaming|error`, `errorCode`, `toolKey`), `ChatAction`(`send | event | fail | aborted | dropFailed`), `initialChat`, `chatReducer`, `lastUserText(state): string | null`
  - `type GuideRequestBody`, `streamGuide(opts: { url; body; signal; onEvent }): Promise<"ok" | "failed" | "aborted">`
  - `getSessionId(): string`

**왜**: 설계 D11·D12. 상태 전이와 스트림 읽기는 UI와 분리해 검증한다. reducer가 순수하면 패널은 얇아진다.

**주의**:

1. **`action` 이벤트는 reducer로 보내지 않는다** — Provider가 `done`을 받은 뒤 실행한다(ChatAction의 `event`에서 제외).
2. **오류·취소 때 비어 있는 답변 말풍선은 지운다.** 이미 텍스트가 있으면 남긴다.
3. **`retract`:** 답변을 비우고 `retracted`로 표시(화면은 사전의 고정 문구).
4. **다시 시도:** `dropFailed`가 마지막 사용자 말풍선(과 뒤따르는 것)을 지우고 `lastUserText`로 같은 질문을 **새 요청**으로 보낸다(서버는 멱등 처리를 하지 않는다, 설계 §7.2).
5. **`streamGuide`:** `fetch` POST + `ReadableStream`. 응답이 `!ok`이거나 본문이 없으면 `failed`, 예외는 `signal.aborted`면 `aborted` 아니면 `failed`. `TextDecoder`는 `{stream: true}`로 조각 경계의 멀티바이트 문자를 보존한다.
6. **`getSessionId`:** `sessionStorage`의 UUID. 접근 오류 시 메모리 값으로 대신한다. UUID는 에이전트의 ID 형식(`^[A-Za-z0-9_-]{1,64}$`)을 만족한다.
7. `stream.test.ts`는 `fetch`를 스텁해 `Response(ReadableStream)`을 돌려준다(Node 22에서 동작).

- [ ] **Step 1: reducer 테스트 작성** — send(사용자 + 빈 답변, streaming), text_delta 누적, tool_status→done 시 toolKey 정리, retract, error(코드 보존 + 빈 말풍선 제거), 텍스트가 있으면 error여도 답변 유지, fail→network 오류, aborted→idle, dropFailed + lastUserText
- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/guide/chat.test.ts`
- [ ] **Step 3: reducer 구현**
- [ ] **Step 4: stream 테스트 작성** — 이벤트 경계에서 잘린 조각이 순서대로 전달되고 결과가 `ok`, HTTP 422 → `failed`, `fetch` 예외 → `failed`, 이미 abort된 signal → `aborted`
- [ ] **Step 5: 실패 확인**
- [ ] **Step 6: `stream.ts`·`session.ts` 구현**
- [ ] **Step 7: 통과 확인** — Run: `npx vitest run src/lib/guide`. Expected: guide 폴더 전체 PASS
- [ ] **Step 8: 커밋** — `feat: add chat reducer, guide stream client and session id`

**완료조건:**

- `src/lib/guide` 전체 테스트 통과

---

### Task B6: `(fans)` 라우트 그룹, 레이아웃, Provider

**Files:**

- Move: `src/app/page.tsx` → `src/app/(fans)/page.tsx`, `src/app/artists` → `src/app/(fans)/artists`
- Create: `src/app/(fans)/layout.tsx`
- Create: `src/components/guide/GuideProvider.tsx`
- Modify: `src/lib/data.ts` (`getArtistSlugs` 추가)
- Modify: `.env.example` (`NEXT_PUBLIC_GUIDE_API_URL` 설명)

**Interfaces:**

- Consumes: B1~B5의 모든 모듈, `requestFocus`, `getCurrentSection`
- Produces: `GuideProvider({ apiUrl, artistSlugs, children })`, `useGuide(): GuideApi` — `{ state, open, setOpen, locale, setLocale, send, stop, retry }`

**왜**: 설계 D10~D14. 패널을 레이아웃에 두면 `/` ↔ `/artists/…` 이동에서 대화·열림 상태가 유지되고, B탭에는 코드가 실리지 않는다.

**주의**:

1. **파일 이동뿐이다.** import는 `@/` 별칭이라 수정이 필요 없고 주소(URL)는 변하지 않는다. 이동 후 `npx tsc --noEmit`으로 확인한다.
2. **레이아웃(서버 컴포넌트):** Task 0 실측: 서버 레이아웃의 `process.env`는 동적 렌더링일 때만 런타임에 평가되고, 그렇지 않으면 빌드 시점 값으로 굳을 수 있다. 환경변수를 읽기 전에 `await connection()`(`next/server`)을 호출해 런타임 평가를 보장한다. `NEXT_PUBLIC_GUIDE_API_URL`이 비어 있으면 패널 없이 `children`만 렌더한다. 있으면 `getArtistSlugs()`로 slug 목록을 읽어 Provider에 넘긴다. `getArtistSlugs`는 `getArtists`와 달리 조인 없이 `slug`만 읽고 `byArtistDisplayOrder`로 정렬한다.
3. **로케일:** 초기값은 `navigator.language`(`ko`로 시작하면 `ko`, 아니면 `en`), 서버 스냅샷은 `ko`(`useSyncExternalStore`). 토글로 덮어쓴다.
4. **`send`:** 진행 중이면 무시(`busyRef`), `requestId`는 `crypto.randomUUID()`, `context`는 **요청을 보내는 순간** `window.location.pathname`과 `getCurrentSection()`으로 만든다. 스트림이 `done`이나 `error` 없이 끝나면 `fail`을 보낸다.
5. **액션 실행:** `pendingAction`을 모아 두고 **`done`을 받은 뒤에만** 실행한다(오류·취소에서는 실행하지 않는다). 같은 `{type,slug,…}`가 3초 안에 다시 오면 무시한다. 실행은 `try/catch`로 감싸 실패해도 답변은 이미 화면에 있다.
6. **실행 규칙(`ActionPlan`):** `focus` → `requestFocus`. `gotoOrbit` → `requestFocus` 후 `router.push("/")`. `scroll` → `document.getElementById(section)?.scrollIntoView({behavior:"smooth"})`. `navigate` → `focusSlug`가 있으면 `requestFocus` 후 약 700ms 뒤 `router.push(path)`, 없으면 즉시. **타이머는 ref로 소유하고 언마운트 때 해제한다**(저장소가 최근 abortable 타이머 소유권을 정리한 관례).
7. **콜드 스타트 완화:** 패널을 처음 열 때 한 번만 `GET {apiUrl}/health`를 호출한다(실패 무시).
8. Task 0에서 `router.push` 해시 스크롤이 안 되는 것으로 확인됐다면 `navigate` 실행 뒤 도착 시점에 `scrollIntoView`를 한 번 더 호출하도록 보완한다.
9. `.env.example`의 "NEXT*PUBLIC* 금지" 주석은 키·비밀 값에 대한 것이므로, 이 변수만 예외라고 명시한다.
10. **이 Task는 `GuidePanel`(Task B8)이 있어야 타입 검사를 통과한다.** B6·B7·B8을 이어서 진행하고 함께 검증·커밋한다.

- [ ] **Step 1: 파일 이동** — `git mv` 후 `npx tsc --noEmit`
- [ ] **Step 2: `getArtistSlugs` 추가**
- [ ] **Step 3: `(fans)/layout.tsx` 작성**
- [ ] **Step 4: `GuideProvider.tsx` 작성**
- [ ] **Step 5: `.env.example` 갱신**
- [ ] **Step 6: Task B7·B8 진행 후 함께 검증·커밋** (아래 B8 Step 참고)

**완료조건:**

- (B8까지 완료 후) 타입 검사·린트·테스트 통과
- 주소 `/`, `/artists/<slug>`가 이전과 같이 동작한다

---

### Task B7: 섹션 추적기와 hero id

**Files:**

- Create: `src/components/fans/ArtistSectionTracker.tsx`
- Modify: `src/app/(fans)/artists/[slug]/page.tsx`

**왜**: 설계 D7. 사용자가 보고 있는 섹션을 `context.section`으로 보내고, `openTour`가 같은 페이지에서 스크롤할 대상(`#hero`·`#tour`·…)을 갖기 위해서다.

**주의**:

1. **`IntersectionObserver`**를 쓰고 `rootMargin: "-50% 0px -50% 0px"`로 화면 세로 가운데 한 줄만 남긴다 — 그 줄에 걸린 섹션이 현재 섹션이다. 스크롤 이벤트를 매번 계산하지 않는다.
2. 값은 `setCurrentSection`(모듈 변수)에 쓴다. 컴포넌트는 UI가 없고 `null`을 렌더한다. **언마운트 때 `disconnect`하고 `null`로 비운다.**
3. 관찰 대상은 `ARTIST_SECTIONS`의 id를 가진 요소다. `isSection`으로 걸러 모르는 id는 무시한다.
4. 아티스트 페이지의 Hero `<section>`에 **`id="hero"`를 추가**한다(지금은 id가 없다). `<main>` 안에 `<ArtistSectionTracker />`를 둔다.

- [ ] **Step 1: 추적기 작성**
- [ ] **Step 2: 페이지에 연결하고 `id="hero"` 추가**

**완료조건:**

- 아티스트 페이지를 스크롤하면 현재 섹션 값이 `hero → tour → album → gallery`로 바뀐다(B9에서 요청 본문으로 확인)

---

### Task B8: 패널 UI

**Files:**

- Create: `src/components/guide/GuidePanel.tsx`

**Interfaces:**

- Consumes: `useGuide`, `DICT`·`errorText`·`toolStatusText`

**왜**: 설계 §5.2. 접힘 버튼 / 반투명 패널 / 모바일 하단 시트.

**주의**:

1. **닫힘:** 오른쪽 아래 둥근 버튼(`bottom-20`로 NOW 티커 위). `aria-expanded`를 준다.
2. **열림:** 모바일(<768px)은 하단 시트(높이 약 70dvh, 위쪽 모서리 둥글게), 데스크톱은 오른쪽 아래 약 380px 반투명 패널(`backdrop-blur`).
3. **z-index는 40**이다 — 갤러리 라이트박스(z-50)보다 아래, `<Html>` 라벨(z 20)보다 위.
4. **본문:** 말풍선 목록(`aria-live="polite"`), 답변 중 도구 상태 한 줄, 오류 문구 + "다시 시도". `off_topic`·`too_long`에는 재시도 버튼을 보이지 않는다. 새 메시지가 오면 아래로 스크롤.
5. **입력:** `maxLength=200`, 답변 중에는 "보내기"가 "멈추기"로 바뀐다. 빈 입력은 보낼 수 없다.
6. 머리: 제목, KO | EN 토글(`aria-pressed`), 닫기.
7. 이 Task의 범위는 UI뿐이다. 추천 칩은 넣지 않는다(4단계).

- [ ] **Step 1: 패널 작성**
- [ ] **Step 2: B6·B7·B8 합산 검증** — `npx tsc --noEmit`, `npm run lint`, `npm test`
- [ ] **Step 3: 커밋** — `feat: add tour guide panel, provider and artist section tracker`

**완료조건:**

- 타입 검사·린트·테스트 통과
- 패널이 열고 닫히며, 모바일 폭에서 하단 시트로 보인다

---

### Task B9: 로컬 에이전트 연동 확인

**선행 조건:** 위 "계약 갱신 C1~C5"가 모두 체크돼 있어야 한다. 하나라도 미완료면 시작하지 않고 사용자에게 알린다.

**Files:**

- Modify: `docs/design-v3-tour-guide.md` (끝에 "연동 확인 결과" 절 추가)

**주의**:

1. 에이전트 서버는 에이전트 저장소 루트에서 실행한다(`handoff-onstage.md` §7). `GET /health`가 `{"status":"ok"}`이면 준비된 것이다. `ALLOWED_ORIGINS` 기본값은 `http://localhost:3000`이다.
2. on-stage의 `.env.local`에 `NEXT_PUBLIC_GUIDE_API_URL=http://localhost:8000`을 넣고 **개발 서버를 다시 시작**한다.
3. 아래 시나리오는 사용자가 화면으로 확인한다.

| #   | 시나리오                                                  | 기대 결과                                                                            |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | `/`에서 패널 열기                                         | 버튼이 NOW 티커 위에 보이고, 열면 시트/패널이 뜬다. 네트워크 탭에 `/health` 1회      |
| 2   | "AURORA 다음 공연 알려줘"                                 | 글자가 스트리밍되고, 도구 상태 문구가 보인다                                         |
| 3   | "NOVA에 대해 알려줘"(궤도에서)                            | 답변 끝에 NOVA가 정면으로 돌아와 커진다 (`focusArtist`)                              |
| 4   | "AURORA 투어 일정 보여줘"(궤도에서)                       | 포커스 후 `/artists/aurora#tour`로 이동하고 투어 섹션이 보인다. 패널 대화가 유지된다 |
| 5   | 아티스트 페이지에서 앨범 섹션을 보다가 "투어 일정 보여줘" | 요청 본문의 `context.section`이 `album`이고, 투어 섹션으로 스크롤된다 (C3 반영)      |
| 6   | 다른 아티스트 페이지에서 "NOVA 보여줘"                    | `/`로 이동해 NOVA 포커스, 또는 `openTour`면 NOVA 페이지로 이동                       |
| 7   | 영어 토글 후 영어 질문                                    | 영어로 답하고 고정 문구(상태·오류)도 영어                                            |
| 8   | 답변 중 "멈추기"                                          | 스트림이 끊기고 입력창이 돌아온다. 같은 세션의 다음 질문이 정상 동작                 |
| 9   | 에이전트 서버를 끈 채 질문                                | "연결이 끊겼어요" + "다시 시도". 서버를 켜고 다시 시도하면 성공                      |
| 10  | 201자 이상 입력 시도                                      | 입력창이 200자에서 막힌다                                                            |
| 11  | `/staff/dashboard`로 이동                                 | 패널이 보이지 않는다                                                                 |
| 12  | 갤러리 사진(라이트박스) 열기                              | 라이트박스가 패널 위를 덮는다                                                        |

- [ ] **Step 1: 에이전트 서버 실행·상태 확인**
- [ ] **Step 2: on-stage 환경변수 설정 후 `npm run dev`**
- [ ] **Step 3: 위 시나리오 12건 확인**
- [ ] **Step 4: 최종 검증** — `npm run lint && npm test && npm run build`
- [ ] **Step 5: 결과를 설계 문서에 기록하고 커밋** — `docs: record tour guide integration check results`

**완료조건:**

- 시나리오 12건이 통과하거나, 실패 항목이 원인과 함께 기록돼 있다
- `npm run lint`, `npm test`, `npm run build` 통과

---

## 스펙 커버리지 (자체 점검)

| 설계 결정                          | 이 계획의 Task                |
| ---------------------------------- | ----------------------------- |
| D1 입체감 · D2 파일 구성           | A3                            |
| D3 폴백 플래그                     | A4                            |
| D4 모바일 성능                     | A3 (dpr·분할·조명)            |
| D5 포커스                          | A1 · A2 · A3 · A5             |
| D6 섹션 값 · D7 섹션 감지          | B3 · B7                       |
| D8 `openTour.section` · D9 연출    | B3 (`planAction`) · B6 (실행) |
| D10 패널 위치                      | B6                            |
| D11 상태 관리                      | B5 (reducer) · B6 (Context)   |
| D12 SSE·검증                       | B1 · B2 · B5                  |
| D13 액션 실행                      | B3 · B6                       |
| D14 로케일·URL                     | B4 · B6                       |
| 체크포인트 11개(★ #1,3,5,6,7,9,11) | ⛔ 체크포인트                 |
| 계약 갱신 C1~C5 선행 조건          | 체크포인트 아래, B9           |
