# ON-STAGE 2차 구현 계획 2.2 — 무대 연출 툴 고도화 (Implementation Plan v2.2)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development(권장) 또는
> superpowers:executing-plans로 이 계획을 Task 단위로 실행한다. 체크박스(`- [ ]`)로 진행 상황을 추적한다.

> 2차 고도화는 항목마다 별도 계획 문서를 갖는다. 번호는 [`docs/design-v2.md`](./design-v2.md) 3장의
> 시퀀싱(2.1~2.5)을 따른다. 이 문서는 **2.2 무대 연출 툴 고도화**만 다룬다.

**Goal:** `StageState`를 조명 파라미터·스모그·자유 색상까지 확장하고, 슬라이더 UI와 Supabase
기반 명명 프리셋 저장/불러오기를 붙여 1차의 "슬라이더 0개, 프리셋 없음" 부채를 해소한다.

**Architecture:** 상태 병합(`mergeStageState`)이 단일 진실 공급원이 되어 localStorage(작업 중 상태)와
Supabase `stage_presets`(명명된 프리셋) 양쪽의 로드 경로를 같은 규칙으로 방어한다. 3D 씬은 스모그를
직접 셰이더 없이 three.js `fog` + drei `<Cloud>`로만 구현한다. 프리셋 쓰기 경로는 4장에서 이미 만든
소유 스코프 RLS(`stage_presets.user_id = auth.uid()`)에 전적으로 의존한다 — 새 정책이나 우회 경로를
만들지 않는다.

**Tech Stack:** Next.js 16.2.12 / React 19.2.4 / `@react-three/fiber` · `@react-three/drei` /
`@supabase/supabase-js` · `@supabase/ssr` / vitest (node 환경)

**승인된 설계:** [`docs/design-v2.md`](./design-v2.md) **5장**. 이 계획은 그 문서를 구현 단위로
쪼갠 것이며, 타입 정의·API 계약·병합 로직의 **단일 진실 공급원은 design-v2.md다.** 이 문서는 컴포넌트나
route handler의 완성된 코드를 싣지 않는다 — 타입 시그니처, 파일 경로, design-v2.md 절 참조,
완료조건 중심으로 쓴다(4장과 동일한 문서 관리 방침).

**브랜치:** `feat/stage-tools` (main에서 새로 생성, 1차 관행 `feat/<area>` 유지)

---

## Global Constraints

모든 Task에 적용된다. 이 절의 요구사항은 각 Task의 완료조건에 암묵적으로 포함된다.

### 훈련 데이터와 다른 부분 (반드시 준수)

- **Next 16 — 동적 라우트의 `params`는 `Promise`다.** `src/app/api/gallery/[id]/route.ts`처럼
  `{ params }: { params: Promise<{ id: string }> }`로 받는다 (Task 4).
- **Tailwind v4 — `tailwind.config.ts`가 없다.** 디자인 토큰은 `src/app/globals.css`의 `@theme`에 있다.

### 프로젝트 규칙

- **TDD 대상은 `src/lib/stageState.ts` 하나뿐이다** (§9.1). R3F 씬·슬라이더 UI에 형식적 테스트를
  만들지 말 것 — 브라우저 시각 검증으로 확인한다.
- **vitest는 `environment: "node"`를 유지한다.** 3D 컴포넌트를 import할 수 없다는 사실이 형식적
  테스트를 막는 강제 장치다.
- **`stage_presets` 테이블과 소유 스코프 RLS는 4장에서 이미 완료됐다.** 이 계획에서 마이그레이션을
  추가하지 않는다 (design-v2.md §5.2).
- **Supabase 키는 전부 서버 전용.** 프리셋 API도 `createServerSupabase()` 경유, service role은
  쓰지 않는다 (§4.5 원칙 유지).
- 커밋 컨벤션: Conventional Commits (`feat:` `fix:` `test:` `docs:` `refactor:`), 소문자 명령형.

