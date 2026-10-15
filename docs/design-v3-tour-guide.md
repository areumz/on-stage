# v3 투어 가이드 에이전트 연동 설계 (2a · 2b)

## 0. 먼저 읽을 것 — 코드를 보고 알게 된 사실 3가지

1. **궤도 화면은 이미 R3F(WebGL)다.** 다만 "평면"이다. `src/components/three/OrbitScene.tsx`는 `circleGeometry`(납작한 원판)와 `meshBasicMaterial`(조명 없는 단색)을 z=0 평면에 놓고 카메라가 정면에서 본다. 그래서 인수인계 문서의 "기존 2D"는 *DOM/CSS로 그린 2D*가 아니라 **지금의 평면 R3F 씬**이다. 2a는 "WebGL로 갈아타기"가 아니라 "평면 R3F를 입체 R3F로 바꾸기"다.
2. **"2D 폴백"으로 쓸 코드가 이미 있다.** `OrbitScene.tsx`를 지우지 않고 그대로 두면 그것이 폴백이다. 새 파일만 추가한다.
3. **아티스트 페이지는 4개 섹션**이다: Hero → `#tour`(TourSection) → `#album`(AlbumSection) → `#gallery`(GallerySection). Hero만 `id`가 없다. 섹션 구분의 기반이 이미 있다.

## 1. 확인이 필요한 질문 - 일괄 확인 완료

## 2. 2a — 궤도 3D 교체

### 2.1 무엇이 어떻게 바뀌나 (결정 D1~D2)

