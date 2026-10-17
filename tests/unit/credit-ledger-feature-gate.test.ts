/**
 * Credit Ledger Feature Gate Tests
 * Task ID: EXCHANGE-CREDIT-PH4-001
 * Location: tests/unit/credit-ledger-feature-gate.test.ts
 *
 * Verifies:
 * - Feature gate defaults to disabled (false)
 * - Server actions strictly enforce feature gate (return errorCode: "FEATURE_GATED")
 * - Test override helper prevents bypass in production runtime (NODE_ENV=production)
 * - Test override functions as expected in non-production environments
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({
  verifyAdminSession: vi.fn().mockResolvedValue({
    userId: "admin-1",
    role: "admin",
    email: "admin@kselectnetwork.com",
  }),
  verifyRetailerSession: vi.fn().mockResolvedValue({
    userId: "retailer-1",
    role: "retailer",
  }),
}));

import {
  isExchangeCreditIssuanceEnabled,
  checkExchangeCreditIssuanceEnabled,
  setExchangeCreditIssuanceGateForTesting,
} from "../../lib/retailer/exchange-credit-ledger/credit-ledger-gate";
import {
  issueOptionACreditAction,
  issueOptionBCreditAction,
} from "../../lib/retailer/exchange-credit-ledger/credit-ledger-actions";

describe("EXCHANGE-CREDIT-PH4-001: Credit Ledger Feature Gate Enforcement", () => {
  const originalEnv = process.env.ENABLE_EXCHANGE_CREDIT_ISSUANCE;

  beforeEach(() => {
    delete process.env.ENABLE_EXCHANGE_CREDIT_ISSUANCE;
    setExchangeCreditIssuanceGateForTesting(null);
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ENABLE_EXCHANGE_CREDIT_ISSUANCE = originalEnv;
    } else {
      delete process.env.ENABLE_EXCHANGE_CREDIT_ISSUANCE;
    }
    setExchangeCreditIssuanceGateForTesting(null);
  });

  it("checkExchangeCreditIssuanceEnabled defaults to false when env is not set", () => {
    expect(checkExchangeCreditIssuanceEnabled()).toBe(false);
  });

  it("isExchangeCreditIssuanceEnabled async helper returns false by default", async () => {
    expect(await isExchangeCreditIssuanceEnabled()).toBe(false);
  });

  it("returns true when ENABLE_EXCHANGE_CREDIT_ISSUANCE='true'", () => {
    process.env.ENABLE_EXCHANGE_CREDIT_ISSUANCE = "true";
    expect(checkExchangeCreditIssuanceEnabled()).toBe(true);
  });

  it("returns false when ENABLE_EXCHANGE_CREDIT_ISSUANCE is invalid or false", () => {
    process.env.ENABLE_EXCHANGE_CREDIT_ISSUANCE = "false";
    expect(checkExchangeCreditIssuanceEnabled()).toBe(false);

    process.env.ENABLE_EXCHANGE_CREDIT_ISSUANCE = "1";
    expect(checkExchangeCreditIssuanceEnabled()).toBe(false);
  });

  it("prevents test helper bypass in production mode (NODE_ENV=production)", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = "production";
      delete process.env.ENABLE_EXCHANGE_CREDIT_ISSUANCE;

      // Attempt test override in production
      await setExchangeCreditIssuanceGateForTesting(true);

      // Must remain strictly false in production
      expect(checkExchangeCreditIssuanceEnabled()).toBe(false);
      expect(await isExchangeCreditIssuanceEnabled()).toBe(false);
    } finally {
      (process.env as any).NODE_ENV = originalNodeEnv;
      await setExchangeCreditIssuanceGateForTesting(null);
    }
  });

  it("allows test helper override in non-production environments", async () => {
    process.env.ENABLE_EXCHANGE_CREDIT_ISSUANCE = "true";
    await setExchangeCreditIssuanceGateForTesting(false);
    expect(checkExchangeCreditIssuanceEnabled()).toBe(false);

    process.env.ENABLE_EXCHANGE_CREDIT_ISSUANCE = "false";
    await setExchangeCreditIssuanceGateForTesting(true);
    expect(checkExchangeCreditIssuanceEnabled()).toBe(true);
  });

  it("issueOptionACreditAction is blocked when credit issuance is feature-gated", async () => {
    await setExchangeCreditIssuanceGateForTesting(false);
    const result = await issueOptionACreditAction({
      claimId: "claim-123",
      claimItemId: "item-123",
      approvedQuantity: 5,
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("FEATURE_GATED");
    expect(result.error).toContain("feature-gated");
  });

  it("issueOptionBCreditAction is blocked when credit issuance is feature-gated", async () => {
    await setExchangeCreditIssuanceGateForTesting(false);
    const result = await issueOptionBCreditAction({
      rmaId: "rma-123",
      inspectionId: "insp-123",
      rmaLineId: "line-123",
      claimItemId: "item-123",
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("FEATURE_GATED");
    expect(result.error).toContain("feature-gated");
  });
});
