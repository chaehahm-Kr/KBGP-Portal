-- application_received_internal (내부 직원 전체 — 신규 신청서 접수) 본문에서 상세 확인 링크 텍스트 제거하고 ctaButton으로 일괄 교체
UPDATE public.email_templates
SET body_template = '안녕하세요.

신청번호 {{applicationNumber}} 신규 접수 완료되었습니다.

회사명: {{companyName}}
등록 제품 수: {{productCount}}건

아래 버튼을 클릭하시면 접수된 신청서 상세 화면으로 즉시 연결됩니다.

{{ctaButton}}'
WHERE key = 'application_received_internal';

-- assignment_assigned (내부 직원 — 담당자로 배정됨) 본문에 ctaButton 추가
UPDATE public.email_templates
SET body_template = '안녕하세요.

신청번호 {{applicationNumber}}의 담당자로 배정되었습니다.{{reasonLine}}

아래 버튼을 클릭하여 포털에서 배정된 신청서의 심사를 진행해 주세요.

{{ctaButton}}'
WHERE key = 'assignment_assigned';

-- assignment_unassigned (내부 직원 — 담당자 배정 해제됨) 본문에 ctaButton 추가
UPDATE public.email_templates
SET body_template = '안녕하세요.

참고용 안내입니다 — 신청번호 {{applicationNumber}}의 담당자에서 해제되었습니다.

{{ctaButton}}'
WHERE key = 'assignment_unassigned';

-- info_request_created (회사 담당자 — 추가 자료 요청 발송) 본문에 ctaButton 추가
UPDATE public.email_templates
SET body_template = '안녕하세요, {{contactName}}님.

{{applicationNumber}} 신청서 심사를 위해 추가 자료가 필요합니다.

요청 내용:
{{requestContent}}

회신 기한인 {{dueDate}}까지 아래 버튼을 눌러 포털에 로그인하신 후 추가 자료를 제출해 주시기 바랍니다.

{{ctaButton}}'
WHERE key = 'info_request_created';

-- info_request_replied (내부 담당자 — 추가 자료 회신 도착) 본문에 ctaButton 추가
UPDATE public.email_templates
SET body_template = '안녕하세요.

{{applicationNumber}} 신청서에 대한 추가 자료 회신이 도착했습니다.

아래 버튼을 클릭하여 파트너사가 업로드한 회신 자료를 검토해 주세요.

{{ctaButton}}'
WHERE key = 'info_request_replied';

-- review_result_approved (회사 담당자 — 심사 결과: 승인) 본문 URL 제거하고 ctaButton으로 교체
UPDATE public.email_templates
SET body_template = '안녕하세요, {{contactName}}님.

축하드립니다! 제출해주신 [{{applicationNumber}}] 신청이 승인되었습니다.

다음 단계 진행을 위해 아래 버튼을 클릭하여 브랜드사 전용 포털에 접속해 주시기 바랍니다.

{{ctaButton}}

포털 로그인 화면에서 계정을 생성한 후, 브랜드 정보와 참여를 희망하는 상품 정보를 등록해 주세요.

미국 런칭 상담 예약 및 진행 일정을 포털 내에서 확인하실 수 있습니다.'
WHERE key = 'review_result_approved';

-- review_result_partial_approved (회사 담당자 — 심사 결과: 부분승인) 본문 URL 제거하고 ctaButton으로 교체
UPDATE public.email_templates
SET body_template = '안녕하세요, {{contactName}}님.

제출해주신 [{{applicationNumber}}] 신청서에 포함된 제품 중 일부가 승인되었습니다.

다음 단계 진행을 위해 아래 버튼을 클릭하여 브랜드사 전용 포털에 접속해 주시기 바랍니다.

{{ctaButton}}

승인된 제품에 한해 다음 단계를 진행할 예정이며, 상세 내용은 포털에서 확인하실 수 있습니다.'
WHERE key = 'review_result_partial_approved';

-- review_result_on_hold (회사 담당자 — 심사 결과: 보류) 본문에 ctaButton 추가
UPDATE public.email_templates
SET body_template = '안녕하세요, {{contactName}}님.

제출해주신 [{{applicationNumber}}] 신청은 현재 시점에는 진행이 어렵다는 보류 판단을 받았습니다.

상세한 보류 사유와 재신청 가능 일정은 아래 버튼을 클릭하여 포털 내 신청 이력에서 확인해 주시기 바랍니다.

{{ctaButton}}'
WHERE key = 'review_result_on_hold';

-- review_result_rejected (회사 담당자 — 심사 결과: 반려) 본문에 ctaButton 추가
UPDATE public.email_templates
SET body_template = '안녕하세요, {{contactName}}님.

제출해주신 [{{applicationNumber}}] 신청은 참여 조건을 충족하지 못해 이번에는 진행이 어렵다는 판단입니다.

자세한 반려 사유는 아래 버튼을 클릭하여 포털 내에서 확인하실 수 있습니다.

{{ctaButton}}

참여해 주셔서 감사합니다.'
WHERE key = 'review_result_rejected';

-- info_request_due_soon (회사 담당자 — 추가 자료 회신 기한 임박) 본문에 ctaButton 추가
UPDATE public.email_templates
SET body_template = '안녕하세요, {{contactName}}님.

{{applicationNumber}} 신청서의 추가 자료 요청 회신 기한이 {{dueDate}}까지입니다.

아직 회신 전이라면 아래 버튼을 클릭하여 기한 내에 포털을 통해 회신해 주시기 바랍니다.

{{ctaButton}}'
WHERE key = 'info_request_due_soon';

-- info_request_overdue (내부 담당자 — 추가 자료 회신 기한 초과) 본문에 ctaButton 추가
UPDATE public.email_templates
SET body_template = '안녕하세요.

{{applicationNumber}} 신청서의 추가 자료 요청 회신 기한({{dueDate}})이 초과되었습니다.

아래 버튼을 클릭하여 기한 초과 신청서 상태를 점검하시고, 파트너사 담당자에게 연락해 주시기 바랍니다.

{{ctaButton}}'
WHERE key = 'info_request_overdue';

-- invite_expiring_soon (초대한 Company Admin — 초대 만료 임박) 본문에 ctaButton 추가
UPDATE public.email_templates
SET body_template = '안녕하세요.

{{inviteeName}}({{inviteeEmail}})님께 보낸 초대가 24시간 내에 만료됩니다.

초대 링크가 만료되기 전에 아래 버튼을 눌러 사용자 관리 화면에서 재초대해 주시기 바랍니다.

{{ctaButton}}'
WHERE key = 'invite_expiring_soon';

-- inquiry_received_internal (내부 직원 전체 — 마케팅 사이트 신규 문의 접수) 본문 URL 제거하고 ctaButton으로 교체
UPDATE public.email_templates
SET body_template = '안녕하세요.

신규 문의 접수 완료: {{inquiryNumber}} (회사명: {{companyName}})
등록 제품 수: {{productCount}}건

아래 버튼을 클릭하시면 접수된 문의 내역의 상세 화면으로 즉시 연결됩니다.

{{ctaButton}}'
WHERE key = 'inquiry_received_internal';
