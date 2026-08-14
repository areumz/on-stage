# ON-STAGE 2차 구현 계획 2.1 — Supabase 전환 (Implementation Plan v2.1)

> 2차 고도화는 항목마다 별도 계획 문서를 갖는다. 번호는 [`docs/design-v2.md`](./design-v2.md) 3장의
> 시퀀싱(2.1~2.5)을 따른다. 이 문서는 **2.1 Supabase 전환**만 다룬다.

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

supabase/migrations/<타임스탬프>_init.sql  # 신규 — 테이블 + RLS + 뷰 + 버킷 (CLI가 이름을 정한다)
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
- Modify: `.gitignore` (`!.env.example` 예외 추가 — 아래 Step 3)
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

- [x] **Step 1: Supabase 프로젝트 생성** — 무료 티어, 리전은 지연이 가장 낮은 곳. **사람이 직접 한다**
      (대시보드 로그인 필요). 생성 후 URL·anon key·service role key를 확보한다
- [x] **Step 2: 의존성 설치** — 위 세 개
- [x] **Step 3: `.env.example` 작성 + `.gitignore`에 `!.env.example` 예외 추가** — §4.7 표의 5개 키,
      각각 용도 주석 한 줄. **`.gitignore`의 `.env*` 패턴은 `.env.local`뿐 아니라 `.env.example`까지
      잡는다.** 키 이름과 용도를 담은 문서용 파일이라 커밋돼야 하므로 `!.env.example` 부정 패턴이
      반드시 필요하다 (`.env*` 다음 줄에 둘 것 — gitignore는 나중 규칙이 이긴다)
- [x] **Step 4: `.env.local` 작성** — Step 1에서 받은 실제 값
- [x] **Step 5: `package.json`에 `seed` 스크립트 추가** —
      `node --env-file=.env.local scripts/seed.mjs`. **`dotenv`를 추가하지 않는다** — Node 22의
      `--env-file` 플래그로 충분하고, 의존성은 §주의의 세 개로 끝이다
- [x] **Step 6: `.github/workflows/test.yml` 작성** — `push`/`pull_request`에서 Node 22로
      `npm ci && npm test`. react-doctor 워크플로와 별도 파일로 둔다 (목적과 트리거가 다르다)
- [x] **Step 7: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- `npx supabase --version`이 동작한다
- `.env.local`에 5개 키가 모두 있고, `.env.example`에는 값이 비어 있다
- **키 정의** 중 `NEXT_PUBLIC_` 접두사가 0건이다. 파일 전체를 grep하면 "이 프로젝트는 `NEXT_PUBLIC_`을
  쓰지 않는다"는 **주석 설명까지 잡혀 오탐이 난다.** 주석을 제외하고 셀 것:
  ```bash
  grep -v '^[[:space:]]*#' .env.example | grep -c "NEXT_PUBLIC_"   # 0이어야 한다
  ```
- `npm test`가 로컬에서 통과한다 (기존 5개 테스트 파일)
- **`git status --porcelain -uall`에 `.env.example`은 나타나고 `.env.local`은 나타나지 않는다.**
  `git check-ignore -v`로 확인하지 말 것 — 부정 패턴(`!`)이 매칭돼도 종료 코드 0에 패턴 이름을
  출력해서, 예외를 제대로 넣은 뒤에도 "여전히 무시됨"처럼 보인다. `git add --dry-run`도 함께 쓰면
  확실하다 (`.env.local`에 대해서만 거부 메시지가 나와야 한다)

**검증 노트**:
- `npx supabase --version` → `2.114.0`
- `.env.local` 5개 키 전부 값 있음. `SUPABASE_URL`·`SUPABASE_ANON_KEY`·`SUPABASE_SERVICE_ROLE_KEY`는
  사용자가 이미 만들어 둔 프로젝트(`htmfbhgjxgxbhuujfvwm`)에서 받은 실값. **`SEED_OWNER_EMAIL`/
  `SEED_OWNER_PASSWORD`는 자리표시자**(`owner@onstage.local` / `changeme-task3`) — 사용자가 Task 3에서
  직접 정하기로 함. Task 3 시작 전에 실제 값으로 교체 필요
- `.env.example` 5개 키 모두 값 비어 있음, 용도 주석 각 1줄
- `grep -v '^[[:space:]]*#' .env.example | grep -c "NEXT_PUBLIC_"` → `0`
- `npm test` → 5 files, 25 tests 전부 pass
- `git status --porcelain -uall`: `.env.example` `??`로 나타남, `.env.local` 안 나타남.
  `git add --dry-run .env.local` → ignored 거부, `git add --dry-run .env.example` → add 성공
- 의존성 정확히 3개만 추가됨: `@supabase/supabase-js` `@supabase/ssr`(runtime),
  `supabase`(devDependency, CLI). ORM·검증·상태관리 라이브러리 없음
- `npm audit`에 high severity 7건 있으나 전부 `brace-expansion`·`fast-uri`·`js-yaml`·`nanoid`·
  `postcss`·`sharp` 등 **기존 의존성 체인에서 온 것** (Supabase 패키지와 무관, 범위 밖이라 손대지 않음)

---

### Task 2: 마이그레이션 — 테이블 · RLS · 뷰 · 버킷

**Files:**
- Create: `supabase/migrations/<타임스탬프>_init.sql` (파일명은 CLI가 정한다 — Step 1 참조)
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

- [x] **Step 1: `npx supabase init` 실행** 후 원격 프로젝트에 `link`.
      마이그레이션 파일은 손으로 만들지 말고 **`npx supabase migration new init`으로 생성할 것** —
      CLI는 `<타임스탬프>_init.sql` 형식을 쓰므로 `20260812114804_init.sql` 같은 모양이 된다.
      design-v2.md §4.8은 `0001_init.sql`로 적고 있으나 CLI 규칙을 따른다
- [x] **Step 2: 그 마이그레이션 파일에 테이블 6개 작성** — §4.1 DDL 그대로. 컬럼 주석도 함께 옮긴다
      (`stat_tracks`가 왜 남는지 등의 판단 근거가 주석에 있다)
