import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { publicEnv } from "@/lib/env/public";

export const NETWORK_TEMPLATE_KEYS = [
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

export const HUB_TEMPLATE_KEYS = [
  "hub_retailer_application_received",
  "hub_application_under_review",
  "hub_info_request_created",
  "hub_application_approved",
  "hub_application_rejected",
  "hub_retailer_partner_invited",
  "hub_retailer_user_invited",
  "hub_retailer_account_activated",
  "hub_welcome_retailer",
  "hub_password_reset",
  "hub_order_confirmed",
  "hub_shipment_created",
  "hub_shipment_tracking_update",
  "hub_order_delivered",
] as const;

export const TEMPLATE_KEYS = [
  ...NETWORK_TEMPLATE_KEYS,
  ...HUB_TEMPLATE_KEYS,
] as const;

export type NetworkTemplateKey = (typeof NETWORK_TEMPLATE_KEYS)[number];
export type HubTemplateKey = (typeof HUB_TEMPLATE_KEYS)[number];
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

/**
 * Default templates dictionary with clean English copy for HUB and Korean for NETWORK
 */
export const DEFAULT_TEMPLATES: Record<
  TemplateKey,
  { description: string; subject: string; body: string }
> = {
  // === K SELECT NETWORK (브랜드/공급사) ===
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

  // === K SELECT HUB (리테일러 파트너) ===
  hub_retailer_application_received: {
    description: "Retailer Partner — Application Received Confirmation",
    subject: "[K SELECT HUB] Retailer Application Received — {{applicationNumber}}",
    body: "Thank you for applying to K SELECT HUB.\n\nHello {{contactName}},\n\nWe have successfully received your retail partnership application for {{companyName}}.\n\nOur curation and retail onboarding team is currently reviewing your store profile and territory eligibility.\n\n{{infoBox}}\n\nWhat happens next?\n• Our team will review your application within 1–2 business days.\n• Once approved, you will receive an invitation link to set up your K SELECT Retailer Portal account.\n\nIf you have any questions in the meantime, please contact our team at {{supportEmail}}.",
  },
  hub_application_under_review: {
    description: "Retailer Partner — Application Under Review",
    subject: "[K SELECT HUB] Your Application {{applicationNumber}} is Under Review",
    body: "Your application is currently under review.\n\nHello {{contactName}},\n\nOur retail operations team has started evaluating your partnership application for {{companyName}}.\n\n{{infoBox}}\n\nWe are confirming product allocation and logistics support for your store location(s). We will update you shortly with final onboarding steps.\n\n{{ctaButton}}",
  },
  hub_info_request_created: {
    description: "Retailer Partner — Additional Information Requested",
    subject: "[K SELECT HUB] Action Required: Additional Information for {{applicationNumber}}",
    body: "Additional information is required for your retailer application.\n\nHello {{contactName}},\n\nTo proceed with your application for {{companyName}}, our team needs a few additional details:\n\n{{requestContent}}\n\n{{infoBox}}\n\nPlease submit the requested information by clicking the button below:\n\n{{ctaButton}}",
  },
  hub_application_approved: {
    description: "Retailer Partner — Application Approved",
    subject: "[K SELECT HUB] Welcome to K SELECT HUB — Partnership Approved!",
    body: "Congratulations! Your retail partnership application has been approved.\n\nHello {{contactName}},\n\nWe are excited to welcome {{companyName}} to the K SELECT HUB retail network.\n\n{{infoBox}}\n\nNext Step: Activate your Retailer Portal account to access curated K-Beauty inventory, order opening stock, and access retail training materials.\n\n{{ctaButton}}",
  },
  hub_application_rejected: {
    description: "Retailer Partner — Application Not Accepted",
    subject: "[K SELECT HUB] Update on Your Retailer Application — {{applicationNumber}}",
    body: "Thank you for your interest in K SELECT HUB.\n\nHello {{contactName}},\n\nThank you for taking the time to submit your retail partnership application for {{companyName}}.\n\nAfter careful review of current territory capacity and product distribution availability, we are unable to approve your application at this time.\n\n{{infoBox}}\n\n{{notes}}\n\nWe will keep your store information on file for future expansion opportunities.",
  },
  hub_retailer_partner_invited: {
    description: "Retailer Partner — Invitation to Activate Retailer Account",
    subject: "[K SELECT HUB] You are invited to join K SELECT HUB as {{companyName}}",
    body: "You have been invited to K SELECT HUB Retailer Portal.\n\nHello {{contactName}},\n\nYou have been invited to set up and manage the official retail account for {{companyName}} on K SELECT HUB.\n\n{{infoBox}}\n\nAs a K SELECT HUB retail partner, you will receive:\n• Direct wholesale access to verified, trending K-Beauty brands\n• 90-Day Initial Trial Protection on eligible opening assortments\n• Turnkey store merchandising kits, product QR guides, and price tags\n• Weekly inventory management and rapid US replenishment\n\nClick the link below to accept your invitation and activate your account:\n\n{{ctaButton}}",
  },
  hub_retailer_user_invited: {
    description: "Retailer Team Member — Team Member Invitation",
    subject: "[K SELECT HUB] Team Invitation: Join {{companyName}} on Retailer Portal",
    body: "You have been invited to join your team on K SELECT HUB.\n\nHello {{contactName}},\n\nYou have been invited to join {{companyName}}'s team on the K SELECT Retailer Portal as an authorized team member.\n\n{{infoBox}}\n\nClick below to activate your user account and access store operations:\n\n{{ctaButton}}",
  },
  hub_retailer_account_activated: {
    description: "Retailer Partner — Account Activation Confirmation",
    subject: "[K SELECT HUB] Account Activated — Welcome to {{companyName}} Retail Portal",
    body: "Your K SELECT HUB account is now active!\n\nHello {{contactName}},\n\nYour retail account for {{companyName}} has been successfully activated. You now have full access to the K SELECT Retailer Portal.\n\n{{infoBox}}\n\nYou can now:\n• Browse wholesale catalogs and place stock orders\n• Download product display guides and marketing tags\n• Access weekly store check tools and inventory reporting\n\n{{ctaButton}}",
  },
  hub_welcome_retailer: {
    description: "Retailer Partner — Welcome & Getting Started Guide",
    subject: "[K SELECT HUB] Getting Started: Launching K-Beauty in Your Store",
    body: "Welcome to K SELECT HUB Retailer Network!\n\nHello {{contactName}},\n\nWe are thrilled to partner with {{companyName}} to bring premium, curated K-Beauty products to your customers.\n\n{{infoBox}}\n\nHere are 3 quick steps to maximize your launch:\n1. Review your initial curated assortment on the portal.\n2. Confirm your physical store display setup and POS tags.\n3. Complete your initial stock order for swift US warehouse fulfillment.\n\n{{ctaButton}}\n\nOur retail support team is always here to assist you at {{supportEmail}}.",
  },
  hub_password_reset: {
    description: "Retailer User — Password Reset Instructions",
    subject: "[K SELECT HUB] Reset Your Password",
    body: "Password Reset Request\n\nHello {{contactName}},\n\nWe received a request to reset the password for your K SELECT HUB account ({{email}}).\n\n{{infoBox}}\n\nIf you requested this change, click the button below to set a new password:\n\n{{ctaButton}}\n\nIf you did not request a password reset, you can safely ignore this email.",
  },
  hub_order_confirmed: {
    description: "Retailer Partner — Order Confirmation",
    subject: "[K SELECT HUB] Order Confirmed — {{orderNumber}}",
    body: "Your order has been received and confirmed.\n\nHello {{contactName}},\n\nThank you for your order. We have received order {{orderNumber}} for {{companyName}} and our US fulfillment center is preparing it for shipment.\n\n{{infoBox}}\n\nYou can track the fulfillment status and download your order invoice in the Retailer Portal.\n\n{{ctaButton}}",
  },
  hub_shipment_created: {
    description: "Retailer Partner — Shipment Dispatched",
    subject: "[K SELECT HUB] Shipment Created — Order {{orderNumber}} is on its way!",
    body: "Your shipment is on its way.\n\nHello {{contactName}},\n\nGreat news! Order {{orderNumber}} for {{companyName}} has been packed and dispatched from our warehouse.\n\n{{infoBox}}\n\nTrack your package directly with the carrier or view live updates in your portal:\n\n{{ctaButton}}",
  },
  hub_shipment_tracking_update: {
    description: "Retailer Partner — Tracking & Transit Update",
    subject: "[K SELECT HUB] Tracking Update: Shipment for Order {{orderNumber}}",
    body: "Shipment Tracking Update\n\nHello {{contactName}},\n\nHere is the latest transit update for your shipment under Order {{orderNumber}}.\n\n{{infoBox}}\n\nClick below to view full tracking and logistics history:\n\n{{ctaButton}}",
  },
  hub_order_delivered: {
    description: "Retailer Partner — Order Delivered Confirmation",
    subject: "[K SELECT HUB] Package Delivered — Order {{orderNumber}}",
    body: "Your order has been delivered.\n\nHello {{contactName}},\n\nCarrier records indicate that Order {{orderNumber}} for {{companyName}} has been successfully delivered to your store address.\n\n{{infoBox}}\n\nPlease inspect your shipment. If you have any questions or require support with store merchandising, log in to your portal or contact {{supportEmail}}.\n\n{{ctaButton}}",
  },
};

/**
 * Template-specific sample variable datasets for exact, context-relevant live preview
 */
export const TEMPLATE_SAMPLE_VARIABLES: Record<TemplateKey, Record<string, string>> = {
  // === NETWORK ===
  application_submitted_company: {
    applicationNumber: "APP-000001",
    applicationNo: "APP-000001",
    contactName: "김민지",
    brandName: "ABC Beauty",
    nextStep: "서류 심사 · 3 영업일 내",
    portalUrl: "https://portal.kselectnetwork.com",
    privacyUrl: "https://www.kselectnetwork.com/privacy",
    unsubscribeUrl: "https://www.kselectnetwork.com/unsubscribe",
  },
  application_received_internal: {
    applicationNumber: "APP-000001",
    companyName: "샘플뷰티코리아",
    productCount: "3",
    portalUrl: "https://admin.kselectnetwork.com",
  },
  assignment_assigned: {
    applicationNumber: "APP-000001",
    reasonLine: " 배정 사유: 스킨케어 카테고리 심사 담당",
    portalUrl: "https://admin.kselectnetwork.com",
  },
  assignment_unassigned: {
    applicationNumber: "APP-000001",
    portalUrl: "https://admin.kselectnetwork.com",
  },
  info_request_created: {
    applicationNumber: "APP-000001",
    contactName: "김민지",
    requestContent: "최신 영문 성분표 및 MSDS 서류를 첨부해 주세요.",
    dueDate: "2026년 10월 15일",
    portalUrl: "https://portal.kselectnetwork.com",
  },
  portal_signup_request: {
    contactName: "김민지",
    companyName: "샘플뷰티코리아",
    portalUrl: "https://portal.kselectnetwork.com/portal/login",
  },
  info_request_replied: {
    applicationNumber: "APP-000001",
    companyName: "샘플뷰티코리아",
    portalUrl: "https://admin.kselectnetwork.com",
  },
  review_result_approved: {
    applicationNumber: "APP-000001",
    contactName: "김민지",
    companyName: "샘플뷰티코리아",
    portalUrl: "https://portal.kselectnetwork.com",
  },
  review_result_partial_approved: {
    applicationNumber: "APP-000001",
    contactName: "김민지",
    portalUrl: "https://portal.kselectnetwork.com",
  },
  review_result_on_hold: {
    applicationNumber: "APP-000001",
    contactName: "김민지",
    portalUrl: "https://portal.kselectnetwork.com",
  },
  review_result_rejected: {
    applicationNumber: "APP-000001",
    contactName: "김민지",
    portalUrl: "https://portal.kselectnetwork.com",
  },
  info_request_due_soon: {
    applicationNumber: "APP-000001",
    contactName: "김민지",
    dueDate: "2026년 10월 15일",
    portalUrl: "https://portal.kselectnetwork.com",
  },
  info_request_overdue: {
    applicationNumber: "APP-000001",
    dueDate: "2026년 10월 15일",
    portalUrl: "https://admin.kselectnetwork.com",
  },
  invite_expiring_soon: {
    inviteeName: "김샘플",
    inviteeEmail: "sample@brand.co.kr",
    portalUrl: "https://portal.kselectnetwork.com",
  },
  inquiry_received_applicant: {
    applicationNumber: "APP-000001",
    contactName: "김민지",
    brandName: "ABC Beauty",
    nextStep: "서류 심사 · 3 영업일 내",
    portalUrl: "https://portal.kselectnetwork.com",
  },
  inquiry_received_internal: {
    inquiryNumber: "INQ-2026-001",
    companyName: "샘플뷰티코리아",
    productCount: "3",
    portalUrl: "https://admin.kselectnetwork.com",
  },
  staff_invited: {
    contactName: "이관리",
    email: "admin2@kselectnetwork.com",
    tempPassword: "TempPassword123!",
    portalUrl: "https://admin.kselectnetwork.com/admin/login",
  },

  // === HUB ===
  hub_retailer_application_received: {
    contactName: "Sarah Jenkins",
    companyName: "Luxe Beauty Bar",
    applicationNumber: "APP-RET-104921",
    applicationNo: "APP-RET-104921",
    applicationStatus: "Application Received",
    nextStep: "Application Review · 1–2 Business Days",
    supportEmail: "support@kselecthub.com",
    portalUrl: "https://portal.kselecthub.com",
  },
  hub_application_under_review: {
    contactName: "Sarah Jenkins",
    companyName: "Luxe Beauty Bar",
    applicationNumber: "APP-RET-104921",
    applicationNo: "APP-RET-104921",
    applicationStatus: "Under Review",
    nextStep: "Territory & Product Allocation Confirmation",
    supportEmail: "support@kselecthub.com",
    portalUrl: "https://portal.kselecthub.com",
  },
  hub_info_request_created: {
    contactName: "Sarah Jenkins",
    companyName: "Luxe Beauty Bar",
    applicationNumber: "APP-RET-104921",
    applicationNo: "APP-RET-104921",
    requestContent: "Please provide a photo of your primary storefront display area and a copy of your state resale certificate.",
    dueDate: "October 15, 2026",
    applicationStatus: "Action Required",
    supportEmail: "support@kselecthub.com",
    portalUrl: "https://portal.kselecthub.com",
  },
  hub_application_approved: {
    contactName: "Sarah Jenkins",
    companyName: "Luxe Beauty Bar",
    applicationNumber: "APP-RET-104921",
    applicationNo: "APP-RET-104921",
    applicationStatus: "Approved · Partnership Welcome",
    nextStep: "Account Activation & Opening Stock Selection",
    supportEmail: "support@kselecthub.com",
    portalUrl: "https://portal.kselecthub.com",
  },
  hub_application_rejected: {
    contactName: "Sarah Jenkins",
    companyName: "Luxe Beauty Bar",
    applicationNumber: "APP-RET-104921",
    applicationNo: "APP-RET-104921",
    applicationStatus: "Application Not Accepted",
    notes: "Note: Current retail territory capacity is at full limit for your immediate ZIP code.",
    nextStep: "Eligible for re-application in 60 days",
    supportEmail: "support@kselecthub.com",
    portalUrl: "https://www.kselecthub.com",
  },
  hub_retailer_partner_invited: {
    contactName: "Sarah Jenkins",
    companyName: "Luxe Beauty Bar",
    role: "Company Owner",
    expirationDate: "7 Days from receipt",
    invitationLink: "https://portal.kselecthub.com/invite/sample-token",
    link: "https://portal.kselecthub.com/invite/sample-token",
    supportEmail: "support@kselecthub.com",
    portalUrl: "https://portal.kselecthub.com",
  },
  hub_retailer_user_invited: {
    contactName: "Michael Chang",
    companyName: "Luxe Beauty Bar",
    role: "Store Manager",
    expirationDate: "7 Days from receipt",
    invitationLink: "https://portal.kselecthub.com/invite/sample-token",
    link: "https://portal.kselecthub.com/invite/sample-token",
    supportEmail: "support@kselecthub.com",
    portalUrl: "https://portal.kselecthub.com",
  },
  hub_retailer_account_activated: {
    contactName: "Sarah Jenkins",
    companyName: "Luxe Beauty Bar",
    accountStatus: "Active · Full Access",
    nextStep: "Browse Wholesale Catalogs & Place Opening Stock",
    portalUrl: "https://portal.kselecthub.com",
    supportEmail: "support@kselecthub.com",
  },
  hub_welcome_retailer: {
    contactName: "Sarah Jenkins",
    companyName: "Luxe Beauty Bar",
    accountStatus: "Active Retail Partner",
    nextStep: "Explore Assortments & Order Opening Stock",
    portalUrl: "https://portal.kselecthub.com",
    supportEmail: "support@kselecthub.com",
  },
  hub_password_reset: {
    contactName: "Sarah Jenkins",
    email: "sarah@luxebeautybar.com",
    portalUrl: "https://portal.kselecthub.com/retailer/reset-password",
    link: "https://portal.kselecthub.com/retailer/reset-password",
    supportEmail: "support@kselecthub.com",
  },
  hub_order_confirmed: {
    contactName: "Sarah Jenkins",
    companyName: "Luxe Beauty Bar",
    orderNumber: "ORD-2026-0891",
    orderDate: "September 25, 2026",
    orderAmount: "$3,450.00",
    orderStatus: "Confirmed · In Preparation",
    portalUrl: "https://portal.kselecthub.com/retailer/orders/ORD-2026-0891",
    link: "https://portal.kselecthub.com/retailer/orders/ORD-2026-0891",
    supportEmail: "support@kselecthub.com",
  },
  hub_shipment_created: {
    contactName: "Sarah Jenkins",
    companyName: "Luxe Beauty Bar",
    orderNumber: "ORD-2026-0891",
    carrier: "UPS Ground",
    trackingNumber: "1Z9999999999999999",
    shippedDate: "September 25, 2026",
    shipmentStatus: "Dispatched from US Warehouse",
    portalUrl: "https://portal.kselecthub.com/retailer/orders/ORD-2026-0891",
    link: "https://portal.kselecthub.com/retailer/orders/ORD-2026-0891",
    supportEmail: "support@kselecthub.com",
  },
  hub_shipment_tracking_update: {
    contactName: "Sarah Jenkins",
    companyName: "Luxe Beauty Bar",
    orderNumber: "ORD-2026-0891",
    carrier: "UPS Ground",
    trackingNumber: "1Z9999999999999999",
    shipmentStatus: "In Transit · Out for Delivery",
    dueDate: "October 1, 2026",
    portalUrl: "https://portal.kselecthub.com/retailer/orders/ORD-2026-0891",
    link: "https://portal.kselecthub.com/retailer/orders/ORD-2026-0891",
    supportEmail: "support@kselecthub.com",
  },
  hub_order_delivered: {
    contactName: "Sarah Jenkins",
    companyName: "Luxe Beauty Bar",
    orderNumber: "ORD-2026-0891",
    carrier: "UPS Ground",
    deliveredDate: "October 1, 2026",
    orderStatus: "Delivered · Completed",
    portalUrl: "https://portal.kselecthub.com/retailer/orders/ORD-2026-0891",
    link: "https://portal.kselecthub.com/retailer/orders/ORD-2026-0891",
    supportEmail: "support@kselecthub.com",
  },
};

/**
 * Contextual variable chips mapped per template
 */
export const TEMPLATE_VARIABLE_CHIPS: Record<TemplateKey, Array<{ tag: string; label: string }>> = {
  // === NETWORK ===
  application_submitted_company: [
    { tag: "{{contactName}}", label: "담당자명" },
    { tag: "{{applicationNumber}}", label: "신청번호" },
    { tag: "{{brandName}}", label: "신청 브랜드" },
    { tag: "{{infoBox}}", label: "접수 정보 카드" },
    { tag: "{{ctaButton}}", label: "신청 바로가기 버튼" },
  ],
  application_received_internal: [
    { tag: "{{applicationNumber}}", label: "신청번호" },
    { tag: "{{companyName}}", label: "회사명" },
    { tag: "{{productCount}}", label: "신청 제품 수" },
    { tag: "{{ctaButton}}", label: "심사 바로가기 버튼" },
  ],
  assignment_assigned: [
    { tag: "{{applicationNumber}}", label: "신청번호" },
    { tag: "{{reasonLine}}", label: "배정 사유" },
    { tag: "{{ctaButton}}", label: "심사 바로가기 버튼" },
  ],
  assignment_unassigned: [
    { tag: "{{applicationNumber}}", label: "신청번호" },
    { tag: "{{ctaButton}}", label: "어드민 바로가기 버튼" },
  ],
  info_request_created: [
    { tag: "{{contactName}}", label: "담당자명" },
    { tag: "{{applicationNumber}}", label: "신청번호" },
    { tag: "{{requestContent}}", label: "요청 내용" },
    { tag: "{{dueDate}}", label: "회신 기한" },
    { tag: "{{ctaButton}}", label: "자료 제출 버튼" },
  ],
  portal_signup_request: [
    { tag: "{{contactName}}", label: "담당자명" },
    { tag: "{{companyName}}", label: "회사명" },
    { tag: "{{ctaButton}}", label: "가입 시작 버튼" },
  ],
  info_request_replied: [
    { tag: "{{applicationNumber}}", label: "신청번호" },
    { tag: "{{companyName}}", label: "회사명" },
    { tag: "{{ctaButton}}", label: "자료 검토 버튼" },
  ],
  review_result_approved: [
    { tag: "{{contactName}}", label: "담당자명" },
    { tag: "{{applicationNumber}}", label: "신청번호" },
    { tag: "{{companyName}}", label: "회사명" },
    { tag: "{{ctaButton}}", label: "포털 시작 버튼" },
  ],
  review_result_partial_approved: [
    { tag: "{{contactName}}", label: "담당자명" },
    { tag: "{{applicationNumber}}", label: "신청번호" },
    { tag: "{{ctaButton}}", label: "결과 확인 버튼" },
  ],
  review_result_on_hold: [
    { tag: "{{contactName}}", label: "담당자명" },
    { tag: "{{applicationNumber}}", label: "신청번호" },
    { tag: "{{ctaButton}}", label: "결과 확인 버튼" },
  ],
  review_result_rejected: [
    { tag: "{{contactName}}", label: "담당자명" },
    { tag: "{{applicationNumber}}", label: "신청번호" },
    { tag: "{{ctaButton}}", label: "결과 확인 버튼" },
  ],
  info_request_due_soon: [
    { tag: "{{contactName}}", label: "담당자명" },
    { tag: "{{applicationNumber}}", label: "신청번호" },
    { tag: "{{dueDate}}", label: "회신 기한" },
    { tag: "{{ctaButton}}", label: "자료 제출 버튼" },
  ],
  info_request_overdue: [
    { tag: "{{applicationNumber}}", label: "신청번호" },
    { tag: "{{dueDate}}", label: "초과된 기한" },
    { tag: "{{ctaButton}}", label: "신청서 확인 버튼" },
  ],
  invite_expiring_soon: [
    { tag: "{{inviteeName}}", label: "초대받은 사람" },
    { tag: "{{inviteeEmail}}", label: "초대 이메일" },
    { tag: "{{ctaButton}}", label: "사용자 관리 버튼" },
  ],
  inquiry_received_applicant: [
    { tag: "{{contactName}}", label: "신청자명" },
    { tag: "{{applicationNumber}}", label: "신청번호" },
    { tag: "{{brandName}}", label: "브랜드명" },
    { tag: "{{infoBox}}", label: "접수 정보 카드" },
    { tag: "{{ctaButton}}", label: "신청 바로가기 버튼" },
  ],
  inquiry_received_internal: [
    { tag: "{{inquiryNumber}}", label: "문의번호" },
    { tag: "{{companyName}}", label: "회사명" },
    { tag: "{{productCount}}", label: "제품 수" },
    { tag: "{{ctaButton}}", label: "문의 확인 버튼" },
  ],
  staff_invited: [
    { tag: "{{contactName}}", label: "직원명" },
    { tag: "{{email}}", label: "접속 이메일" },
    { tag: "{{tempPassword}}", label: "임시 비밀번호" },
    { tag: "{{ctaButton}}", label: "로그인 바로가기 버튼" },
  ],

  // === HUB ===
  hub_retailer_application_received: [
    { tag: "{{contactName}}", label: "Contact Name" },
    { tag: "{{companyName}}", label: "Company / Store" },
    { tag: "{{applicationNumber}}", label: "Application No." },
    { tag: "{{applicationStatus}}", label: "Status" },
    { tag: "{{nextStep}}", label: "Next Step" },
    { tag: "{{supportEmail}}", label: "Support Email" },
    { tag: "{{infoBox}}", label: "Info Box" },
  ],
  hub_application_under_review: [
    { tag: "{{contactName}}", label: "Contact Name" },
    { tag: "{{companyName}}", label: "Company / Store" },
    { tag: "{{applicationNumber}}", label: "Application No." },
    { tag: "{{applicationStatus}}", label: "Status" },
    { tag: "{{nextStep}}", label: "Next Step" },
    { tag: "{{infoBox}}", label: "Info Box" },
    { tag: "{{ctaButton}}", label: "View Status Button" },
  ],
  hub_info_request_created: [
    { tag: "{{contactName}}", label: "Contact Name" },
    { tag: "{{companyName}}", label: "Company / Store" },
    { tag: "{{applicationNumber}}", label: "Application No." },
    { tag: "{{requestContent}}", label: "Requested Details" },
    { tag: "{{dueDate}}", label: "Due Date" },
    { tag: "{{infoBox}}", label: "Info Box" },
    { tag: "{{ctaButton}}", label: "Submit Info Button" },
  ],
  hub_application_approved: [
    { tag: "{{contactName}}", label: "Contact Name" },
    { tag: "{{companyName}}", label: "Company / Store" },
    { tag: "{{applicationNumber}}", label: "Application No." },
    { tag: "{{applicationStatus}}", label: "Status" },
    { tag: "{{nextStep}}", label: "Next Step" },
    { tag: "{{infoBox}}", label: "Info Box" },
    { tag: "{{ctaButton}}", label: "Activate Portal Button" },
  ],
  hub_application_rejected: [
    { tag: "{{contactName}}", label: "Contact Name" },
    { tag: "{{companyName}}", label: "Company / Store" },
    { tag: "{{applicationNumber}}", label: "Application No." },
    { tag: "{{notes}}", label: "Review Notes" },
    { tag: "{{nextStep}}", label: "Re-apply Info" },
    { tag: "{{infoBox}}", label: "Info Box" },
  ],
  hub_retailer_partner_invited: [
    { tag: "{{contactName}}", label: "Owner Name" },
    { tag: "{{companyName}}", label: "Company / Store" },
    { tag: "{{role}}", label: "Role" },
    { tag: "{{expirationDate}}", label: "Expiration" },
    { tag: "{{infoBox}}", label: "Info Box" },
    { tag: "{{ctaButton}}", label: "Accept Invite Button" },
    { tag: "{{supportEmail}}", label: "Support Email" },
  ],
  hub_retailer_user_invited: [
    { tag: "{{contactName}}", label: "Team Member Name" },
    { tag: "{{companyName}}", label: "Company / Store" },
    { tag: "{{role}}", label: "Role" },
    { tag: "{{expirationDate}}", label: "Expiration" },
    { tag: "{{infoBox}}", label: "Info Box" },
    { tag: "{{ctaButton}}", label: "Accept Invite Button" },
    { tag: "{{supportEmail}}", label: "Support Email" },
  ],
  hub_retailer_account_activated: [
    { tag: "{{contactName}}", label: "Contact Name" },
    { tag: "{{companyName}}", label: "Company / Store" },
    { tag: "{{accountStatus}}", label: "Account Status" },
    { tag: "{{nextStep}}", label: "Next Step" },
    { tag: "{{infoBox}}", label: "Info Box" },
    { tag: "{{ctaButton}}", label: "Open Portal Button" },
  ],
  hub_welcome_retailer: [
    { tag: "{{contactName}}", label: "Contact Name" },
    { tag: "{{companyName}}", label: "Company / Store" },
    { tag: "{{accountStatus}}", label: "Account Status" },
    { tag: "{{nextStep}}", label: "Next Step" },
    { tag: "{{infoBox}}", label: "Info Box" },
    { tag: "{{ctaButton}}", label: "Getting Started Button" },
    { tag: "{{supportEmail}}", label: "Support Email" },
  ],
  hub_password_reset: [
    { tag: "{{contactName}}", label: "User Name" },
    { tag: "{{email}}", label: "User Email" },
    { tag: "{{infoBox}}", label: "Security Info Box" },
    { tag: "{{ctaButton}}", label: "Reset Password Button" },
  ],
  hub_order_confirmed: [
    { tag: "{{contactName}}", label: "Buyer Name" },
    { tag: "{{companyName}}", label: "Company / Store" },
    { tag: "{{orderNumber}}", label: "Order Number" },
    { tag: "{{orderDate}}", label: "Order Date" },
    { tag: "{{orderAmount}}", label: "Order Total" },
    { tag: "{{orderStatus}}", label: "Order Status" },
    { tag: "{{infoBox}}", label: "Order Info Box" },
    { tag: "{{ctaButton}}", label: "Track Order Button" },
  ],
  hub_shipment_created: [
    { tag: "{{contactName}}", label: "Buyer Name" },
    { tag: "{{companyName}}", label: "Company / Store" },
    { tag: "{{orderNumber}}", label: "Order Number" },
    { tag: "{{carrier}}", label: "Carrier" },
    { tag: "{{trackingNumber}}", label: "Tracking Number" },
    { tag: "{{shippedDate}}", label: "Shipped Date" },
    { tag: "{{shipmentStatus}}", label: "Shipment Status" },
    { tag: "{{infoBox}}", label: "Shipment Info Box" },
    { tag: "{{ctaButton}}", label: "Track Package Button" },
  ],
  hub_shipment_tracking_update: [
    { tag: "{{contactName}}", label: "Buyer Name" },
    { tag: "{{companyName}}", label: "Company / Store" },
    { tag: "{{orderNumber}}", label: "Order Number" },
    { tag: "{{carrier}}", label: "Carrier" },
    { tag: "{{trackingNumber}}", label: "Tracking Number" },
    { tag: "{{shipmentStatus}}", label: "Transit Status" },
    { tag: "{{dueDate}}", label: "Est. Delivery Date" },
    { tag: "{{infoBox}}", label: "Tracking Info Box" },
    { tag: "{{ctaButton}}", label: "View Tracking Button" },
  ],
  hub_order_delivered: [
    { tag: "{{contactName}}", label: "Buyer Name" },
    { tag: "{{companyName}}", label: "Company / Store" },
    { tag: "{{orderNumber}}", label: "Order Number" },
    { tag: "{{carrier}}", label: "Carrier" },
    { tag: "{{deliveredDate}}", label: "Delivered Date" },
    { tag: "{{orderStatus}}", label: "Status" },
    { tag: "{{infoBox}}", label: "Delivery Info Box" },
    { tag: "{{ctaButton}}", label: "View Order Details Button" },
  ],
};

// Global fallback sample variables for backward compatibility
export const SAMPLE_VARIABLES: Record<string, string> = {
  ...TEMPLATE_SAMPLE_VARIABLES.hub_retailer_application_received,
};

export function getSampleVariables(key: string): Record<string, string> {
  const typedKey = key as TemplateKey;
  return TEMPLATE_SAMPLE_VARIABLES[typedKey] ?? {
    contactName: "Sarah Jenkins",
    companyName: "Luxe Beauty Bar",
    applicationNumber: "APP-RET-104921",
    supportEmail: "support@kselecthub.com",
    portalUrl: "https://portal.kselecthub.com",
  };
}

function render(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name) => variables[name] ?? "");
}

