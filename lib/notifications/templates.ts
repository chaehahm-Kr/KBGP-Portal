import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { publicEnv } from "@/lib/env/public";

export const TEMPLATE_KEYS = [
  "application_submitted_company",
  "application_received_internal",
  "assignment_assigned",
  "assignment_unassigned",
  "info_request_created",
  "info_request_replied",
  "portal_signup_request",
  "review_result_approved",
  "review_result_partial_approved",
  "review_result_on_hold",
  "review_result_rejected",
  "info_request_due_soon",
  "info_request_overdue",
  "invite_expiring_soon",
  "inquiry_received_applicant",
  "inquiry_received_internal",
  "staff_invited",
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

/**
 * supabase/migrations/0010_...sql이 email_templates 테이블에 심는 시드값과 반드시
 * 같은 문구를 유지한다.
 */
export const DEFAULT_TEMPLATES: Record<
  TemplateKey,
  { description: string; subject: string; body: string }
> = {
  application_submitted_company: {
    description: "회사 담당자 — 신청서 제출 완료",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 파트너 신청이 접수되었습니다",
    body: "신청이 정상적으로 접수되었습니다.\n\n안녕하세요, {{contactName}}님.\nK SELECT NETWORK의 K-Beauty Growth Program에 신청해 주셔서 감사합니다.\n제출해 주신 신청서는 아래 접수번호로 정상 등록되었습니다.\n\n{{infoBox}}\n\n제출하신 브랜드와 상품 정보를 검토한 후, 담당자가 영업일 기준 3일 이내에 이메일 또는 전화로 연락드리겠습니다.",
  },
  application_received_internal: {
    description: "내부 직원 전체 — 신규 신청서 접수",
    subject: "[신규 접수] {{applicationNumber}} — {{companyName}}, 제품 {{productCount}}건",
    body: "안녕하세요.\n\n신청번호 {{applicationNumber}} 신규 접수 완료되었습니다.\n\n회사명: {{companyName}}\n등록 제품 수: {{productCount}}건\n\n아래 버튼을 클릭하시면 접수된 신청서 상세 화면으로 즉시 연결됩니다.\n\n{{ctaButton}}",
  },
  assignment_assigned: {
    description: "내부 직원 — 담당자로 배정됨",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 담당자로 배정되었습니다",
    body: "안녕하세요.\n\n신청번호 {{applicationNumber}}의 담당자로 배정되었습니다.{{reasonLine}}\n\n아래 버튼을 클릭하여 포털에서 배정된 신청서의 심사를 진행해 주세요.\n\n{{ctaButton}}",
  },
  assignment_unassigned: {
    description: "내부 직원 — 담당자 배정 해제됨",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 담당자 배정이 해제되었습니다",
    body: "안녕하세요.\n\n참고용 안내입니다 — 신청번호 {{applicationNumber}}의 담당자에서 해제되었습니다.\n\n{{ctaButton}}",
  },
  info_request_created: {
    description: "회사 담당자 — 추가 자료 요청 발송",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 추가 자료 요청",
    body: "안녕하세요, {{contactName}}님.\n\n{{applicationNumber}} 신청서 심사를 위해 추가 자료가 필요합니다.\n\n요청 내용:\n{{requestContent}}\n\n회신 기한인 {{dueDate}}까지 아래 버튼을 눌러 포털에 로그인하신 후 추가 자료를 제출해 주시기 바랍니다.\n\n{{ctaButton}}",
  },
  portal_signup_request: {
    description: "회사 담당자 — 포털 가입 요청",
    subject: "[K SELECT NETWORK] 브랜드사 포털 가입 요청 안내",
    body: "안녕하세요, {{contactName}}님.\n\n귀사의 입점 신청서를 검토한 결과, 상세 심사 단계를 진행하기 위해 브랜드사 포털 가입을 요청드립니다.\n\n아래 버튼을 클릭하여 회원가입 및 비밀번호 설정을 완료하신 후 포털에 로그인하여 주시기 바랍니다.\n\n{{ctaButton}}",
  },
  info_request_replied: {
    description: "내부 담당자 — 추가 자료 회신 도착",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 추가 자료 회신 도착",
    body: "안녕하세요.\n\n{{applicationNumber}} 신청서에 대한 추가 자료 회신이 도착했습니다.\n\n아래 버튼을 클릭하여 파트너사가 업로드한 회신 자료를 검토해 주세요.\n\n{{ctaButton}}",
  },
  review_result_approved: {
    description: "회사 담당자 — 심사 결과: 승인",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 파트너십 승인 안내",
    body: "안녕하세요, {{contactName}}님.\n\n축하드립니다! 제출해주신 [{{applicationNumber}}] 신청이 승인되었습니다.\n\n다음 단계 진행을 위해 아래 버튼을 클릭하여 브랜드사 전용 포털에 접속해 주시기 바랍니다.\n\n{{ctaButton}}\n\n포털 로그인 화면에서 계정을 생성한 후, 브랜드 정보와 참여를 희망하는 상품 정보를 등록해 주세요.\n\n미국 런칭 상담 예약 및 진행 일정을 포털 내에서 확인하실 수 있습니다.",
  },
  review_result_partial_approved: {
    description: "회사 담당자 — 심사 결과: 부분승인",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 심사 결과 안내",
    body: "안녕하세요, {{contactName}}님.\n\n제출해주신 [{{applicationNumber}}] 신청서에 포함된 제품 중 일부가 승인되었습니다.\n\n다음 단계 진행을 위해 아래 버튼을 클릭하여 브랜드사 전용 포털에 접속해 주시기 바랍니다.\n\n{{ctaButton}}\n\n승인된 제품에 한해 다음 단계를 진행할 예정이며, 상세 내용은 포털에서 확인하실 수 있습니다.",
  },
  review_result_on_hold: {
    description: "회사 담당자 — 심사 결과: 보류",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 심사 결과 안내",
    body: "안녕하세요, {{contactName}}님.\n\n제출해주신 [{{applicationNumber}}] 신청은 현재 시점에는 진행이 어렵다는 보류 판단을 받았습니다.\n\n상세한 보류 사유와 재신청 가능 일정은 아래 버튼을 클릭하여 포털 내 신청 이력에서 확인해 주시기 바랍니다.\n\n{{ctaButton}}",
  },
  review_result_rejected: {
    description: "회사 담당자 — 심사 결과: 반려",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 심사 결과 안내",
    body: "안녕하세요, {{contactName}}님.\n\n제출해주신 [{{applicationNumber}}] 신청은 참여 조건을 충족하지 못해 이번에는 진행이 어렵다는 판단입니다.\n\n자세한 반려 사유는 아래 버튼을 클릭하여 포털 내에서 확인하실 수 있습니다.\n\n{{ctaButton}}\n\n참여해 주셔서 감사합니다.",
  },
  info_request_due_soon: {
    description: "회사 담당자 — 추가 자료 회신 기한 임박",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 추가 자료 회신 기한이 곧 마감됩니다",
    body: "안녕하세요, {{contactName}}님.\n\n{{applicationNumber}} 신청서의 추가 자료 요청 회신 기한이 {{dueDate}}까지입니다.\n\n아직 회신 전이라면 아래 버튼을 클릭하여 기한 내에 포털을 통해 회신해 주시기 바랍니다.\n\n{{ctaButton}}",
  },
  info_request_overdue: {
    description: "내부 담당자 — 추가 자료 회신 기한 초과",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 추가 자료 회신 기한 초과",
    body: "안녕하세요.\n\n{{applicationNumber}} 신청서의 추가 자료 요청 회신 기한({{dueDate}})이 초과되었습니다.\n\n아래 버튼을 클릭하여 기한 초과 신청서 상태를 점검하시고, 파트너사 담당자에게 연락해 주시기 바랍니다.\n\n{{ctaButton}}",
  },
  invite_expiring_soon: {
    description: "초대한 Company Admin — 초대 만료 임박",
    subject: "[K SELECT NETWORK] {{inviteeName}}님 초대가 곧 만료됩니다",
    body: "안녕하세요.\n\n{{inviteeName}}({{inviteeEmail}})님께 보낸 초대가 24시간 내에 만료됩니다.\n\n초대 링크가 만료되기 전에 아래 버튼을 눌러 사용자 관리 화면에서 재초대해 주시기 바랍니다.\n\n{{ctaButton}}",
  },
  inquiry_received_applicant: {
    description: "신청자 — 마케팅 사이트 신청서 접수 확인",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 파트너 신청이 접수되었습니다",
    body: "신청이 정상적으로 접수되었습니다.\n\n안녕하세요, {{contactName}}님.\nK SELECT NETWORK의 K-Beauty Growth Program에 신청해 주셔서 감사합니다.\n제출해 주신 신청서는 아래 접수번호로 정상 등록되었습니다.\n\n{{infoBox}}\n\n제출하신 브랜드와 상품 정보를 검토한 후, 담당자가 영업일 기준 3일 이내에 이메일 또는 전화로 연락드리겠습니다.",
  },
  inquiry_received_internal: {
    description: "내부 직원 전체 — 마케팅 사이트 신규 문의 접수",
    subject: "[신규 문의] {{inquiryNumber}} — {{companyName}}, 제품 {{productCount}}건",
    body: "안녕하세요.\n\n신규 문의 접수 완료: {{inquiryNumber}} (회사명: {{companyName}})\n등록 제품 수: {{productCount}}건\n\n아래 버튼을 클릭하시면 접수된 문의 내역의 상세 화면으로 즉시 연결됩니다.\n\n{{ctaButton}}",
  },
  staff_invited: {
    description: "내부 직원 — 초대 발송",
    subject: "[K SELECT NETWORK] {{contactName}}님, 관리자 포털로 초대합니다",
    body: "안녕하세요, {{contactName}}님.\n\nK SELECT NETWORK 관리자 포털의 내부 직원으로 초대되었습니다.\n\n아래 로그인 정보와 임시 비밀번호로 최초 로그인하신 후, 비밀번호 변경 및 계정 설정 절차를 완료해 주세요.\n\n- 접속 이메일: {{email}}\n- 임시 비밀번호: {{tempPassword}}\n\n* 본 임시 비밀번호는 최초 1회 로그인 전용입니다.\n\n{{ctaButton}}",
  },
};

export const SAMPLE_VARIABLES: Record<string, string> = {
  applicationNumber: "APP-000001",
  applicationNo: "APP-000001",
  inquiryNumber: "APP-000001",
  contactName: "김민지",
  companyName: "샘플뷰티코리아",
  brandName: "ABC Beauty",
  productCount: "3",
  link: "https://portal.kselectnetwork.com/admin/applications/sample",
  reasonLine: " 배정 사유: 담당 브랜드 카테고리 일치",
  requestContent: "성분표 최신본을 첨부해주세요.",
  dueDate: "2026년 8월 5일",
  inviteeName: "김샘플",
  inviteeEmail: "sample@brand.co.kr",
  submittedDate: "2026년 8월 4일",
  email: "newstaff@kselectnetwork.com",
  tempPassword: "TempPassword123!",
};

function render(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name) => variables[name] ?? "");
}