- [x] **Step 3: 같은 파일에 RLS 활성화 6줄 + 정책 작성** — §4.5 SQL 그대로. 역할 스코프(`artists`
      `tracks` `shows`) / 소유 스코프(`gallery_images` `stage_presets`) / 읽기 전용(`ticket_sales`)의
      구분을 지킬 것
- [x] **Step 4: 같은 파일에 뷰 2개 작성** — §4.2 SQL 그대로. `security_invoker` 확인
- [x] **Step 5: 같은 파일에 Storage 버킷 `gallery` 생성** — public read, `allowed_mime_types`는
      `image/jpeg` `image/png` `image/webp`, `file_size_limit` 지정 (§4.5 말미)
- [x] **Step 6: 같은 파일에 Storage 정책 3개 작성** — §4.5 SQL 그대로
- [x] **Step 7: `npx supabase db push`로 적용**
- [x] **Step 8: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

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
  1행을 반환한다. `file_size_limit`은 **4.5MB보다 커야 한다** — Task 7이 "서명 URL이 Vercel의
  4.5MB 바디 제한을 우회한다"를 그보다 큰 파일로 증명하기 때문이다
- **`gallery_images.storage_path`에 unique 제약이 걸려 있다** (Task 3의 결정 1). 이게 없으면
  시드 upsert가 성립하지 않는다:
  ```sql
  select conname from pg_constraint
  where conrelid = 'gallery_images'::regclass and contype = 'u';
  ```
- 마이그레이션 파일을 처음부터 다시 적용해도 같은 결과가 나온다 (재현성 — §제약 2번)

**검증 노트**:
- `npx supabase migration list --linked` → local `20260813120014` = remote `20260813120014` (적용 확인).
  `db push` 완료 메시지 뒤에 뜬 "failed to cache migrations catalog... Docker" 경고는 로컬 diff용
  pg-delta 캐시 생성 실패일 뿐, 원격 마이그레이션 적용과는 무관해 무시함 (Docker 미설치 환경)
- `select relname, relrowsecurity from pg_class where relname in (...)` → 6개 테이블 전부 `relrowsecurity: true`
- `select c.relname, c.reloptions from pg_class c where c.relname in ('show_status','artist_metrics')` →
  둘 다 `security_invoker=true`
- `select id, public, allowed_mime_types, file_size_limit from storage.buckets where id = 'gallery'` →
  1행, `public: true`, `allowed_mime_types: [image/jpeg, image/png, image/webp]`,
  `file_size_limit: 10485760` (10MB, 4.5MB 기준 충족)
- `select conname from pg_constraint where conrelid = 'gallery_images'::regclass and contype = 'u'` →
  `gallery_images_storage_path_key` 존재
- **재현성은 "빈 원격 프로젝트에 최초 적용"으로 갈음함.** design-v2.md §4.7이 원격 프로젝트를
  1개(dev = prod)로 고정했고 로컬 Docker도 없어, `supabase db reset`으로 별도 환경에 재적용해
  비교할 방법이 없었다. 대신 이번 `db push` 자체가 테이블·뷰·정책이 하나도 없던 빈 프로젝트에
  전체 스키마를 처음부터 적용해 에러 없이 성공한 것이므로 "처음부터 적용" 조건은 이미 충족됨.
  이후 진짜 반복 재현성이 필요해지면(예: 스키마 변경 마이그레이션 추가 시) 그때 로컬 Docker 환경을
  들여 `db diff`/`db reset`으로 검증하는 게 맞다

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

#### 멱등성 — "전부 upsert"가 아니다

완료조건이 "두 번 연속 실행해도 행 수가 같다"이고, 이건 단순한 체크박스가 아니라 **제약 2번(7일 비활성
일시정지 복구)이 걸린 기능 요구사항이다.** 스크립트가 중간에 죽으면 "한 명령으로 재현 가능"이라는 전제
자체가 거짓이 된다.

그런데 6단계 중 **테이블 upsert로 해결되는 건 4단계뿐이다.** 나머지 두 단계는 upsert가 아닌 API를
쓰므로 각각 따로 멱등하게 만들어야 한다.

| 단계 | 대상 | 손대지 않으면 두 번째 실행에서 | 필요한 처리 |
|---|---|---|---|
| 2·3 | `artists` `tracks` | 안전 | upsert (유니크 키가 이미 있다 — §4.1) |
| 4·5 | `shows` `ticket_sales` | **날짜가 바뀌어 갱신이 아닌 새 행이 됨** | 삭제 후 재삽입 (아래 결정 2) |
| 6 (파일) | Storage 객체 | **409 "resource already exists"로 실패** | `upload(..., { upsert: true })` |
| 6 (행) | `gallery_images` | **충돌 대상이 없어 36행이 매번 추가됨** | `storage_path` 기준 upsert (아래 결정 1) |
| 7 | `auth.users` | **"User already registered"로 실패 → 스크립트 중단** | 존재 확인 후 생성/갱신 |

**계정 생성이 가장 위험하다.** 테이블 쓰기가 아니라 Auth Admin API 호출이라 upsert 개념이 없고,
같은 이메일로 두 번째 실행하면 에러가 나면서 거기서 스크립트가 죽는다. 마지막 단계라 앞 단계는
이미 반영된 뒤지만, 종료 코드가 실패로 떨어지므로 "시드가 성공했다"고 볼 수 없다.

> 구현 시 확인: supabase-js v2의 admin 클라이언트에는 `getUserById`는 있지만 **`getUserByEmail`은
> 없다.** 이메일로 찾으려면 `listUsers()` 결과에서 걸러야 한다(계정이 둘뿐이라 비용은 무시 가능).
> API 표면은 구현 시점에 한 번 더 확인할 것.

#### 결정된 것 두 가지 (설계 검토에서 확정)

**결정 1 — `gallery_images.storage_path`에 `unique`를 건다.** 원래 이 테이블의 유일한 키는 생성된
`id`뿐이라 upsert 충돌 기준을 줄 수 없었고, 실행할 때마다 36행이 쌓였다. 시드가 쓰는 나머지 네 테이블은
전부 자연 유니크 키를 갖고 있는데(`artists.slug`, `tracks(artist_id, no)`,
`shows(artist_id, city_code, show_date)`, `ticket_sales(show_id, recorded_on)`) 여기만 없었다.

