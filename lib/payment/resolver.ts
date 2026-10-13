import { createAdminClient } from "@/lib/supabase/admin";
import { getGlobalPaymentSettings } from "./settings";
import {
  EffectivePaymentPolicy,
  PaymentChannelId,
} from "./types";

/**
 * Authoritative Effective Payment Policy Resolver
 * Merges Global Payment Settings with Retailer Company-Specific Overrides
 */
export async function resolveEffectivePaymentPolicy(
  companyId: string
): Promise<EffectivePaymentPolicy> {
  const globalSettings = await getGlobalPaymentSettings();
  const adminClient = createAdminClient();

  // Defensive query: select with override columns, fall back to basic if migration pending
  let profile: any = null;
  const { data: fullProfile, error: fullErr } = await adminClient
    .from("retailer_profiles")
    .select(`
      payment_method_card_enabled,
      payment_method_ach_enabled,
      terms_enabled,
      approved_terms,
      terms_status,
      credit_limit,
      card_fee_override,
      card_fee_waived,
      ach_fee_override,
      ach_fee_waived
    `)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!fullErr && fullProfile) {
    profile = fullProfile;
  } else {
    // Fallback if override columns are not yet in the DB schema cache
    const { data: basicProfile } = await adminClient
      .from("retailer_profiles")
      .select(`
        payment_method_card_enabled,
        payment_method_ach_enabled,
        terms_enabled,
        approved_terms,
        terms_status,
        credit_limit
      `)
      .eq("company_id", companyId)
      .maybeSingle();
    profile = basicProfile;
  }

  const isCardProviderConfigured = globalSettings.provider !== "not_connected";
  const isAchProviderConfigured = globalSettings.provider !== "not_connected";

  // 1. Resolve Card Channel
  const retailerCardEnabled = profile?.payment_method_card_enabled ?? true;
  const effectiveCardEnabled = Boolean(globalSettings.card_enabled && retailerCardEnabled);
  const cardWaived = Boolean(profile?.card_fee_waived);
  const cardOverrideValue =
    profile?.card_fee_override !== null && profile?.card_fee_override !== undefined
      ? Number(profile.card_fee_override)
      : null;
  const isCardOverride = !cardWaived && cardOverrideValue !== null;
  const cardFeeValue = cardWaived
    ? 0
    : isCardOverride
    ? cardOverrideValue!
    : Number(globalSettings.card_fee_rate);
  const cardFeeSource = cardWaived
    ? "waived"
    : isCardOverride
    ? "retailer_override"
    : "global";

  // 2. Resolve ACH Channel
  const retailerAchEnabled = profile?.payment_method_ach_enabled ?? true;
  const effectiveAchEnabled = Boolean(globalSettings.ach_enabled && retailerAchEnabled);
  const achWaived = Boolean(profile?.ach_fee_waived);
  const achOverrideValue =
    profile?.ach_fee_override !== null && profile?.ach_fee_override !== undefined
      ? Number(profile.ach_fee_override)
      : null;
  const isAchOverride = !achWaived && achOverrideValue !== null;
  const achFeeValue = achWaived
    ? 0
    : isAchOverride
    ? achOverrideValue!
    : Number(globalSettings.ach_fee_amount);
  const achFeeSource = achWaived
    ? "waived"
    : isAchOverride
    ? "retailer_override"
    : "global";

  // 3. Resolve Terms Channel
  const termsEnabled = Boolean(profile?.terms_enabled ?? false);
  const approvedTerms = (profile?.approved_terms || "prepaid") as string;
  const termsStatus = (profile?.terms_status || "pending") as string;
  const creditLimit = Number(profile?.credit_limit || 0);
  const isTermsApproved = Boolean(
    termsEnabled && termsStatus === "approved" && approvedTerms !== "prepaid"
  );

  const availableMethods: EffectivePaymentPolicy["availableMethods"] = [];

  // Card Option
  if (effectiveCardEnabled) {
    let feeNote = "";
    if (cardWaived) {
      feeNote = "Fee Waived ($0.00)";
    } else if (isCardOverride) {
      feeNote = `${cardFeeValue}% Processing Fee (Special Retailer Rate)`;
    } else {
      feeNote = `${cardFeeValue}% Processing Fee`;
    }

    availableMethods.push({
      id: "card",
      label: "Credit / Debit Card",
      description: isCardProviderConfigured
        ? "Pay securely via corporate credit/debit card."
        : "Online card gateway setup pending — order placed as Unpaid for manual invoice / card settlement.",
      badge: isCardProviderConfigured ? "Prepaid" : "Setup Pending",
      feeNote,
      feeType: "percentage",
      feeValue: cardFeeValue,
      providerConfigured: isCardProviderConfigured,
    });
  }

  // ACH Option
  if (effectiveAchEnabled) {
    let feeNote = "";
    if (achWaived) {
      feeNote = "Fee Waived ($0.00)";
    } else if (isAchOverride) {
      feeNote = `$${achFeeValue.toFixed(2)} Processing Fee (Special Retailer Rate)`;
    } else {
      feeNote = `$${achFeeValue.toFixed(2)} Processing Fee`;
    }

    availableMethods.push({
      id: "ach",
      label: "ACH Direct Bank Transfer",
      description: isAchProviderConfigured
        ? "Direct bank debit / ACH invoice settlement."
        : "Online direct debit setup pending — order placed as Unpaid for bank transfer / invoice settlement.",
      badge: isAchProviderConfigured ? "Prepaid" : "Setup Pending",
      feeNote,
      feeType: "fixed",
      feeValue: achFeeValue,
      providerConfigured: isAchProviderConfigured,
    });
  }

  // Net Terms Option
  if (isTermsApproved) {
    const termsDisplayMap: Record<string, string> = {
      net15: "Net 15 Days",
      net30: "Net 30 Days",
      net45: "Net 45 Days",
      net60: "Net 60 Days",
    };
    const termsLabel = termsDisplayMap[approvedTerms] || approvedTerms.toUpperCase();
    const days = approvedTerms.replace("net", "");

    availableMethods.push({
      id: "terms",
      label: `${termsLabel} Terms`,
      description: `Approved B2B trade credit. Estimated due date: Order Date + ${days} Days.`,
      badge: "Approved Terms",
      feeNote: "$0.00 Fee",
      feeType: "none",
      feeValue: 0,
      isTerms: true,
      providerConfigured: true,
    });
  }

  return {
    companyId,
    provider: {
      id: globalSettings.provider,
      displayName: globalSettings.provider_display_name || "Not Connected",
      isConfigured: globalSettings.provider !== "not_connected",
    },
    card: {
      channel: "card",
      enabled: effectiveCardEnabled,
      disabledReason: !globalSettings.card_enabled
        ? "Card channel globally disabled by Admin"
        : !retailerCardEnabled
        ? "Card channel disabled for this retailer"
        : undefined,
      feeType: "percentage",
      feeValue: cardFeeValue,
      feeChargedTo: globalSettings.card_fee_charged_to,
      feeSource: cardFeeSource,
      isWaived: cardWaived,
      isOverride: isCardOverride,
      globalFeeValue: Number(globalSettings.card_fee_rate),
      badge: cardWaived ? "Waived" : isCardOverride ? "Override" : "Standard",
      displayDescription: cardWaived
        ? "Fee Waived ($0.00)"
        : `${cardFeeValue}% of merchandise total`,
    },
    ach: {
      channel: "ach",
      enabled: effectiveAchEnabled,
      disabledReason: !globalSettings.ach_enabled
        ? "ACH channel globally disabled by Admin"
        : !retailerAchEnabled
        ? "ACH channel disabled for this retailer"
        : undefined,
      feeType: "fixed",
      feeValue: achFeeValue,
      feeChargedTo: globalSettings.ach_fee_charged_to,
      feeSource: achFeeSource,
      isWaived: achWaived,
      isOverride: isAchOverride,
      globalFeeValue: Number(globalSettings.ach_fee_amount),
      badge: achWaived ? "Waived" : isAchOverride ? "Override" : "Standard",
      displayDescription: achWaived
        ? "Fee Waived ($0.00)"
        : `$${achFeeValue.toFixed(2)} fixed per transaction`,
    },
    terms: {
      channel: "terms",
      enabled: isTermsApproved,
      disabledReason: !termsEnabled
        ? "Net terms not enabled for this retailer"
        : termsStatus !== "approved"
        ? `Terms status is ${termsStatus}`
        : approvedTerms === "prepaid"
        ? "Account terms is Prepaid"
        : undefined,
      feeType: "none",
      feeValue: 0,
      feeChargedTo: "retailer",
      feeSource: "none",
      isWaived: true,
      isOverride: false,
      globalFeeValue: 0,
      displayDescription: "$0.00 (Trade credit)",
      approvedTerms,
      termsStatus,
      creditLimit,
      availableCredit: creditLimit,
      isApproved: isTermsApproved,
    },
    availableMethods,
    resolvedAt: new Date().toISOString(),
  };
}
