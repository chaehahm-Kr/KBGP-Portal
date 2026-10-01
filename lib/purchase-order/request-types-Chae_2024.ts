export type PoRequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "CHANGE_REQUESTED"
  | "CONVERTED_TO_PO"
  | "REJECTED"
  | "CANCELLED";

export const PO_REQUEST_STATUS_LABELS_KO: Record<PoRequestStatus, string> = {
  DRAFT: "작성 중",
  SUBMITTED: "제출 완료",
  UNDER_REVIEW: "검토 중",
  CHANGE_REQUESTED: "수정 요청",
  CONVERTED_TO_PO: "PO 전환 완료",
  REJECTED: "반려",
  CANCELLED: "취소",
};

export const PO_REQUEST_STATUS_LABELS_EN: Record<PoRequestStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  CHANGE_REQUESTED: "Change Requested",
  CONVERTED_TO_PO: "Converted to PO",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export const PO_REQUEST_STATUS_COLORS: Record<PoRequestStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  UNDER_REVIEW: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900",
  CHANGE_REQUESTED: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  CONVERTED_TO_PO: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  CANCELLED: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-850 dark:text-zinc-400 dark:border-zinc-800",
};

export interface PoRequestLineInput {
  product_id: string;
  requested_qty: number;
  reference_unit_cost: number;
  line_note?: string;
  admin_final_qty?: number;
  admin_final_unit_cost?: number;
}

export interface PoRequestInput {
  contact_user_id?: string;
  contact_name?: string;
  contact_email?: string;
  shipping_origin_id?: string;
  requested_ready_date?: string;
  notes?: string;
  submit_now?: boolean;
  lines: PoRequestLineInput[];
}

export interface PoRequestLine {
  id: string;
  po_request_id: string;
  product_id: string;
  product_name_snapshot: string;
  letusto_sku_snapshot: string | null;
  manufacture_sku_snapshot: string | null;
  requested_qty: number;
  reference_unit_cost: number;
  estimated_line_total: number;
  admin_final_qty: number | null;
  admin_final_unit_cost: number | null;
  admin_final_line_total: number | null;
  line_note: string | null;
  photo_url?: string | null;
  carton_pack_qty?: number;
  price_tiers?: { qty: number; price: number }[];
  base_fob?: number;
}

export interface PoRequestHistoryEntry {
  id: string;
  po_request_id: string;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  notes: string | null;
  created_at: string;
}

export interface PoRequestDetail {
  id: string;
  request_number: string;
  company_id: string;
  company_name: string;
  contact_user_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  shipping_origin_id: string | null;
  shipping_origin_name?: string | null;
  shipping_origin_address?: string | null;
  requested_ready_date: string | null;
  status: PoRequestStatus;
  notes: string | null;
  admin_review_notes: string | null;
  change_request_reason: string | null;
  rejection_reason: string | null;
  converted_po_id: string | null;
  converted_po_number: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  converted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  total_requested_qty: number;
  total_estimated_amount: number;
  total_final_qty: number | null;
  total_final_amount: number | null;
  lines: PoRequestLine[];
  history: PoRequestHistoryEntry[];
}
