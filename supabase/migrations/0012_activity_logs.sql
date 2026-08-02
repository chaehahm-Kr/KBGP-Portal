-- 0012: 명세서 10. 직원 관리·활동 로그(최소 버전).
--
-- 07_데이터모델.md ActivityLog: "누가, 언제, 무엇을, 어떻게 바꿨는가"를 기록하는
-- 공통 로그. 대상 엔터티 종류, 대상 ID, 변경 전/후 상태, 변경자, 변경 시각, 사유.
-- "최소 버전"이므로 모든 엔터티가 아니라 신청서 심사·배정처럼 가장 중요한 상태
-- 변경 지점에만 기록을 남긴다(review-actions.ts, assignment-actions.ts).
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  before_state text,
  after_state text not null,
  changed_by uuid not null references public.staff_members (id),
  reason text,
  created_at timestamptz not null default now()
);

comment on table public.activity_logs is
  '07_데이터모델.md ActivityLog. entity_type은 "application" | "application_product" |
  "assignment" 등 문자열 태그로만 구분한다(별도 정규화 테이블 없이 최소 구현).';

create index activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);

alter table public.activity_logs enable row level security;
alter table public.activity_logs force row level security;

create policy "activity_logs_select_admin"
  on public.activity_logs for select
  to authenticated
  using (public.auth_is_admin());