### 범위 밖 (선제 구현 금지)

design-v2.md §10을 그대로 따른다. 특히 이 계획에서 손이 갈 만한 것:

- 되돌리기/히스토리, 감사 로그, 소프트 삭제 — §5.3에서 confirm 미채택의 근거로도 다시 확인됨
- 호버 시 3D 프리셋 미리보기 — §5.3에서 명시적으로 보류(프리셋이 많아지면 재검토)
- 프리셋 검색·정렬·개수 제한 UI — 언급 없음, 만들지 않는다
- `/staff/tours` · `/staff/tickets` 등 7장 몫의 화면

---

## 파일 구조 (최종 목표)

```
src/
├── lib/
│   ├── stageState.ts           # 재작성 — 타입 확장 + mergeStageState/parseStageState (Task 1)
│   └── stageState.test.ts      # 재작성 — TDD (Task 1)
├── components/
│   ├── three/
│   │   └── StageScene.tsx      # 수정 — 스팟별 파라미터, camera 리네임 (Task 1) + fog·Cloud (Task 2)
│   └── staff/
│       ├── StageControls.tsx   # 수정 — orchestrator로 재구성 (Task 1 정합 → Task 3 → Task 5)
│       ├── SpotControls.tsx    # 신규 (Task 3)
│       ├── SmokeControls.tsx   # 신규 (Task 3)
│       └── PresetPanel.tsx     # 신규 (Task 5)
└── app/api/stage-presets/
    ├── route.ts                 # 신규 — GET/POST (Task 4)
    └── [id]/route.ts            # 신규 — DELETE (Task 4)
```

**책임 분리의 기준**(design-v2.md §5.3): 컨트롤 개수가 3(스팟)×4 + 카메라 3 + 스모그 2 + 색상 2방식 +
프리셋 패널까지 늘어나므로 `StageControls.tsx` 하나에 다 넣지 않는다. `SpotControls`/`SmokeControls`/
`PresetPanel`은 각자 하나의 관심사만 맡고, `StageControls`는 그것들을 배치하는 orchestrator로 남는다.

---

## Task 순서와 의존관계

```
Task 1  StageState 확장 + 필드별 병합 (TDD) + 기존 컴포넌트 타입 정합
   ↓
Task 2  스모그 (fog + drei Cloud)
   ↓
Task 3  조명·스모그 슬라이더 + 색상 자유 선택 UI
   ↓
Task 4  프리셋 API (GET/POST/DELETE)
   ↓
Task 5  프리셋 패널 UI
   ↓
Task 6  완료 기준 검증 · 문서 갱신
```

Task 1이 나머지 전부의 기반이다 — `StageState` 타입과 `mergeStageState`가 5.2(프리셋 로드)·5.3(슬라이더가
다루는 필드)·5.4(스모그 필드)가 공유하는 단일 진실 공급원이기 때문이다. Task 1은 타입 변경만으로 끝내지
않고 `StageControls.tsx`/`StageScene.tsx`의 기존 참조(`state.angle`, boolean `spots`)까지 함께
고친다 — 그렇지 않으면 이 Task가 끝난 시점에 `npm run build`가 깨진 채로 커밋되기 때문이다(4장 Task 4가
읽기 경로 전환 때 호출부 3곳을 같은 Task에 묶은 것과 같은 이유). 슬라이더(Task 3)와 프리셋(Task 4·5)을
분리한 이유는 전자가 순수 UI 추가이고 후자가 새 API 계약을 도입해서다 — 서로 실패해도 다른 쪽을 막지
않는다.

---

### Task 1: StageState 확장 + 필드별 병합 (TDD) + 기존 컴포넌트 타입 정합

**Files:**
- Modify: `src/lib/stageState.ts`
- Modify: `src/lib/stageState.test.ts`
- Modify: `src/components/staff/StageControls.tsx` (기계적 정합만 — 슬라이더는 Task 3)
- Modify: `src/components/three/StageScene.tsx` (기계적 정합만 — 스모그는 Task 2)

