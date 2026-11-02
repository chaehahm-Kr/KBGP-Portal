import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock server-only, next/cache, next/headers before importing server modules
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: vi.fn(),
    set: vi.fn(),
    getAll: () => [],
  }),
  headers: async () => new Headers(),
}));

const mockVerifyAdminSession = vi.fn();
const mockGetAdminStaffContext = vi.fn();

vi.mock("@/lib/auth/dal", () => ({
  verifyAdminSession: () => mockVerifyAdminSession(),
  getAdminStaffContext: () => mockGetAdminStaffContext(),
}));

const dummyCampaignId = "c0000000-0000-4000-a000-000000000001";
const dummyCompanyId1 = "d1111111-1111-4111-a111-111111111111";
const dummyCompanyId2 = "d2222222-2222-4222-a222-222222222222";
const dummyContactId1 = "e1111111-1111-4111-a111-111111111111";
const dummyContactId2 = "e2222222-2222-4222-a222-222222222222";
const dummyContactId3 = "e3333333-3333-4333-a333-333333333333";

// In-memory test state
let mockSuppressionList: string[] = [];
let mockCompanies: any[] = [];
let mockCampaignRecipients: any[] = [];
let mockCampaignRecord: any = null;

function mockFromTable(table: string) {
  if (table === "marketing_suppression_list") {
    return {
      select: () => ({
        eq: (col: string, val: any) => ({
          limit: () => {
            const email = String(val).toLowerCase().trim();
            const isSuppressed = mockSuppressionList.includes(email);
            return Promise.resolve({
              data: isSuppressed ? [{ email, reason: "MANUAL_ADMIN", status: "ACTIVE" }] : [],
              error: null,
            });
          },
        }),
      }),
    };
  }

  if (table === "sourcing_companies") {
    return {
      select: () => {
        const chain: any = {
          in: (col: string, vals: any[]) => {
            const filtered = mockCompanies.filter((c) => {
              if (col === "id") return vals.includes(c.id);
              if (col === "grade") return vals.includes(c.grade);
              return true;
            });
            return {
              ...chain,
              then: (cb: any) => cb({ data: filtered, error: null }),
            };
          },
          limit: () => ({
            maybeSingle: () => Promise.resolve({ data: mockCompanies[0] || null, error: null }),
          }),
          maybeSingle: () => Promise.resolve({ data: mockCompanies[0] || null, error: null }),
          then: (cb: any) => cb({ data: mockCompanies, error: null }),
        };
        return chain;
      },
    };
  }

  if (table === "marketing_campaign_recipients") {
    return {
      select: () => ({
        eq: (col: string, val: any) => Promise.resolve({
          data: mockCampaignRecipients.filter((r) => r.campaign_id === val),
          error: null,
        }),
      }),
      delete: () => ({
        in: (col: string, ids: string[]) => {
          mockCampaignRecipients = mockCampaignRecipients.filter((r) => !ids.includes(r.id));
          return Promise.resolve({ data: null, error: null });
        },
      }),
      upsert: (rows: any[]) => {
        for (const row of rows) {
          const idx = mockCampaignRecipients.findIndex(
            (r) => r.campaign_id === row.campaign_id && r.recipient_email === row.recipient_email
          );
          if (idx >= 0) {
            mockCampaignRecipients[idx] = { ...mockCampaignRecipients[idx], ...row };
          } else {
            mockCampaignRecipients.push({ ...row, id: row.id || `rec-${Date.now()}-${Math.random()}` });
          }
        }
        return Promise.resolve({ data: mockCampaignRecipients, error: null });
      },
    };
  }

  if (table === "marketing_campaign_logs") {
    return {
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
          then: (cb: any) => cb({ data: [], error: null }),
        }),
      }),
    };
  }

  if (table === "marketing_campaigns") {
    return {
      select: () => ({
        eq: (col: string, val: any) => ({
          single: () => Promise.resolve({ data: mockCampaignRecord, error: mockCampaignRecord ? null : { message: "Not found" } }),
          maybeSingle: () => Promise.resolve({ data: mockCampaignRecord, error: null }),
        }),
      }),
      update: (payload: any) => ({
        eq: (col: string, val: any) => {
          if (mockCampaignRecord && mockCampaignRecord.id === val) {
            mockCampaignRecord = { ...mockCampaignRecord, ...payload };
          }
          return Promise.resolve({ data: mockCampaignRecord, error: null });
        },
      }),
      upsert: (payload: any) => {
        mockCampaignRecord = { ...mockCampaignRecord, ...payload };
        return {
          select: () => ({
            single: () => Promise.resolve({ data: mockCampaignRecord, error: null }),
          }),
        };
      },
    };
  }

  if (table === "marketing_footer_settings") {
    return {
      select: () => ({
        maybeSingle: () =>
          Promise.resolve({
            data: {
              brand_display_name: "K-Select Network",
              legal_company_name: "Letusto Inc.",
              physical_address: "123 Commerce Blvd, Suite 400, Irvine, CA 92618",
              contact_email: "contact@kselectnetwork.com",
              privacy_policy_url: "https://kselectnetwork.com/privacy",
              terms_url: "https://kselectnetwork.com/terms",
              help_center_url: "https://kselectnetwork.com/help",
              default_style: "classic",
              updated_at: new Date().toISOString(),
            },
            error: null,
          }),
      }),
    };
  }

  return {
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: null, error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      limit: () => Promise.resolve({ data: [], error: null }),
    }),
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => mockFromTable(table),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => mockFromTable(table),
  }),
}));