/** 템플릿 키에 따른 영문/한글 배지 라벨 매핑 */
function getBadgeLabel(key: string): string | undefined {
  switch (key) {
    case "assignment_assigned":
      return "ASSIGNED · 담당자 배정 완료";
    case "assignment_unassigned":
      return "UNASSIGNED · 담당자 배정 해제";
    case "application_submitted_company":
    case "inquiry_received_applicant":
      return "SUBMITTED · 신청서 제출 완료";
    case "application_received_internal":
    case "inquiry_received_internal":
      return "NEW · 신규 접수 안내";
    case "info_request_created":
      return "ACTION REQUIRED · 추가 자료 요청";
    case "info_request_replied":
      return "REPLIED · 추가 자료 회신 완료";
    case "review_result_approved":
      return "APPROVED · 파트너십 승인 안내";
    case "review_result_partial_approved":
      return "PARTIAL APPROVED · 부분 승인 안내";
    case "review_result_on_hold":
      return "ON HOLD · 심사 보류 안내";
    case "review_result_rejected":
      return "REJECTED · 파트너십 반려 안내";
    case "info_request_due_soon":
      return "URGENT · 회신 기한 임박 안내";
    case "info_request_overdue":
      return "OVERDUE · 회신 기한 초과 안내";
    case "invite_expiring_soon":
      return "EXPIRING · 초청 만료 임박 안내";
    case "staff_invited":
      return "INVITED · 관리자 초대 발송";
    case "password_reset":
      return "PASSWORD RESET · 비밀번호 재설정";
    default:
      return undefined;
  }
}

