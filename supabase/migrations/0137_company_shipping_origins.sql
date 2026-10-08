-- 0137_company_shipping_origins.sql — DATA-JSON-MIG-005
-- 출고지를 companies.intro JSON(shipping_origins 배열)에서 company_shipping_origins 테이블로 옮긴다.
--
-- 0086_company_shipping_origins 를 그대로 적용하지 않는 이유:
--  * company_shipping_origins_write_portal 정책이 같은 회사 사용자라면 권한(company_info)과 관계없이
--    브라우저에서 직접 출고지를 만들고 지울 수 있게 한다. 코드는 모두 서버(service role)로 쓰므로
--    쓰기 정책은 두지 않고 읽기(같은 회사/Admin)만 허용한다.
-- 0089(warehouses.shipping_origin_id)는 창고 코드 범위라 이번 단계에서 다루지 않는다.
--
-- 코드(lib/company/shipping-origin-actions.ts)는 테이블 우선 읽기 + JSON 백업 쓰기다.
-- 출고지 id 는 창고 internal_note 의 [ORIGIN_ID:...] 와 PO 요청에서 참조하므로 JSON id 를 그대로 쓴다
-- (uuid 가 아니면 md5 로 고정 변환). JSON 원본은 지우지 않는다. 재실행 안전.
-- SQL Editor 에서 문장마다 따로 실행돼도 되도록 임시 테이블/함수를 쓰지 않는다.

create table if not exists public.company_shipping_origins (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  contact_name text,
  phone text,
  email text,
  country text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state_province text,
  postal_code text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.company_shipping_origins is '회사별 출고지(Ship From) 정보. companies.intro JSON 의 shipping_origins 를 대체한다.';

create index if not exists idx_company_shipping_origins_company_id
  on public.company_shipping_origins(company_id);
create index if not exists idx_company_shipping_origins_company_default
  on public.company_shipping_origins(company_id, is_default);

alter table public.company_shipping_origins enable row level security;
alter table public.company_shipping_origins force row level security;

drop policy if exists "company_shipping_origins_write_admin" on public.company_shipping_origins;
drop policy if exists "company_shipping_origins_write_portal" on public.company_shipping_origins;
drop policy if exists "company_shipping_origins_select" on public.company_shipping_origins;
create policy "company_shipping_origins_select"
  on public.company_shipping_origins for select
  to authenticated
  using (public.auth_is_admin() or public.auth_company_id() = company_id);

-- JSON → 테이블 복사
insert into public.company_shipping_origins (
  id, company_id, name, is_default, contact_name, phone, email, country,
  address_line1, address_line2, city, state_province, postal_code, status, notes,
  created_at, updated_at, created_by, updated_by
)
select
  case
    when (o.value->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (o.value->>'id')::uuid
    when coalesce(o.value->>'id', '') = '' then md5(co.id::text || ':origin:' || o.ord)::uuid
    else md5(o.value->>'id')::uuid
  end,
  co.id,
  coalesce(nullif(o.value->>'name', ''), '출고지 ' || o.ord),
  coalesce(o.value->>'is_default' = 'true', false),
  o.value->>'contact_name',
  o.value->>'phone',
  o.value->>'email',
  coalesce(o.value->>'country', ''),
  coalesce(o.value->>'address_line1', ''),
  o.value->>'address_line2',
  coalesce(o.value->>'city', ''),
  o.value->>'state_province',
  coalesce(o.value->>'postal_code', ''),
  case when o.value->>'status' = 'inactive' then 'inactive' else 'active' end,
  o.value->>'notes',
  coalesce(case when (o.value->>'created_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (o.value->>'created_at')::timestamptz end, now()),
  coalesce(case when (o.value->>'updated_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (o.value->>'updated_at')::timestamptz end, now()),
  (select u.id from auth.users u where u.id::text = o.value->>'created_by'),
  (select u.id from auth.users u where u.id::text = o.value->>'updated_by')
from public.companies co
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(substring(co.intro from length('__COMPANY_METADATA__:') + 1)::jsonb->'shipping_origins') = 'array'
      then substring(co.intro from length('__COMPANY_METADATA__:') + 1)::jsonb->'shipping_origins'
    else '[]'::jsonb
  end
) with ordinality as o(value, ord)
where co.intro like '__COMPANY_METADATA__:%'
  and jsonb_typeof(o.value) = 'object'
on conflict (id) do nothing;

-- PO 요청의 출고지 연결(0136 에서 미뤄 둔 FK). 지금 없는 출고지를 가리키면 비운다.
update public.po_requests r
set shipping_origin_id = null
where r.shipping_origin_id is not null
  and not exists (select 1 from public.company_shipping_origins o where o.id = r.shipping_origin_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'po_requests_shipping_origin_id_fkey') then
    alter table public.po_requests
      add constraint po_requests_shipping_origin_id_fkey
      foreign key (shipping_origin_id) references public.company_shipping_origins(id) on delete set null;
  end if;
end $$;