시드 편의를 위한 우회가 아니라 데이터 모델링이 맞아지는 쪽이라 채택했다 — 하나의 Storage 객체를
두 행이 가리키는 상태는 어떤 경로로 생기든 버그다. Task 7의 삭제(행 → 객체)가 1:1이라는 것도
이 제약이 보장한다. **design-v2.md §4.1에 반영 완료.**

**결정 2 — `shows`는 upsert가 아니라 삭제 후 재삽입한다.** 주의 3번("향후 6개월 분포")과
4번("결정론적")이 충돌하는 지점이었다. 실행 시각 기준으로 날짜를 만들면 며칠 뒤 두 번째 실행에서
`show_date`가 달라지는데, 그게 유니크 키의 일부라 **갱신이 아니라 새 행이 된다.** 반대로 고정 날짜
상수를 쓰면 멱등하지만 시간이 지나 전 공연이 과거가 되고 d-day가 죽는다(Task 5 완료조건
"d-day가 오늘 날짜 기준으로 계산된다"가 무의미해진다).

유니크 키를 `(artist_id, city_code)`로 바꿔 날짜를 갱신 대상으로 만드는 안도 있었으나, 같은 도시
다회차 공연을 표현할 수 없게 되어 기각했다. 고정 앵커 상수는 포트폴리오가 방치되기 쉬운 성격상
d-day가 조용히 죽을 위험이 커서 기각했다.

**대가는 명확히 해 둔다: 시드는 `shows`·`ticket_sales`에 한해 파괴적이다.** 지금은 이 두 테이블의
유일한 작성자가 시드라 문제가 없지만, 로드맵 4번에서 `/staff/tours` 편집 UI가 생기면 재시드가
사용자가 추가한 공연을 지우게 된다. **그때 재검토할 항목이다.** `ticket_sales`는 FK cascade로 함께
지워지므로 별도 삭제 코드가 필요 없다. **design-v2.md §4.7에 반영 완료.**

- [x] **Step 1: 스크립트 골격** — `.env.local` 로드, service role 클라이언트 생성 (인라인. `admin.ts`를
      만들지 않는 이유는 위 "설계 문서에서 조정한 두 가지" 참조)
- [x] **Step 2: `artists` upsert** — `artists.json`에서. 셰이더 파라미터 4개는 slug별 고정 매핑
      (§4.1의 default 값을 기준으로 아티스트마다 다르게)
- [x] **Step 3: `tracks` upsert** — `artists.json`의 `tracks` 배열에서
- [x] **Step 4: `shows` 삭제 후 재생성** — 해당 아티스트의 기존 `shows`를 먼저 지운다
      (`ticket_sales`는 FK cascade로 함께 사라지므로 별도 삭제 코드가 필요 없다). 그 다음
      위 주의 2·3·4번을 지켜 재삽입. **upsert가 아닌 이유는 결정 2 참조**
- [x] **Step 5: `ticket_sales` 14일치 스냅샷 생성** — 공연별 판매 추이가 단조 증가하도록.
      Step 4에서 cascade로 비워진 뒤라 삽입만 하면 된다
- [x] **Step 6: 갤러리 36장 Storage 업로드 + `gallery_images` 행 upsert** — `created_by`는 **NULL**
      (시드 행은 방문자가 못 지운다 — §4.5). 라이선스 메타데이터는 `public/gallery/CREDITS.json` 참조.
      **업로드는 `{ upsert: true }`로 할 것** — 기본값이면 두 번째 실행에서 409로 실패한다.
      행 삽입은 `storage_path` 충돌 기준 upsert (결정 1이 이 컬럼에 `unique`를 걸어 뒀다)
- [x] **Step 7: 계정 2개를 멱등하게 생성** — 데모(role 없음) / 오너(`app_metadata.role = "owner"`).
      **`createUser`를 그냥 호출하면 두 번째 실행에서 죽는다.** `listUsers()`로 이메일 존재 여부를
      먼저 확인해, 없으면 `createUser`, 있으면 `updateUserById`로 `app_metadata`와 비밀번호를 맞춘다.
      갱신까지 하는 이유는 시드를 계정 속성의 단일 진실 공급원으로 두기 위해서다 — 오너의
      `role` 클레임이 어긋나면 역할 스코프 RLS(§4.5)가 조용히 실패한다.
      시드는 두 계정의 uid를 어디에도 쓰지 않으므로(갤러리 시드 행은 `created_by = NULL`)
      반환된 uid를 저장할 필요는 없다
- [x] **Step 8: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- `npm run seed`를 **두 번 연속 실행해도 모든 테이블의 행 수가 같다** (§11 완료 기준)
- **두 번째 실행이 종료 코드 0으로 끝난다.** 행 수만 보면 스크립트가 중간에 죽은 것을 놓친다 —
  계정 생성이 마지막 단계라 앞 단계는 이미 반영된 뒤이기 때문이다. `npm run seed && echo OK`로 확인
- **세 번째 실행도 마찬가지다.** 두 번은 통과하고 세 번째에 깨지는 경우는 없어야 한다
- `select count(*) from gallery_images;` = 36 (2회 실행 후에도)
- Storage `gallery` 버킷의 객체 수 = 36 (2회 실행 후에도)
- `select count(*) from artists;` = 6
- `select artist_id, city_count, country_count from artist_metrics;`가 6행을 반환하고,
  `city_count`가 각 아티스트의 `stats.cities`와 일치한다
- `select * from artist_metrics where total_tickets_prev is null;`이 0행이다
  (14일 스냅샷이 있으므로 7일 전 값이 전부 존재해야 한다)
- Storage 버킷에 36개 객체가 있고 전부 `owner`가 NULL이다
- 데모 계정과 오너 계정으로 각각 로그인이 되고, 오너 JWT에만 `app_metadata.role = "owner"`가 있다

