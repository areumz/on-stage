# ON-STAGE — 2차 고도화 설계 문서 (Design Document v2)

> 목업 위의 무대에서, 실제로 굴러가는 무대로.
> 1차에서 mock JSON과 하드코딩 로그인으로 세운 두 개의 탭을 실제 백엔드 위에 올린다.

- **상태**: 설계 승인 완료 (v2.0)
- **선행 문서**: [`docs/design.md`](./design.md) 8장 "2차 (고도화)" — 이 문서가 그 목록을 구체화한 것
- **다음 단계**: 4장(Supabase 전환)을 승인된 설계로 간주하고 `writing-plans`부터 진행
- **문서 성격**: 이 문서는 **umbrella 설계**다. 5개 항목이 서로 독립 서브시스템이라 구현은 어차피 여러
  사이클로 쪼개지므로, 우선순위 1번인 Supabase 전환만 실행 가능한 수준(스키마·RLS·API 계약)까지 적고
  나머지 4개는 스코프와 확정된 결정까지만 적는다. 각 항목은 차례가 오면 해당 절을 확장한 뒤
  별도 `writing-plans` 사이클로 넘긴다.

---

## 1. 2차 개요

1차는 Vercel 배포까지 완료했고, 그 과정에서 의도적으로 남긴 부채가 세 종류다.

| 부채 | 1차 상태 | 2차 해소 방식 |
|---|---|---|
| 인증 | `admin` / `1234` 하드코딩, 쿠키 값이 리터럴 `"ok"` | Supabase Auth (4.4) |
| 데이터 | `src/data/*.json` 정적 import, 쓰기 경로 없음 | Supabase Postgres (4.1) |
| 이미지 | `public/gallery/`에 36장 고정, 교체하려면 커밋 필요 | Supabase Storage + B탭 업로드 (4.6) |

1차 로드맵의 "갤러리 이미지 정교화(AI 생성 이미지로 교체 검토)"는 **관리자가 직접 업로드·관리하는 기능으로
대체한다.** 결과물 이미지를 한 번 더 만드는 것보다, 그걸 다루는 화면을 만드는 쪽이 이 포트폴리오의
성격에 맞는다.

---

## 2. 확정된 제약과 결정

| # | 항목 | 결정 | 근거 |
|---|---|---|---|
| 1 | 백엔드 | 별도 서버(Java/Spring 등)로 확장 **금지**. Supabase 단독으로 Auth/DB/Storage 전부 처리 | Java는 별도 프로젝트에서 학습 중. 이 포트폴리오는 프론트/AI 워크플로우 강점에 집중 |
| 2 | 요금제 | 무료 티어 (500MB DB, 1GB Storage, 5만 MAU) | 이 규모엔 충분. 단 7일 비활성 시 일시정지 → 시드 재현성이 설계 제약 |
| 3 | DB 범위 | 화면이 읽거나 쓰는 것 전부를 관계형 테이블로. `tracks` 포함 | `tracks` 편집 UI는 7장(B탭 잔여 메뉴)에서 붙는다. 지금 JSONB로 넣었다가 그때 관계형으로 재마이그레이션하는 걸 피한다 |
| 4 | 접근 경로 | 서버 전용. 브라우저에 Supabase 키를 노출하지 않는다 | 1차 원칙("클라이언트는 API Routes 경유") 유지 |
| 5 | 지표 | 저장하지 않고 판매 데이터에서 파생 | 1차 metrics.json의 부채(완성된 문자열, 박제된 d-day)를 DB로 이사시키지 않는다 |
| 6 | 문서 | 1차와 동일하게 AI 협업 프로세스를 계속 문서에 남긴다 | 이 프로젝트의 핵심 차별점 |

> 구현 에이전트 주의: 제약 1번은 강한 금지다. "이건 서버가 있으면 쉬운데"라는 이유로 별도 백엔드,
> 커스텀 Node 서버, 외부 큐/워커를 도입하지 말 것. Supabase가 제공하지 않는 기능은 스코프에서 뺀다.

---

## 3. 시퀀싱

```
2.1  Supabase 전환 (4장)          ← 나머지 전부의 기반
      ├─ 2.2  무대 연출 툴 고도화 (5장)      stage_presets 의존
      ├─ 2.3  B탭 잔여 메뉴 (7장)           스키마 전체 의존
      └─ 2.4  셰이더 심화 (8장)             artists.shader_* 컬럼 의존
2.5  반응형 (6장)                 화면이 다 나온 뒤 + 3D 전략 별도 브레인스토밍
```

각 단계는 별도 `writing-plans` → `executing-plans` 사이클로 돌린다.
반응형을 마지막에 두는 이유는 2.1과 2.3이 화면 구성을 바꾸기 때문이다 — 아직 없는 화면의
브레이크포인트를 먼저 정하는 건 낭비다.

---

## 4. Supabase 전환 (로드맵 1번)

### 4.1 스키마

핵심 판단: **`tour_cities`를 별도 테이블로 만들지 않고 `shows`로 통합한다.**

> 브레인스토밍 당시 후보 스키마에는 `tour_cities`가 별도 테이블로 있었다. 설계를 구체화하면서
> 티켓 현황 화면이 공연 전체 목록을 필요로 한다는 걸 확인했고, 그러면 `tour_cities`는 `shows`의
> 부분집합에 불과해 중복이 된다. **결정을 뒤집은 게 아니라, "화면이 읽거나 쓰는 것 전부를 테이블로"라는
> 같은 원칙을 더 적은 테이블로 만족시키는 대안을 찾은 것이다.** A탭 투어 오빗이 필요로 하던 도시 4개는
> `shows.featured` 플래그가 대신한다.

이 통합의 부수 효과로 `stats.cities`와 `stats.countries`가 집계로 나오므로 컬럼에서 없앤다.
`shows`는 A탭에 노출되는 4개가 아니라 **실제 투어 규모(아티스트별 `stats.cities` 개수, AURORA 기준
24개)로 존재해야 한다** — 티켓 현황 화면이 그걸 나열하기 때문이다.

`stat_tracks`만 컬럼으로 남긴다. 이건 "총 발매곡 수"이고 `tracks` 행은 사이트 노출용 대표곡만 담아
의미가 다르다. 1차 `artists.json`에서 `stats.tracks: 8`과 `tracks` 배열 길이 4가 어긋나 있던 것은
버그가 아니라 이 의도였다.

```sql
create table artists (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  name           text not null,
  name_ko        text not null,
  color          text not null,          -- 시그니처 hex
  initials       text not null,
  orbit          smallint not null,      -- A탭 홈 궤도 인덱스 0(안)~2(밖)
  angle          numeric  not null,      -- 궤도 위 각도(deg)
  size           numeric  not null,      -- 노드 반지름 배율
  news           text not null,          -- NOW 티커 문구
  tour_badge     text not null,
  tour_title_ko  text not null,
  tour_year      smallint not null,
  stat_tracks    smallint not null,      -- 총 발매곡 수. tracks 행 수(노출용 대표곡)와 의도적으로 다름
  shader_pattern text    not null default 'wave',   -- 8장(셰이더 심화)
  shader_freq    numeric not null default 9,
  shader_falloff numeric not null default 0.75,
  shader_speed   numeric not null default 0.5,
  created_at     timestamptz not null default now()
);

create table tracks (
  id         uuid primary key default gen_random_uuid(),
  artist_id  uuid not null references artists on delete cascade,
  no         smallint not null,
  title      text not null,
  duration   text not null,
  cover_from text not null,              -- 2스톱 그라디언트 (실 커버아트 없음)
  cover_to   text not null,
  unique (artist_id, no)
);

create table shows (
  id        uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists on delete cascade,
  city_code text not null,
  city_name text not null,
  country   text not null,
  venue     text not null,
  show_date date not null,
  capacity  int  not null check (capacity > 0),
  featured  boolean not null default false,   -- A탭 투어 오빗 노출 대상
  unique (artist_id, city_code, show_date)
);

-- 일별 스냅샷. "지난주 대비 delta"를 계산하려면 시계열이 필요하다.
create table ticket_sales (
  id          bigserial primary key,
  show_id     uuid not null references shows on delete cascade,
  recorded_on date not null,
  sold        int  not null check (sold >= 0),
  unique (show_id, recorded_on)
);

create table gallery_images (
  id           uuid primary key default gen_random_uuid(),
  artist_id    uuid not null references artists on delete cascade,
  -- unique: 하나의 Storage 객체를 두 행이 가리키는 상태는 어떤 경로로 생기든 버그다.
  -- 시드 upsert의 충돌 기준이자, 삭제(행 → 객체)가 1:1임을 보장하는 근거이기도 하다.
  storage_path text not null unique,
  creator      text,
  license      text,                     -- 'CC0 1.0' | 'CC BY 2.0' | 'AI' | 업로드 시 입력
  origin       text,
  sort_order   smallint not null default 0,
  created_by   uuid references auth.users,   -- NULL = 시드 행 (4.5의 소유 스코프에서 불변)
  created_at   timestamptz not null default now()
);

create table stage_presets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users default auth.uid(),
  artist_id  uuid not null references artists on delete cascade,
  name       text not null,
  state      jsonb not null,             -- StageState (5장)
  created_at timestamptz not null default now(),
  unique (user_id, artist_id, name)
);
```

