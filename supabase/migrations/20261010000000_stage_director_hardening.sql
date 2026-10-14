-- 무대 연출 디렉터 보강: 비로그인(anon)이 DB 함수를 직접 호출하지 못하게 막고 Data API 권한을 명시한다.
-- 20261009000000_stage_director.sql 적용 후 실행한다. 여러 번 실행해도 안전하다.
--
-- 배경: `revoke ... from public` 은 default privileges 로 anon 에게 따로 부여된 EXECUTE 를 지우지 못한다.
-- 실제로 anon 키로 bump_feedback 이 실행되는 것을 확인했다. claim_daily_run 도 같은 상태라면
-- 로그인하지 않은 누구나 하루 한도를 소진시킬 수 있다.

-- 1) 함수는 로그인한 사용자(authenticated)만 실행한다
revoke execute on function claim_daily_run(int) from public, anon;
revoke execute on function bump_feedback(uuid) from public, anon;
grant execute on function claim_daily_run(int) to authenticated;
grant execute on function bump_feedback(uuid) to authenticated;

-- 2) 새 테이블이 Data API 에 자동 노출되는 동작(auto_expose_new_tables)은 곧 사라진다.
--    그 뒤에도 같은 권한이 유지되도록 필요한 권한을 명시한다. anon 에는 아무것도 주지 않는다.
revoke all on audio_tracks, stage_sequences, daily_run_usage from anon;

grant select, insert, update, delete on audio_tracks to authenticated;
grant select, insert, delete on stage_sequences to authenticated;
grant update (status, items, approved_at) on stage_sequences to authenticated;  -- feedback_count 는 함수로만

-- 시드 스크립트(service role)용
grant all on audio_tracks, stage_sequences, daily_run_usage to service_role;
