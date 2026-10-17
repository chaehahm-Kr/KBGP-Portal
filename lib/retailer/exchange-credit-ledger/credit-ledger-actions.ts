"use server";

/**
 * 90-Day Exchange Credit Pilot — Phase 4 Authoritative Credit Ledger Actions
 * Task ID: EXCHANGE-CREDIT-PH4-001
 * Location: lib/retailer/exchange-credit-ledger/credit-ledger-actions.ts
 *
 * Implements:
 * - Feature-gated credit issuance (Option A Keep Products & Option B Return Products)
 * - Anti-duplicate issuance protections (Unique Claim Item & Idempotency key)
 * - Strict 90-calendar-day non-extendable expiration
 * - Multi-tenant Company isolation & authorization boundary
 * - Read-only queries for Admin overview and Retailer portal
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminSession } from "@/lib/auth/dal";
import {
  CreditStatus,
  CreditIssuanceSource,
  ExchangeCreditLedgerRecord,
  ExchangeCreditTransactionRecord,
  IssueOptionACreditInput,
  IssueOptionBCreditInput,
  CreditIssuanceResult,
  CompanyCreditSummary,
  CreditDetailView,
  ListCreditsFilter,
} from "./credit-ledger-types";
import {
  checkExchangeCreditIssuanceEnabled,
} from "./credit-ledger-gate";
import {
  calculateOptionACreditAmount,
  calculateOptionBCreditAmount,
  calculateCreditExpirationDate,
  generateOptionAIdempotencyKey,
  generateOptionBIdempotencyKey,
  formatCreditCode,
  isCreditExpired,
  dollarsToCents,
  centsToDollars,
} from "./credit-ledger-calculator";

// -----------------------------------------------------------------------------
// 1. Safe Schema Availability Check
// -----------------------------------------------------------------------------

/**
 * Verifies whether the Phase 4 credit ledger tables exist in the database.
 * Returns false cleanly if migrations have not yet been executed by the Owner.
 */
export async function checkCreditLedgerSchemaAvailability(): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("retailer_exchange_credit_ledger")
      .select("id")
      .limit(1);

    if (error) {
      if (
        error.code === "42P01" ||
        error.message?.includes("does not exist") ||
        error.message?.includes("relation")
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// 2. Authorization Helper (Company Scope Protection)
// -----------------------------------------------------------------------------

/**
 * Ensures caller is either an Admin or an active member of the specified Retailer Company.
 * Prevents cross-company credit information leakage and unauthorized mutations.
 */
export async function verifyCompanyCreditAccess(
  companyId: string
): Promise<{ success: boolean; error?: string; errorCode?: string; userId?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: "Unauthorized: Active user session required.",
        errorCode: "UNAUTHORIZED",
      };
    }

    const adminClient = createAdminClient();

    // 1. Check if user is an Admin
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "admin") {
      return { success: true, userId: user.id };
    }

    // 2. Check if user is an active member of the requested company
    const { data: companyUser, error: cuErr } = await adminClient
      .from("company_users")
      .select("id, company_id, status")
      .eq("email", user.email)
      .eq("company_id", companyId)
      .maybeSingle();

    if (cuErr || !companyUser) {
      return {
        success: false,
        error: "Forbidden: Not a member of the specified company. Cross-company access is strictly prohibited.",
        errorCode: "FORBIDDEN",
      };
    }

    if (companyUser.status !== "active") {
      return {
        success: false,
        error: `Forbidden: Company membership is ${companyUser.status}. Active status required.`,
        errorCode: "INACTIVE_MEMBERSHIP",
      };
    }

    return { success: true, userId: user.id };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Authorization check failed.",
      errorCode: "AUTH_CHECK_FAILED",
    };
  }
}

// -----------------------------------------------------------------------------
// 3. Option A (Keep Products) Credit Issuance Server Action
// -----------------------------------------------------------------------------

/**
 * Issues store-level / company-scoped exchange credit for Option A (Keep Products).
 *
 * Requirements:
 * - Feature gate ENABLE_EXCHANGE_CREDIT_ISSUANCE must be enabled.
 * - Admin session required.
 * - Claim must be finalized/approved.
 * - Claim line item must be Option A and approved.
 * - Zero duplicate issuance per claim line item (unique constraint).
 * - Exact calculation: Approved Quantity × Frozen Wholesale Price × Frozen Option A Rate.
 * - Exact 90 calendar day expiration timestamp.
 */
