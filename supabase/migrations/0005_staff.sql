-- 0005_staff.sql — 명세서 04. 관리자 로그인·신청 목록·회사 관리
--
-- 07_데이터모델.md StaffUser/Role, 02_사용자유형과권한표.md의 5개 내부 역할
-- (Super Admin/Reviewer/Account Manager/Operations/Executive Viewer)을 데이터로 옮긴다.
-- profiles.role='admin'은 이미 "Letusto 내부 직원 로그인 계정인가"만 구분하고 있었는데(0001),
-- 여기서는 그 안에서 "이름이 뭐고, 어떤 세부 역할을 가졌는가"를 추가한다.
--
-- 명세서 04는 열람(신청 목록, 회사 목록) 화면까지만 다룬다. 직원 계정을 화면에서 직접
-- 만들고 역할을 배정하는 UI는 명세서 10(직원 관리) 범위라서 아직 없다 — 그래서 이 시점의
-- staff_members/staff_roles는 Supabase 대시보드에서 직접 만든 계정을 기준으로 채워진다.

create table public.staff_members (
  id uuid primary key references public.profiles (id) on delete cascade,
  name text not null,
  email text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

comment on table public.staff_members is
  'Letusto 내부 직원(07_데이터모델.md StaffUser). profiles.role=''admin''인 계정과 1:1.';

alter table public.staff_members enable row level security;
alter table public.staff_members force row level security;

-- 내부 직원 전체가 서로를 조회할 수 있다(08_주요화면과AC.md 화면 8 AC: "내부 직원 전체
-- 열람 가능(회사별 제한 없음)"). 생성·수정은 명세서 10에서 Super Admin 전용 서버 액션으로 추가한다.
create policy "staff_members_select_admin"
  on public.staff_members for select
  to authenticated
  using (public.auth_is_admin());

create table public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_members (id) on delete cascade,
  role text not null check (
    role in ('super_admin', 'reviewer', 'account_manager', 'operations', 'executive_viewer')
  ),
  created_at timestamptz not null default now(),
  unique (staff_id, role)
);

comment on table public.staff_roles is
  '한 StaffUser가 여러 Role을 가질 수 있는 N:M 관계(02_사용자유형과권한표.md). '
  '지금(1~3명)은 한 사람이 여러 역할을 겸임하고, 사람이 늘어나면 역할만 추가 배정한다.';

alter table public.staff_roles enable row level security;
alter table public.staff_roles force row level security;

create policy "staff_roles_select_admin"
  on public.staff_roles for select
  to authenticated
  using (public.auth_is_admin());

-- 이미 존재하는 관리자 프로필(예: 대시보드에서 직접 만든 테스트 계정)을 위한 백필.
-- 이후 새로 만들어지는 admin 계정은 아래 handle_new_user() 갱신이 자동으로 처리한다.
insert into public.staff_members (id, name, email)
select p.id, coalesce(p.display_name, ''), u.email
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin'
on conflict (id) do nothing;

-- 0001에서 만든 트리거 함수를 확장한다: role이 admin이면 staff_members도 함께 만든다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_role public.app_role;
begin
  resolved_role := coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'portal');

  insert into public.profiles (id, role, display_name)
  values (new.id, resolved_role, new.raw_user_meta_data ->> 'display_name');

  if resolved_role = 'admin' then
    insert into public.staff_members (id, name, email)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), new.email);
  end if;

  return new;
end;
$$;
