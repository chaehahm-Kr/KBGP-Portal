import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeApprovedTerms,
  normalizeTermsStatus,
} from "./commercial-types";
import {
  EffectivePaymentPolicy,
  PaymentFeeSource,
  PaymentFeeType,
  GLOBAL_PAYMENT_POLICY_DEFAULTS,
  getTermDaysFromApprovedTerms,
  formatCheckoutTermsLabel,
} from "./payment-policy";
import { getRetailerARStatus } from "@/lib/finance/invoice-actions";

/**
 * Helper to parse any retailer-specific fee override from internal metadata or note
 */
function extractRetailerFeeOverrides(internalNote?: string | null): {
  cardFeeRate?: number;
  achFeeAmount?: number;
  cardWaived?: boolean;
  achWaived?: boolean;
} {
  if (!internalNote) return {};
  const overrides: {
    cardFeeRate?: number;
    achFeeAmount?: number;
    cardWaived?: boolean;
    achWaived?: boolean;
  } = {};

  if (internalNote.includes("CARD_FEE_WAIVED")) {
    overrides.cardWaived = true;
    overrides.cardFeeRate = 0;
  } else {
    const cardMatch = internalNote.match(/CARD_FEE_RATE\s*[:=]\s*([0-9.]+)/i);
    if (cardMatch) {
      const parsed = parseFloat(cardMatch[1]);
      if (!isNaN(parsed) && parsed >= 0) {
        overrides.cardFeeRate = parsed > 1 ? parsed / 100 : parsed;
      }
    }
  }

  if (internalNote.includes("ACH_FEE_WAIVED")) {
    overrides.achWaived = true;
    overrides.achFeeAmount = 0;
  } else {
    const achMatch = internalNote.match(/ACH_FEE\s*[:=]\s*([0-9.]+)/i);
    if (achMatch) {
      const parsed = parseFloat(achMatch[1]);
      if (!isNaN(parsed) && parsed >= 0) {
        overrides.achFeeAmount = parsed;
      }
    }
  }

  return overrides;
}

/**
 * Authoritative Server-side Payment Policy Resolver
 * Consumes company profile, commercial terms, and global defaults.
 * Does NOT hardcode fees inside components.
 */
