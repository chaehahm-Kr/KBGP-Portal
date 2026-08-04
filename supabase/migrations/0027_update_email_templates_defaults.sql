-- 0027_update_email_templates_defaults.sql — 이메일 템플릿 기획에 따른 기본 문안 일괄 갱신 DDL
--
-- 기존 DB에 삽입되어 있던 email_templates 들의 기본 제목 및 본문 문안을
-- K SELECT NETWORK 공식 파트너 신청 접수 확인 기획 가이드라인에 맞춰 갱신합니다.

UPDATE public.email_templates
SET 
  subject_template = '[K SELECT NETWORK] {{applicationNumber}} 파트너 신청이 접수되었습니다',
  body_template = '신청이 정상적으로 접수되었습니다.

안녕하세요, {{contactName}}님.
K SELECT NETWORK의 K-Beauty Growth Program에 신청해 주셔서 감사합니다.
제출해 주신 신청서는 아래 접수번호로 정상 등록되었습니다.

{{infoBox}}

제출하신 브랜드와 상품 정보를 검토한 후, 담당자가 영업일 기준 3일 이내에 이메일 또는 전화로 연락드리겠습니다.

{{ctaButton}}'
WHERE key IN ('application_submitted_company', 'inquiry_received_applicant');

UPDATE public.email_templates
SET 
  subject_template = '[신규 접수] {{applicationNumber}} — {{companyName}}, 제품 {{productCount}}건',
  body_template = '안녕하세요.

신청번호 {{applicationNumber}} 신규 접수 완료되었습니다.

회사명: {{companyName}}
등록 제품 수: {{productCount}}건

상세 확인 링크: {{link}}'
WHERE key = 'application_received_internal';

UPDATE public.email_templates
SET 
  subject_template = '[K SELECT NETWORK] {{applicationNumber}} 담당자로 배정되었습니다',
  body_template = '안녕하세요.

신청번호 {{applicationNumber}}의 담당자로 배정되었습니다.{{reasonLine}}

포털에서 확인 후 심사를 진행해 주세요.'
WHERE key = 'assignment_assigned';

UPDATE public.email_templates
SET 
  subject_template = '[K SELECT NETWORK] {{applicationNumber}} 담당자 배정이 해제되었습니다',
  body_template = '안녕하세요.

참고용 안내입니다 — 신청번호 {{applicationNumber}}의 담당자에서 해제되었습니다.'
WHERE key = 'assignment_unassigned';

UPDATE public.email_templates
SET 
  subject_template = '[K SELECT NETWORK] {{applicationNumber}} 추가 자료 요청',
  body_template = '안녕하세요, {{contactName}}님.

{{applicationNumber}} 신청서 심사를 위해 추가 자료가 필요합니다.

요청 내용:
{{requestContent}}

회신 기한인 {{dueDate}}까지 포털에 로그인하여 추가 자료를 제출해 주시기 바랍니다.'
WHERE key = 'info_request_created';

UPDATE public.email_templates
SET 
  subject_template = '[K SELECT NETWORK] {{applicationNumber}} 추가 자료 회신 도착',
  body_template = '안녕하세요.

{{applicationNumber}} 신청서에 대한 추가 자료 회신이 도착했습니다. 포털에서 확인 및 검토해 주세요.'
WHERE key = 'info_request_replied';

UPDATE public.email_templates
SET 
  subject_template = '[K SELECT NETWORK] {{applicationNumber}} 파트너십 승인 안내',
  body_template = '안녕하세요, {{contactName}}님.

축하드립니다! 제출해주신 [{{applicationNumber}}] 신청이 승인되었습니다.

다음 단계인 미국 런칭 상담 예약 및 진행 일정을 곧 안내해 드리겠습니다.'
WHERE key = 'review_result_approved';

UPDATE public.email_templates
SET 
  subject_template = '[K SELECT NETWORK] {{applicationNumber}} 심사 결과 안내',
  body_template = '안녕하세요, {{contactName}}님.

제출해주신 [{{applicationNumber}}] 신청서에 포함된 제품 중 일부가 승인되었습니다.

승인된 제품에 한해 다음 단계를 진행할 예정이며, 상세 내용은 포털에서 확인하실 수 있습니다.'
WHERE key = 'review_result_partial_approved';

UPDATE public.email_templates
SET 
  subject_template = '[K SELECT NETWORK] {{applicationNumber}} 심사 결과 안내',
  body_template = '안녕하세요, {{contactName}}님.

제출해주신 [{{applicationNumber}}] 신청은 현재 시점에는 진행이 어렵다는 보류 판단을 받았습니다.

상세한 보류 사유와 재신청 가능 일정은 포털 내 신청 이력에서 확인해 주시기 바랍니다.'
WHERE key = 'review_result_on_hold';

UPDATE public.email_templates
SET 
  subject_template = '[K SELECT NETWORK] {{applicationNumber}} 심사 결과 안내',
  body_template = '안녕하세요, {{contactName}}님.

제출해주신 [{{applicationNumber}}] 신청은 참여 조건을 충족하지 못해 이번에는 진행이 어렵다는 판단입니다.

자세한 사유는 포털에서 확인 가능합니다. 참여해 주셔서 감사합니다.'
WHERE key = 'review_result_rejected';

UPDATE public.email_templates
SET 
  subject_template = '[K SELECT NETWORK] {{applicationNumber}} 추가 자료 회신 기한이 곧 마감됩니다',
  body_template = '안녕하세요, {{contactName}}님.

{{applicationNumber}} 신청서의 추가 자료 요청 회신 기한이 {{dueDate}}까지입니다. 아직 회신 전이라면 기한 내에 포털을 통해 회신해 주시기 바랍니다.'
WHERE key = 'info_request_due_soon';

UPDATE public.email_templates
SET 
  subject_template = '[K SELECT NETWORK] {{applicationNumber}} 추가 자료 회신 기한 초과',
  body_template = '안녕하세요.

{{applicationNumber}} 신청서의 추가 자료 요청 회신 기한({{dueDate}})이 초과되었습니다. 확인 후 직접 연락해 주시기 바랍니다.'
WHERE key = 'info_request_overdue';

UPDATE public.email_templates
SET 
  subject_template = '[K SELECT NETWORK] {{inviteeName}}님 초대가 곧 만료됩니다',
  body_template = '안녕하세요.

{{inviteeName}}({{inviteeEmail}})님께 보낸 초대가 24시간 내에 만료됩니다. 계속 진행하려면 사용자 관리 화면에서 재초대해 주세요.'
WHERE key = 'invite_expiring_soon';

UPDATE public.email_templates
SET 
  subject_template = '[신규 문의] {{inquiryNumber}} — {{companyName}}, 제품 {{productCount}}건',
  body_template = '안녕하세요.

신규 문의 접수 완료: {{inquiryNumber}} (회사명: {{companyName}})
등록 제품 수: {{productCount}}건

상세 확인: {{link}}'
WHERE key = 'inquiry_received_internal';
