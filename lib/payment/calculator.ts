import { FeeCalculationParams, FeeCalculationResult, PaymentChannelId } from "./types";

/**
 * Calculate precise payment processing fee based on payment method and effective policy
 * Zero fee calculation for waived methods or terms, precise cents rounding.
 */
export function calculateProcessingFee(params: FeeCalculationParams): FeeCalculationResult {
  const { paymentMethod, chargeBase: rawBase, effectivePolicy } = params;
  const chargeBase = Math.max(0, Math.round(rawBase * 100) / 100);

  const method = paymentMethod.toLowerCase() as PaymentChannelId;

  if (method === "card") {
    const cardPolicy = effectivePolicy.card;
    if (cardPolicy.isWaived || cardPolicy.feeSource === "waived" || !cardPolicy.enabled) {
      return {
        paymentMethod: "card",
        chargeBase,
        feeAmount: 0,
        feeRate: 0,
        feeType: "percentage",
        feeSource: "waived",
        feeChargedTo: cardPolicy.feeChargedTo,
        totalWithFee: chargeBase,
        breakdownText: "Card processing fee waived ($0.00)",
      };
    }

    const feeRate = Number(cardPolicy.feeValue || 0);
    const feeAmount = Math.max(0, Math.round(chargeBase * (feeRate / 100) * 100) / 100);
    const totalWithFee =
      cardPolicy.feeChargedTo === "retailer"
        ? Math.round((chargeBase + feeAmount) * 100) / 100
        : chargeBase;

    return {
      paymentMethod: "card",
      chargeBase,
      feeAmount,
      feeRate,
      feeType: "percentage",
      feeSource: cardPolicy.feeSource,
      feeChargedTo: cardPolicy.feeChargedTo,
      totalWithFee,
      breakdownText: `Credit/Debit Card fee (${feeRate}%): $${feeAmount.toFixed(2)}`,
    };
  }

  if (method === "ach") {
    const achPolicy = effectivePolicy.ach;
    if (achPolicy.isWaived || achPolicy.feeSource === "waived" || !achPolicy.enabled) {
      return {
        paymentMethod: "ach",
        chargeBase,
        feeAmount: 0,
        feeRate: null,
        feeType: "fixed",
        feeSource: "waived",
        feeChargedTo: achPolicy.feeChargedTo,
        totalWithFee: chargeBase,
        breakdownText: "ACH direct transfer fee waived ($0.00)",
      };
    }

    const feeAmount = Math.max(0, Math.round(Number(achPolicy.feeValue || 0) * 100) / 100);
    const totalWithFee =
      achPolicy.feeChargedTo === "retailer"
        ? Math.round((chargeBase + feeAmount) * 100) / 100
        : chargeBase;

    return {
      paymentMethod: "ach",
      chargeBase,
      feeAmount,
      feeRate: null,
      feeType: "fixed",
      feeSource: achPolicy.feeSource,
      feeChargedTo: achPolicy.feeChargedTo,
      totalWithFee,
      breakdownText: `ACH direct transfer fee: $${feeAmount.toFixed(2)} fixed`,
    };
  }

  // Terms or Other
  return {
    paymentMethod: "terms",
    chargeBase,
    feeAmount: 0,
    feeRate: null,
    feeType: "none",
    feeSource: "none",
    feeChargedTo: "retailer",
    totalWithFee: chargeBase,
    breakdownText: "Approved Net Terms — $0.00 fee",
  };
}
