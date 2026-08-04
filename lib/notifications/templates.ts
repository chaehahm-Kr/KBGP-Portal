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
 * 같은 문구를 유지한다.
 */
export const DEFAULT_TEMPLATES: Record<
  TemplateKey,
  { description: string; subject: string; body: string }
> = {
  application_submitted_company: {
    description: "회사 담당자 — 신청서 제출 완료",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 파트너 신청이 접수되었습니다",
    body: "신청이 정상적으로 접수되었습니다.\n\n안녕하세요, {{contactName}}님.\nK SELECT NETWORK의 K-Beauty Growth Program에 신청해 주셔서 감사합니다.\n제출해 주신 신청서는 아래 접수번호로 정상 등록되었습니다.\n\n{{infoBox}}\n\n제출하신 브랜드와 상품 정보를 검토한 후, 담당자가 영업일 기준 3일 이내에 이메일 또는 전화로 연락드리겠습니다.\n\n{{ctaButton}}",
  },
  application_received_internal: {
    description: "내부 직원 전체 — 신규 신청서 접수",
    subject: "[신규 접수] {{applicationNumber}} — {{companyName}}, 제품 {{productCount}}건",
    body: "안녕하세요.\n\n신청번호 {{applicationNumber}} 신규 접수 완료되었습니다.\n\n회사명: {{companyName}}\n등록 제품 수: {{productCount}}건\n\n상세 확인 링크: {{link}}",
  },
  assignment_assigned: {
    description: "내부 직원 — 담당자로 배정됨",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 담당자로 배정되었습니다",
    body: "안녕하세요.\n\n신청번호 {{applicationNumber}}의 담당자로 배정되었습니다.{{reasonLine}}\n\n포털에서 확인 후 심사를 진행해 주세요.",
  },
  assignment_unassigned: {
    description: "내부 직원 — 담당자 배정 해제됨",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 담당자 배정이 해제되었습니다",
    body: "안녕하세요.\n\n참고용 안내입니다 — 신청번호 {{applicationNumber}}의 담당자에서 해제되었습니다.",
  },
  info_request_created: {
    description: "회사 담당자 — 추가 자료 요청 발송",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 추가 자료 요청",
    body: "안녕하세요, {{contactName}}님.\n\n{{applicationNumber}} 신청서 심사를 위해 추가 자료가 필요합니다.\n\n요청 내용:\n{{requestContent}}\n\n회신 기한인 {{dueDate}}까지 포털에 로그인하여 추가 자료를 제출해 주시기 바랍니다.",
  },
  info_request_replied: {
    description: "내부 담당자 — 추가 자료 회신 도착",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 추가 자료 회신 도착",
    body: "안녕하세요.\n\n{{applicationNumber}} 신청서에 대한 추가 자료 회신이 도착했습니다. 포털에서 확인 및 검토해 주세요.",
  },
  review_result_approved: {
    description: "회사 담당자 — 심사 결과: 승인",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 파트너십 승인 안내",
    body: "안녕하세요, {{contactName}}님.\n\n축하드립니다! 제출해주신 [{{applicationNumber}}] 신청이 승인되었습니다.\n\n다음 단계인 미국 런칭 상담 예약 및 진행 일정을 곧 안내해 드리겠습니다.",
  },
  review_result_partial_approved: {
    description: "회사 담당자 — 심사 결과: 부분승인",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 심사 결과 안내",
    body: "안녕하세요, {{contactName}}님.\n\n제출해주신 [{{applicationNumber}}] 신청서에 포함된 제품 중 일부가 승인되었습니다.\n\n승인된 제품에 한해 다음 단계를 진행할 예정이며, 상세 내용은 포털에서 확인하실 수 있습니다.",
  },
  review_result_on_hold: {
    description: "회사 담당자 — 심사 결과: 보류",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 심사 결과 안내",
    body: "안녕하세요, {{contactName}}님.\n\n제출해주신 [{{applicationNumber}}] 신청은 현재 시점에는 진행이 어렵다는 보류 판단을 받았습니다.\n\n상세한 보류 사유와 재신청 가능 일정은 포털 내 신청 이력에서 확인해 주시기 바랍니다.",
  },
  review_result_rejected: {
    description: "회사 담당자 — 심사 결과: 반려",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 심사 결과 안내",
    body: "안녕하세요, {{contactName}}님.\n\n제출해주신 [{{applicationNumber}}] 신청은 참여 조건을 충족하지 못해 이번에는 진행이 어렵다는 판단입니다.\n\n자세한 사유는 포털에서 확인 가능합니다. 참여해 주셔서 감사합니다.",
  },
  info_request_due_soon: {
    description: "회사 담당자 — 추가 자료 회신 기한 임박",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 추가 자료 회신 기한이 곧 마감됩니다",
    body: "안녕하세요, {{contactName}}님.\n\n{{applicationNumber}} 신청서의 추가 자료 요청 회신 기한이 {{dueDate}}까지입니다. 아직 회신 전이라면 기한 내에 포털을 통해 회신해 주시기 바랍니다.",
  },
  info_request_overdue: {
    description: "내부 담당자 — 추가 자료 회신 기한 초과",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 추가 자료 회신 기한 초과",
    body: "안녕하세요.\n\n{{applicationNumber}} 신청서의 추가 자료 요청 회신 기한({{dueDate}})이 초과되었습니다. 확인 후 직접 연락해 주시기 바랍니다.",
  },
  invite_expiring_soon: {
    description: "초대한 Company Admin — 초대 만료 임박",
    subject: "[K SELECT NETWORK] {{inviteeName}}님 초대가 곧 만료됩니다",
    body: "안녕하세요.\n\n{{inviteeName}}({{inviteeEmail}})님께 보낸 초대가 24시간 내에 만료됩니다. 계속 진행하려면 사용자 관리 화면에서 재초대해 주세요.",
  },
  inquiry_received_applicant: {
    description: "신청자 — 마케팅 사이트 신청서 접수 확인",
    subject: "[K SELECT NETWORK] {{applicationNumber}} 파트너 신청이 접수되었습니다",
    body: "신청이 정상적으로 접수되었습니다.\n\n안녕하세요, {{contactName}}님.\nK SELECT NETWORK의 K-Beauty Growth Program에 신청해 주셔서 감사합니다.\n제출해 주신 신청서는 아래 접수번호로 정상 등록되었습니다.\n\n{{infoBox}}\n\n제출하신 브랜드와 상품 정보를 검토한 후, 담당자가 영업일 기준 3일 이내에 이메일 또는 전화로 연락드리겠습니다.\n\n{{ctaButton}}",
  },
  inquiry_received_internal: {
    description: "내부 직원 전체 — 마케팅 사이트 신규 문의 접수",
    subject: "[신규 문의] {{inquiryNumber}} — {{companyName}}, 제품 {{productCount}}건",
    body: "안녕하세요.\n\n신규 문의 접수 완료: {{inquiryNumber}} (회사명: {{companyName}})\n등록 제품 수: {{productCount}}건\n\n상세 확인: {{link}}",
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

/** 이메일용 접수정보 박스 HTML 조립 */
function buildInfoBoxHtml(variables: Record<string, string>) {
  const number = variables.applicationNumber || variables.inquiryNumber || "-";
  const brand = variables.brandName || "-";
  const program = variables.programName || "K-Beauty Growth Program";
  const date = variables.submittedDate || new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  
  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F6F6F4; border: 1px solid #E5E5E5; border-radius: 8px; margin: 24px 0; border-collapse: collapse;">
      <tr>
        <td style="padding: 24px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding-bottom: 12px; border-bottom: 1px solid #E5E5E5; text-align: left;">
                <span style="font-size: 11px; color: #666666; display: block; margin-bottom: 4px; font-weight: bold; text-transform: uppercase;">접수번호</span>
                <strong style="font-size: 18px; color: #8B1E2D; font-family: monospace; letter-spacing: 0.5px;">${number}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #E5E5E5; text-align: left;">
                <span style="font-size: 11px; color: #666666; display: block; margin-bottom: 4px; font-weight: bold; text-transform: uppercase;">신청 브랜드</span>
                <strong style="font-size: 15px; color: #111827;">${brand}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #E5E5E5; text-align: left;">
                <span style="font-size: 11px; color: #666666; display: block; margin-bottom: 4px; font-weight: bold; text-transform: uppercase;">신청 프로그램</span>
                <strong style="font-size: 15px; color: #111827;">${program}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 12px; text-align: left;">
                <span style="font-size: 11px; color: #666666; display: block; margin-bottom: 4px; font-weight: bold; text-transform: uppercase;">접수일</span>
                <strong style="font-size: 15px; color: #111827;">${date}</strong>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

/** 이메일용 CTA 버튼 HTML 조립 */
function buildCtaButtonHtml(variables: Record<string, string>) {
  const url = variables.applicationUrl || "https://www.kselectnetwork.com";
  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 32px 0 24px 0;">
      <tr>
        <td align="left">
          <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate;">
            <tr>
              <td align="center" valign="middle" style="background-color: #8B1E2D; border-radius: 6px;">
                <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 32px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 6px; letter-spacing: 0.5px;">
                  다른 브랜드 추가 신청
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 12px; color: #999999; font-size: 11px; line-height: 1.4; text-align: left;">
          ※ 위 버튼이 작동하지 않는 경우 아래 링크를 주소창에 복사하여 이동해 주세요.<br/>
          <a href="${url}" target="_blank" style="color: #8B1E2D; text-decoration: underline;">${url}</a>
        </td>
      </tr>
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

  // 키워드 강조 스타일 매핑
  html = html.replace(
    /K SELECT NETWORK/g,
    `<strong style="color: #111827;">K SELECT NETWORK</strong>`
  );
  html = html.replace(
    /K-Beauty Growth Program/g,
    `<strong style="color: #111827;">K-Beauty Growth Program</strong>`
  );
  html = html.replace(
    /영업일(?: 기준)?\s*3일\s*이내/g,
    `<span style="color: #8B1E2D; font-weight: bold;">영업일 기준 3일 이내</span>`
  );

  return html;
}

/** 통합 글로벌 이메일 HTML 레이아웃 빌드 */
function buildGlobalLayout(subject: string, bodyContentHtml: string) {
  const logoUrl = `${publicEnv.NEXT_PUBLIC_SITE_URL}/ksn-logo-new.png`;
  const websiteUrl = "https://www.kselectnetwork.com";
  const privacyUrl = "https://www.kselectnetwork.com";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      background-color: #F4F4F2;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    img {
      border: 0;
      outline: none;
      text-decoration: none;
      display: block;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    /* Mobile styles */
    @media only screen and (max-width: 620px) {
      .container {
        width: 100% !important;
        padding-left: 20px !important;
        padding-right: 20px !important;
      }
      .card {
        padding: 24px !important;
      }
      .logo {
        max-width: 220px !important;
      }
      .title {
        font-size: 24px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F4F2; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F4F4F2; padding: 40px 0;">
    <tr>
      <td align="center">
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
        <tr>
        <td align="center" valign="top" width="600">
        <![endif]-->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" class="container" style="max-width: 600px; border-collapse: collapse;">
          <!-- Content Card -->
          <tr>
            <td class="card" style="background-color: #FFFFFF; padding: 40px; border-radius: 8px; border: 1px solid #E5E5E5;">
              <!-- Logo Area -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px; border-collapse: collapse;">
                <tr>
                  <td align="left">
                    <img class="logo" src="${logoUrl}" alt="K SELECT NETWORK" width="240" style="display: block; max-width: 240px; height: auto;" />
                  </td>
                </tr>
              </table>
              
              <!-- Burgundy Line -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px; border-collapse: collapse;">
                <tr>
                  <td style="background-color: #8B1E2D; height: 2px; font-size: 1px; line-height: 1px;">&nbsp;</td>
                </tr>
              </table>
              
              <!-- Main Content Body -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                <tr>
                  <td style="color: #333333; font-size: 15px; line-height: 1.7; text-align: left;">
                    ${bodyContentHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer Area -->
          <tr>
            <td style="padding: 32px 24px; text-align: center;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                <tr>
                  <td style="color: #666666; font-size: 12px; line-height: 1.7; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center;">
                    <p style="margin: 0 0 6px 0; font-weight: bold; color: #111827; font-size: 12px;">K SELECT NETWORK K-Beauty Growth Program</p>
                    <p style="margin: 0 0 16px 0;">
                      문의: <a href="mailto:support@kselectnetwork.com" style="color: #8B1E2D; text-decoration: none; font-weight: bold;">support@kselectnetwork.com</a> 
                      &nbsp;&middot;&nbsp; 
                      웹사이트: <a href="${websiteUrl}" target="_blank" style="color: #8B1E2D; text-decoration: none; font-weight: bold;">kselectnetwork.com</a>
                    </p>
                    <p style="margin: 0 0 12px 0; color: #999999; font-size: 11px;">본 메일은 파트너 신청 접수 확인을 위해 자동 발송되었습니다.</p>
                    <p style="margin: 0 0 16px 0;">
                      <a href="${privacyUrl}" target="_blank" style="color: #666666; text-decoration: underline; font-weight: 500;">개인정보 처리방침</a>
                    </p>
                    <p style="margin: 0; font-size: 10px; color: #8B1E2D; letter-spacing: 1px; font-weight: bold; text-transform: uppercase;">Curated. Connected. Growing Together.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>
  `;
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
    websiteUrl: siteUrl,
    privacyUrl: siteUrl,
  };

  // 컴포넌트 HTML 동적 주입
  extendedVariables.infoBox = buildInfoBoxHtml(extendedVariables);
  extendedVariables.ctaButton = buildCtaButtonHtml(extendedVariables);

  const finalSubject = render(subjectTemplate, extendedVariables);
  const rawBodyText = render(bodyTemplate, extendedVariables);

  // 본문 HTML 포맷팅 및 글로벌 레이아웃 조립
  const bodyContentHtml = formatBodyTextToHtml(rawBodyText);
  const finalHtml = buildGlobalLayout(finalSubject, bodyContentHtml);

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
  const bodyTemplate = template?.body_template ?? DEFAULT_TEMPLATES[key].body;

  const { subject, text, html } = renderEmailHtml(subjectTemplate, bodyTemplate, variables);

  await sendEmail({
    to,
    subject,
    text,
    html,
  });
}
