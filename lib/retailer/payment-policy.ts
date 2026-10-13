import {
  RetailerPaymentMethod,
  RetailerApprovedTerms,
  RetailerTermsStatus,
} from "./payment-types";
import {
  normalizeApprovedTerms,
  normalizeTermsStatus,
  formatApprovedTermsDisplay,
} from "./commercial-types";

export type PaymentFeeType = "percentage" | "fixed" | "waived";
export type PaymentFeeSource = "global_default" | "retailer_override" | "waived";

export interface ChannelPolicyCard {
  effectiveEnabled: boolean;
  globalEnabled: boolean;
  retailerAllowed: boolean;
  feeType: PaymentFeeType;
  feeRate: number; // e.g. 0.035 for 3.5%
  feeAmount: number; // 0 for percentage
  feeSource: PaymentFeeSource;
  providerKey: "stripe" | "manual";
  providerReady: boolean;
  disclosureLabel: string;
}

export interface ChannelPolicyAch {
  effectiveEnabled: boolean;
  globalEnabled: boolean;
  retailerAllowed: boolean;
  feeType: PaymentFeeType;
  feeRate: number; // 0 for fixed
  feeAmount: number; // e.g. 5.00 for $5.00
  feeSource: PaymentFeeSource;
  providerKey: "bank_transfer" | "plaid" | "manual";
  providerReady: boolean;
  disclosureLabel: string;
}

export interface ChannelPolicyTerms {
  effectiveEnabled: boolean;
  termsEnabled: boolean;
  termsStatus: RetailerTermsStatus;
  approvedTerms: RetailerApprovedTerms;
  termDays: number;
  creditLimit: number;
  pastDueBlockingEnabled: boolean;
  authoritativeArAvailable: boolean;
  openArBalance: number | null;
  availableCredit: number | null;
  disclosureLabel: string;
  termsDisplayLabel: string;
}

export interface EffectivePaymentPolicy {
  companyId: string;
  card: ChannelPolicyCard;
  ach: ChannelPolicyAch;
  terms: ChannelPolicyTerms;
  globalPolicy: {
    cardDefaultRate: number;
    achDefaultFixed: number;
    pastDueBlocksTerms: boolean;
  };
}

export interface CalculateProcessingFeeParams {
  paymentMethod: RetailerPaymentMethod;
  chargeBase: number; // Merchandise payable subtotal (after discounts/coupons)
  effectivePolicy: EffectivePaymentPolicy;
}

export interface ProcessingFeeCalculationResult {
  paymentMethod: RetailerPaymentMethod;
  chargeBase: number;
  feeType: PaymentFeeType;
  feeRate: number;
  feeAmount: number;
  feeSource: PaymentFeeSource;
  totalWithFee: number;
  disclosureLabel: string;
  estimatedFeeText: string;
}

export interface PaymentMethodSnapshot {
  payment_method: RetailerPaymentMethod;
  payment_method_type: RetailerPaymentMethod;
  fee_type: PaymentFeeType;
  fee_rate: number;
  fee_amount: number;
  fee_source: PaymentFeeSource;
  charge_base: number;
  policy_applied_at: string;
  terms_snapshot: {
    approved_terms: RetailerApprovedTerms;
    term_days: number;
    credit_limit: number;
  } | null;
  provider_key: string;
  provider_ready: boolean;
}

export interface OrderTotalSnapshot {
  merchandise_subtotal: number;
  discount_amount: number;
  processing_fee: number;
  shipping_amount: number;
  tax_amount: number;
  total_amount: number;
}

/**
 * Global default payment fee constants
 * Shared between Admin settings and Retailer Checkout
 */
export const GLOBAL_PAYMENT_POLICY_DEFAULTS = {
  cardGlobalEnabled: true,
  cardDefaultFeeRate: 0.035, // 3.5%
  achGlobalEnabled: true,
  achDefaultFeeAmount: 5.0, // $5.00
  pastDueBlocksTerms: true,
};

/**
 * Resolves term duration in calendar days from canonical terms
 */
export function getTermDaysFromApprovedTerms(val?: string | null): number {
  const canonical = normalizeApprovedTerms(val);
  switch (canonical) {
    case "net15":
      return 15;
    case "net30":
      return 30;
    case "net45":
      return 45;
    case "net60":
      return 60;
    case "prepaid":
    default:
      return 0;
  }
}

/**
 * Formats canonical terms for Checkout UI (e.g., "Invoice — Net 30")
 */
export function formatCheckoutTermsLabel(val?: string | null): string {
  const canonical = normalizeApprovedTerms(val);
  switch (canonical) {
    case "net15":
      return "Invoice — Net 15";
    case "net30":
      return "Invoice — Net 30";
    case "net45":
      return "Invoice — Net 45";
    case "net60":
      return "Invoice — Net 60";
    case "prepaid":
    default:
      return "Invoice Terms";
  }
}

/**
 * Shared Processing Fee Calculator

 * Phase 1 Rule:
 * Processing Fee Base = Final merchandise payable subtotal after quantity tier pricing and promotion / coupon discounts.
 */
export function calculateProcessingFee(
  params: CalculateProcessingFeeParams
): ProcessingFeeCalculationResult {
  const { paymentMethod, chargeBase, effectivePolicy } = params;
  const base = Math.max(0, Number(chargeBase) || 0);

  if (paymentMethod === "card") {
    const cardPolicy = effectivePolicy.card;
    let fee = 0;
    if (cardPolicy.feeType === "waived" || cardPolicy.feeRate === 0) {
      fee = 0;
    } else {
      fee = Number((base * cardPolicy.feeRate).toFixed(2));
    }

    const percentDisplay = (cardPolicy.feeRate * 100).toFixed(1).replace(/\.0$/, "");
    return {
      paymentMethod: "card",
      chargeBase: base,
      feeType: cardPolicy.feeType,
      feeRate: cardPolicy.feeRate,
      feeAmount: fee,
      feeSource: cardPolicy.feeSource,
      totalWithFee: Number((base + fee).toFixed(2)),
      disclosureLabel: cardPolicy.feeRate > 0 ? `${percentDisplay}% Processing Fee` : "No Processing Fee",
      estimatedFeeText: fee > 0 ? `+$${fee.toFixed(2)}` : "$0.00",
    };
  }

  if (paymentMethod === "ach") {
    const achPolicy = effectivePolicy.ach;
    let fee = 0;
    if (achPolicy.feeType === "waived" || achPolicy.feeAmount === 0) {
      fee = 0;
    } else {
      fee = Number(achPolicy.feeAmount.toFixed(2));
    }

    return {
      paymentMethod: "ach",
      chargeBase: base,
      feeType: achPolicy.feeType,
      feeRate: 0,
      feeAmount: fee,
      feeSource: achPolicy.feeSource,
      totalWithFee: Number((base + fee).toFixed(2)),
      disclosureLabel: fee > 0 ? `$${fee.toFixed(2)} Processing Fee` : "No Processing Fee",
      estimatedFeeText: fee > 0 ? `+$${fee.toFixed(2)}` : "$0.00",
    };
  }

  // Terms: Always 0 fee
  return {
    paymentMethod: "terms",
    chargeBase: base,
    feeType: "waived",
    feeRate: 0,
    feeAmount: 0,
    feeSource: "waived",
    totalWithFee: base,
    disclosureLabel: "No Processing Fee",
    estimatedFeeText: "$0.00",
  };
}
