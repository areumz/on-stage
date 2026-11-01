-- A탭 디스코그래피 실제 음원: tracks.audio_path + 공개 music 버킷
-- 음원은 git에 넣지 않고 seed가 public/music/<slug>/NN.*.mp3 를 music/<slug>/NN.mp3 로 올린다
-- (Storage 키는 한글 불가라 번호만). 팬 페이지는 비로그인이라 gallery처럼 공개 버킷.

alter table tracks add column if not exists audio_path text; -- NULL = 음원 없음

insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('music', 'music', true, array['audio/mpeg'], 15728640)
on conflict (id) do nothing;