/** 이메일용 접수정보 및 배정 상세 카드 HTML 조립 (k-select-network-email.html 준수) */
function buildInfoCardHtml(variables: Record<string, string>) {
  const rows: { label: string; value: string; isBold?: boolean }[] = [];
  
  const appNo = variables.applicationNo || variables.applicationNumber || variables.inquiryNumber;
  if (appNo) {
    rows.push({ label: "신청번호", value: appNo, isBold: true });
  }
  
  const brand = variables.brandName;
  if (brand) {
    rows.push({ label: "신청 브랜드", value: brand });
  }

  const nextStep = variables.nextStep;
  if (nextStep) {
    rows.push({ label: "다음 단계", value: nextStep });
  } else if (appNo && (variables.key === "application_submitted_company" || variables.key === "inquiry_received_applicant")) {
    rows.push({ label: "다음 단계", value: "서류 심사 · 3 영업일 내" });
  }

  if (rows.length === 0) return "";

  let rowsHtml = "";
  rows.forEach((row, idx) => {
    if (idx > 0) {
      rowsHtml += `
        <tr><td colspan="2" style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>
        <tr><td colspan="2" style="height:1px;line-height:1px;font-size:0;background:#E6E3DD;">&nbsp;</td></tr>
        <tr><td colspan="2" style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>
      `;
    }
    
    const valueStyle = row.isBold 
      ? "font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:24px;mso-line-height-rule:exactly;font-weight:bold;letter-spacing:0.8px;color:#131E2E;text-align:left;" 
      : "font-size:14px;line-height:24px;mso-line-height-rule:exactly;color:#2E3846;text-align:left;";

    rowsHtml += `
      <tr>
        <td valign="top" width="112" style="width:112px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:24px;mso-line-height-rule:exactly;font-weight:bold;letter-spacing:1.6px;color:#9AA0A9;text-transform:uppercase;text-align:left;">${row.label}</td>
        <td valign="top" style="${valueStyle}">${row.value}</td>
      </tr>
    `;
  });

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border:1px solid #131E2E;border-collapse:collapse;margin:30px 0 0 0;">
      <tr>
        <td style="padding:22px 26px 18px 26px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
            ${rowsHtml}
          </table>
        </td>
      </tr>
    </table>
  `;
}

/** 이메일용 CTA 버튼 HTML 조립 (k-select-network-email.html 준수) */
function buildCtaButtonHtml(variables: Record<string, string>) {
  const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL || "https://www.kselectnetwork.com";
  let url = variables.portalUrl || variables.applicationUrl || `${siteUrl}/portal`;
  let buttonLabel = "포털에서 확인하기";

  // If a specific link is provided in variables (e.g. admin detail link), use it
  if (variables.link) {
    url = variables.link;
  }

  const key = variables.key;
  if (key === "application_submitted_company" || key === "inquiry_received_applicant") {
    buttonLabel = "다른 브랜드 추가 신청";
  } else if (key === "application_received_internal") {
    buttonLabel = "신청서 상세 심사하기";
    url = "https://admin.kselectnetwork.com/admin/login";
  } else if (key === "inquiry_received_internal") {
    buttonLabel = "문의 내역 확인하기";
    url = "https://admin.kselectnetwork.com/admin/login";
  } else if (key === "assignment_assigned") {
    buttonLabel = "배정된 신청서 심사하기";
    url = "https://admin.kselectnetwork.com/admin/login";
  } else if (key === "assignment_unassigned") {
    buttonLabel = "어드민 포털 바로가기";
    url = "https://admin.kselectnetwork.com/admin/login";
  } else if (key === "info_request_created") {
    buttonLabel = "추가 자료 제출하기";
  } else if (key === "portal_signup_request") {
    buttonLabel = "포털 가입 시작하기";
  } else if (key === "info_request_replied") {
    buttonLabel = "회신 자료 검토하기";
  } else if (key === "review_result_approved" || key === "review_result_partial_approved") {
    buttonLabel = "브랜드사 포털 시작하기";
  } else if (key === "review_result_on_hold" || key === "review_result_rejected") {
    buttonLabel = "포털에서 심사 결과 보기";
  } else if (key === "info_request_due_soon") {
    buttonLabel = "기한 내 자료 제출하기";
  } else if (key === "info_request_overdue") {
    buttonLabel = "기한 초과 신청서 확인";
  } else if (key === "invite_expiring_soon") {
    buttonLabel = "사용자 관리 화면으로 이동";
  } else if (key === "staff_invited") {
    buttonLabel = "관리자 로그인하기";
    url = `${siteUrl}/admin/login`;
  } else if (key === "password_reset") {
    buttonLabel = "비밀번호 재설정하기";
  }

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:30px auto 0 auto;min-width:240px;">
      <tr>
        <td bgcolor="#131E2E" align="center" style="padding: 12px 28px; background-color: #131E2E">
          <a href="${url}" target="_blank" style="display:block;font-family:'Apple SD Gothic Neo','Malgun Gothic',Arial,Helvetica,sans-serif;font-size:14px;line-height:16px;mso-line-height-rule:exactly;font-weight:bold;letter-spacing:0.6px;color:#FFFFFF;text-decoration:none;text-align:center;">${buttonLabel}</a>
        </td>
      </tr>
      <tr><td style="height:3px;line-height:3px;font-size:0;background:#8C1C2B;">&nbsp;</td></tr>
    </table>
  `;
}

