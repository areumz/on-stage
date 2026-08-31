# ON-STAGE 2차 구현 계획 2.5 — 반응형 (Implementation Plan v2.5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> 2차 고도화는 항목마다 별도 계획 문서를 갖는다. 번호는 [`docs/design-v2.md`](./design-v2.md) 3장의
> 시퀀싱(2.1~2.5)을 따른다. 이 문서는 **2.5 반응형**만 다룬다 — 로드맵의 마지막 항목이다.

**Goal:** A탭 4개 R3F 씬·아티스트 페이지·B탭 사이드바 4화면·무대 연출 툴이 `sm`(640)/`md`(768) 아래
에서 깨지지 않게 한다. 브레이크포인트는 Tailwind 기본값만 쓰고, 수치(DPR·파티클·카메라 거리)는
전부 실측(실제 배포본 Playwright 모바일 에뮬레이션 + 로컬 빌드 스크린샷 비교) 근거로 정해졌다.

**Architecture:** 다섯 R3F 씬이 공유하는 `Scene3D.tsx` 한 곳에 DPR 클램프를 넣어 전부에 자동
적용하고(Task 1), `OrbitScene`은 카메라 거리를 컨테이너 비율에서 동적으로 계산해 궤도가 항상
프레임 안에 들어오게 한다(Task 2). 나머지는 각 화면의 독립적인 Tailwind 반응형 클래스
작업이다(Task 3~6) — 서로 파일이 겹치지 않아 어떤 순서로 진행해도 무방하다. Task 7이 전체
완료 기준을 검증하고 문서를 갱신한다.

**Tech Stack:** Next.js 16.2.12 / React 19.2.4 / `@react-three/fiber` · `three` · `@react-three/drei`
(Sparkles/Cloud) / Tailwind CSS 4 (기본 브레이크포인트) / vitest (node 환경, 순수 함수만)

**승인된 설계:** [`docs/design-v2.md`](./design-v2.md) **6장**(6.1~6.7). 이 계획은 그 문서를 구현
단위로 쪼갠 것이며, 수치·공식·근거의 **단일 진실 공급원은 design-v2.md다.** 4·5·7·8장과 동일한
문서 관리 방침을 따른다.

**브랜치:** `feat/responsive-design`

---

## Global Constraints

모든 Task에 적용된다. 이 절의 요구사항은 각 Task의 완료조건에 암묵적으로 포함된다.

### 프로젝트 규칙

- **커스텀 브레이크포인트 추가 금지.** Tailwind 기본값(`sm` 640 / `md` 768 / `lg` 1024)만 쓴다
  (design-v2.md §6, tailwind.config 파일 자체가 없음 — CSS-first 기본값 그대로).
- **모바일에서도 R3F를 유지한다.** 정적 이미지 폴백으로 대체하지 않는다(§6 서두, 이미 확정).
- **새 의존성 추가 금지.** 드로워·하단 시트는 Tailwind 클래스 + 기존 React state로 구현한다 —
  헤드리스 UI 라이브러리(Radix/Headless UI 등)를 새로 설치하지 않는다. `Scene3D`/`StageScene`가
  이미 쓰는 `@react-three/drei`, 그리고 React 자체 기능(`useState`, CSS transition)이면 충분하다.
- **DPR·파티클·카메라 여유값은 design-v2.md §6.1·§6.2의 실측값을 그대로 쓴다.** 이 환경엔 실제
  모바일 GPU가 없어 프레임레이트를 검증하지 못했다는 전제도 함께 유지한다 — "더 보수적으로
  낮추는" 식으로 임의 조정하지 않는다.
- **`Scene3D`의 기존 `notifyContextLoss`/`resize={{ scroll: false }}` 안전장치를 건드리지 않는다.**
  무대 연출 툴의 하단 시트(Task 6)는 오버레이로만 구현해 `StageStudio`의 씬 컨테이너 크기 자체가
  시트 개폐로 바뀌지 않게 한다(§6.6) — 크기 변화는 과거 `webglcontextlost`를 유발한 전례가 있다.
- 커밋 컨벤션: Conventional Commits(`feat:` `fix:` `refactor:` `docs:`), 소문자 명령형.

### 범위 밖 (선제 구현 금지)

design-v2.md §10을 그대로 따른다. 특히 이 계획에서 손이 갈 만한 것:

- `TourOrbit.tsx`에 Task 2와 같은 동적 카메라 계산을 적용하는 것 — §6.2는 `OrbitScene`만 다룬다.
  같은 문제가 있을 수 있지만 이번 실측·승인 범위 밖이다.
- 무대 연출 툴 하단 시트에 새 컨트롤(예: 접기/펼치기 애니메이션 프리셋)을 추가하는 것 — §6.6은
  기존 `StageControls` 내용을 그대로 시트에 옮기는 것까지다.
- B탭 사이드바 메뉴 구성 자체를 바꾸는 것(항목 추가/제거/재배열) — §6.4는 표시 방식(드로워)과
  로그아웃 버그만 다룬다.
- `/staff/artists` 편집 폼(`ArtistEditForm.tsx`)의 그리드 반응형 — §6의 알려진 가정 표에 없었고
  실측도 하지 않았다.

---

## 파일 구조 (최종 목표)

