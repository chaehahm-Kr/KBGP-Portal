-- 0010: 명세서 08. 이메일 알림 시스템 전체 연동.
--
-- email_templates: 08_주요화면과AC.md 화면 20 "설정(이메일 템플릿) | Super Admin |
-- 템플릿 문구 수정 후 발송 테스트 기능 제공". 지금까지 각 서버 액션 안에 흩어져
-- 있던 이메일 제목·본문을 하나의 테이블로 모아 Super Admin이 문구를 고칠 수 있게 한다.
-- 조회는 관리자 전체에게 열어주고(자기가 무슨 알림이 나가는지 알아야 하므로),
-- 수정은 서버 액션에서 super_admin 여부를 코드로 확인한 뒤 admin 클라이언트로만 한다.
create table public.email_templates (
  key text primary key,
  description text not null,
  subject_template text not null,
  body_template text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.staff_members (id)
);

comment on table public.email_templates is
  '09_알림및문서관리규칙.md Part 1 알림 이벤트의 실제 발송 문구. {{변수}} 형태로
  치환된다. lib/notifications/templates.ts의 DEFAULT_TEMPLATES가 이 테이블의
  최초 시드값이자, 행이 우연히 지워졌을 때의 코드 레벨 폴백이다.';

alter table public.email_templates enable row level security;
alter table public.email_templates force row level security;

create policy "email_templates_select_admin"
  on public.email_templates for select
  to authenticated
  using (public.auth_is_admin());

insert into public.email_templates (key, description, subject_template, body_template) values
('application_submitted_company',
 '회사 담당자 — 신청서 제출 완료',
 '[K Select Network] {{applicationNumber}} 신청이 접수되었습니다',
 '{{applicationNumber}} 신청서가 정상적으로 접수되었습니다. 심사 결과는 확정되는 대로 이메일로 안내드립니다.'),
('application_received_internal',
 '내부 직원 전체 — 신규 신청서 접수',
 '[신규 접수] {{applicationNumber}} — {{companyName}}, 제품 {{productCount}}건',
 '{{applicationNumber}} 신규 접수 — {{companyName}}, 제품 {{productCount}}건. 확인: {{link}}'),
('assignment_assigned',
 '내부 직원 — 담당자로 배정됨',
 '[K Select Network] {{applicationNumber}} 담당자로 배정되었습니다',
 '신청번호 {{applicationNumber}}의 담당자로 배정되었습니다.{{reasonLine}}'),
('assignment_unassigned',
 '내부 직원 — 담당자 배정 해제됨(참고용, 인앱 알림함이 생기기 전까지 이메일로 대체)',
 '[K Select Network] {{applicationNumber}} 담당자 배정이 해제되었습니다',
 '참고용 안내입니다 — 신청번호 {{applicationNumber}}의 담당자에서 해제되었습니다.'),
('info_request_created',
 '회사 담당자 — 추가 자료 요청 발송',
 '[K Select Network] {{applicationNumber}} 추가 자료 요청',
 '{{applicationNumber}} 신청서 심사를 위해 추가 자료가 필요합니다.\n\n요청 내용: {{requestContent}}\n\n회신 기한: {{dueDate}}까지 포털에 로그인해 회신해주세요.'),
('info_request_replied',
 '내부 담당자 — 추가 자료 회신 도착',
 '[K Select Network] {{applicationNumber}} 추가 자료 회신 도착',
 '{{applicationNumber}} 신청서에 대한 추가 자료 회신이 도착했습니다. 포털에서 확인해주세요.'),
('review_result_approved',
 '회사 담당자 — 심사 결과: 승인',
 '[K Select Network] {{applicationNumber}} 심사 결과 안내',
 '[{{applicationNumber}}] 신청이 승인되었습니다. 다음 단계인 상담 예약 절차를 곧 안내드리겠습니다.'),
('review_result_partial_approved',
 '회사 담당자 — 심사 결과: 부분승인',
 '[K Select Network] {{applicationNumber}} 심사 결과 안내',
 '[{{applicationNumber}}] 신청서에 포함된 제품 중 일부가 승인되었습니다. 승인된 제품에 한해 다음 단계를 진행합니다.'),
('review_result_on_hold',
 '회사 담당자 — 심사 결과: 보류',
 '[K Select Network] {{applicationNumber}} 심사 결과 안내',
 '[{{applicationNumber}}]에 포함된 제품은 지금 시점에는 진행이 어렵다는 판단입니다. 상세 사유와 재신청 가능 시점을 함께 안내드립니다.'),
('review_result_rejected',
 '회사 담당자 — 심사 결과: 반려',
 '[K Select Network] {{applicationNumber}} 심사 결과 안내',
 '[{{applicationNumber}}] 신청은 참여 조건을 충족하지 못해 이번에는 진행이 어렵다는 판단입니다.'),
('info_request_due_soon',
 '회사 담당자 — 추가 자료 회신 기한 임박',
 '[K Select Network] {{applicationNumber}} 추가 자료 회신 기한이 곧 마감됩니다',
 '{{applicationNumber}} 신청서의 추가 자료 요청 회신 기한이 {{dueDate}}까지입니다. 아직 회신 전이라면 포털에서 회신해주세요.'),
('info_request_overdue',
 '내부 담당자 — 추가 자료 회신 기한 초과',
 '[K Select Network] {{applicationNumber}} 추가 자료 회신 기한 초과',
 '{{applicationNumber}} 신청서의 추가 자료 요청 회신 기한({{dueDate}})이 지났습니다. 필요 시 회사에 직접 연락해 확인해주세요.');

-- 추가 자료 요청 회신 기한 임박/초과 리마인드(이벤트 11번)를 위한 컬럼.
-- reply_due_at은 요청 생성 시 now() + 5일로 채운다(PRD가 정확한 일수를 정하지 않아
-- 제 판단으로 5영업일 상당을 기본값으로 잡았다 — 운영하며 다르게 하고 싶다면
-- info-request-actions.ts의 상수 하나만 고치면 된다).
alter table public.additional_info_requests
  add column reply_due_at timestamptz,
  add column due_soon_notified_at timestamptz,
  add column overdue_notified_at timestamptz;

update public.additional_info_requests
set reply_due_at = requested_at + interval '5 days'
where reply_due_at is null;