**검증 노트**:
- `npm run seed`를 3회 연속 실행. 매회 `artists: 6행`, 아티스트별 공연 수(aurora 24 / velvet 8 /
  nova 6 / halo 4 / lumen 5 / echo 2), 갤러리 6장 upload 로그가 동일하게 찍힘. 2·3회차부터
  계정 로그가 "생성"에서 "갱신"으로 바뀜 (기대한 동작). `npm run seed && echo OK`로 세 번 모두
  종료 코드 0 확인
- `select count(*) from gallery_images;` → `36`
- `select count(*) from storage.objects where bucket_id = 'gallery';` → `36`,
  `count(*) filter (where owner is null)` → `36` (전부 NULL)
- `select count(*) from artists;` → `6`
- `artist_metrics` 6행, `city_count`가 6개 아티스트 전부 `stats.cities`와 일치
  (aurora 24 / velvet 8 / nova 6 / halo 4 / lumen 5 / echo 2).
  `country_count`는 완료조건에 없어 참고용으로만 확인 (17/7/6/2/2/1 — 그럴듯한 분포)
- `select * from artist_metrics where total_tickets_prev is null;` → 0행
- 데모 계정(`demo@onstage.local` / `demo1234`)·오너 계정(`SEED_OWNER_EMAIL`/`SEED_OWNER_PASSWORD`)
  둘 다 `/auth/v1/token?grant_type=password`로 로그인 성공. JWT 디코드 결과 데모는
  `app_metadata`에 `role` 키 자체가 없고, 오너만 `role: "owner"` 확인

**설계 문서 대비 조정 두 가지 (구현 중 결정)**:
1. **라이선스 메타데이터는 `CREDITS.json` 대신 `artists.json`의 `gallery[]`를 그대로 썼다.**
   두 파일 내용이 동일(같은 creator/license/origin)하고 `artists.json`은 이미 Step 2·3에서
   읽어 아티스트별로 그룹돼 있어, 파일을 하나 더 열어 파일명으로 다시 조인할 필요가 없었다.
   `CREDITS.json`은 손대지 않고 그대로 남겨둠 (원본 삭제 금지 원칙과 별개로, 애초에 안 건드림)
2. **`artists.json`의 `cities[].date`는 쓰지 않았다.** design-v2.md §4.7이 "공연 날짜는 실행 시각
   기준 향후 6개월에 분포"라고 명시했으므로, 4개 featured 도시도 코드/이름만 가져오고 날짜는
   시드 실행 시각 기준으로 새로 생성했다. `stats.cities`가 4보다 큰 아티스트(aurora 24 등)를 위한
   추가 도시는 `EXTRA_CITY_POOL`(30개, 기존 13개 코드와 안 겹침)에서 slug 해시 오프셋으로
   결정론적으로 골랐다

**인프라 블로커 하나 (해결됨)**: 첫 실행 시도에서 `PGRST002`(Data API가 스키마 캐시를 못 읽음, 503)로
계속 실패. Management API·Storage API는 정상이라 프로젝트 자체는 건강했는데, 알고 보니 대시보드에서
**Project Settings → Data API가 꺼져 있었다.** 사용자가 토글을 켠 뒤 정상화됨. 이 프로젝트를 나중에
재생성하거나 새 환경으로 옮길 때 다시 겪을 수 있는 체크포인트라 기록해 둔다.

**수정 이력 — Task 6 이후 대시보드를 보다가 발견된 시드 데이터 품질 버그 세 건 (2026-08-15)**

사용자가 대시보드에서 "모든 아티스트가 항상 증가만 뜬다", "다음 공연 venue가 전부 서울 아레나"를
관찰해 재조사했고, 조사 과정에서 dday 계산의 타임존 버그까지 추가로 발견했다. 셋 다
`scripts/seed.mjs`(및 하나는 `src/lib/metricsView.ts`)를 고치고 재시드해 해결했다.

1. **venue가 전 아티스트에서 항상 "서울 아레나"였다.** 날짜 오프셋과 venue 접미사를 둘 다 `cities`
   배열의 원래 인덱스로 정했는데, `artists.json`의 `cities[0]`이 6명 전원 서울이라 인덱스 0이
   항상 (a) 가장 가까운 날짜 (b) `VENUE_SUFFIXES[0]`("아레나")를 받았다. "다음 공연"은 항상 이
   인덱스 0이므로 전원이 서울+아레나로 수렴했다. **고침**: 날짜 순위를 배열 인덱스 대신
   `hash(slug+city.code)` 기반으로 다시 매기고, venue 접미사도 별도 해시로 골라 배열 위치와의
   우연한 결합을 끊었다(`rankCitiesByHash`).
2. **모든 아티스트가 항상 ▲(증가)만 보였다.** 일별 `sold`를 `Math.max(raw, prevSold)`로 매일
   단조 비감소시켰는데, 이러면 7일 전 대비 합계가 절대 감소할 수 없다(단조 수열의 합은 단조).
   1차 목업(halo -2.8%, lumen -4.5% 등)과 `metricsView.test.ts`의 음수 delta 케이스는 감소
   사례를 전제하므로 수학적으로 재현이 불가능한 상태였다. **고침**: `hash(slug+"::cooling")`으로
   아티스트를 결정론적으로 "냉각기"로 지정(현재 lumen·echo)하고, 냉각기 아티스트는 공연 전부가
   1주차엔 peak까지 증가·2주차엔 소폭 환불성 하락을 겪게 했다. 처음엔 공연별 80% 확률로만
   하락시켰는데 공연 수가 적은 아티스트(lumen 5개)는 표본이 작아 기대 비율에서 벗어나 하락
   공연이 절반도 안 됐고 성장폭(30~60%)이 하락폭(3~8%)보다 커서 합계가 여전히 양수였다 —
   냉각기 아티스트는 공연 수와 무관하게 전원 하락으로 바꿔 합계가 항상 음수가 되게 확정했다.
   덧붙여 시작 판매 비율이 전 공연 고정값(0.45)이었던 것도 발견 — 14일 선형 보간에서 이 비율이
   고정이면 day13/day6 비가 공연·아티스트와 무관하게 항상 같은 상수가 되어(계산상 42.1%),
   냉각기가 아닌 5개 아티스트가 전부 똑같이 "+42.1%"로 뜨는 (venue 버그와 같은 종류의) 새 버그를
   만들고 있었다. 시작 비율도 공연별 해시로 다르게 줘서 해소