export async function issueOptionACreditAction(
  input: IssueOptionACreditInput
): Promise<CreditIssuanceResult> {
  // Gate Check
  if (!checkExchangeCreditIssuanceEnabled()) {
    return {
      success: false,
      error: "Exchange Credit issuance is currently disabled (feature-gated for Phase 4 foundation).",
      errorCode: "FEATURE_GATED",
    };
  }

  // Admin Session Check
  const session = await verifyAdminSession();
  if (!session || !session.userId || session.role !== "admin") {
    return {
      success: false,
      error: "Unauthorized: Admin session required for credit issuance.",
      errorCode: "UNAUTHORIZED",
    };
  }

  // Schema Availability Check
  const isSchemaAvailable = await checkCreditLedgerSchemaAvailability();
  if (!isSchemaAvailable) {
    return {
      success: false,
      error: "Credit ledger schema is not yet applied to the database. Prepared migration pending execution.",
      errorCode: "SCHEMA_NOT_AVAILABLE",
    };
  }

  const supabase = createAdminClient();

  // 1. Fetch Claim Line Item
  const { data: claimItem, error: itemErr } = await supabase
    .from("retailer_exchange_claim_items")
    .select(`
      id,
      claim_id,
      cohort_id,
      product_id,
      store_id,
      company_id,
      selected_option,
      selected_quantity,
      max_claimable_quantity,
      frozen_unit_wholesale_price,
      frozen_credit_rate,
      status
    `)
    .eq("id", input.claimItemId)
    .maybeSingle();

  if (itemErr || !claimItem) {
    return {
      success: false,
      error: `Claim item not found: ${itemErr?.message || "Invalid claim item ID"}`,
      errorCode: "CLAIM_ITEM_NOT_FOUND",
    };
  }

  // 2. Fetch Claim Header
  const { data: claim, error: claimErr } = await supabase
    .from("retailer_exchange_claims")
    .select("id, claim_number, status, company_id, store_id")
    .eq("id", claimItem.claim_id)
    .maybeSingle();

  if (claimErr || !claim) {
    return {
      success: false,
      error: `Claim header not found: ${claimErr?.message || "Invalid claim ID"}`,
      errorCode: "CLAIM_NOT_FOUND",
    };
  }

  // Eligibility Rule A: Claim must be approved or resolved
  if (claim.status !== "approved" && claim.status !== "resolved") {
    return {
      success: false,
      error: `Cannot issue credit for claim in status "${claim.status}". Claim must be approved by Admin first.`,
      errorCode: "UNAPPROVED_CLAIM",
    };
  }

  // Eligibility Rule B: Line Item must be Option A
  if (claimItem.selected_option !== "A") {
    return {
      success: false,
      error: `Claim line item is Option ${claimItem.selected_option}. Option A issuance requires Option A selection.`,
      errorCode: "INVALID_OPTION_FOR_ISSUANCE",
    };
  }

  // Eligibility Rule C: Approved quantity bounds
  if (
    !Number.isInteger(input.approvedQuantity) ||
    input.approvedQuantity <= 0 ||
    input.approvedQuantity > claimItem.selected_quantity
  ) {
    return {
      success: false,
      error: `Approved quantity must be between 1 and ${claimItem.selected_quantity}. Received: ${input.approvedQuantity}`,
      errorCode: "INVALID_APPROVED_QUANTITY",
    };
  }

  // Eligibility Rule D: Prevent Duplicate Issuance
  const { data: existingCredit } = await supabase
    .from("retailer_exchange_credit_ledger")
    .select("id, credit_code, status, credit_amount")
    .eq("source_claim_item_id", input.claimItemId)
    .maybeSingle();

  if (existingCredit) {
    return {
      success: false,
      error: `Credit has already been issued for this claim item (Credit Code: ${existingCredit.credit_code}). Duplicate issuance is prohibited.`,
      errorCode: "DUPLICATE_CREDIT_ISSUANCE",
    };
  }

  // 3. Compute Monetary Amount via Pure Safe Calculator
  const calcResult = calculateOptionACreditAmount({
    approvedQuantity: input.approvedQuantity,
    frozenUnitWholesalePrice: Number(claimItem.frozen_unit_wholesale_price),
    frozenOptionARate: Number(claimItem.frozen_credit_rate),
  });

  if (!calcResult.success) {
    return {
      success: false,
      error: calcResult.error || "Monetary calculation failed.",
      errorCode: calcResult.errorCode || "CALCULATION_FAILED",
    };
  }

  const issuedAt = new Date();
  const expiresAt = calculateCreditExpirationDate(issuedAt);
  const idempotencyKey = generateOptionAIdempotencyKey(
    claim.id,
    claimItem.id,
    input.approvedQuantity
  );

  // 4. Atomic Database Insert via PostgreSQL RPC or Admin Transaction
  const metadata = {
    approvedQuantity: input.approvedQuantity,
    frozenUnitWholesalePrice: Number(claimItem.frozen_unit_wholesale_price),
    frozenOptionARate: Number(claimItem.frozen_credit_rate),
    claimNumber: claim.claim_number,
    notes: input.notes || null,
    issuedByRole: "admin",
  };

  // Call atomic RPC function
  const { data: rpcResult, error: rpcErr } = await supabase.rpc(
    "issue_exchange_credit_atomic",
    {
      p_issuance_source: "option_a_claim_approved",
      p_claim_id: claim.id,
      p_claim_item_id: claimItem.id,
      p_rma_id: null,
      p_inspection_id: null,
      p_company_id: claim.company_id,
      p_store_id: claim.store_id,
      p_amount_cents: calcResult.creditAmountCents,
      p_amount_dollars: calcResult.creditAmountDollars,
      p_issued_by: session.userId,
      p_idempotency_key: idempotencyKey,
      p_metadata: metadata,
      p_expires_at: expiresAt.toISOString(),
    }
  );

  if (rpcErr) {
    // If RPC does not exist yet (local fallback), handle safely
    if (rpcErr.code === "42883" || rpcErr.message?.includes("function") || rpcErr.message?.includes("does not exist")) {
      return {
        success: false,
        error: "Atomic stored procedure 'issue_exchange_credit_atomic' is pending migration execution by Owner.",
        errorCode: "RPC_NOT_AVAILABLE",
      };
    }
    return {
      success: false,
      error: `Credit issuance failed: ${rpcErr.message}`,
      errorCode: rpcErr.code || "DB_INSERT_FAILED",
    };
  }

  revalidatePath("/admin/retail-network/exchange-credit");
  revalidatePath("/admin/retail-network/exchange-credit/claims");

  return {
    success: true,
    credit: rpcResult as ExchangeCreditLedgerRecord,
  };
}