`sold <= capacity` 교차 테이블 CHECK는 두지 않는다. 티켓 현황을 조회 전용으로 확정했으므로(7장)
사용자 입력 경로가 없고, 불변식은 시드가 보장한다.

**위 6개 테이블은 생성 직후 전부 RLS를 켜야 한다** — 마이그레이션 파일에서 `create table` 다음에
오는 것이 4.5의 `alter table ... enable row level security` 블록이다. 이 스키마만 보고 마이그레이션을
쓰면 빠뜨리기 쉬운 지점이라 여기에 표시해 둔다.

### 4.2 뷰 — 지표 파생

```sql
create view show_status with (security_invoker = true) as
with bounds as (select max(recorded_on) as latest from ticket_sales),
latest as (
  select distinct on (show_id) show_id, sold from ticket_sales
  order by show_id, recorded_on desc
),
prev as (
  select distinct on (show_id) show_id, sold from ticket_sales
  where recorded_on <= (select latest from bounds) - 7
  order by show_id, recorded_on desc
)
select s.*,
       coalesce(l.sold, 0) as sold,
       p.sold              as sold_prev,
       coalesce(l.sold, 0)::numeric / s.capacity as rate
from shows s
left join latest l on l.show_id = s.id
left join prev   p on p.show_id = s.id;

create view artist_metrics with (security_invoker = true) as
select artist_id,
       sum(sold)               as total_tickets,
       sum(sold_prev)          as total_tickets_prev,
       avg(rate)               as avg_booking_rate,
       count(*)                as city_count,
       count(distinct country) as country_count
from show_status
group by artist_id;
```

세 가지가 설계 의도다.

**`security_invoker = true`는 생략 금지.** Postgres 뷰는 기본적으로 정의자 권한으로 실행되어
기반 테이블의 RLS를 우회한다. 이 옵션이 없으면 4.5의 정책이 뷰 경로에서 전부 무력화된다.

**`current_date`가 아니라 `max(recorded_on)` 기준으로 "최신 / 7일 전"을 잡는다.** 제약 2번(7일 비활성
일시정지) 때문에 시드 이후 시간이 흐르는 상황이 정상 시나리오다. 절대 날짜로 잡으면 며칠만 지나도
비교 대상이 데이터 범위를 벗어나 delta가 NULL이 된다.

**`latest` 조인은 반드시 LEFT JOIN이어야 한다.** 7장에서 오너가 `/staff/tours`로 새 공연을 만들면
`ticket_sales` 행이 아직 없다. INNER JOIN이면 그 공연이 `show_status`에서 통째로 사라져 티켓 현황
화면에도, `artist_metrics`의 도시 수 집계에도 잡히지 않는다. `coalesce(l.sold, 0)`으로 판매량 0인
공연으로 표시한다. 반면 `sold_prev`는 NULL로 남겨둔다 — 지난주에 존재하지 않던 공연이 지난주
합계에 들어가면 안 되고, `sum`이 NULL을 무시하는 게 정확히 그 동작이다.

다음 공연은 뷰에 억지로 밀어넣지 않고 `show_status`에서 `show_date >= current_date` 정렬 후 1건 조회한다.

### 4.3 표시 레이어 = TDD 대상

`src/lib/metricsView.ts`의 순수 함수 `toMetricsView(metrics, nextShow)`가 DB 숫자를 화면용 모양으로 바꾼다.
API 라우트는 "쿼리 → 매핑 → 응답" 세 줄로 얇아진다.

이 분리가 1차의 부채 두 개를 구조적으로 해소한다.

- 1차에서 **테스트로 강제하던** "`▲`/`▼` 화살표와 `positive` 불리언 일치" 불변식이 여기서는
  같은 계산에서 둘 다 나오므로 **어긋날 수가 없다.** 데이터 정합성 테스트가 필요 없어진다.
- 박제된 `dday` 정수가 `show_date - current_date` 계산으로 대체되어 더 이상 조용히 낡지 않는다.

| 테스트 케이스 | 확인 내용 |
|---|---|
| delta 양수 / 음수 / 0 | 화살표 문자와 `positive` 플래그가 항상 같은 방향 |
| `total_tickets_prev`가 NULL | 7일 전 스냅샷이 없는 신규 공연에서 0으로 나누지 않음 |
| d-day 0일 / 과거 날짜 | 오늘 공연과 지난 공연의 표기 |
| 예매율 반올림 | 소수점 처리 일관성 |

> 구현 에이전트 주의: 1차 `src/app/api/metrics/route.test.ts`의 프로토타입 체인 가드 테스트
> (`constructor` / `__proto__` / `toString` / `hasOwnProperty`)는 **되살리지 말 것.** 객체 인덱싱이
> `.eq('slug', slug)` 쿼리로 바뀌면서 취약점 자체가 사라졌다. `src/lib/data.ts`의 `Object.hasOwn` 가드도
> 함께 없어진다. 없어진 방어 코드를 습관적으로 복원하면 의미 없는 분기가 남는다.

### 4.4 인증

| 대상 | 작업 |
|---|---|
| `POST /api/login` | 서버에서 `signInWithPassword` 호출, `@supabase/ssr` 서버 클라이언트가 세션 쿠키 세팅 |
| `POST /api/logout` | 신규 (1차엔 로그아웃 경로가 없다) |
| `src/proxy.ts` | 세션 갱신 + `/staff/*` 가드 |
| `src/lib/auth.ts` | `validateCredentials`와 `STAFF_COOKIE` 삭제. 순수 함수 `staffRedirectPath`와 그 테스트는 유지 |
| `src/app/staff/login/page.tsx` | 아이디 → 이메일 필드로 변경. 데모 계정 안내 문구 갱신 |

시드가 계정 두 개를 만든다.

- **데모 계정** — `app_metadata`에 role 없음. README에 공개
- **오너 계정** — `app_metadata: { role: "owner" }`. 비밀번호는 환경변수, 공개하지 않음

4.5의 역할 스코프 정책이 이 `role` 클레임을 읽는다.

> 구현 에이전트 주의 (세 가지, 전부 놓치기 쉬움):
>
> 1. **Next 16이라 파일명은 `src/proxy.ts`이며 `middleware.ts`가 아니다.** `@supabase/ssr` 공식 문서의
>    세션 갱신 보일러플레이트는 `middleware.ts`를 가정하므로, 내용은 가져오되 파일명과 export 이름
>    (`proxy`)은 이 프로젝트 것을 유지할 것.
> 2. **`proxy.ts`에서는 `getSession()`이 아니라 `getUser()`를 쓴다.** 전자는 쿠키를 그대로 신뢰하고
>    서명을 검증하지 않아 가드로 쓸 수 없다.
> 3. **로그인 성공 후의 `window.location.href` 전체 네비게이션은 그대로 둔다.** 이건 App Router
>    클라이언트 캐시에 로그인 전 리다이렉트가 남아 `router.push`가 로그인 화면으로 되돌아오는 문제의
>    우회책이고, 인증 방식과 무관하다. "Supabase로 바꿨으니 이제 `router.push`로 되돌려도 되겠다"는
>    판단은 틀렸다.

### 4.5 RLS — 쓰기 스코프가 두 가지다

**이 절이 7장(B탭 잔여 메뉴)의 전제다.** 쓰기 경로는 두 종류이며 **둘 다 RLS로 강제한다.**
service role 키는 시드 스크립트 전용이고 런타임 요청 경로에서는 사용하지 않는다.

| 스코프 | 대상 | 정책 조건 | 누가 쓰나 |
|---|---|---|---|
| **소유 스코프** | `gallery_images`, `stage_presets`, Storage 객체 | 소유자 컬럼 = `auth.uid()` (`created_by` / `user_id` / `owner`) | 공유 데모 계정 포함 모든 로그인 사용자 |
| **역할 스코프** | `artists`, `tracks`, `shows` | `app_metadata.role = 'owner'` | 오너 계정만 |
| (쓰기 정책 없음) | `ticket_sales` | — | 시드(service role)만 |

`ticket_sales`에는 쓰기 정책을 아예 만들지 않는다. 판매량을 쓰는 화면이 없고(7장에서 티켓 현황을
조회 전용으로 확정), 시드는 service role이라 RLS를 우회하므로 정책이 필요 없다. "나중에 필요할 테니
오너 정책이라도 붙여두자"는 판단은 하지 않는다.

**소유 스코프가 필요한 이유**: 배포된 포트폴리오라 데모 계정으로 누구나 로그인한다. 시드된 갤러리 36장은
`created_by = NULL`이라 어떤 방문자도 지울 수 없고, 방문자가 올린 것만 방문자가 지운다. 업로드 기능은
그대로 시연되면서 갤러리가 훼손되지 않는다.

