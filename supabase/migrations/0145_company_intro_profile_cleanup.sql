-- 0145_company_intro_profile_cleanup.sql — DATA-JSON-CLEAN-004
-- companies.intro 메타데이터 JSON 에서 회사 기본 정보 키를 지우고, 동기화 트리거(0135/0144)를 없앤다.
-- 코드는 6a60672 부터 회사 기본 정보를 companies 칸/company_contacts 에서만 읽고 쓴다.
-- intro JSON 에는 type/types/status/notifications 만 남는다.
-- 원본은 0143 의 companies_intro_json_backup 에 이미 있고, 그 뒤에 생긴 회사만 여기서 추가로 백업한다.

insert into public.companies_intro_json_backup (company_id, intro)
select id, intro
from public.companies
where intro like '__COMPANY_METADATA__:%'
on conflict (company_id) do nothing;

drop trigger if exists trg_companies_sync_profile_columns on public.companies;
drop trigger if exists trg_companies_sync_contacts on public.companies;
drop function if exists public.sync_company_profile_columns();
drop function if exists public.sync_company_contacts();

update public.companies c
set intro = '__COMPANY_METADATA__:' || ((substring(c.intro from length('__COMPANY_METADATA__:') + 1)::jsonb
  - array['description', 'address', 'address_1', 'address_2', 'city', 'state', 'zip_code', 'website', 'admin_memo',
          'logo_path', 'contacts', 'company_onboarding_confirmed_at', 'admin_profile_onboarding_confirmed_at',
          'brand_onboarding_confirmed_at', 'team_onboarding_skipped'])::text)
where c.intro like '__COMPANY_METADATA__:%'
  and c.profile_migrated_at is not null
  and exists (select 1 from public.companies_intro_json_backup b where b.company_id = c.id);