/** 템플릿 키에 따른 영문/한글 배지 라벨 매핑 (NETWORK) */
function getNetworkBadgeLabel(key: string): string | undefined {
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

/** 템플릿 키에 따른 영문 배지 라벨 매핑 (HUB) */
function getHubBadgeLabel(key: string): string | undefined {
  switch (key) {
    case "hub_retailer_application_received":
      return "APPLICATION RECEIVED · RETAIL PARTNER";
    case "hub_application_under_review":
      return "UNDER REVIEW · STORE EVALUATION";
    case "hub_info_request_created":
      return "ACTION REQUIRED · ADDITIONAL DETAILS";
    case "hub_application_approved":
      return "APPROVED · PARTNERSHIP WELCOME";
    case "hub_application_rejected":
      return "APPLICATION STATUS · UPDATE";
    case "hub_retailer_partner_invited":
      return "INVITATION · RETAILER ONBOARDING";
    case "hub_retailer_user_invited":
      return "TEAM INVITE · STORE ACCESS";
    case "hub_retailer_account_activated":
      return "ACTIVATED · ACCOUNT READY";
    case "hub_welcome_retailer":
      return "WELCOME · GETTING STARTED";
    case "hub_password_reset":
      return "SECURITY · PASSWORD RESET";
    case "hub_order_confirmed":
      return "ORDER CONFIRMED · IN PREPARATION";
    case "hub_shipment_created":
      return "DISPATCHED · OUT FOR DELIVERY";
    case "hub_shipment_tracking_update":
      return "TRANSIT UPDATE · EN ROUTE";
    case "hub_order_delivered":
      return "DELIVERED · COMPLETED";
    default:
      return undefined;
  }
}

/** K SELECT NETWORK 이메일용 정보 카드 HTML */
function buildNetworkInfoCardHtml(variables: Record<string, string>) {
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

/**
 * K SELECT HUB 이메일용 정보 카드 HTML (Event-Specific & Clean Luxury Aesthetic)
 */
function buildHubInfoCardHtml(variables: Record<string, string>) {
  const key = variables.key || "";
  const rows: { label: string; value: string; isBold?: boolean; highlight?: boolean }[] = [];

  if (
    key === "hub_retailer_application_received" ||
    key === "hub_application_under_review" ||
    key === "hub_info_request_created" ||
    key === "hub_application_approved" ||
    key === "hub_application_rejected"
  ) {
    const appNo = variables.applicationNumber || variables.applicationNo;
    if (appNo) {
      rows.push({ label: "Application No.", value: appNo, isBold: true });
    }
    if (variables.companyName) {
      rows.push({ label: "Company", value: variables.companyName });
    }
    if (variables.applicationStatus) {
      rows.push({ label: "Status", value: variables.applicationStatus, isBold: true });
    }
    if (variables.dueDate && key === "hub_info_request_created") {
      rows.push({ label: "Due Date", value: variables.dueDate, highlight: true });
    }
    if (variables.nextStep) {
      rows.push({ label: "Next Step", value: variables.nextStep });
    }
  } else if (
    key === "hub_retailer_partner_invited" ||
    key === "hub_retailer_user_invited"
  ) {
    if (variables.companyName) {
      rows.push({ label: "Company", value: variables.companyName, isBold: true });
    }
    if (variables.contactName) {
      rows.push({ label: key === "hub_retailer_user_invited" ? "Invitee" : "Primary Contact", value: variables.contactName });
    }
    if (variables.role) {
      rows.push({ label: "Assigned Role", value: variables.role });
    }
    if (variables.expirationDate) {
      rows.push({ label: "Link Validity", value: variables.expirationDate });
    }
  } else if (
    key === "hub_retailer_account_activated" ||
    key === "hub_welcome_retailer"
  ) {
    if (variables.companyName) {
      rows.push({ label: "Store / Company", value: variables.companyName, isBold: true });
    }
    if (variables.accountStatus) {
      rows.push({ label: "Account Status", value: variables.accountStatus, isBold: true });
    }
    if (variables.nextStep) {
      rows.push({ label: "Next Step", value: variables.nextStep });
    }
  } else if (key === "hub_password_reset") {
    if (variables.email) {
      rows.push({ label: "Account Email", value: variables.email, isBold: true });
    }
    rows.push({ label: "Security Action", value: "Password Reset Request" });
    rows.push({ label: "Validity", value: "24 Hours" });
  } else if (key === "hub_order_confirmed") {
    if (variables.orderNumber) {
      rows.push({ label: "Order Number", value: variables.orderNumber, isBold: true });
    }
    if (variables.companyName) {
      rows.push({ label: "Store / Company", value: variables.companyName });
    }
    if (variables.orderDate) {
      rows.push({ label: "Order Date", value: variables.orderDate });
    }
    if (variables.orderAmount) {
      rows.push({ label: "Order Total", value: variables.orderAmount, highlight: true });
    }
    if (variables.orderStatus) {
      rows.push({ label: "Status", value: variables.orderStatus, isBold: true });
    }
  } else if (key === "hub_shipment_created") {
    if (variables.orderNumber) {
      rows.push({ label: "Order Number", value: variables.orderNumber, isBold: true });
    }
    if (variables.companyName) {
      rows.push({ label: "Store / Company", value: variables.companyName });
    }
    if (variables.carrier || variables.trackingNumber) {
      rows.push({
        label: "Tracking Info",
        value: [variables.carrier, variables.trackingNumber].filter(Boolean).join(" · "),
        isBold: true,
      });
    }
    if (variables.shippedDate) {
      rows.push({ label: "Shipped Date", value: variables.shippedDate });
    }
    if (variables.shipmentStatus) {
      rows.push({ label: "Status", value: variables.shipmentStatus });
    }
  } else if (key === "hub_shipment_tracking_update") {
    if (variables.orderNumber) {
      rows.push({ label: "Order Number", value: variables.orderNumber, isBold: true });
    }
    if (variables.carrier || variables.trackingNumber) {
      rows.push({
        label: "Tracking Info",
        value: [variables.carrier, variables.trackingNumber].filter(Boolean).join(" · "),
        isBold: true,
      });
    }
    if (variables.shipmentStatus) {
      rows.push({ label: "Transit Status", value: variables.shipmentStatus, isBold: true });
    }
    if (variables.dueDate) {
      rows.push({ label: "Est. Delivery", value: variables.dueDate, highlight: true });
    }
  } else if (key === "hub_order_delivered") {
    if (variables.orderNumber) {
      rows.push({ label: "Order Number", value: variables.orderNumber, isBold: true });
    }
    if (variables.companyName) {
      rows.push({ label: "Store / Company", value: variables.companyName });
    }
    if (variables.carrier) {
      rows.push({ label: "Carrier", value: variables.carrier });
    }
    if (variables.deliveredDate) {
      rows.push({ label: "Delivered Date", value: variables.deliveredDate, isBold: true });
    }
    if (variables.orderStatus) {
      rows.push({ label: "Status", value: variables.orderStatus, highlight: true });
    }
  } else {
    // Dynamic fallback for custom keys
    if (variables.applicationNumber) rows.push({ label: "Application No.", value: variables.applicationNumber, isBold: true });
    if (variables.orderNumber) rows.push({ label: "Order Number", value: variables.orderNumber, isBold: true });
    if (variables.companyName) rows.push({ label: "Company", value: variables.companyName });
  }

  if (rows.length === 0) return "";

  let rowsHtml = "";
  rows.forEach((row, idx) => {
    if (idx > 0) {
      rowsHtml += `
        <tr><td colspan="2" style="height:12px;line-height:12px;font-size:0;">&nbsp;</td></tr>
        <tr><td colspan="2" style="height:1px;line-height:1px;font-size:0;background:#E4E4E7;">&nbsp;</td></tr>
        <tr><td colspan="2" style="height:12px;line-height:12px;font-size:0;">&nbsp;</td></tr>
      `;
    }

    let valueStyle = "font-size:14px;line-height:22px;mso-line-height-rule:exactly;color:#27272A;text-align:left;";
    if (row.isBold) {
      valueStyle = "font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:0.3px;color:#09090B;text-align:left;";
    }
    if (row.highlight) {
      valueStyle = "font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;mso-line-height-rule:exactly;font-weight:700;color:#ff2b75;text-align:left;";
    }

    rowsHtml += `
      <tr>
        <td valign="top" width="130" style="width:130px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:22px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:1px;color:#71717A;text-transform:uppercase;text-align:left;">${row.label}</td>
        <td valign="top" style="${valueStyle}">${row.value}</td>
      </tr>
    `;
  });

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border:1px solid #E4E4E7;background-color:#FAFAFA;border-radius:8px;border-collapse:separate;margin:24px 0 0 0;">
      <tr>
        <td style="padding:18px 22px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
            ${rowsHtml}
          </table>
        </td>
      </tr>
    </table>
  `;
}

/** K SELECT NETWORK 이메일용 CTA 버튼 HTML */
function buildNetworkCtaButtonHtml(variables: Record<string, string>) {
  const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL || "https://www.kselectnetwork.com";
  let url = variables.portalUrl || variables.applicationUrl || `${siteUrl}/portal`;
  let buttonLabel = variables.buttonLabel || "포털에서 확인하기";

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

/** K SELECT HUB 이메일용 CTA 버튼 HTML */
function buildHubCtaButtonHtml(variables: Record<string, string>) {
  const hubPortalUrl = "https://portal.kselecthub.com";
  let url = variables.invitationLink || variables.link || variables.portalUrl || hubPortalUrl;
  let buttonLabel = variables.buttonLabel || "Access Retailer Portal →";

  const key = variables.key;
  if (key === "hub_retailer_partner_invited") {
    buttonLabel = "Activate Retailer Account →";
  } else if (key === "hub_retailer_user_invited") {
    buttonLabel = "Accept Team Invitation →";
  } else if (key === "hub_application_approved") {
    buttonLabel = "Access Retailer Portal →";
  } else if (key === "hub_info_request_created") {
    buttonLabel = "Submit Requested Info →";
  } else if (key === "hub_password_reset") {
    buttonLabel = "Reset Password →";
  } else if (
    key === "hub_order_confirmed" ||
    key === "hub_shipment_created" ||
    key === "hub_shipment_tracking_update" ||
    key === "hub_order_delivered"
  ) {
    buttonLabel = "View Order & Tracking Details →";
  } else if (key === "hub_welcome_retailer" || key === "hub_retailer_account_activated") {
    buttonLabel = "Open Retailer Portal →";
  }

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 0 auto;min-width:240px;">
      <tr>
        <td bgcolor="#09090B" align="center" style="padding: 14px 32px; background-color: #09090B; border-radius: 8px;">
          <a href="${url}" target="_blank" style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:16px;mso-line-height-rule:exactly;font-weight:bold;letter-spacing:0.4px;color:#FFFFFF;text-decoration:none;text-align:center;">${buttonLabel}</a>
        </td>
      </tr>
      <tr><td style="height:3px;line-height:3px;font-size:0;background:#ff2b75;border-radius:0 0 4px 4px;">&nbsp;</td></tr>
    </table>
  `;
}

/** 본문 텍스트 포맷팅 및 키워드 강조 처리 (NETWORK) */
function formatNetworkBodyText(text: string) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

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

/** 본문 텍스트 포맷팅 및 키워드 강조 처리 (HUB) */
function formatHubBodyText(text: string) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  html = html.replace(
    /K SELECT HUB/g,
    `<strong style="color: #09090B;">K SELECT HUB</strong>`
  );
  html = html.replace(
    /90-Day Initial Trial Protection/g,
    `<span style="color: #ff2b75; font-weight: bold;">90-Day Initial Trial Protection</span>`
  );

  return html;
}

/** NETWORK 글로벌 이메일 HTML 레이아웃 빌드 */
function buildNetworkGlobalLayout(
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

/** HUB 글로벌 이메일 HTML 레이아웃 빌드 (Modern Luxury Retailer Layout) */
function buildHubGlobalLayout(
  subject: string,
  preheader: string,
  badgeHtml: string,
  headerHtml: string,
  bodyContentHtml: string,
  supportHtml: string,
  footerHtml: string
) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${subject} · K SELECT HUB</title>
<style>
  body { margin:0; padding:0; background:#F4F4F5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  @media only screen and (max-width:620px) {
    table[width="600"] { width:100% !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#F4F4F5;">
<span style="display:none;font-size:1px;color:#F4F4F5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:#F4F4F5;margin:0;padding:36px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center" style="padding:0 16px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid #E4E4E7;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.03);">

        <!-- Top Pink Accent Bar -->
        <tr><td style="height:4px;line-height:4px;font-size:0;background:#ff2b75;">&nbsp;</td></tr>

        <!-- Header Area -->
        ${headerHtml}

        <tr><td style="padding:0 36px;"><div style="height:1px;line-height:1px;font-size:0;background:#F4F4F5;">&nbsp;</div></td></tr>

        <!-- Inner Content Area -->
        <tr>
          <td style="padding:32px 36px 0 36px;">
            ${badgeHtml}
            ${bodyContentHtml}
          </td>
        </tr>

        <tr><td style="padding:28px 36px 0 36px;"><div style="height:1px;line-height:1px;font-size:0;background:#F4F4F5;">&nbsp;</div></td></tr>

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
  const isHub = Boolean(
    (variables.key && variables.key.startsWith("hub_")) ||
    variables.scope === "hub" ||
    subjectTemplate.includes("K SELECT HUB")
  );

  if (isHub) {
    return renderHubEmailHtml(subjectTemplate, bodyTemplate, variables);
  }
  return renderNetworkEmailHtml(subjectTemplate, bodyTemplate, variables);
}

/** NETWORK 이메일 렌더러 */
function renderNetworkEmailHtml(
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

  const appNo = extendedVariables.applicationNo || extendedVariables.applicationNumber || extendedVariables.inquiryNumber || "APP-000001";
  extendedVariables.applicationNo = appNo;
  extendedVariables.infoBox = buildNetworkInfoCardHtml(extendedVariables);
  extendedVariables.ctaButton = buildNetworkCtaButtonHtml(extendedVariables);

  const finalSubject = render(subjectTemplate, extendedVariables);

  const bodyLines = bodyTemplate.split("\n");
  const rawTitle = bodyLines[0] || "";
  const rawBodyLines = bodyLines.slice(1).join("\n").trim();

  const finalTitle = render(rawTitle, extendedVariables);
  const formattedTemplate = formatNetworkBodyText(rawBodyLines);
  const finalBodyContent = render(formattedTemplate, extendedVariables);

  const preheaderText = `신청번호 ${appNo}의 파트너십 알림입니다.`;
  const badgeLabel = getNetworkBadgeLabel(variables.key || "");
  
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

  const bodyContentHtml = `
    <div style="font-size:27px;line-height:38px;mso-line-height-rule:exactly;font-weight:700;color:#131E2E;letter-spacing:-0.5px;text-wrap:pretty;text-align:left;">${finalTitle}</div>
    <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
    <div style="font-size:15px;line-height:27px;mso-line-height-rule:exactly;color:#5A6270;text-align:left;">${finalBodyContent}</div>
  `;

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

  const finalHtml = buildNetworkGlobalLayout(
    finalSubject,
    preheaderText,
    badgeHtml,
    headerHtml,
    bodyContentHtml,
    supportHtml,
    footerHtml
  );

  const rawBodyText = render(bodyTemplate, extendedVariables);

  return {
    subject: finalSubject,
    text: rawBodyText.replace(/<[^>]*>/g, ""),
    html: finalHtml,
  };
}

/** HUB 이메일 렌더러 */
function renderHubEmailHtml(
  subjectTemplate: string,
  bodyTemplate: string,
  variables: Record<string, string>
) {
  const hubSiteUrl = "https://www.kselecthub.com";
  const hubPortalUrl = "https://portal.kselecthub.com";
  const contactName = variables.contactName || "Retail Partner";

  const extendedVariables: Record<string, string> = {
    ...variables,
    contactName,
    submittedDate: variables.submittedDate || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    applicationUrl: hubPortalUrl,
    portalUrl: variables.portalUrl || hubPortalUrl,
    websiteUrl: hubSiteUrl,
    supportEmail: variables.supportEmail || "support@kselecthub.com",
    privacyUrl: `${hubSiteUrl}/privacy`,
    unsubscribeUrl: `${hubSiteUrl}/unsubscribe`,
  };

  const appNo = extendedVariables.applicationNo || extendedVariables.applicationNumber || extendedVariables.inquiryNumber || "APP-RET-104921";
  extendedVariables.applicationNo = appNo;
  extendedVariables.infoBox = buildHubInfoCardHtml(extendedVariables);
  extendedVariables.ctaButton = buildHubCtaButtonHtml(extendedVariables);

  const finalSubject = render(subjectTemplate, extendedVariables);

  const bodyLines = bodyTemplate.split("\n");
  const rawTitle = bodyLines[0] || "";
  const rawBodyLines = bodyLines.slice(1).join("\n").trim();

  const finalTitle = render(rawTitle, extendedVariables);
  const formattedTemplate = formatHubBodyText(rawBodyLines);
  const finalBodyContent = render(formattedTemplate, extendedVariables);

  const preheaderText = `K SELECT HUB notification for ${extendedVariables.companyName || "Retail Partner"}`;
  const badgeLabel = getHubBadgeLabel(variables.key || "");

  let badgeHtml = "";
  if (badgeLabel) {
    badgeHtml = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:12px;mso-line-height-rule:exactly;font-weight:bold;color:#ff2b75;padding-right:6px;">●</td>
          <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:13px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:1.8px;color:#18181B;text-transform:uppercase;">${badgeLabel}</td>
        </tr>
      </table>
      <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
    `;
  }

  const headerHtml = `
    <tr>
      <td style="padding:28px 36px 20px 36px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td valign="middle">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:24px;mso-line-height-rule:exactly;font-weight:900;letter-spacing:-0.3px;color:#09090B;">K SELECT <span style="color:#ff2b75;">HUB</span></span>
            </td>
            <td valign="middle" align="right">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:12px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:1.6px;color:#71717A;text-transform:uppercase;">RETAIL PARTNER PLATFORM</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  const bodyContentHtml = `
    <div style="font-size:24px;line-height:34px;mso-line-height-rule:exactly;font-weight:800;color:#09090B;letter-spacing:-0.4px;text-wrap:pretty;text-align:left;">${finalTitle}</div>
    <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
    <div style="font-size:14px;line-height:25px;mso-line-height-rule:exactly;color:#3F3F46;text-align:left;">${finalBodyContent}</div>
  `;

  const supportHtml = `
    <tr>
      <td style="padding:20px 36px 28px 36px; background-color:#FAFAFA;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
          <tr>
            <td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:18px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:1.6px;color:#71717A;width:90px;text-align:left;">SUPPORT</td>
            <td valign="top" style="font-size:12px;line-height:20px;mso-line-height-rule:exactly;color:#52525B;text-align:left;">
              Email: <a href="mailto:${extendedVariables.supportEmail}" style="color:#09090B;text-decoration:none;font-weight:700;">${extendedVariables.supportEmail}</a> &nbsp;|&nbsp; Portal: <a href="${hubPortalUrl}" target="_blank" style="color:#09090B;text-decoration:none;font-weight:700;">portal.kselecthub.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  const privacyUrl = extendedVariables.privacyUrl;
  const unsubscribeUrl = extendedVariables.unsubscribeUrl;
  const footerHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:22px 20px 8px 20px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;line-height:12px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:1.8px;color:#71717A;text-transform:uppercase;">CURATED BEAUTY. EFFORTLESS RETAIL.</div>
          <div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>
          <div style="font-size:11px;line-height:18px;mso-line-height-rule:exactly;color:#A1A1AA;text-align:center;">
            K SELECT HUB · Retail Partner Platform<br/>23B, Roland Avenue, Mount Laurel, New Jersey 08054
          </div>
          <div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>
          <div style="font-size:11px;line-height:18px;mso-line-height-rule:exactly;text-align:center;">
            <a href="${privacyUrl}" target="_blank" style="color:#71717A;text-decoration:underline;">Privacy Policy</a> &nbsp;·&nbsp; <a href="${unsubscribeUrl}" target="_blank" style="color:#71717A;text-decoration:underline;">Unsubscribe</a>
          </div>
        </td>
      </tr>
    </table>
  `;

  const finalHtml = buildHubGlobalLayout(
    finalSubject,
    preheaderText,
    badgeHtml,
    headerHtml,
    bodyContentHtml,
    supportHtml,
    footerHtml
  );

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

  const fallback = DEFAULT_TEMPLATES[key];
  const subjectTemplate = template?.subject_template ?? fallback?.subject ?? "";
  let bodyTemplate = template?.body_template ?? fallback?.body ?? "";

  if (key === "info_request_created" && !variables.dueDate) {
    bodyTemplate = bodyTemplate
      .replace("회신 기한인 {{dueDate}}까지 ", "")
      .replace("회신 기한인 까지 ", "")
      .replace("회신 기한인  까지 ", "");
  }

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
