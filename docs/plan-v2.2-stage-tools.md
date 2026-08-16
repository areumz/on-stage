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
쪼갠 것이며, 타입 정의·API 계약·병합 로직의 **단일 진실 공급원은 design-v2.md다.** 이 문서는 4장과 동일한 문서 관리 방침을 따른다.

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

- [x] **Step 1: 실패하는 테스트 작성** — §5.1 표의 6개 케이스: `null` 저장값 · JSON 깨짐 · 1차
      저장값(`spots.left: true`, `angle` 키) · `smoke` 필드 없는 v2 저장값 · `spots.left`가 `on`만
      있고 나머지 3개 필드 없음 · `camera`가 열거값 밖의 문자열. 각 케이스에 왜 존재하는지 한국어
      주석 한 줄(1차 관행)
- [x] **Step 2: 테스트 실패 확인** — Run: `npm test`. Expected: FAIL (옛 `parseStageState`는
      필드별 병합을 하지 않으므로 새 케이스들이 기대와 다르게 나온다)
- [x] **Step 3: `stageState.ts` 최소 구현** — 타입 확장 + `mergeStageState`/`parseStageState` 재작성.
      구현은 design-v2.md §5.1 그대로(이 문서에는 인라인하지 않는다)
- [x] **Step 4: 테스트 통과 확인** — Run: `npm test`. Expected: PASS
- [x] **Step 5: `StageControls.tsx` 타입 정합** — 카메라 버튼의 `angle` 참조를 `camera`로,
      on/off 스위치의 `state.spots[key]`(boolean) 참조를 `state.spots[key].on`으로 교체.
      `onChange` 호출부도 새 필드 경로에 맞게 조정
- [x] **Step 6: `StageScene.tsx` 타입 정합** — `CAMERA_PRESETS`/`CameraRig`가 `StageState["camera"]`를
      참조하도록, `Spot`이 `on`/`intensity`/`angle`/`penumbra`를 하드코딩 리터럴 대신
      `state.spots.<key>`에서 받도록 변경
- [x] **Step 7: 시각 검증 (브라우저)** — **사람 확인 지점.** 무대 페이지가 이전과 동일하게 보이는지
      (조명 색·on/off·카메라 버튼 3개 동작 포함), 콘솔 에러가 없는지 확인. 슬라이더·스모그는 아직 없다
- [x] **Step 8: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- §5.1 표의 6개 테스트 케이스가 전부 통과한다
- `npm test` · `npm run build` 통과
- 무대 페이지가 이전과 시각적으로 동일하게 렌더된다(시각 검증) — 새 UI는 아직 없다
- `mergeStageState`에 `JSON.parse`나 `localStorage` 참조가 없다(순수성 — Task 5 재사용을 위한 전제)

**검증 노트**:
- TDD 순서대로 진행: `stageState.test.ts`를 5.1 표 기준 10개 테스트로 재작성(6개 케이스 + 전체
  유효값 라운드트립 · 배열 케이스 등 보강) → `npx vitest run` 실행해 7개 실패 확인
  (`mergeStageState is not a function`, `defaultStageState` 모양 불일치) → `stageState.ts` 구현 →
  10개 전부 PASS
- **계획에 없던 테스트 버그 하나 발견·수정**: "값이 객체가 아니면 fallback"을 `toBe`(참조 동일성)로
  검증하려 했는데, `typeof [1,2,3] === "object"`라 배열은 필드별 병합 경로를 타 버렸다(인식되는
  필드가 없어 결과적으로 fallback과 값은 같지만 참조가 다른 새 객체가 나옴). 구현 버그가 아니라
  테스트 쪽이 과했던 것으로 판단해 배열 케이스만 `toEqual`로 분리(null·문자열은 `typeof` 가드에서
  바로 반환되므로 `toBe` 유지)
- `StageControls.tsx`: `ANGLES`→`CAMERAS` 리네임, 스위치가 `state.spots[key].on` 참조 + `onChange`가
  `{ ...state.spots[key], on: !on }`로 해당 스팟 객체만 갱신하도록 수정, 카메라 버튼이 `state.camera`
  참조
- `StageScene.tsx`: `CAMERA_PRESETS`/`CameraRig` 타입을 `StageState["camera"]`로, `CameraRig`의 prop
  이름은 `angle`이 아니라 `cameraAngle`로 지음(`useThree()`가 이미 `camera`를 구조분해하므로 이름
  충돌 회피). `Spot`은 `on`/`intensity`/`angle`/`penumbra`를 `spot: SpotState` 하나로 받도록 변경,
  하드코딩 리터럴(300/0.45/0.6) 제거
- `npm test` → 3 files, 23 tests 전부 pass. `npm run build` → 성공(TypeScript 통과, 라우트 목록 이전과
  동일)
- 시각 검증(Playwright + 시스템 Chrome, 포트 3001 — 3000번 사용자 서버는 안 건드림): 데모 계정 로그인
  후 `/staff/stage?artist=aurora` 진입, 스위치 3개가 초기값대로 `Left: true / Center: true /
  Right: false`로 렌더, 카메라 버튼 3개·색상 스와치 6개 정상 표시. "객석 뷰" 클릭 → 카메라 이동,
  Right 스팟 스위치 클릭 → 조명 켜짐, 콘솔/페이지 에러 0건. 슬라이더(`type="range"`)는 계획대로
  아직 0개