// -----------------------------------------------------------------------------
// 4. Option B (Return Products) Credit Issuance Server Action
// -----------------------------------------------------------------------------

/**
 * Issues store-level / company-scoped exchange credit for Option B (Return Products).
 *
 * Requirements:
 * - Feature gate ENABLE_EXCHANGE_CREDIT_ISSUANCE must be enabled.
 * - Admin session required.
 * - RMA physical warehouse inspection must be finalized (is_draft = false).
 * - Only resaleable accepted units are credited (100% frozen wholesale price).
 * - Rejected units, missing units, or draft inspections receive ZERO credit.
 * - Zero duplicate issuance per claim line item (unique constraint).
 * - Exact 90 calendar day expiration timestamp.
 */
export async function issueOptionBCreditAction(
  input: IssueOptionBCreditInput
): Promise<CreditIssuanceResult> {
  // Gate Check
  if (!checkExchangeCreditIssuanceEnabled()) {
    return {
      success: false,
      error: "Exchange Credit issuance is currently disabled (feature-gated for Phase 4 foundation).",
      errorCode: "FEATURE_GATED",
    };
  }

  // Admin Session Check
  const session = await verifyAdminSession();
  if (!session || !session.userId || session.role !== "admin") {
    return {
      success: false,
      error: "Unauthorized: Admin session required for credit issuance.",
      errorCode: "UNAUTHORIZED",
    };
  }

  // Schema Availability Check
  const isSchemaAvailable = await checkCreditLedgerSchemaAvailability();
  if (!isSchemaAvailable) {
    return {
      success: false,
      error: "Credit ledger schema is not yet applied to the database. Prepared migration pending execution.",
      errorCode: "SCHEMA_NOT_AVAILABLE",
    };
  }

  const supabase = createAdminClient();

  // 1. Fetch Warehouse Inspection Record
  const { data: inspection, error: inspErr } = await supabase
    .from("retailer_exchange_rma_inspections")
    .select(`
      id,
      rma_id,
      is_draft,
      total_accepted_resaleable,
      total_rejected,
      total_missing,
      inspected_at
    `)
    .eq("id", input.inspectionId)
    .maybeSingle();

  if (inspErr || !inspection) {
    return {
      success: false,
      error: `Inspection record not found: ${inspErr?.message || "Invalid inspection ID"}`,
      errorCode: "INSPECTION_NOT_FOUND",
    };
  }

  // Eligibility Rule A: Draft inspections cannot issue credit
  if (inspection.is_draft) {
    return {
      success: false,
      error: "Cannot issue credit from a draft inspection. Warehouse inspection must be fully finalized.",
      errorCode: "DRAFT_INSPECTION_REJECTED",
    };
  }

  // 2. Fetch Inspection Line Result
  const { data: inspectionLine, error: lineErr } = await supabase
    .from("retailer_exchange_rma_inspection_lines")
    .select(`
      id,
      inspection_id,
      rma_line_id,
      quantity_authorized,
      quantity_received,
      quantity_accepted_resaleable,
      quantity_rejected,
      quantity_missing
    `)
    .eq("inspection_id", input.inspectionId)
    .eq("rma_line_id", input.rmaLineId)
    .maybeSingle();

  if (lineErr || !inspectionLine) {
    return {
      success: false,
      error: `Inspection line not found: ${lineErr?.message || "Invalid RMA line ID"}`,
      errorCode: "INSPECTION_LINE_NOT_FOUND",
    };
  }

  // Eligibility Rule B: Resaleable units must be > 0
  if (inspectionLine.quantity_accepted_resaleable <= 0) {
    return {
      success: false,
      error: "Accepted resaleable quantity is zero. Rejected or missing units are strictly ineligible for credit.",
      errorCode: "NO_RESALEABLE_UNITS",
    };
  }

  // 3. Fetch RMA Line & Claim Item
  const { data: rmaLine, error: rmaLineErr } = await supabase
    .from("retailer_exchange_rma_lines")
    .select(`
      id,
      rma_id,
      claim_item_id,
      cohort_id,
      product_id,
      frozen_unit_wholesale_price,
      frozen_wholesale_price_cents
    `)
    .eq("id", input.rmaLineId)
    .maybeSingle();

  if (rmaLineErr || !rmaLine) {
    return {
      success: false,
      error: `RMA line not found: ${rmaLineErr?.message || "Invalid RMA line ID"}`,
      errorCode: "RMA_LINE_NOT_FOUND",
    };
  }

  // 4. Fetch RMA Header
  const { data: rma, error: rmaErr } = await supabase
    .from("retailer_exchange_rmas")
    .select("id, rma_number, claim_id, store_id, company_id, status")
    .eq("id", input.rmaId)
    .maybeSingle();

  if (rmaErr || !rma) {
    return {
      success: false,
      error: `RMA header not found: ${rmaErr?.message || "Invalid RMA ID"}`,
      errorCode: "RMA_NOT_FOUND",
    };
  }

  // Eligibility Rule C: RMA Status
  if (rma.status === "cancelled" || rma.status === "expired") {
    return {
      success: false,
      error: `Cannot issue credit for RMA in status "${rma.status}".`,
      errorCode: "INVALID_RMA_STATUS",
    };
  }

  // Eligibility Rule D: Prevent Duplicate Issuance
  const { data: existingCredit } = await supabase
    .from("retailer_exchange_credit_ledger")
    .select("id, credit_code, status, credit_amount")
    .eq("source_claim_item_id", rmaLine.claim_item_id)
    .maybeSingle();

  if (existingCredit) {
    return {
      success: false,
      error: `Credit has already been issued for this claim item (Credit Code: ${existingCredit.credit_code}). Duplicate issuance is prohibited.`,
      errorCode: "DUPLICATE_CREDIT_ISSUANCE",
    };
  }

  // 5. Compute Monetary Amount via Pure Safe Calculator (100% Rate)
  const calcResult = calculateOptionBCreditAmount({
    acceptedResaleableQuantity: inspectionLine.quantity_accepted_resaleable,
    frozenUnitWholesalePrice: Number(rmaLine.frozen_unit_wholesale_price),
    rejectedQuantity: inspectionLine.quantity_rejected,
    missingQuantity: inspectionLine.quantity_missing,
  });

  if (!calcResult.success) {
    return {
      success: false,
      error: calcResult.error || "Monetary calculation failed.",
      errorCode: calcResult.errorCode || "CALCULATION_FAILED",
    };
  }

  const issuedAt = new Date();
  const expiresAt = calculateCreditExpirationDate(issuedAt);
  const idempotencyKey = generateOptionBIdempotencyKey(
    rma.id,
    inspection.id,
    rmaLine.claim_item_id,
    inspectionLine.quantity_accepted_resaleable
  );

  const metadata = {
    acceptedResaleableQuantity: inspectionLine.quantity_accepted_resaleable,
    rejectedQuantity: inspectionLine.quantity_rejected,
    missingQuantity: inspectionLine.quantity_missing,
    frozenUnitWholesalePrice: Number(rmaLine.frozen_unit_wholesale_price),
    rmaNumber: rma.rma_number,
    inspectionId: inspection.id,
    notes: input.notes || null,
    issuedByRole: "admin",
  };

  // 6. Atomic Database Insert via PostgreSQL RPC
  const { data: rpcResult, error: rpcErr } = await supabase.rpc(
    "issue_exchange_credit_atomic",
    {
      p_issuance_source: "option_b_inspection_passed",
      p_claim_id: rma.claim_id,
      p_claim_item_id: rmaLine.claim_item_id,
      p_rma_id: rma.id,
      p_inspection_id: inspection.id,
      p_company_id: rma.company_id,
      p_store_id: rma.store_id,
      p_amount_cents: calcResult.creditAmountCents,
      p_amount_dollars: calcResult.creditAmountDollars,
      p_issued_by: session.userId,
      p_idempotency_key: idempotencyKey,
      p_metadata: metadata,
      p_expires_at: expiresAt.toISOString(),
    }
  );

  if (rpcErr) {
    if (rpcErr.code === "42883" || rpcErr.message?.includes("function") || rpcErr.message?.includes("does not exist")) {
      return {
        success: false,
        error: "Atomic stored procedure 'issue_exchange_credit_atomic' is pending migration execution by Owner.",
        errorCode: "RPC_NOT_AVAILABLE",
      };
    }
    return {
      success: false,
      error: `Credit issuance failed: ${rpcErr.message}`,
      errorCode: rpcErr.code || "DB_INSERT_FAILED",
    };
  }

  revalidatePath("/admin/retail-network/exchange-credit");
  revalidatePath("/admin/retail-network/exchange-credit/rma");

  return {
    success: true,
    credit: rpcResult as ExchangeCreditLedgerRecord,
  };
}