|           | 현재 (평면)                                | 2a 이후 (입체)                                                                                     |
| --------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 노드      | 납작한 원판, 단색                          | 구체(sphere) + 약한 조명, 발광색은 아티스트 `color`                                                |
| 궤도      | z=0 평면의 원 3개                          | 같은 원 3개를 **한 묶음으로 기울임**(약 50°). 멀리 있는 노드는 작게, 가까운 노드는 크게 보임       |
| 카메라    | 정면, 위 3개 궤도가 다 보이게 거리만 계산  | 같은 거리 계산 재사용 + 기울기 보정                                                                |
| 라벨      | drei `Text`(3D 안의 글자)                  | drei `<Html>` 오버레이(design.md §2 #1) — 글자가 선명하고, 키보드 포커스·`aria-label`을 줄 수 있다 |
| 조작      | hover 확대, 클릭 시 `/artists/[slug]` 이동 | **그대로 유지**                                                                                    |
| 중앙 문구 | page.tsx의 DOM 오버레이                    | 그대로 (기울여도 묶음의 중심이 화면 중심이라 위치가 맞는다)                                        |

**D1 입체감의 정도 — 추천: "기울인 궤도 + 구체 + 조명".** 선택지: (a) 평면 유지 + 구체만(변화가 약함), (b) 드래그로 자유 회전(`OrbitControls`; 자동 회전·focus와 충돌하고 모바일에서 스크롤과 겹쳐 비추천). 데모 임팩트와 위험의 균형이 (추천안)이다.

**D2 파일 구성 — 추천: 새 `OrbitScene3D.tsx`를 추가하고 `OrbitScene.tsx`는 이름 그대로 2D 폴백으로 둔다.** 선택지: 한 파일 안에 분기(파일이 커지고 폴백이 오염됨). `RING_RADII`, 카메라 리그, `ringPoints`, `cameraDistanceForRadius`는 이미 공용이거나 쉽게 공용화된다.

### 2.2 폴백 플래그 (D3)

- **추천:** 우선순위 `?orbit=2d` > 서버 환경변수 `ORBIT_VIEW=2d` > 기본 3D. `app/page.tsx`가 서버 컴포넌트라 `searchParams`와 서버 env를 그대로 읽고 어느 쪽을 그릴지 정해 내려준다. `NEXT_PUBLIC_`을 쓰지 않아 브라우저에 노출되지 않고, 빌드 시점에 굳지도 않는다.
- 이름을 `view`로 하지 않는 이유: 에이전트 계약의 `context.view`(`orbit | tour`)와 헷갈린다. 그래서 **`orbit`**.
- 선택지: 클라이언트 `useSearchParams`(Suspense 필요, 깜빡임), 환경변수만(데모 중 즉시 전환 불가).
- WebGL 자체가 안 되는 브라우저는 지금처럼 `Scene3D`의 안내 문구가 나온다. 2D 폴백도 WebGL이라 이 경우는 해결 못 한다 — **범위 밖**으로 둔다(DOM 전용 폴백은 하지 않음).

### 2.3 모바일 성능 (D4)

추천(전부 값싼 것만):

- `dpr` 상한을 `[1, 1.5]`로 낮춘다(`Scene3D`가 `canvasProps`로 덮어쓰기를 이미 허용).
- 구체 분할 24×24, 그림자·후처리(postprocessing) 없음, 조명은 앰비언트 1 + 중심 점광원 1.
- 캔버스는 `/`에 1개(현 상태 유지). 별 먼지 같은 장식 파티클은 **넣지 않는다**.
- 자동 회전은 `useFrame`에서 ref만 갱신하고 React state는 건드리지 않는다(design.md §9, v2.2 Canvas 재구성 문제 회피).
- 느린 기기용 자동 품질 조절(`PerformanceMonitor`)은 **넣지 않는다.** 필요하면 `?orbit=2d`가 비상 탈출구다.

선택지: 모바일에서만 노드 수·분할을 줄이는 분기. 노드가 6개뿐이라 이득이 작아 비추천.

### 2.4 카메라 포커스 — `focusArtist`의 렌더러 쪽 (D5)

에이전트 없이도 확인할 수 있도록 **카메라 이동 기능 자체는 2a에 넣는다.** 에이전트가 붙는 2b에서는 이 기능을 호출만 한다.

- **방식(추천):** 카메라를 옮기는 대신 _궤도 묶음을 돌려_ 해당 노드가 정면 앞쪽에 오게 하고, 카메라를 살짝 당긴다. 이유: 노드가 계속 회전 중이라 "카메라가 움직이는 점을 따라가기"보다 "묶음을 목표 각도로 감속 회전"이 단순하고, 기존 카메라 프레이밍 코드를 건드리지 않는다.
- 부드럽게 움직이는 값은 ref + `useFrame` 안에서 `MathUtils.damp`로 갱신한다. 강조(확대)도 ref로 읽어 `useFrame`에서 적용하므로 **React state를 전혀 쓰지 않는다**(리렌더·Canvas 재구성 위험 0).
- 도착 후 자동 회전은 멈추고, 약 8초 뒤 다시 돈다. 같은 아티스트를 다시 focus해도 다시 움직이도록 요청에 번호(nonce)를 붙인다.
- 목표 각도 계산은 **순수 함수**(`geometry.ts`)로 만들어 vitest로 검증한다 — 현재 각도에서 가장 짧은 방향으로 돌게 하는 것이 핵심.
- 요청 전달 경로: 모듈 수준의 작은 저장소 `src/lib/guide/orbitFocus.ts`(요청 `{slug, nonce}` 보관). `useSyncExternalStore` 패턴은 `src/lib/hooks.ts`의 `stageListeners`와 같다. 에이전트 액션도, 개발 확인용 `?focus=<slug>`도 같은 경로를 쓴다.
- 2D 폴백도 같은 저장소를 구독해 같은 방식(묶음 회전)으로 반응한다 — 인수인계 문서의 "3D가 지연되면 2D 회전으로 2b 먼저"를 지키기 위해서다.
- 아티스트 페이지에서 `focusArtist`를 받으면: 저장소에 요청을 남기고 `/`로 이동한다. 궤도 화면이 열릴 때 대기 중인 요청을 소비한다.

선택지: 진짜 카메라 이동(노드 추적 필요), 하이라이트만(회전 없음).

### 2.5 건드리는 파일 (2a)

| 파일                                    | 변경                                         |
| --------------------------------------- | -------------------------------------------- |
| `src/components/three/OrbitScene3D.tsx` | 신규                                         |
| `src/components/three/OrbitScene.tsx`   | 이름 유지. focus 저장소 구독만 추가(2D 폴백) |
| `src/lib/geometry.ts` (+테스트)         | 기울기 보정 거리, 목표 회전각 순수 함수 추가 |
| `src/lib/guide/orbitFocus.ts`           | 신규, focus 요청 저장소                      |
| `src/app/page.tsx`                      | 플래그 분기, `?focus=` 읽기                  |
| `.env.example`                          | `ORBIT_VIEW` 설명 추가                       |

`TourOrbit.tsx`, `Scene3D.tsx`, 아티스트 페이지는 **건드리지 않는다**(Q1 추천 기준).

---

## 3. 2a 끝 체크포인트 — 눈으로 확인할 목록

**여기서 멈춘다. 아래를 직접 확인하고 승인하기 전에는 2b를 시작하지 않는다.**
확인 방법: `npm run dev` → 브라우저 `http://localhost:3000`. 모바일은 DevTools 기기 에뮬레이션(375·390·768px)과 가능하면 실제 폰 1대.

| #   | 확인 항목                           | 통과 기준                                                                                                      | 어떻게 보나                    |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | 3D 궤도가 보인다                    | 구체 노드 6개, 기울어진 궤도 3개, 라벨 6개가 보이고 서로 겹쳐 읽기 어렵지 않다                                 | `/` 첫 화면                    |
| 2   | 입체감이 읽힌다                     | 앞쪽 노드가 뒤쪽보다 크게 보이고, 회전하면 크기가 오르내린다                                                   | 10초 관찰                      |
| 3   | hover·클릭이 기존과 같다            | 노드에 마우스를 올리면 커지고 커서가 손가락, 클릭하면 `/artists/<slug>`로 이동. 라벨 클릭도 이동               | 6명 모두                       |
| 4   | 키보드로 들어갈 수 있다             | Tab으로 라벨에 포커스, Enter로 이동                                                                            | 키보드만 사용                  |
| 5   | 모바일에서 레이아웃·조작이 유지된다 | 375px에서 노드가 화면 밖으로 안 잘리고, 탭하면 진입, 중앙 문구·NOW 티커·상단 헤더가 그대로                     | 에뮬레이션 + 실기기            |
| 6   | 2D 폴백으로 복귀된다                | `/?orbit=2d`가 현재와 같은 평면 화면. 환경변수 `ORBIT_VIEW=2d`로도 같다                                        | 주소 변경 / env 변경 후 재시작 |
| 7   | 카메라 포커스가 동작한다            | `/?focus=nova`로 열면 NOVA가 정면으로 돌아온다. 다른 값(`/?focus=unknown`)은 아무 일도 없다. 2D에서도 회전한다 | 주소창                         |
| 8   | 프레임이 끊기지 않는다              | DevTools → Performance monitor에서 FPS가 데스크톱 55 이상, 모바일 에뮬레이션(CPU 4× 느리게) 30 이상 유지       | 30초 관찰                      |
| 9   | `webglcontextlost` 0건              | 아래 스니펫을 콘솔에 붙인 뒤 `/`↔`/artists/aurora`를 10회 오가고 창 크기를 바꿔도 0                            | 아래 스니펫                    |
| 10  | 다른 화면이 그대로다                | `/artists/aurora`의 Hero·투어 궤도·앨범·갤러리가 이전과 같다                                                   | 스크롤하며 확인                |
| 11  | 빌드·테스트                         | `npm run lint`, `npm test`, `npm run build` 통과                                                               | 터미널                         |

콘솔 스니펫(항목 9) — 페이지에 붙여 넣고 이동 없이 조작한다:

```js
window.__lost = 0;
new MutationObserver(() =>
  document.querySelectorAll('canvas').forEach(c => {
    if (c.__w) return;
    c.__w = 1;
    c.addEventListener('webglcontextlost', () =>
      console.warn('LOST', ++window.__lost)
    );
  })
).observe(document.body, { childList: true, subtree: true });
```

(Next 클라이언트 이동은 페이지를 새로 로드하지 않으므로 이동 중에도 계속 감시된다. 새로고침하면 다시 붙인다.)

---

## 4. 아티스트 페이지 섹션 (D6~D8)

### 4.1 섹션 목록과 값

현재 구조(코드 근거: `app/artists/[slug]/page.tsx`, `components/fans/*`):

| 값        | 화면                             | 요소                   | 현재 id         | 이름 표기                |
| --------- | -------------------------------- | ---------------------- | --------------- | ------------------------ |
| `hero`    | 거대 타이포 + 셰이더 배경 + 통계 | `<section>` (page.tsx) | **없음 → 추가** | SECTION 01               |
| `tour`    | 투어 도시 궤도 + 도시 카드       | `TourSection`          | `tour`          | SECTION 02 · TOUR        |
| `album`   | 디스코그래피                     | `AlbumSection`         | `album`         | SECTION 03 · DISCOGRAPHY |
| `gallery` | 갤러리                           | `GallerySection`       | `gallery`       | SECTION 04 · GALLERY     |

**D6 값 — 추천: `hero | tour | album | gallery`.** DOM id와 같아서 변환표가 필요 없고, 이미 있는 `#tour`/`#album` 앵커 링크와도 맞는다. 선택지: `intro`/`discography`처럼 의미 이름(표를 따로 관리해야 함).

### 4.2 섹션 감지 (D7)

- **추천: `IntersectionObserver`.** 각 섹션에 대해 "화면 가운데 가로선을 지나고 있는 섹션"을 현재 섹션으로 본다(`rootMargin: "-50% 0px -50% 0px"`). 스크롤 이벤트를 매번 계산하지 않아 가볍다.
- 선택지: 스크롤 위치 직접 계산(기존 `useSectionScroll` 방식, 스크롤마다 레이아웃 계산).
- 구현 형태: 아티스트 페이지에 `ArtistSectionTracker`(클라이언트, UI 없음)를 하나 둔다. 현재 섹션을 모듈 변수에 쓰고, 페이지를 떠나면(unmount) 비운다.
- 값은 **요청을 보내는 순간 읽는다**(state로 들고 다니지 않음). 그래서 스크롤할 때마다 React 렌더가 일어나지 않는다.
- `view`·`slug`는 **URL에서 만든다**(`usePathname()`): `/` → `orbit`, `/artists/<slug>` → `tour` + slug, 그 외(staff 등) → 패널 없음. 한 곳(URL)만 진실로 삼아 어긋남을 막는다.

### 4.3 `openTour` 동작과 `section` 값 후보 (D8)

| 값                           | 의미                             | 에이전트가 보내나                       |
| ---------------------------- | -------------------------------- | --------------------------------------- |
| (생략) 또는 `tour`           | 해당 아티스트 페이지의 투어 섹션 | **지금은 이것만**                       |
| `album` · `gallery` · `hero` | 해당 섹션으로 이동               | 지금은 안 보냄. 값만 계약에 정의(§8 C2) |

처리 규칙:

| 현재 위치            | 처리                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| `/` (궤도)           | ① 해당 노드로 focus(약 0.7초) → ② `router.push("/artists/<slug>#tour")` |
| 같은 아티스트 페이지 | 해당 섹션으로 부드럽게 스크롤                                           |
| 다른 아티스트 페이지 | `router.push("/artists/<slug>#tour")`                                   |
| 알 수 없는 `section` | `tour`로 처리(액션 이름이 openTour이므로)                               |

**D9 연출 — 추천: 자동 이동(위 ①②를 답변 끝에 자동 실행).** 패널은 레이아웃에 있어 이동 후에도 답변이 남는다. 선택지: (b) 칩("AURORA 투어 보기 →")을 눌러야 이동 — 가장 안전하지만 한 번 더 눌러야 해서 "투어 보여줘" 요청에는 느슨하다, (c) 궤도에서는 칩, 같은 페이지 스크롤은 자동. 의도치 않은 이동이 거슬리면 (b)나 (c)로 바꾸기 쉽도록 `runOpenTour` 한 함수로 격리한다.

중복 방어(서버는 `view`+`slug` 같을 때만 거른다): 같은 `{type, slug}`가 3초 안에 다시 오면 무시한다.

---

## 5. 2b — 채팅 패널, SSE, 액션

### 5.1 위치와 껍데기 (D10)

- **추천: 라우트 그룹 `src/app/(fans)/`를 만들고 `page.tsx`와 `artists/[slug]/page.tsx`를 그 안으로 옮긴다.** `(fans)/layout.tsx`에 패널과 상태 제공자(Provider)를 둔다. 괄호 폴더는 주소(URL)에 나타나지 않는다. 이유: ① `/` ↔ `/artists/…` 이동에서 레이아웃이 유지되어 **대화와 패널 열림 상태가 안 사라진다**, ② `/staff`(B탭)에는 패널 코드가 아예 안 실린다.
- 선택지: 루트 `layout.tsx`에 두고 `TabToggle`처럼 `usePathname()`으로 staff를 숨김(파일 이동은 없지만 staff 번들에도 실리고, 숨김 로직이 생김).
- 이동은 파일 이동뿐이다(`@/` 별칭 import라 내용 수정 없음).

### 5.2 패널 모양

| 요소 | 데스크톱                                                                     | 모바일(<768px)                              |
| ---- | ---------------------------------------------------------------------------- | ------------------------------------------- |
| 닫힘 | 오른쪽 아래 둥근 버튼(NOW 티커 위, `bottom-20`)                              | 같음                                        |
| 열림 | 오른쪽 아래 약 380px 반투명 패널(배경 blur)                                  | 하단 시트(높이 ≈ 70dvh), 위쪽 모서리 둥글게 |
| 머리 | 제목, KO\|EN 토글, 닫기                                                      | 같음                                        |
| 본문 | 말풍선 목록(`aria-live="polite"`), `tool_status` 한 줄                       | 같음                                        |
| 입력 | 한 줄 입력(`maxLength=200`, 에이전트 L0와 맞춤), 보내기 / 답변 중엔 "멈추기" | 같음                                        |

- z-index: 갤러리 라이트박스보다 **아래**(라이트박스가 위를 덮는다).
- 첫 열기 때 `GET {API}/health`를 한 번 호출해 콜드 스타트를 깨운다.
- **2b에 넣지 않는 것:** 추천 칩, `busy`·세션 턴 상한, `highlightCity`(전부 에이전트 4단계). 오류 코드 사전에는 `busy`도 미리 넣는다(문구 한 줄).

### 5.3 상태 관리 (D11)

- **추천: React Context + `useReducer`, 새 라이브러리 없음.** 이 저장소에는 상태 라이브러리가 없고, 상태는 `messages[]`, `status(idle|streaming|error)`, `open`, `locale` 정도뿐이다.
- 선택지: zustand 등(의존성 추가, 이 규모엔 과함).
- 저장 규칙: 대화는 **메모리에만** 둔다(에이전트의 "대화 미저장" 원칙). `sessionId`만 `sessionStorage`에 둔다(접근 오류를 try/catch로 감싸고, 실패하면 메모리 UUID).
- `requestId`는 요청마다 `crypto.randomUUID()`. "다시 시도"는 새 `requestId`로 같은 질문을 다시 보낸다.

### 5.4 SSE 소비 (D12)

- `POST {NEXT_PUBLIC_GUIDE_API_URL}/guide/stream`을 `fetch` + `response.body.getReader()`로 읽는다(EventSource는 POST 불가). "멈추기" = `AbortController.abort()`.
- 순수 함수 분리(vitest로 검증, 이 저장소의 "로직 레이어만 테스트" 관례와 맞음):
  - `src/lib/guide/sse.ts` — 바이트 조각을 이벤트로 나누는 파서(조각 경계에서 잘림 처리)
  - `src/lib/guide/events.ts` — 6종 이벤트 타입과 **손으로 쓴 타입 가드**
  - `src/lib/guide/context.ts` — `{view, slug?, section?}` 만들기
  - `src/lib/guide/actions.ts` — 액션 검증·해석(실행은 컴포넌트가)
  - `src/lib/guide/dictionary.ts` — ko/en 고정 문구(`tool_status.key`, `error.code`, `retract.reason`)
- **zod를 쓸지:** 인수인계 문서는 zod를 언급하지만 이 저장소에는 없다. **추천: 추가하지 않고** 타입 가드 + 에이전트 fixture를 그대로 복사해 vitest에서 통과시키는 것으로 같은 안전을 얻는다. 선택지: zod 추가(스키마가 계약 문서와 1:1로 읽히는 장점, 의존성 1개).
- `retract`: 말풍선을 사전의 고정 문구로 교체(몇 줄이라 2b에 포함. 이벤트는 에이전트 3단계부터 온다).
- 알 수 없는 이벤트·액션은 **무시**하고 답변은 항상 표시한다.

### 5.5 액션 처리 위치 (D13)

- `GuideProvider` 안의 한 함수 `runAction(action)`이 단일 진입점이다. 스트림 파서는 액션을 _모아두기만_ 하고 `done` 직전(또는 정상 종료)에 한 번 실행한다.
- 실행 전 재검증: `slug`는 레이아웃이 서버에서 내려준 **아티스트 slug 목록**(`getArtists()` 결과의 slug만)에 있는지 확인한다. 목록에 없으면 무시. 이동 경로는 내부 경로 `/artists/${slug}`로만 만들고 외부 URL은 절대 만들지 않는다.
- 실패해도 답변은 이미 표시돼 있다(액션 실행을 try/catch로 감쌈).
- 한계: 레이아웃은 이동해도 다시 안 그려지므로 세션 중에 새로 생긴 아티스트 slug는 모른다 → 그 액션은 무시된다(데모 범위에서 허용).

### 5.6 로케일·환경 (D14)

- `locale`: 처음엔 `navigator.language`가 `ko`로 시작하면 `ko`, 아니면 `en`. 패널의 KO\|EN 토글로 바꾼다(고정 문구와 요청의 `locale` 둘 다 따라간다).
- 환경변수 `NEXT_PUBLIC_GUIDE_API_URL`(예: `http://localhost:8000`): 브라우저가 직접 호출하므로 `NEXT_PUBLIC_`이 필요하고, **비밀이 아니다.** `.env.example`의 "NEXT*PUBLIC* 금지" 주석은 키·비밀 값에 대한 것이라 이 값만 예외로 명시한다.
- 변수가 비어 있으면 패널 버튼 자체를 숨긴다(에이전트 없는 배포에서 깨진 UI를 안 보이게).

---

## 6. 진행 순서와 plan 파일

plan 파일: `docs/plan-v3-tour-guide.md` (하나의 파일, 2a → 체크포인트 정지선 → 2b).

0. Task 0: 사전 준비 — `npm install`, Next 16 문서 읽기(해시 스크롤·`searchParams`·라우트 그룹 실측), `.env.local` 확인
1. 파트 A (2a): A1 geometry 순수 함수(TDD) → A2 focus 저장소(TDD) → A3 공용 모듈 + `OrbitScene3D` → A4 플래그·`?focus=` → A5 2D 폴백 focus 반응 + 문서·env
2. **체크포인트 (정지선)** — 승인 전에는 파트 B를 시작하지 않는다
3. 선행 조건: 계약 갱신 C1~C5 완료 확인 (B9 전까지)
4. 파트 B (2b): B1 SSE 파서(TDD) → B2 이벤트 타입 가드 + fixture → B3 섹션·context·액션 계획(TDD) → B4 사전 → B5 대화 reducer·스트림·세션(TDD) → B6 `(fans)` 그룹 이동 + Provider → B7 섹션 추적기 + `id="hero"` → B8 패널 UI → B9 로컬 에이전트 연동 확인

---

## 7. 계약 갱신 요청 목록 (에이전트 저장소에 전달 — `contracts/`는 수정하지 않음)

| #   | 요청                      | 내용                                                                                                                                                                                                                                                  | 시점         |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| C1  | `context.section` 추가    | `ViewContext.section?: "hero" \| "tour" \| "album" \| "gallery"` (§4.1). `view="tour"`일 때만 의미가 있다                                                                                                                                             | 2b 연동 전   |
| C2  | `openTour.section` 정의   | 같은 4개 값, 생략하면 `tour`. 에이전트는 당분간 계속 생략해도 된다                                                                                                                                                                                    | 〃           |
| C3  | 서버 중복 필터 갱신       | 지금은 `view=tour && slug 동일`이면 `openTour`를 안 보낸다. section이 들어오면 **현재 section이 목표 section과 같을 때만** 걸러야 한다(앨범을 보던 사용자가 "투어 일정 보여줘" 하면 투어로 스크롤돼야 하므로). 그 전까지는 이 경우 이동이 안 일어난다 | C1과 함께    |
| C4  | 프롬프트의 현재 화면 표기 | `view`/`slug`에 `section`을 포함하도록 갱신                                                                                                                                                                                                           | C1과 함께    |
| C5  | fixture 추가              | `section`이 들어간 요청 샘플, `openTour`에 `section`이 있는 이벤트 샘플                                                                                                                                                                               | C1과 함께    |
| C6  | 전체 공연 읽기 엔드포인트 | on-stage가 정해 전달하기로 한 항목. 아래 제안 모양 참고                                                                                                                                                                                               | 2a·2b와 독립 |
| C7  | 허용 Origin               | `https://on-stage-nine.vercel.app`(및 필요 시 프리뷰 도메인 패턴)을 에이전트 `ALLOWED_ORIGINS`에 추가                                                                                                                                                 | 배포 연동 시 |
| C8  | 통지(요청 아님)           | `/api/artists` 응답 사실 — 아래 §7.1                                                                                                                                                                                                                  | 지금         |

**C6 제안 모양** (구현은 이 설계 범위 밖, 모양만 제안): 기존 `src/app/api/shows/route.ts`에 `GET` 추가 → `GET /api/shows` → `{ shows: [{ artistSlug, cityCode, cityName, country, venue, showDate, featured }] }`. `capacity`·`artist_id`·`id`는 내보내지 않는다(공개 API에 불필요). 내부적으로는 `getShows(slug)`가 이미 있어 전체 조회용 함수만 추가하면 된다. 도시 수를 `city_code` 중복 제거로 셀지(`stats.cities`=공연 행 수와 다름)는 계약 갱신 때 정한다.

### 7.1 `/api/artists` 재검증 — on-stage 코드 기준으로 확인한 사실

`contracts/artists.py`는 못 읽었으므로 아래는 **on-stage 쪽 사실**만이고, 필드별 대조는 파일을 받은 뒤에 한다.

- 출처 커밋 `e57361a`는 이 저장소에 존재한다(2026-09-01). 그 이후 `types.ts`·`data.ts`·`api/artists/route.ts`의 변경은 `byArtistDisplayOrder`에 `export`를 붙인 1줄뿐이라 **응답 모양은 같다.**
- 응답은 `GET /api/artists` → `{ artists: Artist[] }`, `GET /api/artists?slug=x` → `{ artist }`(없으면 404 `{error}`).
- `Artist`의 모든 필드는 non-null이다. 비어 있을 수 있는 DB 컬럼(`gallery_images.creator/license/origin`)은 변환 단계에서 `""`로 바뀐다.
- `stats.cities` = `shows` 전체 행 수, `stats.countries` = 국가 중복 제거 수, **`stats.tracks` = `artists.stat_tracks` 컬럼 값이며 `tracks.length`와 다를 수 있다.** 에이전트가 트랙 수를 답할 때 어느 쪽을 쓰는지 확인이 필요하다.
- `cities[].date`는 DB `show_date` 그대로(`YYYY-MM-DD` 문자열), `cities[].name`은 `city_name`(한국어).
- 응답에는 에이전트가 쓰지 않는 필드(`color, initials, orbit, angle, size, gallery, shader`)도 있다. 에이전트의 Pydantic 모델이 **모르는 필드를 거부**하게 돼 있다면 검증이 실패하니 확인이 필요하다.

---

## 8. 위험과 구현 때 실측할 항목

| 항목                                   | 이유                                                                       | 대응                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Next 16 문서 미확인                    | `node_modules` 없음. AGENTS.md는 구현 전 문서 읽기를 요구                  | 구현 시작 전 `npm install` 후 `node_modules/next/dist/docs/`의 라우팅·레이아웃·`searchParams` 문서 확인 |
| `router.push("/x#tour")`의 해시 스크롤 | 새 페이지로 이동하며 해시 위치로 스크롤되는지 문서 근거를 아직 못 봤다     | 안 되면 도착 후 `scrollIntoView`를 한 번 호출                                                           |
| `searchParams`가 Promise인지           | 이 저장소의 `params`는 이미 `Promise`(page.tsx). 같은 규칙일 가능성이 높다 | 문서 확인 후 동일하게 `await`                                                                           |
| WebGL 컨텍스트                         | 아티스트 페이지는 이미 캔버스 3개. 패널은 DOM이라 추가 없음                | 체크포인트 #9로 확인                                                                                    |
| 오래 열린 `/` 탭                       | 자동 회전이 계속 돈다                                                      | R3F가 숨겨진 탭에서 프레임을 멈춘다. 체크포인트 #8에서 확인                                             |
| 접근성                                 | 패널·입력·라벨                                                             | 라벨은 `button`, 패널 열림은 `aria-expanded`, 답변은 `aria-live`. 체크포인트 #4                         |

---

## 9. `contracts/`에서 확인된 사실 (읽기만 함, 수정 안 함)

| 항목              | 확정된 내용                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| SSE 프레임        | `event:` 줄에 이벤트 이름, `data:` 줄에 JSON. 일반 이벤트의 `data`에는 `event` 필드가 **없다**(`{"text": "..."}`)                              |
| `action` 이벤트   | `data`가 액션 객체 그대로다: `{"type":"focusArtist","slug":"aurora"}` (`action` 키로 감싸지 않음)                                              |
| `tool_status.key` | 예: `tool.searchShows`. 도구 이름은 `listArtists`·`getArtist`·`searchShows`(design.md §5)                                                      |
| 오류 코드         | `rate_limited, off_topic, too_long, busy, upstream, internal`                                                                                  |
| 요청              | `message` 1~2000자(앞뒤 공백 제거 후), 200자 초과는 `too_long` 이벤트. `context`는 `{view: "orbit"\|"tour", slug?}`, `section`은 아직 없다(C1) |
| 순서              | `text_delta... → action(1회) → done`. 오류·취소에서는 `action`이 없다                                                                          |
| 확장              | `openTour.section`은 `string \| None`. 모르는 필드는 무시해야 한다                                                                             |

zod 대신 손으로 쓴 타입 가드를 쓰고, 에이전트 fixture(`guide_events_sample.json`)를 `src/lib/guide/`에 복사해 vitest로 검증한다(D12).

---

## 10. 결정 요약 (추천 → 선택지)

| #   | 결정               | 추천                                                              | 선택지                     |
| --- | ------------------ | ----------------------------------------------------------------- | -------------------------- |
| Q1  | 3D 범위            | `/` 궤도만                                                        | + TourOrbit                |
| D1  | 입체감             | 기울인 궤도 + 구체 + 조명                                         | 평면+구체 / 자유 회전      |
| D2  | 파일               | `OrbitScene3D.tsx` 신규, 기존 파일은 폴백                         | 한 파일 분기               |
| D3  | 플래그             | `?orbit=2d` > 서버 env `ORBIT_VIEW` > 3D                          | 클라이언트 쿼리 / env만    |
| D4  | 모바일 성능        | dpr 1.5, 분할 24, 후처리·그림자 없음                              | 모바일 분기                |
| D5  | 포커스             | 묶음 회전 + 카메라 당김, 저장소 경유                              | 카메라 추적 / 하이라이트만 |
| D6  | 섹션 값            | `hero\|tour\|album\|gallery`                                      | 의미 이름                  |
| D7  | 섹션 감지          | IntersectionObserver, 보내는 순간 읽기                            | 스크롤 계산                |
| D8  | `openTour.section` | 지금은 생략(=tour), 값은 같은 4개 정의                            | —                          |
| D9  | openTour 연출      | 자동 이동                                                         | 칩 / 궤도에서만 칩         |
| D10 | 패널 위치          | `(fans)` 라우트 그룹 레이아웃                                     | 루트 레이아웃 + 경로 검사  |
| D11 | 상태               | Context + reducer, 메모리 보관                                    | 상태 라이브러리            |
| D12 | SSE·검증           | fetch 스트림 + 직접 파서, zod 없음                                | zod 추가                   |
| D13 | 액션 실행          | Provider의 `runAction` 단일 진입점, slug 목록 재검증              | —                          |
| D14 | 로케일·URL         | 브라우저 언어 + 토글, `NEXT_PUBLIC_GUIDE_API_URL`, 비면 버튼 숨김 | —                          |

---

## 11. 하지 않는 것 (YAGNI)

DOM 전용 2D 폴백 · TourOrbit 3D화 · 자유 회전 컨트롤 · 장식 파티클 · 자동 품질 조절 · 상태 라이브러리 · zod · 대화 저장 · 추천 칩 · `busy`/세션 턴 상한 · `highlightCity`.
