# ON-STAGE 2차 구현 계획 2.4 — 셰이더 심화 (Implementation Plan v2.4)

> 2차 고도화는 항목마다 별도 계획 문서를 갖는다. 번호는 [`docs/design-v2.md`](./design-v2.md) 3장의
> 시퀀싱(2.1~2.5)을 따른다. 이 문서는 **2.4 셰이더 심화**만 다룬다.

**Goal:** `artists` 테이블의 `shader_pattern`/`shader_freq`/`shader_falloff`/`shader_speed` 값이 A탭
`HeroBackground` 셰이더에 실제로 반영되게 한다 — 컬럼과 입력 UI는 4장·7장에서 이미 만들어졌고, 이
계획은 그 값을 읽어서 화면에 그리는 것만 다룬다.

**Architecture:** 화면용 `Artist` 타입에 `shader` 필드를 추가해 `getArtist()`가 셰이더 파라미터까지
반환하게 하고(Task 1·2), `HeroBackground`가 그 값을 유니폼으로 받아 프래그먼트 내 분기 하나로
`wave`/`ripple`/`grain` 3종을 그린다(Task 3). 새 API 라우트나 마이그레이션은 없다 — 읽기 경로만
넓힌다.

**Tech Stack:** Next.js 16.2.12 / React 19.2.4 / `@react-three/fiber` · `three` (GLSL 셰이더)

**승인된 설계:** [`docs/design-v2.md`](./design-v2.md) **8장**(8.1~8.4). 이 계획은 그 문서를 구현
단위로 쪼갠 것이며, GLSL 코드·타입 정의·파라미터 범위의 **단일 진실 공급원은 design-v2.md다.**
4·5·7장과 동일한 문서 관리 방침을 따른다.

**브랜치:** `feat/shader-depth`

---

## Global Constraints

모든 Task에 적용된다. 이 절의 요구사항은 각 Task의 완료조건에 암묵적으로 포함된다.

### 프로젝트 규칙

- **새 API 라우트·마이그레이션 없음.** 셰이더 컬럼(4장)과 `PATCH /api/artists/[id]`(7장)는 이미
  있다. 이 계획은 읽기 경로(`getArtist`/`getArtists` → `HeroBackground`)만 넓힌다.
- **파라미터 범위에 새 검증을 추가하지 않는다.** `falloff`(폼 `min=0 max=1` + 서버 검증)와
  `speed`(서버 `≥0`)는 이미 셰이더 정의역과 일치하고(§8.3), `freq`는 원래도 무제한이다(§7.6 얕은
  검증 원칙 유지).
- **`ArtistRow.shader_pattern`은 그대로 `string`이다.** DB 컬럼이 `text`라 §7 결정을 바꾸지 않는다
  — 좁은 타입(`ShaderPattern`)은 화면용 `Artist` 타입에만 적용한다(Task 1).
- 커밋 컨벤션: Conventional Commits(`feat:` `refactor:` `docs:`), 소문자 명령형.

### 범위 밖 (선제 구현 금지)

design-v2.md §10을 그대로 따른다. 특히 이 계획에서 손이 갈 만한 것:

- `OrbitScene` 노드까지 셰이더 확장 — §8 원안에서 명시적으로 스코프 밖
- `shader_pattern` enum에 4번째 값 추가 — 스키마 제약은 아니지만 §8 원안이 3종으로 고정, `PATCH`
  API의 `SHADER_PATTERNS` 허용값도 3종
- `/staff/artists` 폼에서 저장 전 A탭 실시간 미리보기 — §8 어디에도 요구 없음, 저장 후 반영만

---

## 파일 구조 (최종 목표)

```
src/
├── lib/
│   ├── types.ts                        # 수정 — ShaderPattern 신규 export, Artist.shader 추가 (Task 1)
│   └── data.ts                          # 수정 — toArtist()에 shader 매핑 추가 (Task 2)
├── components/
│   ├── three/HeroBackground.tsx         # 수정 — uFreq/uFalloff/uSpeed/uPattern 유니폼,
│   │                                     #        wave/ripple/grain 분기 (Task 3)
│   └── staff/ArtistEditForm.tsx         # 수정 — 로컬 ShaderPattern 제거, lib/types에서 import (Task 1)
└── app/
    └── artists/[slug]/page.tsx          # 수정 — <HeroBackground shader={artist.shader}> 전달 (Task 3)
```