**Interfaces:**
- Produces: `SpotState = { on: boolean; intensity: number; angle: number; penumbra: number }`
- Produces: `StageState = { color: string; spots: { left: SpotState; center: SpotState; right: SpotState }; camera: "front" | "audience" | "top"; smoke: { density: number; color: string } }`
- Produces: `defaultStageState(color: string): StageState`
- Produces: `mergeStageState(value: unknown, fallback: StageState): StageState` — Task 5가 프리셋 로드에
  그대로 재사용한다
- Produces: `parseStageState(raw: string | null, fallback: StageState): StageState`
- `StageControls`/`StageScene`의 외부 props 시그니처는 변경 없음(`{ artists, state, onChange }`,
  `{ state, controls? }`) — 내부 필드 참조만 바뀐다

**왜**: design-v2.md §5.1. `parseStageState`가 지금 전부-아니면-전무 방식이라 필드 하나만 늘어도 저장값
전체가 폐기된다. 필드별 폴백 병합으로 바꾸는 게 이 장 전체의 선행 작업이다.

**주의**:
1. **옛 테스트를 지우고 새로 쓴다.** 기존 `stageState.test.ts`는 "모양이 다르면 전체 폐기" 동작을
   전제로 하는데, 이건 새 설계와 정면으로 반대된다(예: 옛 테스트의 "falls back on a value with the
   wrong shape" 케이스는 `{color:"#fff"}`처럼 필드 일부만 있는 경우도 fallback 전체를 기대하지만,
   새 규칙에서는 `color`만 유지되고 나머지가 기본값이 되는 게 맞다). 기존 케이스를 이어받는 게 아니라
   5.1 표 기준으로 다시 쓴다.
2. **1차 호환은 별도 변환 코드 없이 일반 규칙만으로 나와야 한다.** `spots.left: true`(boolean)를 보고
   `on: true`로 변환하는 전용 로직을 추가하지 말 것 — §5.1에서 기각된 대안이다. `color`는 유지되고
   `spots`/`camera`는 기본값으로 리셋되는 게 맞는 동작이다.
3. **`StageControls.tsx`/`StageScene.tsx` 수정은 기계적 리네임/필드 경로 변경까지만.** 슬라이더를
   추가하거나 스모그를 렌더하지 않는다 — 이 Task가 끝난 시점에 무대 페이지는 **이전과 시각적으로
   동일하게** 보여야 한다(기본값이 지금 하드코딩된 값과 같으므로).
4. `mergeStageState`는 `unknown`을 받고 `JSON.parse`를 하지 않는다 — 파싱은 `parseStageState`(문자열
   전용)의 몫이다. 이 분리가 Task 5에서 Supabase JSONB(이미 파싱된 객체)를 그대로 병합할 수 있게 한다.

- [ ] **Step 1: 실패하는 테스트 작성** — §5.1 표의 6개 케이스: `null` 저장값 · JSON 깨짐 · 1차
      저장값(`spots.left: true`, `angle` 키) · `smoke` 필드 없는 v2 저장값 · `spots.left`가 `on`만
      있고 나머지 3개 필드 없음 · `camera`가 열거값 밖의 문자열. 각 케이스에 왜 존재하는지 한국어
      주석 한 줄(1차 관행)
- [ ] **Step 2: 테스트 실패 확인** — Run: `npm test`. Expected: FAIL (옛 `parseStageState`는
      필드별 병합을 하지 않으므로 새 케이스들이 기대와 다르게 나온다)
- [ ] **Step 3: `stageState.ts` 최소 구현** — 타입 확장 + `mergeStageState`/`parseStageState` 재작성.
      구현은 design-v2.md §5.1 그대로(이 문서에는 인라인하지 않는다)