```
src/
├── lib/
│   ├── geometry.ts                      # 수정 — cameraDistanceForRadius() 추가 (Task 2)
│   └── geometry.test.ts                 # 신규 — TDD (Task 2)
├── components/
│   ├── three/
│   │   ├── Scene3D.tsx                  # 수정 — 기본 dpr={[1,2]} 추가 (Task 1)
│   │   ├── StageScene.tsx               # 수정 — dpr={[1,1.5]} 오버라이드 (Task 1)
│   │   ├── GalleryHaze.tsx              # 수정 — Sparkles count 220→150 (Task 1)
│   │   └── OrbitScene.tsx               # 수정 — 카메라 z 동적 계산 (Task 2)
│   ├── fans/
│   │   ├── AlbumSection.tsx             # 수정 — overflow-hidden 추가 (Task 3)
│   │   ├── GallerySection.tsx           # 수정 — grid-cols-3 → md 미만 1열 (Task 5)
│   │   └── TourSection.tsx              # 수정 — grid-cols-2 → md 미만 1열 (Task 5)
│   └── staff/
│       ├── Sidebar.tsx                  # 수정 — md 밑 드로워 전환 + sticky 버그 수정 (Task 4)
│       ├── StageStudio.tsx              # 수정 — md 밑 하단 시트 래퍼 + 토글 (Task 6)
│       └── StageControls.tsx            # 수정 — 시트 안에서 폭 반응형 (Task 6)
└── app/
    ├── artists/[slug]/page.tsx          # 수정 — 히어로 text-[10rem] → sm 미만 축소 (Task 5)
    └── staff/(console)/dashboard/page.tsx # 수정 — 지표/하단 grid → md 미만 1열 (Task 5)
```

---

## Task 순서와 의존관계

```
Task 1  Scene3D DPR 클램프 (+ StageScene·GalleryHaze)
Task 2  OrbitScene 카메라 동적 프레이밍 (TDD)
Task 3  AlbumSection 오버플로우 수정
Task 4  B탭 Sidebar 드로워 전환 + 로그아웃 sticky 버그
Task 5  B탭/A탭 그리드·히어로 텍스트 반응형
Task 6  무대 연출 툴 하단 시트
   ↓ (전부 완료 후)
Task 7  완료 기준 검증 · 문서 갱신
```

Task 1~6은 서로 다른 파일을 건드리고 새 인터페이스를 주고받지 않는다 — **전부 독립적이라 병렬로
진행 가능하다**(4·5·7장처럼 프론트/백엔드로 나눌 이유가 없는 대신, 화면 단위로 이미 나뉘어 있다).
Task 7만 전부가 끝난 뒤 진행한다.

---

### Task 1: Scene3D 공용 DPR 클램프 (+ StageScene·GalleryHaze)

**Files:**
- Modify: `src/components/three/Scene3D.tsx`
- Modify: `src/components/three/StageScene.tsx`
- Modify: `src/components/three/GalleryHaze.tsx`

**Interfaces:**
- `Scene3D`의 외부 시그니처는 변경 없음(`ComponentProps<typeof Canvas> & {...}`를 그대로 받는
  기존 구조) — 새 prop을 추가하지 않는다. 개별 씬은 기존과 동일하게 `dpr`을 넘겨서 오버라이드한다.

**왜**: design-v2.md §6.1. 다섯 R3F 씬이 전부 `Scene3D`의 `<Canvas>`를 통해서만 렌더링되므로 이
한 곳에 기본 DPR 상한을 넣으면 자동으로 전부에 적용된다.

**주의**:
1. `dpr={[1, 2]}`는 두 `<Canvas>` 호출(notifyContextLoss 켜짐/꺼짐 두 분기) 모두에
   `{...canvasProps}` **앞에** 둔다 — 뒤에 두면 spread가 항상 이겨서 오버라이드가 안 먹는다.
2. `StageScene.tsx`의 `<Scene3D>` 호출부에만 `dpr={[1, 1.5]}`를 명시적으로 추가한다 — 스팟라이트
   최대 3개(`castShadow` + 볼류메트릭) + `Cloud`/`fogExp2` + 그림자맵이 겹쳐서 나머지 4개 씬(전부
   `meshBasicMaterial` 기반 언릿이거나 단순 셰이더/파티클)보다 픽셀당 연산이 많다(§6.1 근거).
   **이 값(`1.5`)은 코드 구조 근거로만 정해졌고 아직 시각 검증되지 않았다** — 지금은
   `StageControls`가 `w-72` 고정이라 씬이 반토막나 있어 판단할 수 없다. Task 6(하단 시트)에서 씬이
   전체 화면이 된 뒤 다시 확인한다(Task 6 Step 7) — 이 Task에서는 값을 그대로 적용만 한다.
3. `GalleryHaze.tsx`의 `<Sparkles count={220} .../>`를 `count={150}`으로 바꾼다. 다른 prop
   (`scale`/`size`/`speed`/`opacity`/`color`)은 그대로 둔다.
4. 실측값을 임의로 더 낮추거나 올리지 않는다 — `[1, 1.25]`는 브레인스토밍에서 시각적으로 눈에 띄게
   휑해짐을 이미 확인했다(§6.1).

- [x] **Step 1: `Scene3D.tsx`의 두 `<Canvas>` 호출에 기본 `dpr={[1, 2]}` 추가** (spread 앞)
- [x] **Step 2: `StageScene.tsx`의 `<Scene3D shadows notifyContextLoss ...>` 호출에 `dpr={[1, 1.5]}`
      추가**
- [x] **Step 3: `GalleryHaze.tsx`의 `Sparkles count`를 220 → 150으로 변경**
- [x] **Step 4: `npm run build` 통과 확인**
- [x] **Step 5: 브라우저 검증** — `npm run build && npx next start -p 3001`(포트 3000은 손대지 않는다).
      `/artists/aurora` 갤러리 섹션과 `/staff/stage`를 열어 콘솔에 `webglcontextlost` 등 에러가
      없는지, 화면이 눈에 띄게 흐려지지 않았는지 확인
