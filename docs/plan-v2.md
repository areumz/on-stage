# ON-STAGE 2차 구현 계획 — Supabase 전환 (Implementation Plan v2)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`로 태스크 단위 실행.
> 각 스텝은 체크박스(`- [ ]`)로 추적한다.

**Goal:** 하드코딩 로그인과 mock JSON을 걷어내고 Auth·DB·Storage를 Supabase로 옮겨,
B탭 관리자가 갤러리 이미지를 직접 업로드·관리할 수 있게 한다.

**Architecture:** 브라우저는 Supabase를 알지 못한다. 모든 접근은 서버(API Routes·서버 컴포넌트)를
거치고, 파일 업로드만 서버가 발급한 서명 URL로 Storage에 직접 올린다. 데이터 정합성은 RLS가,
표시 형식은 순수 매핑 함수가 책임진다.

**Tech Stack:** Next.js 16.2.12 / React 19.2.4 / `@supabase/supabase-js` / `@supabase/ssr` /
Supabase CLI / Postgres 15+ / vitest (node 환경)

**승인된 설계:** [`docs/design-v2.md`](./design-v2.md) **4장**. 이 계획은 그 문서를 구현 단위로
쪼갠 것이며, 스키마 DDL·RLS 정책·API 계약의 **단일 진실 공급원은 design-v2.md다.**

**브랜치:** `feat/supabase` (1차 관행 `feat/<area>` 유지)

---

## 이 계획 문서의 방침 (1차와 다른 점)

1차는 `docs/plan.md`에 컴포넌트·라우트 핸들러 코드를 통째로 실어 두고, 그대로 공개하면
"AI 초안을 검증 없이 커밋한 것"처럼 보일 수 있어 코드를 뺀 `docs/plan-summary.md`를 따로 만들었다.
같은 내용을 두 번 쓰는 이중 작업이었다.

2차는 **문서 하나만 운영한다.**

- **이 문서에는 컴포넌트·라우트 핸들러 코드를 싣지 않는다.** 스키마 DDL과 RLS 정책은 이미
  design-v2.md 4장에 있으므로 각 Task는 그 절을 참조한다. 실제 코드는 executing-plans 단계에서
  그 자리에서 작성한다.
- 각 Task는 **무엇을(파일 경로) · 왜(design-v2.md 절 참조 + 판단 근거) · 완료조건** 중심으로 쓴다.
  단, `**Interfaces:**`의 함수 시그니처는 유지한다 — Task를 순서대로 읽지 않는 구현자가 이웃 Task의
  이름과 타입을 알 수 있는 유일한 통로이고, 이건 "미리 써둔 구현 코드"가 아니다.
- `plan-summary.md`를 나중에 따로 만들지 않는다. **각 Task를 끝낼 때마다 그 Task 아래 "검증 노트"에
  실제로 무엇을 발견하고 어떻게 고쳤는지를 바로 누적한다.**

> 각 Task의 `**검증 노트**` 항목은 의도적으로 비워 둔 자리다. 구현 전에는 비어 있는 게 정상이며,
> Task 완료 시점에 채운다.

---

## Global Constraints

모든 Task에 적용된다. 이 절의 요구사항은 각 Task의 완료조건에 암묵적으로 포함된다.

### 훈련 데이터와 다른 부분 (반드시 준수)

- **Next 16 — 미들웨어 파일명은 `src/proxy.ts`이고 `middleware.ts`가 아니다.** export 이름도 `proxy`다.
  `@supabase/ssr` 공식 문서의 세션 갱신 예제는 `middleware.ts`를 가정하므로, 내용만 가져오고
  파일명·export 이름은 이 프로젝트 것을 유지한다.
- **Tailwind v4 — `tailwind.config.ts`가 없다.** 디자인 토큰은 `src/app/globals.css`의 `@theme`에 있다.
- **Postgres — RLS 기본값은 꺼짐이다.** `create policy`만으로는 정책이 적용되지 않는다 (design-v2.md §4.5).

### 프로젝트 규칙

- **Supabase 키는 전부 서버 전용.** `NEXT_PUBLIC_` 접두사를 쓰는 환경변수를 만들지 않는다 (§4.7).
- **service role 키는 시드 스크립트에서만 쓴다.** 런타임 요청 경로에서 쓰지 않는다 (§4.5).
- **TDD 대상은 `src/lib/metricsView.ts` 하나뿐이다** (§9.1). 나머지는 브라우저·CLI 검증으로 확인한다.
  R3F 씬·셰이더·레이아웃에 형식적 테스트를 생성하지 말 것.
- **vitest는 `environment: "node"`를 유지한다.** 3D 컴포넌트를 import할 수 없다는 사실이 형식적
  테스트를 막는 강제 장치다.
- **커밋은 사용자가 직접 한다.** 각 Task의 커밋 스텝은 실행하지 말고, 구현·검증을 끝낸 뒤 변경 파일과
  검증 결과를 보고하고 멈춘다.
- 커밋 컨벤션: Conventional Commits (`feat:` `fix:` `test:` `docs:` `refactor:`), 소문자 명령형.

### 범위 밖 (선제 구현 금지)

design-v2.md 10장을 그대로 따른다. 특히 이 계획에서 자주 손이 갈 만한 것:

- `/staff/tours` · `/staff/tickets` 실 화면, `artists`·`tracks` 편집 UI — **7장(로드맵 4번) 몫이다.**
  Task 7에서 `/staff/artists`를 건드리지만 **갤러리 섹션만** 만든다.
