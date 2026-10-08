-- 0147_drop_json_cleanup_backups.sql — DATA-JSON-CLEAN-005
-- JSON 정리(0140/0141/0143/0145) 때 만든 원본 백업 테이블을 지운다.
-- 사용자 승인(2026-10-08): 정리 결과를 운영에서 확인했고 더 이상 되돌릴 필요가 없다.
-- 되돌릴 수 없는 삭제다.

drop table if exists public.brands_intro_json_backup;
drop table if exists public.company_users_permissions_json_backup;
drop table if exists public.companies_intro_json_backup;
