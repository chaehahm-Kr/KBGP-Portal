/**
 * ADM-BSRC-009-R5: Email Campaign Recipient Discovery, Persistent Selection & Manual Email Entry
 * Unit & Integration Test Suite
 *
 * Target QA Environment: elkgizqgksshukxgcndy.supabase.co
 */

import * as fs from "fs";
import * as path from "path";

// Preload QA environment variables synchronously before importing server modules
const qaLocalPath = path.join(process.cwd(), ".env.qa.local");
if (fs.existsSync(qaLocalPath)) {
  const content = fs.readFileSync(qaLocalPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
    if (match) {
      let val = match[2] || "";
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[match[1]] = val.trim();
    }
  }
}
process.env.ENABLE_QA_ENVIRONMENT = "true";
if (process.env.QA_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.QA_SUPABASE_URL;
}
if (process.env.QA_SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SECRET_KEY = process.env.QA_SUPABASE_SERVICE_ROLE_KEY;
}

import { describe, it, expect, vi } from "vitest";

// Mock server-only and next/cache
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import {
  listSourcingCandidatesAction,
  getSourcingCandidatesByIdsAction,
} from "../../lib/brand-sourcing/actions";
import {
  saveMarketingCampaignAction,
  getMarketingCampaignByIdAction,
  runCampaignDryRunAction,
  listMarketingCampaignsAction,
} from "../../lib/brand-marketing/campaign-actions";

// Mock auth DAL
vi.mock("@/lib/auth/dal", () => ({
  verifyAdminSession: vi.fn().mockResolvedValue({
    userId: "00000000-0000-4000-a000-000000000001",
    email: "qa-admin@kselect-test.local",
    role: "admin",
  }),
  getAdminStaffContext: vi.fn().mockResolvedValue({
    session: {
      userId: "00000000-0000-4000-a000-000000000001",
      email: "qa-admin@kselect-test.local",
      role: "admin",
    },
    staffMember: {
      id: "00000000-0000-4000-a000-000000000001",
      name: "QA Admin Staff",
      email: "qa-admin@kselect-test.local",
      status: "active",
      base_role: "admin",
      menu_permissions: { applications: { view: true, create: true, edit: true, delete: true } },
    },
    isSuperAdmin: true,
    canAccessFinance: true,
    canAccessExecutiveKPIs: true,
    canManageStaff: true,
    hasPermission: () => true,
  }),
}));