/** 본문 텍스트 포맷팅 및 키워드 강조 처리 */
function formatBodyTextToHtml(text: string) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/\n/g, "<br/>");

  // 키워드 강조 스타일 매핑 (디자인 가이드 반영)
  html = html.replace(
    /K SELECT NETWORK/g,
    `<strong style="color: #131E2E;">K SELECT NETWORK</strong>`
  );
  html = html.replace(
    /K-Beauty Growth Program/g,
    `<strong style="color: #131E2E;">K-Beauty Growth Program</strong>`
  );
  html = html.replace(
    /영업일(?: 기준)?\s*3일\s*이내/g,
    `<span style="color: #8C1C2B; font-weight: bold;">영업일 기준 3일 이내</span>`
  );

  return html;
}

/** 통합 글로벌 이메일 HTML 레이아웃 빌드 (k-select-network-email.html 완벽 이식) */
function buildGlobalLayout(
  subject: string,
  preheader: string,
  badgeHtml: string,
  headerHtml: string,
  bodyContentHtml: string,
  supportHtml: string,
  footerHtml: string
) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${subject} · K SELECT NETWORK</title>
<style>
  body { margin:0; padding:0; background:#F2F1EE; }
  @media only screen and (max-width:620px) {
    table[width="600"] { width:100% !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#F2F1EE;">
<span style="display:none;font-size:1px;color:#F2F1EE;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:#F2F1EE;margin:0;padding:36px 0;font-family:'Apple SD Gothic Neo','Malgun Gothic',Arial,Helvetica,sans-serif;">
  <tr>
    <td align="center" style="padding:0 16px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid #D9D6D0;">

        <tr><td style="height:6px;line-height:6px;font-size:0;background:#131E2E;">&nbsp;</td></tr>

        <!-- Header Area -->
        ${headerHtml}

        <tr><td style="padding:0 40px;"><div style="height:1px;line-height:1px;font-size:0;background:#E6E3DD;">&nbsp;</div></td></tr>

        <!-- Inner Content Card Area -->
        <tr>
          <td style="padding:38px 40px 0 40px;">
            ${badgeHtml}
            ${bodyContentHtml}
          </td>
        </tr>

        <tr><td style="padding:32px 40px 0 40px;"><div style="height:1px;line-height:1px;font-size:0;background:#E6E3DD;">&nbsp;</div></td></tr>

        <!-- Support Area -->
        ${supportHtml}

      </table>

      <!-- Footer Area -->
      ${footerHtml}

    </td>
  </tr>
</table>
</body>
</html>`;
}

/** 템플릿과 변수들을 조합하여 완벽한 HTML 이메일 정보를 생성하는 범용 헬퍼 */
export function renderEmailHtml(
  subjectTemplate: string,
  bodyTemplate: string,
  variables: Record<string, string>
) {
  const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL || "https://www.kselectnetwork.com";
  const contactName = variables.contactName || "브랜드사 담당자";

  const extendedVariables: Record<string, string> = {
    ...variables,
    contactName,
    submittedDate: variables.submittedDate || new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }),
    applicationUrl: `${siteUrl}/portal`,
    portalUrl: variables.portalUrl || `${siteUrl}/portal`,
    websiteUrl: siteUrl,
    privacyUrl: `${siteUrl}/privacy`,
    unsubscribeUrl: `${siteUrl}/unsubscribe`,
  };

  // 컴포넌트 HTML 동적 주입 (파셜 구조)
  const appNo = extendedVariables.applicationNo || extendedVariables.applicationNumber || extendedVariables.inquiryNumber || "APP-000001";
  extendedVariables.applicationNo = appNo;
  extendedVariables.infoBox = buildInfoCardHtml(extendedVariables);
  extendedVariables.ctaButton = buildCtaButtonHtml(extendedVariables);

  const finalSubject = render(subjectTemplate, extendedVariables);

  // 1. 본문 첫 줄을 메인 제목(Title Slot)으로, 나머지를 본문으로 구분하여 슬롯 파싱
  const bodyLines = bodyTemplate.split("\n");
  const rawTitle = bodyLines[0] || "";
  const rawBodyLines = bodyLines.slice(1).join("\n").trim();

  const finalTitle = render(rawTitle, extendedVariables);
  const formattedTemplate = formatBodyTextToHtml(rawBodyLines);
  const finalBodyContent = render(formattedTemplate, extendedVariables);

  // HTML 조립용 컴포넌트 생성
  const preheaderText = `신청번호 ${appNo}의 파트너십 알림입니다.`;
  const badgeLabel = getBadgeLabel(variables.key || "");
  
  // Badge HTML
  let badgeHtml = "";
  if (badgeLabel) {
    badgeHtml = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:13px;mso-line-height-rule:exactly;font-weight:bold;color:#8C1C2B;padding-right:8px;">✓</td>
          <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:13px;mso-line-height-rule:exactly;font-weight:bold;letter-spacing:2.6px;color:#131E2E;text-transform:uppercase;">${badgeLabel}</td>
        </tr>
      </table>
      <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
    `;
  }

  // Header HTML (절대 경로 이미지)
  const logoUrl = `${publicEnv.NEXT_PUBLIC_SITE_URL}/ksn-symbol.png`;
  const headerHtml = `
    <tr>
      <td style="padding:34px 40px 26px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td width="54" valign="top" style="width:54px;">
              <img src="${logoUrl}" width="52" height="50" alt="K SELECT NETWORK" style="display:block;width:52px;height:50px;border:0;outline:none;text-decoration:none;" />
            </td>
            <td valign="top" style="padding-left:16px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:26px;mso-line-height-rule:exactly;font-weight:bold;letter-spacing:0.6px;color:#131E2E;">K SELECT NETWORK</div>
              <div style="height:9px;line-height:9px;font-size:0;">&nbsp;</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;line-height:12px;mso-line-height-rule:exactly;font-weight:bold;letter-spacing:2.4px;color:#8C1C2B;text-transform:uppercase;">CURATED. CONNECTED. GROWING TOGETHER.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  // Body Content Area (Title + Paragraphs)
  const bodyContentHtml = `
    <div style="font-size:27px;line-height:38px;mso-line-height-rule:exactly;font-weight:700;color:#131E2E;letter-spacing:-0.5px;text-wrap:pretty;text-align:left;">${finalTitle}</div>
    <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
    <div style="font-size:15px;line-height:27px;mso-line-height-rule:exactly;color:#5A6270;text-align:left;">${finalBodyContent}</div>
  `;

  // Support HTML
  const supportHtml = `
    <tr>
      <td style="padding:24px 40px 36px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
          <tr>
            <td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:20px;mso-line-height-rule:exactly;font-weight:bold;letter-spacing:2.2px;color:#B4AEA3;width:96px;text-align:left;">SUPPORT</td>
            <td valign="top" style="font-size:13px;line-height:22px;mso-line-height-rule:exactly;color:#5A6270;text-align:left;">문의 <a href="mailto:support@kselectnetwork.com" style="color:#131E2E;text-decoration:none;font-weight:bold;">support@kselectnetwork.com</a><br>웹사이트 <a href="https://kselectnetwork.com" target="_blank" style="color:#131E2E;text-decoration:none;font-weight:bold;">kselectnetwork.com</a></td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  // Footer HTML
  const privacyUrl = extendedVariables.privacyUrl;
  const unsubscribeUrl = extendedVariables.unsubscribeUrl;
  const footerHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:24px 24px 8px 24px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;line-height:12px;mso-line-height-rule:exactly;font-weight:bold;letter-spacing:2.4px;color:#8C1C2B;text-transform:uppercase;">CURATED. CONNECTED. GROWING TOGETHER.</div>
          <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
          <div style="font-size:11px;line-height:19px;mso-line-height-rule:exactly;color:#9E988E;text-align:center;">K SELECT NETWORK · K-Beauty Growth Program<br>23B, Roland Avenue, Mount Laurel, New Jersey 08054<br>본 메일은 파트너 신청 접수 확인을 위해 자동 발송되었습니다.</div>
          <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
          <div style="font-size:11px;line-height:19px;mso-line-height-rule:exactly;text-align:center;"><a href="${privacyUrl}" target="_blank" style="color:#7B7469;text-decoration:underline;">개인정보 처리방침</a> &nbsp;·&nbsp; <a href="${unsubscribeUrl}" target="_blank" style="color:#7B7469;text-decoration:underline;">수신 거부</a></div>
        </td>
      </tr>
    </table>
  `;

  const finalHtml = buildGlobalLayout(
    finalSubject,
    preheaderText,
    badgeHtml,
    headerHtml,
    bodyContentHtml,
    supportHtml,
    footerHtml
  );

  // Plain Text 폴백 준비 (태그 제거)
  const rawBodyText = render(bodyTemplate, extendedVariables);

  return {
    subject: finalSubject,
    text: rawBodyText.replace(/<[^>]*>/g, ""),
    html: finalHtml,
  };
}

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
  let bodyTemplate = template?.body_template ?? DEFAULT_TEMPLATES[key].body;

  if (key === "info_request_created" && !variables.dueDate) {
    bodyTemplate = bodyTemplate
      .replace("회신 기한인 {{dueDate}}까지 ", "")
      .replace("회신 기한인 까지 ", "")
      .replace("회신 기한인  까지 ", "");
  }

  // 템플릿 키를 variables에 같이 넘겨서 파셜 구조화에 활용
  const { subject, text, html } = renderEmailHtml(subjectTemplate, bodyTemplate, {
    ...variables,
    key,
  });

  await sendEmail({
    to,
    subject,
    text,
    html,
  });
}
