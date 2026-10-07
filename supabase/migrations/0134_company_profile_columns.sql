-- 0134_company_profile_columns.sql — DATA-JSON-MIG-003
-- 회사 기본 정보(소개, 웹사이트, 메모, 로고, 주소, 온보딩 진행 상태)를 companies.intro 의
-- __COMPANY_METADATA__ JSON 에서 companies 정식 칸으로, 연락처(contacts 배열)를
-- company_contacts 테이블로 옮긴다. 칸/테이블 생성 + 기존 JSON 복사만 하고 JSON 원본은
-- 지우지 않는다(코드 전환·검증 후 별도 단계에서 정리). 재실행 안전.
--
-- 범위 밖: type/types → 이미 company_roles(0052)가 정본. status → companies.status 가 정본.
-- po_requests / shipping_origins / notifications 는 4·5단계에서 옮긴다.

alter table public.companies
  add column if not exists description text,
  add column if not exists website text,
  add column if not exists admin_memo text,
  add column if not exists logo_path text,
  add column if not exists address_1 text,
  add column if not exists address_2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip_code text,
  add column if not exists company_onboarding_confirmed_at timestamptz,
  add column if not exists admin_profile_onboarding_confirmed_at timestamptz,
  add column if not exists brand_onboarding_confirmed_at timestamptz,
  add column if not exists team_onboarding_skipped boolean not null default false,
  add column if not exists profile_migrated_at timestamptz;

comment on column public.companies.profile_migrated_at is
  'DATA-JSON-MIG-003: 이 시각이 있으면 회사 기본 정보 칸이 정본이다(코드는 칸 우선, 없으면 intro JSON).';

create table if not exists public.company_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null default '',
  english_name text not null default '',
  korean_last_name text not null default '',
  korean_first_name text not null default '',
  english_first_name text not null default '',
  english_last_name text not null default '',
  phone text not null default '',
  email text not null default '',
  title text not null default '',
  position text not null default '',
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_company_contacts_company_id
  on public.company_contacts (company_id, sort_order);

comment on table public.company_contacts is
  '회사 대표 연락처 목록. companies.intro JSON 의 contacts 배열을 대체한다.';

alter table public.company_contacts enable row level security;
alter table public.company_contacts force row level security;

-- 읽기: 같은 회사 사용자와 Admin. 쓰기는 서버(권한 검증 후 service role)로만 한다.
drop policy if exists "company_contacts_select_same_company_or_admin" on public.company_contacts;
create policy "company_contacts_select_same_company_or_admin"
  on public.company_contacts for select
  to authenticated
  using (company_id = public.auth_company_id() or public.auth_is_admin());

-- 기존 JSON → 칸 복사 (아직 옮기지 않은 회사만). 형식이 잘못된 날짜/불리언 값은 오류 대신 null/false 로 둔다.
with meta as (
  select id, substring(intro from length('__COMPANY_METADATA__:') + 1)::jsonb as m
  from public.companies
  where intro like '__COMPANY_METADATA__:%'
    and profile_migrated_at is null
)
update public.companies c
set
  description = coalesce(meta.m->>'description', ''),
  website = coalesce(meta.m->>'website', ''),
  admin_memo = coalesce(meta.m->>'admin_memo', ''),
  logo_path = nullif(meta.m->>'logo_path', ''),
  -- 예전 데이터는 한 줄짜리 address 만 있다: address_1 이 비어 있으면 그 값을 쓴다
  address_1 = coalesce(nullif(meta.m->>'address_1', ''), meta.m->>'address', ''),
  address_2 = coalesce(meta.m->>'address_2', ''),
  city = coalesce(meta.m->>'city', ''),
  state = coalesce(meta.m->>'state', ''),
  zip_code = coalesce(meta.m->>'zip_code', ''),
  company_onboarding_confirmed_at = case when meta.m->>'company_onboarding_confirmed_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (meta.m->>'company_onboarding_confirmed_at')::timestamptz end,
  admin_profile_onboarding_confirmed_at = case when meta.m->>'admin_profile_onboarding_confirmed_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (meta.m->>'admin_profile_onboarding_confirmed_at')::timestamptz end,
  brand_onboarding_confirmed_at = case when meta.m->>'brand_onboarding_confirmed_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (meta.m->>'brand_onboarding_confirmed_at')::timestamptz end,
  team_onboarding_skipped = coalesce(meta.m->>'team_onboarding_skipped' = 'true', false),
  profile_migrated_at = now()
from meta
where c.id = meta.id;

-- 기존 JSON → 연락처 테이블 복사 (연락처 행이 하나도 없는 회사만)
insert into public.company_contacts (
  id, company_id, name, english_name, korean_last_name, korean_first_name,
  english_first_name, english_last_name, phone, email, title, position, is_primary, sort_order
)
select
  case
    when (x.c->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (x.c->>'id')::uuid
    else gen_random_uuid()
  end,
  co.id,
  coalesce(x.c->>'name', ''),
  coalesce(x.c->>'englishName', x.c->>'english_name', ''),
  coalesce(x.c->>'koreanLastName', x.c->>'korean_last_name', ''),
  coalesce(x.c->>'koreanFirstName', x.c->>'korean_first_name', ''),
  coalesce(x.c->>'englishFirstName', x.c->>'english_first_name', ''),
  coalesce(x.c->>'englishLastName', x.c->>'english_last_name', ''),
  coalesce(x.c->>'phone', ''),
  coalesce(x.c->>'email', ''),
  coalesce(x.c->>'title', ''),
  coalesce(x.c->>'position', ''),
  coalesce(x.c->>'isPrimary' = 'true', false),
  (x.ord - 1)::integer
from public.companies co
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(substring(co.intro from length('__COMPANY_METADATA__:') + 1)::jsonb->'contacts') = 'array'
      then substring(co.intro from length('__COMPANY_METADATA__:') + 1)::jsonb->'contacts'
    else '[]'::jsonb
  end
) with ordinality as x(c, ord)
where co.intro like '__COMPANY_METADATA__:%'
  and not exists (select 1 from public.company_contacts cc where cc.company_id = co.id)
on conflict (id) do nothing;