export async function resolveEffectivePaymentPolicy(
  companyId: string
): Promise<EffectivePaymentPolicy> {
  const adminClient = createAdminClient();

  // 0. Load Global Payment Settings from system_settings if available
  let globalCardEnabled = GLOBAL_PAYMENT_POLICY_DEFAULTS.cardGlobalEnabled;
  let cardDefaultRate = GLOBAL_PAYMENT_POLICY_DEFAULTS.cardDefaultFeeRate;
  let globalAchEnabled = GLOBAL_PAYMENT_POLICY_DEFAULTS.achGlobalEnabled;
  let achDefaultFixed = GLOBAL_PAYMENT_POLICY_DEFAULTS.achDefaultFeeAmount;
  let pastDueBlocksTerms = GLOBAL_PAYMENT_POLICY_DEFAULTS.pastDueBlocksTerms;

  try {
    const { data: sysRow } = await adminClient
      .from("system_settings")
      .select("value")
      .eq("key", "payment_settings")
      .maybeSingle();

    if (sysRow?.value) {
      const v = sysRow.value as any;
      if (typeof v.card_enabled === "boolean") globalCardEnabled = v.card_enabled;
      if (typeof v.card_fee_rate === "number") cardDefaultRate = v.card_fee_rate / 100;
      if (typeof v.ach_enabled === "boolean") globalAchEnabled = v.ach_enabled;
      if (typeof v.ach_fee_amount === "number") achDefaultFixed = v.ach_fee_amount;
      if (typeof v.past_due_blocks_terms === "boolean") pastDueBlocksTerms = v.past_due_blocks_terms;
    }
  } catch (sysErr) {
    console.warn("Could not read system_settings payment_settings, using defaults:", sysErr);
  }

  // 1. Fetch retailer profile (try with override columns, fallback to baseline)
  let profile: any = null;
  const { data: fullProfile, error: fullProfileErr } = await adminClient
    .from("retailer_profiles")
    .select(`
      company_id,
      status,
      payment_method_card_enabled,
      payment_method_ach_enabled,
      terms_enabled,
      approved_terms,
      terms_status,
      credit_limit,
      internal_note,
      card_fee_override,
      card_fee_waived,
      ach_fee_override,
      ach_fee_waived
    `)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!fullProfileErr && fullProfile) {
    profile = fullProfile;
  } else {
    const { data: baseProfile } = await adminClient
      .from("retailer_profiles")
      .select(`
        company_id,
        status,
        payment_method_card_enabled,
        payment_method_ach_enabled,
        terms_enabled,
        approved_terms,
        terms_status,
        credit_limit,
        internal_note
      `)
      .eq("company_id", companyId)
      .maybeSingle();
    profile = baseProfile;
  }

  const isRetailerActive = profile?.status === "active";
  const retailerCardAllowed = profile?.payment_method_card_enabled ?? true;
  const retailerAchAllowed = profile?.payment_method_ach_enabled ?? true;
  const termsEnabled = profile?.terms_enabled ?? false;
  const approvedTerms = normalizeApprovedTerms(profile?.approved_terms);
  const termsStatus = normalizeTermsStatus(profile?.terms_status);
  const creditLimit = Math.max(0, Number(profile?.credit_limit || 0));

  // 2. Check Retailer Fee Overrides (Column overrides take priority over note overrides)
  const noteOverrides = extractRetailerFeeOverrides(profile?.internal_note);
  const hasColumnOverrides =
    profile &&
    ("card_fee_override" in profile ||
      "card_fee_waived" in profile ||
      "ach_fee_override" in profile ||
      "ach_fee_waived" in profile);

  const overrides: {
    cardFeeRate?: number;
    achFeeAmount?: number;
    cardWaived?: boolean;
    achWaived?: boolean;
  } = { ...noteOverrides };

  if (hasColumnOverrides) {
    if (profile.card_fee_waived) {
      overrides.cardWaived = true;
      overrides.cardFeeRate = 0;
    } else if (profile.card_fee_override !== null && profile.card_fee_override !== undefined) {
      overrides.cardFeeRate = Number(profile.card_fee_override) / 100;
      overrides.cardWaived = false;
    }

    if (profile.ach_fee_waived) {
      overrides.achWaived = true;
      overrides.achFeeAmount = 0;
    } else if (profile.ach_fee_override !== null && profile.ach_fee_override !== undefined) {
      overrides.achFeeAmount = Number(profile.ach_fee_override);
      overrides.achWaived = false;
    }
  }

  // 3. Resolve Card Policy
  const cardEffectiveEnabled = globalCardEnabled && retailerCardAllowed && isRetailerActive;

  let cardFeeRate = cardDefaultRate;
  let cardFeeSource: PaymentFeeSource = "global_default";
  let cardFeeType: PaymentFeeType = "percentage";

  if (overrides.cardWaived) {
    cardFeeRate = 0;
    cardFeeSource = "waived";
    cardFeeType = "waived";
  } else if (overrides.cardFeeRate !== undefined) {
    cardFeeRate = overrides.cardFeeRate;
    cardFeeSource = "retailer_override";
    cardFeeType = cardFeeRate === 0 ? "waived" : "percentage";
  }

  const cardPercentStr = (cardFeeRate * 100).toFixed(1).replace(/\.0$/, "");
  const cardDisclosure = cardFeeRate > 0 ? `${cardPercentStr}% Processing Fee` : "No Processing Fee";

  // 4. Resolve ACH Policy
  const achEffectiveEnabled = globalAchEnabled && retailerAchAllowed && isRetailerActive;

  let achFeeAmount = achDefaultFixed;
  let achFeeSource: PaymentFeeSource = "global_default";
  let achFeeType: PaymentFeeType = "fixed";

  if (overrides.achWaived) {
    achFeeAmount = 0;
    achFeeSource = "waived";
    achFeeType = "waived";
  } else if (overrides.achFeeAmount !== undefined) {
    achFeeAmount = overrides.achFeeAmount;
    achFeeSource = "retailer_override";
    achFeeType = achFeeAmount === 0 ? "waived" : "fixed";
  }

  const achDisclosure = achFeeAmount > 0 ? `$${achFeeAmount.toFixed(2)} Processing Fee` : "No Processing Fee";

  // 5. Resolve Terms Policy
  const isValidNetTerms = approvedTerms !== "prepaid";
  // Auto-sync: If terms are approved by Admin and valid, terms are effectively enabled for active retailers
  const termsEffectiveEnabled =
    termsStatus === "approved" && isValidNetTerms && isRetailerActive;
  const termDays = getTermDaysFromApprovedTerms(approvedTerms);
  const termsDisplayLabel = formatCheckoutTermsLabel(approvedTerms);

  // Authoritative AR Resolver integration (ADM-INV-AR-001 / 0162)
  let authoritativeArAvailable = true;
  let openArBalance = 0;
  let availableCredit = creditLimit;
  let unbilledReservation = 0;
  let totalExposure = 0;
  let overLimitAmount = 0;
  let reservedOrdersCount = 0;
  let hasPastDue = false;
  let pastDueAmount = 0;
  let isBlockedByPastDue = false;

  try {
    const arStatus = await getRetailerARStatus(companyId);
    openArBalance = arStatus.openAR;
    availableCredit = arStatus.availableCredit;
    unbilledReservation = arStatus.unbilledReservation ?? 0;
    totalExposure = arStatus.totalExposure ?? arStatus.openAR;
    overLimitAmount = arStatus.overLimitAmount ?? 0;
    reservedOrdersCount = arStatus.reservedOrdersCount ?? 0;
    hasPastDue = arStatus.hasPastDue;
    pastDueAmount = arStatus.pastDueAmount;
    if (pastDueBlocksTerms && hasPastDue) {
      isBlockedByPastDue = true;
    }
  } catch (arErr) {
    console.warn("Could not resolve live AR status for company:", companyId, arErr);
    authoritativeArAvailable = false;
  }

  return {
    companyId,
    card: {
      effectiveEnabled: cardEffectiveEnabled,
      globalEnabled: globalCardEnabled,
      retailerAllowed: retailerCardAllowed,
      feeType: cardFeeType,
      feeRate: cardFeeRate,
      feeAmount: 0,
      feeSource: cardFeeSource,
      providerKey: "stripe",
      providerReady: false,
      disclosureLabel: cardDisclosure,
    },
    ach: {
      effectiveEnabled: achEffectiveEnabled,
      globalEnabled: globalAchEnabled,
      retailerAllowed: retailerAchAllowed,
      feeType: achFeeType,
      feeRate: 0,
      feeAmount: achFeeAmount,
      feeSource: achFeeSource,
      providerKey: "bank_transfer",
      providerReady: false,
      disclosureLabel: achDisclosure,
    },
    terms: {
      effectiveEnabled: termsEffectiveEnabled,
      termsEnabled: termsEffectiveEnabled || termsEnabled,
      termsStatus,
      approvedTerms,
      termDays,
      creditLimit,
      pastDueBlockingEnabled: pastDueBlocksTerms,
      authoritativeArAvailable,
      openArBalance,
      unbilledReservation,
      totalExposure,
      availableCredit,
      overLimitAmount,
      reservedOrdersCount,
      hasPastDue,
      pastDueAmount,
      isBlockedByPastDue,
      disclosureLabel: "No Processing Fee",
      termsDisplayLabel,
    },
    globalPolicy: {
      cardDefaultRate,
      achDefaultFixed,
      pastDueBlocksTerms,
    },
  };
}
