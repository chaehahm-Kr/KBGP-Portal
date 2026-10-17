/**
 * 90-Day Exchange Credit Pilot — Pure Monetary Calculator & Business Rules
 * Task ID: EXCHANGE-CREDIT-PH4-001
 * Location: lib/retailer/exchange-credit-ledger/credit-ledger-calculator.ts
 *
 * Implements strict integer-cents money arithmetic, 90-day calendar expiration,
 * Option A & B credit formulas, and deterministic idempotency hashing.
 * Pure logic only — zero DB side effects.
 */

import { CreditIssuanceSource } from "./credit-ledger-types";

export const CREDIT_EXPIRATION_DAYS = 90;
export const MIN_OPTION_A_RATE = 0.20;
export const MAX_OPTION_A_RATE = 0.50;
export const OPTION_B_FIXED_RATE = 1.00;

export interface OptionACalculationInput {
  approvedQuantity: number;
  frozenUnitWholesalePrice: number;
  frozenOptionARate: number;
}

export interface OptionBCalculationInput {
  acceptedResaleableQuantity: number;
  frozenUnitWholesalePrice: number;
  rejectedQuantity?: number;
  missingQuantity?: number;
}

export interface CalculationResult {
  success: boolean;
  creditAmountCents: number;
  creditAmountDollars: number;
  error?: string;
  errorCode?: string;
}

/**
 * Converts a floating-point dollar amount into exact integer cents with safe rounding.
 */
export function dollarsToCents(dollars: number): number {
  if (typeof dollars !== "number" || isNaN(dollars)) {
    throw new Error("Invalid dollar amount provided to dollarsToCents");
  }
  return Math.round(dollars * 100);
}

/**
 * Converts exact integer cents back to dollar number with 2 decimal places.
 */
export function centsToDollars(cents: number): number {
  if (!Number.isSafeInteger(cents)) {
    throw new Error("Invalid cents integer provided to centsToDollars");
  }
  return Math.round(cents) / 100;
}

/**
 * Formats cents into standard currency display string "$X.XX"
 */