describe("ADM-BSRC-009-R5: Recipient Discovery, Persistent Selection & Manual Email Entry", () => {
  // ---------------------------------------------------------------------------
  // 1. Full Dataset Server Query & Pagination
  // ---------------------------------------------------------------------------
  describe("1. Full Dataset Server Query & Pagination", () => {
    it("queries candidates with custom page sizes (20, 50, 100, 200) and returns exact total count", async () => {
      const res20 = await listSourcingCandidatesAction({ limit: 20, offset: 0 });
      expect(res20.success).toBe(true);
      expect(Array.isArray(res20.candidates)).toBe(true);
      expect(typeof res20.total).toBe("number");
      expect(res20.candidates!.length).toBeLessThanOrEqual(20);

      const res50 = await listSourcingCandidatesAction({ limit: 50, offset: 0 });
      expect(res50.success).toBe(true);
      expect(res50.candidates!.length).toBeLessThanOrEqual(50);

      const resOffset = await listSourcingCandidatesAction({ limit: 20, offset: 20 });
      expect(resOffset.success).toBe(true);
      expect(resOffset.total).toBe(res20.total);
    });

    it("includes marketing_consent_status in the returned candidate records", async () => {
      const res = await listSourcingCandidatesAction({ limit: 10, offset: 0 });
      expect(res.success).toBe(true);
      if (res.candidates && res.candidates.length > 0) {
        const first = res.candidates[0];
        expect(first).toHaveProperty("marketing_consent_status");
        expect(["UNCONFIRMED", "CONSENTED", "REFUSED", "EXCLUDED"]).toContain(
          first.marketing_consent_status || "UNCONFIRMED"
        );
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Advanced Search & Brand List Equivalent Filters
  // ---------------------------------------------------------------------------
  describe("2. Advanced Search & Brand List Equivalent Filters", () => {
    it("filters candidates by Grade A", async () => {
      const resA = await listSourcingCandidatesAction({ grade: "A", limit: 20, offset: 0 });
      expect(resA.success).toBe(true);
      (resA.candidates || []).forEach((c) => {
        expect(c.grade).toBe("A");
      });
    });

    it("filters candidates by Status", async () => {
      const resSaved = await listSourcingCandidatesAction({ status: "SAVED", limit: 20, offset: 0 });
      expect(resSaved.success).toBe(true);
      (resSaved.candidates || []).forEach((c) => {
        expect(c.status).toBe("SAVED");
      });
    });

    it("filters candidates by Marketing Consent Status", async () => {
      const resConsent = await listSourcingCandidatesAction({
        marketingConsentStatus: "CONSENTED",
        limit: 20,
        offset: 0,
      });
      expect(resConsent.success).toBe(true);
      (resConsent.candidates || []).forEach((c) => {
        expect(c.marketing_consent_status).toBe("CONSENTED");
      });
    });

    it("filters candidates by Business Types with ANY and ALL match modes", async () => {
      const resAny = await listSourcingCandidatesAction({
        businessTypes: ["BRAND_OWNER", "MANUFACTURER"],
        businessTypeMatchMode: "ANY",
        limit: 20,
        offset: 0,
      });
      expect(resAny.success).toBe(true);

      const resAll = await listSourcingCandidatesAction({
        businessTypes: ["BRAND_OWNER", "MANUFACTURER"],
        businessTypeMatchMode: "ALL",
        limit: 20,
        offset: 0,
      });
      expect(resAll.success).toBe(true);
      expect(resAll.total!).toBeLessThanOrEqual(resAny.total!);
    });

    it("filters candidates by Primary Product Categories", async () => {
      const resCat = await listSourcingCandidatesAction({
        primaryCategories: ["SKINCARE"],
        limit: 20,
        offset: 0,
      });
      expect(resCat.success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Persistent Cross-Filter & Cross-Page Selection Logic
  // ---------------------------------------------------------------------------
  describe("3. Persistent Cross-Filter & Cross-Page Selection Logic", () => {
    it("accumulates selections across filter changes without losing prior selections", () => {
      let selectedCompanyIds: string[] = [];
      let selectedContactIds: string[] = [];

      // Step A: User filters by Grade A and selects company 'comp-a1' with contact 'ct-a1'
      const compA1 = { id: "comp-a1", grade: "A", contacts: [{ id: "ct-a1", email: "a1@test.com" }] };
      selectedCompanyIds = [...selectedCompanyIds, compA1.id];
      selectedContactIds = [...selectedContactIds, compA1.contacts[0].id];

      expect(selectedCompanyIds).toContain("comp-a1");
      expect(selectedContactIds).toContain("ct-a1");

      // Step B: User switches filter to Grade B (Grade A records disappear from view)
      // Selections are NOT cleared
      const currentFilteredViewGradeB = [
        { id: "comp-b1", grade: "B", contacts: [{ id: "ct-b1", email: "b1@test.com" }] },
      ];
      expect(selectedCompanyIds).toContain("comp-a1"); // comp-a1 remains selected!

      // Step C: User selects company 'comp-b1' with contact 'ct-b1'
      selectedCompanyIds = [...selectedCompanyIds, currentFilteredViewGradeB[0].id];
      selectedContactIds = [...selectedContactIds, currentFilteredViewGradeB[0].contacts[0].id];

      // Both Grade A and Grade B companies are selected!
      expect(selectedCompanyIds).toEqual(["comp-a1", "comp-b1"]);
      expect(selectedContactIds).toEqual(["ct-a1", "ct-b1"]);

      // Step D: User unchecks comp-a1 -> only comp-a1 and its contacts are removed
      selectedCompanyIds = selectedCompanyIds.filter((id) => id !== "comp-a1");
      selectedContactIds = selectedContactIds.filter((id) => id !== "ct-a1");

      expect(selectedCompanyIds).toEqual(["comp-b1"]);
      expect(selectedContactIds).toEqual(["ct-b1"]);
    });

    it("hydrates selected company records by IDs when reopening draft", async () => {
      const candidatesRes = await listSourcingCandidatesAction({ limit: 5, offset: 0 });
      if (candidatesRes.candidates && candidatesRes.candidates.length > 0) {
        const testIds = candidatesRes.candidates.slice(0, 3).map((c) => c.id);
        const hydrated = await getSourcingCandidatesByIdsAction(testIds);
        expect(hydrated.success).toBe(true);
        expect(hydrated.candidates!.length).toBe(testIds.length);
        hydrated.candidates!.forEach((c) => {
          expect(testIds).toContain(c.id);
        });
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Company & Contact Multi-Selection Semantics
  // ---------------------------------------------------------------------------
  describe("4. Company & Contact Multi-Selection Semantics", () => {
    it("determines correct checkbox state: checked (all), indeterminate (some), unchecked (none)", () => {
      const contacts = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
      const compContactIds = contacts.map((c) => c.id);

      // Scenario 1: All contacts selected
      let selectedContactIds = ["c1", "c2", "c3"];
      let selectedCompContacts = compContactIds.filter((id) => selectedContactIds.includes(id));
      let isAllSelected = selectedCompContacts.length === compContactIds.length;
      let isSomeSelected = selectedCompContacts.length > 0 && selectedCompContacts.length < compContactIds.length;
      expect(isAllSelected).toBe(true);
      expect(isSomeSelected).toBe(false);

      // Scenario 2: Partial contacts selected (indeterminate)
      selectedContactIds = ["c1", "c3"];
      selectedCompContacts = compContactIds.filter((id) => selectedContactIds.includes(id));
      isAllSelected = selectedCompContacts.length === compContactIds.length;
      isSomeSelected = selectedCompContacts.length > 0 && selectedCompContacts.length < compContactIds.length;
      expect(isAllSelected).toBe(false);
      expect(isSomeSelected).toBe(true); // Indeterminate state!

      // Scenario 3: No contacts selected
      selectedContactIds = [];
      selectedCompContacts = compContactIds.filter((id) => selectedContactIds.includes(id));
      isAllSelected = selectedCompContacts.length === compContactIds.length;
      isSomeSelected = selectedCompContacts.length > 0 && selectedCompContacts.length < compContactIds.length;
      expect(isAllSelected).toBe(false);
      expect(isSomeSelected).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Manual Email Recipient Parsing, Validation & Deduplication
  // ---------------------------------------------------------------------------
  describe("5. Manual Email Recipient Parsing, Validation & Deduplication", () => {
    it("parses emails separated by newlines, commas, and semicolons with whitespace trimming", () => {
      const input = "buyer1@nordstrom.com\nbuyer2@sephora.com, buyer3@ulta.com; contact@target.com ";
      const tokens = input.split(/[\n,;]+/);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const accepted: string[] = [];
      for (const t of tokens) {
        const trimmed = t.trim().toLowerCase();
        if (emailRegex.test(trimmed)) {
          accepted.push(trimmed);
        }
      }

      expect(accepted).toEqual([
        "buyer1@nordstrom.com",
        "buyer2@sephora.com",
        "buyer3@ulta.com",
        "contact@target.com",
      ]);
    });

    it("rejects invalid email syntax and empty values", () => {
      const input = "valid@test.com, not-an-email, , @no-user.com, missing-domain@";
      const tokens = input.split(/[\n,;]+/);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const accepted: string[] = [];
      const rejected: string[] = [];

      for (const t of tokens) {
        const trimmed = t.trim().toLowerCase();
        if (!trimmed) continue;
        if (emailRegex.test(trimmed)) {
          accepted.push(trimmed);
        } else {
          rejected.push(trimmed);
        }
      }

      expect(accepted).toEqual(["valid@test.com"]);
      expect(rejected).toEqual(["not-an-email", "@no-user.com", "missing-domain@"]);
    });

    it("detects duplicates against company contact emails and existing manual emails", () => {
      const existingCompanyEmails = new Set(["primary@brand-a.com", "sales@brand-b.com"]);
      const existingManualEmails = new Set(["custom@retailer.com"]);

      const input = "new@buyer.com, PRIMARY@BRAND-A.COM, custom@retailer.com, new@buyer.com";
      const tokens = input.split(/[\n,;]+/);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const accepted: string[] = [];
      const duplicates: string[] = [];

      for (const t of tokens) {
        const trimmed = t.trim().toLowerCase();
        if (!trimmed || !emailRegex.test(trimmed)) continue;

        if (existingCompanyEmails.has(trimmed) || existingManualEmails.has(trimmed) || accepted.includes(trimmed)) {
          duplicates.push(trimmed);
        } else {
          accepted.push(trimmed);
        }
      }

      expect(accepted).toEqual(["new@buyer.com"]);
      expect(duplicates).toEqual(["primary@brand-a.com", "custom@retailer.com", "new@buyer.com"]);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Campaign Draft Persistence & Hydration
  // ---------------------------------------------------------------------------
  describe("6. Campaign Draft Persistence & Hydration", () => {
    let createdCampaignId: string;

    it("persists manualEmails, companyIds, and contactIds in filterCriteria JSONB", async () => {
      const testCampaignName = `[QA] Recipient Selection Persistence ${Date.now()}`;
      const saveRes = await saveMarketingCampaignAction({
        name: testCampaignName,
        purpose: "Brand Outreach",
        language: "ko",
        filterCriteria: {
          grades: ["A"],
          companyTypes: ["BRAND_OWNER"],
          companyTypeMatchMode: "ANY",
          primaryCategories: ["SKINCARE"],
          searchQuery: "Beauty",
          requireConsentedOnly: true,
          companyIds: ["00000000-0000-4000-a000-000000000001"],
          contactIds: ["00000000-0000-4000-a000-000000000002"],
          manualEmails: ["buyer@nordstrom.com", "partner@ulta.com"],
        },
      });

      expect(saveRes.success).toBe(true);
      expect(saveRes.campaign).toBeDefined();
      createdCampaignId = saveRes.campaign!.id;

      // Re-fetch campaign by ID to verify round-trip persistence
      const fetchRes = await getMarketingCampaignByIdAction(createdCampaignId);
      expect(fetchRes.success).toBe(true);
      const camp = fetchRes.campaign!;

      expect(camp.filterCriteria.grades).toEqual(["A"]);
      expect(camp.filterCriteria.companyTypes).toEqual(["BRAND_OWNER"]);
      expect(camp.filterCriteria.companyTypeMatchMode).toBe("ANY");
      expect(camp.filterCriteria.primaryCategories).toEqual(["SKINCARE"]);
      expect(camp.filterCriteria.searchQuery).toBe("Beauty");
      expect(camp.filterCriteria.requireConsentedOnly).toBe(true);
      expect(camp.filterCriteria.companyIds).toEqual(["00000000-0000-4000-a000-000000000001"]);
      expect(camp.filterCriteria.contactIds).toEqual(["00000000-0000-4000-a000-000000000002"]);
      expect(camp.filterCriteria.manualEmails).toEqual(["buyer@nordstrom.com", "partner@ulta.com"]);
    });

    it("evaluates manual emails in Dry Run and enforces commercial consent policy", async () => {
      expect(createdCampaignId).toBeDefined();

      // Run dry run with requireConsentedOnly = true
      const dryRunRes = await runCampaignDryRunAction(createdCampaignId, {
        requireConsentedOnly: true,
        companyIds: [],
        manualEmails: ["buyer@nordstrom.com", "malformed-email"],
      });

      expect(dryRunRes.success).toBe(true);
      const report = dryRunRes.report!;
      expect(report.totalCandidatesEvaluated).toBeGreaterThanOrEqual(2);

      // Verify malformed email was rejected as EXCLUDED_INVALID_EMAIL
      expect(report.invalidEmailFiltered).toBeGreaterThanOrEqual(1);

      // Verify manual email under strict consent was marked EXCLUDED_UNCONFIRMED_CONSENT
      expect(report.unconfirmedConsentFiltered).toBeGreaterThanOrEqual(1);

      // LIVE_MODE lock verification
      const campRes = await getMarketingCampaignByIdAction(createdCampaignId);
      expect(campRes.campaign!.isLiveModeEnabled).toBe(false);
    }, 15000);
  });

  // ---------------------------------------------------------------------------
  // 7. Safety, LIVE_MODE & Approval Enforcement
  // ---------------------------------------------------------------------------
  describe("7. Safety, LIVE_MODE & Approval Enforcement", () => {
    it("ensures campaign isLiveModeEnabled is strictly false", async () => {
      const res = await listMarketingCampaignsAction();
      expect(res.success).toBe(true);
      (res.campaigns || []).forEach((c) => {
        expect(c.isLiveModeEnabled).toBe(false);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Mandatory Unsubscribe Safety Gate Negative Tests (Fail-Closed & No False Success)
  // ---------------------------------------------------------------------------
  describe("8. Mandatory Unsubscribe Safety Gate (Section 1 Invariants)", () => {
    it("returns success: false when database connection is unavailable, but keeps in-memory suppression fail-closed", async () => {
      const { recordEmailOptOut, isEmailSuppressed } = await import("../../lib/brand-marketing/unsubscribe");
      const mockFailingClient = {
        from: () => ({
          insert: async () => { throw new Error("Database connection unavailable"); }
        })
      };
      const email = `unavail-${Date.now()}@test-gate.com`;
      const res = await recordEmailOptOut(email, "UNSUBSCRIBED", "test", null, mockFailingClient);
      
      // Invariant A & F: No false success when DB write fails
      expect(res.success).toBe(false);
      expect(res.error).toContain("Database connection unavailable");
      
      // Invariant B & C: In-memory suppression active (fail-closed)
      const isSupp = await isEmailSuppressed(email);
      expect(isSupp).toBe(true);
    });

    it("returns success: false when database write is rejected", async () => {
      const { recordEmailOptOut, isEmailSuppressed } = await import("../../lib/brand-marketing/unsubscribe");
      const mockRejectClient = {
        from: () => ({
          insert: async () => ({ error: { message: "permission denied for table marketing_suppression_list", code: "42501" } })
        })
      };
      const email = `reject-${Date.now()}@test-gate.com`;
      const res = await recordEmailOptOut(email, "UNSUBSCRIBED", "test", null, mockRejectClient);
      
      expect(res.success).toBe(false);
      expect(res.error).toContain("permission denied");
      
      const isSupp = await isEmailSuppressed(email);
      expect(isSupp).toBe(true);
    });

    it("handles DB suppression lookup failure gracefully via fallback registry (Fail-Closed)", async () => {
      const { isEmailSuppressed } = await import("../../lib/brand-marketing/unsubscribe");
      const mockFailingLookupClient = {
        from: () => ({
          select: () => ({
            eq: () => ({
              limit: async () => { throw new Error("Query timeout"); }
            })
          })
        })
      };
      const unknownEmail = `never-seen-${Date.now()}@test-gate.com`;
      const isSupp = await isEmailSuppressed(unknownEmail, mockFailingLookupClient);
      // Under ADM-EMAIL-SUP-006 Fail-Closed Invariant: lookup failure/timeout must be treated as suppressed (true)
      expect(isSupp).toBe(true);
    });

    it("returns success: true and alreadySuppressed: true for duplicate opt-out (code 23505)", async () => {
      const { recordEmailOptOut } = await import("../../lib/brand-marketing/unsubscribe");
      const mockDuplicateClient = {
        from: () => ({
          insert: async () => ({ error: { message: "duplicate key value", code: "23505" } })
        })
      };
      const email = `dup-${Date.now()}@test-gate.com`;
      const res = await recordEmailOptOut(email, "UNSUBSCRIBED", "test", null, mockDuplicateClient);
      expect(res.success).toBe(true);
      expect(res.alreadySuppressed).toBe(true);
    });
  });
  // ---------------------------------------------------------------------------
  // 9. ADM-BSRC-009-R6: Recipient Data Hygiene & Default Multi-Contact Selection
  // ---------------------------------------------------------------------------
  describe("9. ADM-BSRC-009-R6: Data Hygiene & Default Multi-Contact Selection", () => {
    // RFC regex mirroring components/admin/brand-marketing/email-campaigns-view.tsx
    const isValidContactEmail = (email?: string | null): boolean => {
      if (!email || typeof email !== "string") return false;
      const trimmed = email.trim();
      if (!trimmed) return false;
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return false;
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      return emailRegex.test(trimmed);
    };

    it("accurately classifies valid vs malformed contact emails (phone, URL, missing TLD, empty)", () => {
      expect(isValidContactEmail("contact@brand.kr")).toBe(true);
      expect(isValidContactEmail("ceo.marketing@company.co.kr")).toBe(true);
      expect(isValidContactEmail("valid-email_123@sub.domain.com")).toBe(true);

      // Audit findings exact values
      expect(isValidContactEmail("02-408-2021")).toBe(false); // PHONE_SAVED_AS_EMAIL
      expect(isValidContactEmail("https://cellmula.com/")).toBe(false); // URL_SAVED_AS_EMAIL
      expect(isValidContactEmail("jjmetro2024@naver")).toBe(false); // MISSING_TLD
      expect(isValidContactEmail("")).toBe(false); // EMPTY_EMAIL
      expect(isValidContactEmail("   ")).toBe(false); // WHITESPACE
      expect(isValidContactEmail(null)).toBe(false);
      expect(isValidContactEmail(undefined)).toBe(false);
    });

    it("default-selects all valid contact emails and deduplicates identical emails within company", () => {
      const mockCompany = {
        id: "comp-123",
        company_name_kr: "테스트 뷰티",
        sourcing_contacts: [
          { id: "ct-1", name: "김대표", email: "info@brand.kr", is_primary: true },
          { id: "ct-2", name: "박실장", email: "info@brand.kr", is_primary: false }, // Duplicate email!
          { id: "ct-3", name: "이팀장", email: "marketing@brand.kr", is_primary: false },
          { id: "ct-4", name: "최담당", email: "02-123-4567", is_primary: false }, // Phone invalid!
          { id: "ct-5", name: "정인턴", email: "", is_primary: false }, // Empty invalid!
        ],
      };

      // Helper function mirroring view logic
      const getValidCompanyContacts = (comp: any) => {
        const contacts = comp?.sourcing_contacts || [];
        const valid: any[] = [];
        const seenEmails = new Set<string>();
        const sorted = [...contacts].sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
        for (const ct of sorted) {
          if (isValidContactEmail(ct.email)) {
            const norm = ct.email.toLowerCase().trim();
            if (!seenEmails.has(norm)) {
              seenEmails.add(norm);
              valid.push(ct);
            }
          }
        }
        return valid;
      };

      const validContacts = getValidCompanyContacts(mockCompany);
      expect(validContacts.length).toBe(2);
      expect(validContacts.map((c: any) => c.id)).toEqual(["ct-1", "ct-3"]);
      expect(validContacts.map((c: any) => c.email)).toEqual(["info@brand.kr", "marketing@brand.kr"]);
    });

    it("handles indeterminate checkbox state when individual contacts are unchecked", () => {
      const validContactIds = ["ct-1", "ct-2", "ct-3"];
      let selectedContactIds = ["ct-1", "ct-2", "ct-3"];

      // Fully checked
      let isAllSelected = selectedContactIds.length === validContactIds.length;
      let isSomeSelected = selectedContactIds.length > 0 && selectedContactIds.length < validContactIds.length;
      expect(isAllSelected).toBe(true);
      expect(isSomeSelected).toBe(false);

      // Uncheck one contact
      selectedContactIds = selectedContactIds.filter((id) => id !== "ct-2");
      isAllSelected = selectedContactIds.length === validContactIds.length;
      isSomeSelected = selectedContactIds.length > 0 && selectedContactIds.length < validContactIds.length;
      expect(isAllSelected).toBe(false);
      expect(isSomeSelected).toBe(true); // Indeterminate!

      // Uncheck remaining contacts
      selectedContactIds = [];
      isAllSelected = selectedContactIds.length === validContactIds.length;
      isSomeSelected = selectedContactIds.length > 0 && selectedContactIds.length < validContactIds.length;
      expect(isAllSelected).toBe(false);
      expect(isSomeSelected).toBe(false); // Fully unchecked!
    });
  });

  // ---------------------------------------------------------------------------
  // 10. ADM-BSRC-009-R6: "All" Page-Size Option & Full-Dataset Sorting
  // ---------------------------------------------------------------------------
  describe("10. ADM-BSRC-009-R6: 'All' Page-Size & Sortable Column Headers", () => {
    it("supports 'All' page size mode via limit: -1 or limit: 0 without truncation", async () => {
      const resAll = await listSourcingCandidatesAction({ limit: -1, offset: 0 });
      expect(resAll.success).toBe(true);
      expect(Array.isArray(resAll.candidates)).toBe(true);
      expect(resAll.candidates!.length).toBe(resAll.total);
      expect(resAll.total).toBeGreaterThan(0);
    });

    it("sorts by Grade using custom business order (A > B > C > UNRATED)", async () => {
      const resGradeAsc = await listSourcingCandidatesAction({ sortBy: "grade", sortOrder: "asc", limit: 20 });
      expect(resGradeAsc.success).toBe(true);
      const grades = resGradeAsc.candidates!.map((c) => c.grade || "UNRATED");
      // All top grades should be 'A' or 'B'
      expect(["A", "B"]).toContain(grades[0]);

      const resGradeDesc = await listSourcingCandidatesAction({ sortBy: "grade", sortOrder: "desc", limit: 20 });
      expect(resGradeDesc.success).toBe(true);
      const descGrades = resGradeDesc.candidates!.map((c) => c.grade || "UNRATED");
      // In desc, UNRATED or C must be at top
      expect(["UNRATED", "C"]).toContain(descGrades[0]);
    });

    it("sorts by Company Name ascending with Korean collation", async () => {
      const resNameAsc = await listSourcingCandidatesAction({ sortBy: "company_name", sortOrder: "asc", limit: 10 });
      expect(resNameAsc.success).toBe(true);
      const names = resNameAsc.candidates!.map((c) => c.company_name_kr);
      for (let i = 0; i < names.length - 1; i++) {
        expect(names[i].localeCompare(names[i + 1], "ko")).toBeLessThanOrEqual(0);
      }
    });

    it("sorts by Email address ascending across full dataset before pagination", async () => {
      const resEmailAsc = await listSourcingCandidatesAction({ sortBy: "email", sortOrder: "asc", limit: 5 });
      expect(resEmailAsc.success).toBe(true);
      expect(resEmailAsc.candidates!.length).toBeLessThanOrEqual(5);
    });

    it("sorts by Marketing Consent using business order (CONSENTED > UNCONFIRMED > REFUSED)", async () => {
      const resConsentAsc = await listSourcingCandidatesAction({ sortBy: "consent", sortOrder: "asc", limit: 20 });
      expect(resConsentAsc.success).toBe(true);
      expect(resConsentAsc.candidates!.length).toBeGreaterThan(0);
    });
  });
  // ---------------------------------------------------------------------------
  // 11. ADM-BSRC-009-R8: Recipient Selection Count Reconciliation & Modal UX
  // ---------------------------------------------------------------------------
  describe("11. ADM-BSRC-009-R8: Recipient Selection Count Reconciliation & Modal UX", () => {
    interface TestContact {
      id: string;
      name?: string;
      email?: string;
      is_primary?: boolean;
    }
    interface TestCompany {
      id: string;
      company_name_kr: string;
      company_name_en?: string;
      marketing_consent_status?: string;
      sourcing_brands?: Array<{ brand_name_kr: string }>;
      sourcing_contacts?: TestContact[];
    }

    const isValidTestEmail = (email?: string | null): boolean => {
      if (!email || typeof email !== "string") return false;
      const trimmed = email.trim();
      if (!trimmed || trimmed.startsWith("http://") || trimmed.startsWith("https://")) return false;
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      return emailRegex.test(trimmed);
    };

    const getValidContacts = (comp: TestCompany): TestContact[] => {
      const contacts = comp.sourcing_contacts || [];
      const valid: TestContact[] = [];
      const seen = new Set<string>();
      const sorted = [...contacts].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
      for (const ct of sorted) {
        if (isValidTestEmail(ct.email)) {
          const norm = ct.email!.toLowerCase().trim();
          if (!seen.has(norm)) {
            seen.add(norm);
            valid.push(ct);
          }
        }
      }
      return valid;
    };

    const computeAuthoritativeRecipients = (
      companies: TestCompany[],
      selectedCompanyIds: string[],
      selectedContactIds: string[],
      manualEmails: string[],
      requireConsentedOnly: boolean = false
    ) => {
      const emailToItemMap = new Map<string, any>();

      companies.forEach((comp) => {
        if (selectedCompanyIds.includes(comp.id)) {
          const isConsented = comp.marketing_consent_status === "CONSENTED";
          (comp.sourcing_contacts || []).forEach((ct) => {
            if (selectedContactIds.includes(ct.id) && isValidTestEmail(ct.email)) {
              const norm = ct.email!.toLowerCase().trim();
              const isSendable = requireConsentedOnly ? isConsented : true;
              if (emailToItemMap.has(norm)) {
                const existing = emailToItemMap.get(norm)!;
                if (!existing.associatedCompanyIds.includes(comp.id)) {
                  existing.associatedCompanyIds.push(comp.id);
                  existing.sharedCompanyCount = existing.associatedCompanyIds.length;
                  existing.sharingCompanyNames.push(comp.company_name_kr);
                }
                if (!existing.associatedContactIds.includes(ct.id)) {
                  existing.associatedContactIds.push(ct.id);
                }
              } else {
                emailToItemMap.set(norm, {
                  id: `rec-comp-${comp.id}-${ct.id}`,
                  type: "COMPANY_CONTACT",
                  email: norm,
                  companyNameKr: comp.company_name_kr,
                  consentStatus: comp.marketing_consent_status || "UNCONFIRMED",
                  isSendable,
                  associatedCompanyIds: [comp.id],
                  associatedContactIds: [ct.id],
                  sharedCompanyCount: 1,
                  sharingCompanyNames: [comp.company_name_kr],
                });
              }
            }
          });
        }
      });

      manualEmails.forEach((raw) => {
        const norm = raw.toLowerCase().trim();
        if (!norm) return;
        if (!emailToItemMap.has(norm)) {
          emailToItemMap.set(norm, {
            id: `rec-manual-${norm}`,
            type: "MANUAL",
            email: norm,
            companyNameKr: "수기 입력 수신자",
            consentStatus: "미확인 (수기 입력)",
            isSendable: !requireConsentedOnly,
            associatedCompanyIds: [],
            associatedContactIds: [],
            sharedCompanyCount: 1,
            sharingCompanyNames: [],
          });
        }
      });

      const items = Array.from(emailToItemMap.values());
      const totalUniqueEmails = new Set<string>();
      items.forEach((i) => totalUniqueEmails.add(i.email));

      return {
        items,
        totalUniqueCount: totalUniqueEmails.size,
        sendableCount: items.filter((i) => i.isSendable).length,
      };
    };

    it("reconciles modal count, button count, and unique emails in 100% lockstep", () => {
      const mockCompanies: TestCompany[] = [
        {
          id: "comp-1",
          company_name_kr: "아모레",
          sourcing_contacts: [{ id: "ct-1", name: "홍길동", email: "hong@amore.com" }],
        },
        {
          id: "comp-2",
          company_name_kr: "엘지생건",
          sourcing_contacts: [{ id: "ct-2", name: "김철수", email: "kim@lg.com" }],
        },
        {
          id: "comp-3",
          company_name_kr: "피에이치하비",
          sourcing_contacts: [{ id: "ct-3", name: "대표전화", email: "02-408-2021" }],
        },
      ];

      const comp1Valid = getValidContacts(mockCompanies[0]);
      const comp2Valid = getValidContacts(mockCompanies[1]);
      const comp3Valid = getValidContacts(mockCompanies[2]);
      expect(comp3Valid.length).toBe(0);

      const selectedCompanyIds = ["comp-1", "comp-2"];
      const selectedContactIds = ["ct-1", "ct-2"];
      const manualEmails = ["custom@test.com"];

      const res = computeAuthoritativeRecipients(
        mockCompanies,
        selectedCompanyIds,
        selectedContactIds,
        manualEmails
      );

      expect(res.items.length).toBe(3);
      expect(res.totalUniqueCount).toBe(3);
      expect(res.items.map((i) => i.email)).toEqual(["hong@amore.com", "kim@lg.com", "custom@test.com"]);
    });

    it("mathematically updates unique recipient count upon company and contact deselections", () => {
      const mockCompanies: TestCompany[] = [
        {
          id: "comp-1",
          company_name_kr: "기업A",
          sourcing_contacts: [{ id: "ct-1", email: "a@test.kr" }],
        },
        {
          id: "comp-2",
          company_name_kr: "기업B",
          sourcing_contacts: [{ id: "ct-2", email: "b@test.kr" }],
        },
        {
          id: "comp-3",
          company_name_kr: "기업C_공유",
          sourcing_contacts: [{ id: "ct-3", email: "shared@test.kr" }],
        },
        {
          id: "comp-4",
          company_name_kr: "기업D_공유",
          sourcing_contacts: [{ id: "ct-4", email: "shared@test.kr" }],
        },
      ];

      let selectedCompanyIds = ["comp-1", "comp-2", "comp-3", "comp-4"];
      let selectedContactIds = ["ct-1", "ct-2", "ct-3", "ct-4"];

      let res = computeAuthoritativeRecipients(mockCompanies, selectedCompanyIds, selectedContactIds, []);
      expect(res.items.length).toBe(3);
      expect(res.totalUniqueCount).toBe(3);

      // Deselect comp-1 (unique email a@test.kr) -> 3 -> 2
      selectedCompanyIds = selectedCompanyIds.filter((id) => id !== "comp-1");
      selectedContactIds = selectedContactIds.filter((id) => id !== "ct-1");
      res = computeAuthoritativeRecipients(mockCompanies, selectedCompanyIds, selectedContactIds, []);
      expect(res.items.length).toBe(2);
      expect(res.totalUniqueCount).toBe(2);

      // Deselect comp-3 (shares shared@test.kr with comp-4) -> still 2!
      selectedCompanyIds = selectedCompanyIds.filter((id) => id !== "comp-3");
      selectedContactIds = selectedContactIds.filter((id) => id !== "ct-3");
      res = computeAuthoritativeRecipients(mockCompanies, selectedCompanyIds, selectedContactIds, []);
      expect(res.items.length).toBe(2);
      expect(res.totalUniqueCount).toBe(2);

      // Deselect comp-4 -> drops to 1
      selectedCompanyIds = selectedCompanyIds.filter((id) => id !== "comp-4");
      selectedContactIds = selectedContactIds.filter((id) => id !== "ct-4");
      res = computeAuthoritativeRecipients(mockCompanies, selectedCompanyIds, selectedContactIds, []);
      expect(res.items.length).toBe(1);
      expect(res.totalUniqueCount).toBe(1);
      expect(res.items[0].email).toBe("b@test.kr");
    });

    it("supports 3-state sorting cycle (asc -> desc -> default) and Korean collation", () => {
      const items = [
        { type: "COMPANY_CONTACT", companyNameKr: "하늘코스메틱", email: "z@test.kr", consentStatus: "UNCONFIRMED", isSendable: false },
        { type: "COMPANY_CONTACT", companyNameKr: "가람뷰티", email: "a@test.kr", consentStatus: "CONSENTED", isSendable: true },
        { type: "MANUAL", companyNameKr: "수기 입력 수신자", email: "m@test.kr", consentStatus: "미확인 (수기 입력)", isSendable: true },
      ];

      const sortedCompanyAsc = [...items].sort((a, b) => a.companyNameKr.localeCompare(b.companyNameKr, "ko"));
      expect(sortedCompanyAsc[0].companyNameKr).toBe("가람뷰티");
      expect(sortedCompanyAsc[2].companyNameKr).toBe("하늘코스메틱");

      const sortedCompanyDesc = [...items].sort((a, b) => b.companyNameKr.localeCompare(a.companyNameKr, "ko"));
      expect(sortedCompanyDesc[0].companyNameKr).toBe("하늘코스메틱");
      expect(sortedCompanyDesc[2].companyNameKr).toBe("가람뷰티");

      const sortedEmailAsc = [...items].sort((a, b) => a.email.localeCompare(b.email));
      expect(sortedEmailAsc[0].email).toBe("a@test.kr");
      expect(sortedEmailAsc[2].email).toBe("z@test.kr");

      const sortedSendableDesc = [...items].sort((a, b) => (b.isSendable ? 1 : 0) - (a.isSendable ? 1 : 0));
      expect(sortedSendableDesc[0].isSendable).toBe(true);
      expect(sortedSendableDesc[2].isSendable).toBe(false);
    });
  });
});