- [ ] **Step 4: 테스트 통과 확인** — Run: `npm test`. Expected: PASS
- [ ] **Step 5: `StageControls.tsx` 타입 정합** — 카메라 버튼의 `angle` 참조를 `camera`로,
      on/off 스위치의 `state.spots[key]`(boolean) 참조를 `state.spots[key].on`으로 교체.
      `onChange` 호출부도 새 필드 경로에 맞게 조정
- [ ] **Step 6: `StageScene.tsx` 타입 정합** — `CAMERA_PRESETS`/`CameraRig`가 `StageState["camera"]`를
      참조하도록, `Spot`이 `on`/`intensity`/`angle`/`penumbra`를 하드코딩 리터럴 대신
      `state.spots.<key>`에서 받도록 변경
- [ ] **Step 7: 시각 검증 (브라우저)** — **사람 확인 지점.** 무대 페이지가 이전과 동일하게 보이는지
      (조명 색·on/off·카메라 버튼 3개 동작 포함), 콘솔 에러가 없는지 확인. 슬라이더·스모그는 아직 없다
- [ ] **Step 8: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- §5.1 표의 6개 테스트 케이스가 전부 통과한다
- `npm test` · `npm run build` 통과
- 무대 페이지가 이전과 시각적으로 동일하게 렌더된다(시각 검증) — 새 UI는 아직 없다
- `mergeStageState`에 `JSON.parse`나 `localStorage` 참조가 없다(순수성 — Task 5 재사용을 위한 전제)

**검증 노트**:

---

### Task 2: 스모그 — fog + drei Cloud

**Files:**
- Modify: `src/components/three/StageScene.tsx`

**Interfaces:**
- Consumes: Task 1의 `StageState["smoke"]: { density: number; color: string }`
- Produces: 없음 (내부 렌더링 변경, `StageScene`의 외부 props 시그니처 불변)

**왜**: design-v2.md §5.4. 직접 쓰는 셰이더 0줄이 완료 기준(§11)이다.

**주의**:
1. **`density === 0`이면 시각적으로 완전히 꺼진 것처럼 보여야 한다.** drei `<Cloud>`를 opacity 0으로만
   두면 씬 그래프에는 남아 예산을 쓸 수 있으니, 0일 때는 조건부로 아예 렌더를 스킵한다. `scene.fog`도
   동일하게 밀도 0이면 생략한다.
2. **새 의존성을 추가하지 않는다.** `@react-three/drei`는 이미 설치돼 있다(`Sparkles`가 이미 쓰이는
   중) — `Cloud`가 같은 패키지에서 export되는지만 버전 확인한다.
3. 직접 쓰는 셰이더는 0줄을 유지한다 — `fog`와 `<Cloud>`만 쓴다(§11 완료 기준).

- [ ] **Step 1: `@react-three/drei` 버전 확인** — `package.json`에서 버전 확인, `Cloud` export 여부 확인
- [ ] **Step 2: `StageScene.tsx`에 `fog` + `<Cloud>` 추가** — `state.smoke.density`/`color` 연결,
      `density === 0`일 때 스킵
- [ ] **Step 3: 시각 검증 (브라우저)** — **사람 확인 지점.** 슬라이더가 아직 없으므로 브라우저 콘솔에서
      `localStorage.setItem('stage-state:<slug>', JSON.stringify({ ...기본값, smoke: { density: 0.6, color: '#ffffff' } }))` 후
      새로고침해 안개가 보이는지, `density: 0`으로 되돌리면 사라지는지 확인
- [ ] **Step 4: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- `density > 0`일 때 안개가 시각적으로 나타나고, `0`일 때 완전히 사라진다(시각 검증)
- `npm run build` 통과. 새 형식적 테스트는 만들지 않는다(§9.1)
- `StageScene.tsx`에 직접 작성한 셰이더 코드(GLSL, `shaderMaterial` 등)가 없다

**검증 노트**:

---

