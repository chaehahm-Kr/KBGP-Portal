/**
 * 90-Day Exchange Credit Pilot — Phase 4 Credit Ledger Types
 * Task ID: EXCHANGE-CREDIT-PH4-001
 * Location: lib/retailer/exchange-credit-ledger/credit-ledger-types.ts
 *
 * Core domain contracts for immutable financial ledger, Option A/B issuance,
 * strict 90-day calendar expiration, and company-scoped credit balances.
 */

export type CreditStatus =
  | "issued"
  | "reserved"
  | "redeemed"
  | "expired"
  | "voided";

export type CreditIssuanceSource =
  | "option_a_claim_approved"
  | "option_b_inspection_passed";

export type CreditTransactionType =
  | "issuance"
  | "reservation"
  | "reservation_release"
  | "redemption"
  | "expiration"
  | "void";

export interface ExchangeCreditLedgerRecord {
  id: string;
  creditCode: string; // e.g. CRD-2026-000001
  companyId: string;
  storeId: string | null;
  issuanceSource: CreditIssuanceSource;
  sourceClaimId: string;
  sourceClaimItemId: string;
  sourceRmaId: string | null;
  sourceInspectionId: string | null;

  // Exact financial amounts
  creditAmount: number; // in USD dollars (2 decimal places)
  creditAmountCents: number; // in integer cents
  remainingBalance: number; // in USD dollars
  remainingBalanceCents: number; // in integer cents
  currency: "USD";

  // State & lifecycle
  status: CreditStatus;
  issuedAt: string; // ISO 8601
  expiresAt: string; // Exactly issuedAt + 90 calendar days
  issuedBy: string; // User ID / Admin profile ID
  idempotencyKey: string;

  // Metadata snapshot (frozen rates, quantities, inspector attribution)
  metadata: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
}

export interface ExchangeCreditTransactionRecord {
  id: string;
  creditId: string;
  companyId: string;
  transactionType: CreditTransactionType;

  // Amount of the transaction
  amount: number;
  amountCents: number;
  balanceBefore: number;
  balanceBeforeCents: number;
  balanceAfter: number;
  balanceAfterCents: number;

  // References
  referenceOrderId: string | null;
  referenceCheckoutSessionId: string | null;
  performedBy: string;
  idempotencyKey: string | null;
  notes: string | null;

  createdAt: string;
}

// -------------------------------------------------------------------------
// Input Contracts for Issuance
// -------------------------------------------------------------------------

export interface IssueOptionACreditInput {
  claimId: string;
  claimItemId: string;
  approvedQuantity: number;
  notes?: string | null;
}

export interface IssueOptionBCreditInput {
  rmaId: string;
  inspectionId: string;
  rmaLineId: string;
  claimItemId: string;
  notes?: string | null;
}

export interface CreditIssuanceResult {
  success: boolean;
  credit?: ExchangeCreditLedgerRecord;
  error?: string;
  errorCode?: string;
  validationDetails?: Record<string, unknown>;
}

// -------------------------------------------------------------------------
// Read Model Summaries & Queries
// -------------------------------------------------------------------------

export interface CompanyCreditSummary {
  companyId: string;
  totalAvailableCreditsDollars: number;
  totalAvailableCreditsCents: number;
  activeCreditsCount: number;
  expiringWithin30DaysCount: number;
  expiringWithin30DaysDollars: number;
  expiredCreditsCount: number;
  expiredCreditsDollars: number;
  redeemedCreditsDollars: number;
  voidedCreditsDollars: number;
  oldestActiveExpirationDate: string | null;
}

export interface CreditDetailView {
  credit: ExchangeCreditLedgerRecord;
  transactions: ExchangeCreditTransactionRecord[];
  sourceClaim?: {
    id: string;
    claimNumber: string;
    status: string;
    storeName?: string;
  };
  sourceProduct?: {
    id: string;
    name: string;
    sku: string;
    thumbnailUrl?: string | null;
  };
  sourceRma?: {
    id: string;
    rmaNumber: string;
    status: string;
  };
}

export interface ListCreditsFilter {
  status?: CreditStatus;
  issuanceSource?: CreditIssuanceSource;
  limit?: number;
  offset?: number;
}

export const CREDIT_STATUS_CONFIG: Record<
  CreditStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  issued: {
    label: "사용 가능 (Available)",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  reserved: {
    label: "주문 예약중 (Reserved)",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
  redeemed: {
    label: "사용 완료 (Redeemed)",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
  },
  expired: {
    label: "기한 만료 (Expired)",
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
    border: "border-zinc-500/20",
  },
  voided: {
    label: "발행 취소 (Voided)",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
  },
};
