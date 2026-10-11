-- 무대 장면 확장: 배경(backdrop)·먼지(dust)·바닥 반사(reflection)·소품(props) + 배경 이미지.
-- 구간별 backdrop/dust/reflection 은 stage_sequences.items(jsonb) 안에 이미 들어갈 수 있어서 컬럼이 필요 없다.

-- ── stage_sequences ──────────────────────────────────────────
-- props: Python 이 제안한 곡 전체 소품. null = 정하지 않음, '[]' = 소품 없음 (둘을 같은 값으로 저장하면 안 된다)
-- scene_edit: 사용자가 재생 화면에서 고친 값 { backdrop?, sections?, props? }. AI 값보다 우선하며, AI 값(items·props)은 그대로 둬서 "AI 제안으로 되돌리기"가 가능하다.
alter table stage_sequences
  add column if not exists props jsonb check (props is null or jsonb_typeof(props) = 'array'),
  add column if not exists scene_edit jsonb check (scene_edit is null or jsonb_typeof(scene_edit) = 'object');

-- 열 단위 권한: 기존 (status, items, approved_at) 에 두 열을 더한다. feedback_count 는 여전히 직접 못 고친다.
grant update (props, scene_edit) on stage_sequences to authenticated;

-- ── stage_presets ────────────────────────────────────────────
-- scene: 기존 "무대 연출" 메뉴의 장면 { backdrop, dust, reflection, props, sampleImage }.
-- state 와 Python 계약(presets[].state)은 건드리지 않으려고 별도 열로 둔다. null 인 기존 프리셋은 장면 없음.
alter table stage_presets
  add column if not exists scene jsonb check (scene is null or jsonb_typeof(scene) = 'object');

-- ── 배경 이미지 Storage ───────────────────────────────────────
-- 경로 규칙: <user_id>/<sequence_id>/<uuid>.<확장자> (재생 화면), <user_id>/studio/<uuid>.<확장자> (기존 무대 연출 메뉴). 내 폴더만 읽고 쓴다(비공개 버킷, 서명 URL 은 <img> 에만).
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('stage-backdrops', 'stage-backdrops', false,
        array['image/jpeg','image/png','image/webp'],
        5242880)
on conflict (id) do update set public = false, allowed_mime_types = excluded.allowed_mime_types, file_size_limit = excluded.file_size_limit;

-- 업로드는 (a) "내 승인된 연출"의 폴더 <uid>/<sequence_id>/ 또는 (b) 기존 "무대 연출" 메뉴용 <uid>/studio/ 에만,
-- 폴더당 50장까지(제품 한도가 아니라 스토리지 남용 방지용 안전 상한). API 의 검사와 별개로 여기가 최종 방어선이다(Storage 를 JWT 로 직접 부르는 경우까지 막는다).
-- 경로는 정확히 두 단계 폴더다. 'studio' 는 uuid 가 아니라서 연출 id 와 겹치지 않는다.
drop policy if exists "backdrop own upload" on storage.objects;
create policy "backdrop own upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'stage-backdrops'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[1] = auth.uid()::text
    and (
      (storage.foldername(name))[2] = 'studio'
      or exists (select 1 from stage_sequences s
                  where s.id::text = (storage.foldername(name))[2] and s.user_id = auth.uid() and s.status = 'approved')
    )
    and (select count(*) from storage.objects o
          where o.bucket_id = 'stage-backdrops'
            and (storage.foldername(o.name))[1] = (storage.foldername(name))[1]
            and (storage.foldername(o.name))[2] = (storage.foldername(name))[2]) < 50
  );

drop policy if exists "backdrop own read" on storage.objects;   -- 서명 URL 발급과 목록 조회에 필요
create policy "backdrop own read" on storage.objects for select to authenticated
  using (bucket_id = 'stage-backdrops' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "backdrop own delete" on storage.objects;
create policy "backdrop own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'stage-backdrops' and (storage.foldername(name))[1] = auth.uid()::text);