### Task 3: 조명·스모그 슬라이더 + 색상 자유 선택 UI

**Files:**
- Create: `src/components/staff/SpotControls.tsx`
- Create: `src/components/staff/SmokeControls.tsx`
- Modify: `src/components/staff/StageControls.tsx`

**Interfaces:**
- Consumes: Task 1의 `SpotState`/`StageState` 타입
- Produces: `SpotControls({ label, spot, onChange }: { label: string; spot: SpotState; onChange: (next: SpotState) => void })`
- Produces: `SmokeControls({ smoke, onChange }: { smoke: StageState["smoke"]; onChange: (next: StageState["smoke"]) => void })`
- `StageControls`의 외부 props 시그니처는 그대로 — 내부만 재구성

**왜**: design-v2.md §5.3. 앱 전체에 `type="range"`가 0개였던 부채를 해소한다.

**주의**:
1. **슬라이더 range/step/기본값은 §5.3 표를 한 곳의 상수로 관리한다** — `intensity` 0–1000/step 10,
   `angle` 0.1–1.0/step 0.05, `penumbra` 0–1/step 0.05, `smoke.density` 0–1/step 0.05. 컴포넌트마다
   매직넘버를 흩뿌리지 않는다.
2. **색상 자유 선택은 기존 아티스트 스와치와 병용이지 교체가 아니다**(브레인스토밍 질문 3 답변).
   네이티브 `<input type="color">`를 추가하고, 스와치 버튼은 그대로 둔다. 별도 색상 피커 라이브러리는
   쓰지 않는다.
3. 스모그 색상(`SmokeControls`)도 같은 `<input type="color">` 패턴을 쓰되, 조명 색(`state.color`)과는
   별개의 값(`state.smoke.color`)이다 — 하나로 묶지 않는다.

- [ ] **Step 1: `SpotControls.tsx` 작성** — on/off 스위치(기존 `StageControls`의 스위치 마크업 재사용) +
      intensity/angle/penumbra 슬라이더 3개
- [ ] **Step 2: `SmokeControls.tsx` 작성** — density 슬라이더 + `<input type="color">`
- [ ] **Step 3: `StageControls.tsx`를 orchestrator로 재구성** — 색상 섹션에 `<input type="color">` 추가
      (스와치 유지), `SpotControls`를 `left`/`center`/`right` 3번 렌더, `SmokeControls` 추가. 카메라
      3버튼 섹션은 그대로 둔다(Task 1에서 이미 `camera` 키로 정합됨)
- [ ] **Step 4: 시각 검증 (브라우저)** — **사람 확인 지점.** 슬라이더 조작이 3D 씬에 실시간
      반영되는지(§11 완료 기준), 스모그 슬라이더가 Task 2의 안개를 조절하는지, 색상 피커가 즉시
      반영되는지, 스와치 버튼도 여전히 동작하는지 확인
- [ ] **Step 5: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- §11 완료 기준: "슬라이더 조작이 R3F 씬에 실시간 반영된다" 충족(시각 검증)
- 앱 전체에 `type="range"`가 12개 이상 존재한다(스팟 3×3 + 스모그 1)
- `npm run build` 통과. 새 형식적 테스트는 만들지 않는다(§9.1)

**검증 노트**:

---

### Task 4: 프리셋 API (GET / POST / DELETE)

**Files:**
- Create: `src/app/api/stage-presets/route.ts`
- Create: `src/app/api/stage-presets/[id]/route.ts`

**Interfaces:**
- Consumes: Task 1의 `StageState` 타입, 기존 `getArtistId(supabase, slug)`(`src/lib/data.ts`),
  기존 `createServerSupabase()`
- Produces:
  - `GET /api/stage-presets?artist=<slug>` → `200 { presets: { id: string; name: string; state: StageState }[] }`
  - `POST /api/stage-presets` body `{ artistSlug: string; name: string; state: StageState; overwrite?: boolean }`
    → `201 { id: string }` / 이름 중복인데 `overwrite` 없으면 `409 { error: "duplicate" }`
  - `DELETE /api/stage-presets/[id]` → `204` / `403 { error: "forbidden" }`