**역할 스코프가 따로 필요한 이유**: 소유 스코프만으로는 7장에서 같은 문제가 되살아난다. `artists`나
`shows`는 시드가 만든 행이 전부라 `created_by` 소유 스코프가 성립하지 않고(방문자가 새로 만들 게 없다),
그렇다고 로그인만으로 쓰기를 열면 공유 데모 계정을 쓰는 아무 방문자나 아티스트 정보와 투어 일정을
고칠 수 있다.

역할을 JWT 클레임으로 받아 RLS에서 직접 검사하므로 **쓰기 경로는 여전히 하나(RLS)로 통일된다.**
API 라우트에서 service role로 우회하는 두 번째 경로를 만들지 않는다.

```sql
-- 0. RLS 활성화. 이게 없으면 아래 정책 전부가 죽은 코드다.
alter table artists        enable row level security;
alter table tracks         enable row level security;
alter table shows          enable row level security;
alter table ticket_sales   enable row level security;
alter table gallery_images enable row level security;
alter table stage_presets  enable row level security;

-- 역할 스코프: 읽기는 공개, 쓰기는 오너만
create policy "public read"  on artists for select using (true);
create policy "owner writes" on artists for all to authenticated
  using      (auth.jwt() #>> '{app_metadata,role}' = 'owner')
  with check (auth.jwt() #>> '{app_metadata,role}' = 'owner');
-- tracks / shows 동일

-- ticket_sales: 읽기만. 쓰기 정책 없음 (service role 시드 전용)
create policy "public read" on ticket_sales for select using (true);

-- 소유 스코프: gallery_images
create policy "public read"   on gallery_images for select using (true);
create policy "authed insert" on gallery_images for insert to authenticated
  with check (created_by = auth.uid());
create policy "own update"    on gallery_images for update to authenticated
  using (created_by = auth.uid());
create policy "own delete"    on gallery_images for delete to authenticated
  using (created_by = auth.uid());

-- 소유 스코프: stage_presets (완전 사용자 스코프)
create policy "own all" on stage_presets for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Storage: 시드는 service role로 올려 owner가 NULL → 방문자가 못 지움 (테이블 정책과 대칭)
create policy "public read"   on storage.objects for select using (bucket_id = 'gallery');
create policy "authed upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and owner = auth.uid());
create policy "own delete"    on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and owner = auth.uid());
```

> 구현 에이전트 주의 (RLS 활성화, 세 가지):
>
> 1. **`enable row level security`를 빠뜨리지 말 것.** Postgres는 RLS 기본값이 꺼짐이고, `create policy`는
>    정책을 등록만 할 뿐 활성화하지 않는다. 빠뜨려도 **에러가 나지 않고 정책이 조용히 무시되므로**,
>    이 절의 소유 스코프/역할 스코프 구분이 통째로 무력화된 채 배포된다. Supabase **대시보드**로 만든
>    테이블은 RLS가 자동으로 켜지지만 **SQL 마이그레이션**으로 만든 테이블은 켜지지 않는다.
>    이 프로젝트는 후자다.
> 2. **`force row level security`는 쓰지 말 것.** service role이 RLS를 우회하는 것은 의도된 동작이고
>    시드 스크립트가 거기에 의존한다. `force`를 붙이면 시드가 자기 테이블에 쓰지 못한다.
> 3. `ticket_sales`처럼 **쓰기 정책이 하나도 없는 테이블은 RLS가 켜져 있어야만 "전부 거부"가 된다.**
>    꺼져 있으면 정책 없음이 곧 "전부 허용"이다. 정확히 반대 결과다.

버킷 `gallery`는 public read이며 `allowed_mime_types`(`image/jpeg`, `image/png`, `image/webp`)와
`file_size_limit`을 **버킷 설정에 건다.** API 라우트의 화이트리스트는 사용자에게 빨리 알려주기 위한
것이고 진짜 신뢰 경계는 버킷 설정이다. 둘 다 둔다.

### 4.6 이미지 업로드 — 서명 URL 3단계

`createSignedUploadUrl`이 돌려주는 URL은 그냥 `PUT` 가능한 단일 목적 URL이라 브라우저에 supabase-js도
anon key도 필요 없다. 제약 4번("클라이언트는 API Routes 경유")이 유지되면서 Vercel 서버리스의
4.5MB 요청 바디 제한도 피한다.

| 단계 | 경로 | 하는 일 |
|---|---|---|
| 1 | `POST /api/gallery/upload-url` | 인증 확인 → 파일 타입/크기 1차 검사 → 경로 생성 → 서명. 응답 `{ signedUrl, path }` |
| 2 | (브라우저) `PUT {signedUrl}` | 파일 바이트를 Storage로 직접 전송. 서버를 거치지 않음 |
| 3 | `POST /api/gallery` | `created_by = 세션 uid`로 `gallery_images` 행 삽입 |

`DELETE /api/gallery/[id]`는 RLS가 소유 검사를 하므로 서버 코드에서 소유자를 다시 확인하지 않는다.

`next/image`가 Storage 호스트를 로드하려면 `next.config.ts`에 `images.remotePatterns`를 추가해야 한다
(1차엔 로컬 파일만 써서 `images` 설정 자체가 없다).

### 4.7 마이그레이션 · 시드 · 환경

**환경**: Supabase 원격 프로젝트 **1개**(dev = prod). 스키마는 `supabase/migrations/*.sql`로 버전 관리하고
CLI로 push한다. 프로젝트를 둘로 나누면 일시정지 대상만 둘이 되어 관리 포인트가 오히려 늘어난다.

**시드**(`scripts/seed.mjs`): 의존성을 추가하지 않으려고 타입 없는 평범한 ESM으로 쓴다. 전 단계가
멱등(upsert)이라 7일 일시정지 복구든 로컬 초기화든 한 명령이다.

1. `src/data/artists.json` → `artists` upsert (셰이더 파라미터는 slug별 고정 매핑)
2. `tracks` upsert
3. `shows` **삭제 후 재생성** — 기존 `cities` 4개는 `featured = true`, 나머지는 `stats.cities` 개수만큼
   결정론적 생성. 공연 날짜는 **실행 시각 기준 향후 6개월에 분포**시켜 d-day가 낡지 않게 한다.
   이 테이블만 upsert가 아니라 삭제 후 재삽입인 이유는, 날짜가 유니크 키 `(artist_id, city_code, show_date)`의
   일부라서 실행 시각이 바뀌면 갱신이 아니라 새 행이 되기 때문이다. `ticket_sales`는 FK cascade로 함께 지워진다.
   **즉 시드는 `shows`·`ticket_sales`에 한해 파괴적이다** — 로드맵 4번에서 `/staff/tours` 편집 UI가 생기면
   재검토 대상이다
4. `ticket_sales` 14일치 스냅샷 생성 (전 아티스트 합계 2천 행 안팎 — 무료 티어 500MB에 무관)
5. `public/gallery/*.jpg` 36장을 service role로 Storage 업로드 + `gallery_images` 행(`created_by = NULL`)
6. 데모 계정과 오너 계정 생성 (4.4)

> 구현 에이전트 주의: `public/gallery/`와 `src/data/*.json`을 **삭제하지 말 것.** DB로 옮겼으니
> 지워도 된다고 판단하기 쉬우나, 이 파일들은 시드의 원본이고 재현성은 제약 2번에서 온 요구사항이다.
> 앱 코드에서 import하지 않게 되는 것과 저장소에서 지우는 것은 다르다.

**환경변수**(`.env.example` 신규):

| 키 | 용도 | 노출 |
|---|---|---|
| `SUPABASE_URL` | 프로젝트 URL | 서버 전용 |
| `SUPABASE_ANON_KEY` | 사용자 세션 기반 접근 | 서버 전용 (제약 4번) |
| `SUPABASE_SERVICE_ROLE_KEY` | 시드 스크립트 전용 | 서버 전용, Vercel에는 등록하지 않음 |
| `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` | 오너 계정 생성 | 로컬 전용 |

`NEXT_PUBLIC_` 접두사를 쓰는 키는 하나도 없다. 이게 제약 4번이 지켜지고 있는지 확인하는 가장 빠른 방법이다.

> **anon key를 서버 전용으로 묶은 것은 의도된 선택이다.** anon key는 이름 그대로 브라우저에 노출돼도
> 안전하도록 설계된 키이고, Supabase 공식 예제 대부분은 이걸 `NEXT_PUBLIC_`으로 내보낸다. 여기서
> 굳이 숨기는 이유는 제약 4번(클라이언트는 API Routes 경유) 때문이며, 표준 패턴에서 의도적으로
> 벗어난 지점이니 "실수로 서버에 둔 것"으로 오해하지 말 것.
>
> 덧붙여, anon key가 "공개돼도 안전하다"는 전제 자체가 **RLS가 켜져 있을 때만 성립한다**(4.5).
> 이 프로젝트는 RLS를 켜고 그 위에 키를 노출하지 않는 층을 한 겹 더 두는 셈이다.

### 4.8 변경 파일

