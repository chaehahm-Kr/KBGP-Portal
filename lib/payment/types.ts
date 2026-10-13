/**
 * Provider-Neutral Payment Foundation & Fee Policy Types
 * Authoritative module for global settings, retailer fee overrides, and effective fee resolution.
 */

export type PaymentChannelId = "card" | "ach" | "terms";

export type PaymentProviderId = "not_connected" | "stripe" | "custom";

export type FeeType = "percentage" | "fixed" | "none";

export type FeeChargedTo = "retailer" | "platform";

export type FeeSource = "global" | "retailer_override" | "waived" | "none";

/**
 * Global Payment Settings (stored in system_settings with key 'payment_settings')
 */
export interface GlobalPaymentSettings {
  provider: PaymentProviderId;
  provider_display_name: string;
  card_enabled: boolean;
  card_fee_type: FeeType;
  card_fee_rate: number; // e.g. 3.50 for 3.5%
  card_fee_charged_to: FeeChargedTo;
  card_fee_min: number | null;
  card_fee_max: number | null;
  ach_enabled: boolean;
  ach_fee_type: FeeType;
  ach_fee_amount: number; // e.g. 5.00 for $5.00 fixed
  ach_fee_charged_to: FeeChargedTo;
  past_due_blocks_terms: boolean;
  default_grace_period_days: number;
  updated_at?: string;
  updated_by?: string;
}

export const DEFAULT_GLOBAL_PAYMENT_SETTINGS: GlobalPaymentSettings = {
  provider: "not_connected",
  provider_display_name: "Not Connected",
  card_enabled: true,
  card_fee_type: "percentage",
  card_fee_rate: 3.5, // 3.5%
  card_fee_charged_to: "retailer",
  card_fee_min: null,
  card_fee_max: null,
  ach_enabled: true,
  ach_fee_type: "fixed",
  ach_fee_amount: 5.0, // $5.00 fixed
  ach_fee_charged_to: "retailer",
  past_due_blocks_terms: true,
  default_grace_period_days: 0,
};

/**
 * Retailer-Specific Fee Overrides (stored in retailer_profiles)
 */
export interface RetailerPaymentFeeOverride {
  cardFeeOverride: number | null; // e.g. 2.50 (%) or null if using global
  cardFeeWaived: boolean;
  achFeeOverride: number | null; // e.g. 3.00 ($) or null if using global
  achFeeWaived: boolean;
}

/**
 * Effective channel policy after resolving global settings vs retailer overrides
 */
export interface EffectiveChannelPolicy {
  channel: PaymentChannelId;
  enabled: boolean;
  disabledReason?: string;
  feeType: FeeType;
  feeValue: number; // Percentage (e.g. 3.5) or fixed dollars (e.g. 5.00)
  feeChargedTo: FeeChargedTo;
  feeSource: FeeSource;
  isWaived: boolean;
  isOverride: boolean;
  globalFeeValue: number;
  badge?: string;
  displayDescription: string;
}

/**
 * Resolved full payment policy for a specific retailer company
 */
export interface EffectivePaymentPolicy {
  companyId: string;
  provider: {
    id: PaymentProviderId;
    displayName: string;
    isConfigured: boolean;
  };
  card: EffectiveChannelPolicy;
  ach: EffectiveChannelPolicy;
  terms: EffectiveChannelPolicy & {
    approvedTerms: string;
    termsStatus: string;
    creditLimit: number;
    availableCredit: number;
    isApproved: boolean;
  };
  availableMethods: Array<{
    id: PaymentChannelId;
    label: string;
    description: string;
    badge: string;
    feeNote: string;
    feeType: FeeType;
    feeValue: number;
    isTerms?: boolean;
    providerConfigured: boolean;
  }>;
  resolvedAt: string;
}

/**
 * Fee calculation inputs
 */
export interface FeeCalculationParams {
  paymentMethod: PaymentChannelId | string;
  chargeBase: number; // In dollars (e.g. 125.50), after promos/tier discounts
  effectivePolicy: EffectivePaymentPolicy;
}

/**
 * Precise fee calculation output
 */
export interface FeeCalculationResult {
  paymentMethod: PaymentChannelId;
  chargeBase: number;
  feeAmount: number; // Rounded to 2 decimal places (dollars)
  feeRate: number | null; // Percentage rate if applicable
  feeType: FeeType;
  feeSource: FeeSource;
  feeChargedTo: FeeChargedTo;
  totalWithFee: number;
  breakdownText: string;
}

/**
 * Snapshot schema preserved on retailer_order_payments
 */
export interface PaymentFeeSnapshot {
  fee_amount: number;
  fee_rate: number | null;
  fee_type: FeeType;
  fee_source: FeeSource;
  charge_base: number;
  calculated_at: string;
}
