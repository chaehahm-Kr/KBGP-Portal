-- 0136_po_requests_tables.sql — DATA-JSON-MIG-004
-- PO 요청을 companies.intro JSON(po_requests 배열)에서 정식 테이블로 옮긴다.
--
-- 0092_po_requests_workflow 를 그대로 적용하지 않는 이유:
--  * shipping_origin_id 가 아직 없는 company_shipping_origins(0086, 5단계)를 참조해 실패한다.
--    → 칸만 만들고 FK 는 5단계에서 건다.
--  * 정책이 FOR ALL USING (true) 라 로그인한 누구나(익명 포함) 모든 회사 요청을 읽고 쓸 수 있다.
--    → 같은 회사 사용자/Admin 읽기만 허용, 쓰기는 서버(service role)만.
-- po_requests 는 0127 이 만든 4칸 임시 테이블(0행)이 이미 있으므로 칸을 추가한다.
--
-- 코드(lib/purchase-order/request-actions.ts)는 이미 테이블 우선 읽기 + JSON 백업 쓰기다.
-- 칸이 생기는 순간 테이블에 행이 있으면 JSON 을 보지 않으므로, 같은 트랜잭션에서 JSON 을 복사한다.
-- JSON id 가 uuid 가 아니면 md5(id)::uuid 로 고정 변환한다(다시 실행해도 같은 id).
-- JSON 원본은 지우지 않는다. 재실행 안전.