| 파일 | 작업 |
|---|---|
| `src/lib/supabase/server.ts` · `admin.ts` | 신규 — 쿠키 어댑터 서버 클라이언트 / service role 클라이언트 |
| `src/lib/data.ts` | 쿼리 모듈로 교체. 세 함수가 전부 `async`가 되고 호출부 5곳에 `await` 추가 |
| `src/lib/metricsView.ts` | 신규 — 순수 매핑, TDD 대상 (4.3) |
| `src/lib/types.ts` | DB 행 타입과 화면용 뷰 타입 분리 |
| `src/lib/auth.ts` | `validateCredentials` · `STAFF_COOKIE` 삭제, `staffRedirectPath` 유지 |
| `src/proxy.ts` | 세션 갱신 + `getUser()` 가드 |
| `src/app/api/{login,artists,metrics}/route.ts` | Supabase 경유로 교체, `async` |
| `src/app/api/{logout,gallery,gallery/upload-url}/route.ts` | 신규 |
| `src/app/api/gallery/[id]/route.ts` | 신규 — `DELETE` (4.6). 동적 라우트라 별도 파일 |
| `next.config.ts` | `images.remotePatterns`에 Storage 호스트 추가 |
| `supabase/migrations/0001_init.sql` · `scripts/seed.mjs` · `.env.example` | 신규 |
| `.github/workflows/` | `npm test` 잡 추가 (현재 react-doctor 스캔만 돈다) |

---

## 5. 무대 연출 툴 고도화 (로드맵 2번)

### 5.1 StageState 확장 + 필드별 병합

`spots`는 배열이 아니라 기존 코드와 같은 이름 있는 키(`left`/`center`/`right`)를 유지한 채 각 값을
boolean에서 조명 파라미터 객체로 확장한다. 카메라 키는 `angle`에서 `camera`로 바꾼다 — 스팟에도
`angle`(조명 콘 각도)이 생기면서 이름이 겹치기 때문이다.

```ts
export type SpotState = { on: boolean; intensity: number; angle: number; penumbra: number };

export type StageState = {
  color: string;                                              // 고정 팔레트 → 자유 선택
  spots: { left: SpotState; center: SpotState; right: SpotState };
  camera: "front" | "audience" | "top";
  smoke: { density: number; color: string };                  // 신규
};
```

기본값(`defaultStageState`)은 현재와 동일하게 `left`/`center` on, `right` off, `camera: "front"`를
유지하고, 각 스팟의 조명 파라미터는 지금 `StageScene`에 하드코딩된 값(`intensity: 300, angle: 0.45,
penumbra: 0.6`)을 그대로 옮긴다. `smoke`는 `{ density: 0, color: "#ffffff" }`로 시작해 기본은 꺼진 상태다.

**선행 작업**: `parseStageState`는 지금 전부-아니면-전무 방식(`isStageState` 가드 하나가 통과 못 하면
저장값 전체 폐기)이라 필드를 하나만 추가해도 사용자가 defaults로 되돌아간다. 필드별 폴백 병합으로
바꾼다 — 각 필드가 있고 타입이 맞으면 그 값을, 아니면 fallback의 값을 쓰는 규칙을 최상위(`color` /
`spots` / `camera` / `smoke`)뿐 아니라 `spots.left` / `center` / `right` 내부 4개 필드, `smoke` 내부
2개 필드까지 재귀적으로 적용한다. **이건 TDD 대상이다.**

병합 로직은 두 함수로 나눈다. `mergeStageState(value: unknown, fallback: StageState): StageState`가
위 규칙을 적용하고, `parseStageState(raw: string | null, fallback): StageState`는 localStorage
문자열을 `JSON.parse`한 뒤 `mergeStageState`에 위임하는 얇은 래퍼로 남는다(JSON이 깨지면 fallback).
분리하는 이유는 `mergeStageState` 자체를 5.3의 프리셋 로드(이미 파싱된 Supabase JSONB 객체)에도
그대로 재사용하기 위해서다 — 파싱 경로가 둘이어도 병합 규칙은 하나.

