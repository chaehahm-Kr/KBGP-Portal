// ─────────────────────────────────────────────────────────────────────────────
// Shared types and constants for the Case / Partner Inquiry system.
// This file must NOT have "use server" — it is imported by both Server and
// Client components.
// ─────────────────────────────────────────────────────────────────────────────

export type CaseStatus =
  | "open"
  | "in_review"
  | "awaiting_reply"
  | "action_required"
  | "action_resolved"
  | "resolved"
  | "closed"
  | "reopened"
  // legacy values kept for DB compatibility
  | "pending"
  | "replied";

export type MessageType =
  | "message"
  | "status_change"
  | "action_required"
  | "action_resolved"
  | "case_closed"
  | "case_reopened"
  | "satisfaction";

export interface InquiryMessageItem {
  id: string;
  senderType: "partner" | "admin" | "system";
  senderName: string;
  content: string;
  messageType: MessageType;
  isActionFlag: boolean;
  attachmentUrl?: string | null;
  attachmentFilename?: string | null;
  createdAt: string;
}

export interface PartnerInquiryItem {
  id: string;
  company_id: string;
  created_by: string;
  category: string;
  title: string;
  content: string;
  attachment_path: string | null;
  attachment_filename: string | null;
  attachment_url?: string | null;
  case_number?: string | null;
  status: CaseStatus;
  source_type?: "brand" | "retailer";
  reply_content: string | null;
  replied_by: string | null;
  replied_at: string | null;
  is_action_required: boolean;
  closed_at?: string | null;
  closed_by?: string | null;
  closed_by_side?: "admin" | "portal" | null;
  created_source?: "admin" | "portal" | null;
  priority?: "normal" | "high" | "urgent" | null;
  previous_case_id?: string | null;
  previous_case_number?: string | null;
  previous_case_title?: string | null;
  reopen_count?: number;
  satisfaction_score?: number | null;
  satisfaction_comment?: string | null;
  created_at: string;
  updated_at: string;
  companyName?: string;
  requesterName?: string | null;
  requesterEmail?: string | null;
  repliedStaffName?: string;
  assigned_team?: string | null;
  assigned_to?: string | null;
  assignedStaffName?: string | null;
  // Brand PO / Invoice Context
  related_po_id?: string | null;
  related_invoice_id?: string | null;
  related_po_number?: string | null;
  related_po_order_date?: string | null;
  related_po_status?: string | null;
  related_po_revision_no?: number | null;
  related_po_supplier_name?: string | null;
  related_invoice_number?: string | null;
  related_ap_number?: string | null;
  // Retailer Context
  store_id?: string | null;
  store_name?: string | null;
  related_order_id?: string | null;
  related_order_number?: string | null;
  related_fulfillment_id?: string | null;
  related_fulfillment_number?: string | null;
  related_product_id?: string | null;
  related_product_name?: string | null;
  related_product_sku?: string | null;
  related_protection_id?: string | null;
  messages?: InquiryMessageItem[];
}

export type OfficialCaseStatus = "RECEIVED" | "UNDER_REVIEW" | "ACTION_REQUIRED" | "CLOSED";

/**
 * Normalizes any legacy or DB status value to one of the 4 official case statuses:
 * 1. RECEIVED (접수됨)
 * 2. UNDER_REVIEW (검토중)
 * 3. ACTION_REQUIRED (조치필요)
 * 4. CLOSED (종료됨)
 */
export function getNormalizedStatus(rawStatus?: string | null): OfficialCaseStatus {
  if (!rawStatus) return "RECEIVED";
  const s = rawStatus.toLowerCase().trim();
  if (["closed", "resolved"].includes(s)) return "CLOSED";
  if (["action_required"].includes(s)) return "ACTION_REQUIRED";
  if (["in_review", "replied", "processing", "under_review", "action_resolved", "awaiting_reply", "reopened"].includes(s)) return "UNDER_REVIEW";
  return "RECEIVED";
}

export const OFFICIAL_STATUS_LABEL: Record<OfficialCaseStatus, { ko: string; en: string }> = {
  RECEIVED:        { ko: "접수됨", en: "Received" },
  UNDER_REVIEW:    { ko: "검토중", en: "Under Review" },
  ACTION_REQUIRED: { ko: "조치필요", en: "Action Required" },
  CLOSED:          { ko: "종료됨", en: "Closed" },
};

export const OFFICIAL_STATUS_COLOR: Record<OfficialCaseStatus, string> = {
  RECEIVED:        "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  UNDER_REVIEW:    "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  ACTION_REQUIRED: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  CLOSED:          "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
};

export const OFFICIAL_STATUS_EMOJI: Record<OfficialCaseStatus, string> = {
  RECEIVED:        "🟡",
  UNDER_REVIEW:    "🔵",
  ACTION_REQUIRED: "🔴",
  CLOSED:          "⚫",
};

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  open:            "접수됨",
  in_review:       "검토중",
  awaiting_reply:  "조치필요",
  action_required: "조치필요",
  action_resolved: "종료됨",
  resolved:        "종료됨",
  closed:          "종료됨",
  reopened:        "조치필요",
  pending:         "접수됨",
  replied:         "검토중",
};

export const CASE_STATUS_COLOR: Record<CaseStatus, string> = {
  open:            "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  in_review:       "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  awaiting_reply:  "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  action_required: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  action_resolved: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  resolved:        "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  closed:          "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  reopened:        "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  pending:         "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  replied:         "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
};

export interface SettlementInquiryQueryParams {
  new?: string;
  category?: string;
  invoice_id?: string;
  invoice_no?: string;
  ap_no?: string;
  po_id?: string;
  po_no?: string;
  invoice_total?: string | number;
  outstanding_balance?: string | number;
}

