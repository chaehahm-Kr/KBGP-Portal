-- 0133_company_user_permissions.sql — DATA-JSON-MIG-002
-- 브랜드 포털 사용자 권한(9개 메뉴 ACL + 역할 프리셋)을 company_users.permissions JSON
-- 에서 정식 테이블로 옮긴다. 이 마이그레이션은 테이블 생성 + 기존 JSON 복사만 하고,
-- JSON 원본은 지우지 않는다(코드 전환·검증 후 별도 단계에서 정리).
--
-- 값 해석은 lib/permissions/brand-portal-acl.ts 의 normalizePermissions/parseAclLevel
-- 과 같다: 프리셋 기본값을 깔고, JSON 에 있는 카테고리 값만 덮어쓴다.

create table if not exists public.company_user_permissions (
  user_id uuid primary key references public.company_users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  preset text not null default 'viewer'
    check (preset in ('restricted', 'viewer', 'staff', 'manager', 'admin')),
  application text not null default 'none' check (application in ('none', 'read', 'write', 'manage')),
  brands text not null default 'none' check (brands in ('none', 'read', 'write', 'manage')),
  products text not null default 'none' check (products in ('none', 'read', 'write', 'manage')),
  orders text not null default 'none' check (orders in ('none', 'read', 'write', 'manage')),
  finance text not null default 'none' check (finance in ('none', 'read', 'write', 'manage')),
  support text not null default 'none' check (support in ('none', 'read', 'write', 'manage')),
  company_info text not null default 'none' check (company_info in ('none', 'read', 'write', 'manage')),
  bank_info text not null default 'none' check (bank_info in ('none', 'read', 'write', 'manage')),
  agreements text not null default 'none' check (agreements in ('none', 'read', 'write', 'manage')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_company_user_permissions_company_id
  on public.company_user_permissions (company_id);

comment on table public.company_user_permissions is
  '브랜드 포털 사용자별 메뉴 권한(ACL). company_users.permissions JSON 의 권한 항목을 대체한다.';

alter table public.company_user_permissions enable row level security;
alter table public.company_user_permissions force row level security;

-- 읽기: 같은 회사 사용자와 Admin. 쓰기 정책은 두지 않는다 — 권한 변경은 서버(권한 검증 후
-- service role)로만 한다. 사용자가 브라우저에서 자기 권한을 올리는 것을 DB가 막는다.
drop policy if exists "company_user_permissions_select_same_company_or_admin" on public.company_user_permissions;
create policy "company_user_permissions_select_same_company_or_admin"
  on public.company_user_permissions for select
  to authenticated
  using (company_id = public.auth_company_id() or public.auth_is_admin());

-- 기존 JSON → 테이블 복사 (이미 행이 있으면 건너뜀: 재실행 안전)
with src as (
  select
    cu.id as user_id,
    cu.company_id,
    case when jsonb_typeof(cu.permissions) = 'object' then cu.permissions else '{}'::jsonb end as p,
    coalesce(
      case when jsonb_typeof(cu.permissions) = 'object' then cu.permissions->>'preset' end,
      case when jsonb_typeof(cu.permissions) = 'object' then cu.permissions->>'role' end,
      cu.company_role
    ) as preset_key
  from public.company_users cu
  where cu.company_id is not null
),
preset as (
  select
    s.*,
    case
      when s.preset_key in ('company_admin', 'admin') then 'admin'
      when s.preset_key in ('restricted', 'company_restricted') then 'restricted'
      when s.preset_key in ('staff', 'company_staff') then 'staff'
      when s.preset_key in ('manager', 'company_manager') then 'manager'
      else 'viewer'
    end as preset_name
  from src s
),
defaults(preset_name, application, brands, products, orders, finance, support, company_info, bank_info, agreements) as (
  values
    ('restricted', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none'),
    ('viewer', 'read', 'read', 'read', 'read', 'read', 'read', 'read', 'none', 'none'),
    ('staff', 'write', 'write', 'write', 'write', 'read', 'write', 'read', 'none', 'none'),
    ('manager', 'write', 'write', 'manage', 'manage', 'write', 'manage', 'write', 'read', 'read'),
    ('admin', 'manage', 'manage', 'manage', 'manage', 'manage', 'manage', 'manage', 'manage', 'manage')
)
insert into public.company_user_permissions (
  user_id, company_id, preset,
  application, brands, products, orders, finance, support, company_info, bank_info, agreements
)
select
  p.user_id,
  p.company_id,
  p.preset_name,
  -- parseAclLevel: edit→write, full/admin→manage, 그 외 알 수 없는 값→none, 키 없음→프리셋 기본값
  case when p.p ? 'application' then case p.p->>'application' when 'read' then 'read' when 'write' then 'write' when 'edit' then 'write' when 'manage' then 'manage' when 'full' then 'manage' when 'admin' then 'manage' else 'none' end else d.application end,
  case when p.p ? 'brands' then case p.p->>'brands' when 'read' then 'read' when 'write' then 'write' when 'edit' then 'write' when 'manage' then 'manage' when 'full' then 'manage' when 'admin' then 'manage' else 'none' end else d.brands end,
  case when p.p ? 'products' then case p.p->>'products' when 'read' then 'read' when 'write' then 'write' when 'edit' then 'write' when 'manage' then 'manage' when 'full' then 'manage' when 'admin' then 'manage' else 'none' end else d.products end,
  case when p.p ? 'orders' then case p.p->>'orders' when 'read' then 'read' when 'write' then 'write' when 'edit' then 'write' when 'manage' then 'manage' when 'full' then 'manage' when 'admin' then 'manage' else 'none' end else d.orders end,
  case when p.p ? 'finance' then case p.p->>'finance' when 'read' then 'read' when 'write' then 'write' when 'edit' then 'write' when 'manage' then 'manage' when 'full' then 'manage' when 'admin' then 'manage' else 'none' end else d.finance end,
  case when p.p ? 'support' then case p.p->>'support' when 'read' then 'read' when 'write' then 'write' when 'edit' then 'write' when 'manage' then 'manage' when 'full' then 'manage' when 'admin' then 'manage' else 'none' end else d.support end,
  case when p.p ? 'company_info' then case p.p->>'company_info' when 'read' then 'read' when 'write' then 'write' when 'edit' then 'write' when 'manage' then 'manage' when 'full' then 'manage' when 'admin' then 'manage' else 'none' end else d.company_info end,
  case when p.p ? 'bank_info' then case p.p->>'bank_info' when 'read' then 'read' when 'write' then 'write' when 'edit' then 'write' when 'manage' then 'manage' when 'full' then 'manage' when 'admin' then 'manage' else 'none' end else d.bank_info end,
  case when p.p ? 'agreements' then case p.p->>'agreements' when 'read' then 'read' when 'write' then 'write' when 'edit' then 'write' when 'manage' then 'manage' when 'full' then 'manage' when 'admin' then 'manage' else 'none' end else d.agreements end
from preset p
join defaults d on d.preset_name = p.preset_name
on conflict (user_id) do nothing;