- **범위 밖 이슈 하나 관찰·조사(이 Task와 무관, 손대지 않음)**: 로그인 직후 `/staff/dashboard`로
  이동하면 가끔 `getArtistId: JWT issued at future`로 500이 뜬다. Task 4(프리셋 API)가 로그인 세션에
  의존하므로 원인을 짚고 넘어감:
  - 로컬 시스템 클럭(`date -u`)이 외부 서버(구글) 응답 헤더·Supabase 프로젝트 응답 헤더와 1초 이내로
    일치 — 로컬 클럭 문제 아님
  - `/api/login`으로 직접 받은 세션 쿠키의 access token을 디코드해 `iat`를 확인 — 현재 시각보다
    11초 **과거**로 정상. 발급 시점의 토큰 자체는 문제없음
  - `npx supabase db query --linked "select now()..."`로 원격 Postgres 자체의 시각도 확인 —
    CLI 왕복 시간 범위 안에 정확히 들어와 정상
  - **재현성 확인**: 동일한 로그인→대시보드 요청을 5회 연속 실행 → 5회 전부 200(정상). 즉 결정론적
    코드 버그가 아니라 간헐적 레이스에 가깝다
  - 결론: `proxy.ts`/`server.ts`의 세션 처리 로직은 표준 패턴을 따르고 있고 로컬·DB 클럭 모두
    정상이므로 이 저장소 코드의 문제는 아니다. 최초 관찰 시점이 dev 서버에서 `/staff/dashboard`
    라우트를 처음 컴파일(Turbopack 콜드 컴파일)하던 요청이었다는 공통점이 있어 그 지연 중 발생한
    타이밍 이슈이거나, Supabase 인프라 내부(Auth↔Postgres) 클럭 지터일 가능성이 있다 — 어느 쪽이든
    앱 코드로 고칠 수 있는 지점이 아니다. 재현율이 낮고(5/5 성공) 세션 자체는 정상 동작하므로
    Task 4를 막지 않는다고 판단, 별도 조치 없이 다음 Task로 진행

---

### Task 2: 스모그 — fog + drei Cloud

**Files:**
- Modify: `src/components/three/StageScene.tsx`
- Create: `public/textures/cloud.png` (drei `Cloud`의 기본 텍스처를 로컬로 미러링 — 아래 검증 노트 참조)

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

- [x] **Step 1: `@react-three/drei` 버전 확인** — `package.json`에서 버전 확인, `Cloud` export 여부 확인
- [x] **Step 2: `StageScene.tsx`에 `fog` + `<Cloud>` 추가** — `state.smoke.density`/`color` 연결,
      `density === 0`일 때 스킵
- [x] **Step 3: 시각 검증 (브라우저)** — **사람 확인 지점.** 슬라이더가 아직 없으므로 브라우저 콘솔에서
      `localStorage.setItem('stage-state:<slug>', JSON.stringify({ ...기본값, smoke: { density: 0.6, color: '#ffffff' } }))` 후
      새로고침해 안개가 보이는지, `density: 0`으로 되돌리면 사라지는지 확인
- [x] **Step 4: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- `density > 0`일 때 안개가 시각적으로 나타나고, `0`일 때 완전히 사라진다(시각 검증)
- `npm run build` 통과. 새 형식적 테스트는 만들지 않는다(§9.1)
- `StageScene.tsx`에 직접 작성한 셰이더 코드(GLSL, `shaderMaterial` 등)가 없다

**검증 노트**:
- `package.json`의 `@react-three/drei`는 `^10.7.7`, `Cloud`/`Clouds` 둘 다 export됨(`node -e` 확인).
  새 의존성 추가 없이 그대로 사용
- `StageScene.tsx`에 `Smoke` 컴포넌트 추가(`Spot`과 같은 패턴) — `smoke.density === 0`이면 `null`
  반환(씬 그래프에 아예 안 올림), 그 외엔 `<fogExp2 attach="fog">` + `<Cloud>`
- **계획에 없던 튜닝 하나(중요)**: `smoke.density`(설계상 UI 슬라이더용 0~1 스케일)를 그대로
  `fogExp2`의 `density`와 `Cloud`의 `opacity`에 넣었더니, `density=0.7`에서 무대가 완전히 하얗게
  뒤덮여 아무것도 안 보였다. three.js `FogExp2.density`는 이 씬 규모(연단 8×0.8×4, 카메라 9~14
  거리)에서 보통 0.01~0.15가 적정 범위인데 0.7을 그대로 넣은 게 원인이었고, `Cloud`의 기본
  `bounds=[5,1,1]`/`volume=6`도 이 무대에 비해 커서 겹쳐 더 심해졌다. `fogExp2` density는
  `smoke.density * 0.1`로, `Cloud`는 `opacity={smoke.density * 0.6}` + `bounds={[4,1.2,1.5]}` +
  `volume={3}`로 눌러서 재검증 — `density=0.7`에서 조명·연단·배경 패널이 얇은 안개 사이로 여전히
  보이는 "무대 스모그"다운 결과로 나옴. 매핑 상수(`* 0.1`, `* 0.6`)는 이 씬 스케일에 맞춘 값이라
  Task 3에서 슬라이더 범위(§5.3 표: 0~1, step 0.05)를 그대로 쓰되 이 매핑은 유지한다
- **계획에 없던 조정 하나 더 — 외부 CDN 의존 제거**: drei `Cloud`는 기본적으로
  `rawcdn.githack.com`의 구름 텍스처 PNG를 원격 로드하는데, 이 환경에서 `curl`로 그 URL을 직접
  받아보니 403(Cloudflare 봇 차단)이 떴다. 실제 브라우저(Playwright/Chrome)로는 200이 왔으니 앱
  사용에는 지장이 없었지만, 도구·환경에 따라 막힐 수 있다는 걸 실측으로 확인한 셈이라 로컬로
  미러링했다: 브라우저로 텍스처를 받아 `public/textures/cloud.png`(256×256 PNG, 92KB)로 저장하고,
  `Cloud`를 단독으로 쓰면 `texture` prop을 바꿀 방법이 없어(내부적으로 자기 자신을 기본 `Clouds`로
  감싸버림 — drei 소스 확인) `<Clouds texture="/textures/cloud.png"><Cloud .../></Clouds>`로 직접
  감싸는 형태로 바꿨다. 셰이더는 여전히 drei 내부 것이라 완료 기준(0줄)에는 영향 없음. 재검증(Playwright
  네트워크 요청 캡처)에서 `localhost:3001/textures/cloud.png` 요청 1건만 나가고 외부 요청 0건,
  화면은 CDN 텍스처를 쓰던 것과 시각적으로 동일함을 확인
