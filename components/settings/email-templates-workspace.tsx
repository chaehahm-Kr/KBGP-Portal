"use client";

import React, { useState, useEffect, useTransition } from "react";
import { type TemplateFormState } from "@/lib/notifications/template-actions";

type EmailTemplateData = {
  key: string;
  description: string;
  subject: string;
  body: string;
};

type EmailTemplatesWorkspaceProps = {
  initialTemplates: EmailTemplateData[];
  updateAction: (key: string, prevState: TemplateFormState, formData: FormData) => Promise<TemplateFormState>;
  testAction: (key: string, prevState: TemplateFormState, formData: FormData) => Promise<TemplateFormState>;
  previewAction: (key: string, subject: string, body: string) => Promise<{ success: boolean; html: string; error?: string }>;
};

type TemplateMetadata = {
  recipientType: "partner" | "internal";
  recipientLabel: string;
  triggerType: "auto" | "manual" | "cron";
  triggerLabel: string;
  triggerCondition: string;
  scope: "network" | "hub";
};

const TEMPLATE_METADATA: Record<string, TemplateMetadata> = {
  // === K SELECT NETWORK ===
  application_submitted_company: {
    recipientType: "partner",
    recipientLabel: "브랜드사 담당자 (Brand)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "신청자가 포털에서 입점 신청서를 최종 제출 완료했을 때, 신청서 접수를 증명하기 위해 신청자 이메일로 자동 전송됩니다.",
    scope: "network",
  },
  application_received_internal: {
    recipientType: "internal",
    recipientLabel: "내부 담당자 (Internal)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "신규 입점 신청서가 접수되었을 때 어드민 내부 전직원에게 빠른 심사 유도를 위해 알림용으로 발송됩니다.",
    scope: "network",
  },
  assignment_assigned: {
    recipientType: "internal",
    recipientLabel: "내부 담당자 (Internal)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "어드민이 특정 신청서에 담당 심사원을 신규로 배정(Assign)했을 때, 배정 사실을 배정된 담당자에게 통보합니다.",
    scope: "network",
  },
  assignment_unassigned: {
    recipientType: "internal",
    recipientLabel: "내부 담당자 (Internal)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "어드민이 신청서에 지정되어 있던 담당 심사원 배정을 취소/해제했을 때 해당 직원에게 발송됩니다.",
    scope: "network",
  },
  info_request_created: {
    recipientType: "partner",
    recipientLabel: "브랜드사 담당자 (Brand)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "심사원이 신청서 검토 중 '추가 자료 요청'을 작성하여 파트너사 조치를 요구할 때 회사 담당자에게 발송됩니다.",
    scope: "network",
  },
  info_request_replied: {
    recipientType: "internal",
    recipientLabel: "내부 담당자 (Internal)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "회사 담당자가 추가 자료 요청에 대해 회신 자료를 업로드 및 최종 제출했을 때 배정된 심사원에게 발송됩니다.",
    scope: "network",
  },
  review_result_approved: {
    recipientType: "partner",
    recipientLabel: "브랜드사 담당자 (Brand)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "심사 완료 후 최종 '승인' 처리를 내렸을 때 회사 담당자에게 파트너십 승인 사실 및 향후 일정 조율을 위해 발송됩니다.",
    scope: "network",
  },
  review_result_partial_approved: {
    recipientType: "partner",
    recipientLabel: "브랜드사 담당자 (Brand)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "신청서 내 특정 제품군에 대해서만 일부 승인하는 '부분 승인' 처리를 내렸을 때 회사 담당자에게 안내를 위해 발송됩니다.",
    scope: "network",
  },
  review_result_on_hold: {
    recipientType: "partner",
    recipientLabel: "브랜드사 담당자 (Brand)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "신청서에 대해 보완이나 협의를 위해 '보류' 처리를 내렸을 때 회사 담당자에게 상세한 보류 사유와 함께 발송됩니다.",
    scope: "network",
  },
  review_result_rejected: {
    recipientType: "partner",
    recipientLabel: "브랜드사 담당자 (Brand)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "심사 결과 최종 '반려' 처리를 확정지었을 때 회사 담당자에게 반려 사유 고지와 감사 안내를 위해 정중히 발송됩니다.",
    scope: "network",
  },
  info_request_due_soon: {
    recipientType: "partner",
    recipientLabel: "브랜드사 담당자 (Brand)",
    triggerType: "cron",
    triggerLabel: "자동 크론 (Cron Job)",
    triggerCondition: "추가 자료 요청의 회신 기한 만료가 24시간 미만으로 남았을 때 미제출 파트너사에게 독촉 메일이 자동 발송됩니다.",
    scope: "network",
  },
  info_request_overdue: {
    recipientType: "internal",
    recipientLabel: "내부 담당자 (Internal)",
    triggerType: "cron",
    triggerLabel: "자동 크론 (Cron Job)",
    triggerCondition: "추가 자료 회신 기한을 최종 초과했을 때 담당 심사원에게 직접 유선 확인 등을 가이드하기 위해 자동 발송됩니다.",
    scope: "network",
  },
  invite_expiring_soon: {
    recipientType: "internal",
    recipientLabel: "내부 담당자 (Internal)",
    triggerType: "cron",
    triggerLabel: "자동 크론 (Cron Job)",
    triggerCondition: "회사 관리자 초대 메일의 유효 기간(48시간) 만료 24시간 전에, 초대를 보냈던 어드민 본인에게 알림용으로 발송됩니다.",
    scope: "network",
  },
  inquiry_received_applicant: {
    recipientType: "partner",
    recipientLabel: "신청자 (Applicant)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "마케팅 소개 웹사이트에서 파트너 가입 의향 문의가 새로 들어왔을 때, 제출자에게 접수 증명용으로 자동 전송됩니다.",
    scope: "network",
  },
  inquiry_received_internal: {
    recipientType: "internal",
    recipientLabel: "내부 담당자 (Internal)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "마케팅 소개 웹사이트에서 신규 가입 문의가 접수되었을 때 어드민 내부 전원에게 실시간 모니터링 알림으로 발송됩니다.",
    scope: "network",
  },
  portal_signup_request: {
    recipientType: "partner",
    recipientLabel: "브랜드사 담당자 (Brand)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "어드민이 입점 신청서 또는 회사 상세 페이지에서 브랜드사에 포털 회원가입 및 최초 비밀번호 설정을 요청할 때 발송됩니다.",
    scope: "network",
  },
  staff_invited: {
    recipientType: "internal",
    recipientLabel: "내부 담당자 (Internal)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "어드민이 내부 직원 관리 화면에서 신규 직원을 관리자 포털로 초대할 때(임시 비밀번호 포함) 발송됩니다.",
    scope: "network",
  },

  // === K SELECT HUB ===
  hub_retailer_application_received: {
    recipientType: "partner",
    recipientLabel: "리테일러 신청자 (Retailer)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "마케팅 사이트(www.kselecthub.com)에서 리테일러 입점 신청서를 제출했을 때 신청자에게 즉시 자동 발송됩니다.",
    scope: "hub",
  },
  hub_application_under_review: {
    recipientType: "partner",
    recipientLabel: "리테일러 신청자 (Retailer)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "어드민이 리테일러 신청서 심사를 착수하여 검토 중 상태로 변경했을 때 신청자에게 발송됩니다.",
    scope: "hub",
  },
  hub_info_request_created: {
    recipientType: "partner",
    recipientLabel: "리테일러 신청자 (Retailer)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "어드민이 매장 프로필, 사업자 등록증 또는 매장 사진 등 추가 자료를 요청할 때 발송됩니다.",
    scope: "hub",
  },
  hub_application_approved: {
    recipientType: "partner",
    recipientLabel: "리테일러 신청자 (Retailer)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "어드민이 리테일러 파트너십을 최종 승인했을 때 환영 안내 메일로 발송됩니다.",
    scope: "hub",
  },
  hub_application_rejected: {
    recipientType: "partner",
    recipientLabel: "리테일러 신청자 (Retailer)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "신청 지역 포화 또는 조건 미충족 등으로 리테일러 신청이 반려되었을 때 안내 메일로 발송됩니다.",
    scope: "hub",
  },
  hub_retailer_partner_invited: {
    recipientType: "partner",
    recipientLabel: "리테일러 오너 (Retailer Owner)",
    triggerType: "manual",
    triggerLabel: "초대 액션 (Invitation)",
    triggerCondition: "어드민이 리테일러 계정을 생성하고 7일 단일 인증 링크를 통해 온보딩 초대를 보낼 때 발송됩니다.",
    scope: "hub",
  },
  hub_retailer_user_invited: {
    recipientType: "partner",
    recipientLabel: "매장 팀원 (Store Team)",
    triggerType: "manual",
    triggerLabel: "초대 액션 (Invitation)",
    triggerCondition: "리테일러 관리자 또는 어드민이 매장 직원/바이어를 추가 초대할 때 발송됩니다.",
    scope: "hub",
  },
  hub_retailer_account_activated: {
    recipientType: "partner",
    recipientLabel: "리테일러 파트너 (Retailer)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "리테일러가 초대 링크를 통해 약관 동의 및 비밀번호 설정을 완료하여 계정을 활성화했을 때 발송됩니다.",
    scope: "hub",
  },
  hub_welcome_retailer: {
    recipientType: "partner",
    recipientLabel: "리테일러 파트너 (Retailer)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "계정 활성화 직후 매장 진열, 오더 방법 및 리테일러 런칭 가이드를 안내하기 위해 발송됩니다.",
    scope: "hub",
  },
  hub_password_reset: {
    recipientType: "partner",
    recipientLabel: "리테일러 사용자 (Retailer User)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "리테일러 포털 로그인 화면에서 비밀번호 재설정을 요청했을 때 보안 링크와 함께 발송됩니다.",
    scope: "hub",
  },
  hub_order_confirmed: {
    recipientType: "partner",
    recipientLabel: "리테일러 파트너 (Retailer)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "리테일러 포털에서 발주/주문이 성공적으로 접수 및 승인되었을 때 발송됩니다.",
    scope: "hub",
  },
  hub_shipment_created: {
    recipientType: "partner",
    recipientLabel: "리테일러 파트너 (Retailer)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "미국 물류 센터에서 주문 상품이 출고 패킹되어 운송장(Tracking)이 등록되었을 때 발송됩니다.",
    scope: "hub",
  },
  hub_shipment_tracking_update: {
    recipientType: "partner",
    recipientLabel: "리테일러 파트너 (Retailer)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "배송 중 경유지 또는 예상 배송일 변경 등의 실시간 운송 상태 업데이트 발생 시 발송됩니다.",
    scope: "hub",
  },
  hub_order_delivered: {
    recipientType: "partner",
    recipientLabel: "리테일러 파트너 (Retailer)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "운송사 배송 완료 확인 시 매장 입고 검수 및 영수증 확인을 위해 발송됩니다.",
    scope: "hub",
  },
};