**왜**: design-v2.md §5.2. `stage_presets` 테이블과 소유 스코프 RLS는 4장에서 이미 존재 — 이 Task는
그 위에 API만 얹는다. 마이그레이션 추가 없음.

**주의**:
1. **동적 라우트 `params`는 `Promise`다** — `gallery/[id]/route.ts`와 동일하게
   `{ params }: { params: Promise<{ id: string }> }`.
2. **`user_id`는 세션(`user.id`)에서 채운다**, 클라이언트 입력을 신뢰하지 않는다(`gallery` POST의
   `created_by`와 동일 원칙).
3. **중복 이름은 Postgres 에러 코드 `23505`(unique violation)로 판별한다.** `overwrite`가 없으면
   plain `insert`, 있으면 `upsert(..., { onConflict: "user_id,artist_id,name" })`.
4. **DELETE는 `gallery/[id]/route.ts`와 동일한 패턴이다** — 소유자 재확인 코드 없이 RLS가 게이트,
   0행 삭제면 403(그대로 204를 주면 RLS가 막은 시도가 성공한 것처럼 보인다).
5. **`state` 필드는 서버에서 깊은 스키마 검증을 하지 않는다.** 클라이언트가 이미 만든 유효한
   `StageState`를 그대로 저장하며, 이는 `gallery` POST가 body 필드 존재만 확인하는 것과 같은
   엄격도다(jsonb 컬럼이라 저장 자체는 어떤 JSON이든 받는다). 불러올 때의 안전망은 Task 5의
   `mergeStageState`가 담당한다.

- [ ] **Step 1: `GET` 구현** — `getArtistId`로 slug→id 변환, `stage_presets`에서 `artist_id` 필터
      select (RLS가 `user_id`는 자동으로 거른다)
- [ ] **Step 2: `POST` 구현** — 세션 확인 → 401, body 검증(`artistSlug`/`name`/`state` 존재) → 400,
      `overwrite` 여부로 insert/upsert 분기, `23505` → 409
- [ ] **Step 3: `DELETE` 구현** — 세션 확인 → 401, delete + 0행 체크 → 403
- [ ] **Step 4: API 수동 검증** (curl 또는 브라우저 devtools, 로그인 세션 사용) — GET 빈 배열 →
      POST 성공 201 → 같은 이름 POST 재요청 409 → `overwrite: true` 재요청 200대 성공 → DELETE 204 →
      존재하지 않는/타인 id DELETE 403
- [ ] **Step 5: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- Step 4의 수동 시나리오 전부가 기대한 상태 코드를 반환한다
- `npm run build` 통과
- `grep -rn "SERVICE_ROLE" src/app/api/stage-presets`가 0건이다(런타임 경로에서 service role
  미사용 원칙, §4.5)

**검증 노트**:

---

### Task 5: 프리셋 패널 UI

**Files:**
- Create: `src/components/staff/PresetPanel.tsx`
- Modify: `src/components/staff/StageControls.tsx`

**Interfaces:**
- Consumes: Task 4의 3개 엔드포인트, Task 1의 `mergeStageState`, 기존 `writeStageState`
  (`src/lib/hooks.ts`, 무수정)
- Produces: `PresetPanel({ artistSlug, state, onChange }: { artistSlug: string; state: StageState; onChange: (next: StageState) => void })`,
  `StageControls`에 조합

**왜**: design-v2.md §5.2·§5.3의 마지막 조각. 이걸로 5장의 UI가 끝난다.

**주의**(§5.3에서 이미 결정된 것 그대로):
1. 마운트 시 목록 조회, 각 행에 `state.color` 스와치를 표시한다(오클릭 방지, 목록 응답에 이미
   `state`가 포함돼 있으니 추가 요청 없음).