- 시각 검증(Playwright, 포트 3001): 로그인 → `/staff/stage?artist=aurora` 진입(density 기본값 0,
  기존과 동일한 화면) → localStorage에 `smoke.density: 0.7` 수동 주입 후 새로고침(스모그 표시,
  콘솔 에러 0건) → 다시 `density: 0`으로 새로고침(스모그 완전히 사라짐, 이전 화면과 동일) 3단계 전부 확인
- `npm test` → 3 files, 23 tests 전부 pass(변경 없음). `npm run build` → 성공
- `grep -n "GLSL|shaderMaterial|onBeforeCompile" src/components/three/StageScene.tsx` → 0건
  (직접 작성한 셰이더 코드 없음)

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

- [x] **Step 1: `SpotControls.tsx` 작성** — on/off 스위치(기존 `StageControls`의 스위치 마크업 재사용) +
      intensity/angle/penumbra 슬라이더 3개
- [x] **Step 2: `SmokeControls.tsx` 작성** — density 슬라이더 + `<input type="color">`
- [x] **Step 3: `StageControls.tsx`를 orchestrator로 재구성** — 색상 섹션에 `<input type="color">` 추가
      (스와치 유지), `SpotControls`를 `left`/`center`/`right` 3번 렌더, `SmokeControls` 추가. 카메라
      3버튼 섹션은 그대로 둔다(Task 1에서 이미 `camera` 키로 정합됨)
- [x] **Step 4: 시각 검증 (브라우저)** — **사람 확인 지점.** 슬라이더 조작이 3D 씬에 실시간
      반영되는지(§11 완료 기준), 스모그 슬라이더가 Task 2의 안개를 조절하는지, 색상 피커가 즉시
      반영되는지, 스와치 버튼도 여전히 동작하는지 확인
- [x] **Step 5: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- §11 완료 기준: "슬라이더 조작이 R3F 씬에 실시간 반영된다" 충족(시각 검증)
- 앱 전체에 `type="range"`가 10개 존재한다(스팟 3×3 + 스모그 1) — **문서 오류 수정**: 처음 이 절을
  쓸 때 괄호 설명("3×3+1")과 별개로 조건 문장에 "12개 이상"이라 잘못 적었다. 3×3+1은 10이고,
  실측도 10이라 조건 문장을 10으로 바로잡는다
- `npm run build` 통과. 새 형식적 테스트는 만들지 않는다(§9.1)

**검증 노트**:
- `SpotControls.tsx`/`SmokeControls.tsx` 신규 작성, `StageControls.tsx`는 orchestrator로 재구성
  (조명 프리셋 → 조명 전원·세부 조절 → 카메라 앵글 → 스모그, 4개 섹션). 패널이 세로로 길어져
  `<aside>`에 `overflow-y-auto` 추가 — `StageStudio.tsx`의 부모 컨테이너가 `overflow-hidden`이라
  이게 없으면 아래쪽 슬라이더(카메라·스모그)가 잘려서 아예 조작 불가능했을 것
- 슬라이더 range/step 상수는 각 컴포넌트 모듈 최상단에 배열 하나로(`SpotControls`의 `SLIDERS`,
  `SmokeControls`의 `DENSITY`) 두고 `.map()`으로 렌더 — 스팟 3번 렌더에서 같은 배열을 재사용하므로
  매직넘버가 여러 곳에 흩어지지 않는다