// -----------------------------------------------------------------------------
// 5. Read-Only Query: Company Credit Summary / Balance
// -----------------------------------------------------------------------------

/**
 * Retrieves the aggregated credit balance and expiration breakdown for a Company.
 * Enforces company boundary (Retailer can only view their own company; Admin can view any).
 */
export async function getCompanyCreditBalanceAction(
  companyId: string
): Promise<{ success: boolean; summary?: CompanyCreditSummary; error?: string; errorCode?: string }> {
  // Authorization boundary
  const authCheck = await verifyCompanyCreditAccess(companyId);
  if (!authCheck.success) {
    return {
      success: false,
      error: authCheck.error,
      errorCode: authCheck.errorCode,
    };
  }

  const isSchemaAvailable = await checkCreditLedgerSchemaAvailability();
  if (!isSchemaAvailable) {
    return {
      success: true,
      summary: {
        companyId,
        totalAvailableCreditsDollars: 0,
        totalAvailableCreditsCents: 0,
        activeCreditsCount: 0,
        expiringWithin30DaysCount: 0,
        expiringWithin30DaysDollars: 0,
        expiredCreditsCount: 0,
        expiredCreditsDollars: 0,
        redeemedCreditsDollars: 0,
        voidedCreditsDollars: 0,
        oldestActiveExpirationDate: null,
      },
    };
  }

  const supabase = createAdminClient();

  const { data: credits, error } = await supabase
    .from("retailer_exchange_credit_ledger")
    .select(`
      id,
      credit_amount,
      credit_amount_cents,
      remaining_balance,
      remaining_balance_cents,
      status,
      expires_at
    `)
    .eq("company_id", companyId);

  if (error) {
    return {
      success: false,
      error: `Failed to query credit balance: ${error.message}`,
      errorCode: "QUERY_FAILED",
    };
  }

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let totalAvailableCreditsCents = 0;
  let activeCreditsCount = 0;
  let expiringWithin30DaysCount = 0;
  let expiringWithin30DaysCents = 0;
  let expiredCreditsCount = 0;
  let expiredCreditsCents = 0;
  let redeemedCreditsCents = 0;
  let voidedCreditsCents = 0;
  let oldestActiveExpirationDate: string | null = null;

  for (const credit of credits || []) {
    const isExpired = isCreditExpired(credit.expires_at, now);
    const balanceCents = Number(credit.remaining_balance_cents) || dollarsToCents(Number(credit.remaining_balance));
    const amountCents = Number(credit.credit_amount_cents) || dollarsToCents(Number(credit.credit_amount));

    if (credit.status === "voided") {
      voidedCreditsCents += amountCents;
    } else if (credit.status === "redeemed") {
      redeemedCreditsCents += amountCents;
    } else if (credit.status === "expired" || (credit.status === "issued" && isExpired)) {
      expiredCreditsCount += 1;
      expiredCreditsCents += balanceCents;
    } else if (credit.status === "issued" && !isExpired && balanceCents > 0) {
      activeCreditsCount += 1;
      totalAvailableCreditsCents += balanceCents;

      const expiry = new Date(credit.expires_at);
      if (expiry <= thirtyDaysFromNow) {
        expiringWithin30DaysCount += 1;
        expiringWithin30DaysCents += balanceCents;
      }

      if (
        !oldestActiveExpirationDate ||
        expiry < new Date(oldestActiveExpirationDate)
      ) {
        oldestActiveExpirationDate = credit.expires_at;
      }
    }
  }

  return {
    success: true,
    summary: {
      companyId,
      totalAvailableCreditsDollars: centsToDollars(totalAvailableCreditsCents),
      totalAvailableCreditsCents,
      activeCreditsCount,
      expiringWithin30DaysCount,
      expiringWithin30DaysDollars: centsToDollars(expiringWithin30DaysCents),
      expiredCreditsCount,
      expiredCreditsDollars: centsToDollars(expiredCreditsCents),
      redeemedCreditsDollars: centsToDollars(redeemedCreditsCents),
      voidedCreditsDollars: centsToDollars(voidedCreditsCents),
      oldestActiveExpirationDate,
    },
  };
}

