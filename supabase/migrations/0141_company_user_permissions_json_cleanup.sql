-- 0141_company_user_permissions_json_cleanup.sql — DATA-JSON-CLEAN-002
-- company_users.permissions JSON 에서 권한 키(9개 메뉴 + preset/role)를 지운다.
-- 권한은 0133 의 company_user_permissions 테이블이 정본이고, 코드도 테이블만 읽고 쓴다(ae95e6a).
-- 이름·연락처·OTP·알림 읽음 기록 등 나머지 키는 남긴다.
-- 되돌릴 수 있도록 지우기 전 원본 JSON 을 company_users_permissions_json_backup 에 남긴다.
-- 테이블 행이 없는 사용자는 권한 키를 지우지 않는다(코드가 JSON 으로 대체해 읽는다).

create table if not exists public.company_users_permissions_json_backup (
  user_id uuid primary key references public.company_users(id) on delete cascade,
  permissions jsonb not null,
  backed_up_at timestamptz not null default now()
);

comment on table public.company_users_permissions_json_backup is
  'DATA-JSON-CLEAN-002: 권한 키 정리 전 company_users.permissions 원본 백업. 확인 후 별도 승인으로 삭제.';

alter table public.company_users_permissions_json_backup enable row level security;
alter table public.company_users_permissions_json_backup force row level security;

insert into public.company_users_permissions_json_backup (user_id, permissions)
select cu.id, cu.permissions
from public.company_users cu
where jsonb_typeof(cu.permissions) = 'object'
  and cu.permissions ?| array['application', 'brands', 'products', 'orders', 'finance', 'support', 'company_info', 'bank_info', 'agreements', 'preset', 'role']
  and exists (select 1 from public.company_user_permissions p where p.user_id = cu.id)
on conflict (user_id) do nothing;

update public.company_users cu
set permissions = cu.permissions - array['application', 'brands', 'products', 'orders', 'finance', 'support', 'company_info', 'bank_info', 'agreements', 'preset', 'role']
where jsonb_typeof(cu.permissions) = 'object'
  and cu.permissions ?| array['application', 'brands', 'products', 'orders', 'finance', 'support', 'company_info', 'bank_info', 'agreements', 'preset', 'role']
  and exists (select 1 from public.company_user_permissions p where p.user_id = cu.id)
  and exists (select 1 from public.company_users_permissions_json_backup b where b.user_id = cu.id);