const SCOPE_CATEGORIES: Record<
  "network" | "hub",
  Array<{ id: string; name: string; keys: string[] }>
> = {
  network: [
    {
      id: "net_application",
      name: "🏢 신청서 처리 (Application)",
      keys: ["application_submitted_company", "application_received_internal"],
    },
    {
      id: "net_assignment",
      name: "👤 심사원 배정 (Assignment)",
      keys: ["assignment_assigned", "assignment_unassigned"],
    },
    {
      id: "net_info_request",
      name: "📝 추가 자료 요청 (Info Request)",
      keys: ["info_request_created", "info_request_replied", "info_request_due_soon", "info_request_overdue"],
    },
    {
      id: "net_review",
      name: "⚖️ 심사 결과 통보 (Review)",
      keys: ["review_result_approved", "review_result_partial_approved", "review_result_on_hold", "review_result_rejected"],
    },
    {
      id: "net_inquiry",
      name: "📩 문의 및 초대 (Inquiry & Invites)",
      keys: [
        "inquiry_received_applicant",
        "inquiry_received_internal",
        "invite_expiring_soon",
        "portal_signup_request",
        "staff_invited",
      ],
    },
  ],
  hub: [
    {
      id: "hub_application",
      name: "📋 리테일러 입점 신청 (Application)",
      keys: [
        "hub_retailer_application_received",
        "hub_application_under_review",
        "hub_info_request_created",
        "hub_application_approved",
        "hub_application_rejected",
      ],
    },
    {
      id: "hub_account",
      name: "🔑 초대 및 계정 활성화 (Invitation & Account)",
      keys: [
        "hub_retailer_partner_invited",
        "hub_retailer_user_invited",
        "hub_retailer_account_activated",
        "hub_welcome_retailer",
        "hub_password_reset",
      ],
    },
    {
      id: "hub_orders",
      name: "📦 주문 및 배송 관리 (Orders & Fulfillment)",
      keys: [
        "hub_order_confirmed",
        "hub_shipment_created",
        "hub_shipment_tracking_update",
        "hub_order_delivered",
      ],
    },
  ],
};