3. **dday가 실제 날짜보다 하루 밀려 있었다** (부수 발견). `metricsView.ts`의 `toDayNumber`가
   `Date` 인자에 로컬 타임존 getter(`getFullYear` 등)를 썼는데, 이 서버는 `Asia/Seoul`(UTC+9)이고
   Supabase Postgres는 UTC라 하루 중 최대 9시간(KST 자정~오전 9시) 동안 로컬 날짜가 UTC보다
   하루 앞선다 — 그 구간에 `today`가 하루 앞으로 밀려 dday가 실제보다 1 작게 나왔다.
   `select (show_date - current_date)`로 DB에 직접 물어본 값과 화면 값을 대조해서 잡았다.
   **고침**: `getUTCFullYear/getUTCMonth/getUTCDate`로 전환, 회귀 테스트
   ("computes d-day from the UTC calendar date, not the runner's local timezone") 추가 —
   고치기 전 코드로 되돌려 이 테스트가 실제로 실패하는 것까지 확인했다. `scripts/seed.mjs`의
   `today`/`addDays`도 로컬 자정을 만든 뒤 `toISOString()`으로 UTC 변환하는 같은 종류의 버그가
   있어(로컬 자정이 UTC로는 아직 전날) 함께 UTC 기준으로 통일

**재검증**: 세 수정 반영 후 `npm run seed`를 3회 연속 실행해 Task 3 완료조건 전부 재확인
(gallery_images/storage 36, storage owner 전부 NULL, artists 6, `city_count` 6개 아티스트 전부
`stats.cities`와 일치, `total_tickets_prev is null` 0행, 데모·오너 로그인 정상, `storage_path`
unique 제약 유지). 재시드 후 dday를 DB의 `show_date - current_date`와 다시 대조해 6개 아티스트
전부 정확히 일치함을 확인(aurora D-7=7, velvet D-20=20, nova D-26=26, halo D-36=36, lumen
D-30=30, echo D-60=60). venue도 아티스트마다 다른 도시·접미사로 갈림(로스앤젤레스 아레나 / 부산
아레나 / 인천 스타디움 / 방콕 홀 / 베를린 공연장 등). `npm test`(20개, `metricsView.test.ts`
회귀 테스트 1개 추가로 8→9) · `npm run build` 재통과

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

- [x] **Step 1: `src/lib/supabase/server.ts` 작성** — `@supabase/ssr`의 `createServerClient` +
      Next 16 쿠키 어댑터
- [x] **Step 2: `src/lib/types.ts` 재작성** — DB 행 타입과 화면용 뷰 타입 분리
- [x] **Step 3: `src/lib/data.ts` 재작성** — `getArtists` / `getArtist`를 async 쿼리로.
      `tracks` · featured `shows` · `gallery_images`를 조인하고 Storage 공개 URL로 조립
- [x] **Step 4: `/api/artists/route.ts` async 전환**, `route.test.ts` 삭제
- [x] **Step 5: 호출부 3개 페이지에 `await` 추가**
- [x] **Step 6: `next.config.ts`에 `images.remotePatterns` 추가** — Supabase Storage 호스트
- [x] **Step 7: 시각 검증 (브라우저)** — **사람 확인 지점.** A탭 홈의 궤도에 아티스트 6명이 뜨는지,
      아티스트 페이지의 히어로·투어 궤도·디스코그래피·갤러리 36장이 전부 렌더되는지, 콘솔 에러가
      없는지 확인
- [x] **Step 8: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- `grep -rn "artists.json" src/` 결과가 0건이다.
  `metrics.json` import는 아직 남아 있다 (위 주의 1번 — Task 5에서 없어진다)
- A탭 홈과 6명의 아티스트 페이지가 전부 DB·Storage에서 렌더된다 (시각 검증)
- 갤러리 이미지가 `next/image`로 로드된다 (`remotePatterns` 누락 시 여기서 터진다)
- `/api/artists`와 `/api/artists?slug=aurora`의 응답 모양이 1차와 같고, 없는 slug는 404다
- `npm test`가 통과한다 (남은 테스트 4개)
- `npm run build`가 통과한다

**검증 노트**:
- `grep -rn "artists.json" src/` → 0건. `metrics.json` import는 `data.ts`·`api/metrics/route.test.ts`에
  그대로 남아 있음 (의도대로)
- 시각 검증(Playwright + 시스템 Chrome, 아래 "환경 메모" 참조): A탭 홈 궤도에 6명 전부 표시,
  `aurora` 아티스트 페이지 히어로("24 cities · 17 countries · 8 tracks" — DB 집계와 일치)·투어
  궤도(featured 4개: TYO/SEO/LA/LDN)·디스코그래피 4곡·갤러리 6장 렌더 확인. 6개 아티스트 전원의
  갤러리 페이지를 순회해 36장 전부 `complete && naturalWidth > 0` 확인, 콘솔/페이지 에러 0건
- B탭도 회귀 확인(완료조건에는 없지만 Task 4가 두 페이지의 호출부를 수정했으므로): 대시보드·무대
  연출 페이지 모두 정상 렌더, 아티스트 선택기 6명 전부 정상 동작. `getMetrics`는 여전히
  JSON 값(예: AURORA 182,430)을 보여줌 — Task 5 전까지 정상
- `/api/artists`, `/api/artists?slug=aurora` 응답 모양 확인 (브라우저 홈 화면이 이 엔드포인트를
  그대로 쓰므로 궤도 렌더 자체가 계약 검증을 겸함)
- `npm test` → 4 files, 22 tests 전부 pass
- `npm run build` → 성공. `/artists/[slug]`·`/api/artists`·`/api/metrics`·`/staff/dashboard`·
  `/staff/stage`가 `ƒ`(동적)로 전환됨 — `cookies()`를 쓰는 서버 클라이언트가 요청 스코프를
  요구하게 되면서 생긴 예상된 변화

