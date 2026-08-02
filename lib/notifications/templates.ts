import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";

export const TEMPLATE_KEYS = [
  "application_submitted_company",
  "application_received_internal",
  "assignment_assigned",
  "assignment_unassigned",
  "info_request_created",
  "info_request_replied",
  "review_result_approved",
  "review_result_partial_approved",
  "review_result_on_hold",
  "review_result_rejected",
  "info_request_due_soon",
  "info_request_overdue",
  "invite_expiring_soon",
  "inquiry_received_applicant",
  "inquiry_received_internal",
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

/**
 * supabase/migrations/0010_...sql이 email_templates 테이블에 심는 시드값과 반드시
 * 같은 문구를 유지한다 — 이 객체는 (1) 테이블 행이 실수로 지워졌을 때의 코드 레벨
 * 폴백이자 (2) 관리자 화면에서 "기본값으로 되돌리기"의 기준값으로 쓰인다.
 */
export const DEFAULT_TEMPLATES: Record<
  TemplateKey,
  { description: string; subject: string; body: string }
> = {
  application_submitted_company: {
    description: "회사 담당자 — 신청서 제출 완료",
    subject: "[K Select Network] {{applicationNumber}} 신청이 접수되었습니다",
    body: "{{applicationNumber}} 신청서가 정상적으로 접수되었습니다. 심사 결과는 확정되는 대로 이메일로 안내드립니다.",
  },
  application_received_internal: {
    description: "내부 직원 전체 — 신규 신청서 접수",
    subject: "[신규 접수] {{applicationNumber}} — {{companyName}}, 제품 {{productCount}}건",
    body: "{{applicationNumber}} 신규 접수 — {{companyName}}, 제품 {{productCount}}건. 확인: {{link}}",
  },
  assignment_assigned: {
    description: "내부 직원 — 담당자로 배정됨",
    subject: "[K Select Network] {{applicationNumber}} 담당자로 배정되었습니다",
    body: "신청번호 {{applicationNumber}}의 담당자로 배정되었습니다.{{reasonLine}}",
  },
  assignment_unassigned: {
    description: "내부 직원 — 담당자 배정 해제됨(참고용, 인앱 알림함이 생기기 전까지 이메일로 대체)",
    subject: "[K Select Network] {{applicationNumber}} 담당자 배정이 해제되었습니다",
    body: "참고용 안내입니다 — 신청번호 {{applicationNumber}}의 담당자에서 해제되었습니다.",
  },
  info_request_created: {
    description: "회사 담당자 — 추가 자료 요청 발송",
    subject: "[K Select Network] {{applicationNumber}} 추가 자료 요청",
    body: "{{applicationNumber}} 신청서 심사를 위해 추가 자료가 필요합니다.\n\n요청 내용: {{requestContent}}\n\n회신 기한: {{dueDate}}까지 포털에 로그인해 회신해주세요.",
  },
  info_request_replied: {
    description: "내부 담당자 — 추가 자료 회신 도착",
    subject: "[K Select Network] {{applicationNumber}} 추가 자료 회신 도착",
    body: "{{applicationNumber}} 신청서에 대한 추가 자료 회신이 도착했습니다. 포털에서 확인해주세요.",
  },
  review_result_approved: {
    description: "회사 담당자 — 심사 결과: 승인",
    subject: "[K Select Network] {{applicationNumber}} 심사 결과 안내",
    body: "[{{applicationNumber}}] 신청이 승인되었습니다. 다음 단계인 상담 예약 절차를 곧 안내드리겠습니다.",
  },
  review_result_partial_approved: {
    description: "회사 담당자 — 심사 결과: 부분승인",
    subject: "[K Select Network] {{applicationNumber}} 심사 결과 안내",
    body: "[{{applicationNumber}}] 신청서에 포함된 제품 중 일부가 승인되었습니다. 승인된 제품에 한해 다음 단계를 진행합니다.",
  },
  review_result_on_hold: {
    description: "회사 담당자 — 심사 결과: 보류",
    subject: "[K Select Network] {{applicationNumber}} 심사 결과 안내",
    body: "[{{applicationNumber}}]에 포함된 제품은 지금 시점에는 진행이 어렵다는 판단입니다. 상세 사유와 재신청 가능 시점을 함께 안내드립니다.",
  },
  review_result_rejected: {
    description: "회사 담당자 — 심사 결과: 반려",
    subject: "[K Select Network] {{applicationNumber}} 심사 결과 안내",
    body: "[{{applicationNumber}}] 신청은 참여 조건을 충족하지 못해 이번에는 진행이 어렵다는 판단입니다.",
  },
  info_request_due_soon: {
    description: "회사 담당자 — 추가 자료 회신 기한 임박",
    subject: "[K Select Network] {{applicationNumber}} 추가 자료 회신 기한이 곧 마감됩니다",
    body: "{{applicationNumber}} 신청서의 추가 자료 요청 회신 기한이 {{dueDate}}까지입니다. 아직 회신 전이라면 포털에서 회신해주세요.",
  },
  info_request_overdue: {
    description: "내부 담당자 — 추가 자료 회신 기한 초과",
    subject: "[K Select Network] {{applicationNumber}} 추가 자료 회신 기한 초과",
    body: "{{applicationNumber}} 신청서의 추가 자료 요청 회신 기한({{dueDate}})이 지났습니다. 필요 시 회사에 직접 연락해 확인해주세요.",
  },
  invite_expiring_soon: {
    description: "초대한 Company Admin — 초대 만료 임박(참고용, 인앱 알림함이 생기기 전까지 이메일로 대체)",
    subject: "[K Select Network] {{inviteeName}}님 초대가 곧 만료됩니다",
    body: "{{inviteeName}}({{inviteeEmail}})님께 보낸 초대가 24시간 내에 만료됩니다. 계속 진행하시려면 소속 사용자 관리 화면에서 재초대해주세요.",
  },
  inquiry_received_applicant: {
    description: "신청자 — 마케팅 사이트 신청서 접수 확인",
    subject: "[K Select Network] {{inquiryNumber}} 신청이 접수되었습니다",
    body: "{{companyName}}님, 신청서가 정상적으로 접수되었습니다(접수번호 {{inquiryNumber}}). 검토 후 담당자가 직접 연락드리겠습니다.",
  },
  inquiry_received_internal: {
    description: "내부 직원 전체 — 마케팅 사이트 신규 문의 접수",
    subject: "[신규 문의] {{inquiryNumber}} — {{companyName}}, 제품 {{productCount}}건",
    body: "{{inquiryNumber}} 신규 문의 접수 — {{companyName}}, 제품 {{productCount}}건. 확인: {{link}}",
  },
};

/** 관리자 화면의 "테스트 발송" 버튼이 실제 변수 없이도 그럴듯한 미리보기를 보낼 수 있게 하는 예시값. */
export const SAMPLE_VARIABLES: Record<string, string> = {
  applicationNumber: "APP-000001",
  companyName: "샘플뷰티코리아",
  productCount: "3",
  link: "https://portal.kselectnetwork.com/admin/applications/sample",
  reasonLine: " 배정 사유: 담당 브랜드 카테고리 일치",
  requestContent: "성분표 최신본을 첨부해주세요.",
  dueDate: "2026년 8월 5일",
  inviteeName: "김샘플",
  inviteeEmail: "sample@brand.co.kr",
  inquiryNumber: "INQ-20260801-ABC123",
};

function render(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name) => variables[name] ?? "");
}

/**
 * DB에서 템플릿을 읽어 변수 치환 후 발송한다. 09_알림및문서관리규칙.md가 요구하는
 * "Super Admin이 템플릿 문구를 수정할 수 있다"를 만족시키는 지점 — 여기서 하드코딩된
 * 문구를 쓰지 않고 항상 email_templates 테이블을 거친다. 테이블 행이 없으면(마이그레이션
 * 시드가 지워졌거나 새 키를 아직 안 넣은 경우) DEFAULT_TEMPLATES로 폴백해 발송 자체는
 * 끊기지 않게 한다.
 */
export async function sendTemplatedEmail(
  key: TemplateKey,
  to: string,
  variables: Record<string, string>
) {
  const admin = createAdminClient();
  const { data: template } = await admin
    .from("email_templates")
    .select("subject_template, body_template")
    .eq("key", key)
    .maybeSingle();

  const subjectTemplate = template?.subject_template ?? DEFAULT_TEMPLATES[key].subject;
  const bodyTemplate = template?.body_template ?? DEFAULT_TEMPLATES[key].body;

  await sendEmail({
    to,
    subject: render(subjectTemplate, variables),
    text: render(bodyTemplate, variables),
  });
}