// -----------------------------------------------------------------------------
// 6. Read-Only Query: List Company Credits
// -----------------------------------------------------------------------------

/**
 * Lists credits belonging to a specific company with optional filters.
 */
export async function listCompanyCreditsAction(
  companyId: string,
  filter?: ListCreditsFilter
): Promise<{ success: boolean; credits?: ExchangeCreditLedgerRecord[]; error?: string; errorCode?: string }> {
  // Authorization boundary
  const authCheck = await verifyCompanyCreditAccess(companyId);
  if (!authCheck.success) {
    return {
      success: false,
      error: authCheck.error,
      errorCode: authCheck.errorCode,
    };
  }

  const isSchemaAvailable = await checkCreditLedgerSchemaAvailability();
  if (!isSchemaAvailable) {
    return {
      success: true,
      credits: [],
    };
  }

  const supabase = createAdminClient();
  let query = supabase
    .from("retailer_exchange_credit_ledger")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (filter?.status) {
    query = query.eq("status", filter.status);
  }
  if (filter?.issuanceSource) {
    query = query.eq("issuance_source", filter.issuanceSource);
  }
  if (filter?.limit) {
    query = query.limit(filter.limit);
  }
  if (filter?.offset) {
    query = query.range(filter.offset, filter.offset + (filter.limit || 20) - 1);
  }

  const { data, error } = await query;
  if (error) {
    return {
      success: false,
      error: `Failed to list company credits: ${error.message}`,
      errorCode: "QUERY_FAILED",
    };
  }

  // Map to camelCase domain models
  const mapped: ExchangeCreditLedgerRecord[] = (data || []).map((row: any) => ({
    id: row.id,
    creditCode: row.credit_code,
    companyId: row.company_id,
    storeId: row.store_id,
    issuanceSource: row.issuance_source,
    sourceClaimId: row.source_claim_id,
    sourceClaimItemId: row.source_claim_item_id,
    sourceRmaId: row.source_rma_id,
    sourceInspectionId: row.source_inspection_id,
    creditAmount: Number(row.credit_amount),
    creditAmountCents: Number(row.credit_amount_cents),
    remainingBalance: Number(row.remaining_balance),
    remainingBalanceCents: Number(row.remaining_balance_cents),
    currency: row.currency || "USD",
    status: row.status,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    issuedBy: row.issued_by,
    idempotencyKey: row.idempotency_key,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return {
    success: true,
    credits: mapped,
  };
}

// -----------------------------------------------------------------------------
// 7. Read-Only Query: Credit Detail with Transaction Audit Log
// -----------------------------------------------------------------------------

/**
 * Retrieves a single credit record with its immutable audit transaction history.
 */
export async function getCreditDetailAction(
  creditId: string
): Promise<{ success: boolean; detail?: CreditDetailView; error?: string; errorCode?: string }> {
  const isSchemaAvailable = await checkCreditLedgerSchemaAvailability();
  if (!isSchemaAvailable) {
    return {
      success: false,
      error: "Credit ledger schema is not yet applied to the database.",
      errorCode: "SCHEMA_NOT_AVAILABLE",
    };
  }

  const supabase = createAdminClient();

  const { data: row, error } = await supabase
    .from("retailer_exchange_credit_ledger")
    .select("*")
    .eq("id", creditId)
    .maybeSingle();

  if (error || !row) {
    return {
      success: false,
      error: `Credit not found: ${error?.message || "Invalid credit ID"}`,
      errorCode: "CREDIT_NOT_FOUND",
    };
  }

  // Authorization boundary: User must have access to row.company_id
  const authCheck = await verifyCompanyCreditAccess(row.company_id);
  if (!authCheck.success) {
    return {
      success: false,
      error: authCheck.error,
      errorCode: authCheck.errorCode,
    };
  }

  // Fetch audit transactions
  const { data: txRows } = await supabase
    .from("retailer_exchange_credit_transactions")
    .select("*")
    .eq("credit_id", creditId)
    .order("created_at", { ascending: true });

  const transactions: ExchangeCreditTransactionRecord[] = (txRows || []).map((tx: any) => ({
    id: tx.id,
    creditId: tx.credit_id,
    companyId: tx.company_id,
    transactionType: tx.transaction_type,
    amount: Number(tx.amount),
    amountCents: Number(tx.amount_cents),
    balanceBefore: Number(tx.balance_before),
    balanceBeforeCents: Number(tx.balance_before_cents),
    balanceAfter: Number(tx.balance_after),
    balanceAfterCents: Number(tx.balance_after_cents),
    referenceOrderId: tx.reference_order_id,
    referenceCheckoutSessionId: tx.reference_checkout_session_id,
    performedBy: tx.performed_by,
    idempotencyKey: tx.idempotency_key,
    notes: tx.notes,
    createdAt: tx.created_at,
  }));

  const credit: ExchangeCreditLedgerRecord = {
    id: row.id,
    creditCode: row.credit_code,
    companyId: row.company_id,
    storeId: row.store_id,
    issuanceSource: row.issuance_source,
    sourceClaimId: row.source_claim_id,
    sourceClaimItemId: row.source_claim_item_id,
    sourceRmaId: row.source_rma_id,
    sourceInspectionId: row.source_inspection_id,
    creditAmount: Number(row.credit_amount),
    creditAmountCents: Number(row.credit_amount_cents),
    remainingBalance: Number(row.remaining_balance),
    remainingBalanceCents: Number(row.remaining_balance_cents),
    currency: row.currency || "USD",
    status: row.status,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    issuedBy: row.issued_by,
    idempotencyKey: row.idempotency_key,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  return {
    success: true,
    detail: {
      credit,
      transactions,
    },
  };
}