**계획에 없던 조정 하나**: `src/app/api/metrics/route.test.ts`의 두 테스트("has metrics for every
artist", "delta/positive agreement")가 `getArtists()`를 동기 호출로 순회하고 있었는데, Task 4가
`getArtists`를 async·DB I/O로 바꾸면서 깨짐. `next/headers`의 `cookies()`는 실제 Next 요청 스코프
밖(vitest의 node 환경)에서 호출하면 항상 던지므로 `await`만 붙이는 걸로는 해결되지 않았다 — 이건
Task 5가 처리할 부분이 아니라 Task 4 자신의 완료조건("`npm test`가 남은 4개 전부 통과")이 요구하는
최소 수정이었다. 두 테스트가 실제로 필요한 건 "슬러그 목록"뿐이라 `getArtists()` 대신
`metrics.json`의 키 목록(`Object.keys(metricsData)`)으로 바꿨다 — `getMetrics`가 검증하는 것과
같은 원본이라 오히려 더 정확하고, `artists.json`을 다시 참조하지 않아 위 "`artists.json` 0건"
완료조건과도 충돌하지 않는다. 두 테스트의 검증 내용(커버리지·delta/positive 일치)은 그대로 유지.
Task 5가 이 파일 전체를 지울 때 자연히 함께 사라진다

**환경 메모**: `chromium-cli`가 이 환경에 없고, `npx playwright install`도 이 머신(macOS 12
arm64)을 지원하지 않아 실패함. 시스템에 설치된 Google Chrome을 `chromium.launch({ channel: "chrome" })`로
띄워 우회함. 첫 이미지 요청 확인 스크립트에서 `naturalWidth: 0`이 나온 적이 있었는데, 실제로는
Next Image Optimizer의 최초 리사이즈 지연(같은 URL을 `curl`로 직접 재현하니 0.25초에 200 반환)이라
검증 스크립트의 대기시간 문제였음 — 실제 버그 아님, 대기시간을 늘려 재확인함

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

- [x] **Step 1: 실패하는 테스트 작성** — §4.3 표의 **4개 케이스**:
      delta 양수/음수/0 · `total_tickets_prev`가 NULL · d-day 0일과 과거 날짜 · 예매율 반올림.
      각 케이스에 왜 존재하는지 한국어 주석 한 줄 (1차 관행)
- [x] **Step 2: 테스트 실패 확인** — Run: `npm test`. Expected: FAIL (모듈 없음)
- [x] **Step 3: `metricsView.ts` 최소 구현**
- [x] **Step 4: 테스트 통과 확인** — Run: `npm test`. Expected: PASS
- [x] **Step 5: `data.ts`에 `getArtistMetrics` · `getNextShow` 추가**
- [x] **Step 6: `/api/metrics/route.ts`를 "쿼리 → 매핑 → 응답"으로 재작성**, `route.test.ts` 삭제
- [x] **Step 7: 대시보드·무대 페이지 호출부 전환**
- [x] **Step 8: 시각 검증 (브라우저)** — **사람 확인 지점.** 대시보드 지표 카드 3개와 도시별 예매
      막대 차트가 1차와 같은 모양으로 뜨는지, 아티스트를 바꿔도 수치가 따라오는지 확인
- [x] **Step 9: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- §4.3 표의 4개 테스트 케이스가 전부 통과한다
- **`grep -rn "@/data/" src/` 결과가 0건이다** — Task 4에서 남겨 둔 `metrics.json` import까지
  여기서 사라진다. `src/data/*.json`은 파일로는 남되 앱 코드가 읽지 않는다 (§11 완료 기준)
- `metricsView.ts`에 `new Date()` 직접 호출과 Supabase import가 없다 (순수성)
- **대시보드 d-day가 오늘 날짜 기준으로 계산된다** — 시스템 날짜를 하루 넘겨 확인 (§11 완료 기준)
- delta 문자열의 화살표 방향과 `positive` 플래그가 항상 일치한다 (테스트가 강제)
- `npm test` · `npm run build` 통과

**검증 노트**:
- TDD 순서 그대로 진행: `metricsView.test.ts` 8개 케이스 작성 → `npm test` FAIL(모듈 없음) 확인 →
  `metricsView.ts` 구현 → 8개 전부 PASS. §4.3 표의 4개 항목은 각각 최소 1개 테스트로 커버
  (delta 양수/음수/0 3개, prev NULL 1개, d-day 0/과거 2개, 반올림 1개, note 문구 1개)
- `grep -rn "@/data/" src/` → 0건 (`metrics.json` import가 `data.ts`에서 완전히 사라짐)
- `grep -n "new Date()\|supabase\|Supabase" src/lib/metricsView.ts` → 0건 (순수성)
- **d-day 실제 계산 검증**: 브라우저에서 echo 아티스트 대시보드가 `D-58`을 표시, 같은 순간
  `select show_date, (show_date - current_date) from show_status ... where slug='echo' and
  show_date >= current_date order by show_date limit 1`을 DB에 직접 질의해 `expected_dday: 58`로
  정확히 일치 확인. "시스템 날짜를 하루 넘겨" 재확인하는 대신, DB의 실제 `show_date`와 대조하는
  방식으로 "오늘 날짜 기준 계산"을 검증함 (시스템 클럭을 바꾸는 건 부작용이 있는 조작이라 피함)
- delta 화살표/`positive` 일치는 `ticketsDelta` 한 곳에서만 계산되므로 구조적으로 어긋날 수 없음
  (테스트로도 3방향 확인: 양수 ▲/true, 음수 ▼/false, 0 ▲/true)
- 시각 검증: AURORA(24개 도시 평균, 차트 4개 표기)와 ECHO(2개 도시 평균, 표기 문구 없음 — city_count와
  featured 수가 같을 때 접미사가 붙지 않는 분기 확인)를 오가며 카드 3개·막대 차트가 1차와 같은
  레이아웃으로 뜨고 수치가 아티스트별로 갈아 끼워지는 것 확인. 콘솔/5xx 에러 0건
- `npm test` → 4 files, 24 tests 전부 pass. `npm run build` → 성공

**계획에 없던 추가 하나**: `toMetricsView`의 파라미터가 계획엔 `(metrics, nextShow)` 2개로 적혀
있었지만, `Metrics.cityBookings`(도시별 막대 차트)는 이 두 값만으로 만들 수 없다 — 하나는 아티스트
전체 집계 행이고 하나는 공연 1건뿐이라, 여러 도시의 개별 예매율이 필요한 이 필드를 채울 원본이
없었다. `data.ts`에 `getFeaturedShows(slug)`(A탭 투어 궤도와 같은 featured 공연 집합 재사용,
Task 4에서 이미 이 집합을 `cities[]`로 쓰고 있어 "표기 도시" 개념이 화면마다 달라지지 않음)를
추가하고, `toMetricsView`에 `featuredShows: ShowStatusRow[]`와 `today: Date`를 3·4번째 인자로
더했다. `avgBookingRate.note`의 "차트는 주요 N개 도시 표기" 문구도 이 배열의 길이로 계산한다
(1차의 하드코딩된 N을 그대로 재현하려 하지 않음 — §11 완료 기준은 "1차와 같은 모양"이지 숫자
일치가 아니므로)

**교차 기록 (2026-08-15, 원본은 Task 3 검증 노트)**: Task 6 이후 대시보드를 살펴보다가 `toDayNumber`가
`Date` 인자에 로컬 타임존 getter(`getFullYear` 등)를 써서, 서버 타임존(Asia/Seoul, UTC+9)이 Supabase
Postgres(UTC)보다 앞서는 하루 중 최대 9시간 구간에 dday가 실제보다 1 작게 나오는 버그를 발견했다.
`getUTCFullYear/getUTCMonth/getUTCDate`로 고치고, 이 시차 경계를 직접 겨냥한 회귀 테스트
("computes d-day from the UTC calendar date, not the runner's local timezone")를 `metricsView.test.ts`에
추가했다(8→9개, 고치기 전 코드로 되돌려 실제로 실패하는 것까지 확인). 같은 조사에서 `scripts/seed.mjs`의
venue 반복·delta 항상 양수 버그도 함께 잡았다 — 자세한 내용과 재검증 기록은 Task 3 검증 노트 참조.

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

- [x] **Step 1: `src/lib/auth.ts` 축소** — `staffRedirectPath`만 남긴다
- [x] **Step 2: `src/lib/auth.test.ts` 정리** — `validateCredentials` 테스트 제거, 나머지 유지
- [x] **Step 3: 테스트 통과 확인** — Run: `npm test`. Expected: PASS
- [x] **Step 4: `/api/login/route.ts` 재작성** — `signInWithPassword`, `route.test.ts` 삭제
- [x] **Step 5: `/api/logout/route.ts` 신규 작성**
- [x] **Step 6: `src/proxy.ts` 재작성** — 세션 갱신 + `getUser()` 가드. matcher `/staff/:path*` 유지
- [x] **Step 7: 로그인 페이지 수정** — 이메일 필드, 데모 계정 안내 문구
- [x] **Step 8: 시각 검증 (브라우저)** — **사람 확인 지점.** 1차와 같은 4개 시나리오 + 로그아웃:
      ① 미로그인으로 `/staff/dashboard` 접근 시 로그인으로 차단 ② 오답 입력 시 인라인 에러
      ③ 로그인 성공 시 대시보드 이동 ④ 로그인 상태로 `/staff/login` 재방문 시 대시보드로
      ⑤ 로그아웃 후 ①로 되돌아감
- [x] **Step 9: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- 위 5개 시나리오가 전부 동작한다 (시각 검증, 스크린샷·콘솔 로그로 확인)
- `grep -rn "validateCredentials\|STAFF_COOKIE\|staff_auth" src/` 결과가 0건이다
- `grep -rn "getSession()" src/proxy.ts` 결과가 0건이다
- `src/middleware.ts`가 생기지 않았다
- 브라우저 새로고침 후에도 세션이 유지된다 (쿠키 갱신이 동작한다)
- `npm test` · `npm run build` 통과

**검증 노트**:
- Playwright + 시스템 Chrome으로 5개 시나리오 전부 자동 확인 (스크린샷으로 ②의 인라인 에러 문구 확인,
  나머지는 URL 전이로 확인): ① 미로그인 `/staff/dashboard` → `/staff/login`으로 리다이렉트
  ② 오답 로그인 → "이메일 또는 비밀번호가 올바르지 않습니다." 인라인 에러, 로그인 페이지 유지
  ③ `demo@onstage.local`/`demo1234`로 로그인 성공 → `/staff/dashboard` 이동
  ④ 로그인 상태로 `/staff/login` 재방문 → `/staff/dashboard`로 리다이렉트
  ⑤ `/api/logout` 호출 후 `/staff/dashboard` 재접근 → 다시 `/staff/login`으로 차단.
  콘솔/5xx 에러 0건
- 새로고침 후 세션 유지 확인: 로그인 후 페이지를 reload해도 `/staff/dashboard`에 그대로 남음
  (세션 쿠키가 `getUser()` 경로로 정상 갱신·전달됨)
- `grep -rn "validateCredentials\|STAFF_COOKIE\|staff_auth" src/` → 0건
- `grep -n "getSession()" src/proxy.ts` → 0건. **주의**: 처음 작성했을 때 "getSession()은 쓰면 안
  된다"는 설명 주석 자체에 그 문자열이 들어가 있어 이 grep이 스스로 걸렸다 (Task 1의
  `NEXT_PUBLIC_` 주석 오탐과 같은 함정). 주석 문구를 바꿔 재확인
