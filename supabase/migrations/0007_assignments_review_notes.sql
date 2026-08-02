-- 0007_assignments_review_notes.sql — 명세서 07. 담당자 배정·내부 메모
--
-- 07_데이터모델.md Assignment/ReviewNote.

-- staff_roles에 'super_admin' 역할이 있는지 판단하는 헬퍼. 담당자 배정 권한
-- ("SuperAdmin은 전체 배정, Reviewer는 자기 자신만"), 내부 메모 삭제 권한
-- ("작성자 본인 또는 SuperAdmin만") 양쪽에서 재사용한다.
create function public.auth_is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.staff_roles
    where staff_id = auth.uid() and role = 'super_admin'
  );
$$;

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  staff_id uuid not null references public.staff_members (id),
  assigned_by uuid not null references public.staff_members (id),
  assignment_reason text,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.assignments is
  '07_데이터모델.md Assignment. 담당자가 바뀔 때마다 기존 행을 지우지 않고
  is_current=false로 남긴 채 새 행을 추가한다 — "이전에 누가 담당했는지" 이력을
  전부 보존하기 위함(08_주요화면과AC.md 화면 12 예외 처리).';

alter table public.assignments enable row level security;
alter table public.assignments force row level security;

-- 쓰기는 lib/application/assignment-actions.ts가 admin 클라이언트로 수행한다 — "SuperAdmin은
-- 전체 배정, Reviewer는 미배정 건을 자기 자신에게만" 같은 조건은 RLS 정책 하나로 표현하기
-- 어려운 조건부 규칙이라 코드에서 판단한다.
create policy "assignments_select_admin"
  on public.assignments for select
  to authenticated
  using (public.auth_is_admin());

create table public.review_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  application_product_id uuid references public.application_products (id) on delete cascade,
  author_id uuid not null references public.staff_members (id),
  content text not null,
  created_at timestamptz not null default now()
);

comment on table public.review_notes is
  '07_데이터모델.md ReviewNote. 외부 사용자에게는 어떤 화면·API를 통해서도 노출되지
  않아야 한다(08_주요화면과AC.md 화면 11 AC) — company_users/companies 등 회사 측 RLS
  정책 어디에도 이 테이블을 select할 수 있는 경로 자체를 열어주지 않는 것으로 강제한다.
  수정은 없고(신뢰할 수 있는 이력을 위해) 추가와 삭제만 가능하다.';

alter table public.review_notes enable row level security;
alter table public.review_notes force row level security;

create policy "review_notes_select_admin"
  on public.review_notes for select
  to authenticated
  using (public.auth_is_admin());