- 이미지 리사이즈·썸네일 파이프라인, 감사 로그, 소프트 삭제
- 회원가입·비밀번호 재설정

---

## 파일 구조 (최종 목표)

```
src/
├── lib/
│   ├── supabase/
│   │   └── server.ts        # 신규 — 쿠키 어댑터 서버 클라이언트 (유일한 Supabase 진입점)
│   ├── data.ts              # 재작성 — DB 읽기 전담 (artists/tracks/shows/gallery)
│   ├── metricsView.ts       # 신규 — 순수 표시 매핑. TDD 대상
│   ├── metricsView.test.ts  # 신규
│   ├── types.ts             # 재작성 — DB 행 타입 / 화면용 뷰 타입 분리
│   ├── auth.ts              # 축소 — staffRedirectPath만 남김
│   └── auth.test.ts         # 축소 — validateCredentials 테스트 제거
├── proxy.ts                 # 재작성 — 세션 갱신 + getUser() 가드
└── app/api/
    ├── artists/route.ts     # async 전환 (route.test.ts 삭제)
    ├── metrics/route.ts     # async 전환 + metricsView 경유 (route.test.ts 삭제)
    ├── login/route.ts       # Supabase Auth (route.test.ts 삭제)
    ├── logout/route.ts      # 신규
    └── gallery/
        ├── upload-url/route.ts  # 신규 — 서명 URL 발급
        ├── route.ts             # 신규 — POST (행 삽입)
        └── [id]/route.ts        # 신규 — DELETE

supabase/migrations/0001_init.sql   # 신규 — 테이블 + RLS + 뷰 + 버킷
scripts/seed.mjs                    # 신규 — 멱등 시드
.env.example                        # 신규
.github/workflows/test.yml          # 신규 — npm test
```

**책임 분리의 기준**: `data.ts`는 I/O(쿼리)만, `metricsView.ts`는 계산(표시 문자열 생성)만 맡는다.
엔티티별로 파일을 쪼개지 않는 이유는 전환 후에도 `data.ts`가 80줄 안팎이고, 기존 `src/lib/*.ts`가
평평한 구조이기 때문이다. 여기서 `src/lib/db/` 디렉터리를 새로 파는 건 과잉이다.

### 설계 문서에서 조정한 두 가지

구현 단위로 쪼개면서 design-v2.md 4장의 빈 곳 두 개를 발견했고, 아래처럼 해소한다.

1. **`src/lib/supabase/admin.ts`를 만들지 않는다.** §4.8 변경 파일 목록에 있지만, §4.5가 service role을
   시드 전용으로 못 박았고 시드는 `scripts/seed.mjs`(타입 없는 ESM)라 TypeScript 모듈을 import할 수 없다.
   즉 이 파일은 어떤 호출부도 갖지 못하는 죽은 코드가 된다. 시드가 자기 클라이언트를 인라인으로 만든다.
2. **업로드 UI는 `/staff/artists`의 갤러리 섹션에 붙인다.** §4.6은 업로드 API만 정의하고 어느 화면이
   호스트인지 적지 않았는데, §11의 완료 기준("B탭에서 이미지를 업로드하면 A탭 갤러리에 반영")을 채우려면
   화면이 필요하다. §7이 갤러리 관리를 `/staff/artists`에 두기로 했으므로 그 화면의 갤러리 섹션만
   이번에 만든다. 아티스트·트랙 편집은 7장에 그대로 남긴다. 임시 화면을 따로 만들어 나중에 버리는
   중복을 피한다.

---

## Task 순서와 의존관계

```
Task 1  셋업·환경변수·CI
   ↓
Task 2  마이그레이션 (테이블 + RLS + 뷰 + 버킷)
   ↓
Task 3  시드 스크립트          ← Task 4~7이 전부 실제 데이터를 필요로 한다
   ↓
Task 4  서버 클라이언트 + A탭 읽기 전환
   ↓
Task 5  지표 매핑 (TDD) + B탭 대시보드 전환
   ↓
Task 6  인증 전환               ← 시드가 만든 계정이 있어야 검증 가능
   ↓
Task 7  갤러리 업로드·삭제      ← 세션 uid가 필요하므로 인증 이후
   ↓
Task 8  완료 기준 검증 · 문서 갱신
```

읽기 전환(Task 4)을 인증(Task 6)보다 먼저 두는 이유는, RLS의 `public read` 정책 덕분에 읽기는
비로그인 상태에서도 동작하기 때문이다. 세션 처리라는 변수를 빼고 연결·클라이언트·RLS가 맞는지
먼저 확인한 뒤, 그 위에 인증을 얹는 순서가 문제를 좁히기 쉽다.

---

### Task 1: 프로젝트 셋업 · 환경변수 · CI

**Files:**
- Modify: `package.json` (의존성 3개, `seed` 스크립트)
- Create: `.env.example`
- Create: `.env.local` (gitignored — `.gitignore`의 `.env*`가 이미 잡는다)
- Create: `.github/workflows/test.yml`

**Interfaces:**
- Produces: `.env.local`의 `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` /
  `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` — Task 2~8 전부가 소비한다

**왜**: design-v2.md §4.7의 환경변수 표가 이 Task의 명세다. CI에 테스트 잡이 없다는 것은 §4.8에서
확인된 사항으로, Task 5의 TDD 결과물이 실제로 지켜지려면 여기서 먼저 깔아 둬야 한다.

주의: 의존성은 `@supabase/supabase-js`, `@supabase/ssr`(런타임), `supabase`(CLI, devDependency)
**세 개뿐이다.** ORM·검증 라이브러리·상태관리 라이브러리를 추가하지 말 것. `.env.example`에는 키 이름과
용도만 적고 실제 값을 넣지 않는다.

