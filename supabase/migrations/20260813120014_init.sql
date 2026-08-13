-- 2.1 Supabase 전환 — 테이블 6개 + RLS + 뷰 2개 + Storage 버킷/정책
-- 단일 진실 공급원: docs/design-v2.md 4장 (§4.1 스키마, §4.2 뷰, §4.5 RLS)
-- 셋을 한 파일에 묶는 이유: 쪼개면 테이블은 있는데 RLS가 없는 창이 생기고,
-- 그 상태로 시드가 돌면 정책 검증 없이 데이터가 들어간다.

-- ── §4.1 스키마 ──────────────────────────────────────────────

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

-- ── §4.5 RLS ─────────────────────────────────────────────────

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

create policy "public read"  on tracks for select using (true);
create policy "owner writes" on tracks for all to authenticated
  using      (auth.jwt() #>> '{app_metadata,role}' = 'owner')
  with check (auth.jwt() #>> '{app_metadata,role}' = 'owner');

create policy "public read"  on shows for select using (true);
create policy "owner writes" on shows for all to authenticated
  using      (auth.jwt() #>> '{app_metadata,role}' = 'owner')
  with check (auth.jwt() #>> '{app_metadata,role}' = 'owner');

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

-- ── §4.2 뷰 ──────────────────────────────────────────────────

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

-- ── Storage 버킷 gallery ─────────────────────────────────────
-- public read, 허용 MIME 3종, 10MB 상한 (Task 7이 Vercel의 4.5MB 바디 제한 우회를
-- 그보다 큰 파일로 증명해야 하므로 4.5MB보다 커야 한다).

insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('gallery', 'gallery', true,
        array['image/jpeg', 'image/png', 'image/webp'],
        10485760);

-- Storage 정책: 시드는 service role로 올려 owner가 NULL → 방문자가 못 지움 (테이블 정책과 대칭)
create policy "public read"   on storage.objects for select using (bucket_id = 'gallery');
create policy "authed upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and owner = auth.uid());
create policy "own delete"    on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and owner = auth.uid());