2. **이름 클릭 → 불러오기는 confirm도 로딩 표시도 없이 즉시 적용한다.** 받아온 `state`를
   `mergeStageState`로 병합해 씬에 반영 **+** `writeStageState`로 localStorage 작업 중 상태에도
   반영한다(불러온 프리셋이 새 작업 기준점이 되도록). 이 근거는 design-v2.md §5.3에 이미 정리돼 있다
   — 여기서 새로 판단하지 않는다.
3. **저장 버튼**: 이름 없이 우선 POST. `409`를 받으면 "이미 있는 이름입니다. 덮어쓸까요?" `confirm()`
   → 확인 시 `overwrite: true`로 재요청.
4. **삭제 버튼**: `GalleryManager.tsx`의 `confirm()` 패턴 재사용. `DELETE` 후 목록에서 항목을
   제거한다(서버 컴포넌트가 아니므로 `router.refresh()`가 아니라 `PresetPanel`의 로컬 상태를 직접
   갱신한다).

- [ ] **Step 1: `PresetPanel.tsx` 골격** — 마운트 시 `GET` 호출, 로딩/에러 상태
      (`GalleryManager.tsx` 패턴 참고)
- [ ] **Step 2: 목록 렌더** — 이름 + 색상 스와치 + 삭제 버튼
- [ ] **Step 3: 이름 클릭 → 불러오기** — `mergeStageState` 병합 + `writeStageState` + `onChange`
- [ ] **Step 4: 이름 입력 필드 + 저장 버튼** — POST, `409`면 `confirm()` → `overwrite: true` 재요청
- [ ] **Step 5: 삭제 버튼** — `confirm()` → `DELETE` → 목록에서 로컬 제거
- [ ] **Step 6: `StageControls.tsx`에 `PresetPanel` 합성** — `artistSlug`는 현재 선택된 아티스트 slug
- [ ] **Step 7: 시각 검증 (브라우저)** — **사람 확인 지점.** 저장 → 목록에 나타남 → 불러오기 → 씬
      반영, 이름 겹칠 때 confirm → 덮어쓰기, 삭제 동작, **로그아웃 후 재로그인해도 프리셋이 남아
      있는지**(§11 완료 기준) 확인
- [ ] **Step 8: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- §11 완료 기준: "프리셋을 저장한 뒤 로그아웃 → 재로그인해도 남아 있다" 충족
- §11 완료 기준: "프리셋 이름이 겹치면 확인 없이 덮어써지지 않는다 (409 → confirm → overwrite)" 충족
- §11 완료 기준: "프리셋 목록에 이름 옆 색상 스와치가 표시된다 (오클릭 방지)" 충족
- `npm run build` 통과

**검증 노트**:

---

### Task 6: 완료 기준 검증 · 문서 갱신

**Files:**
- Modify: `docs/design-v2.md` (§11 5장 체크박스)
- Modify: `README.md` (2차 로드맵 체크박스, 알려진 제한사항, 국영문 병기)

**Interfaces:** 없음 (검증·문서화 전담)

**왜**: §11 5장 완료 기준 7개 항목과 Task 1~5 개별 완료조건을 한 번 더 모아 확인하고,
§9.2("각 항목의 계획 요약과 검증 노트를 공개 문서로 남긴다")를 README에 반영한다.

- [ ] **Step 1: §11 5장 체크리스트 7개 항목 전체 재확인** — 새 필드 없는 구버전 저장값 병합 유지 /
      1차 저장값 호환(color 유지·spots·camera 리셋) / 슬라이더 실시간 반영 / 프리셋 재로그인 후 유지 /
      프리셋 이름 겹침 시 confirm→overwrite / 프리셋 목록 색상 스와치 표시 / 직접 작성한 셰이더 0줄