- 시각 검증(Playwright, 포트 3001): range input 10개, switch 3개(Left/Center/Right = true/true/false,
  Task 1과 동일한 기본값) 확인. 스모그 농도 슬라이더를 0.6으로 조작 → 안개가 눈에 띄게 짙어짐.
  조명 색 `<input type="color">`를 초록(#22cc88)으로 변경 → 스팟라이트 색이 즉시 초록으로 바뀜.
  아티스트 스와치 클릭도 정상 동작. 콘솔/페이지 에러 0건
- intensity 슬라이더를 최댓값(1000)으로 옮겼을 때는 육안상 밝기 차이가 크지 않았다 — 당시엔 렌더러
  톤매핑 한계로 판단하고 넘어갔으나, **이 진단은 틀렸다.** 실제 원인과 수정은 아래 "수정 이력" 참조
- `npm test` → 3 files, 23 tests 전부 pass(변경 없음). `npm run build` → 성공

**수정 이력 — 실사용 중 발견된 버그 두 건 (2026-08-15)**

Task 3를 완료 처리한 뒤 실제로 슬라이더를 조작하다가 (1) 스모그/조명 슬라이더를 빠르게
움직이면 3D 씬이 흰 화면 + 깨진 아이콘과 함께 멈추는 현상과 (2) 밝기·번짐 슬라이더가 조명각과
달리 전혀 반영되지 않는 현상을 발견해 재조사했다. 둘 다 `src/components/three/StageScene.tsx`
(및 하나는 `src/lib/hooks.ts`)를 고쳐 해결했다.

1. **슬라이더를 빠르게 드래그하면 `webglcontextlost`가 반복 발생했다** (GPU 컨텍스트 상실).
   브라우저에 `webglcontextlost`/`restored` 리스너를 직접 걸어 재현·확인했다. 처음엔 drei `Cloud`의
   `opacity`가 슬라이더 값에 묶여 있어 내부 `useMemo`(의존성에 `opacity` 포함)가 매 틱마다 구름
   배치를 재계산하는 게 원인이라 보고 `Cloud`의 `opacity`를 고정값(0.4)으로 바꿨는데, 재현해보니
   스모그를 아예 안 건드리고 조명 밝기만 조작해도 **똑같이 재현됐다** — 원인이 스모그 전용이
   아니었다. `@react-three/fiber`의 `Canvas` 구현(`node_modules/@react-three/fiber/dist/
   react-three-fiber.esm.js`)을 직접 읽어, `camera`/`children`이 바뀔 때마다 실행되는
   `useIsomorphicLayoutEffect`가 **의존성 배열 없이** 매 렌더마다 `configure()` + `render()`를
   비동기로 다시 돈다는 걸 확인했다 — 슬라이더 드래그처럼 초당 수십 번 상태가 바뀌면 이 비동기
   재구성 사이클이 겹쳐 쌓이며 GPU가 못 버티는 것으로 판단된다. **고침**: `src/lib/hooks.ts`에
   `useThrottledChange` 훅을 추가해, 슬라이더의 `onChange`가 3D 씬(과 localStorage 커밋)까지
   흘러가는 빈도를 100ms(초당 10커밋)로 제한했다. `<input>` 자체는 여전히 React 상태로 controlled라
   드래그 중 화면에 보이는 슬라이더 움직임 자체는 그대로 매끄럽다 — 3D 씬 반영만 살짝 늦춰진다.
   rAF(16ms) 간격으로도 재현됐고, 실측으로 30~50ms는 간헐적, 80~100ms에서 안정적으로 사라지는 걸
   반복 확인해 100ms로 정했다(이 환경의 가상 GPU가 실제 사용자 기기보다 약할 수 있어 다소 보수적으로
   잡음). `SpotControls.tsx`/`SmokeControls.tsx`의 슬라이더 `onChange`에 적용
2. **밝기(intensity)·번짐(penumbra) 슬라이더가 시각적으로 전혀 반영되지 않았다** (조명각만 정상).
   drei `SpotLight`(`node_modules/@react-three/drei/core/SpotLight.js`) 소스를 직접 읽어 원인을
   찾았다 — 화면에 보이는 보라색 빛줄기는 `SpotLight`가 내부적으로 그리는 `VolumetricMesh`인데,
   이 컴포넌트는 `angle`/`attenuation`/`anglePower`/`opacity`/`color`/`distance`만 props로 받고
   **`intensity`와 `penumbra`는 아예 받지 않는다.** `intensity=0`과 `intensity=1000`을 스크린샷으로
   비교해 픽셀 단위로 동일함을 확인해 실증했다. `intensity`는 실제 `THREE.SpotLight`(바닥·연단을
   비추는 진짜 광원)에는 정상 전달되고 있었지만, 눈에 띄는 빛줄기 모양에는 반영되지 않아 "슬라이더가
   안 먹는다"로 보였던 것. **고침**: `<SpotLight>`에 `opacity={spot.intensity / 1000}`을 추가해
   intensity를 빛줄기의 가시적 밝기에도 매핑했다 — 재검증 스크린샷에서 0일 때 빛줄기가 거의 안
   보이고 1000일 때 뚜렷하게 밝아지는 걸 확인. **penumbra는 고치지 않았다** — `VolumetricMesh`에
   대응하는 파라미터가 없어, 새 셰이더를 직접 쓰지 않는 한(§5.4/§11의 "직접 작성한 셰이더 0줄"
   제약과 충돌) 빛줄기 모양에 반영할 방법이 없다. `penumbra`는 여전히 실제 광원의 조도 경계
   부드러움에는 정상 적용되지만, 그 효과가 빛줄기보다 훨씬 은은해 체감하기 어렵다 — 알려진 한계로
   남겨둔다
3. (참고, 데이터 버그 아님) 조명을 조절하니 안개도 바뀌는 것처럼 보였던 건 실제로는
   `state.smoke`가 조명 조작으로 변경된 게 아니라(localStorage로 직접 확인, 값 불변), drei `Cloud`가
   `MeshLambertMaterial` 기반이라 씬의 스팟라이트 색·밝기를 실제로 받아 그 빛으로 물드는 정상
   렌더링이었다 — 바닥·연단이 조명 색에 물드는 것과 같은 원리

**재검증**: 두 수정 반영 후 `npm test`(23개 pass)·`npm run build` 재통과. `webglcontextlost` 리스너를
건 상태로 스모그만 조작(원래 재현 조건)·조명 밝기만 조작(스모그 무관 확인) 각각 재현 시도 → 둘 다
이벤트 0건. intensity 0→1000 전후 스크린샷에서 빛줄기 밝기 차이 육안 확인

**추가 조사 — 실제 마우스 드래그 경로에서는 여전히 간헐적으로 재현됨**: 합성 dispatch(51회, 자연스러운
간격)로는 100ms 쓰로틀 후 재현이 안 됐지만, `page.mouse.move()`로 슬라이더 위를 200스텝 촘촘하게 실제
드래그하면 100ms 쓰로틀 후에도 가끔(수 회 중 1회꼴) 재현됐다. 원인을 좁히려고 그림자(`shadows`/
`castShadow`/`receiveShadow`)를 전부 꺼서 재시도 — 프레임마다 반복 출력되던
`THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated` 경고는 사라졌지만(그림자 렌더가 매
프레임 부하를 만드는 건 사실) **크래시 자체는 그림자를 꺼도 재현돼**, 그림자가 근본 원인은 아니라고
판단해 원복했다(diff 없음). 남은 가설은 `@react-three/fiber`의 `<Canvas>`가 `camera`/`children` prop이
바뀔 때마다 의존성 배열 없는 `useIsomorphicLayoutEffect`에서 비동기 `configure()+render()`를 다시
도는 구조 자체(위 1번 항목)이며, 완전히 없애려면 슬라이더처럼 자주 바뀌는 값을 React state가 아니라
ref + `useFrame`으로 R3F 트리 안에서 직접 갱신하는 아키텍처 변경이 필요해 보인다 — 이건 Task 3(슬라이더
UI) 범위를 넘어서는 더 큰 리팩터라 이번엔 손대지 않았다. **실제 브라우저에서 재확인한
결과 이 시점 이후로는 크래시가 재현되지 않았다** — 100ms 쓰로틀만으로 실사용 시나리오에서는 충분한
것으로 보이며, 남은 재현 조건(합성 200스텝 드래그)은 실제 사람이 만들기 어려운 극단적 패턴이라
당장 추가 조치는 하지 않는다. 재발 시 위 ref/useFrame 리팩터를 다음 단계로 고려한다

**진짜 원인을 찾음 — A탭까지 번진 이유 (2026-08-16)**

A탭 3D 렌더링 부분에도 문제가 생겼다. 처음에는 기기 문제 또는 테스트동안 GPU를 너무 많이 돌려서 라는 의심도 있었지만 1차 배포 내내 이 문제가 전혀 없었고, 2차부터 생겼으므로 기기 문제는 우선 배제하고 2차 고도화 작업 시작 시점부터 다시 조사했다. (chrome://gpu 로 확인도 추가로 한 결과 특별한 이상점 찾을 수 없었음). `git worktree`로 1차 마지막 커밋(`979c1a6`, Supabase 착수 직전)을 별도 디렉터리에 체크아웃해 **완전히 동일한 기기·브라우저·스크롤 테스트**로 직접 A/B 비교했다.

- 1차 실제 코드: 동일 테스트(스크롤 왕복 3라운드, 120회) → **`webglcontextlost` 관련 경고 0건**
- 2차(A탭 코드는 이 세션 시작 전 상태로 완전 복구된 상태) 같은 테스트 → 20건 이상, 매번 재현

같은 기기·브라우저에서 코드만 다른데 결과가 이렇게 갈리므로, 기기 문제가 아니라 **2차에서 실제로
바뀐 코드**가 원인인 게 100% 확정됐다. `three`/`@react-three/fiber`/`@react-three/drei` 버전은
1차·2차 `package-lock.json`에서 완전히 동일함을 확인해 의존성 업데이트도 배제, `next.config.ts`의
`transpilePackages` 제거·`layout.tsx`의 `HYDRATION_GUARD_SCRIPT` 제거도 각각 별도로 테스트했지만
둘 다 무관했다(경고 그대로 재현).

**실제 원인**: `src/components/three/Scene3D.tsx` 자체가 2차(1차 이후, 이 계획 이전)에 새로 추가된
파일이다 — 1차엔 `HeroBackground`/`OrbitScene`/`TourOrbit`/`GalleryHaze`가 전부 `<Canvas>`를
직접 썼다. 이 Scene3D 안의 `useHasWebGL()`이:

```ts
function hasWebGL(): boolean {
  const canvas = document.createElement("canvas");
  return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
}
useSyncExternalStore(noopSubscribe, hasWebGL, () => true);
```

`useSyncExternalStore`는 구독 변경 감지를 위해 **`getSnapshot`을 매 렌더마다 호출한다.** 캐싱 없이
`hasWebGL`을 그대로 넘겨서, Scene3D를 쓰는 컴포넌트가 리렌더될 때마다(스크롤 이벤트로 계속
리렌더되는 `TourSection`의 `useSectionScroll` 등) **버려지는 임시 `<canvas>`와 WebGL 컨텍스트를
계속 새로 만들고 있었다.** `document.createElement`를 가로채 실측: 스크롤 20회 만에 여분의 캔버스
생성 5회(이미 렌더링용 3개가 만들어진 뒤인데도). 눈에 보이는 캔버스 3개보다 실제로 요청되는
컨텍스트가 훨씬 많아지고, 브라우저의 동시 WebGL 컨텍스트 한도를 쉽게 넘겨 "Too many active WebGL
contexts"로 기존 렌더링 캔버스가 강제로 밀려나는 것 — 이게 이 세션 내내 쫓던 A탭 크래시의 실제
원인이었다. B탭 슬라이더 문제(위 1~8번)의 여러 완화책이 부분적으로만 효과 있었던 것도 이 근본
원인을 안 건드렸기 때문으로 설명된다.

**고침**: WebGL 가용 여부는 세션 중 안 바뀌므로 모듈 스코프 변수에 결과를 캐싱해 실제 `canvas`
생성·`getContext` 호출은 앱 전체에서 딱 한 번만 일어나게 했다. `useSyncExternalStore` 자체(SSR
안전성 확보 목적)는 그대로 유지 — `getSnapshot`이 매 렌더 호출되는 건 똑같지만 이제 캐시된 값만
반환한다.

**재검증**: 1차와 똑같은 조건(스크롤 왕복 3라운드, 120회)을 A탭에서 3회 반복 → **3회 전부
여분 캔버스 생성 0건, webgl 경고 0건** — 1차와 동일한 결과로 수렴함을 확인. B탭도 재확인:
실제 마우스로 밝기 슬라이더 200스텝 드래그 → 경고 0건(이전엔 이것도 가끔 남아 있었는데 근본
원인이 사라지며 같이 해소됨), 강제 컨텍스트 손실 시 문구도 정상 표시. `npm test`(23개)·
`npm run build` 재통과

**추가 버그 두 건 (실사용 중 발견, 같은 날)**

4. **`penumbra` 슬라이더 제거.** 3번 항목에서 이미 확인했듯 drei `SpotLight`의 시각적 빛줄기
   (`VolumetricMesh`)는 `penumbra`를 받지 않아 슬라이더를 움직여도 화면이 안 바뀐다. intensity처럼
   우회 매핑할 대응 파라미터도 `VolumetricMesh`에 없다. "움직여도 안 바뀌는 슬라이더"가 사용자를
   더 혼란스럽게 한다고 판단해 `SpotControls.tsx`의 `SLIDERS`에서 `penumbra` 항목을 제거했다.
   `SpotState` 타입과 기본값(0.6)은 그대로 둔다 — 실제 `THREE.SpotLight`에는 여전히 적용되고,
   Task 4~5의 프리셋 저장/불러오기도 이 필드를 그대로 오간다. UI에서만 뺐다
5. **스모그 농도를 올리면 연단·배경뿐 아니라 바닥까지 지평선까지 순백으로 뒤덮였다.** 바닥
   (`planeGeometry`)이 30×30이라 카메라에서 먼 가장자리는 다른 오브젝트보다 훨씬 멀고,
   `fogExp2`(지수 안개)는 거리 제곱에 비례해 짙어지므로 그 먼 가장자리부터 순백으로 사라져
   "스모그"가 아니라 "바닥이 없어지는" 것처럼 보였다(사용자가 스크린샷으로 제보). **고침**: 바닥
   머티리얼에 `fog={false}`를 줘서 바닥만 안개 계산에서 제외했다(연단·배경 패널은 그대로 안개를
   받는다 — 스모그가 그 주변을 감싸는 느낌은 유지). 겸사겸사 `fogExp2` density 배율도
   `smoke.density * 0.1`에서 `* 0.06`으로 낮춰 최대 농도에서도 연단·배경이 완전히 하얗게
   덮이지 않도록 했다. 재검증 스크린샷(density=1, 최대)에서 바닥은 원래 색 유지, 연단·배경은
   완전히 안 보일 정도는 아닌 채로 스모그에 감싸인 모습 확인
6. **농도를 올려도 화면이 밝아지기만 하지 연기가 짙어지는 느낌이 안 드는 문제.** 5번
   수정 이후 fog는 정상 반응했지만(연단·배경이 어두운 색→밝게 씻김), 정작 눈에 띄는 구름 뭉치
   크기·농도는 1번 수정 때 고정값(0.4)으로 박아둔 `Cloud`의 `opacity` 때문에 슬라이더와 무관하게
   그대로였다 — 그래서 "연기가 진해진다"가 아니라 "그냥 밝아진다"로 읽혔다. **재검토**: 1번 수정
   당시엔 `useThrottledChange`가 아직 없어서 opacity를 슬라이더에 직접 묶으면 초당 수십 번
   재계산이 몰렸지만, 지금은 `SmokeControls`의 `onChange` 자체가 이미 100ms로 눌려 있어
   opacity 갱신도 그 이하 빈도로만 일어난다. `Cloud`의 `opacity`를 다시
   `smoke.density * 0.6`으로 연결하고, 가장 가혹했던 재현 조건(실제 마우스로 스모그 슬라이더
   200스텝 드래그)을 3회 반복 재시도 → **3회 전부 `webglcontextlost` 0건.** density
   0.2/0.4/0.6/0.8 스크린샷 비교로 구름이 옅은 안개→뚜렷한 뭉치로 단계적으로 짙어지는 것도 확인
7. **크래시가 났을 때 기본 깨진 이모티콘만 떠서 사용자에게 혼란을 줄 수 있는 문제.**
   `webglcontextlost`는 JS 에러를 던지지 않는 캔버스 DOM 이벤트라 기존 `SceneErrorBoundary`(React
   렌더 에러 전용)로는 못 잡는다. `src/components/three/Scene3D.tsx`에 전용 훅(`useCanvasContextLoss`)을
   추가해 캔버스에 `webglcontextlost`/`webglcontextrestored` 리스너를 직접 걸었다.
   **`preventDefault()`를 반드시 호출해야 한다** — 안 부르면 브라우저가 컨텍스트를 영구히 죽은
   채로 두고 `webglcontextrestored`가 아예 안 온다. 잃은 동안은 캔버스를 감싸는 새 `relative` 래퍼
   위에 `absolute` 오버레이로 "일시적으로 3D 콘텐츠를 표시할 수 없습니다. 잠시 후 다시
   시도해주세요"를 띄운다 — 아예 못 쓰는 경우의 `DefaultFallback` 문구와는 성격이 달라 재사용하지
   않고 별도 컴포넌트(`ContextLostOverlay`)로 분리했다. `Scene3D`는 5개 3D 씬
   (`OrbitScene`·`HeroBackground`·`TourOrbit`·`StageScene`·`GalleryHaze`) 전부가 공유하는 컴포넌트라,
   새로 감싼 `relative h-full w-full` 래퍼가 기존 레이아웃(특히 `HeroBackground`의
   `className="absolute inset-0"`)을 깨지 않는지 홈 화면(A탭) 스크린샷으로 별도 확인했다.
   재검증: `WEBGL_lose_context` 익스텐션으로 강제 재현 → 오버레이 문구 정상 표시 →
   `restoreContext()` → 오버레이 사라지고 씬 정상 렌더 복구, 홈 화면 3D 요소 전부 시각적으로
   이전과 동일
8. **A탭(아티스트 페이지)에서 스크롤할 때마다 7번 오버레이가 뜨고, 심할 땐 8~9초씩 복구가
   안 됐다.** 브라우저 콘솔에 `WARNING: Too many active WebGL contexts. Oldest context will be
   lost.`가 직접 찍히는 걸 확인 — Chrome이 동시에 열 수 있는 WebGL 컨텍스트 개수에 하드 리밋이
   있고, 넘기면 가장 오래된 걸 강제로 죽인다. 원인을 분리해서 확인했다:
   - **R3F `<Canvas>`는 기본적으로 스크롤할 때마다 컨테이너 크기를 다시 잰다**
     (`react-use-measure`의 `scroll: true`). 그 재측정이 슬라이더 드래그 때와 같은 종류의
     `<Canvas>` 재구성을 다시 유발한다. `Scene3D.tsx`의 `<Canvas>`에
     `resize={{ scroll: false }}`를 기본값으로 추가해 껐다(개별 호출부가 직접 `resize`를
     넘기면 그쪽이 우선).
   - **아티스트 페이지 하나에 캔버스가 처음부터 3개(히어로+투어+갤러리) 동시에 켜져 있었다.**
     아직 스크롤도 안 한 아래쪽 섹션이 로드 즉시 컨텍스트를 켤 이유가 없어, `src/lib/hooks.ts`에
     `useInView` 훅을 추가해 `TourSection.tsx`/`GallerySection.tsx`가 실제로 화면에 들어올 때만
     `TourOrbit`/`GalleryHaze`를 마운트하도록 바꿨다. 한 번 보인 뒤엔 다시 스크롤해서 벗어나도
     언마운트하지 않는다 — 반복 마운트/언마운트가 컨텍스트를 더 자주 만들고 없애 문제를 오히려
     키우기 때문. 재검증: 로드 직후 canvas 2개(히어로 + `rootMargin` 여유로 미리 뜬 투어),
     갤러리까지 스크롤해야 3개, 다시 위로 스크롤해도 3개 유지(언마운트 안 됨) 확인
   - **이 시점엔 완전히 해소되지 않았다** — 두 원인을 고친 뒤에도 격렬한 스크롤(3라운드 반복) 시
     `Too many active WebGL contexts` 경고가 간헐적으로 남았고, 당시엔 "테스트 환경(가상 GPU로
     추정)의 동시 WebGL 컨텍스트 한도가 유난히 낮은 것 아닌가"로 추정했다. **이 추정은 틀렸다** —
     원점 재조사한 끝에 진짜 원인(상단 **"진짜 원인을 찾음 — A탭까지 번진
     이유"** 항목 — `useHasWebGL`이 리렌더마다 새 캔버스+WebGL 컨텍스트를 만들던 버그)을
     찾아 고쳤고, 그 수정으로 이 잔여 경고까지 포함해 완전히 해소됐다(스크롤 3라운드×3회 반복
     전부 경고 0건 재검증 완료). 즉 위 두 원인(스크롤 재구성, 동시 마운트 3개)은 부분적으로만
     유효한 완화책이었고, 이 항목의 잔여 문제를 실제로 없앤 건 그 뒤에 찾은 캐싱 수정이다.

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

- [x] **Step 1: `GET` 구현** — `getArtistId`로 slug→id 변환, `stage_presets`에서 `artist_id` 필터
      select (RLS가 `user_id`는 자동으로 거른다)
- [x] **Step 2: `POST` 구현** — 세션 확인 → 401, body 검증(`artistSlug`/`name`/`state` 존재) → 400,
      `overwrite` 여부로 insert/upsert 분기, `23505` → 409
- [x] **Step 3: `DELETE` 구현** — 세션 확인 → 401, delete + 0행 체크 → 403
- [x] **Step 4: API 수동 검증** (curl 또는 브라우저 devtools, 로그인 세션 사용) — GET 빈 배열 →
      POST 성공 201 → 같은 이름 POST 재요청 409 → `overwrite: true` 재요청 200대 성공 → DELETE 204 →
      존재하지 않는/타인 id DELETE 403
- [x] **Step 5: 검증** — 아래 완료조건 확인

**완료조건:**
- Step 4의 수동 시나리오 전부가 기대한 상태 코드를 반환한다
- `npm run build` 통과
- `grep -rn "SERVICE_ROLE" src/app/api/stage-presets`가 0건이다(런타임 경로에서 service role
  미사용 원칙, §4.5)

**검증 노트**:

- `gallery`/`gallery/[id]` route의 기존 패턴(세션 확인 → 401, body 필드 존재 확인 → 400,
  `getArtistId`로 slug→id 변환 → 404, RLS가 걸러 0행이면 403)을 그대로 따름. 새 판단 없음.
- `POST`의 `overwrite` 분기는 `upsert(row, { onConflict: "user_id,artist_id,name" })`, 아니면
  plain `insert` 후 `error.code === "23505"`로 중복 판별해 409.
- `npm run build` 통과, `grep -rn "SERVICE_ROLE" src/app/api/stage-presets` 0건.
- 수동 검증: `next build` + `next start -p 3001`로 프로덕션 서버를 띄우고(포트 3000은 손대지
  않음), `.env.local`의 `SEED_OWNER_EMAIL`/`SEED_OWNER_PASSWORD`로 `/api/login` 로그인 후
  실제 세션 쿠키로 아래 7단계를 curl로 실행 — 전부 기대값과 일치:
  1. `GET ?artist=aurora` → `200 { presets: [] }`
  2. `POST` 신규(`__verify_test_*__` 이름) → `201 { id }`
  3. 같은 이름 재`POST`(overwrite 없음) → `409 { error: "duplicate" }`
  4. 같은 이름 `POST` `overwrite:true` → `201 { id }`(같은 id, `state`는 새 값으로 덮어써짐 확인)
  5. `GET` → 덮어쓴 `state`가 반영된 것 확인
  6. 방금 만든 id `DELETE` → `204`
  7. 존재하지 않는 id(`00000000-...`) `DELETE` → `403 { error: "forbidden" }`
  8. `GET` → 테스트 프리셋 완전히 사라짐(잔여 데이터 없음 확인)
- 테스트에 쓴 프리셋은 실 프리셋과 섞이지 않게 타임스탬프가 들어간 고유 이름을 쓰고 마지막에
  직접 `DELETE`로 지워, 실 데이터를 남기지 않음.

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

- [x] **Step 1: `PresetPanel.tsx` 골격** — 마운트 시 `GET` 호출, 로딩/에러 상태
      (`GalleryManager.tsx` 패턴 참고)
- [x] **Step 2: 목록 렌더** — 이름 + 색상 스와치 + 삭제 버튼
- [x] **Step 3: 이름 클릭 → 불러오기** — `mergeStageState` 병합 + `writeStageState` + `onChange`
- [x] **Step 4: 이름 입력 필드 + 저장 버튼** — POST, `409`면 `confirm()` → `overwrite: true` 재요청
- [x] **Step 5: 삭제 버튼** — `confirm()` → `DELETE` → 목록에서 로컬 제거
- [x] **Step 6: `StageControls.tsx`에 `PresetPanel` 합성** — `artistSlug`는 현재 선택된 아티스트 slug
- [x] **Step 7: 시각 검증 (브라우저)** — **사람 확인 지점.** 저장 → 목록에 나타남 → 불러오기 → 씬
      반영, 이름 겹칠 때 confirm → 덮어쓰기, 삭제 동작, **로그아웃 후 재로그인해도 프리셋이 남아
      있는지**(§11 완료 기준) 확인
- [x] **Step 8: 검증** — 아래 완료조건 확인

**완료조건:**
- §11 완료 기준: "프리셋을 저장한 뒤 로그아웃 → 재로그인해도 남아 있다" 충족
- §11 완료 기준: "프리셋 이름이 겹치면 확인 없이 덮어써지지 않는다 (409 → confirm → overwrite)" 충족
- §11 완료 기준: "프리셋 목록에 이름 옆 색상 스와치가 표시된다 (오클릭 방지)" 충족
- `npm run build` 통과

**검증 노트**:

- `GalleryManager.tsx` 패턴을 그대로 따름 — 업로드 대신 프리셋 CRUD지만 로딩/에러 상태,
  `confirm()` 기반 삭제, 지역 상태 직접 갱신(서버 컴포넌트가 아니라 `router.refresh()` 대신
  `setPresets`로 로컬 갱신) 구조가 동일.
- 저장 버튼은 항상 `overwrite: false`로 먼저 POST하고, `409`를 받으면 `confirm()` → 승인 시
  `overwrite: true`로 재요청하는 2단계 함수(`postPreset`)로 구현. 재귀 대신 순차 `await` 두 번으로
  단순화해 `saving` 상태 관리가 꼬이지 않게 함.
- `StageControls`에 `artistSlug` prop을 새로 추가하고 `StageStudio.tsx`가 이미 들고 있던 `slug`를
  그대로 전달 — 새 상태 없이 기존 값 배선만 추가.
- 3001 포트에 프로덕션 서버(`next start`)를 띄우고 Playwright(시스템 Chrome, `channel: "chrome"`)로
  실제 로그인 세션을 만들어 자동화 시나리오로 브라우저 검증(3000번 포트는 손대지 않음):
  1. 저장 전 목록에 없음 확인 → 이름 입력 후 저장 → 목록에 1건 나타남
  2. 같은 이름으로 재저장 → 브라우저 `confirm()` 다이얼로그("이미 있는 이름입니다. 덮어쓸까요?")가
     실제로 뜸 → 수락 시 덮어쓰기 성공
  3. 현재 씬을 카메라 `탑 뷰`로 바꾼 뒤 저장해둔 프리셋(카메라 `정면`) 클릭 → 카메라 버튼의
     `aria-pressed`가 `정면`으로 되돌아옴 → `mergeStageState` 병합 + `onChange` 반영 확인
  4. 삭제 버튼 클릭 → `confirm()` 다이얼로그 → 수락 → 목록에서 즉시 사라짐
  5. **§11 재로그인 유지 확인**: 새 프리셋 저장 → 새 탭에서 다시 `/staff/login`부터 로그인 →
     `/staff/stage?artist=aurora` 재방문 → 저장했던 프리셋이 목록에 그대로 있음 확인(Supabase
     테이블 기반이라 세션과 무관하게 남는 것을 실제 재로그인 흐름으로 재확인)
  - 첫 시도에서 재로그인 페이지에 `dialog` 리스너를 안 걸어 삭제 `confirm()`이 자동 취소되는 걸
    발견(앱 버그 아님, 검증 스크립트 실수) — 리스너 추가 후 재실행해 정정.
- 색상 스와치 스크린샷으로 육안 확인 — 프리셋 이름 왼쪽에 Aurora 조명색(`#9F77DD`)과 일치하는
  보라색 점이 표시됨, 오른쪽엔 삭제 버튼.
- 검증에 쓴 프리셋은 전부 타임스탬프 포함 고유 이름으로 만들고 끝에 직접 삭제 —
  최종 `GET`으로 잔여 데이터 0건 확인.
- `npm test`(23개) · `npm run build` 재통과.
- **범위 외 추가 변경**: `window.confirm()`을 커스텀 `ConfirmDialog`/`useConfirm()`
  (`src/components/staff/ConfirmDialog.tsx`, 신규)으로 교체하면서, 같은 네이티브 `confirm()`
  패턴을 쓰던 4장의 `GalleryManager.tsx`도 같이 옮겼다 — 저장/삭제(Task 5)에 이어 삭제(4장)까지
  이 패턴이 세 번째로 반복돼 이번에 공용 컴포넌트로 뽑는 게 맞다고 판단, 사용자 요청으로 진행.

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
