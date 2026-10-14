-- 연출 이름: 사용자가 붙인 이름. null 이면 화면에서 "곡 제목 · 날짜 시간"으로 만들어 보여 준다(기존 연출은 그대로).
-- 1~40자(앞뒤 공백 제외). 같은 이름이 여러 개 있어도 된다.
alter table stage_sequences
  add column if not exists name text check (name is null or char_length(btrim(name)) between 1 and 40);

-- 열 단위 권한: 이름은 내가 고친다 (RLS 의 "own update" 가 내 연출만 허용). feedback_count 는 여전히 직접 못 고친다.
grant update (name) on stage_sequences to authenticated;
