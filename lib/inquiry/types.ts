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
  reply_content: string | null;
  replied_by: string | null;
  replied_at: string | null;
  is_action_required: boolean;
  closed_at?: string | null;
  closed_by?: string | null;
  closed_by_side?: "admin" | "portal" | null;
  previous_case_id?: string | null;
  previous_case_number?: string | null;
  previous_case_title?: string | null;
  reopen_count?: number;
  satisfaction_score?: number | null;
  satisfaction_comment?: string | null;
  created_at: string;
  updated_at: string;
  companyName?: string;
  repliedStaffName?: string;
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
  if (["closed", "resolved", "action_resolved"].includes(s)) return "CLOSED";
  if (["action_required", "awaiting_reply", "reopened"].includes(s)) return "ACTION_REQUIRED";
  if (["in_review", "replied", "processing", "under_review"].includes(s)) return "UNDER_REVIEW";
  return "RECEIVED";
}

export const OFFICIAL_STATUS_LABEL: Record<OfficialCaseStatus, { ko: string; en: string }> = {
  RECEIVED:        { ko: "접수됨", en: "Received" },
  UNDER_REVIEW:    { ko: "검토중", en: "Under Review" },
  ACTION_REQUIRED: { ko: "조치필요", en: "Action Required" },
  CLOSED:          { ko: "종료됨", en: "Closed" },
};

export const OFFICIAL_STATUS_COLOR: Record<OfficialCaseStatus, string> = {
  RECEIVED:        "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  UNDER_REVIEW:    "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  ACTION_REQUIRED: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  CLOSED:          "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
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
  open:            "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  in_review:       "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  awaiting_reply:  "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  action_required: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  action_resolved: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  resolved:        "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  closed:          "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  reopened:        "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  pending:         "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  replied:         "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
};
