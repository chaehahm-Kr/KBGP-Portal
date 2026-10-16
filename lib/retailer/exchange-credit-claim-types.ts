/**
 * Retailer 90-Day Exchange Credit Claim Backend Types
 * Task ID: EXCHANGE-CREDIT-PH2-004
 * Location: lib/retailer/exchange-credit-claim-types.ts
 */

import {
  EvaluatorEligibilityStatus,
  Day100SnapshotPayload,
} from "./exchange-credit-evaluator";

export type ExchangeClaimStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "information_requested"
  | "approved"
  | "rejected"
  | "cancelled"
  | "awaiting_return"
  | "inspection_pending"
  | "resolved";

export type ExchangeClaimItemStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "cancelled"
  | "awaiting_return"
  | "inspection_pending"
  | "resolved";

export type ExchangeCreditOption = "A" | "B";

export interface SubmitClaimItemInput {
  cohortId: string;
  productId: string;
  selectedOption: ExchangeCreditOption;
  selectedQuantity: number;
  currentConfirmedStock: number;
}

export interface SubmitClaimInput {
  storeId: string;
  items: SubmitClaimItemInput[];
  isStockReconfirmed: boolean;
  retailerNotes?: string | null;
}

export interface SaveClaimDraftInput {
  storeId: string;
  claimId?: string; // If editing an existing draft
  items: SubmitClaimItemInput[];
  retailerNotes?: string | null;
}

export interface ClaimValidationError {
  cohortId?: string;
  productId?: string;
  code: string;
  message: string;
}

export interface ClaimTotalsCalculation {
  totalItemsCount: number;
  totalUnitsCount: number;
  totalOptionAUnits: number;
  totalOptionBUnits: number;
  estimatedCreditOptionA: number;
  estimatedCreditOptionB: number;
  totalEstimatedCredit: number;
}

export interface ClaimSubmissionResult {
  success: boolean;
  claimId?: string;
  claimNumber?: string;
  status?: ExchangeClaimStatus;
  totals?: ClaimTotalsCalculation;
  error?: string;
  validationErrors?: ClaimValidationError[];
}

export interface RetailerClaimItemDetail {
  id: string;
  claimId: string;
  cohortId: string;
  productId: string;
  productName: string;
  productSku: string;
  productThumbnailUrl: string | null;
  selectedOption: ExchangeCreditOption;
  selectedQuantity: number;
  maxClaimableQuantity: number;
  frozenUnitWholesalePrice: number;
  frozenCreditRate: number;
  estimatedCreditAmount: number;
  status: ExchangeClaimItemStatus;
  statusLabel: string;
  day100Snapshot: Day100SnapshotPayload;
  returnTrackingNumber: string | null;
  returnCarrier: string | null;
  returnShippedAt: string | null;
  returnDeliveredAt: string | null;
  inspectedQuantity: number | null;
  finalCreditAmount: number | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
}

export interface ClaimAuditLogEntry {
  id: string;
  claimId: string;
  claimItemId?: string | null;
  action: string;
  performedBy: string;
  performedByName?: string;
  oldStatus: string | null;
  newStatus: string;
  reason: string | null;
  createdAt: string;
}

export interface RetailerClaimDetail {
  id: string;
  claimNumber: string;
  companyId: string;
  companyName: string;
  storeId: string;
  storeName: string;
  storeCode: string | null;
  status: ExchangeClaimStatus;
  statusLabel: string;
  totalItemsCount: number;
  totalUnitsCount: number;
  totalOptionAUnits: number;
  totalOptionBUnits: number;
  estimatedCreditOptionA: number;
  estimatedCreditOptionB: number;
  totalEstimatedCredit: number;
  finalCreditAmount: number | null;
  stockReconfirmedBy: string;
  stockReconfirmedAt: string;
  retailerNotes: string | null;
  adminNotes: string | null;
  submittedAt: string;
  submittedBy: string;
  items: RetailerClaimItemDetail[];
  auditLogs: ClaimAuditLogEntry[];
}

export interface RetailerClaimSummaryItem {
  id: string;
  claimNumber: string;
  storeId: string;
  storeName: string;
  storeCode: string | null;
  status: ExchangeClaimStatus;
  statusLabel: string;
  totalItemsCount: number;
  totalUnitsCount: number;
  totalEstimatedCredit: number;
  finalCreditAmount: number | null;
  submittedAt: string;
}

export const CLAIM_STATUS_CONFIG: Record<
  ExchangeClaimStatus,
  { label: string; badgeClass: string }
> = {
  draft: {
    label: "임시 저장 (Draft)",
    badgeClass: "bg-zinc-800 text-zinc-300 border-zinc-700",
  },
  submitted: {
    label: "신청 접수 (Submitted)",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  under_review: {
    label: "심사 중 (Under Review)",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  information_requested: {
    label: "보완 요청 (Info Requested)",
    badgeClass: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
  approved: {
    label: "승인 완료 (Approved)",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  rejected: {
    label: "반려/기각 (Rejected)",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  },
  cancelled: {
    label: "신청 취소 (Cancelled)",
    badgeClass: "bg-zinc-800 text-zinc-400 border-zinc-700",
  },
  awaiting_return: {
    label: "반품 대기 (Awaiting Return)",
    badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  },
  inspection_pending: {
    label: "검수 대기 (Inspection Pending)",
    badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  },
  resolved: {
    label: "정산 완료 (Resolved)",
    badgeClass: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  },
};