---

## Task 순서와 의존관계

```
Task 1  타입 확장 (ShaderPattern 공용화 + Artist.shader)
   ↓
Task 2  data.ts toArtist() 매핑
   ↓
Task 3  HeroBackground 셰이더 3종 + 페이지 연결 (시각 검증)
   ↓
Task 4  완료 기준 검증 · 문서 갱신
```

전부 선형이다 — 항목 하나짜리 작은 스코프라 5장·7장처럼 백엔드/프론트를 나눠서 작업할 이유가
없다. Task 1(타입)이 없으면 Task 2가 채울 필드가 없고, Task 2(데이터)가 없으면 Task 3이 화면에서
확인할 실제 값이 없다. Task 4는 §11 8장 완료 기준을 마지막에 모아 확인한다.

---

### Task 1: 타입 확장 — `ShaderPattern` 공용화 + `Artist.shader` 추가

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/components/staff/ArtistEditForm.tsx`

**Interfaces:**
- Produces: `type ShaderPattern = "wave" | "ripple" | "grain"` (`src/lib/types.ts`에서 export) — Task 2가
  `toArtist()` 매핑에, Task 3이 `HeroBackground` prop 타입에 재사용한다.
- Produces: `Artist.shader: { pattern: ShaderPattern; freq: number; falloff: number; speed: number }` —
  Task 2가 값을 채우고 Task 3이 소비한다.

**왜**: design-v2.md §8.1. `ArtistEditForm.tsx`에 로컬로만 정의돼 있던 `ShaderPattern`을 공용화하고,
화면용 `Artist` 타입에 셰이더 필드가 없어 `HeroBackground`까지 값이 닿지 않는 문제를 해결한다.

**주의**:
1. `ArtistRow.shader_pattern`은 여전히 `string`이다(위 Global Constraints) — `ArtistRow` 자체는 안
   건드리고 `Artist`(화면용 타입)에만 좁은 타입을 적용한다.
2. `ArtistEditForm.tsx`는 import만 바꾼다 — `toDraft`/`handleSave` 등 기존 로직은 무변경.

- [x] **Step 1: `types.ts`에 `ShaderPattern` export 추가, `Artist`에 `tour`와 같은 중첩 패턴으로
      `shader: { pattern: ShaderPattern; freq: number; falloff: number; speed: number }` 추가**
- [x] **Step 2: `ArtistEditForm.tsx`의 로컬 `type ShaderPattern = "wave" | "ripple" | "grain"` 제거,
      `@/lib/types`에서 import로 교체**
- [x] **Step 3: `grep -rn "type ShaderPattern" src`로 재정의가 `src/lib/types.ts` 한 곳뿐인지 확인**
- [x] **Step 4: `npm run build` 통과 확인**
- [x] **Step 5: 검증** — 아래 완료조건 확인

**완료조건:**
- `npm run build` 통과
- `grep -rn "type ShaderPattern" src` 결과가 `src/lib/types.ts` 한 줄뿐
- `/staff/artists`에서 셰이더 패턴 select + 숫자 필드 3개가 기존과 동일하게 표시·저장된다(회귀 없음)

**검증 노트**: 계획에는 없던 발견 — Task 1 혼자서는 `npm run build`가 통과할 수 없었다.
`Artist.shader`를 필수 필드로 추가하면 `toArtist()`(Task 2 담당)가 바로 타입 에러를 내기 때문에,
실제로는 Task 1·2를 한 커밋으로 묶어 진행했다(`feat: promote ShaderPattern to shared type and map
it onto Artist.shader`). 나머지는 계획대로.

---

### Task 2: `data.ts` — `toArtist()` 셰이더 매핑

**Files:**
- Modify: `src/lib/data.ts`

**Interfaces:**
- Consumes: Task 1의 `ShaderPattern`, `Artist.shader`
- Produces: `getArtist()`/`getArtists()`가 반환하는 각 `Artist` 객체의 `shader` 필드에 실제 DB 값이
  채워짐 — Task 3의 `artists/[slug]/page.tsx`가 그대로 소비한다.

**왜**: design-v2.md §8.1. `ARTIST_SELECT`(`"*, tracks(*), shows(*), gallery_images(*)"`)가 이미
`artists.*`를 통째로 읽어오므로 쿼리 변경 없이 `toArtist()` 매핑만 추가하면 된다 — 추가 왕복 없음.

**주의**:
1. `row.shader_pattern`은 `string`이라 `as ShaderPattern`으로 좁힌다 — `PATCH /api/artists/[id]`가
   이미 3종만 허용하도록 검증하므로(`SHADER_PATTERNS` 셋) 여기서 런타임 재검증은 하지 않는다.

- [x] **Step 1: `toArtist()`에 `shader: { pattern: row.shader_pattern as ShaderPattern, freq:
      row.shader_freq, falloff: row.shader_falloff, speed: row.shader_speed }` 매핑 추가**
- [x] **Step 2: `npm run build` 통과 확인**
- [x] **Step 3: 검증** — 아래 완료조건 확인

**완료조건:**
- `npm run build` 통과
- (실제 값이 화면에 정확히 반영되는지는 Task 3의 시각 검증에서 최종 확인 — 이 Task는 타입 레벨
  검증까지)

**검증 노트**: Task 1과 한 커밋으로 처리(위 참고). `npm run build`·`eslint`·`vitest`(29개) 통과.

---

### Task 3: `HeroBackground` 셰이더 3종 + 페이지 연결

**Files:**
- Modify: `src/components/three/HeroBackground.tsx`
- Modify: `src/app/artists/[slug]/page.tsx`

**Interfaces:**
- Consumes: Task 1의 `ShaderPattern`, Task 2가 채운 `Artist.shader`
- Produces: `HeroBackground({ color, shader }: { color: string; shader: { pattern: ShaderPattern; freq:
  number; falloff: number; speed: number } })` — 기존 `{ color: string }` 시그니처를 확장한다(호출부는
  `artists/[slug]/page.tsx` 한 곳뿐).

**왜**: design-v2.md §8.2·§8.3. `wave`를 파라미터화하고 `ripple`/`grain`을 신규로 추가한다.
`uFreq`/`uFalloff`/`uSpeed`/`uPattern` 4개 유니폼을 더하고, 프래그먼트 내 분기 하나로 3종을 처리한다
(§8 원안 그대로 — 패턴별 함수 분리나 셰이더 파일 분리 없음).

**주의**:
1. **GLSL 코드는 design-v2.md §8.2를 그대로 옮긴다** — `p`(중심 기준 uv)와 `d`(글로우용 반지름)는
   기존 계산을 그대로 재사용하고, `wave`/`ripple`/`grain` 세 항과 `glow = smoothstep(uFalloff, 0.0,
   d)`를 §8.2 코드 그대로 적용한다.
2. **`uPattern`은 `GlowPlane` 내부에서 문자열→숫자로 매핑한다**(`wave`=0, `ripple`=1, `grain`=2) —
   `useMemo` 의존성 배열은 **`shader` 객체 전체가 아니라 `shader.pattern`/`shader.freq`/
   `shader.falloff`/`shader.speed` 개별 필드로 좁힌다**(`[color, shader.pattern, shader.freq,
   shader.falloff, shader.speed]`). `artist.shader`는 서버 컴포넌트(`ArtistPage`)에서 한 번만
   만들어지는 값이라 이 마운트 인스턴스 안에서는 사실상 참조가 안정적이지만, 그 전제에 기대지
   않는다 — 기존 `uColor`가 이미 원시값 `color` 하나로 의존성을 좁혀놓은 것과 같은 이유(참조
   동일성에 기대지 않고 실제로 바뀐 값만 감지)를 `shader`에도 그대로 적용한다.
3. **기본값(`wave`/`freq=9`/`falloff=0.75`/`speed=0.5`)에서는 기존 하드코딩 렌더링과 시각적으로
   동일해야 한다** — §8 도입부에서 이미 확인된 전제(DB 기본값 = 기존 하드코딩 값)를 화면에서
   재확인하는 게 이 Task의 회귀 방지 핵심이다.
4. `artists/[slug]/page.tsx`는 `<HeroBackground color={artist.color} shader={artist.shader} />`로
   호출부만 바꾼다 — 그 외 로직 무변경.

- [x] **Step 1: `HeroBackground.tsx`에 `uFreq`/`uFalloff`/`uSpeed`/`uPattern` 유니폼 추가, fragment
      셰이더에 3종 분기 구현(§8.2), `HeroBackground` props에 `shader` 추가**
- [x] **Step 2: `GlowPlane`의 `useMemo`에 패턴 문자열→숫자 매핑 추가, 의존성 배열을 `shader`
      개별 필드(`shader.pattern`/`shader.freq`/`shader.falloff`/`shader.speed`)로 좁힘**
- [x] **Step 3: `artists/[slug]/page.tsx`에서 `shader={artist.shader}` 전달**
- [x] **Step 4: `npm run build` 통과 확인**
- [x] **Step 5: 브라우저 검증**(`next build && next start -p 3001`, 포트 3000은 손대지 않음) —
      `scripts/seed.mjs`의 `SHADER_BY_SLUG` 기준 6명(aurora=wave, velvet=ripple, nova=grain,
      halo=wave, lumen=ripple, echo=grain)을 각각 `/artists/[slug]`로 열어서:
      1. `aurora`(wave, 기본값)가 기존(1차) 렌더링과 시각적으로 동일한지 — 회귀 없음 확인
      2. `wave` 2명(aurora/halo)이 서로 다른 `freq`/`speed`로 체감 다르게 보이는지
      3. `ripple` 2명(velvet/lumen)이 중심에서 퍼지는 동심원으로 보이는지
      4. `grain` 2명(nova/echo)이 알갱이 텍스처로 보이는지, wave/ripple과 뚜렷이 다른지
      5. 3종이 서로 명확히 구분되는지(§11 8장 완료 기준 1번의 실측)
- [x] **Step 6: 검증** — 아래 완료조건 확인

**완료조건:**
- `npm run build` 통과
- 6명 아티스트 전부 육안 확인 완료, `aurora`가 기존과 동일, 3 패턴이 서로 다르게 보인다

**검증 노트 (Step 5)**: 계획에 없던 발견 두 건:

1. **`p.y * uFreq * 0.78`이 근사값이라 회귀가 깨짐** — `0.78`은 `7/9`의 소수 근사(§8.2 원안에도
   "≈"로 명시)라 `freq=9`(기본값)일 때 `9*0.78=7.02`가 나와 원래 하드코딩 `7.0`과 미세하게 어긋남.
   `uFreq * (7.0/9.0)`로 교체 — GLSL이 컴파일 타임에 계산해 `freq=9`일 때 정확히 `7.0`이 나온다.
2. **진폭 공식이 공유돼 있어 패턴 구분이 안 됨** — `col = base + uColor * glow * (0.10 + 0.10 * wave)`가
   분기 밖에서 3종 전부에 공통 적용돼, wave/ripple/grain 값 자체는 달라도 최종 밝기 폭이
   0.10~0.20(2배)뿐이라 육안으로 거의 안 보였음(실제 화면에서 확인). `intensity` 계산을
   분기 안으로 옮겨 wave는 원래 폭 그대로(회귀 보존), ripple/grain은 훨씬 넓게(`0.05~0.40`,
   `0~0.40`) 재설정. ripple은 추가로 링 배율(`d * uFreq * 2.0` → `6.0`)도 올렸다 — falloff 반경 안에
   링이 1~2개뿐이면 무늬로 안 읽히고 그냥 밝은 덩어리로 보였기 때문.

이후 code-review + ponytail-review를 진행해 3건을 검토했다:
- `smoothstep(uFalloff, 0.0, d)`는 `uFalloff=0`(폼·서버 둘 다 허용하는 값)일 때 GLSL 스펙상
  `edge0>=edge1`로 정의되지 않은 연산이 된다. **다만 falloff=0을 실제로 재현해보니 현재 테스트 브라우저/GPU(Chrome·macOS)에서는 시각적으로 안 깨졌다** — 
  그래도 스펙이 명시적으로 undefined라 다른 브라우저·GPU(모바일 Safari, 타 벤더 등)에서는 다르게
  나올 수 있어, `max(uFalloff, 0.001)`를 유지한다
- `PATTERN_INDEX[shader.pattern]`이 알 수 없는 값에 `undefined`를 반환하는 것을 `?? 0`(wave 기본)으로 방지
- `ShaderParams`가 `Artist.shader`와 중복 선언돼 있던 것을 `type ShaderParams = Artist["shader"]`로 재사용

---

### Task 4: 완료 기준 검증 · 문서 갱신

**Files:**
- Modify: `docs/design-v2.md` (§11 8장 체크박스)
- Modify: `README.md` (2차 로드맵 체크박스, 국영문 병기)

**Interfaces:** 없음

**왜**: §11 8장 완료 기준 2개 항목을 최종 확인하고, §9.2 문서화 방침을 README에 반영한다.

- [x] **Step 1: 오너 계정으로 `/staff/artists`에서 임의 아티스트의 `shader_pattern`/`shader_freq`/
      `shader_falloff`/`shader_speed`를 변경 → 저장**
- [x] **Step 2: 같은 아티스트의 `/artists/[slug]`(A탭)를 다시 열어 변경값이 히어로 셰이더에 그대로
      반영되는지 확인** — 서버 컴포넌트라 별도 캐시 무효화 없이 재방문 시 최신값을 읽는다(§11 8장
      완료 기준 2번의 실측)
- [x] **Step 3: 원래 값(시드값)으로 복구** — 실 데이터 변형 방지, 재시드 없이 직접 되돌린다
- [x] **Step 4: `npm run build` 최종 통과 확인**
- [x] **Step 5: `docs/design-v2.md` §11 8장 체크박스 2개 `[x]`로 갱신**
- [x] **Step 6: `README.md` 갱신**(국문·영문 병기, 2차 로드맵 항목)
- [x] **Step 7: 검증** — 아래 완료조건 확인

**완료조건:**
- §11 8장 체크박스 2개 전부 확인 완료
- README 국문·영문 모두 갱신되고 서로 내용이 어긋나지 않는다
- `npm run build` 통과

**검증 노트**: Step 1~2는 `aurora`를 PATCH API로 `grain/14/0.9/0.8`로 바꿔 A탭에서 즉시 반영 확인
(스크린샷) → 시드값(`wave/9/0.75/0.5`)으로 복구. Step 4·7의 최종 검증은 `tsc --noEmit`
(exit 0) / `eslint`(exit 0) / `vitest` 29개 전부 통과 / `npm run build`(exit 0, 19개 라우트 정상
생성)를 이 리포트 작성 시점에 새로 실행해 확인 — Task 3에서 review로 검토한 3건(falloff=0 이식성
안전장치, 알 수 없는 pattern, ShaderParams 중복)을 반영한 뒤의 최종 상태다.

---

## 계획 검증 노트 (Self-Review)

계획을 쓴 뒤 design-v2.md 8장과 대조하며 확인한 것들.

**스펙 커버리지** — §8.1(데이터 흐름·타입 확장) → Task 1·2. §8.2(GLSL 3종) → Task 3. §8.3(파라미터
매핑과 범위) → Task 3의 유니폼 대입 + Global Constraints(새 검증 추가 없음). §8.4(변경 파일) → 파일
구조 트리와 1:1 대응(5개 파일 전부 어느 Task에 속하는지 표기됨). §11 8장 완료 기준 2개 → 1번(시각
구분)은 Task 3, 2번(파라미터 변경 반영)은 Task 4에서 각각 확인한다.

**타입 일관성** — `ShaderPattern`(Task 1)이 Task 2의 `toArtist()` 매핑, Task 3의 `HeroBackground` prop
타입, 그리고 기존 `ArtistEditForm.tsx`에서 동일한 이름·값(`"wave" | "ripple" | "grain"`)으로
일관되게 재사용된다. `Artist.shader: { pattern, freq, falloff, speed }`(Task 1)가 Task 2가 채우는 값의
모양, Task 3이 `HeroBackground`에서 받는 prop 모양과 필드명·순서까지 정확히 일치한다.

**설계 문서에 없던 결정 하나** — §8.1은 "`Artist`에 `shader` 필드 추가"까지만 정하고, `HeroBackground`
prop 타입을 `Artist["shader"]`로 참조할지 독립적으로 인라인 선언할지는 명시하지 않았다. 이 계획은
처음엔 `HeroBackground.tsx`가 `Artist` 전체 타입을 몰라도 되게 `ShaderPattern`만 import하고 나머지는
인라인 객체 타입(`type ShaderParams = { pattern: ShaderPattern; freq: number; falloff: number; speed:
number }`)으로 선언하는 쪽으로 정리했었다. **하지만 Task 3 이후 code-review + ponytail-review에서
이 인라인 타입이 `Artist.shader`와 모양이 중복된다는 지적을 받아, 최종적으로는 `Artist`를 import해서
`type ShaderParams = Artist["shader"]`로 재사용하는 쪽으로 뒤집었다** — `HeroBackground.tsx:7,61` 참고.
결합도보다 단일 진실 공급원을 우선한 결정이다.
