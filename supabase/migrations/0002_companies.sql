-- 0002_companies.sql — 명세서 01. 회사 회원가입·로그인·소속 사용자 관리
--
-- 07_데이터모델.md의 Company/CompanyUser를 만든다. 0001에서 세운 원칙(모든 테이블에
-- RLS 강제, auth.uid() 기준 소유권 판단)을 그대로 따른다.
--
-- 순서 주의: language sql 함수는 plpgsql과 달리 생성 시점에 본문에서 참조하는
-- 테이블이 실제로 존재하는지 검증한다. auth_company_id()가 company_users를
-- 참조하므로, 반드시 company_users 테이블을 먼저 만든 뒤에 이 함수를 만들어야 한다.

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_registration_number text not null,
  country text not null,
  contact_name text,
  contact_phone text,
  intro text,
  production_capacity_summary text,
  certification_summary text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.companies is
  '한국 K-Beauty 제조사·브랜드사 1곳(07_데이터모델.md Company). 회사 간 데이터는 RLS로 완전히 격리된다.';

alter table public.companies enable row level security;
alter table public.companies force row level security;

create table public.company_users (
  id uuid primary key references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  email text not null,
  company_role text not null check (company_role in ('company_admin', 'company_staff')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  invited_by uuid references public.profiles (id),
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.company_users is
  'Company에 속한 로그인 계정(07_데이터모델.md CompanyUser). id가 profiles.id를 그대로 '
  ' 참조하는 1:1 관계라서, 한 사람이 두 회사에 동시에 속하는 것이 구조적으로 불가능하다.';

alter table public.company_users enable row level security;
alter table public.company_users force row level security;

-- profiles.role='admin'인 로그인 계정(Letusto 내부 직원)인지 판단하는 헬퍼.
-- 여러 정책에서 반복되므로 함수로 뽑는다. security definer라서 profiles의
-- "본인 것만 조회" RLS에 걸리지 않고 판단할 수 있다.
create function public.auth_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 로그인한 사용자가 소속된 company_id. 소속이 없으면 null.
-- company_users 자체의 RLS 정책 안에서 company_users를 다시 조회하는 재귀를
-- 피하기 위해 security definer 함수로 분리했다.
create function public.auth_company_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select company_id from public.company_users where id = auth.uid();
$$;

-- companies: 본인 소속 회사이거나 Letusto 내부 직원이면 조회 가능.
create policy "companies_select_own_or_admin"
  on public.companies for select
  to authenticated
  using (id = public.auth_company_id() or public.auth_is_admin());

-- companies: 회원가입 시점에는 아직 company_users가 없으므로, "아직 어느 회사에도
-- 속하지 않은 로그인 사용자"만 새 회사를 만들 수 있게 한다.
create policy "companies_insert_self_signup"
  on public.companies for insert
  to authenticated
  with check (public.auth_company_id() is null);

-- companies: 본인 회사의 company_admin만 회사 프로필 수정 가능
-- (수정 화면 자체는 이후 명세서 범위지만, 데이터 격리 원칙에 따라 정책은 지금 만든다).
create policy "companies_update_own_admin"
  on public.companies for update
  to authenticated
  using (
    id = public.auth_company_id()
    and exists (
      select 1 from public.company_users
      where id = auth.uid() and company_role = 'company_admin'
    )
  );

-- company_users: 같은 회사 팀원끼리 서로 조회 가능(소속 사용자 관리 화면), Letusto 직원도 조회 가능.
create policy "company_users_select_same_company_or_admin"
  on public.company_users for select
  to authenticated
  using (company_id = public.auth_company_id() or public.auth_is_admin());

-- company_users: 회원가입 시 자기 자신을 company_admin으로 등록하는 것만 허용.
-- 동료 초대(다른 사람의 company_users row 생성)는 반드시 서버 액션이
-- lib/supabase/admin.ts(RLS 우회)로 수행한다 — 초대는 본인이 아직 로그인할 수 없는
-- 사람의 계정을 만드는 작업이라 일반 RLS로는 표현할 수 없기 때문이다.
create policy "company_users_insert_self_signup"
  on public.company_users for insert
  to authenticated
  with check (id = auth.uid() and company_role = 'company_admin');

-- 로그인 실패 횟수 추적 — 10_보안과권한요구사항.md 2번("5회 연속 실패 시 15분 잠금").
-- 이메일 단위로 세되, 특정 시점 이전 기록은 무의미하므로 attempted_at으로 윈도우를 잡는다.
create table public.login_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  succeeded boolean not null,
  attempted_at timestamptz not null default now()
);

create index login_attempts_email_attempted_at_idx
  on public.login_attempts (email, attempted_at desc);

comment on table public.login_attempts is
  '로그인 시도 기록. 이메일 대소문자는 애플리케이션 코드에서 lower()로 정규화해 저장한다.';

-- 이 테이블은 로그인 화면(비로그인 상태)에서부터 서버 액션이 기록해야 하므로
-- 일반 사용자 권한으로는 어떤 것도 하지 못하게 잠그고, 항상 lib/supabase/admin.ts로만 접근한다.
alter table public.login_attempts enable row level security;
alter table public.login_attempts force row level security;