- [x] **Step 6: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건(Playwright/devtools 에뮬레이션 기준):**
- `npm run build` 통과
- 5개 씬(`OrbitScene`/`HeroBackground`/`TourOrbit`/`GalleryHaze`/`StageScene`) 전부 콘솔 에러 없이
  렌더된다
- `GalleryHaze` 파티클이 육안으로 눈에 띄게 휑해지지 않았다

**검증 노트**: `next build && next start -p 3001`(포트 3000 미사용)로 `/artists/aurora` 갤러리
섹션·`/staff/stage`를 확인 — 콘솔 에러 없음, 파티클 밀도 적절, StageScene도 데스크톱 기준 기존과
동일하게 렌더(모바일 레이아웃은 아직 `w-72` 고정이라 Task 6에서 재확인). 커밋: `04dec4a`.

---

### Task 2: OrbitScene 카메라 동적 프레이밍 (TDD)

**Files:**
- Modify: `src/lib/geometry.ts`
- Create: `src/lib/geometry.test.ts`
- Modify: `src/components/three/OrbitScene.tsx`

**Interfaces:**
- Produces: `cameraDistanceForRadius(targetRadius: number, fovDeg: number, aspect: number): number`
  (`src/lib/geometry.ts`에서 export) — `OrbitScene`이 소비하며, 순수 함수라 다른 3D 코드와 무관하게
  vitest(`node` 환경)로 테스트 가능하다. 여유 배율(margin)은 함수 파라미터가 아니라 호출부에서
  `targetRadius`에 미리 곱해서 넘긴다.

**왜**: design-v2.md §6.2. 궤도 반경(최대 3.2)과 카메라(`z=8`, `fov=50`)가 고정값이라 좁은 화면에서
바깥쪽 노드가 잘린다. 브레이크포인트 스텝 대신 컨테이너 비율에서 연속적으로 카메라 거리를 계산한다.

**주의**:
1. **공식은 design-v2.md §6.2 그대로다(이 문서에는 인라인하지 않는다)**: 수직 반높이
   `z * tan(fov/2)`, 수평 반너비는 그 값에 `aspect`를 곱한 것. 두 방향 모두 `targetRadius` 이상이
   되려면 `z >= targetRadius / (tan(fov/2) * min(1, aspect))`.
2. **`OrbitScene.tsx`는 `cameraDistanceForRadius(가장 바깥 궤도 반경(3.2) * 1.2, 50, aspect)`로
   호출한다** — `1.2`(여유 배율)는 호출부 상수(`CAMERA_MARGIN`)로 두고 궤도 반경에 미리 곱해서
   넘긴다. 함수 자체는 이미 배율이 반영된 `targetRadius`를 그대로 쓴다.
3. `aspect >= 1`(정사각형 이상 가로로 넓은 화면)일 때 결과가 기존 하드코딩 `z=8`과 거의 같아야
   한다(`3.2*1.2 / tan(25°) ≈ 8.24`) — 데스크톱에서 시각적으로 거의 달라지지 않는 게 이 공식이
   맞다는 근거이자 회귀 방지 기준이다.
4. `OrbitScene.tsx`에 `StageScene.tsx`의 `CameraRig`와 같은 패턴으로 새 자식 컴포넌트를 추가한다 —
   `useThree()`의 `size.width`/`size.height`가 바뀔 때마다(리사이즈) 재계산한다. **`camera.position.z
   = ...`처럼 직접 대입하지 않는다** — React Compiler가 훅이 반환한 값의 직접 mutation을 막는다.
   `StageScene`의 `CameraRig`처럼 `camera.position.set(0, 0, z)`를 쓴다(x/y는 항상 0).
5. `RING_RADII`/`fov=50`은 그대로 둔다 — 바뀌는 건 카메라 `position.z` 계산 방식뿐이다.

- [x] **Step 1: 실패하는 테스트 작성** (`src/lib/geometry.test.ts`) — 매직 넘버를 직접 비교하는
      대신 "계산된 z에서 실제로 수직·수평 반높이/반너비가 `targetRadius` 이상인지"를 함께 확인해
      공식 자체의 성질을 테스트한다(§주의 1의 부등식을 등호에 가깝게 만족하는지):
      - `aspect = 1`(정사각형)일 때, 기존 하드코딩 `8`과 근접(`targetRadius = 3.2*1.2`, `fov=50`일
        때 약 8.24, 오차 0.5 이내)
      - `aspect = 0.55`(375px 폭 폰 비율 근사)일 때, 계산된 `z`로 수평 반너비(`z * tan(fovRad/2) *
        aspect`)가 `targetRadius` 이상
      - `aspect = 1.78`(16:9 와이드 데스크톱)일 때 `aspect = 1`일 때와 정확히 같은 `z` (min(1,
        aspect) 클램프 확인 — 가로로 넓어져도 카메라가 더 당겨지지 않아야 함)
- [x] **Step 2: 테스트 실패 확인** — Run: `npm test`. Expected: FAIL (`cameraDistanceForRadius is not
      a function` 또는 모듈 미존재)
- [x] **Step 3: `geometry.ts`에 `cameraDistanceForRadius` 최소 구현** — 공식은 design-v2.md §6.2 그대로
- [x] **Step 4: 테스트 통과 확인** — Run: `npm test`. Expected: PASS
- [x] **Step 5: `OrbitScene.tsx`에 카메라 리그 컴포넌트 추가** — `useThree()`로 `camera`/`size`를 읽어
      `size.width / size.height`가 바뀔 때마다 `cameraDistanceForRadius(RING_RADII.at(-1)! *
      CAMERA_MARGIN, FOV_DEG, aspect)`로 계산한 `z`를 `camera.position.set(0, 0, z)`로 적용
      (`StageScene.tsx`의 `CameraRig` 패턴 재사용)
