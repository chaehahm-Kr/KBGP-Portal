/**
 * Credit Ledger Server Actions & Authorization In-Memory Mock Tests
 * Task ID: EXCHANGE-CREDIT-PH4-001
 * Location: tests/unit/exchange-credit-ledger-actions.test.ts
 *
 * Verifies:
 * - Unapproved claims rejected with UNAPPROVED_CLAIM
 * - Draft warehouse inspections rejected with DRAFT_INSPECTION_REJECTED
 * - Zero resaleable units rejected with NO_RESALEABLE_UNITS
 * - Duplicate issuance per claim item rejected with DUPLICATE_CREDIT_ISSUANCE
 * - Cross-company unauthorized access rejected with FORBIDDEN
 * - Clean schema availability fallback when migration is not applied
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

let mockUser: any = { id: "admin-1", email: "admin@kselectnetwork.com" };
let mockProfileRole: string = "admin";
let mockCompanyUser: any = { id: "cu-1", company_id: "comp-1", status: "active" };

// Mock Supabase clients
const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockUser },
        error: mockUser ? null : { message: "No active user" },
      }),
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: mockProfileRole },
            error: null,
          }),
        };
      }
      if (table === "company_users") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((col: string, val: string) => {
            return {
              eq: vi.fn().mockImplementation((col2: string, val2: string) => {
                if (mockCompanyUser && mockCompanyUser.company_id === val2) {
                  return {
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: mockCompanyUser,
                      error: null,
                    }),
                  };
                }
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                };
              }),
            };
          }),
        };
      }
      return mockQueryBuilder;
    }),
    rpc: vi.fn(),
  })),
}));

vi.mock("@/lib/auth/dal", () => ({
  verifyAdminSession: vi.fn().mockImplementation(async () => {
    if (mockProfileRole === "admin" && mockUser) {
      return { userId: mockUser.id, role: "admin", email: mockUser.email };
    }
    return null;
  }),
}));

import {
  setExchangeCreditIssuanceGateForTesting,
} from "../../lib/retailer/exchange-credit-ledger/credit-ledger-gate";
import {
  issueOptionACreditAction,
  issueOptionBCreditAction,
  verifyCompanyCreditAccess,
  checkCreditLedgerSchemaAvailability,
} from "../../lib/retailer/exchange-credit-ledger/credit-ledger-actions";

describe("EXCHANGE-CREDIT-PH4-001: Credit Ledger Action Validation Tests", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await setExchangeCreditIssuanceGateForTesting(true);
    mockUser = { id: "admin-1", email: "admin@kselectnetwork.com" };
    mockProfileRole = "admin";
    mockCompanyUser = { id: "cu-1", company_id: "comp-1", status: "active" };
  });

  // ---------------------------------------------------------------------------
  // 1. Cross-Company Authorization
  // ---------------------------------------------------------------------------
  describe("Company Credit Access Boundary", () => {
    it("allows admin user to access any company", async () => {
      mockProfileRole = "admin";
      const result = await verifyCompanyCreditAccess("comp-999");
      expect(result.success).toBe(true);
      expect(result.userId).toBe("admin-1");
    });

    it("allows retailer user to access their own company", async () => {
      mockProfileRole = "retailer";
      mockUser = { id: "ret-1", email: "retailer@store.com" };
      mockCompanyUser = { id: "cu-1", company_id: "comp-1", status: "active" };

      const result = await verifyCompanyCreditAccess("comp-1");
      expect(result.success).toBe(true);
    });

    it("strictly blocks retailer user from accessing another company", async () => {
      mockProfileRole = "retailer";
      mockUser = { id: "ret-1", email: "retailer@store.com" };
      mockCompanyUser = { id: "cu-1", company_id: "comp-1", status: "active" };

      const result = await verifyCompanyCreditAccess("comp-foreign-999");
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("FORBIDDEN");
      expect(result.error).toContain("Cross-company access is strictly prohibited");
    });

    it("rejects unauthenticated user", async () => {
      mockUser = null;
      const result = await verifyCompanyCreditAccess("comp-1");
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("UNAUTHORIZED");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Option A Eligibility & Business Rules
  // ---------------------------------------------------------------------------
  describe("Option A Action Validation", () => {
    it("rejects issuance for unapproved claim", async () => {
      // Mock schema available
      mockQueryBuilder.limit.mockReturnValueOnce({ error: null });

      // Mock Claim Item
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "item-1",
          claim_id: "claim-1",
          selected_option: "A",
          selected_quantity: 10,
          frozen_unit_wholesale_price: 25.0,
          frozen_credit_rate: 0.4,
          status: "submitted",
        },
        error: null,
      });

      // Mock Claim Header in 'submitted' status (NOT approved)
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "claim-1",
          claim_number: "CLM-2026-000001",
          status: "submitted",
          company_id: "comp-1",
          store_id: "store-1",
        },
        error: null,
      });

      const result = await issueOptionACreditAction({
        claimId: "claim-1",
        claimItemId: "item-1",
        approvedQuantity: 10,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("UNAPPROVED_CLAIM");
      expect(result.error).toContain("must be approved by Admin first");
    });

    it("rejects duplicate credit issuance if credit already exists for this claim item", async () => {
      // Mock schema available
      mockQueryBuilder.limit.mockReturnValueOnce({ error: null });

      // Mock Claim Item
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "item-1",
          claim_id: "claim-1",
          selected_option: "A",
          selected_quantity: 10,
          frozen_unit_wholesale_price: 25.0,
          frozen_credit_rate: 0.4,
          status: "approved",
        },
        error: null,
      });

      // Mock Claim Header in 'approved' status
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "claim-1",
          claim_number: "CLM-2026-000001",
          status: "approved",
          company_id: "comp-1",
          store_id: "store-1",
        },
        error: null,
      });

      // Mock existing credit found!
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "credit-existing-1",
          credit_code: "CRD-2026-000042",
          status: "issued",
          credit_amount: 100.0,
        },
        error: null,
      });

      const result = await issueOptionACreditAction({
        claimId: "claim-1",
        claimItemId: "item-1",
        approvedQuantity: 10,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("DUPLICATE_CREDIT_ISSUANCE");
      expect(result.error).toContain("Duplicate issuance is prohibited");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Option B Eligibility & Business Rules
  // ---------------------------------------------------------------------------
  describe("Option B Action Validation", () => {
    it("strictly rejects credit issuance from draft warehouse inspections", async () => {
      // Mock schema available
      mockQueryBuilder.limit.mockReturnValueOnce({ error: null });

      // Mock Inspection Record with is_draft: true
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "insp-1",
          rma_id: "rma-1",
          is_draft: true, // DRAFT!
          total_accepted_resaleable: 5,
          total_rejected: 0,
          total_missing: 0,
        },
        error: null,
      });

      const result = await issueOptionBCreditAction({
        rmaId: "rma-1",
        inspectionId: "insp-1",
        rmaLineId: "line-1",
        claimItemId: "item-1",
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("DRAFT_INSPECTION_REJECTED");
      expect(result.error).toContain("Warehouse inspection must be fully finalized");
    });

    it("rejects credit issuance when accepted resaleable quantity is zero", async () => {
      // Mock schema available
      mockQueryBuilder.limit.mockReturnValueOnce({ error: null });

      // Mock Inspection Record (Finalized)
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "insp-1",
          rma_id: "rma-1",
          is_draft: false,
          total_accepted_resaleable: 0,
          total_rejected: 10,
          total_missing: 0,
        },
        error: null,
      });

      // Mock Inspection Line with 0 accepted units
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "insp-line-1",
          quantity_accepted_resaleable: 0, // 0 units
          quantity_rejected: 10,
        },
        error: null,
      });

      const result = await issueOptionBCreditAction({
        rmaId: "rma-1",
        inspectionId: "insp-1",
        rmaLineId: "line-1",
        claimItemId: "item-1",
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("NO_RESALEABLE_UNITS");
      expect(result.error).toContain("Accepted resaleable quantity is zero");
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Schema Availability Fallback
  // ---------------------------------------------------------------------------
  describe("Schema Availability Check", () => {
    it("returns false cleanly if table does not exist", async () => {
      mockQueryBuilder.limit.mockReturnValueOnce({
        error: { code: "42P01", message: 'relation "retailer_exchange_credit_ledger" does not exist' },
      });

      const available = await checkCreditLedgerSchemaAvailability();
      expect(available).toBe(false);
    });
  });
});