- [ ] **Step 1: Supabase 프로젝트 생성** — 무료 티어, 리전은 지연이 가장 낮은 곳. **사람이 직접 한다**
      (대시보드 로그인 필요). 생성 후 URL·anon key·service role key를 확보한다
- [ ] **Step 2: 의존성 설치** — 위 세 개
- [ ] **Step 3: `.env.example` 작성** — §4.7 표의 5개 키, 각각 용도 주석 한 줄
- [ ] **Step 4: `.env.local` 작성** — Step 1에서 받은 실제 값
- [ ] **Step 5: `package.json`에 `seed` 스크립트 추가** — `node scripts/seed.mjs`
- [ ] **Step 6: `.github/workflows/test.yml` 작성** — `push`/`pull_request`에서 Node 22로
      `npm ci && npm test`. react-doctor 워크플로와 별도 파일로 둔다 (목적과 트리거가 다르다)
- [ ] **Step 7: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- `npx supabase --version`이 동작한다
- `.env.local`에 5개 키가 모두 있고, `.env.example`에는 값이 비어 있다
- `grep -r "NEXT_PUBLIC_" .env.example` 결과가 0건이다
- `npm test`가 로컬에서 통과한다 (기존 5개 테스트 파일)
- `git status`에 `.env.local`이 나타나지 않는다

**검증 노트**: _(Task 완료 시 기록)_

---

### Task 2: 마이그레이션 — 테이블 · RLS · 뷰 · 버킷

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `supabase/config.toml` (CLI `init` 산출물)

**Interfaces:**
- Produces: 테이블 6개 (`artists` `tracks` `shows` `ticket_sales` `gallery_images` `stage_presets`),
  뷰 2개 (`show_status` `artist_metrics`), Storage 버킷 `gallery`.
  컬럼명·타입은 **design-v2.md §4.1과 §4.2의 DDL이 그대로 명세다.** 옮겨 적을 때 이름을 바꾸지 말 것

**왜**: 스키마(§4.1)·RLS(§4.5)·뷰(§4.2)를 **한 마이그레이션 파일에 넣는다.** 셋을 별도 Task로 쪼개면
테이블은 있는데 RLS가 없는 창이 생기고, 그 상태로 시드가 돌면 정책 검증 없이 데이터가 들어간다.
마이그레이션은 원자적으로 적용되므로 리뷰 게이트도 하나면 충분하다.

주의: **§4.5의 `alter table ... enable row level security` 6줄을 빠뜨리지 말 것.** 빠뜨려도 에러가
나지 않고 정책이 조용히 무시된다. `force row level security`는 쓰지 않는다 — service role이 RLS를
우회하는 것은 의도된 동작이고 Task 3이 거기에 의존한다. 뷰에는 `with (security_invoker = true)`가
반드시 붙어야 한다 (§4.2).

- [ ] **Step 1: `npx supabase init` 실행** 후 원격 프로젝트에 `link`
- [ ] **Step 2: `0001_init.sql`에 테이블 6개 작성** — §4.1 DDL 그대로. 컬럼 주석도 함께 옮긴다
      (`stat_tracks`가 왜 남는지 등의 판단 근거가 주석에 있다)
- [ ] **Step 3: 같은 파일에 RLS 활성화 6줄 + 정책 작성** — §4.5 SQL 그대로. 역할 스코프(`artists`
      `tracks` `shows`) / 소유 스코프(`gallery_images` `stage_presets`) / 읽기 전용(`ticket_sales`)의
      구분을 지킬 것
- [ ] **Step 4: 같은 파일에 뷰 2개 작성** — §4.2 SQL 그대로. `security_invoker` 확인
- [ ] **Step 5: 같은 파일에 Storage 버킷 `gallery` 생성** — public read, `allowed_mime_types`는
      `image/jpeg` `image/png` `image/webp`, `file_size_limit` 지정 (§4.5 말미)
- [ ] **Step 6: 같은 파일에 Storage 정책 3개 작성** — §4.5 SQL 그대로
- [ ] **Step 7: `npx supabase db push`로 적용**
- [ ] **Step 8: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- `db push`가 에러 없이 끝난다
- 아래 쿼리의 `relrowsecurity`가 **6행 모두 `t`**다 (§11 완료 기준):
  ```sql
  select relname, relrowsecurity from pg_class
  where relname in ('artists','tracks','shows','ticket_sales','gallery_images','stage_presets');
  ```
- 아래 쿼리가 뷰 2개를 반환하고 `security_invoker`가 켜져 있다:
  ```sql
  select c.relname, c.reloptions from pg_class c
  where c.relname in ('show_status','artist_metrics');
  ```
- `select id, public, allowed_mime_types, file_size_limit from storage.buckets where id = 'gallery';`가
  1행을 반환한다
- 마이그레이션 파일을 처음부터 다시 적용해도 같은 결과가 나온다 (재현성 — §제약 2번)

**검증 노트**: _(Task 완료 시 기록)_

---

### Task 3: 시드 스크립트

**Files:**
- Create: `scripts/seed.mjs`