- [ ] **Step 2: `npm test` · `npm run build` 최종 통과 확인**
- [ ] **Step 3: `docs/design-v2.md` §11 5장 체크박스를 `[x]`로 갱신**
- [ ] **Step 4: `README.md` 갱신** — "2차 로드맵" 항목(197-201행 부근)에 `[x]` +
      `docs/plan-v2.2-stage-tools.md` 링크 추가(`plan-v2.1-supabase.md` 항목과 같은 형식), "알려진
      제한사항"의 "무대 연출 툴은 조명 프리셋·on/off·카메라 앵글 전환만 지원..." 문구(184행 부근)를
      실제 지원 범위로 갱신하거나 항목 자체를 제거, 영문 대응 문단(188-195행, 209-214행)도 함께 갱신
- [ ] **Step 5: 검증** — 최종 보고 후 멈춘다

**완료조건:**
- §11 5장 체크박스 7개 전부 확인 완료
- README 국문·영문 모두 갱신되고 서로 내용이 어긋나지 않는다
- `npm test` · `npm run build` 통과

**검증 노트**:

---

## 계획 검증 노트 (Self-Review)

계획을 쓴 뒤 design-v2.md 5장과 대조하며 확인한 것들.

**스펙 커버리지** — §5.1 → Task 1, §5.2 → Task 4·5, §5.3 → Task 3·5, §5.4 → Task 2. §11 5장 완료
기준 7개는 Task 6에서 한 번 더 모아 확인한다.

**설계 문서에 없던 결정 하나** — §5.1은 타입 변경만 명세하고 그로 인해 `StageControls.tsx`/
`StageScene.tsx`가 깨지는 문제는 다루지 않는다. Task를 "타입만"과 "소비처 정합"으로 쪼개면 그 사이
커밋에서 `npm run build`가 깨진 채로 남는데, 4장 Task 4가 같은 상황(읽기 경로 전환)에서 타입 변경과
호출부 수정을 한 Task로 묶어 이 창을 없앤 전례를 그대로 따랐다 — Task 1에 `StageControls.tsx`/
`StageScene.tsx`의 기계적 정합(슬라이더·스모그 같은 기능 추가는 제외)을 포함시켰다.

**Task 경계의 판단** — 슬라이더(Task 3)와 프리셋(Task 4·5)을 분리했다. 전자는 순수 UI 추가이고
후자는 새 API 계약(엔드포인트 3개)을 도입하므로, 한쪽이 막혀도 다른 쪽 리뷰·머지를 막지 않는다.
스모그(Task 2)를 슬라이더(Task 3)보다 먼저 둔 이유는 스모그 조절 UI(`SmokeControls`, Task 3)가
동작할 대상이 먼저 있어야 시각 검증이 되기 때문이다 — Task 2는 슬라이더 없이도 localStorage를
수동으로 주입해 독립적으로 검증 가능하게 설계했다.

**타입 일관성** — `mergeStageState(value: unknown, fallback: StageState): StageState`(Task 1)가
Task 5의 프리셋 로드에서 그대로 재사용된다. `SpotControls`/`SmokeControls`(Task 3)의 `onChange` 시그니처는
`StageControls`가 `state`를 조합해 자신의 `onChange`를 호출하는 기존 패턴과 맞는다. 프리셋 API
(Task 4)의 `state: StageState` 필드는 Task 1의 타입을 그대로 쓴다.

**모순 하나를 잡았다** — 처음 초안에서 Task 1의 완료조건에 `npm run build` 통과를 넣지 않고 "이후
Task에서 고쳐진다"는 각주만 두려 했으나, 그러면 Task 1 커밋 자체가 빌드를 깨뜨린 채 남는다. 위
"설계 문서에 없던 결정"에 정리한 대로 `StageControls.tsx`/`StageScene.tsx` 기계적 정합을 Task 1에
포함시켜 해소했다 — 이제 모든 Task가 끝난 시점에 `npm run build`가 통과한다.