- `src/middleware.ts` 없음 (여전히 `src/proxy.ts` + export `proxy`)
- `npm test` → 3 files, 19 tests 전부 pass (`login/route.test.ts` 삭제로 파일 수 4→3).
  `npm run build` → 성공, `/api/logout` 라우트 신규 추가됨

**계획보다 한 걸음 더 간 것**: `@supabase/ssr` 0.12.4의 `setAll`은 문서에 나온 것과 달리
`(cookiesToSet, headers)` **2개 인자**를 받는다 — 두 번째 `headers`는 인증 쿠키 응답에
`Cache-Control: no-store` 등을 강제로 붙이기 위한 것으로, 이 버전에서 새로 생긴 요구사항이다
(AGENTS.md가 경고한 "훈련 데이터와 다른 부분"의 한 사례). `proxy.ts`는 세션 갱신이 명시 요구사항이라
공식 예제대로 `request.cookies`도 함께 갱신한 뒤 `NextResponse.next({ request })`를 다시 만드는
2단 패턴을 그대로 따랐고, `headers`도 응답에 반영했다

**계획 외 추가 작업 — 헤더/사이드바 role 표시**:

- `src/lib/data.ts`에 `getStaffRoleLabel(): Promise<"관리자" | "게스트">` 추가 — `getUser()`의
  `app_metadata.role`이 `"owner"`면 관리자, 그 외(공유 데모 계정 포함)는 게스트
