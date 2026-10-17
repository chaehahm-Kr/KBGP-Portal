/**
 * 90-Day Exchange Credit Pilot — Checkout Credit Feature Gate
 * Task ID: EXCHANGE-CREDIT-PH4-002
 * Location: lib/retailer/exchange-credit-checkout/credit-checkout-gate.ts
 *
 * Enforces server-side feature gating for Exchange Credit redemption at Checkout.
 * Default: DISABLED (false). Production: DISABLED (false).
 *
 * Security: Test overrides are strictly ignored when NODE_ENV === 'production'
 * to prevent any backdoor bypass in live production environments.
 */

let testCreditCheckoutGateOverride: boolean | null = null;

/**
 * Checks whether live Exchange Credit redemption at Checkout is enabled.
 * Production defaults to false unless explicitly enabled via environment variable.
 */
export function checkExchangeCreditCheckoutEnabled(): boolean {
  // In production, test overrides are strictly ignored to ensure absolute security and prevent bypass
  if (process.env.NODE_ENV !== "production" && testCreditCheckoutGateOverride !== null) {
    return testCreditCheckoutGateOverride;
  }
  return process.env.ENABLE_EXCHANGE_CREDIT_CHECKOUT === "true";
}

/**
 * Async version of feature gate check for Server Actions / API routes.
 */
export async function isExchangeCreditCheckoutEnabled(): Promise<boolean> {
  return checkExchangeCreditCheckoutEnabled();
}

/**
 * Test helper for isolated unit testing.
 * Strictly blocked in production environments to eliminate backdoor risks.
 */
export async function setExchangeCreditCheckoutGateForTesting(
  enabled: boolean | null
): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    // In production, do not allow any in-memory test overrides
    return;
  }
  testCreditCheckoutGateOverride = enabled;
}
