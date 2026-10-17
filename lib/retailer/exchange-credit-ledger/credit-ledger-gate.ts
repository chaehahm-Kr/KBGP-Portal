/**
 * 90-Day Exchange Credit Pilot — Credit Issuance Feature Gate
 * Task ID: EXCHANGE-CREDIT-PH4-001
 * Location: lib/retailer/exchange-credit-ledger/credit-ledger-gate.ts
 *
 * Enforces server-side feature gating for financial credit issuance.
 * Default: DISABLED (false). Production: DISABLED (false).
 *
 * Security: Test overrides are strictly ignored when NODE_ENV === 'production'
 * to prevent any unauthorized bypass in live production environments.
 */

let testCreditIssuanceGateOverride: boolean | null = null;

/**
 * Checks whether live Exchange Credit issuance is enabled.
 * Production defaults to false unless explicitly enabled via environment variable.
 */
export function checkExchangeCreditIssuanceEnabled(): boolean {
  // In production, test overrides are strictly ignored to ensure absolute security and prevent bypass
  if (process.env.NODE_ENV !== "production" && testCreditIssuanceGateOverride !== null) {
    return testCreditIssuanceGateOverride;
  }
  return process.env.ENABLE_EXCHANGE_CREDIT_ISSUANCE === "true";
}

/**
 * Async version of feature gate check for Server Actions / API routes.
 */
export async function isExchangeCreditIssuanceEnabled(): Promise<boolean> {
  return checkExchangeCreditIssuanceEnabled();
}

/**
 * Test helper for isolated unit testing.
 * Strictly blocked in production environments to eliminate backdoor risks.
 */
export async function setExchangeCreditIssuanceGateForTesting(
  enabled: boolean | null
): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    // In production, do not allow any in-memory test overrides
    return;
  }
  testCreditIssuanceGateOverride = enabled;
}