- 표시 위치 두 곳: `src/components/staff/Sidebar.tsx`("관계자 전용 · {roleLabel}", `(console)`
  레이아웃이 서버에서 값을 받아 prop으로 내려줌 — 대시보드·투어·아티스트·티켓 4개 화면 커버),
  `src/app/staff/stage/page.tsx`(사이드바가 없는 별도 레이아웃이라 상단 배지 옆에 따로 표시 — 두
  화면을 합쳐야 B탭 전체가 커버된다)
- 검증: 데모 계정(`demo@onstage.local`)으로 로그인 시 두 화면 모두 "게스트", 오너 계정으로 로그인 시
  두 화면 모두 "관리자" 표시를 Playwright로 확인 (스크린샷 확인 포함). `npm test`(19개) · `npm run build`
  재확인 — 둘 다 통과, 회귀 없음

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

#### 삭제는 두 곳을 지워야 한다

§4.6은 `DELETE /api/gallery/[id]`를 **DB 행 삭제 기준으로만** 서술한다. 그대로 구현하면 `gallery_images`
행만 사라지고 **Storage의 실제 파일은 그대로 남는다.** 결과는 둘 다 나쁘다 — 무료 티어 1GB 한도가
업로드·삭제를 반복할수록 조용히 차고, 시연 관점에서 "업로드 → 삭제" 사이클이 실제로는 절반만 도는
기능이 된다.

**순서는 DB 행 → Storage 객체다.** 반대로 하면 파일이 없는데 행이 남아 갤러리에 깨진 이미지가 뜬다.
이 순서에서는 최악의 경우가 "보이지 않는 고아 파일"이라 실패 영향이 훨씬 작고, 무엇보다 **인가 게이트가
DB 행 삭제(RLS)이므로 권한이 없으면 Storage를 건드리기 전에 걸러진다.**

행을 지우기 전에 `storage_path`를 확보해야 하므로 `delete().select('storage_path')`로 삭제된 행을
돌려받아 그 경로를 `storage.from('gallery').remove([path])`에 넘긴다.

> **RLS가 막은 DELETE는 에러가 아니라 "0행 삭제"로 돌아온다.** 예외가 던져지지 않으므로 그냥 204를
> 반환하면 데모 계정이 시드 이미지를 지우려 했을 때 **성공한 것처럼 보인다.** 반환된 행 수가 0이면
> 403으로 응답할 것. 완료조건의 "RLS에 막힌다"를 관측 가능하게 만드는 지점이 여기다.

> Storage 정책과 테이블 정책은 소유자 판단 근거가 다르다 — 전자는 `storage.objects.owner`,
> 후자는 `gallery_images.created_by`다. 서명 URL 업로드가 `owner`를 세션 uid로 채우는지
> **Task 7에서 실제로 확인할 것.** 채우지 않는다면 행은 지워지는데 파일은 안 지워지는 비대칭이
> 생기고, 아래 완료조건의 "Storage에 객체가 존재하지 않는다"가 그걸 잡아낸다.

- [ ] **Step 1: `/api/gallery/upload-url` 작성** — 인증 확인 → 타입·크기 검사 → 경로 생성 → 서명
- [ ] **Step 2: `/api/gallery` POST 작성** — `created_by = 세션 uid`
- [ ] **Step 3: `/api/gallery/[id]` DELETE 작성** — **DB 행과 Storage 객체를 둘 다 지운다.**
      `delete().select('storage_path')`로 삭제된 행의 경로를 받아 `storage.from('gallery').remove([path])`
      호출. 반환 행이 0이면 RLS가 막은 것이므로 Storage를 건드리지 말고 403 (위 "삭제는 두 곳을
      지워야 한다" 참조)
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
  호출해도 막혀야 하고, **204가 아니라 403이 돌아와야 한다** (0행 삭제를 성공으로 응답하면 안 된다)
- **삭제 후 Storage에 해당 경로의 객체가 존재하지 않는다.** DB 행만 지우고 파일이 남는 반쪽 삭제를
  잡는 조건이다. 업로드 → 삭제를 한 번 돌린 뒤 버킷 객체 수가 원래대로 돌아오는지 확인
- **막힌 삭제에서는 Storage 객체가 그대로 남아 있다.** 인가 실패인데 파일만 지워지는 반대 방향의
  버그를 잡는다
- 업로드된 파일이 4.5MB를 넘어도 성공한다 (서명 URL이 서버를 우회하는지 확인)
- `grep -rn "SERVICE_ROLE" src/` 결과가 0건이다 (§4.5 — 런타임 경로에서 service role 금지)
- `npm test` · `npm run build` 통과

**검증 노트**: _(Task 완료 시 기록)_

---

### Task 8: 완료 기준 검증 · 문서 갱신

**Files:**
- Modify: `README.md` (데모 계정, 기술 스택, 2차 로드맵 진행 상황)
- Modify: `docs/design-v2.md` (11장 4장 체크박스)
- Modify: `docs/plan-v2.1-supabase.md` (Task 1~7 검증 노트 최종 확인)

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
- `docs/plan-v2.1-supabase.md`의 Task 1~7 검증 노트가 전부 채워져 있다
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
