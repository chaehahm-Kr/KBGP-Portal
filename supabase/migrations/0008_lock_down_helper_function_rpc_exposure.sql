-- 0008: get_advisors가 찾아낸 문제 — RLS 정책 내부에서만 쓰려고 만든 헬퍼 함수들이
-- PostgREST에 의해 /rest/v1/rpc/... 로 외부에서 직접 호출 가능하게 노출되어 있었다.
-- anon 롤의 EXECUTE 권한을 걷어내도 authenticated 롤이 RLS 정책 평가 중에 이 함수를
-- 호출하는 경로에는 영향이 없다(RLS는 그 정책을 적용받는 authenticated 롤 기준으로
-- 평가되지, anon 기준이 아니기 때문). handle_new_user()는 트리거 전용이라 트리거
-- 실행 자체(= auth.users insert 시 자동 실행)에는 영향 없이 anon/authenticated 양쪽
-- 모두에서 직접 호출을 막아도 안전하다.
--
-- 주의: 이 마이그레이션은 의도한 효과가 없었다 (0009 참고). anon/authenticated
-- 롤에는 직접 GRANT된 적이 없고, 함수 생성 시 기본으로 EXECUTE가 PUBLIC에 부여되므로
-- PUBLIC 경유로 여전히 실행 가능했다. 히스토리 보존을 위해 그대로 남겨둔다.

revoke execute on function public.auth_company_id() from anon;
revoke execute on function public.auth_is_admin() from anon;
revoke execute on function public.auth_is_super_admin() from anon;
revoke execute on function public.generate_application_number() from anon;
revoke execute on function public.handle_new_user() from anon, authenticated;
