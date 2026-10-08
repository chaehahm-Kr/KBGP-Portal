-- 0142_company_user_permissions_backfill.sql — DATA-JSON-CLEAN-002
-- 입점 초대 흐름(lib/application/invitation-actions.ts)이 company_user_permissions 행을 만들지 않아
-- 권한 행이 없는 사용자가 생겼다(코드는 이번에 수정). 역할 기본값으로 행을 채운다. 재실행 안전.

insert into public.company_user_permissions (
  user_id, company_id, preset,
  application, brands, products, orders, finance, support, company_info, bank_info, agreements
)
select
  cu.id,
  cu.company_id,
  case when cu.company_role = 'company_admin' then 'admin' else 'viewer' end,
  case when cu.company_role = 'company_admin' then 'manage' else 'read' end,
  case when cu.company_role = 'company_admin' then 'manage' else 'read' end,
  case when cu.company_role = 'company_admin' then 'manage' else 'read' end,
  case when cu.company_role = 'company_admin' then 'manage' else 'read' end,
  case when cu.company_role = 'company_admin' then 'manage' else 'read' end,
  case when cu.company_role = 'company_admin' then 'manage' else 'read' end,
  case when cu.company_role = 'company_admin' then 'manage' else 'read' end,
  case when cu.company_role = 'company_admin' then 'manage' else 'none' end,
  case when cu.company_role = 'company_admin' then 'manage' else 'none' end
from public.company_users cu
where cu.company_id is not null
  and not exists (select 1 from public.company_user_permissions p where p.user_id = cu.id)
on conflict (user_id) do nothing;
