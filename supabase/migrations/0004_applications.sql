-- 0004_applications.sql — 명세서 03. 신청서 작성·제출·현황확인 (회사 측)
--
-- 07_데이터모델.md의 Application/ApplicationProduct를 만든다. 이 시스템에서 가장 중요한
-- 연결 고리(신청 상태와 제품 심사 상태가 서로 독립적으로 움직인다는 확정 답변을 그대로
-- 구현하는 지점)다. 상태값은 06_상태값정의.md 1·2번을 그대로 옮긴다.

create sequence public.application_number_seq;

-- 신청번호는 "제출" 시점에만 발급된다(임시저장 상태에는 없음, 08_주요화면과AC.md 화면 5 AC:
-- "제출 후 신청번호가 자동 발급되어"). security definer로 만들어 authenticated 롤도
-- 시퀀스에 직접 권한을 받지 않고 이 함수를 통해서만 발급받게 한다.
create function public.generate_application_number()
returns text
language sql
security definer
set search_path = public
as $$
  select 'APP-' || lpad(nextval('public.application_number_seq')::text, 6, '0');
$$;

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  application_number text unique,
  status text not null default 'draft' check (
    status in (
      'draft', 'submitted', 'assigned', 'under_review', 'info_requested',
      're_review', 'partial_approved', 'approved', 'on_hold', 'rejected', 'cancelled'
    )
  ),
  motivation_note text,
  self_check_answers boolean[] not null default '{}',
  submitted_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.applications is
  '07_데이터모델.md Application. status는 06_상태값정의.md 1번 신청 상태값 그대로. '
  'self_check_answers는 마케팅 사이트 자가진단 6문항(web/lib/content.ts eligibilityConditions)에 '
  '대한 재확인 응답을 순서대로 담은 배열이며, 미충족이어도 제출 자체는 막지 않는다.';

alter table public.applications enable row level security;
alter table public.applications force row level security;

create policy "applications_select_own_or_admin"
  on public.applications for select
  to authenticated
  using (company_id = public.auth_company_id() or public.auth_is_admin());

create policy "applications_insert_own"
  on public.applications for insert
  to authenticated
  with check (company_id = public.auth_company_id());

-- 08_주요화면과AC.md 화면 5 AC: "임시저장 상태에서는 언제든 수정 가능하지만, 제출됨
-- 이후에는 회사가 직접 내용을 수정할 수 없다". USING절이 "수정 대상 행이 지금 draft인가"를
-- 보므로, 제출(draft -> submitted) 전환 자체는 허용되고 그 이후의 추가 수정 시도는 막힌다.
--
-- WITH CHECK을 반드시 명시해야 한다: 생략하면 Postgres가 USING절을 그대로 재사용하는데,
-- 그러면 "draft -> submitted로 바꾸는 이 UPDATE 자체"가 결과 행(new row, status='submitted')을
-- 다시 USING 조건(status='draft')으로 검사하다가 실패한다 — 즉 상태를 바꾸는 딱 그 순간의
-- 업데이트 자체가 막혀버린다. WITH CHECK에는 company_id만 넣어 "내 회사 소유는 유지"만 요구하고,
-- 바뀐 뒤의 status 값 자체는 제한하지 않는다.
create policy "applications_update_while_draft"
  on public.applications for update
  to authenticated
  using (company_id = public.auth_company_id() and status = 'draft')
  with check (company_id = public.auth_company_id());

create table public.application_products (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  product_id uuid not null references public.products (id),
  company_id uuid not null references public.companies (id) on delete cascade,
  review_status text not null default 'pending' check (
    review_status in ('pending', 'reviewing', 'info_requested', 'approved', 'on_hold', 'rejected')
  ),
  review_reason text,
  reviewed_at timestamptz,
  reviewer_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (application_id, product_id)
);

comment on table public.application_products is
  '07_데이터모델.md ApplicationProduct — 이 시스템의 핵심 연결 엔터티. review_status는
  06_상태값정의.md 2번 제품 심사 상태값이며 applications.status와 완전히 독립적으로 움직인다.
  review_reason은 관리자가 작성하는 공식 사유만 담고(명세서 05 범위), 내부 메모는 이 테이블에
  두지 않는다(별도 ReviewNote, 명세서 07) — 회사 측 화면에서 이 테이블만 노출하면 내부 메모가
  구조적으로 새어나갈 수 없다.';

alter table public.application_products enable row level security;
alter table public.application_products force row level security;

create policy "application_products_select_own_or_admin"
  on public.application_products for select
  to authenticated
  using (company_id = public.auth_company_id() or public.auth_is_admin());

-- 신청서가 아직 draft일 때만 제품을 담거나 뺄 수 있다(제출 후에는 신청서 자체가 잠기므로
-- 자연히 이 테이블도 잠긴다 — applications_update_while_draft와 같은 원칙).
create policy "application_products_insert_while_draft"
  on public.application_products for insert
  to authenticated
  with check (
    company_id = public.auth_company_id()
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.status = 'draft' and a.company_id = public.auth_company_id()
    )
  );

create policy "application_products_delete_while_draft"
  on public.application_products for delete
  to authenticated
  using (
    company_id = public.auth_company_id()
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.status = 'draft' and a.company_id = public.auth_company_id()
    )
  );