const TEMPLATE_VARIABLE_CHIPS: Record<string, Array<{ tag: string; label: string }>> = {
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

export function EmailTemplatesWorkspace({
  initialTemplates,
  updateAction,
  testAction,
  previewAction,
}: EmailTemplatesWorkspaceProps) {
  const [selectedScope, setSelectedScope] = useState<"network" | "hub">("network");
  const [templates, setTemplates] = useState<EmailTemplateData[]>(initialTemplates);
  const [selectedKey, setSelectedKey] = useState<string>(initialTemplates[0]?.key || "");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    net_application: true,
    net_assignment: true,
    net_info_request: true,
    net_review: true,
    net_inquiry: true,
    hub_application: true,
    hub_account: true,
    hub_orders: true,
  });

  // Panel sizing resizable states
  const [leftWidth, setLeftWidth] = useState(330);
  const [rightWidth, setRightWidth] = useState(520);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  // Selected item local states
  const activeTemplate = templates.find((t) => t.key === selectedKey) || initialTemplates[0];
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");

  const [isSaving, startSave] = useTransition();
  const [isSendingTest, startSendTest] = useTransition();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Switch template automatically when scope changes if active template not in scope
  useEffect(() => {
    const scopeKeys = SCOPE_CATEGORIES[selectedScope].flatMap((c) => c.keys);
    if (!scopeKeys.includes(selectedKey)) {
      const firstInScope = scopeKeys[0];
      if (firstInScope) {
        setSelectedKey(firstInScope);
      }
    }
  }, [selectedScope]);

  // Tracking mouse resize movements
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = Math.max(240, Math.min(600, e.clientX - 16));
        setLeftWidth(newWidth);
      }
      if (isResizingRight) {
        const newWidth = Math.max(360, Math.min(850, window.innerWidth - e.clientX - 16));
        setRightWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingLeft, isResizingRight]);

  // Sync state when template key changes
  useEffect(() => {
    if (activeTemplate) {
      setSubject(activeTemplate.subject);
      setBody(activeTemplate.body);
      setErrorMsg("");
      setSuccessMsg("");
    }
  }, [selectedKey]);

  // Load preview HTML
  const loadPreview = async (sub: string, bd: string) => {
    setPreviewLoading(true);
    try {
      const res = await previewAction(selectedKey, sub, bd);
      if (res.success) {
        setPreviewHtml(res.html);
      } else {
        setPreviewHtml(`<div style="padding: 20px; color: red;">미리보기 생성 실패: ${res.error || "알 수 없는 에러"}</div>`);
      }
    } catch {
      setPreviewHtml('<div style="padding: 20px; color: red;">미리보기 요청 중 에러가 발생했습니다.</div>');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Trigger preview on initial load or content change (debounce slightly)
  useEffect(() => {
    if (!selectedKey) return;
    const timer = setTimeout(() => {
      loadPreview(subject, body);
    }, 400);
    return () => clearTimeout(timer);
  }, [selectedKey, subject, body]);

  const toggleCategory = (catId: string) => {
    setOpenCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleInsertVariable = (tag: string) => {
    setBody((prev) => prev + (prev.endsWith("\n") || prev.length === 0 ? "" : " ") + tag);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!subject.trim()) { setErrorMsg("제목을 입력해주세요."); return; }
    if (!body.trim()) { setErrorMsg("본문을 입력해주세요."); return; }

    startSave(async () => {
      const fd = new FormData();
      fd.append("subject", subject);
      fd.append("body", body);

      const res = await updateAction(selectedKey, undefined, fd);
      if (res && "error" in res) {
        setErrorMsg(res.error);
      } else if (res && "success" in res) {
        setSuccessMsg(res.success);
        setTemplates((prev) =>
          prev.map((t) => (t.key === selectedKey ? { ...t, subject, body } : t))
        );
      }
    });
  };

  const handleTestSend = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    startSendTest(async () => {
      const fd = new FormData();
      fd.append("subject", subject);
      fd.append("body", body);

      const res = await testAction(selectedKey, undefined, fd);
      if (res && "error" in res) {
        setErrorMsg(res.error);
      } else if (res && "success" in res) {
        setSuccessMsg(res.success);
      }
    });
  };

  const meta = TEMPLATE_METADATA[selectedKey];
  const categories = SCOPE_CATEGORIES[selectedScope];
  const availableVariableChips = TEMPLATE_VARIABLE_CHIPS[selectedKey] || [
    { tag: "{{contactName}}", label: "담당자명" },
    { tag: "{{companyName}}", label: "회사명" },
    { tag: "{{infoBox}}", label: "정보 카드" },
    { tag: "{{ctaButton}}", label: "바로가기 버튼" },
  ];

  return (
    <div className="flex h-[calc(100vh-11rem)] gap-0.5 overflow-hidden text-xs select-none">
      {/* 1. Left panel: Scope Tabs & Template List */}
      <div
        style={{ width: `${leftWidth}px` }}
        className="shrink-0 rounded-l-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 flex flex-col overflow-hidden"
      >
        {/* Scope Selector Tabs */}
        <div className="p-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/40 shrink-0">
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-zinc-200/70 dark:bg-zinc-800 rounded-lg">
            <button
              type="button"
              onClick={() => setSelectedScope("network")}
              className={`py-1.5 px-2 text-[11px] font-extrabold rounded-md transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedScope === "network"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-[#131E2E] dark:bg-sky-400 inline-block" />
              <span>K SELECT NETWORK</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedScope("hub")}
              className={`py-1.5 px-2 text-[11px] font-extrabold rounded-md transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedScope === "hub"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-[#ff2b75] inline-block" />
              <span>K SELECT HUB</span>
            </button>
          </div>
          <div className="mt-2 px-1 flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
            <span>{selectedScope === "network" ? "🏢 브랜드사 / 공급사 발송 템플릿" : "🛍️ 리테일러 바이어 / 매장 발송 템플릿"}</span>
            <span className="font-mono text-[9px] bg-zinc-200/50 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
              {categories.flatMap(c => c.keys).length}개 템플릿
            </span>
          </div>
        </div>

        {/* Template List Hierarchy */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-3 select-text">
          {categories.map((category) => {
            const categoryTemplates = templates.filter((t) => category.keys.includes(t.key));
            if (categoryTemplates.length === 0) return null;

            const isOpen = openCategories[category.id] ?? true;

            return (
              <div key={category.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 font-extrabold text-zinc-700 dark:text-zinc-300 text-left transition-colors cursor-pointer select-none"
                >
                  <span className="text-[11px]">{category.name}</span>
                  <span className="text-[9px] text-zinc-400">{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div className="pl-2 space-y-0.5 border-l border-zinc-100 dark:border-zinc-800/80 ml-2">
                    {categoryTemplates.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setSelectedKey(item.key)}
                        className={`w-full text-left px-2.5 py-2 rounded text-[11px] leading-tight font-medium transition-all cursor-pointer ${
                          selectedKey === item.key
                            ? selectedScope === "hub"
                              ? "bg-[#09090B] text-white dark:bg-white dark:text-[#09090B] font-bold shadow-sm border-l-2 border-[#ff2b75]"
                              : "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-sm"
                            : "text-zinc-700 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                        }`}
                      >
                        {item.description}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Resize Splitter 1 */}
      <div
        onMouseDown={() => setIsResizingLeft(true)}
        className={`w-2 shrink-0 self-stretch hover:bg-zinc-300 dark:hover:bg-zinc-700 active:bg-zinc-400 dark:active:bg-zinc-500 transition-colors cursor-col-resize flex items-center justify-center select-none ${
          isResizingLeft ? "bg-zinc-400 dark:bg-zinc-500" : "bg-transparent"
        }`}
      >
        <div className="h-6 w-0.5 bg-zinc-300 dark:bg-zinc-700 rounded" />
      </div>

      {/* 2. Center panel: Compact Edit form */}
      <div className="flex-1 min-w-[340px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 flex flex-col overflow-hidden">
        <div className="p-3.5 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/20 shrink-0">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                selectedScope === "hub" ? "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
              }`}>
                {selectedScope === "hub" ? "HUB RETAILER" : "NETWORK BRAND"}
              </span>
              <span className="font-mono text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{selectedKey}</span>
            </div>
            <h3 className="font-extrabold text-zinc-900 dark:text-white text-sm">{activeTemplate?.description}</h3>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex-1 p-4 flex flex-col gap-3 min-h-0 overflow-y-auto select-text">
          {/* Metadata Display Cards */}
          {meta && (
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/40 p-3 dark:border-zinc-800/80 dark:bg-zinc-950/20 space-y-2 shrink-0 select-none">
              <div className="flex flex-wrap gap-2 items-center">
                {/* Recipient Target Badge */}
                <span
                  className={`inline-flex items-center rounded px-2.5 py-0.5 text-[9px] font-extrabold tracking-wide uppercase ${
                    meta.recipientType === "partner"
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/40"
                      : "bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/40"
                  }`}
                >
                  📬 {meta.recipientLabel}
                </span>

                {/* Trigger Method Badge */}
                <span
                  className={`inline-flex items-center rounded px-2.5 py-0.5 text-[9px] font-extrabold tracking-wide uppercase ${
                    meta.triggerType === "auto"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40"
                      : meta.triggerType === "manual"
                      ? "bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40"
                      : "bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40"
                  }`}
                >
                  ⚡ {meta.triggerLabel}
                </span>
              </div>

              {/* Specific Send Trigger Explanation */}
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal font-medium bg-white dark:bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 flex items-start gap-2">
                <span className="text-sm shrink-0">ℹ️</span>
                <span className="self-center select-text">{meta.triggerCondition}</span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400 shrink-0">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/15 dark:text-emerald-400 shrink-0">
              {successMsg}
            </div>
          )}

          {/* Subject Field */}
          <div className="space-y-1 shrink-0">
            <label className="block font-bold text-zinc-700 dark:text-zinc-300">이메일 제목 (Subject)</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="이메일 제목을 입력해주세요."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-colors font-semibold text-xs"
            />
          </div>

          {/* Event-Specific Variable Inserter Chips */}
          <div className="space-y-1.5 shrink-0 select-none">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300">이 템플릿에서 사용 가능한 변수:</span>
              <span className="text-[9px] text-zinc-400 font-mono">클릭 시 본문에 삽입</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {availableVariableChips.map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => handleInsertVariable(v.tag)}
                  className="px-2 py-0.8 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-mono text-[10px] border border-zinc-200/80 dark:border-zinc-700/80 transition-colors cursor-pointer flex items-center gap-1"
                  title={`${v.label} 삽입`}
                >
                  <span className="font-bold">{v.tag}</span>
                  <span className="font-sans text-[9px] text-zinc-400">({v.label})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Body Field */}
          <div className="flex-1 flex flex-col space-y-1 min-h-[140px]">
            <div className="flex items-center justify-between select-none">
              <label className="block font-bold text-zinc-700 dark:text-zinc-300">
                본문 내용 <span className="font-normal text-zinc-400">(첫 줄은 메인 카드 타이틀로 자동 렌더링됩니다)</span>
              </label>
              <span className="text-[10px] text-zinc-400 font-mono">{"{{infoBox}}"} / {"{{ctaButton}}"} 위치 지정 가능</span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="이메일 본문 내용을 입력해주세요."
              className="flex-1 w-full rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-colors leading-relaxed resize-none font-mono text-xs"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2 shrink-0 select-none">
            <button
              type="submit"
              disabled={isSaving}
              className={`rounded-lg px-4 py-2 font-bold text-white transition-colors cursor-pointer disabled:opacity-50 ${
                selectedScope === "hub"
                  ? "bg-[#09090B] hover:bg-zinc-800 border-b-2 border-[#ff2b75]"
                  : "bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
              }`}
            >
              {isSaving ? "저장 중..." : "💾 저장하기"}
            </button>
            <button
              type="button"
              onClick={handleTestSend}
              disabled={isSendingTest}
              className="rounded-lg border border-zinc-200 px-4 py-2 font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-950 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSendingTest ? "발송 중..." : "✉️ 테스트 발송"}
            </button>
          </div>
        </form>
      </div>

      {/* Resize Splitter 2 */}
      <div
        onMouseDown={() => setIsResizingRight(true)}
        className={`w-2 shrink-0 self-stretch hover:bg-zinc-300 dark:hover:bg-zinc-700 active:bg-zinc-400 dark:active:bg-zinc-500 transition-colors cursor-col-resize flex items-center justify-center select-none ${
          isResizingRight ? "bg-zinc-400 dark:bg-zinc-500" : "bg-transparent"
        }`}
      >
        <div className="h-6 w-0.5 bg-zinc-300 dark:bg-zinc-700 rounded" />
      </div>

      {/* 3. Right panel: Desktop Email Preview mockup */}
      <div
        style={{ width: `${rightWidth}px` }}
        className="shrink-0 rounded-r-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 flex flex-col overflow-hidden"
      >
        <div className="p-3.5 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/20 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-zinc-900 dark:text-white">실시간 미리보기</h3>
            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
              selectedScope === "hub" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"
            }`}>
              {selectedScope === "hub" ? "HUB Retail Design" : "NETWORK Brand Design"}
            </span>
          </div>
          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded flex items-center gap-1">
            <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
            실시간 연동
          </span>
        </div>

        <div className="flex-1 bg-zinc-100 dark:bg-zinc-950/30 p-3 min-h-0 flex flex-col justify-stretch">
          {/* Email client window mockup */}
          <div className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white shadow-sm flex flex-col overflow-hidden min-h-0">
            {/* Window title bar */}
            <div className="bg-zinc-50 dark:bg-zinc-900 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5 shrink-0">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <div className="text-[9px] font-mono text-zinc-400 ml-2 truncate">
                To: {activeTemplate?.description}
              </div>
            </div>

            {/* Email subject preview */}
            <div className="p-2.5 border-b border-zinc-100 dark:border-zinc-800/80 shrink-0 bg-white dark:bg-zinc-900 select-text">
              <span className="font-extrabold text-zinc-400 mr-2 text-[10px]">Subject:</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 text-[10px] break-all leading-tight">
                {subject || "(제목 없음)"}
              </span>
            </div>

            {/* Email HTML Preview iframe */}
            <div className="flex-1 bg-white relative min-h-0">
              {previewLoading && (
                <div className="absolute inset-0 z-10 bg-white/70 dark:bg-zinc-900/70 flex items-center justify-center">
                  <span className="text-[10px] font-extrabold text-zinc-500 animate-pulse">미리보기 렌더링 중...</span>
                </div>
              )}
              {previewHtml ? (
                <iframe
                  key={selectedKey}
                  title="Email Preview"
                  srcDoc={previewHtml}
                  className="w-full h-full border-0 bg-white"
                />
              ) : (
                <div className="h-full flex items-center justify-center p-6 text-center text-zinc-400">
                  미리보기를 불러올 수 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