**Interfaces:**
- Consumes: Task 1의 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SEED_OWNER_*`, Task 2의 스키마
- Consumes: `src/data/artists.json`, `src/data/metrics.json`, `public/gallery/*.jpg` (읽기 전용 원본)
- Produces: 실행 명령 `npm run seed`. 데모 계정(role 없음)과 오너 계정(`app_metadata: { role: "owner" }`) —
  Task 6·7의 검증이 이 두 계정을 쓴다

**왜**: design-v2.md §4.7의 6단계가 이 Task의 명세다. 7일 비활성 일시정지가 제약(§2 제약 2번)이라
**멱등성이 기능 요구사항이다** — 복구든 로컬 초기화든 한 명령이어야 한다. Task 4~7이 전부 실제 데이터를
필요로 하므로 읽기 전환보다 먼저 온다.

주의 (넷 다 놓치기 쉬움):

1. **`public/gallery/`와 `src/data/*.json`을 삭제하지 말 것.** DB로 옮겼으니 지워도 된다고 판단하기
   쉬우나 이 파일들이 시드의 원본이다 (§4.7 주의).
2. **`shows`를 A탭에 보이는 4개만 만들지 말 것.** 아티스트별 `stats.cities` 개수만큼 만들고, 기존
   `cities` 4개에만 `featured = true`를 준다. 티켓 현황 화면이 전체 목록을 나열하고 `stats.cities`가
   집계로 나와야 하기 때문이다 (§4.1).
3. **공연 날짜를 향후 6개월에 분포시킬 것.** 전부 가까운 날짜로 몰면 d-day가 금방 낡는다 (§4.7).
4. **생성은 결정론적이어야 한다.** 난수를 쓰면 실행할 때마다 데이터가 바뀌어 멱등성이 깨진다.
   slug 기반 고정 시드를 쓴다.

- [ ] **Step 1: 스크립트 골격** — `.env.local` 로드, service role 클라이언트 생성 (인라인. `admin.ts`를
      만들지 않는 이유는 위 "설계 문서에서 조정한 두 가지" 참조)
- [ ] **Step 2: `artists` upsert** — `artists.json`에서. 셰이더 파라미터 4개는 slug별 고정 매핑
      (§4.1의 default 값을 기준으로 아티스트마다 다르게)
- [ ] **Step 3: `tracks` upsert** — `artists.json`의 `tracks` 배열에서
- [ ] **Step 4: `shows` 생성** — 위 주의 2·3·4번 준수
- [ ] **Step 5: `ticket_sales` 14일치 스냅샷 생성** — 공연별 판매 추이가 단조 증가하도록
- [ ] **Step 6: 갤러리 36장 Storage 업로드 + `gallery_images` 행 삽입** — `created_by`는 **NULL**
      (시드 행은 방문자가 못 지운다 — §4.5). 라이선스 메타데이터는 `public/gallery/CREDITS.json` 참조
- [ ] **Step 7: 계정 2개 생성** — 데모(role 없음) / 오너(`app_metadata.role = "owner"`)
- [ ] **Step 8: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- `npm run seed`를 **두 번 연속 실행해도 모든 테이블의 행 수가 같다** (§11 완료 기준)
- `select count(*) from artists;` = 6
- `select artist_id, city_count, country_count from artist_metrics;`가 6행을 반환하고,
  `city_count`가 각 아티스트의 `stats.cities`와 일치한다
- `select * from artist_metrics where total_tickets_prev is null;`이 0행이다
  (14일 스냅샷이 있으므로 7일 전 값이 전부 존재해야 한다)
- Storage 버킷에 36개 객체가 있고 전부 `owner`가 NULL이다
- 데모 계정과 오너 계정으로 각각 로그인이 되고, 오너 JWT에만 `app_metadata.role = "owner"`가 있다

**검증 노트**: _(Task 완료 시 기록)_

---

### Task 4: 서버 클라이언트 + A탭 읽기 경로 전환

**Files:**
- Create: `src/lib/supabase/server.ts`
- Modify: `src/lib/data.ts` (전면 재작성 — 동기 3함수 → async 쿼리 모듈)
- Modify: `src/lib/types.ts` (DB 행 타입 / 화면용 뷰 타입 분리)
- Modify: `src/app/api/artists/route.ts` (async)
- Delete: `src/app/api/artists/route.test.ts`
- Modify: `src/app/artists/[slug]/page.tsx`, `src/app/staff/stage/page.tsx`,
  `src/app/staff/(console)/dashboard/page.tsx` (호출부에 `await` 추가)
- Modify: `next.config.ts` (`images.remotePatterns`)

**Interfaces:**
- Consumes: Task 1의 `SUPABASE_URL` / `SUPABASE_ANON_KEY`, Task 3의 시드 데이터
- Produces:
  - `createServerSupabase(): SupabaseClient` — 쿠키 어댑터가 붙은 서버 클라이언트.
    Task 5·6·7이 전부 이걸 쓴다. **앱에서 Supabase에 닿는 유일한 진입점이다**
  - `getArtists(): Promise<Artist[]>`
  - `getArtist(slug: string): Promise<Artist | undefined>`
  - `Artist` 타입은 `tracks` / `cities`(featured shows) / `gallery`를 포함해 1차와 같은 모양을 유지한다 —
    A탭 컴포넌트를 건드리지 않기 위해서다
- Produces: `/api/artists` 응답 계약은 **1차와 동일하다** — `?slug` 없으면 `{ artists }`,
  있으면 `{ artist }` 또는 404 `{ error: "not found" }`

**왜**: §4.8의 변경 파일 목록 중 읽기 경로 전부. 인증(Task 6)보다 먼저 오는 이유는 RLS `public read`
정책 덕분에 비로그인으로도 읽기가 동작하므로, 세션이라는 변수를 빼고 연결·클라이언트·RLS를 먼저
확인할 수 있기 때문이다. 갤러리 읽기와 `remotePatterns`도 여기 포함된다 — 아티스트 페이지가
`artist.gallery[]`를 렌더하므로 이게 빠지면 화면이 깨진다.

주의:

1. **`src/app/api/metrics/route.ts`는 이 Task에서 건드리지 않는다.** Task 5 몫이다. 그때까지
   `getMetrics`는 기존 JSON 경로로 `data.ts`에 남겨 두어 대시보드가 깨지지 않게 한다.
   즉 이 Task를 끝낸 시점에도 `data.ts`는 아직 `@/data/metrics.json`을 import한다 — 정상이며,
   Task 5에서 사라진다.
2. **§4.3의 프로토타입 체인 가드를 되살리지 말 것.** `Object.hasOwn` 가드와 `constructor`/`__proto__`
   테스트는 객체 인덱싱이 `.eq('slug', slug)` 쿼리로 바뀌면서 취약점 자체가 사라져 함께 없어진다.
   습관적으로 복원하면 의미 없는 분기가 남는다.
3. `route.test.ts` 삭제는 커버리지 후퇴가 아니다 — 핸들러가 "쿼리 → 응답" 두 줄로 얇아져 검증할
   로직이 남지 않는다. 로직은 Task 5의 `metricsView.ts`로 옮겨 가고 거기서 TDD된다 (§9.1).
4. **`src/lib/supabase/admin.ts`를 만들지 말 것** (위 "설계 문서에서 조정한 두 가지" 참조).

- [ ] **Step 1: `src/lib/supabase/server.ts` 작성** — `@supabase/ssr`의 `createServerClient` +
      Next 16 쿠키 어댑터
- [ ] **Step 2: `src/lib/types.ts` 재작성** — DB 행 타입과 화면용 뷰 타입 분리
- [ ] **Step 3: `src/lib/data.ts` 재작성** — `getArtists` / `getArtist`를 async 쿼리로.
      `tracks` · featured `shows` · `gallery_images`를 조인하고 Storage 공개 URL로 조립
- [ ] **Step 4: `/api/artists/route.ts` async 전환**, `route.test.ts` 삭제
- [ ] **Step 5: 호출부 3개 페이지에 `await` 추가**
- [ ] **Step 6: `next.config.ts`에 `images.remotePatterns` 추가** — Supabase Storage 호스트
- [ ] **Step 7: 시각 검증 (브라우저)** — **사람 확인 지점.** A탭 홈의 궤도에 아티스트 6명이 뜨는지,
      아티스트 페이지의 히어로·투어 궤도·디스코그래피·갤러리 36장이 전부 렌더되는지, 콘솔 에러가
      없는지 확인
- [ ] **Step 8: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- `grep -rn "artists.json" src/` 결과가 0건이다.
  `metrics.json` import는 아직 남아 있다 (위 주의 1번 — Task 5에서 없어진다)
- A탭 홈과 6명의 아티스트 페이지가 전부 DB·Storage에서 렌더된다 (시각 검증)
- 갤러리 이미지가 `next/image`로 로드된다 (`remotePatterns` 누락 시 여기서 터진다)
- `/api/artists`와 `/api/artists?slug=aurora`의 응답 모양이 1차와 같고, 없는 slug는 404다
- `npm test`가 통과한다 (남은 테스트 4개)
- `npm run build`가 통과한다

**검증 노트**: _(Task 완료 시 기록)_

---

### Task 5: 지표 매핑 (TDD) + B탭 대시보드 전환

**Files:**
- Create: `src/lib/metricsView.ts`
- Create: `src/lib/metricsView.test.ts`
- Modify: `src/lib/data.ts` (지표·다음 공연 쿼리 추가)
- Modify: `src/app/api/metrics/route.ts`
- Delete: `src/app/api/metrics/route.test.ts`
- Modify: `src/app/staff/(console)/dashboard/page.tsx`, `src/app/staff/stage/page.tsx`

**Interfaces:**
- Consumes: Task 4의 `createServerSupabase()`, Task 2의 뷰 `artist_metrics` · `show_status`
- Produces:
  - `toMetricsView(metrics: ArtistMetricsRow, nextShow: ShowStatusRow | null): Metrics` —
    **순수 함수. I/O 금지.** 현재 날짜는 인자로 받거나 주입 가능해야 한다 (테스트가 고정 날짜를 써야 하므로)
  - `getArtistMetrics(slug: string): Promise<ArtistMetricsRow | undefined>`
  - `getNextShow(slug: string): Promise<ShowStatusRow | null>`
- Produces: `/api/metrics` 응답 계약은 **1차와 동일하다** — 봉투 없는 `Metrics` 객체,
  `?slug` 기본값 `aurora`, 없는 slug는 404

**왜**: **이 계획에서 유일한 TDD 대상이다** (§9.1). 여기가 1차 부채 두 개를 구조적으로 해소하는
지점이기 때문이다 — `▲`/`▼` 화살표와 `positive` 불리언이 같은 계산에서 나오므로 어긋날 수 없고,
박제된 `dday` 정수가 날짜 계산으로 대체된다 (§4.3).

주의: **순수 함수로 유지할 것.** `new Date()`를 함수 안에서 호출하면 테스트가 오늘 날짜에 의존하게
되어 d-day 케이스를 고정할 수 없다. 시각은 인자로 받는다. 그리고 `total_tickets_prev`는 NULL일 수
있다 (§4.2 — 지난주에 없던 공연). 0으로 나누지 않도록 처리한다.

- [ ] **Step 1: 실패하는 테스트 작성** — §4.3 표의 **4개 케이스**:
      delta 양수/음수/0 · `total_tickets_prev`가 NULL · d-day 0일과 과거 날짜 · 예매율 반올림.
      각 케이스에 왜 존재하는지 한국어 주석 한 줄 (1차 관행)
- [ ] **Step 2: 테스트 실패 확인** — Run: `npm test`. Expected: FAIL (모듈 없음)
- [ ] **Step 3: `metricsView.ts` 최소 구현**
- [ ] **Step 4: 테스트 통과 확인** — Run: `npm test`. Expected: PASS
- [ ] **Step 5: `data.ts`에 `getArtistMetrics` · `getNextShow` 추가**
- [ ] **Step 6: `/api/metrics/route.ts`를 "쿼리 → 매핑 → 응답"으로 재작성**, `route.test.ts` 삭제
- [ ] **Step 7: 대시보드·무대 페이지 호출부 전환**
- [ ] **Step 8: 시각 검증 (브라우저)** — **사람 확인 지점.** 대시보드 지표 카드 3개와 도시별 예매
      막대 차트가 1차와 같은 모양으로 뜨는지, 아티스트를 바꿔도 수치가 따라오는지 확인
- [ ] **Step 9: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- §4.3 표의 4개 테스트 케이스가 전부 통과한다
- **`grep -rn "@/data/" src/` 결과가 0건이다** — Task 4에서 남겨 둔 `metrics.json` import까지
  여기서 사라진다. `src/data/*.json`은 파일로는 남되 앱 코드가 읽지 않는다 (§11 완료 기준)
- `metricsView.ts`에 `new Date()` 직접 호출과 Supabase import가 없다 (순수성)
- **대시보드 d-day가 오늘 날짜 기준으로 계산된다** — 시스템 날짜를 하루 넘겨 확인 (§11 완료 기준)
- delta 문자열의 화살표 방향과 `positive` 플래그가 항상 일치한다 (테스트가 강제)
- `npm test` · `npm run build` 통과

**검증 노트**: _(Task 완료 시 기록)_

---

### Task 6: 인증 전환

**Files:**
- Modify: `src/lib/auth.ts` (`validateCredentials` · `STAFF_COOKIE` 삭제)
- Modify: `src/lib/auth.test.ts` (`validateCredentials` 테스트 제거, `staffRedirectPath` 테스트 유지)
- Modify: `src/proxy.ts` (세션 갱신 + `getUser()` 가드)
- Modify: `src/app/api/login/route.ts`
- Delete: `src/app/api/login/route.test.ts`
- Create: `src/app/api/logout/route.ts`
- Modify: `src/app/staff/login/page.tsx` (아이디 → 이메일, 데모 계정 안내 갱신)

**Interfaces:**
- Consumes: Task 3의 데모·오너 계정, Task 4의 `createServerSupabase()`
- Produces: `POST /api/login` body `{ email, password }` → 200 `{ ok: true }` + 세션 쿠키 /
  401 `{ ok: false }`
- Produces: `POST /api/logout` → 200, 세션 쿠키 제거
- Produces: 세션의 `app_metadata.role` 클레임 — Task 7과 7장이 이걸 읽는다
- 유지: `staffRedirectPath(pathname, hasAuth): string | null` — 순수 함수, 시그니처 변경 없음

**왜**: §4.4가 명세다. 시드가 만든 계정이 있어야 검증이 되므로 Task 3 이후, 세션 uid가 필요한
업로드(Task 7) 이전에 온다.

주의 (§4.4의 세 가지를 그대로 옮긴다 — 전부 놓치기 쉬움):

1. **파일명은 `src/proxy.ts`이며 `middleware.ts`가 아니다.** `@supabase/ssr` 문서 예제를 그대로
   붙여넣으면 파일이 하나 더 생기고 가드가 이중으로 돈다. 내용만 가져오고 export 이름 `proxy`를 유지한다.
2. **`proxy.ts`에서 `getSession()`이 아니라 `getUser()`를 쓴다.** 전자는 쿠키를 그대로 신뢰하고
   서명을 검증하지 않아 가드로 쓸 수 없다.
3. **로그인 성공 후의 `window.location.href` 전체 네비게이션을 그대로 둔다.** App Router 클라이언트
   캐시에 로그인 전 리다이렉트가 남아 `router.push`가 로그인 화면으로 되돌아오는 문제의 우회책이고,
   인증 방식과 무관하다. "Supabase로 바꿨으니 되돌려도 되겠다"는 판단은 틀렸다.

추가 주의: `staffRedirectPath`는 순수 함수라 **테스트를 지우지 말 것.** 인증 방식이 바뀌어도 리다이렉트
규칙은 그대로다. 반면 `login/route.test.ts`는 `staff_auth=ok` 쿠키를 단언하므로 함께 사라진다.

- [ ] **Step 1: `src/lib/auth.ts` 축소** — `staffRedirectPath`만 남긴다
- [ ] **Step 2: `src/lib/auth.test.ts` 정리** — `validateCredentials` 테스트 제거, 나머지 유지
- [ ] **Step 3: 테스트 통과 확인** — Run: `npm test`. Expected: PASS
- [ ] **Step 4: `/api/login/route.ts` 재작성** — `signInWithPassword`, `route.test.ts` 삭제
- [ ] **Step 5: `/api/logout/route.ts` 신규 작성**
- [ ] **Step 6: `src/proxy.ts` 재작성** — 세션 갱신 + `getUser()` 가드. matcher `/staff/:path*` 유지
- [ ] **Step 7: 로그인 페이지 수정** — 이메일 필드, 데모 계정 안내 문구
- [ ] **Step 8: 시각 검증 (브라우저)** — **사람 확인 지점.** 1차와 같은 4개 시나리오 + 로그아웃:
      ① 미로그인으로 `/staff/dashboard` 접근 시 로그인으로 차단 ② 오답 입력 시 인라인 에러
      ③ 로그인 성공 시 대시보드 이동 ④ 로그인 상태로 `/staff/login` 재방문 시 대시보드로
      ⑤ 로그아웃 후 ①로 되돌아감
- [ ] **Step 9: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- 위 5개 시나리오가 전부 동작한다 (시각 검증, 스크린샷·콘솔 로그로 확인)
- `grep -rn "validateCredentials\|STAFF_COOKIE\|staff_auth" src/` 결과가 0건이다
- `grep -rn "getSession()" src/proxy.ts` 결과가 0건이다
- `src/middleware.ts`가 생기지 않았다
- 브라우저 새로고침 후에도 세션이 유지된다 (쿠키 갱신이 동작한다)
- `npm test` · `npm run build` 통과

**검증 노트**: _(Task 완료 시 기록)_

---

### Task 7: 갤러리 업로드 · 삭제

**Files:**
- Create: `src/app/api/gallery/upload-url/route.ts`
- Create: `src/app/api/gallery/route.ts` (POST)
- Create: `src/app/api/gallery/[id]/route.ts` (DELETE)
- Modify: `src/app/staff/(console)/artists/page.tsx` (stub → 갤러리 관리 섹션)
- Modify: `src/lib/data.ts` (갤러리 목록 조회 추가)

**Interfaces:**
- Consumes: Task 6의 세션(`auth.uid()`), Task 2의 버킷과 Storage 정책
- Produces:
  - `POST /api/gallery/upload-url` body `{ artistSlug, filename, contentType, size }` →
    `{ signedUrl, path }` / 401 / 415(허용되지 않는 타입)
  - `POST /api/gallery` body `{ artistSlug, path, creator, license, origin }` → 201 `{ id }`
  - `DELETE /api/gallery/[id]` → 204 / 401 / 403(RLS가 막은 경우)

**왜**: §4.6이 명세다. 3단계로 나누는 이유는 Vercel 서버리스의 4.5MB 요청 바디 제한을 피하면서도
브라우저에 Supabase 키를 내보내지 않기 위해서다 — 서명 URL은 단일 목적이라 키가 아니다.

**화면 위치에 대한 판단**: §4.6이 어느 화면에 붙는지 적지 않았다. §7이 갤러리 관리를
`/staff/artists`에 두기로 했으므로 그 화면의 **갤러리 섹션만** 이번에 만든다. 아티스트·트랙 편집은
7장에 그대로 남긴다. 임시 화면을 따로 만들어 나중에 버리는 중복을 피한다.

주의:

1. **`DELETE`에서 소유자를 서버 코드로 다시 확인하지 말 것.** RLS가 소유 검사를 한다 (§4.6).
   이중 검사는 정책과 코드가 어긋날 여지만 만든다.
2. **파일 타입·크기 검사를 API 라우트에만 두지 말 것.** 진짜 신뢰 경계는 버킷 설정이고 라우트 검사는
   사용자에게 빨리 알려주기 위한 것이다. **둘 다 둔다** (§4.5 말미).
3. **이미지 리사이즈·썸네일 생성을 넣지 말 것** (§10 범위 밖). 업로드된 원본을 그대로 쓴다.
4. `created_by`는 서버가 세션 uid로 채운다. 클라이언트가 보낸 값을 신뢰하지 않는다.

- [ ] **Step 1: `/api/gallery/upload-url` 작성** — 인증 확인 → 타입·크기 검사 → 경로 생성 → 서명
- [ ] **Step 2: `/api/gallery` POST 작성** — `created_by = 세션 uid`
- [ ] **Step 3: `/api/gallery/[id]` DELETE 작성**
- [ ] **Step 4: `data.ts`에 갤러리 목록 조회 추가**
- [ ] **Step 5: `/staff/artists` 갤러리 섹션 구현** — 아티스트별 목록 + 업로드 + 삭제.
      B탭 라이트 팔레트 유지
- [ ] **Step 6: 시각 검증 (브라우저)** — **사람 확인 지점.** 데모 계정으로 ① 업로드 → A탭 갤러리에
      반영 ② 방금 올린 것 삭제 성공 ③ **시드 이미지 삭제 시도 → 차단** ④ 허용되지 않는 파일 타입
      거부 ⑤ 미로그인 상태로 API 직접 호출 시 401
- [ ] **Step 7: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- 위 5개 시나리오가 전부 동작한다 (§11 완료 기준의 업로드·RLS 항목)
- **데모 계정으로 시드 갤러리 이미지 삭제를 시도하면 RLS에 막힌다** — 화면뿐 아니라 API를 직접
  호출해도 막혀야 한다
- 업로드된 파일이 4.5MB를 넘어도 성공한다 (서명 URL이 서버를 우회하는지 확인)
- `grep -rn "SERVICE_ROLE" src/` 결과가 0건이다 (§4.5 — 런타임 경로에서 service role 금지)
- `npm test` · `npm run build` 통과

**검증 노트**: _(Task 완료 시 기록)_

---

### Task 8: 완료 기준 검증 · 문서 갱신

**Files:**
- Modify: `README.md` (데모 계정, 기술 스택, 2차 로드맵 진행 상황)
- Modify: `docs/design-v2.md` (11장 4장 체크박스)
- Modify: `docs/plan-v2.md` (Task 1~7 검증 노트 최종 확인)

**Interfaces:**
- Consumes: Task 1~7 전부

**왜**: §11의 4장 완료 기준 10개를 한자리에서 확인하는 게이트다. 개별 Task에서 부분적으로 확인한
항목이라도 **배포된 환경에서 다시 확인한다** — 로컬에서 통과하고 Vercel에서 깨지는 항목(환경변수
누락, `remotePatterns`)이 여기서 걸린다.

주의: **README의 데모 계정 안내를 반드시 갱신할 것.** 1차의 `admin / 1234`가 그대로 남아 있으면
방문자가 로그인하지 못한다. 오너 계정 비밀번호는 공개하지 않는다.

- [ ] **Step 1: Vercel 환경변수 등록** — `SUPABASE_URL` · `SUPABASE_ANON_KEY`만.
      **`SUPABASE_SERVICE_ROLE_KEY`는 등록하지 않는다** (§4.7 — 시드 전용)
- [ ] **Step 2: 배포 후 §11 완료 기준 10개 확인** — 배포 URL에서
- [ ] **Step 3: `npm run seed` 재현성 최종 확인** — 원격에 두 번 실행 후 행 수 비교
- [ ] **Step 4: README 갱신** — 데모 계정, 기술 스택에 Supabase 추가, 2차 로드맵 1번 완료 표시
- [ ] **Step 5: `docs/design-v2.md` 11장 4장 체크박스 채우기**
- [ ] **Step 6: 검증 노트 최종 확인** — Task 1~7이 전부 채워져 있는지
- [ ] **Step 7: 보고 후 멈춘다** — PR 생성은 `finishing-a-development-branch`로

**완료조건:**
- §11 "4장 · Supabase 전환" 체크박스 **10개 전부** 확인 완료
- 배포 URL에서 A탭 전체 플로우와 B탭 로그인 → 대시보드 → 무대 씬이 1차와 동일하게 동작한다
- README의 데모 계정으로 실제 로그인이 된다
- `docs/plan-v2.md`의 Task 1~7 검증 노트가 전부 채워져 있다
- react-doctor CI 통과 (error 레벨 0) + `npm test` CI 통과

**검증 노트**: _(Task 완료 시 기록)_

---

## 계획 검증 노트 (Self-Review)

계획을 쓴 뒤 design-v2.md 4장과 대조하며 확인한 것들.

**스펙 커버리지** — 4.1~4.8 전 절이 Task에 매핑된다: §4.1·4.2·4.5 → Task 2, §4.3 → Task 5,
§4.4 → Task 6, §4.6 → Task 7, §4.7 → Task 1·3, §4.8 → Task 4·5·6·7에 분산. §11 완료 기준
10개는 Task 8에서 한 번 더 모아 확인한다.

**설계 문서의 빈 곳 두 개를 발견해 해소했다.** `src/lib/supabase/admin.ts`는 §4.8 목록에 있지만
§4.5의 "service role은 시드 전용" 제약과 시드가 `.mjs`라는 사실이 겹쳐 호출부가 없는 죽은 코드가
된다 — 만들지 않기로 하고 Task 4 주의에 못 박았다. 업로드 UI의 호스트 화면은 §4.6이 정하지 않아
§11 완료 기준을 채울 수 없었다 — §7이 갤러리 관리를 `/staff/artists`에 두기로 했으므로 그 화면의
갤러리 섹션만 Task 7에서 만들고 나머지는 7장에 남긴다.

**Task 경계의 판단** — 스키마·RLS·뷰를 Task 2 하나로 묶었다. 쪼개면 테이블은 있는데 RLS가 없는
창이 생기고 그 상태로 시드가 돌 수 있는데, RLS 누락은 에러 없이 조용히 통과하는 종류의 실패라
그 창을 만들지 않는 편이 낫다. 반대로 읽기(Task 4)와 인증(Task 6)은 분리했다 — RLS `public read`
덕분에 읽기는 비로그인으로 검증되므로, 세션이라는 변수를 빼고 연결을 먼저 확인할 수 있다.

**모순 하나를 잡았다** — Task 4의 완료조건에 `@/data/` import 0건을 넣어 뒀는데, 같은 Task의 주의
1번은 `getMetrics`를 JSON 경로로 남겨 두라고 한다. 둘은 동시에 성립할 수 없다. Task 4는
`artists.json`만 확인하고, `@/data/` 전체 0건은 `getMetrics`가 실제로 DB로 넘어가는 Task 5의
완료조건으로 옮겼다.

**타입 일관성** — `createServerSupabase()`(Task 4)가 Task 5·6·7에서 같은 이름으로 쓰인다.
`toMetricsView(metrics, nextShow)`의 인자 타입 `ArtistMetricsRow`·`ShowStatusRow`는 Task 2의
뷰 이름과 대응한다. `/api/artists`와 `/api/metrics`의 응답 계약은 1차와 동일하게 유지해
A탭·B탭 컴포넌트를 건드리지 않는다.

**테스트 3개가 사라지는 것에 대해** — `artists`·`metrics`·`login`의 route.test.ts를 지운다.
커버리지 후퇴로 보이지만, 핸들러가 얇아져 검증할 로직이 남지 않고 그 로직은 `metricsView.ts`로
옮겨 가 거기서 TDD된다. 프로토타입 체인 가드 테스트는 취약점 자체가 사라져 자연 소멸한다.
남는 테스트는 `stageState` · `auth`(`staffRedirectPath`) · `metricsView` 셋이다.