-- 1. po_requests 칸
alter table public.po_requests
  add column if not exists request_number text,
  add column if not exists company_id uuid references public.companies(id) on delete restrict,
  add column if not exists contact_user_id uuid references public.company_users(id) on delete set null,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists shipping_origin_id uuid,
  add column if not exists requested_ready_date date,
  add column if not exists status text not null default 'DRAFT',
  add column if not exists notes text,
  add column if not exists admin_review_notes text,
  add column if not exists change_request_reason text,
  add column if not exists rejection_reason text,
  add column if not exists converted_po_id uuid references public.purchase_orders(id) on delete set null,
  add column if not exists converted_po_number text,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists converted_at timestamptz,
  add column if not exists created_by uuid,
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'po_requests_status_check') then
    alter table public.po_requests add constraint po_requests_status_check
      check (status in ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGE_REQUESTED', 'CONVERTED_TO_PO', 'REJECTED', 'CANCELLED'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'po_requests_request_number_key') then
    alter table public.po_requests add constraint po_requests_request_number_key unique (request_number);
  end if;
end $$;

create index if not exists idx_po_requests_company_id on public.po_requests(company_id);
create index if not exists idx_po_requests_status on public.po_requests(status);
create index if not exists idx_po_requests_created_at on public.po_requests(created_at desc);
create index if not exists idx_po_requests_converted_po_id on public.po_requests(converted_po_id);

-- 2. 품목 / 이력 / 첨부
create table if not exists public.po_request_lines (
  id uuid primary key default gen_random_uuid(),
  po_request_id uuid not null references public.po_requests(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name_snapshot text not null,
  letusto_sku_snapshot text,
  manufacture_sku_snapshot text,
  requested_qty int not null check (requested_qty > 0),
  reference_unit_cost numeric(15, 4) not null default 0,
  estimated_line_total numeric(15, 4) not null default 0,
  admin_final_qty int,
  admin_final_unit_cost numeric(15, 4),
  admin_final_line_total numeric(15, 4),
  line_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_po_request_lines_request_id on public.po_request_lines(po_request_id);
create index if not exists idx_po_request_lines_product_id on public.po_request_lines(product_id);

create table if not exists public.po_request_history (
  id uuid primary key default gen_random_uuid(),
  po_request_id uuid not null references public.po_requests(id) on delete cascade,
  action text not null,
  actor_id uuid,
  actor_name text,
  actor_role text,
  notes text,
  created_at timestamptz default now()
);
create index if not exists idx_po_request_history_request_id on public.po_request_history(po_request_id);
create index if not exists idx_po_request_history_created_at on public.po_request_history(created_at desc);

create table if not exists public.po_request_attachments (
  id uuid primary key default gen_random_uuid(),
  po_request_id uuid not null references public.po_requests(id) on delete cascade,
  file_name text not null,
  file_size bigint,
  mime_type text,
  storage_path text not null,
  uploaded_by uuid,
  created_at timestamptz default now()
);
create index if not exists idx_po_request_attachments_request_id on public.po_request_attachments(po_request_id);

-- 3. RLS: 같은 회사 사용자와 Admin 만 읽기. 쓰기 정책 없음(서버 service role 만).
alter table public.po_requests enable row level security;
alter table public.po_requests force row level security;
alter table public.po_request_lines enable row level security;
alter table public.po_request_lines force row level security;
alter table public.po_request_history enable row level security;
alter table public.po_request_history force row level security;
alter table public.po_request_attachments enable row level security;
alter table public.po_request_attachments force row level security;

drop policy if exists "Service role full access on po_requests" on public.po_requests;
drop policy if exists "Service role full access on po_request_lines" on public.po_request_lines;
drop policy if exists "Service role full access on po_request_history" on public.po_request_history;
drop policy if exists "Service role full access on po_request_attachments" on public.po_request_attachments;

drop policy if exists "po_requests_select_same_company_or_admin" on public.po_requests;
create policy "po_requests_select_same_company_or_admin" on public.po_requests
  for select to authenticated
  using (company_id = public.auth_company_id() or public.auth_is_admin());

drop policy if exists "po_request_lines_select_same_company_or_admin" on public.po_request_lines;
create policy "po_request_lines_select_same_company_or_admin" on public.po_request_lines
  for select to authenticated
  using (exists (select 1 from public.po_requests r where r.id = po_request_id
                 and (r.company_id = public.auth_company_id() or public.auth_is_admin())));

drop policy if exists "po_request_history_select_same_company_or_admin" on public.po_request_history;
create policy "po_request_history_select_same_company_or_admin" on public.po_request_history
  for select to authenticated
  using (exists (select 1 from public.po_requests r where r.id = po_request_id
                 and (r.company_id = public.auth_company_id() or public.auth_is_admin())));

drop policy if exists "po_request_attachments_select_same_company_or_admin" on public.po_request_attachments;
create policy "po_request_attachments_select_same_company_or_admin" on public.po_request_attachments
  for select to authenticated
  using (exists (select 1 from public.po_requests r where r.id = po_request_id
                 and (r.company_id = public.auth_company_id() or public.auth_is_admin())));

-- 4. JSON → 테이블 복사
-- SQL Editor 는 문장마다 따로 실행될 수 있어 임시 테이블/함수를 쓰지 않고, 각 문장이 같은 src 를
-- 직접 계산한다. JSON id 가 uuid 가 아니면 md5 로 고정 변환해 문장 사이·재실행에서 같은 id 가 된다.
with src as (
  select
    co.id as company_id,
    r.value as r,
    case
      when (r.value->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (r.value->>'id')::uuid
      when coalesce(r.value->>'id', '') = '' then md5(co.id::text || ':req:' || r.ord)::uuid
      else md5(r.value->>'id')::uuid
    end as req_id
  from public.companies co
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(substring(co.intro from length('__COMPANY_METADATA__:') + 1)::jsonb->'po_requests') = 'array'
        then substring(co.intro from length('__COMPANY_METADATA__:') + 1)::jsonb->'po_requests'
      else '[]'::jsonb
    end
  ) with ordinality as r(value, ord)
  where co.intro like '__COMPANY_METADATA__:%'
    and jsonb_typeof(r.value) = 'object'
)
insert into public.po_requests (
  id, request_number, company_id, contact_user_id, contact_name, contact_email,
  shipping_origin_id, requested_ready_date, status, notes, admin_review_notes,
  change_request_reason, rejection_reason, converted_po_id, converted_po_number,
  submitted_at, reviewed_at, converted_at, created_by, created_at, updated_at,
  admin_read_at, admin_read_by
)
select
  s.req_id,
  coalesce(nullif(s.r->>'request_number', ''), 'PR-MIG-' || left(replace(s.req_id::text, '-', ''), 8)),
  s.company_id,
  (select cu.id from public.company_users cu where cu.id::text = s.r->>'contact_user_id'),
  s.r->>'contact_name',
  s.r->>'contact_email',
  case when (s.r->>'shipping_origin_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ((s.r->>'shipping_origin_id'))::uuid end,
  case when (s.r->>'requested_ready_date') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then left(s.r->>'requested_ready_date', 10)::date end,
  case when s.r->>'status' in ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGE_REQUESTED', 'CONVERTED_TO_PO', 'REJECTED', 'CANCELLED')
       then s.r->>'status' else 'DRAFT' end,
  s.r->>'notes',
  s.r->>'admin_review_notes',
  s.r->>'change_request_reason',
  s.r->>'rejection_reason',
  (select po.id from public.purchase_orders po where po.id::text = s.r->>'converted_po_id'),
  s.r->>'converted_po_number',
  case when (s.r->>'submitted_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then ((s.r->>'submitted_at'))::timestamptz end,
  case when (s.r->>'reviewed_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then ((s.r->>'reviewed_at'))::timestamptz end,
  case when (s.r->>'converted_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then ((s.r->>'converted_at'))::timestamptz end,
  case when (s.r->>'created_by') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ((s.r->>'created_by'))::uuid end,
  coalesce(case when (s.r->>'created_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then ((s.r->>'created_at'))::timestamptz end, now()),
  coalesce(case when (s.r->>'updated_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then ((s.r->>'updated_at'))::timestamptz end, case when (s.r->>'created_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then ((s.r->>'created_at'))::timestamptz end, now()),
  case when (s.r->>'admin_read_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then ((s.r->>'admin_read_at'))::timestamptz end,
  (select u.id from auth.users u where u.id::text = s.r->>'admin_read_by')
from src s
-- id 나 request_number 가 겹치는 요청은 건너뛴다(검증 SQL 로 개수 비교)
on conflict do nothing;

-- 품목: 지금 없는 제품이나 수량 0 이하 품목은 FK/CHECK 위반이라 건너뛴다(검증 SQL 로 개수 비교)
with src as (
  select
    co.id as company_id,
    r.value as r,
    case
      when (r.value->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (r.value->>'id')::uuid
      when coalesce(r.value->>'id', '') = '' then md5(co.id::text || ':req:' || r.ord)::uuid
      else md5(r.value->>'id')::uuid
    end as req_id
  from public.companies co
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(substring(co.intro from length('__COMPANY_METADATA__:') + 1)::jsonb->'po_requests') = 'array'
        then substring(co.intro from length('__COMPANY_METADATA__:') + 1)::jsonb->'po_requests'
      else '[]'::jsonb
    end
  ) with ordinality as r(value, ord)
  where co.intro like '__COMPANY_METADATA__:%'
    and jsonb_typeof(r.value) = 'object'
)
insert into public.po_request_lines (
  id, po_request_id, product_id, product_name_snapshot, letusto_sku_snapshot, manufacture_sku_snapshot,
  requested_qty, reference_unit_cost, estimated_line_total, admin_final_qty, admin_final_unit_cost,
  admin_final_line_total, line_note, created_at, updated_at
)
select
  case
    when (l.value->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (l.value->>'id')::uuid
    else md5(s.req_id::text || ':line:' || coalesce(l.value->>'id', '') || ':' || l.ord)::uuid
  end,
  s.req_id,
  p.id,
  coalesce(nullif(l.value->>'product_name_snapshot', ''), p.name),
  l.value->>'letusto_sku_snapshot',
  l.value->>'manufacture_sku_snapshot',
  (l.value->>'requested_qty')::numeric::int,
  coalesce((l.value->>'reference_unit_cost')::numeric, 0),
  coalesce((l.value->>'estimated_line_total')::numeric, 0),
  (l.value->>'admin_final_qty')::numeric::int,
  (l.value->>'admin_final_unit_cost')::numeric,
  (l.value->>'admin_final_line_total')::numeric,
  l.value->>'line_note',
  coalesce(case when (l.value->>'created_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then ((l.value->>'created_at'))::timestamptz end, now()),
  coalesce(case when (l.value->>'updated_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then ((l.value->>'updated_at'))::timestamptz end, now())
from src s
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.r->'lines') = 'array' then s.r->'lines' else '[]'::jsonb end
) with ordinality as l(value, ord)
join public.products p on p.id::text = l.value->>'product_id'
where exists (select 1 from public.po_requests pr where pr.id = s.req_id)
  and case when (l.value->>'requested_qty') ~ '^[0-9]+(\.[0-9]+)?$' then (l.value->>'requested_qty')::numeric >= 1 else false end
  and coalesce(l.value->>'reference_unit_cost', '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
  and coalesce(l.value->>'estimated_line_total', '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
  and coalesce(l.value->>'admin_final_qty', '0') ~ '^[0-9]+(\.[0-9]+)?$'
  and coalesce(l.value->>'admin_final_unit_cost', '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
  and coalesce(l.value->>'admin_final_line_total', '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
on conflict (id) do nothing;

with src as (
  select
    co.id as company_id,
    r.value as r,
    case
      when (r.value->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (r.value->>'id')::uuid
      when coalesce(r.value->>'id', '') = '' then md5(co.id::text || ':req:' || r.ord)::uuid
      else md5(r.value->>'id')::uuid
    end as req_id
  from public.companies co
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(substring(co.intro from length('__COMPANY_METADATA__:') + 1)::jsonb->'po_requests') = 'array'
        then substring(co.intro from length('__COMPANY_METADATA__:') + 1)::jsonb->'po_requests'
      else '[]'::jsonb
    end
  ) with ordinality as r(value, ord)
  where co.intro like '__COMPANY_METADATA__:%'
    and jsonb_typeof(r.value) = 'object'
)
insert into public.po_request_history (
  id, po_request_id, action, actor_id, actor_name, actor_role, notes, created_at
)
select
  case
    when (h.value->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (h.value->>'id')::uuid
    else md5(s.req_id::text || ':hist:' || coalesce(h.value->>'id', '') || ':' || h.ord)::uuid
  end,
  s.req_id,
  coalesce(nullif(h.value->>'action', ''), 'MIGRATED'),
  case when (h.value->>'actor_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ((h.value->>'actor_id'))::uuid end,
  h.value->>'actor_name',
  h.value->>'actor_role',
  h.value->>'notes',
  coalesce(case when (h.value->>'created_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then ((h.value->>'created_at'))::timestamptz end, now())
from src s
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.r->'history') = 'array' then s.r->'history' else '[]'::jsonb end
) with ordinality as h(value, ord)
where exists (select 1 from public.po_requests pr where pr.id = s.req_id)
  and jsonb_typeof(h.value) = 'object'
on conflict (id) do nothing;
