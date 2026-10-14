-- 무대 연출 디렉터: audio_tracks, stage_sequences, 하루 카운터, audio-tracks 버킷 정책
-- 근거: 계약서 부록 A + 확정된 UI 목업. 연출 이름은 "곡 제목 · 날짜"로 만들어 보여 주므로 컬럼이 없다.

-- ── audio_tracks ─────────────────────────────────────────────
create table audio_tracks (
  id              uuid primary key default gen_random_uuid(),     -- POST /analyze 의 jobId
  user_id         uuid references auth.users default auth.uid(),  -- NULL = 시드 곡
  artist_id       uuid not null references artists on delete cascade,
  title           text not null,
  genre           text,
  mood_keywords   text[],
  storage_path    text not null unique,
  file_hash       text,                                           -- 분석 완료 때 Python 값으로 채움
  duration_sec    numeric not null check (duration_sec > 0 and duration_sec <= 301), -- Python 은 301초까지 허용
  analysis        jsonb,
  analysis_status text not null default 'pending'
                  check (analysis_status in ('pending','running','done','error')),
  created_at      timestamptz not null default now()
);
create index audio_tracks_user_idx on audio_tracks (user_id);

alter table audio_tracks enable row level security;
create policy "read own or seed" on audio_tracks for select
  using (user_id is null or user_id = auth.uid());
create policy "own insert" on audio_tracks for insert to authenticated
  with check (user_id = auth.uid());
create policy "own update" on audio_tracks for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own delete" on audio_tracks for delete to authenticated
  using (user_id = auth.uid());

-- ── stage_sequences ──────────────────────────────────────────
create table stage_sequences (
  id              uuid primary key default gen_random_uuid(),     -- = Python 의 threadId
  user_id         uuid not null references auth.users default auth.uid(),
  audio_track_id  uuid not null references audio_tracks on delete cascade,
  status          text not null default 'draft' check (status in ('draft','approved')),
  items           jsonb,                                          -- 승인 전 NULL
  feedback_count  smallint not null default 0 check (feedback_count between 0 and 3),
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  check ((status = 'draft'    and items is null     and approved_at is null)
      or (status = 'approved' and items is not null and approved_at is not null))
);
-- 곡당 동시 초안 1개 ((사용자, 곡) 단위). 라우트 검사만 두면 동시 요청에 뚫려서 DB 가 막는다.
-- 곡이 다르면 초안이 여러 개여도 된다 — 비용은 하루 한도(DAILY_RUN_LIMIT)가 막는다.
create unique index stage_sequences_one_draft on stage_sequences (user_id, audio_track_id) where status = 'draft';
create index stage_sequences_track_idx on stage_sequences (audio_track_id, user_id);

alter table stage_sequences enable row level security;
create policy "own read" on stage_sequences for select to authenticated
  using (user_id = auth.uid());
create policy "own insert" on stage_sequences for insert to authenticated
  with check (user_id = auth.uid() and status = 'draft' and feedback_count = 0
              and exists (select 1 from audio_tracks t where t.id = audio_track_id)); -- 내 곡 또는 시드만
create policy "own update" on stage_sequences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own delete" on stage_sequences for delete to authenticated
  using (user_id = auth.uid());

-- feedback_count 는 직접 못 고치게 하고 아래 함수로만 올린다 (3회 한도 우회 방지)
revoke update on stage_sequences from authenticated;
grant update (status, items, approved_at) on stage_sequences to authenticated;

-- ── 하루 "연출 만들기" 카운터 (Gemini 무료 한도 보호) ──────────────
create table daily_run_usage (
  day  date primary key,           -- 태평양 시간 기준 (Google RPD 초기화 기준과 같게)
  runs int not null default 0
);
alter table daily_run_usage enable row level security;   -- 정책 없음 = 직접 접근 불가
revoke all on daily_run_usage from anon, authenticated;

-- true = 이번 시도가 카운트됨(허용), false = 오늘 한도 소진. 데모 곡·다시 생성은 호출하지 않는다.
create function claim_daily_run(p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_day  date := (now() at time zone 'America/Los_Angeles')::date;
  v_runs int;
begin
  insert into daily_run_usage (day) values (v_day) on conflict (day) do nothing;
  update daily_run_usage set runs = runs + 1
   where day = v_day and runs < p_limit returning runs into v_runs;
  return v_runs is not null;
end $$;
revoke all on function claim_daily_run(int) from public;
grant execute on function claim_daily_run(int) to authenticated;

-- 다시 생성 1회 차감. 값이 돌아오면 허용, NULL 이면 한도 초과이거나 내 초안이 아님
create function bump_feedback(p_id uuid) returns smallint
language plpgsql security definer set search_path = public as $$
declare v smallint;
begin
  update stage_sequences set feedback_count = feedback_count + 1
   where id = p_id and user_id = auth.uid() and status = 'draft' and feedback_count < 3
   returning feedback_count into v;
  return v;
end $$;
revoke all on function bump_feedback(uuid) from public;
grant execute on function bump_feedback(uuid) to authenticated;

-- ── Storage: audio-tracks 버킷 (이미 있으면 건너뜀) ───────────────
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('audio-tracks', 'audio-tracks', false,
        array['audio/mpeg','audio/wav','audio/x-wav','audio/flac','audio/x-flac','audio/ogg'],
        31457280)
on conflict (id) do nothing;

-- 경로 규칙: <user_id>/<uuid>.<확장자>, 시드는 seed/<파일>
drop policy if exists "audio own upload" on storage.objects;
create policy "audio own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'audio-tracks' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "audio read own or seed" on storage.objects;   -- 서명 URL 발급에 필요
create policy "audio read own or seed" on storage.objects for select to authenticated
  using (bucket_id = 'audio-tracks'
         and ((storage.foldername(name))[1] = auth.uid()::text or (storage.foldername(name))[1] = 'seed'));

drop policy if exists "audio own delete" on storage.objects;
create policy "audio own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'audio-tracks' and (storage.foldername(name))[1] = auth.uid()::text);