import {
  evaluateCampaignRecipientCandidates,
  syncCampaignRecipients,
  approveMarketingCampaign,
  saveMarketingCampaign,
  getMarketingCampaignById,
} from "@/lib/brand-marketing/campaign-data-access";
import { type MarketingCampaign } from "@/lib/brand-marketing/campaign-types";
import {
  validateCampaignPreApprovalAction,
} from "@/lib/brand-marketing/campaign-actions";

describe("ADM-EMAIL-APP-001: Campaign Recipient Persistence, Approval & Send Workflow Integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminSession.mockResolvedValue({ id: "admin-user", role: "ADMIN" });
    mockGetAdminStaffContext.mockResolvedValue({ email: "admin@kselectnetwork.com", fullName: "Admin Staff" });
    mockSuppressionList = ["suppressed@example.com"];
    mockCampaignRecipients = [];

    mockCompanies = [
      {
        id: dummyCompanyId1,
        company_name_kr: "(주)케이뷰티코스메틱",
        company_name_en: "K-Beauty Cosmetics Inc.",
        business_types: ["MANUFACTURER", "BRAND_OWNER"],
        grade: "A",
        status: "ACTIVE",
        marketing_consent_status: "CONSENTED",
        sourcing_brands: [{ id: "b1", brand_name_kr: "닥터케이", brand_name_en: "Dr. K", categories: ["SKINCARE"] }],
        sourcing_contacts: [
          { id: dummyContactId1, name: "김담당", email: "kim@kbeauty.com", is_primary: true },
          { id: dummyContactId2, name: "이마케팅", email: "lee@kbeauty.com", is_primary: false },
        ],
      },
      {
        id: dummyCompanyId2,
        company_name_kr: "(주)글로벌스킨랩",
        company_name_en: "Global Skin Lab Ltd.",
        business_types: ["OEM_ODM"],
        grade: "B",
        status: "ACTIVE",
        marketing_consent_status: "UNCONFIRMED",
        sourcing_brands: [{ id: "b2", brand_name_kr: "스킨랩", brand_name_en: "Skin Lab", categories: ["BODYCARE"] }],
        sourcing_contacts: [
          { id: dummyContactId3, name: "박대표", email: "park@skinlab.com", is_primary: true },
        ],
      },
    ];

    mockCampaignRecord = {
      id: dummyCampaignId,
      name: "KBGP - Brand Outreach - Wave 1",
      slug: "kbgp-brand-outreach-wave-1",
      subject: "Partnership Inquiry",
      subject_override: "Partnership Inquiry",
      preview_text: "Exclusive network invitation",
      template_id: "tpl-123",
      status: "DRAFT",
      approval_status: "DRAFT",
      approval_snapshot: null,
      filter_criteria: {
        grades: ["A", "B"],
        companyIds: [dummyCompanyId1, dummyCompanyId2],
        contactIds: [dummyContactId1, dummyContactId3],
        manualEmails: ["partner@trusted.com", "suppressed@example.com", "invalid-email"],
        requireConsentedOnly: true,
      },
      stats: {
        totalRecipients: 0,
        sendableCount: 0,
        excludedCount: 0,
        testSendsCount: 0,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  describe("1. Candidate Evaluation & Policy Filtering", () => {
    it("evaluates candidates, deduplicates, excludes suppressed & invalid emails, and enforces consent policy", async () => {
      const criteria: MarketingCampaign["filterCriteria"] = {
        grades: ["A", "B"],
        companyIds: [dummyCompanyId1, dummyCompanyId2],
        contactIds: [dummyContactId1, dummyContactId3],
        manualEmails: ["partner@trusted.com", "suppressed@example.com", "invalid-email"],
        requireConsentedOnly: true,
      };

      const evalResult = await evaluateCampaignRecipientCandidates(dummyCampaignId, criteria);

      // Verify recipient items returned
      expect(evalResult.recipientItems.length).toBeGreaterThan(0);

      // Check contact 1 (kim@kbeauty.com): Consented -> ELIGIBLE
      const kim = evalResult.recipientItems.find((r) => r.recipientEmail === "kim@kbeauty.com");
      expect(kim).toBeDefined();
      expect(kim?.sendEligibility).toBe("ELIGIBLE");
      expect(kim?.companyId).toBe(dummyCompanyId1);
      expect(kim?.contactId).toBe(dummyContactId1);

      // Check contact 3 (park@skinlab.com): UNCONFIRMED consent + requireConsentedOnly: true -> EXCLUDED_UNCONFIRMED_CONSENT
      const park = evalResult.recipientItems.find((r) => r.recipientEmail === "park@skinlab.com");
      expect(park).toBeDefined();
      expect(park?.sendEligibility).toBe("EXCLUDED_UNCONFIRMED_CONSENT");

      // Check manual email suppressed@example.com -> EXCLUDED_SUPPRESSED
      const suppressed = evalResult.recipientItems.find((r) => r.recipientEmail === "suppressed@example.com");
      expect(suppressed).toBeDefined();
      expect(suppressed?.sendEligibility).toBe("EXCLUDED_SUPPRESSED");

      // Check invalid-email -> EXCLUDED_INVALID_EMAIL
      const invalid = evalResult.recipientItems.find((r) => r.recipientEmail === "invalid-email");
      expect(invalid).toBeDefined();
      expect(invalid?.sendEligibility).toBe("EXCLUDED_INVALID_EMAIL");

      // Check manual email partner@trusted.com: Under requireConsentedOnly: true -> EXCLUDED_UNCONFIRMED_CONSENT
      const partner = evalResult.recipientItems.find((r) => r.recipientEmail === "partner@trusted.com");
      expect(partner).toBeDefined();
      expect(partner?.sendEligibility).toBe("EXCLUDED_UNCONFIRMED_CONSENT");
    });

    it("allows manual email when requireConsentedOnly is false", async () => {
      const criteria: MarketingCampaign["filterCriteria"] = {
        companyIds: [dummyCompanyId1],
        manualEmails: ["newpartner@legitdomain.com"],
        requireConsentedOnly: false,
      };

      const evalResult = await evaluateCampaignRecipientCandidates(dummyCampaignId, criteria);
      const manual = evalResult.recipientItems.find((r) => r.recipientEmail === "newpartner@legitdomain.com");
      expect(manual).toBeDefined();
      expect(manual?.sendEligibility).toBe("ELIGIBLE");
    });
  });

  describe("2. Recipient Database Synchronization (syncCampaignRecipients)", () => {
    it("persists candidates into marketing_campaign_recipients and cleans up deselected records", async () => {
      const criteria: MarketingCampaign["filterCriteria"] = {
        grades: ["A"],
        companyIds: [dummyCompanyId1],
        contactIds: [dummyContactId1],
        manualEmails: ["fresh@example.com"],
        requireConsentedOnly: false,
      };

      // Seed an old recipient to verify cleanup
      mockCampaignRecipients = [
        {
          id: "old-rec-1",
          campaign_id: dummyCampaignId,
          recipient_email: "removed@oldcompany.com",
        },
      ];

      const synced = await syncCampaignRecipients(dummyCampaignId, criteria);
      expect(synced.length).toBe(2);

      // Verify old recipient was removed
      expect(mockCampaignRecipients.some((r) => r.recipient_email === "removed@oldcompany.com")).toBe(false);

      // Verify kim@kbeauty.com and fresh@example.com are in DB
      expect(mockCampaignRecipients.some((r) => r.recipient_email === "kim@kbeauty.com")).toBe(true);
      expect(mockCampaignRecipients.some((r) => r.recipient_email === "fresh@example.com")).toBe(true);

      // Verify fallback company ID applied for manual email
      const manualDb = mockCampaignRecipients.find((r) => r.recipient_email === "fresh@example.com");
      expect(manualDb.company_id).toBe(dummyCompanyId1);
    });
  });

  describe("3. Pre-Approval Checklist Reconciliation (Check 10)", () => {
    it("returns FAIL when campaign has zero recipients selected", async () => {
      mockCampaignRecord.filter_criteria = { companyIds: [], contactIds: [], manualEmails: [] };
      mockCampaignRecipients = [];

      const result = await validateCampaignPreApprovalAction(dummyCampaignId);
      expect(result.isValid).toBe(false);

      const check10 = result.checks.find((c) => c.name === "Recipient Selection");
      expect(check10).toBeDefined();
      expect(check10?.status).toBe("FAIL");
      expect(check10?.detail).toContain("No recipients selected");
    });

    it("returns FAIL when recipients exist but all are excluded by policy (0 eligible)", async () => {
      mockCampaignRecord.filter_criteria = {
        companyIds: [dummyCompanyId2],
        contactIds: [dummyContactId3],
        manualEmails: [],
        requireConsentedOnly: true,
      };

      // Sync recipients to populate table
      await syncCampaignRecipients(dummyCampaignId, mockCampaignRecord.filter_criteria);

      const result = await validateCampaignPreApprovalAction(dummyCampaignId);
      expect(result.isValid).toBe(false);

      const check10 = result.checks.find((c) => c.name === "Recipient Selection");
      expect(check10).toBeDefined();
      expect(check10?.status).toBe("FAIL");
      expect(check10?.detail).toContain("0 are send-eligible");
    });

    it("returns PASS when valid send-eligible recipients are selected and persisted", async () => {
      mockCampaignRecord.filter_criteria = {
        companyIds: [dummyCompanyId1],
        contactIds: [dummyContactId1],
        manualEmails: [],
        requireConsentedOnly: true,
      };

      // Sync recipients
      await syncCampaignRecipients(dummyCampaignId, mockCampaignRecord.filter_criteria);

      const result = await validateCampaignPreApprovalAction(dummyCampaignId);
      expect(result.isValid).toBe(true);

      const check10 = result.checks.find((c) => c.name === "Recipient Selection");
      expect(check10).toBeDefined();
      expect(check10?.status).toBe("PASS");
      expect(check10?.detail).toContain("1 recipients selected (1 send-eligible)");
    });
  });

  describe("4. Approval Locking & Snapshot Immutability", () => {
    it("blocks campaign approval if recipients array is empty", async () => {
      mockCampaignRecord.filter_criteria = { companyIds: [], contactIds: [] };
      mockCampaignRecipients = [];

      await expect(
        approveMarketingCampaign(dummyCampaignId, "admin@kselectnetwork.com")
      ).rejects.toThrow("Cannot approve campaign: No recipients selected for campaign");
    });

    it("blocks campaign approval if sendable recipients count is zero", async () => {
      mockCampaignRecord.filter_criteria = {
        companyIds: [dummyCompanyId2],
        contactIds: [dummyContactId3],
        requireConsentedOnly: true,
      };
      await syncCampaignRecipients(dummyCampaignId, mockCampaignRecord.filter_criteria);

      await expect(
        approveMarketingCampaign(dummyCampaignId, "admin@kselectnetwork.com")
      ).rejects.toThrow("Cannot approve campaign: No send-eligible recipients available");
    });

    it("successfully creates immutable approval snapshot and freezes recipient count upon approval", async () => {
      mockCampaignRecord.filter_criteria = {
        companyIds: [dummyCompanyId1],
        contactIds: [dummyContactId1],
        requireConsentedOnly: true,
      };
      await syncCampaignRecipients(dummyCampaignId, mockCampaignRecord.filter_criteria);

      const approved = await approveMarketingCampaign(
        dummyCampaignId,
        "admin@kselectnetwork.com"
      );

      expect(approved.status).toBe("APPROVED");
      expect(approved.approvalStatus).toBe("APPROVED");
      expect(approved.approvalSnapshot).toBeDefined();
      expect(approved.approvalSnapshot?.frozenRecipientsCount).toBe(1);
      expect(approved.approvalSnapshot?.sendableCount).toBe(1);
      expect(approved.approvalSnapshot?.approvedBy).toBe("admin@kselectnetwork.com");
    });
  });

  describe("5. Draft Save & Automatic Sync Workflow", () => {
    it("saveMarketingCampaign automatically synchronizes recipients to DB for unapproved campaigns", async () => {
      mockCampaignRecord.approval_status = "DRAFT";
      mockCampaignRecord.status = "DRAFT";
      const payload: Partial<MarketingCampaign> & { name: string } = {
        id: dummyCampaignId,
        name: "Auto Sync Test Campaign",
        filterCriteria: {
          companyIds: [dummyCompanyId1],
          contactIds: [dummyContactId1],
          requireConsentedOnly: true,
        },
      };

      const saved = await saveMarketingCampaign(payload);
      expect(saved.name).toBe("Auto Sync Test Campaign");

      // Verify marketing_campaign_recipients has been populated
      expect(mockCampaignRecipients.length).toBe(1);
      expect(mockCampaignRecipients[0].recipient_email).toBe("kim@kbeauty.com");
      expect(mockCampaignRecipients[0].send_eligibility).toBe("ELIGIBLE");
    });

    it("getMarketingCampaignById returns persisted recipients", async () => {
      mockCampaignRecord.filter_criteria = {
        companyIds: [dummyCompanyId1],
        contactIds: [dummyContactId1],
      };
      await syncCampaignRecipients(dummyCampaignId, mockCampaignRecord.filter_criteria);

      const retrieved = await getMarketingCampaignById(dummyCampaignId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.recipients?.length).toBe(1);
      expect(retrieved?.recipients?.[0].recipientEmail).toBe("kim@kbeauty.com");
    });
  });

  describe("6. LIVE_MODE Lock & Security Gate Invariants", () => {
    it("verifies Check 9 hard-locks LIVE_MODE to false in validateCampaignPreApprovalAction", async () => {
      const result = await validateCampaignPreApprovalAction(dummyCampaignId);
      const liveGateCheck = result.checks.find((c) => c.name === "LIVE_MODE Safety Lock");
      expect(liveGateCheck).toBeDefined();
      expect(liveGateCheck?.status).toBe("PASS");
      expect(liveGateCheck?.detail).toContain("Hard-locked to false");
    });
  });
});
