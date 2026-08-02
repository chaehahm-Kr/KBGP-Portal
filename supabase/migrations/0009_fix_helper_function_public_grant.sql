-- 0008에서 anon/authenticated에서 개별 REVOKE를 했지만 효과가 없었다: Postgres는
-- CREATE FUNCTION 시 기본적으로 EXECUTE를 PUBLIC(모든 롤이 암묵적으로 속하는 의사-롤)에
-- 부여하는데, anon/authenticated는 PUBLIC 경유로 여전히 실행 권한을 상속받고 있었다.
-- PUBLIC에서 직접 걷어내고, RLS 정책·앱 코드가 실제로 필요로 하는 곳에만 authenticated로
-- 다시 명시적으로 부여한다.

revoke execute on function public.auth_company_id() from public;
revoke execute on function public.auth_is_admin() from public;
revoke execute on function public.auth_is_super_admin() from public;
revoke execute on function public.generate_application_number() from public;
revoke execute on function public.handle_new_user() from public;

-- RLS 정책들이 policy 평가 중에 이 함수들을 authenticated 세션 기준으로 호출하므로
-- authenticated 롤에는 EXECUTE가 반드시 필요하다.
grant execute on function public.auth_company_id() to authenticated;
grant execute on function public.auth_is_admin() to authenticated;
grant execute on function public.auth_is_super_admin() to authenticated;

-- lib/application/actions.ts의 submitApplication()이 authenticated 세션으로
-- supabase.rpc("generate_application_number")를 직접 호출한다.
grant execute on function public.generate_application_number() to authenticated;

-- handle_new_user()는 auth.users insert 트리거 전용이며 트리거 실행은 호출자의
-- EXECUTE grant와 무관하게 동작하므로, anon/authenticated 어느 쪽에도 부여하지 않는다.
