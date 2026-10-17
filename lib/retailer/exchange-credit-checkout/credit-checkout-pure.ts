/**
 * 90-Day Exchange Credit Pilot — Pure Checkout Credit Engine
 * Location: lib/retailer/exchange-credit-checkout/credit-checkout-pure.ts
 *
 * Implements strict integer-cents money arithmetic and authoritative business rules:
 * - One-time Full Redemption Policy (100% consumed, no partial redemption)
 * - Exclusion of Originating Protected SKU from eligible merchandise subtotal
 * - Exclusion of Shipping, Sales Taxes, and Processing Fees
 * - Non-Extendable 90-Calendar-Day Expiration Policy
 * - Pure logic with zero database side-effects
 */

import {
  CheckoutCartItem,
  CheckoutCreditItem,
  EvaluateCreditEligibilityInput,
  CreditEligibilityResult,
  CheckoutTotalsCalculationInput,
  CheckoutTotalsCalculationResult,
  CreditCheckoutRejectionCode,
  ReinstatementEligibilityInput,
  ReinstatementEligibilityResult
} from "./credit-checkout-types";

/**
 * Converts integer cents to dollar number with 2 decimal places.
 */
export function centsToDollars(cents: number): number {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Invalid cents integer: ${cents}`);
  }
  return Math.round(cents) / 100;
}

/**
 * Converts a floating-point dollar amount to exact integer cents with safe rounding.
 */
export function dollarsToCents(dollars: number): number {
  if (typeof dollars !== "number" || isNaN(dollars)) {
    throw new Error(`Invalid dollar amount: ${dollars}`);
  }
  return Math.round(dollars * 100);
}

/**
 * Evaluates whether a timestamp has expired relative to an injectable reference date.
 */
export function isCreditExpired(
  expiresAt: string,
  asOfDate: Date | string = new Date()
): boolean {
  const asOf = typeof asOfDate === "string" ? new Date(asOfDate) : asOfDate;
  const expiry = new Date(expiresAt);
  return expiry.getTime() <= asOf.getTime();
}

export interface MerchandiseBreakdown {
  subtotalCents: number;
  excludedSkuAmountCents: number;
  eligibleSubtotalCents: number;
  eligibleItems: CheckoutCartItem[];
  excludedItems: CheckoutCartItem[];
}

/**
 * Categorizes cart merchandise into eligible merchandise vs. excluded items.
 *
 * Rule:
 * The originating protected SKU (or product ID) that generated the credit
 * is strictly excluded from the eligible merchandise subtotal.
 */
export function calculateEligibleMerchandiseBreakdown(
  cartItems: CheckoutCartItem[],
  originatingSku?: string | null,
  originatingProductId?: string | null
): MerchandiseBreakdown {
  let subtotalCents = 0;
  let excludedSkuAmountCents = 0;
  let eligibleSubtotalCents = 0;
  const eligibleItems: CheckoutCartItem[] = [];
  const excludedItems: CheckoutCartItem[] = [];

  const normOrigSku = originatingSku?.trim().toUpperCase();
  const normOrigProdId = originatingProductId?.trim().toLowerCase();

  for (const item of cartItems) {
    if (item.unitPriceCents < 0 || item.quantity <= 0) {
      continue;
    }

    const itemTotalCents = item.unitPriceCents * item.quantity;
    subtotalCents += itemTotalCents;

    const itemSku = item.sku?.trim().toUpperCase();
    const itemProdId = item.productId?.trim().toLowerCase();

    const isExcluded =
      (normOrigSku && itemSku === normOrigSku) ||
      (normOrigProdId && itemProdId === normOrigProdId);

    if (isExcluded) {
      excludedSkuAmountCents += itemTotalCents;
      excludedItems.push(item);
    } else {
      eligibleSubtotalCents += itemTotalCents;
      eligibleItems.push(item);
    }
  }

  return {
    subtotalCents,
    excludedSkuAmountCents,
    eligibleSubtotalCents,
    eligibleItems,
    excludedItems
  };
}

/**
 * Resolves the originating SKU and Product ID from credit properties or metadata.
 */
export function extractOriginatingIdentifiers(credit: CheckoutCreditItem): {
  originatingSku: string | null;
  originatingProductId: string | null;
} {
  let originatingSku = credit.originatingSku || null;
  let originatingProductId = credit.originatingProductId || null;

  if (credit.metadata) {
    if (!originatingSku && typeof credit.metadata.originatingSku === "string") {
      originatingSku = credit.metadata.originatingSku;
    }
    if (!originatingSku && typeof credit.metadata.sku === "string") {
      originatingSku = credit.metadata.sku;
    }
    if (!originatingProductId && typeof credit.metadata.productId === "string") {
      originatingProductId = credit.metadata.productId;
    }
    if (!originatingProductId && typeof credit.metadata.originatingProductId === "string") {
      originatingProductId = credit.metadata.originatingProductId;
    }
  }

  return { originatingSku, originatingProductId };
}

/**
 * Pure Domain Rule: Evaluates whether an Exchange Credit can be applied to a cart.
 *
 * Enforces:
 * 1. Company Ownership
 * 2. Store-level Scope (if specified)
 * 3. USD Currency Consistency
 * 4. Expiration Window
 * 5. Lifecycle Status (must be 'issued')
 * 6. Originating Protected SKU Exclusion
 * 7. One-Time Full Redemption Feasibility (eligibleSubtotalCents >= creditAmountCents)
 */
export function evaluateCreditForCart(
  input: EvaluateCreditEligibilityInput
): CreditEligibilityResult {
  const { credit, companyId, storeId, cartItems, asOfDate } = input;

  const baseResult: Omit<CreditEligibilityResult, "eligible" | "fullRedemptionFeasible" | "appliedCreditAmountCents" | "remainingChargeCents"> = {
    creditId: credit.id,
    creditCode: credit.creditCode,
    subtotalCents: 0,
    excludedSkuAmountCents: 0,
    eligibleSubtotalCents: 0,
    creditAmountCents: credit.creditAmountCents
  };

  // 1. Company Ownership Check
  if (credit.companyId !== companyId) {
    return {
      ...baseResult,
      eligible: false,
      fullRedemptionFeasible: false,
      appliedCreditAmountCents: 0,
      remainingChargeCents: 0,
      rejectionCode: "COMPANY_MISMATCH",
      rejectionMessage: "This exchange credit belongs to another retailer company and cannot be applied."
    };
  }

  // 2. Store Scope Check (If credit is assigned to a specific store)
  if (credit.storeId && storeId && credit.storeId !== storeId) {
    return {
      ...baseResult,
      eligible: false,
      fullRedemptionFeasible: false,
      appliedCreditAmountCents: 0,
      remainingChargeCents: 0,
      rejectionCode: "STORE_UNAUTHORIZED",
      rejectionMessage: "This exchange credit is restricted to a different store location."
    };
  }

  // 3. Currency Consistency
  if (credit.currency !== "USD") {
    return {
      ...baseResult,
      eligible: false,
      fullRedemptionFeasible: false,
      appliedCreditAmountCents: 0,
      remainingChargeCents: 0,
      rejectionCode: "CURRENCY_MISMATCH",
      rejectionMessage: "Exchange credit currency must be USD."
    };
  }

  // 4. Positive Amount Check
  if (credit.creditAmountCents <= 0) {
    return {
      ...baseResult,
      eligible: false,
      fullRedemptionFeasible: false,
      appliedCreditAmountCents: 0,
      remainingChargeCents: 0,
      rejectionCode: "INVALID_CREDIT_AMOUNT",
      rejectionMessage: "Credit amount must be strictly greater than zero."
    };
  }

  // 5. Expiration Validation
  if (isCreditExpired(credit.expiresAt, asOfDate)) {
    return {
      ...baseResult,
      eligible: false,
      fullRedemptionFeasible: false,
      appliedCreditAmountCents: 0,
      remainingChargeCents: 0,
      rejectionCode: "CREDIT_EXPIRED",
      rejectionMessage: `Exchange credit expired on ${new Date(credit.expiresAt).toLocaleDateString("en-US")}. 90-day validity cannot be extended.`
    };
  }

  // 6. Lifecycle Status Check
  if (credit.status === "redeemed") {
    return {
      ...baseResult,
      eligible: false,
      fullRedemptionFeasible: false,
      appliedCreditAmountCents: 0,
      remainingChargeCents: 0,
      rejectionCode: "CREDIT_ALREADY_REDEEMED",
      rejectionMessage: "This exchange credit has already been redeemed in a previous order."
    };
  }

  if (credit.status === "reserved") {
    return {
      ...baseResult,
      eligible: false,
      fullRedemptionFeasible: false,
      appliedCreditAmountCents: 0,
      remainingChargeCents: 0,
      rejectionCode: "CREDIT_ALREADY_RESERVED",
      rejectionMessage: "This exchange credit is currently reserved in another active checkout session."
    };
  }

  if (credit.status !== "issued") {
    return {
      ...baseResult,
      eligible: false,
      fullRedemptionFeasible: false,
      appliedCreditAmountCents: 0,
      remainingChargeCents: 0,
      rejectionCode: "CREDIT_NOT_AVAILABLE",
      rejectionMessage: `Exchange credit is not available for use (Status: ${credit.status}).`
    };
  }

  // 7. Calculate Merchandise Eligibility & Excluded SKU
  const { originatingSku, originatingProductId } = extractOriginatingIdentifiers(credit);
  const breakdown = calculateEligibleMerchandiseBreakdown(
    cartItems,
    originatingSku,
    originatingProductId
  );

  baseResult.subtotalCents = breakdown.subtotalCents;
  baseResult.excludedSkuAmountCents = breakdown.excludedSkuAmountCents;
  baseResult.eligibleSubtotalCents = breakdown.eligibleSubtotalCents;

  // 8. Originating SKU Only Cart Check
  if (cartItems.length > 0 && breakdown.eligibleSubtotalCents === 0 && breakdown.excludedSkuAmountCents > 0) {
    return {
      ...baseResult,
      eligible: false,
      fullRedemptionFeasible: false,
      appliedCreditAmountCents: 0,
      remainingChargeCents: breakdown.subtotalCents,
      rejectionCode: "ORIGINATING_SKU_ONLY_CART",
      rejectionMessage: `Exchange credit cannot be applied because your cart only contains the originating protected SKU (${originatingSku || "exchanged product"}). Credit may only be applied to other eligible products.`
    };
  }

  // 9. Full Redemption Feasibility Check (eligibleSubtotalCents >= creditAmountCents)
  // "Credit must be redeemed ONCE and IN FULL. No partial redemption."
  if (breakdown.eligibleSubtotalCents < credit.creditAmountCents) {
    const diffCents = credit.creditAmountCents - breakdown.eligibleSubtotalCents;
    return {
      ...baseResult,
      eligible: false,
      fullRedemptionFeasible: false,
      appliedCreditAmountCents: 0,
      remainingChargeCents: breakdown.subtotalCents,
      rejectionCode: "INSUFFICIENT_ELIGIBLE_SUBTOTAL",
      rejectionMessage: `Eligible merchandise subtotal ($${(breakdown.eligibleSubtotalCents / 100).toFixed(2)}) is less than the credit value ($${(credit.creditAmountCents / 100).toFixed(2)}). Exchange credit requires 100% full redemption in a single order (Add at least $${(diffCents / 100).toFixed(2)} in eligible merchandise).`
    };
  }

  // All rules satisfied! Full credit amount applied.
  const appliedCreditAmountCents = credit.creditAmountCents;
  const remainingChargeCents = Math.max(0, breakdown.subtotalCents - appliedCreditAmountCents);

  return {
    ...baseResult,
    eligible: true,
    fullRedemptionFeasible: true,
    appliedCreditAmountCents,
    remainingChargeCents
  };
}

/**
 * Calculates complete checkout order totals with exchange credit applied.
 *
 * Formula:
 * - Subtotal = Merchandise Subtotal
 * - Excluded Sku Subtotal = Sum of items matching originating SKU
 * - Eligible Subtotal = Subtotal - Excluded Sku Subtotal
 * - Applied Credit = Full credit amount (if eligible) or 0
 * - Remaining Merchandise = Subtotal - Applied Credit
 * - Total Payable = Remaining Merchandise + Shipping + Tax + Processing Fee
 */
export function calculateCheckoutTotalsWithCredit(
  input: CheckoutTotalsCalculationInput
): CheckoutTotalsCalculationResult {
  const {
    cartItems,
    selectedCredit,
    companyId,
    storeId,
    shippingCents = 0,
    taxCents = 0,
    processingFeeCents = 0,
    asOfDate
  } = input;

  const rawSubtotalCents = cartItems.reduce(
    (sum, item) => sum + Math.max(0, item.unitPriceCents * item.quantity),
    0
  );

  let excludedSkuAmountCents = 0;
  let eligibleSubtotalCents = rawSubtotalCents;
  let appliedCreditAmountCents = 0;
  let isCreditApplied = false;
  let appliedCreditCode: string | null = null;
  let fullRedemptionMet = false;
  let rejectionCode: CreditCheckoutRejectionCode | undefined = undefined;
  let rejectionMessage: string | undefined = undefined;

  if (selectedCredit) {
    const evalResult = evaluateCreditForCart({
      credit: selectedCredit,
      companyId,
      storeId,
      cartItems,
      asOfDate
    });

    excludedSkuAmountCents = evalResult.excludedSkuAmountCents;
    eligibleSubtotalCents = evalResult.eligibleSubtotalCents;

    if (evalResult.eligible) {
      isCreditApplied = true;
      appliedCreditCode = selectedCredit.creditCode;
      appliedCreditAmountCents = selectedCredit.creditAmountCents;
      fullRedemptionMet = true;
    } else {
      rejectionCode = evalResult.rejectionCode;
      rejectionMessage = evalResult.rejectionMessage;
    }
  }

  const remainingMerchandiseCents = Math.max(0, rawSubtotalCents - appliedCreditAmountCents);
  const totalPayableCents =
    remainingMerchandiseCents +
    Math.max(0, shippingCents) +
    Math.max(0, taxCents) +
    Math.max(0, processingFeeCents);

  return {
    subtotalCents: rawSubtotalCents,
    subtotalDollars: centsToDollars(rawSubtotalCents),
    excludedSkuAmountCents,
    excludedSkuAmountDollars: centsToDollars(excludedSkuAmountCents),
    eligibleSubtotalCents,
    eligibleSubtotalDollars: centsToDollars(eligibleSubtotalCents),

    isCreditApplied,
    appliedCreditCode,
    appliedCreditAmountCents,
    appliedCreditAmountDollars: centsToDollars(appliedCreditAmountCents),
    remainingMerchandiseCents,
    remainingMerchandiseDollars: centsToDollars(remainingMerchandiseCents),
    fullRedemptionMet,

    shippingCents: Math.max(0, shippingCents),
    shippingDollars: centsToDollars(Math.max(0, shippingCents)),
    taxCents: Math.max(0, taxCents),
    taxDollars: centsToDollars(Math.max(0, taxCents)),
    processingFeeCents: Math.max(0, processingFeeCents),
    processingFeeDollars: centsToDollars(Math.max(0, processingFeeCents)),

    totalPayableCents,
    totalPayableDollars: centsToDollars(totalPayableCents),

    rejectionCode,
    rejectionMessage
  };
}

/**
 * Evaluates credit state restoration upon payment failure or cart abandonment.
 *
 * Rules:
 * - If original expiration timestamp has NOT passed: restores to 'issued'.
 * - If original expiration timestamp HAS passed: marks 'expired'.
 * - Expiration timestamp is NEVER extended or revived!
 */
export function determinePostPaymentFailureCreditState(
  credit: CheckoutCreditItem,
  asOfDate: Date | string = new Date()
): {
  restoredStatus: "issued" | "expired";
  expiresAt: string;
} {
  const expired = isCreditExpired(credit.expiresAt, asOfDate);
  return {
    restoredStatus: expired ? "expired" : "issued",
    expiresAt: credit.expiresAt // Original expiration strictly preserved!
  };
}

/**
 * Evaluates credit state restoration upon full order cancellation BEFORE shipment.
 *
 * Rules:
 * - If original expiration timestamp has NOT passed: restores to 'issued'.
 * - If original expiration timestamp HAS passed: marks 'expired'.
 * - Expiration timestamp is NEVER extended!
 */
export function determinePreShipmentCancellationCreditState(
  credit: CheckoutCreditItem,
  asOfDate: Date | string = new Date()
): {
  restoredStatus: "issued" | "expired";
  expiresAt: string;
} {
  const expired = isCreditExpired(credit.expiresAt, asOfDate);
  return {
    restoredStatus: expired ? "expired" : "issued",
    expiresAt: credit.expiresAt // Original expiration strictly preserved!
  };
}

/**
 * Pure Domain Rule: Evaluates whether a redeemed credit can be safely reinstated
 * upon order cancellation.
 *
 * Rules:
 * - Only 100% full cancellations qualify for automated reinstatement.
 * - Partial cancellations require manual review: "POLICY REVIEW REQUIRED"
 * - Post-shipment returns require manual review: "POLICY REVIEW REQUIRED"
 * - Original expiration date is NEVER extended. If 90-day window expired, restores as 'expired'.
 */
export function evaluateReinstatementEligibility(
  input: ReinstatementEligibilityInput
): ReinstatementEligibilityResult {
  if (!input.isFullCancellation) {
    return {
      eligible: false,
      requiresPolicyReview: true,
      reason: "POLICY REVIEW REQUIRED: Partial order cancellation cannot automatically reinstate exchange credit."
    };
  }

  if (input.orderStatus === "shipped" || input.orderStatus === "delivered") {
    return {
      eligible: false,
      requiresPolicyReview: true,
      reason: "POLICY REVIEW REQUIRED: Post-shipment returns cannot automatically reinstate exchange credit. Manual review required."
    };
  }

  const state = determinePreShipmentCancellationCreditState(input.credit, input.asOfDate);
  return {
    eligible: true,
    requiresPolicyReview: false,
    restoredStatus: state.restoredStatus
  };
}

