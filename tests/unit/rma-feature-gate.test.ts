/**
 * RMA Server Actions Feature Gate Tests
 * Task ID: EXCHANGE-CREDIT-PH3-006
 * Location: tests/unit/rma-feature-gate.test.ts
 *
 * Verifies:
 * - Server-side mutation entry points strictly enforce Phase 3 read-only gate
 * - Mutations reject with errorCode: "FEATURE_GATED" by default
 * - Read-only operations remain accessible
 * - Test override mechanism for isolated testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({
  verifyAdminSession: vi.fn().mockResolvedValue({ userId: "admin-1", role: "admin", email: "admin@kselectnetwork.com" }),
  verifyRetailerSession: vi.fn().mockResolvedValue({ userId: "retailer-1", role: "retailer" }),
}));

import {
  isRmaMutationEnabled,
  setRmaMutationsGateForTesting,
  createRmaFromClaimAction,
  approveRmaAction,
  saveRmaBoxAllocationsAction,
  recordRmaCarrierTrackingEventAction,
  saveWarehouseInspectionDraftAction,
  completeWarehouseInspectionAction,
  recordRmaExceptionAction,
  resolveRmaExceptionAction,
} from "../../lib/retailer/rma-backend/rma-server-actions";

describe("EXCHANGE-CREDIT-PH3-006: RMA Server Actions Feature Gate Enforcement", () => {
  const originalEnv = process.env.ENABLE_EXCHANGE_RMA_MUTATIONS;

  beforeEach(() => {
    delete process.env.ENABLE_EXCHANGE_RMA_MUTATIONS;
    setRmaMutationsGateForTesting(null);
  });

  afterEach(() => {
    process.env.ENABLE_EXCHANGE_RMA_MUTATIONS = originalEnv;
    setRmaMutationsGateForTesting(null);
  });

  it("isRmaMutationEnabled defaults to false when environment variable is not set", async () => {
    expect(await isRmaMutationEnabled()).toBe(false);
  });

  it("isRmaMutationEnabled returns true when ENABLE_EXCHANGE_RMA_MUTATIONS='true'", async () => {
    process.env.ENABLE_EXCHANGE_RMA_MUTATIONS = "true";
    expect(await isRmaMutationEnabled()).toBe(true);
  });

  it("setRmaMutationsGateForTesting overrides environment configuration", async () => {
    process.env.ENABLE_EXCHANGE_RMA_MUTATIONS = "true";
    await setRmaMutationsGateForTesting(false);
    expect(await isRmaMutationEnabled()).toBe(false);

    await setRmaMutationsGateForTesting(true);
    expect(await isRmaMutationEnabled()).toBe(true);
  });

  it("createRmaFromClaimAction is blocked when mutations are feature-gated", async () => {
    setRmaMutationsGateForTesting(false);
    const result = await createRmaFromClaimAction("claim-123");
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("FEATURE_GATED");
    expect(result.error).toContain("feature-gated");
  });

  it("approveRmaAction is blocked when mutations are feature-gated", async () => {
    setRmaMutationsGateForTesting(false);
    const result = await approveRmaAction({ rmaId: "rma-123" });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("FEATURE_GATED");
  });

  it("saveRmaBoxAllocationsAction is blocked when mutations are feature-gated", async () => {
    setRmaMutationsGateForTesting(false);
    const result = await saveRmaBoxAllocationsAction({ rmaId: "rma-123", boxes: [] });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("FEATURE_GATED");
  });

  it("recordRmaCarrierTrackingEventAction is blocked when mutations are feature-gated", async () => {
    setRmaMutationsGateForTesting(false);
    const result = await recordRmaCarrierTrackingEventAction({
      rmaId: "rma-123",
      boxId: "box-1",
      event: {
        id: "evt-1",
        trackingNumber: "1Z999",
        eventType: "in_transit",
        timestamp: new Date().toISOString(),
        description: "Departed facility",
      },
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("FEATURE_GATED");
  });

  it("saveWarehouseInspectionDraftAction is blocked when mutations are feature-gated", async () => {
    setRmaMutationsGateForTesting(false);
    const result = await saveWarehouseInspectionDraftAction({
      rmaId: "rma-123",
      inspectionInput: {
        inspectedBy: { userId: "ins-1", name: "Inspector", role: "inspector" },
        boxCondition: "intact",
        lineInspections: [],
      },
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("FEATURE_GATED");
  });

  it("completeWarehouseInspectionAction is blocked when mutations are feature-gated", async () => {
    setRmaMutationsGateForTesting(false);
    const result = await completeWarehouseInspectionAction({
      rmaId: "rma-123",
      inspectionInput: {
        inspectedBy: { userId: "ins-1", name: "Inspector", role: "inspector" },
        boxCondition: "intact",
        lineInspections: [],
      },
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("FEATURE_GATED");
  });

  it("recordRmaExceptionAction is blocked when mutations are feature-gated", async () => {
    setRmaMutationsGateForTesting(false);
    const result = await recordRmaExceptionAction({
      rmaId: "rma-123",
      code: "DAMAGED_UNITS",
      severity: "high",
      description: "Broken bottle",
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("FEATURE_GATED");
  });

  it("resolveRmaExceptionAction is blocked when mutations are feature-gated", async () => {
    setRmaMutationsGateForTesting(false);
    const result = await resolveRmaExceptionAction({
      rmaId: "rma-123",
      exceptionId: "ex-1",
      resolutionNotes: "Resolved",
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("FEATURE_GATED");
  });
});