- [x] **Step 6: `npm run build` 통과 확인**
- [x] **Step 7: 브라우저 검증** — `npm run build && npx next start -p 3001`. 홈(`/`)을 375/390/428/768/
      1024px 뷰포트(devtools 모바일 에뮬레이션)로 각각 열어 6명 아티스트 노드가 전부(또는 회전
      애니메이션 중 결국 전부) 프레임 안에 들어오는지, 1024px 이상에서 기존과 시각적으로 거의
      동일한지 확인
- [x] **Step 8: 검증** — 아래 완료조건 확인

**완료조건:**
- `npm test`의 새 케이스 전부 통과, 기존 vitest 전체(다른 파일 포함) 회귀 없음(순수 함수 — 에뮬레이션과 무관)
- `npm run build` 통과
- (Playwright/devtools 에뮬레이션 기준) 375~1024px 전 구간에서 궤도 노드가 화면 밖으로 잘리지 않는다
- (Playwright/devtools 에뮬레이션 기준) 1024px 이상에서 기존(1차) 렌더링과 시각적으로 거의 동일하다(회귀 없음)

**검증 노트**: 계획에 없던 발견 두 건.

1. Step 1에서 테스트를 `targetRadius=3.84`(margin 적용값)로 작성했더니, `margin`을 함수 내부
   파라미터로 둔 최초 구현(`targetRadius * margin`)과 맞물려 margin이 이중 적용되는 버그가
   났다(효과 반경이 3.84가 아니라 4.608). `code-review`/`ponytail-review`를 거치며 아예 `margin`을
   함수 파라미터에서 없애기로 정리했다 — 실사용 호출자(`OrbitScene`)가 하나뿐이고 항상 같은
   배율만 쓰는데 파라미터로 노출할 이유가 없었고(yagni), 이렇게 하면 이중 적용 실수 자체가
   불가능해진다. 함수는 3개 인자(`targetRadius, fovDeg, aspect`)로 단순해졌고, `OrbitScene.tsx`가
   `RING_RADII.at(-1)! * CAMERA_MARGIN`을 직접 넘긴다. design-v2.md §6.2와 이 Task 전체를 최종
   시그니처 기준으로 다시 정리했다.