**1차 저장값과의 호환은 별도 코드 없이 이 규칙만으로 해결된다.** 1차의 `spots.left`는
`true`(boolean)라 `mergeSpot`이 "객체가 아님" 판정을 내려 그 자리 전체를 기본값으로 채운다. `camera`
키 자체가 없던 것도 마찬가지로 기본값으로 떨어진다. `color`는 유효한 문자열 그대로라 자연스럽게
유지된다. **즉 1차 사용자는 조명 on/off와 카메라 앵글은 기본값으로 리셋되지만 색상은 유지된다 —
이건 브레인스토밍에서 합의된 동작이지 버그가 아니다.** (대안이었던 "boolean→on 변환 전용 로직
추가"는 이번 한 번만 쓰고 버릴 코드라 기각)

TDD 대상 테스트 케이스:

| 케이스 | 기대 동작 |
|---|---|
| 저장값이 `null` | fallback 그대로 |
| JSON 깨짐 | fallback 그대로 |
| 1차 저장값(`spots.left: true`, `angle` 키) | `color` 유지, `spots`/`camera`는 기본값 |
| `smoke` 필드가 없는(v2 초기) 저장값 | 나머지 필드 유지, `smoke`만 기본값 |
| `spots.left`에 `on`만 있고 나머지 3개 필드 없음 | `on`은 유지, `intensity`/`angle`/`penumbra`는 기본값 |
| `camera`가 열거값 밖의 문자열 | 기본값(`front`)으로 |

### 5.2 프리셋 — 두 층 저장과 API 계약

| 층 | 저장소 | 동작 | 코드 |
|---|---|---|---|
| 작업 중 상태 | localStorage (`stage-state:${slug}`) | 조작할 때마다 자동 | 기존 `src/lib/hooks.ts` 그대로, 손대지 않음 |
| 명명된 프리셋 | Supabase `stage_presets` | 이름 붙여 명시적으로 저장/불러오기 | 신규 `/api/stage-presets` |

`stage_presets` 테이블과 소유 스코프 RLS(`user_id = auth.uid()`)는 4장에서 이미 만들어져 있다 —
**이 장에서 마이그레이션은 추가하지 않는다.** 필요한 건 API 라우트와 UI뿐이다.

API 계약 (`src/app/api/stage-presets/`):

| 메서드 · 경로 | 요청 | 응답 | 비고 |
|---|---|---|---|
| `GET /api/stage-presets?artist=<slug>` | — | `200 { presets: { id, name, state }[] }` | RLS가 `user_id`로 자동 필터, 라우트는 `artist_id`만 추가로 거른다(`getArtistId` 재사용, 4.6과 동일 패턴) |
| `POST /api/stage-presets` | `{ artistSlug, name, state, overwrite?: boolean }` | `201 { id }` / 이름 중복인데 `overwrite` 없으면 `409 { error: "duplicate" }` | `overwrite: true`면 `upsert(..., { onConflict: "user_id,artist_id,name" })`, 아니면 `insert` |
| `DELETE /api/stage-presets/[id]` | — | `204` / `403`(RLS가 막아 0행 삭제됨) | 소유자 재확인 없음 — RLS가 게이트. `gallery/[id]/route.ts`와 동일 패턴 |

모든 라우트는 `user_id`를 클라이언트 입력이 아니라 세션(`user.id`)에서 채운다(`gallery` POST의
`created_by`와 동일 원칙 — 클라이언트가 보낸 값을 신뢰하지 않는다).

덮어쓰기 흐름: 클라이언트가 먼저 `overwrite` 없이 `POST` → `409`를 받으면 "이미 있는 이름입니다.
덮어쓸까요?" `confirm()` → 확인 시 `overwrite: true`로 재요청. 이름이 겹치지 않으면 한 번에 끝난다.

### 5.3 UI — 슬라이더 · 색상 · 프리셋 패널

1차 `StageControls`에는 슬라이더가 하나도 없다(앱 전체에 `type="range"`가 0개). `StageScene`의
`Spot`에 하드코딩돼 있던 `intensity={300} angle={0.45} penumbra={0.6}`을 스팟별
`state.spots.{left,center,right}.{intensity,angle,penumbra}`로 바꾸고 각각 `<input type="range">`로
노출하는 것이 세밀 조명 조절의 실체다.

컨트롤 개수가 3(스팟) × 4(on/intensity/angle/penumbra) + 카메라 3버튼 + 스모그 2 + 색상 2방식 +
프리셋 패널까지 늘어나므로 `StageControls.tsx` 하나에 다 넣지 않고 쪼갠다.

| 파일 | 역할 |
|---|---|
| `StageControls.tsx` | 레이아웃 orchestrator. 색상(아티스트 스와치 + `<input type="color">` 자유 선택 병용), 카메라 3버튼 유지 |
| `SpotControls.tsx` (신규) | 스팟 1개당 on/off 스위치 + intensity/angle/penumbra 슬라이더 3개. `left`/`center`/`right` 3번 렌더 |
| `SmokeControls.tsx` (신규) | density 슬라이더 + `<input type="color">`(스모그 색상, 조명 색과 별개) |
| `PresetPanel.tsx` (신규) | 이름 입력 + 저장 버튼, 프리셋 목록(불러오기/삭제) |

색상 선택은 기존 아티스트 스와치 버튼을 빠른 선택용으로 유지하고 그 옆에 네이티브
`<input type="color">`를 추가해 자유 선택을 병용한다 — 별도 색상 피커 라이브러리는 쓰지 않는다.

슬라이더 범위(한 곳의 상수로 관리, 필요시 조정):

| 필드 | range | step | 기본값 |
|---|---|---|---|
| `intensity` | 0–1000 | 10 | 300 |
| `angle` | 0.1–1.0 | 0.05 | 0.45 |
| `penumbra` | 0–1 | 0.05 | 0.6 |
| `smoke.density` | 0–1 | 0.05 | 0 |

`PresetPanel` 동작:
1. 마운트 시 `GET /api/stage-presets?artist=<slug>` → 목록을 이름 + `state.color` 점(색상 스와치)으로
   표시한다. 스와치는 목록 응답에 이미 포함된 `state`에서 바로 읽으므로 추가 요청이 없다 — 이름만
   나열했을 때보다 클릭 전에 "이게 그건가?"를 시각적으로 구분하기 쉬워져 오클릭 위험을 줄인다
2. 이름 클릭 → 받아온 `state`를 `mergeStageState`로 안전하게 병합해 씬에 반영 **+**
   `writeStageState`로 localStorage 작업 중 상태에도 반영(불러온 프리셋이 새 작업 기준점이 되도록,
   5.2의 2층 구조를 유지). **confirm도 로딩 표시도 없이 즉시 적용한다.**
   - 로딩 표시가 없는 이유: 목록 API가 `state`를 통째로 같이 내려주므로(5.2, N+1 방지) 클릭 시점엔
     이미 값이 클라이언트에 있다 — 기다릴 네트워크 왕복이 없다
   - confirm이 없는 이유: 슬라이더 조작(점진적·되돌리기 쉬움)과 달리 프리셋 불러오기는 클릭 한 번에
     전체 필드가 일괄·즉시 교체되고 되돌릴 수단이 없어 실수 위험도가 다르다는 건 맞다. 그럼에도
     confirm을 넣지 않는 건, 프리셋 기능의 핵심 사용 패턴이 "훑어보며 비교"라서 클릭마다 확인창이
     뜨면 그 흐름 자체가 막히고, "되돌리기"는 §10에서 이미 2차 범위 밖으로 명시돼 있어 confirm으로
     그 빈자리를 메우는 것도 방향이 안 맞기 때문이다. 대신 1번의 색상 스와치로 오클릭 자체를
     줄이는 쪽을 택한다
   - 호버 시 3D 미리보기는 채택하지 않는다: 적용된 상태와 별개로 "미리보기 전용" 임시 상태를 얹고
     호버 아웃 시 되돌리는 로직이 필요해 비용이 있는 데 비해, 사용자 1인당 프리셋 수가 많지 않을
     걸 감안하면 클릭 한 번으로 바로 결과를 보는 지금 흐름도 충분히 빠르다. 프리셋이 많아져
     훑어보기가 불편해지면 그때 재검토한다
3. 이름 입력 후 저장 버튼 → 5.2의 덮어쓰기 흐름
4. 각 항목 옆 삭제 버튼 → `DELETE`, `GalleryManager.tsx`의 `confirm()` 패턴 재사용

### 5.4 스모그

three.js 기본 `fog`(scene 레벨, `smoke.density`가 조밀도·`smoke.color`가 색) + drei `<Cloud>`(입자감)로
구현한다. **직접 쓰는 셰이더는 0줄이다.** 1차에서 91줄 커스텀 파티클 셰이더를 16줄 drei `Sparkles`로
교체한 이력이 있다(README 참조) — 같은 판단을 반복한다. `density`가 0이면 시각적으로 완전히 꺼진
것처럼 보이도록 한다(fog 생략 또는 `<Cloud>` opacity 0).

### 5.5 변경 파일

| 파일 | 작업 |
|---|---|
| `src/lib/stageState.ts` | 타입 확장, `mergeStageState`/`parseStageState` 재작성 (5.1) — TDD |
| `src/lib/stageState.test.ts` | 5.1 표의 케이스로 갱신 |
| `src/components/three/StageScene.tsx` | `Spot`이 스팟별 intensity/angle/penumbra를 받음, `CameraRig`가 `state.camera` 참조, fog + `<Cloud>` 추가 |
| `src/components/staff/StageControls.tsx` | 색상 자유 선택 추가, `SpotControls`/`SmokeControls`/`PresetPanel` 조합으로 재구성 |
| `src/components/staff/SpotControls.tsx` · `SmokeControls.tsx` · `PresetPanel.tsx` | 신규 |
| `src/app/api/stage-presets/route.ts` | 신규 — `GET`/`POST` |
| `src/app/api/stage-presets/[id]/route.ts` | 신규 — `DELETE` |
| `supabase/migrations/*.sql` | 변경 없음 — 4장에서 이미 완료 |

---

## 6. 반응형 (로드맵 3번 — 구현은 마지막)

- 브레이크포인트: Tailwind 기본 (`sm` 640 / `md` 768 / `lg` 1024). 커스텀 브레이크포인트 추가 금지
- 대응 우선순위: A탭 홈 → 아티스트 페이지 → B탭 대시보드 → 무대 툴
- **모바일 3D 전략(R3F 유지 + 예산 조정 / 정적 폴백)은 이 문서에서 정하지 않는다.** 4장과 7장 구현이
  레이아웃을 바꾸므로 그 뒤에 별도 브레인스토밍으로 결정한다

현재 앱 전체에 반응형 클래스가 **0개**다(`sm:` / `md:` / `lg:` 검색 결과 없음). 1차에서 의도적으로
데스크톱 전용으로 만든 결과이며, 알려진 데스크톱 가정은 다음과 같다.

| 위치 | 가정 |
|---|---|
| 갤러리 그리드, 대시보드 지표 카드 | `grid-cols-3` |
| 투어 섹션, 대시보드 하단 | `grid-cols-2` |
| 아티스트 페이지 히어로 | `text-[10rem]` |
| B탭 사이드바 | `w-56` 고정 |
| 무대 컨트롤 패널 | `w-72` 고정 |
| 무대 스튜디오 | `h-screen` + `overflow-hidden` |

---

## 7. B탭 잔여 메뉴 실 화면 (로드맵 4번)

**전제**: 여기서 붙는 CRUD는 4.5의 **역할 스코프**(`app_metadata.role = 'owner'`)로 막힌다. 4장의
소유 스코프(`created_by = auth.uid()`)와는 다른 정책이며, 소유 스코프가 적용되는 건 갤러리와
프리셋뿐이다. 따라서 공유 데모 계정으로 로그인한 방문자는 세 화면을 **읽기 전용으로** 본다.
서버 컴포넌트가 세션의 role 클레임을 읽어 편집 버튼을 비활성 렌더하되, **최종 게이트는 RLS이고
UI 비활성화는 안내용이다.** 2차의 핵심 시연 기능인 갤러리 업로드와 프리셋 저장은 데모 계정으로도
그대로 동작한다.

| 경로 | 깊이 | 내용 |
|---|---|---|
| `/staff/tours` | CRUD | `shows` 관리 (날짜·도시·베뉴·수용인원·`featured`) |
| `/staff/artists` | CRUD | `artists` 편집(색상·뉴스·투어 배지·셰이더 파라미터) + `tracks` CRUD + 갤러리 관리(4.6 업로드 재사용) |
| `/staff/tickets` | 조회 전용 | 공연별 판매율 테이블. 지표 파생의 원천이라 손으로 고치지 못하게 한다 |

`/staff/tickets`를 조회 전용으로 두는 이유는 편집 UI를 아끼려는 게 아니라, 대시보드 수치가 손으로
조작 가능해지면 파생 지표(4.2)의 신뢰도가 떨어지기 때문이다. 실제 예매 시스템도 판매량은 시스템이
쓰고 관계자는 본다.

**`/staff/stage`는 `(console)` 라우트 그룹 밖에 그대로 둔다.** 1차 설계(`docs/plan.md` Task 9, `docs/design.md`
5.3)부터 "풀스크린, 사이드바 없음 + 브레드크럼(`← 대시보드 / 무대 연출`)"은 의도된 결정이었다 —
버그였던 적이 없다. 7장 브레인스토밍 중 한 차례 "사이드바 일관성을 위해 `(console)` 안으로 옮기자"는
안이 나왔으나, 배포된 1차 화면에서 직접 브레드크럼 내비게이션을 다시 확인한 결과 이동·복귀 모두
막힘없이 자연스러웠고, 오히려 라우트 그룹으로 옮기면 사이드바 레이아웃(패딩 `px-10 py-8`, 밝은 톤)이
무대 스튜디오의 풀블리드 다크 3D 캔버스와 충돌해 별도 중첩 라우트 그룹까지 만들어야 했다. 그 구조
비용 대비 얻는 게 "사이드바의 '무대 연출' 항목이 활성 표시되는 것"뿐이라 되돌렸다. 1차의 stub 페이지
3개는 삭제한다.

### 7.1 `tracks` 소유 스코프 검토와 기각

브레인스토밍 중 `tracks`를 `gallery_images`처럼 소유 스코프(`created_by = auth.uid()`, 로그인한 누구나
추가하고 자기 것만 수정·삭제)로 바꾸는 안을 검토했다. 스키마상 불가능하진 않다 — `created_by` 컬럼을
추가하고 시드 트랙을 `created_by = NULL`로 넣으면 시드는 보호된다.

**기각한 이유는 순서변경과의 충돌이다.** 트랙 순서변경(7.3)은 인접한 두 트랙의 `no`를 서버가 swap하는
방식인데, 소유 스코프에서는 "내가 만든 행"만 UPDATE할 수 있다. 방문자가 자기 트랙을 시드 트랙 사이에
끼워넣으려 하면 인접한 시드 행(`created_by = NULL`)의 `no`는 RLS가 막아 swap이 반쪽만 성공하거나
`unique(artist_id, no)` 위반으로 실패한다. 이걸 풀려면 소유 경계를 넘는 재정렬 전용 경로(예: security
definer 함수)가 필요한데, 이는 4.5가 명시적으로 금지한 "service role 우회 제2경로"를 다시 만드는
셈이다. `gallery_images`에는 애초에 재정렬 기능이 없어(삽입 시 `max+1`만 함) 참고할 선례도 없다.

의미적으로도 `tracks`는 장식용 사진(아무나 올려도 무해)보다 `artists`/`shows`(아티스트를 대표하는
정보) 쪽에 가깝다 — 공유 데모 계정 방문자가 진짜 곡 사이에 가짜 트랙을 끼워넣을 수 있으면 4.5가
`artists`/`shows`를 역할 스코프로 묶은 이유가 그대로 적용된다. **`tracks`는 4.5에 정의된 대로 역할
스코프를 유지한다.**

### 7.2 `/staff/tours` — `shows` CRUD

아티스트별 스코프(`ArtistSelect` 재사용, `?artist=slug`) — dashboard/artists/stage와 동일한 패턴이라
화면 간 이동이 일관된다. 전체 아티스트를 한 테이블에 모으는 안은 기각했다 — 6명 합계 100개 안팎의
공연이 한 화면에 다 들어가면 스크롤만 길어지고, 지금 화면 구조(다른 세 화면 모두 아티스트 단위)와도
어긋난다.

UI는 테이블 인라인 행 편집이다 — 목록이 그대로 폼이 된다("편집" 클릭 시 그 행이 input으로 바뀌고
"저장"/"취소"). 맨 아래 "+ 공연 추가" 행. 모달 다이얼로그는 폼 전용 컴포넌트가 새로 필요한 데 비해
얻는 게 없어 기각했다.

**데이터**: `src/lib/data.ts`에 `getShows(slug): Promise<ShowRow[]>` 신규 — `getGalleryImages`와 동일
패턴(`getArtistId` → `eq(artist_id)` → `order(show_date)`).

**API**:

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `POST /api/shows` | `{ artistSlug, cityCode, cityName, country, venue, showDate, capacity, featured? }` | `201 { id }` / 같은 날짜·도시 이미 존재 → `409 { error: "duplicate" }` / 같은 날짜·다른 도시 이미 존재 → `409 { error: "date_conflict" }` |
| `PATCH /api/shows/[id]` | 수정할 필드만 부분 전송 | `200 {}` / RLS 0행 → `403` / (날짜·도시 변경 시) 위와 동일한 `409` 두 종류 |
| `DELETE /api/shows/[id]` | — | `204` / 0행 → `403` (`gallery/[id]/route.ts`와 동일 패턴 — 소유자 재확인 없이 RLS에 위임) |

**같은 날짜 충돌 판정**: 한 아티스트가 같은 날짜에 같은 도시 공연을 또 만들려 하면(회차 추가) 이
화면에서는 막고 "회차 추가는 문의"로 안내한다 — DB의 `unique(artist_id,city_code,show_date)` 제약이
그대로 이걸 막아준다. 그런데 이 제약은 **다른 도시**면 같은 날짜라도 통과시킨다 — 한 아티스트가
같은 날 서울과 LA에 동시에 있는 것 같은, 물리적으로 불가능한 조합이 생겨도 DB는 모른다. 그래서
API가 insert/update 전에 "같은 artist_id + 같은 show_date" 행이 있는지 먼저 조회해서, 있고 도시가
다르면 `date_conflict`로 막는다. DB 제약은 그대로 두고(마이그레이션 없음), 이 조건부 규칙만
애플리케이션 레벨에서 체크한다 — 단순 `UNIQUE`로는 "다른 행이 있는데 도시만 다르면 막는다"를
표현할 수 없어서다. 트리거로 DB에 넣는 대안도 있었으나, 이 프로젝트에 트리거가 하나도 없는
상태에서 규칙 하나 때문에 새로 들이는 건 과하다고 판단해 기각했다.

### 7.3 `/staff/artists` — 편집 폼 + `tracks` CRUD + 기존 갤러리

**아티스트 편집 폼**(단일 레코드라 테이블이 아니라 폼 섹션): 색상(`<input type="color">`, 5장에서 이미
쓴 패턴 재사용) · 뉴스 · 투어 배지(`tour_badge`) · 투어명(`tour_title_ko`) · 투어 연도(`tour_year`) ·
셰이더 파라미터(`shader_pattern` select `wave`/`ripple`/`grain` + `shader_freq`/`shader_falloff`/
`shader_speed` number). 셰이더 파라미터는 8장이 비주얼 반영을 붙이기 전까지는 값만 저장된다 —
그때 가서 입력 UI를 다시 만들지 않도록 미리 붙여 둔다(8장 전제).

`slug`/`name`/`orbit`/`angle`/`size`/`stat_tracks`는 편집 대상에서 뺀다. A탭 홈 궤도 레이아웃과
지표 파생에 관여하는 필드라 잘못 바꾸면 다른 화면이 깨지고, 문서 §7 원안의 편집 필드 목록에도 없다.

**데이터**: `getArtistRow(slug): Promise<ArtistRow | undefined>` 신규 — `getArtist`는 화면용 `Artist`
타입으로 변환해 셰이더 파라미터 등 원본 컬럼을 잃어버리므로, 편집 폼은 원본 행을 그대로 쓰는 별도
쿼리가 필요하다. `getTracks(slug): Promise<TrackRow[]>` 신규 — `no` 오름차순.

**API (아티스트)**: `PATCH /api/artists/[id]` 뿐이다. 생성·삭제는 없다 — 아티스트는 시드가 만든 6명
고정이고 문서 어디에도 아티스트 생성·삭제 요구가 없다.

**tracks 섹션**: `/staff/tours`와 같은 테이블 인라인 행 패턴(no·title·duration·cover_from·cover_to +
위/아래 버튼 + 삭제, 맨 아래 "+ 트랙 추가"). `cover_from`/`cover_to`는 `<input type="color">` 2개
(실 커버아트가 없어 2스톱 그라디언트로 대체하는 기존 방식 그대로).

**순서변경**: 위/아래 버튼 → 클릭한 행과 인접 행의 `id`+`no`를 이미 클라이언트가 들고 있다. 드래그 앤
드롭 라이브러리는 쓰지 않는다 — 트랙 수가 적어(대표곡 4개 안팎) 버튼으로도 불편함이 거의 없다.
`tracks`가 역할 스코프(7.1)라 오너만 쓰는 경로이므로 소유 경계로 인한 swap 실패는 없고, 실패한다면
네트워크 문제뿐이다.

경계 판정(맨 위 트랙의 "위로", 맨 아래 트랙의 "아래로" 비활성화)은 순수 함수로 뺀다 —
`neighborSwap(tracks: TrackRow[], id: string, direction: "up" | "down"): [TrackRow, TrackRow] | null`
(`no` 기준 정렬 후 인접 쌍을 찾고, 경계거나 id를 못 찾으면 `null`). `TracksManager` 컴포넌트가 버튼
`disabled` 여부와 클릭 핸들러 양쪽에서 이 함수를 재사용한다.

> 구현 에이전트 주의: **`PATCH`를 두 번 호출해 `no`를 직접 swap하지 않는다.** `unique(artist_id, no)`
> 제약 때문에 A의 `no`를 B의 값으로 바꾸는 순간 B가 아직 그 값을 갖고 있어 `23505`가 난다(두 값이
> 이미 둘 다 점유된 상태라 두 번의 단일 행 업데이트로는 어떤 순서로도 충돌을 피할 수 없다). 대신
> **임시값을 경유하는 3단계**로 처리한다: ① A → 아무도 안 쓰는 임시값(`no` 컬럼이 `smallint`이므로
> 그 최댓값 `32767`을 쓴다) ② B → A의 원래 `no` ③ A → B의 원래 `no`. 각 단계가 끝날 때마다 그
> 값이 비므로 다음 단계가 충돌하지 않는다.

> 구현 에이전트 주의: `no` 숫자 직접 입력 방식은 채택하지 않았다. 사용자가 중복값을 직접 넣으면
> `unique(artist_id, no)` 위반으로 DB 에러가 나고, "순서 바꾸기"가 아니라 "번호 편집"으로 체감이
> 달라진다는 이유로 기각했다(브레인스토밍에서 명시적으로 비교 후 결정).

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `POST /api/tracks` | `{ artistSlug, title, duration, coverFrom, coverTo }` | `201 { id }` — `no`는 서버가 현재 최댓값+1로 계산(`gallery/route.ts`의 `sort_order` 패턴과 동일) |
| `PATCH /api/tracks/[id]` | 수정할 필드(순서변경은 이 엔드포인트를 두 번 호출) | `200 {}` / 0행 → `403` |
| `DELETE /api/tracks/[id]` | — | `204` / 0행 → `403` |

### 7.4 `/staff/tickets` — 조회 전용

**데이터**: `getShowStatusList(slug): Promise<ShowStatusRow[]>` 신규 — `show_status` 뷰를 `featured`
필터 없이 전체, `show_date` 오름차순(`getFeaturedShows`에서 `featured` 조건만 뺀 버전).

**UI**: `ArtistSelect` + `<table>`(도시·베뉴·날짜·정원·판매량·예매율). 클라이언트 컴포넌트를 만들지
않고 서버 컴포넌트에서 바로 렌더한다 — 편집 상태가 없으니 클라이언트 컴포넌트로 쪼갤 이유가 없다.

### 7.5 데모 계정 읽기 전용 게이팅

`getStaffRoleLabel(): Promise<"관리자" | "게스트">`를 `getStaffRole(): Promise<{ isOwner: boolean;
label: "관리자" | "게스트" }>`로 확장한다. 기존 호출부(`Sidebar`)는 `label`만 꺼내 쓰면 되므로 시그니처가
깨지지 않는다.

각 페이지(서버 컴포넌트)가 `isOwner`를 편집 컴포넌트(`ToursManager`/`ArtistEditForm`/`TracksManager`)에
prop으로 내려주고, 편집·추가·삭제 버튼과 입력 필드에 `disabled={!isOwner}` + 안내 문구
("관리자만 편집할 수 있습니다")를 붙인다. 폼 자체는 항상 렌더하되 조작만 막는다 — 숨기지 않는다.
**최종 게이트는 어디까지나 RLS이고 이 비활성화는 안내용이다**(문서 §7 도입부 원안 그대로).

### 7.6 폼 검증 수준

서버는 기존 패턴(필드 존재 확인)을 유지하고, 숫자 필드(`capacity`, `shader_freq` 등)는 `Number()`
캐스팅 실패 시 `400`을 추가한다. `capacity > 0`, `unique` 제약 등은 DB가 최종 방어선이라 그 이상의
서버 검증(zod 등 라이브러리 도입)은 하지 않는다. 클라이언트는 `required`/`min`/`max`/
`type="date"|"number"|"color"` 네이티브 HTML 제약만 쓴다.

### 7.7 변경 파일

| 파일 | 작업 |
|---|---|
| `src/lib/data.ts` | `getShows`, `getArtistRow`, `getTracks`, `getShowStatusList` 추가, `getStaffRoleLabel` → `getStaffRole` |
| `src/lib/trackOrder.ts` | 신규 — `neighborSwap` 순수 함수, TDD 대상 |
| `src/app/staff/(console)/layout.tsx` | `getStaffRoleLabel()` → `getStaffRole()` 호출로 조정(`label`만 꺼내 `Sidebar`에 전달, `Sidebar.tsx` 자체는 무변경) |
| `src/app/staff/(console)/tours/page.tsx` | stub 삭제 → 구현 |
| `src/app/staff/(console)/artists/page.tsx` | 편집 폼 + tracks 섹션 추가 (갤러리 섹션은 유지) |
| `src/app/staff/(console)/tickets/page.tsx` | stub 삭제 → 구현 |
| `src/components/staff/ToursManager.tsx` · `ArtistEditForm.tsx` · `TracksManager.tsx` | 신규 |
| `src/app/api/shows/route.ts` · `shows/[id]/route.ts` | 신규 |
| `src/app/api/artists/[id]/route.ts` | 신규 |
| `src/app/api/tracks/route.ts` · `tracks/[id]/route.ts` | 신규 |
| `supabase/migrations/*.sql` | 변경 없음 — 역할 스코프 RLS는 4.5에서 이미 적용됨 |

---

## 8. 셰이더 심화 (로드맵 5번)

1차의 셰이더는 `HeroBackground` 하나뿐이고 아티스트별 차이는 **`uColor` 하나**다. 파동 주파수, 글로우
감쇠, 속도가 6명 모두 같다.

**`artists` 테이블의 `shader_*` 컬럼 4개가 유니폼을 구동한다.** 셰이더 파일을 아티스트 수만큼 늘리지
않고 하나를 유지하며, `shader_pattern` enum 3종(`wave` / `ripple` / `grain`)은 프래그먼트 내 분기
하나로 처리한다. 파라미터 조절 UI는 7장의 `/staff/artists` 화면에 붙는다 — DB가 비주얼을 구동하므로
관리자가 실시간으로 무드를 바꿀 수 있다.

`OrbitScene` 노드까지 셰이더를 확장하는 것은 이번 스코프 밖이다.

> 구현 에이전트 주의: `docs/design.md:125`는 `artists.json`에 "셰이더 테마" 필드가 있다고 적었으나
> 실제로는 없다. 1차 설계와 구현이 어긋난 지점이며, 이 장이 그 격차를 메우는 작업이다.

`shader_*` 컬럼과 입력 UI(select + number 3개)는 이미 4장·7장에서 만들어졌다 — 이 장은 그 값을 A탭
`HeroBackground` 셰이더에 실제로 반영하는 것만 다룬다. DB 기본값(`freq=9`, `falloff=0.75`, `speed=0.5`,
`pattern='wave'`)이 `HeroBackground.tsx`의 기존 하드코딩 값과 정확히 일치하므로, wave 기본 렌더링은
이번 작업으로 시각적으로 달라지지 않는다. `scripts/seed.mjs`는 이미 6명에게 pattern 3종 + `freq
6~14` / `falloff 0.55~0.9` / `speed 0.35~0.8` 범위로 값을 분산 배정해뒀다 — 이게 실사용 자연 범위다.

### 8.1 데이터 흐름 — `Artist` 타입 확장

`getArtist()`가 반환하는 화면용 `Artist` 타입(`src/lib/types.ts`)에는 셰이더 필드가 없다 — `ArtistRow`
(DB 행 타입)에만 있고 `toArtist()` 변환 과정에서 버려진다. `HeroBackground`를 쓰는
`src/app/artists/[slug]/page.tsx`는 `getArtist()`를 쓰므로, 타입 확장 없이는 셰이더 파라미터가 화면까지
닿지 않는다.

`tour: { badge, titleKo, year }`와 같은 기존 중첩 패턴을 따라 `Artist`에 `shader: { pattern, freq,
falloff, speed }`를 추가한다. `ArtistEditForm.tsx`에 로컬로만 정의돼 있던 `type ShaderPattern = "wave" |
"ripple" | "grain"`을 `src/lib/types.ts`로 승격해 양쪽이 재사용한다.

`ARTIST_SELECT`(`"*, tracks(*), shows(*), gallery_images(*)"`)가 이미 `artists.*`를 통째로 읽어오므로,
`toArtist()`에 매핑 4줄만 추가하면 된다 — 쿼리 변경도, 추가 왕복도 없다.

`HeroBackground` props를 `{ color: string }`에서 `{ color: string; shader: ArtistShader }`로 확장하고,
`artists/[slug]/page.tsx`에서 `<HeroBackground color={artist.color} shader={artist.shader} />`로 호출부를
바꾼다.

### 8.2 GLSL 패턴 3종

프래그먼트 셰이더 내 분기 하나로 처리한다(§8 원안 그대로) — 패턴별 함수 분리나 별도 셰이더 파일은
만들지 않는다. `uPattern`(0=wave/1=ripple/2=grain)은 `GlowPlane`이 `shader.pattern` 문자열을
`useMemo`에서 숫자로 매핑해 유니폼으로 넘긴다.

기존 `wave` 항의 `p`(중심 기준 uv, `p = vUv - 0.5`)와 `d`(글로우용 반지름, `d = length(p * vec2(1.4,
1.0))`)를 세 패턴이 공유한다.


코드 증가는 +15줄 안팎이고 새 의존성은 없다.

### 8.3 파라미터 매핑과 범위

| 필드 | 유니폼 | 매핑 | 검증된 범위 |
|---|---|---|---|
| `shader_freq` | `uFreq` | 그대로 대입 | 서버·폼 모두 무제한(얕은 검증 원칙) — 시드 실사용값 6~14 |
| `shader_falloff` | `uFalloff` | 그대로 대입 | 폼 `min={0} max={1}` + 서버 `0~1` 검증 — `smoothstep(uFalloff, 0.0, d)`의 자연 정의역과 이미 일치, 스케일 조정 불필요 |
| `shader_speed` | `uSpeed` | 그대로 대입, `uTime * uSpeed`로 사용 | 서버 `≥0`만 검증 — 시드 실사용값 0.35~0.8 |
| `shader_pattern` | `uPattern` | 클라이언트에서 문자열→0/1/2 변환 | `wave`/`ripple`/`grain` 3종 고정(서버가 이미 검증) |

새 서버/폼 검증은 추가하지 않는다 — 기존 범위(falloff 0~1, speed ≥0)가 셰이더 정의역과 이미 맞고,
freq는 원래도 무제한이었다(§7.6 얕은 검증 원칙 유지).

### 8.4 변경 파일

| 파일 | 작업 |
|---|---|
| `src/lib/types.ts` | `ShaderPattern` 타입 신규(공용화), `Artist`에 `shader: { pattern, freq, falloff, speed }` 추가 |
| `src/lib/data.ts` | `toArtist()`에 `shader` 필드 매핑 추가 |
| `src/components/three/HeroBackground.tsx` | `shader` prop 추가, fragment 셰이더에 `uFreq`/`uFalloff`/`uSpeed`/`uPattern` 유니폼과 패턴 분기 추가 |
| `src/app/artists/[slug]/page.tsx` | `<HeroBackground>` 호출부에 `shader={artist.shader}` 전달 |
| `src/components/staff/ArtistEditForm.tsx` | 로컬 `ShaderPattern` 타입 제거, `@/lib/types`에서 import |

---

## 9. 개발 워크플로우 (2차)

1차 프로세스를 그대로 유지한다 ([`docs/design.md`](./design.md) 7장).

```
[설계]  이 문서 = 승인된 설계 (brainstorming 완료)
[계획]  writing-plans        → 항목별 구현 계획 생성
[구현]  executing-plans      → 배치 실행 + 사람 체크포인트
[품질]  TDD (범위 한정, 아래)
        requesting-code-review → /ponytail-review
        verification-before-completion
[머지]  finishing-a-development-branch → PR 생성
        react-doctor + npm test CI → 이슈 시 receiving-code-review 루프 → merge
```

### 9.1 유지되는 1차 원칙

| 원칙 | 2차에서의 의미 |
|---|---|
| 클라이언트는 API Routes 경유 | 제약 4번. Supabase 키가 브라우저에 나가지 않는다 (4.6의 서명 URL 포함) |
| 서버 컴포넌트가 초기 데이터 조회 | 선택된 아티스트가 URL 쿼리(`?artist=`)에 있는 구조를 유지해 서버 컴포넌트로 남긴다 |
| TDD는 로직 레이어만 | 2차 대상: `metricsView`(4.3), `parseStageState` 병합(5장), `staffRedirectPath`(유지) |
| R3F·셰이더는 브라우저 시각 검증 | 5장·8장은 Playwright 스크린샷으로 확인 |

vitest는 `environment: "node"`를 **유지한다.** 3D 컴포넌트를 import할 수 없다는 사실이 형식적 테스트를
막는 실질적 강제 장치이기 때문이며, 1차에서 이 제약 덕분에 상태 로직이 `src/lib/stageState.ts`로
분리됐다.

### 9.2 문서화

- README의 2차 로드맵 섹션을 진행 상황에 맞게 갱신
- Supabase Auth 도입에 따른 인증 플로우 문서 추가 (`docs/design.md` 7.4의 예고 이행)
- 1차와 동일하게 각 항목의 계획 요약과 검증 노트를 공개 문서로 남긴다 (제약 6번)

---

## 10. 범위 제외 (2차 기준 명시적 Out of Scope)

- 별도 백엔드 서버 (제약 1번)
- 회원가입 · 비밀번호 재설정 · 소셜 로그인 — 계정은 시드가 만든 둘뿐
- 실 결제 / 예매 기능
- 다국어(i18n)
- 이미지 자동 리사이즈 · 썸네일 파이프라인 — 업로드된 원본을 그대로 쓴다
- 감사 로그 · 소프트 삭제 · 되돌리기
- `tracks` 편집 UI (4장 스코프에서는 읽기 전용, 7장에서 붙는다)
- `OrbitScene` 셰이더화 (8장 스코프 밖)

> 구현 에이전트 주의: 위 항목을 선제적으로 구현하지 말 것 (YAGNI).

---

## 11. 완료 기준

### 4장 · Supabase 전환

- [x] **6개 테이블 전부 RLS가 활성화돼 있다.** 아래 쿼리의 `relrowsecurity`가 모두 `t`여야 한다.
      정책이 있어도 이게 `f`면 전부 무시되므로, 정책 존재 여부와 별개로 반드시 확인한다
      ```sql
      select relname, relrowsecurity from pg_class
      where relname in ('artists','tracks','shows','ticket_sales','gallery_images','stage_presets');
      ```
- [x] `src/data/*.json`을 import하는 앱 코드가 0개 (시드 스크립트만 읽는다)
- [x] `NEXT_PUBLIC_` 접두사 환경변수가 0개 — 브라우저 번들에 Supabase 키가 없다
- [x] `scripts/seed.mjs`를 두 번 연속 실행해도 모든 테이블의 행 수가 같고, **두 번째 실행이 종료 코드
      0으로 끝난다.** 행 수만 보면 마지막 단계(계정 생성)에서 죽은 것을 놓친다 — 앞 단계는 이미
      반영된 뒤이기 때문이다
- [x] 데모 계정으로 시드 갤러리 이미지 삭제를 시도하면 RLS에 막힌다
- [x] 데모 계정으로 `artists` / `shows` UPDATE를 시도하면 막히고, 오너 계정으로는 통과한다
- [x] B탭에서 이미지를 업로드하면 A탭 갤러리에 반영되고, 같은 계정으로 되돌려 지울 수 있다
- [x] 대시보드 d-day가 오늘 날짜 기준으로 계산된다 (박제된 값이 아니다)
- [x] `npm test`가 CI에서 돌고 통과한다 — PR #10 기준 GitHub Actions `test` 워크플로우 통과 확인
      (https://github.com/areumz/on-stage/actions/runs/31866943418)
- [ ] Vercel 배포 URL에서 A탭·B탭 전체 플로우가 1차와 동일하게 동작한다 — **미확인**: 배포된 적
      없음. Vercel에 `SUPABASE_URL`·`SUPABASE_ANON_KEY` 환경변수 등록 + 배포 후 재확인 필요

### 5장 · 무대 연출 툴

- [x] 새 필드가 없는 구버전 저장 상태를 로드해도 기존 필드가 유지된다 (병합 폴백)
- [x] 1차 저장값(`spots.left: true` 같은 boolean, `angle` 키)을 로드하면 `color`는 유지되고
      `spots`/`camera`만 기본값으로 리셋된다 (5.1에서 합의된 동작, 버그 아님)
- [x] 슬라이더 조작이 R3F 씬에 실시간 반영된다 (시각 검증)
- [x] 프리셋을 저장한 뒤 로그아웃 → 재로그인해도 남아 있다
- [x] 프리셋 이름이 겹치면 확인 없이 덮어써지지 않는다 (409 → confirm → overwrite)
- [x] 프리셋 목록에 이름 옆 색상 스와치가 표시된다 (오클릭 방지, 5.3)
- [x] 직접 작성한 셰이더 코드가 0줄이다

### 6장 · 반응형

> 모바일 3D 전략이 미정이라 완료 기준을 아직 정의할 수 없다(6장).
> 별도 브레인스토밍 완료 후 이 절을 채운다.

### 7장 · B탭 잔여 메뉴

- [x] 사이드바 메뉴 5개 모두 실 화면으로 연결되고 stub이 없다
- [x] `/staff/stage`는 `(console)` 밖에서 브레드크럼 내비게이션으로 계속 동작한다 (의도된 유지, §7 참고)
- [x] 데모 계정에서 세 화면(`tours`/`artists`/`tickets`)이 읽기 전용으로 보인다 — 편집 버튼이 비활성 렌더되고, 그 상태로 API를 직접 호출해도 RLS가 막는다(403)
- [x] 오너 계정으로 `/staff/tours`에서 공연을 추가·수정·삭제하면 같은 아티스트의 `/staff/tickets`·A탭 투어 궤도(`featured`)에 반영된다
- [x] `/staff/artists`에서 셰이더 파라미터를 바꿔 저장해도(8장 미착수 상태라) A탭 히어로에는 아직 반영되지 않는다 — 값만 정상 저장되는지 DB로 확인
- [x] tracks 위/아래 버튼으로 순서를 바꾸면 `no`가 정상 swap되고, 새로고침 후에도 순서가 유지된다
- [x] tracks/shows 둘 다 데모 계정으로 쓰기를 시도하면 막히고 오너 계정으로는 통과한다 (4.5 역할 스코프가 7장 API에도 그대로 적용됨을 재확인)

### 8장 · 셰이더 심화

- [x] 6명의 히어로 배경이 색상 외에도 서로 다르게 보인다 (시각 검증)
- [x] `/staff/artists`에서 파라미터를 바꾸면 A탭 히어로에 반영된다