export function formatCurrencyCents(cents: number): string {
  const dollars = centsToDollars(cents);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Calculates Option A (Keep Products) credit amount.
 *
 * Formula:
 * Approved Eligible Quantity × Frozen Wholesale Unit Price × Frozen Protection Rate (20% - 50%)
 */
export function calculateOptionACreditAmount(
  input: OptionACalculationInput
): CalculationResult {
  const { approvedQuantity, frozenUnitWholesalePrice, frozenOptionARate } = input;

  // Validation 1: Approved quantity
  if (
    !Number.isInteger(approvedQuantity) ||
    approvedQuantity <= 0
  ) {
    return {
      success: false,
      creditAmountCents: 0,
      creditAmountDollars: 0,
      errorCode: "INVALID_APPROVED_QUANTITY",
      error: `Approved quantity must be a positive integer. Received: ${approvedQuantity}`,
    };
  }

  // Validation 2: Frozen unit wholesale price
  if (
    typeof frozenUnitWholesalePrice !== "number" ||
    isNaN(frozenUnitWholesalePrice) ||
    frozenUnitWholesalePrice <= 0
  ) {
    return {
      success: false,
      creditAmountCents: 0,
      creditAmountDollars: 0,
      errorCode: "INVALID_WHOLESALE_PRICE",
      error: `Frozen unit wholesale price must be greater than zero. Received: ${frozenUnitWholesalePrice}`,
    };
  }

  // Validation 3: Frozen Option A credit rate (20% to 50%)
  if (
    typeof frozenOptionARate !== "number" ||
    isNaN(frozenOptionARate) ||
    frozenOptionARate < MIN_OPTION_A_RATE ||
    frozenOptionARate > MAX_OPTION_A_RATE
  ) {
    return {
      success: false,
      creditAmountCents: 0,
      creditAmountDollars: 0,
      errorCode: "INVALID_OPTION_A_RATE",
      error: `Option A credit rate must be between ${MIN_OPTION_A_RATE * 100}% and ${MAX_OPTION_A_RATE * 100}%. Received: ${frozenOptionARate}`,
    };
  }

  // Integer-cents arithmetic
  const priceInCents = Math.round(frozenUnitWholesalePrice * 100);
  const totalWholesaleCents = approvedQuantity * priceInCents;
  const creditAmountCents = Math.round(totalWholesaleCents * frozenOptionARate);

  if (!Number.isSafeInteger(creditAmountCents) || creditAmountCents <= 0) {
    return {
      success: false,
      creditAmountCents: 0,
      creditAmountDollars: 0,
      errorCode: "MONEY_OVERFLOW_OR_ZERO",
      error: "Option A calculation resulted in zero or non-safe integer credit cents.",
    };
  }

  const creditAmountDollars = centsToDollars(creditAmountCents);

  return {
    success: true,
    creditAmountCents,
    creditAmountDollars,
  };
}

/**
 * Calculates Option B (Return Products) credit amount.
 *
 * Formula:
 * Accepted Resaleable Quantity × Frozen Original Wholesale Unit Price (100% rate)
 *
 * Excludes:
 * - Rejected units (0%)
 * - Missing units (0%)
 * - Damaged / Expired units (0%)
 */
export function calculateOptionBCreditAmount(
  input: OptionBCalculationInput
): CalculationResult {
  const { acceptedResaleableQuantity, frozenUnitWholesalePrice } = input;

  // Validation 1: Accepted resaleable quantity
  if (
    !Number.isInteger(acceptedResaleableQuantity) ||
    acceptedResaleableQuantity <= 0
  ) {
    return {
      success: false,
      creditAmountCents: 0,
      creditAmountDollars: 0,
      errorCode: "NO_RESALEABLE_UNITS",
      error: `Accepted resaleable quantity must be a positive integer. Rejected, missing, or uninspected units are strictly ineligible for credit. Received: ${acceptedResaleableQuantity}`,
    };
  }

  // Validation 2: Frozen unit wholesale price
  if (
    typeof frozenUnitWholesalePrice !== "number" ||
    isNaN(frozenUnitWholesalePrice) ||
    frozenUnitWholesalePrice <= 0
  ) {
    return {
      success: false,
      creditAmountCents: 0,
      creditAmountDollars: 0,
      errorCode: "INVALID_WHOLESALE_PRICE",
      error: `Frozen unit wholesale price must be greater than zero. Received: ${frozenUnitWholesalePrice}`,
    };
  }

  // Integer-cents arithmetic (100% rate for accepted resaleable units)
  const priceInCents = Math.round(frozenUnitWholesalePrice * 100);
  const creditAmountCents = acceptedResaleableQuantity * priceInCents;

  if (!Number.isSafeInteger(creditAmountCents) || creditAmountCents <= 0) {
    return {
      success: false,
      creditAmountCents: 0,
      creditAmountDollars: 0,
      errorCode: "MONEY_OVERFLOW_OR_ZERO",
      error: "Option B calculation resulted in zero or non-safe integer credit cents.",
    };
  }

  const creditAmountDollars = centsToDollars(creditAmountCents);

  return {
    success: true,
    creditAmountCents,
    creditAmountDollars,
  };
}

/**
 * Authoritative 90 calendar day expiration calculation.
 * Preserves the exact timestamp + 90 calendar days (90 * 86,400,000 ms).
 * Strictly non-extendable across checkout retries, order cancellations, or refunds.
 */
export function calculateCreditExpirationDate(issuedAt: Date | string): Date {
  const base = typeof issuedAt === "string" ? new Date(issuedAt) : new Date(issuedAt.getTime());
  if (isNaN(base.getTime())) {
    throw new Error("Invalid issuedAt date provided to calculateCreditExpirationDate");
  }
  // Add exactly 90 calendar days
  const expiresAt = new Date(base.getTime() + CREDIT_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
  return expiresAt;
}

/**
 * Evaluates whether a given credit has expired based on current or reference timestamp.
 */
export function isCreditExpired(
  expiresAt: Date | string,
  referenceTime: Date | string = new Date()
): boolean {
  const expiry = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const ref = typeof referenceTime === "string" ? new Date(referenceTime) : referenceTime;
  return ref.getTime() >= expiry.getTime();
}

/**
 * Generates a deterministic idempotency key for Option A credit issuance.
 */
export function generateOptionAIdempotencyKey(
  claimId: string,
  claimItemId: string,
  approvedQuantity: number
): string {
  return `IDEMP-CREDIT-OPTA-${claimId.slice(0, 8)}-${claimItemId.slice(0, 8)}-QTY${approvedQuantity}`;
}

/**
 * Generates a deterministic idempotency key for Option B credit issuance.
 */
export function generateOptionBIdempotencyKey(
  rmaId: string,
  inspectionId: string,
  claimItemId: string,
  acceptedQuantity: number
): string {
  return `IDEMP-CREDIT-OPTB-${rmaId.slice(0, 8)}-${inspectionId.slice(0, 8)}-${claimItemId.slice(0, 8)}-QTY${acceptedQuantity}`;
}

/**
 * Formats a sequential credit code: CRD-YYYY-XXXXXX
 */
export function formatCreditCode(sequenceNumber: number, year: number = new Date().getFullYear()): string {
  return `CRD-${year}-${String(sequenceNumber).padStart(6, "0")}`;
}
