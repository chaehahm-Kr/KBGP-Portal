-- 0001_init_auth_profiles.sql
--
-- 이 마이그레이션은 "명세서 00. 프로젝트 기반 설정"의 범위다.
-- Company/Brand/Product/Application 같은 실제 업무 엔터티(07_데이터모델.md)는
-- 각자의 명세서(01. 회사 회원가입, 02. 브랜드·제품, 03. 신청서 ...)에서 별도
-- 마이그레이션으로 추가된다.
--
-- 여기서는 그 모든 미래 테이블이 예외 없이 따라야 할 패턴 —
-- "RLS를 기본으로 켜고, auth.uid() 기준으로 본인 소속 데이터만 보게 한다"
-- (10_보안과권한요구사항.md 1번, 데이터 격리) — 를 최소 단위로 증명하는
-- profiles 테이블만 만든다.

create type public.app_role as enum ('portal', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  display_name text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'auth.users를 확장해 이 로그인 계정이 파트너 포털 사용자인지 관리자인지를 저장한다. '
  'Company/CompanyUser, StaffUser 같은 구체적인 업무 데이터는 이후 명세서에서 이 테이블과 연결된다.';

-- ⚠️ 이후 이 프로젝트에 추가되는 모든 테이블은 예외 없이 아래 두 줄을 반드시 포함해야 한다.
-- RLS를 끄는 것은 이 프로젝트에서 허용되지 않는다.
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- 본인 프로필만 조회 가능. company_id/staff_id로 확장되는 이후 테이블들도
-- "auth.uid()로 소유권을 비교한다"는 이 패턴을 그대로 따라야 한다.
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- 회원가입 로직(명세서 01)이 자기 자신의 프로필 1건만 만들 수 있게 한다.
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- role은 신청 심사·직원 관리처럼 관리자 절차를 통해서만 바뀌어야 하므로 본인이
-- 직접 수정할 수 있는 update 정책은 만들지 않는다. 필요한 변경은
-- lib/supabase/admin.ts(service_role 키)로만 수행한다.

-- 신규 사용자가 auth.users에 생성되면 profiles 행을 자동으로 만든다.
-- role은 회원가입 폼에서 넘어온 raw_user_meta_data.role 값을 무조건 신뢰하지 않고,
-- 반드시 이후 명세서(01)의 회원가입 서버 로직이 검증한 뒤 넘기도록 한다.
-- 값이 없을 때의 기본값은 portal로 둔다(가장 흔한 가입 경로이기 때문).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'portal'),
    new.raw_user_meta_data ->> 'display_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
