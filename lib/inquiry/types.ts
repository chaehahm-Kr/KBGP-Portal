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
  reopen_count?: number;
  satisfaction_score?: number | null;
  satisfaction_comment?: string | null;
  created_at: string;
  updated_at: string;
  companyName?: string;
  repliedStaffName?: string;
  messages?: InquiryMessageItem[];
}

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  open:            "접수됨",
  in_review:       "검토중",
  awaiting_reply:  "답변대기",
  action_required: "조치필요",
  action_resolved: "조치완료",
  resolved:        "해결됨",
  closed:          "종료됨",
  reopened:        "재오픈",
  pending:         "접수됨",
  replied:         "검토중",
};

export const CASE_STATUS_COLOR: Record<CaseStatus, string> = {
  open:            "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  in_review:       "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  awaiting_reply:  "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  action_required: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  action_resolved: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
  resolved:        "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  closed:          "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  reopened:        "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  pending:         "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  replied:         "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
};