/**
 * Builds the canonical portal support URL for initiating a prefilled settlement inquiry.
 */
export function buildSettlementInquiryUrl(params: SettlementInquiryQueryParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("new", "1");
  searchParams.set("category", params.category || "settlement");
  if (params.invoice_id) searchParams.set("invoice_id", params.invoice_id);
  if (params.invoice_no) searchParams.set("invoice_no", params.invoice_no);
  if (params.ap_no) searchParams.set("ap_no", params.ap_no);
  if (params.po_id) searchParams.set("po_id", params.po_id);
  if (params.po_no) searchParams.set("po_no", params.po_no);
  if (params.invoice_total !== undefined && params.invoice_total !== null && params.invoice_total !== "") {
    searchParams.set("invoice_total", String(params.invoice_total));
  }
  if (params.outstanding_balance !== undefined && params.outstanding_balance !== null && params.outstanding_balance !== "") {
    searchParams.set("outstanding_balance", String(params.outstanding_balance));
  }
  return `/portal/support?${searchParams.toString()}`;
}

export interface PoChangeInquiryQueryParams {
  new?: string;
  category?: string;
  po_id?: string;
  po_no?: string;
  order_date?: string;
  company_name?: string;
  po_status?: string;
  revision_no?: string | number;
}

/**
 * Builds the canonical portal support URL for initiating a prefilled PO change request case.
 */
export function buildPoChangeInquiryUrl(params: PoChangeInquiryQueryParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("new", "1");
  searchParams.set("category", params.category || "po_change");
  if (params.po_id) searchParams.set("po_id", params.po_id);
  if (params.po_no) searchParams.set("po_no", params.po_no);
  if (params.order_date) searchParams.set("order_date", params.order_date);
  if (params.company_name) searchParams.set("company_name", params.company_name);
  if (params.po_status) searchParams.set("po_status", params.po_status);
  if (params.revision_no !== undefined && params.revision_no !== null) {
    searchParams.set("revision_no", String(params.revision_no));
  }
  return `/portal/support?${searchParams.toString()}`;
}

export interface RetailerCaseCategory {
  key: string;
  labelEn: string;
  labelKo: string;
  description: string;
  icon: string;
}

export const RETAILER_CASE_CATEGORIES: RetailerCaseCategory[] = [
  {
    key: "order_delivery",
    labelEn: "Order & Delivery",
    labelKo: "주문 및 배송 문의",
    description: "Inquiries regarding submitted orders, tracking numbers, missing/damaged items during delivery",
    icon: "🚚",
  },
  {
    key: "product_pricing",
    labelEn: "Product & Pricing",
    labelKo: "상품 및 공급가 문의",
    description: "Questions about product specifications, wholesale pricing, case packs, or catalog availability",
    icon: "🏷️",
  },
  {
    key: "payment_terms",
    labelEn: "Payment / Terms / Invoice",
    labelKo: "결제 / 여신조건 / 인보이스",
    description: "Credit card, ACH bank transfer, Net Terms settlement, or invoice receipt inquiries",
    icon: "💳",
  },
  {
    key: "price_tag_qr",
    labelEn: "Price Tag / QR",
    labelKo: "가격표 및 QR 출력 문의",
    description: "Assistance with store shelf price tags, barcode stickers, or QR code scanning",
    icon: "🖨️",
  },
  {
    key: "weekly_check",
    labelEn: "Weekly Product Check",
    labelKo: "주간 재고 점검 문의",
    description: "Reporting week count submissions, count adjustments, or sell-through discrepancies",
    icon: "📋",
  },
  {
    key: "training",
    labelEn: "Training",
    labelKo: "직원 교육 및 매뉴얼",
    description: "Staff sales points, video guides, product tester inquiries, or brand materials",
    icon: "🎓",
  },
  {
    key: "portal_tech",
    labelEn: "Portal / Technical Support",
    labelKo: "포털 오류 및 시스템 문의",
    description: "Login issues, user permissions, store access, or technical bug reports",
    icon: "⚙️",
  },
  {
    key: "general",
    labelEn: "General Inquiry",
    labelKo: "기타 일반 문의",
    description: "General retailer assistance, store expansion, or partner inquiries",
    icon: "💬",
  },
];

export const ALL_CASE_CATEGORY_LABELS: Record<string, { en: string; ko: string }> = {
  // Brand Categories
  po_change:   { en: "PO Change Request", ko: "PO 변경 요청" },
  product:     { en: "Product Registration", ko: "제품 등록 및 스펙 수정" },
  onboarding:  { en: "Onboarding Review", ko: "입점 신청 및 심사 현황" },
  logistics:   { en: "Logistics & Packaging", ko: "물류 공급 및 패키징" },
  translation: { en: "Translation & Ingredients", ko: "번역 및 전성분표 기재" },
  settlement:  { en: "Settlement / Invoice", ko: "정산 / 인보이스 문의" },
  system:      { en: "System & Tech", ko: "시스템 오류 제보 및 기능 제안" },
  // Retailer Categories
  order_delivery:  { en: "Order & Delivery", ko: "주문 및 배송 문의" },
  product_pricing: { en: "Product & Pricing", ko: "상품 및 공급가 문의" },
  payment_terms:   { en: "Payment / Terms / Invoice", ko: "결제 / 여신조건 / 인보이스" },
  price_tag_qr:    { en: "Price Tag / QR", ko: "가격표 및 QR 출력 문의" },
  weekly_check:    { en: "Weekly Product Check", ko: "주간 재고 점검 문의" },
  training:        { en: "Training", ko: "직원 교육 및 매뉴얼" },
  portal_tech:     { en: "Portal / Technical Support", ko: "포털 오류 및 시스템 문의" },
  general:         { en: "General Inquiry", ko: "기타 일반 문의" },
};