2. `camera.position.z = ...` 직접 대입이 React Compiler 린트 에러("Modifying a value returned from
   a hook is not allowed")로 걸렸다 — `StageScene.tsx`의 기존 `CameraRig`가 `camera.position.set(...)`
   메서드 호출을 쓰는 이유가 이것이었다. 같은 방식(`camera.position.set(0, 0, z)`)으로 교체했다.

`npm test`(32개 전부 통과), `npm run build`, `eslint` 전부 이 수정 반영 후 기준.

---

### Task 3: AlbumSection 커버플로우 오버플로우 수정

**Files:**
- Modify: `src/components/fans/AlbumSection.tsx`

**Interfaces:** 없음(내부 스타일 변경만, props/시그니처 변경 없음)

**왜**: design-v2.md §6.3. 카드가 `translateX(offset*72%)`로 좌우 이웃을 살짝 걸치는데, 감싸는
컨테이너에 `overflow-hidden`이 없어서 768px(md)에서 페이지 전체가 130px 가로 스크롤된다(실측).

**주의**:
1. 오프셋 계산(`translateX(offset*72%) rotateY(...)`)은 그대로 둔다 — 카드 폭 기준 상대값이라 이미
   반응형이다. 컨테이너에 `overflow-hidden`만 추가하면 된다.
2. 드래그(`onPointerDown`/`onPointerMove`)로 카드를 넘기는 상호작용 영역은 `overflow-hidden`을 걸어도
   그대로 동작해야 한다 — 클릭/드래그 대상은 카드 자체(`button`)이지 넘치는 시각 요소가 아니다.

- [x] **Step 1: 카드들을 감싸는 컨테이너(포인터 이벤트 핸들러가 달린 요소)에 `overflow-hidden`
      추가**
- [x] **Step 2: `npm run build` 통과 확인**
- [x] **Step 3: 브라우저 검증** — `npm run build && npx next start -p 3001`. `/artists/aurora`를
      768px(md) 뷰포트로 열어 `document.documentElement.scrollWidth === window.innerWidth`인지(가로
      스크롤 없음) 확인하고, 커버플로우 좌우 드래그로 트랙 전환이 여전히 되는지 확인
- [x] **Step 4: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- `npm run build` 통과
- (Playwright/devtools 에뮬레이션 기준) 커버플로우 자체가 원인이 되는 페이지 레벨 가로 스크롤은
  375~1024px 전 구간에서 없다(768px 기준으로 실측했던 130px 오버플로우 해소 확인) — **단, 375/428px
  에는 아티스트 페이지 히어로(`text-[10rem]`, Task 5 범위)가 원인인 별개의 130px대 오버플로우가
  남아 있다. 이건 이 Task가 다룬 커버플로우와 무관한 기존 문제라 그대로 둔다.**
- (Playwright/devtools 에뮬레이션 기준) 커버플로우 좌우 드래그/클릭 전환이 회귀 없이 동작한다 —
  **단, 마우스 드래그로만 확인 가능하다. 실제 손가락 터치 제스처(핀치·스와이프 관성 등)는 데스크톱
  Chrome 에뮬레이션으로 신뢰할 수 없는 항목이라 실기기 확인이 별도로 필요하다**(문서 맨 끝 실기기
  체크리스트 참고)

**검증 노트**: 계획에 없던 발견 두 건.

1. `overflow-hidden` 적용 후에도 375/428px에서 `document.documentElement.scrollWidth`가 여전히
   viewport보다 넓게 나왔다. 원인을 추적하니 커버플로우가 아니라 아티스트 페이지 히어로
   `<h1 className="... text-[10rem] ...">`("AURORA")였다 — 공백 없는 한 단어라 줄바꿈이 안 되고,
   160px 폰트에서 그대로 뷰포트 밖으로 삐져나간다(`docWidth`가 h1의 `getBoundingClientRect().right`
   값과 정확히 일치함을 확인). 이건 design-v2.md §6.5/Task 5가 다루기로 이미 정해진 항목이라 이
   Task에서는 안 건드리고 그대로 남겼다.
2. 브레인스토밍 단계에서 "a탭 아티스트 페이지는 375~428px에서 가로 스크롤 없음"으로 기록했던 실측이
   **부정확했다** — 당시 Playwright 컨텍스트에 `isMobile: true`를 켠 상태로 쟀는데, 콘텐츠가 넘칠 때
   모바일 에뮬레이션이 "레이아웃 뷰포트"를 콘텐츠에 맞춰 확대해버려서 `window.innerWidth`와
   `document.documentElement.scrollWidth`가 같은 값(687)으로 같이 부풀어 올라 "오버플로우 없음"처럼
   보였던 것 — 이번엔 `isMobile` 없이(데스크톱 컨텍스트, 뷰포트 폭만 좁힘) 재보니 실제로는 항상
   있었다. Task 5 진행 시 이 측정 방식(비-모바일 컨텍스트로 뷰포트 폭만 조정)을 쓸 것.

---

### Task 4: B탭 Sidebar 드로워 전환 + 로그아웃 sticky 버그 수정

**Files:**
- Modify: `src/components/staff/Sidebar.tsx`

**Interfaces:**
- `Sidebar`의 외부 시그니처는 변경 없음(`{ roleLabel: string }`) — 내부에 열림/닫힘
  `useState<boolean>`을 추가하는 것은 내부 구현이라 호출부(`(console)/layout.tsx`)는 무변경.

**왜**: design-v2.md §6.4. `w-56` 고정 사이드바가 375px 화면 폭의 60%를 차지해 남은 콘텐츠가
지표 카드 텍스트가 한 글자씩 줄바꿈될 만큼 좁아진다(실측: 문서 폭 432px vs 뷰포트 375px). 같은
컴포넌트에서 발견한 별개 버그(`<aside>`에 `sticky`/고정 높이가 없어 긴 페이지에서 `mt-auto` 로그아웃
버튼이 화면 밖으로 밀려남)도 같이 고친다.

**주의**:
1. **레이아웃 모드 분기는 Tailwind 클래스로만 한다** — `md` 이상에서 기존 `<aside className="flex
   w-56 ...">`를 그대로 보이게 하고(`hidden md:flex`), `md` 미만에서는 헤더에 햄버거 버튼을
   보이게 한다(`flex md:hidden`). `window.innerWidth`를 JS로 읽어 분기하지 않는다(Global
   Constraints — 새 의존성 없이 기존 Tailwind 반응형 클래스만 쓴다는 원칙과 일관).
2. 드로워는 `useState`로 열림/닫힘을 관리하고, 열렸을 때 `fixed inset-0`(배경 스크림) +
   `fixed inset-y-0 left-0`(패널, `MENU` 5개 항목 + 로그아웃 동일 재사용) 오버레이로 렌더한다.
   배경 스크림 클릭 또는 링크 클릭 시 닫는다.
3. **sticky 버그 수정은 `md` 이상 데스크톱 사이드바에도 적용한다** — `<aside>`에 `sticky top-0
   h-screen`을 추가한다. 데스크톱에서도 원래 있던 버그였다(대시보드는 콘텐츠가 짧아 우연히 안
   드러났을 뿐).
4. 로그아웃 핸들러(`handleLogout`)와 `usePathname` 기반 활성 링크 표시는 그대로 재사용 — 드로워
   안의 링크 목록도 같은 `MENU` 배열·같은 활성 스타일을 쓴다(별도 목록을 새로 만들지 않는다).

- [ ] **Step 1: 데스크톱 `<aside>`에 `hidden md:flex` + `sticky top-0 h-screen` 추가**(sticky 버그
      수정 포함)
- [ ] **Step 2: `md` 미만에서만 보이는 헤더 바(햄버거 버튼 + "STAGE.ONE") 추가**(`flex md:hidden`)
- [ ] **Step 3: 열림 상태 `useState` + 오버레이 드로워(배경 스크림 + 패널) 구현** — `MENU` 5개
      항목과 로그아웃 버튼을 데스크톱 `<aside>`와 동일한 내용으로 재사용
- [ ] **Step 4: 배경 스크림 클릭 · 링크 클릭 시 드로워 닫힘 구현**
- [ ] **Step 5: `npm run build` 통과 확인**
- [ ] **Step 6: 브라우저 검증** — `npm run build && npx next start -p 3001`, 데모 계정으로 로그인.
      375px에서 `/staff/dashboard`·`/staff/tours`·`/staff/artists`·`/staff/tickets` 4화면 모두
      햄버거로 드로워가 열리고 메뉴 이동이 되는지, 768px 이상에서는 기존 고정 사이드바가 그대로
      보이는지, **`/staff/tours`처럼 긴 페이지에서 로그아웃 버튼이 스크롤 없이 항상 보이는지**(md
      이상 포함) 확인
- [ ] **Step 7: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건(Playwright/devtools 에뮬레이션 기준):**
- `npm run build` 통과
- `md` 미만 4화면 전부에서 햄버거 → 드로워 → 메뉴 이동이 동작한다
- `md` 이상 어떤 페이지 길이에서도 로그아웃 버튼이 스크롤 없이 보인다(sticky 버그 수정 확인)
- 375px에서 어떤 B탭 사이드바 화면도 페이지 레벨 가로 스크롤이 없다

---

### Task 5: B탭/A탭 그리드·히어로 텍스트 반응형

**Files:**
- Modify: `src/components/fans/GallerySection.tsx`
- Modify: `src/components/fans/TourSection.tsx`
- Modify: `src/app/artists/[slug]/page.tsx`
- Modify: `src/app/staff/(console)/dashboard/page.tsx`

**Interfaces:** 없음(className만 변경, props/시그니처 변경 없음)

**왜**: design-v2.md §6.5. 알려진 데스크톱 전용 그리드/타이포가 좁은 화면에서 칸이 찌그러지거나
글자가 넘친다.

**주의**:
1. `grid-cols-3`(갤러리, 대시보드 지표 카드) → `md` 미만 `grid-cols-1`, `grid-cols-2`(투어 섹션,
   대시보드 하단) → `md` 미만 `grid-cols-1`. 전부 `md:grid-cols-3`/`md:grid-cols-2` 형태로 바꾸고
   기본(미접두)을 `grid-cols-1`로 둔다 — Tailwind 모바일 퍼스트 관례.
2. 아티스트 페이지 히어로(`text-[10rem]`)는 `sm` 미만에서 `text-6xl`로, `sm` 이상은 기존
   `text-[10rem]`을 유지한다(`text-6xl sm:text-[10rem]`).
3. 각 그리드의 `gap`/`padding` 값은 이번 스코프가 아니다 — 열 수만 바꾼다. 다만 1열로 붕괴했을 때
   카드 안 텍스트가 넘치거나 잘리면(예: 대시보드 지표 카드) 그 카드 내부 padding/폰트 크기는 최소
   조정 허용(§6.5 "정확한 축소값은 구현 중 실측하며 조정한다").

- [ ] **Step 1: `GallerySection.tsx`의 `grid-cols-3` → `grid-cols-1 md:grid-cols-3`**
- [ ] **Step 2: `TourSection.tsx`의 `grid-cols-2` → `grid-cols-1 md:grid-cols-2`**
- [ ] **Step 3: `staff/(console)/dashboard/page.tsx`의 지표 카드 `grid-cols-3`, 하단
      `grid-cols-2` 각각 `md` 미만 `grid-cols-1`로 변경**
- [ ] **Step 4: `artists/[slug]/page.tsx` 히어로 `text-[10rem]` → `text-6xl sm:text-[10rem]`**
- [ ] **Step 5: `npm run build` 통과 확인**
- [ ] **Step 6: 브라우저 검증** — `npm run build && npx next start -p 3001`. 375/428/768/1024px
      각각에서 `/artists/aurora`(갤러리·히어로), `/staff/dashboard`(지표 카드·하단 그리드),
      `/staff/tours` 등 `TourSection`을 쓰는 화면을 열어 `md` 미만 1열, `md` 이상 기존 그리드로
      보이는지, 카드 안 텍스트가 잘리거나 한 글자씩 줄바꿈되지 않는지 확인
- [ ] **Step 7: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건(Playwright/devtools 에뮬레이션 기준):**
- `npm run build` 통과
- 4개 화면 전부 `md` 미만에서 1열, `md` 이상에서 기존과 동일한 그리드로 보인다
- 375px에서 지표 카드 텍스트가 한 글자씩 세로로 줄바꿈되지 않는다(§6.4에서 실측한 원래 증상의
  일부가 여기서도 해소되는지 재확인 — 사이드바 자체는 Task 4가 고친다)

---

### Task 6: 무대 연출 툴 — 하단 시트 전환

**Files:**
- Modify: `src/components/staff/StageStudio.tsx`
- Modify: `src/components/staff/StageControls.tsx`

**Interfaces:**
- `StageStudio`/`StageControls`의 외부 시그니처는 변경 없음(`{ artists, slug, defaultColor }`,
  `{ artists, artistSlug, state, onChange }`) — 내부에 열림/닫힘 상태만 추가된다.

**왜**: design-v2.md §6.6. `StageControls`가 `w-72` 고정 사이드 패널이라 375px에서 3D 씬이
반토막나고 패널 오른쪽이 화면 밖으로 잘린다(실측 스크린샷).

**주의**:
1. **`md` 이상에서는 지금과 완전히 동일하게 동작해야 한다** — `StageStudio`의 기존
   `flex flex-1 overflow-hidden` + `<StageScene>`(`flex-1`) + `<StageControls>`(`w-72`) 레이아웃을
   `md` 이상에서 그대로 유지한다(`hidden md:flex` 류로 감싸지 않고, 컨테이너 자체는 그대로 두고
   `StageControls` 쪽 폭 처리만 반응형으로 바꾼다).
2. **`md` 미만에서는 3D 씬이 항상 전체 화면이다.** `StageControls`를 `md` 미만에서 `fixed inset-x-0
   bottom-0`(하단 시트)로 오버레이하고, 열림/닫힘은 `StageStudio`의 `useState`로 관리한다. 닫혀
   있을 때는 토글 버튼(예: "조정하기")만 하단에 떠 있는다.
3. **시트가 열리고 닫혀도 `StageScene`을 감싸는 컨테이너의 크기(`className`/레이아웃)는 바뀌지
   않는다** — Global Constraints의 `webglcontextlost` 회피 원칙(§6.6). 시트는 씬 위에 얹히는
   오버레이이지, 씬 영역을 줄이는 사이드바가 아니다.
4. `StageControls.tsx`의 루트 `<aside className="flex w-72 ...">`를 `md` 이상에서는 지금과 동일한
   `w-72` 고정 폭으로, `md` 미만(시트 안에서 렌더될 때)에는 전체 폭(`w-full`)으로 만든다 — 조건부
   className으로 처리하고, 내부 5개 section(프리셋/스팟 3개/카메라/스모그/프리셋)의 마크업은
   그대로 재사용한다(새 컴포넌트를 만들지 않는다).
5. `useThrottledChange`(100ms 스로틀)는 이미 씬 반영 빈도를 조절하고 있다 — 시트 개폐 자체가 씬
   props를 바꾸지 않으므로 이 안전장치를 수정할 필요는 없다.

- [ ] **Step 1: `StageStudio.tsx`에 시트 열림/닫힘 `useState<boolean>` 추가**
- [ ] **Step 2: `md` 미만에서 `StageControls`를 감싸는 하단 시트 오버레이 컨테이너 추가**(`fixed
      inset-x-0 bottom-0 md:static`, 닫힘 상태는 `translate-y-full` 류로 화면 밖에 두거나 렌더 안 함)
      **+ 닫힘 상태에서 보이는 토글 버튼**(`md:hidden`)
- [ ] **Step 3: `md` 이상에서는 기존과 동일한 정적 레이아웃 유지 확인**(별도 조건부 컨테이너로
      감싸지 않고 시트 래퍼 자체가 `md:static md:flex`로 기존 흐름에 자연스럽게 합류하게 구성)
- [ ] **Step 4: `StageControls.tsx` 루트 `<aside>`의 폭을 `w-full md:w-72`로 변경**
- [ ] **Step 5: `npm run build` 통과 확인**
- [ ] **Step 6: 브라우저 검증** — `npm run build && npx next start -p 3001`, 데모 계정으로 로그인.
      375px에서 `/staff/stage`를 열어 3D 씬이 전체 화면으로 보이는지, 토글 버튼으로 시트가 열리고
      슬라이더 조작이 되는지, 시트를 열고 닫는 동안 브라우저 콘솔에 `webglcontextlost`가 안
      뜨는지(Network/Console 탭) 확인. 768px 이상에서는 기존과 동일하게 사이드 패널로 보이는지 확인
- [ ] **Step 7: StageScene DPR 1.5 재확인**(design-v2.md §6.1) — 이번 Task 전까지는 `StageControls`가
      `w-72` 고정이라 3D 씬이 반토막나 있어 DPR 값을 시각적으로 판단할 수 없었다. 이제 375px에서도
      씬이 전체 화면으로 보이니, `dpr={[1, 1.5]}`(현재값)와 `dpr={[1, 2]}`(공용 기본값)를 번갈아
      넣어 `/staff/stage`를 스크린샷 비교한다 — 스팟라이트 빛줄기·그림자 경계·Cloud 질감이 `1.5`에서
      눈에 띄게 뭉개지면 `1.75` 등으로 올리고, 차이가 안 보이면 `1.5`를 그대로 유지한다. 결정과
      근거를 design-v2.md §6.1에 한 문장으로 갱신한다("코드 구조 근거로만" 문구를 실측 결과로 교체)
- [ ] **Step 8: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- `npm run build` 통과
- (Playwright/devtools 에뮬레이션 기준) `md` 미만에서 3D 씬이 전체 화면이고, 토글로 컨트롤 시트를
  열고 닫을 수 있다
- (Playwright/devtools 에뮬레이션 기준) 시트 개폐 중 `webglcontextlost`가 발생하지 않는다(콘솔
  확인) — **단, `webglcontextlost`는 실제 모바일 GPU의 메모리·컨텍스트 압박 상황에서 주로
  재현되는 문제라 데스크톱 Chrome 에뮬레이션에서 안 뜬다고 실기기에서도 안전하다고 볼 수 없다.
  실기기 확인이 별도로 필요하다**(문서 맨 끝 실기기 체크리스트 참고)
- (Playwright/devtools 에뮬레이션 기준) `md` 이상에서 기존과 시각적으로 동일하게 사이드 패널로
  보인다(회귀 없음)
- (Playwright/devtools 에뮬레이션 기준) StageScene DPR 1.5가 전체 화면 상태에서 시각 비교되었고,
  design-v2.md §6.1에 그 결과가 반영됐다 — 프레임레이트 자체는 이 기준으로도 검증 불가(§6.1 기존
  전제 유지)

---

### Task 7: 완료 기준 검증 · 문서 갱신

**Files:**
- Modify: `docs/design-v2.md` (§11 6장 체크박스)
- Modify: `README.md` (2차 로드맵 체크박스, 국영문 병기)

**Interfaces:** 없음

**왜**: §11 6장 완료 기준 6개 항목을 모아서 최종 확인하고, §9.2 문서화 방침을 README에 반영한다.

- [ ] **Step 1: 375/390/428/768/1024px 각각에서 A탭 홈 궤도 씬이 6명 아티스트를 프레임 안에
      담는지 재확인**(Task 2 완료조건의 최종 재검증)
- [ ] **Step 2: 아티스트 페이지가 어느 폭에서도 페이지 레벨 가로 스크롤이 없는지 재확인**
- [ ] **Step 3: `md` 미만에서 B탭 4화면 전부 드로워로 전환되고, 로그아웃 버튼이 항상 보이는지
      재확인**
- [ ] **Step 4: `md` 미만에서 무대 연출 툴이 하단 시트로 전환되고, 개폐 중 `webglcontextlost`가
      없는지 재확인**
- [ ] **Step 5: B탭 그리드 4개 화면이 `md` 미만에서 1열로 붕괴하는지 재확인**
- [ ] **Step 6: `npm run build`·`npm test` 최종 통과 확인**
- [ ] **Step 7: `docs/design-v2.md` §11 6장 체크박스 6개 `[x]`로 갱신** — DPR 항목은 "실기기 확인
      필요"로 남겨둔 전제를 그대로 유지한 채, 이 환경에서 확인 가능한 나머지 5개만 체크하고 DPR
      항목은 배포 후 실기기 확인 전까지 미체크로 남긴다(허위로 체크하지 않는다)
- [ ] **Step 8: `README.md` 갱신**(국문·영문 병기, 2차 로드맵 항목 — 6장을 마지막으로 2차 로드맵
      전체 완료)
- [ ] **Step 9: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- §11 6장 체크박스 6개 중 실기기 검증이 필요 없는 5개는 확인 완료, DPR 프레임레이트 1개는
  의도적으로 미체크 상태로 남는다(사유가 문서에 명시됨)
- README 국문·영문 모두 갱신되고 서로 내용이 어긋나지 않는다
- `npm run build`·`npm test` 통과

---

## 배포 후 실기기 확인 체크리스트

Task 1~7은 전부 Playwright/devtools 에뮬레이션(데스크톱 Chrome) 기준이다. 아래 3가지는 에뮬레이션
으로 신뢰할 수 없다고 이미 각 Task에서 표시한 항목들만 모은 것이다 — **에이전트가 실행하는 Task가
아니라, Task 7까지 머지·배포된 뒤 사람이 실제 모바일 기기로 직접 확인하는 스텝이다.**

- [ ] **DPR·프레임레이트**(design-v2.md §6.1, Task 1·6) — 배포된 사이트(`on-stage-nine.vercel.app`
      등 최신 배포 반영 후)를 iOS Safari, Android Chrome 최소 2종으로 열어 `/`(OrbitScene 회전),
      `/artists/aurora`(갤러리 섹션 스크롤, GalleryHaze 파티클), `/staff/stage`(스팟라이트 3개 +
      스모그를 켠 상태로 카메라 드래그)에서 눈에 띄는 끊김(jank)이 없는지 확인. 끊기면 `Scene3D`
      기본 `dpr={[1,2]}`나 `StageScene`의 `dpr={[1,1.5]}`를 더 낮추는 후속 조정이 필요하다
- [ ] **AlbumSection 커버플로우 드래그**(design-v2.md §6.3, Task 3) — `/artists/aurora` 디스코그래피
      섹션을 실제 손가락으로 좌우 스와이프해 카드가 자연스럽게 넘어가는지 확인. 데스크톱 마우스
      드래그 에뮬레이션과 실제 터치 제스처(관성 스크롤, 멀티터치 간섭 등)는 다를 수 있다
- [ ] **무대 연출 툴 하단 시트 개폐**(design-v2.md §6.6, Task 6) — `/staff/stage`에서 시트를 여러
      번 열고 닫으면서(특히 빠르게 연속으로) 3D 씬이 멈추거나(`webglcontextlost`) 까맣게 변하지
      않는지 확인. `webglcontextlost`는 실제 모바일 GPU의 메모리 압박 상황에서 주로 재현되는
      문제라 에뮬레이션만으로는 안전을 보장할 수 없다

이 체크리스트 결과에 따라 `docs/design-v2.md` §11 6장의 DPR 체크박스(Task 7 Step 7에서 의도적으로
미체크 상태로 남겨둔 항목)를 마저 체크하거나, 문제가 발견되면 별도 수정 Task로 분리한다.

---

## 계획 검증 노트 (Self-Review)

**스펙 커버리지** — §6.1(DPR 클램프) → Task 1. §6.2(OrbitScene 카메라) → Task 2. §6.3(커버플로우
오버플로우) → Task 3. §6.4(사이드바 드로워 + 로그아웃 버그) → Task 4. §6.5(그리드·히어로) → Task 5.
§6.6(무대 시트) → Task 6. §6.7(변경 파일)의 8개 파일 전부 Task 1~6 중 하나에 정확히 대응한다(파일
구조 트리 참고). §11 6장 완료 기준 6개 항목 → Task 7에서 모아 재검증.

**타입 일관성** — `cameraDistanceForRadius`(Task 2가 정의)의 시그니처
`(targetRadius, fovDeg, aspect)`가 Task 2 내부의 `OrbitScene.tsx` 호출부와 테스트 파일 양쪽에서
동일한 인자 순서·이름으로 쓰인다. 다른 Task는 새 함수/타입을 내보내지 않는다(전부 내부
스타일·상태 변경).

**Task 4/5가 둘 다 B탭 대시보드를 건드리는 것에 대해** — Task 4는 `Sidebar.tsx`만, Task 5는
`dashboard/page.tsx`의 그리드만 건드려 파일이 겹치지 않는다. 두 Task를 병렬로 진행해도 머지
충돌이 없다.

**design-v2.md에 없던 결정 하나** — §6.4는 "햄버거 + 오버레이 드로워"까지만 정하고 드로워의 열림
애니메이션(슬라이드 방향·트랜지션 시간)은 정하지 않았다. 이 계획은 구현 세부(예: `translate-x`
트랜지션)를 Task 4 실행 시점의 판단에 맡긴다 — 시각적 세부는 design-v2.md의 스코프가 아니었고,
과설계를 피하기 위해 실행 중 가장 단순한 CSS transition으로 처리한다.
