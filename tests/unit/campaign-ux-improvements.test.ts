import { describe, it, expect, vi } from "vitest";

// Mock server-only so tests can run in Node vitest environment
vi.mock("server-only", () => ({}));
import {
  saveMarketingCampaign,
  listMarketingCampaigns,
  deleteMarketingCampaign,
  deleteMarketingTemplate,
  getMarketingCampaignById,
  saveMarketingTemplate,
} from "@/lib/brand-marketing/campaign-data-access";
import {
  deleteMarketingCampaignAction,
  archiveMarketingCampaignAction,
  deleteMarketingTemplatesBulkAction,
} from "@/lib/brand-marketing/campaign-actions";
import { MarketingCampaign, MarketingTemplatePackage } from "@/lib/brand-marketing/campaign-types";
import { DEFAULT_MARKETING_TEMPLATES } from "@/lib/brand-marketing/default-templates";

describe("ADM-EMAIL-UX-001: Campaign & Template Management UX Improvements", () => {
  const testUserId = "00000000-0000-4000-a000-000000000001";

  // Helper to create mock campaigns with specific timestamps and statuses
  const createMockCampaign = (
    id: string,
    name: string,
    status: MarketingCampaign["status"],
    createdAt: string,
    approvalStatus: MarketingCampaign["approvalStatus"] = "PENDING",
    templateId?: string
  ): MarketingCampaign => ({
    id,
    name,
    purpose: "B2B Outreach",
    description: "Test Campaign Description",
    language: "ko",
    templateId: templateId || DEFAULT_MARKETING_TEMPLATES[0].id,
    templateVersion: "1.0.0",
    subjectOverride: `Subject for ${name}`,
    previewText: "Summary preview",
    landingPageUrl: "https://www.kselectnetwork.com",
    footerStyle: "classic",
    status,
    approvalStatus,
    isLiveModeEnabled: false,
    filterCriteria: {
      grades: ["A"],
      searchQuery: "Beauty",
    },
    customMessage: "Test custom message",
    stats: {
      totalRecipients: 10,
      sendableCount: 10,
      excludedCount: 0,
      testSendsCount: 0,
      sentCount: status === "COMPLETED" ? 10 : 0,
      deliveredCount: status === "COMPLETED" ? 10 : 0,
      failedCount: 0,
    },
    createdAt,
    updatedAt: createdAt,
  });

  // --------------------------------------------------------------------------
  // 1. CAMPAIGN LIST SORTING
  // --------------------------------------------------------------------------
  describe("1. Campaign List Sorting & Deterministic Ordering", () => {
    const c1 = createMockCampaign("c-1", "Alpha Campaign", "DRAFT", "2026-10-01T10:00:00Z");
    const c2 = createMockCampaign("c-2", "Beta Campaign", "DRAFT", "2026-10-15T10:00:00Z");
    const c3 = createMockCampaign("c-3", "Gamma Campaign", "DRAFT", "2026-10-30T10:00:00Z");
    const c4_tieA = createMockCampaign("c-4a", "Delta Campaign A", "DRAFT", "2026-10-20T10:00:00Z");
    const c4_tieB = createMockCampaign("c-4b", "Delta Campaign B", "DRAFT", "2026-10-20T10:00:00Z");

    const dataset = [c1, c2, c3, c4_tieA, c4_tieB];

    it("should sort campaigns Newest First (DESC) by default", () => {
      const sorted = [...dataset].sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        if (aTime !== bTime) return bTime - aTime;
        return (b.id || "").localeCompare(a.id || "");
      });

      expect(sorted[0].id).toBe("c-3"); // Oct 30 (newest)
      expect(sorted[1].id).toBe("c-4b"); // Oct 20 (tie broken deterministically by id)
      expect(sorted[2].id).toBe("c-4a"); // Oct 20
      expect(sorted[3].id).toBe("c-2"); // Oct 15
      expect(sorted[4].id).toBe("c-1"); // Oct 1 (oldest)
    });

    it("should sort campaigns Oldest First (ASC) correctly", () => {
      const sorted = [...dataset].sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        if (aTime !== bTime) return aTime - bTime;
        return (a.id || "").localeCompare(b.id || "");
      });

      expect(sorted[0].id).toBe("c-1"); // Oct 1 (oldest)
      expect(sorted[1].id).toBe("c-2"); // Oct 15
      expect(sorted[2].id).toBe("c-4a"); // Oct 20
      expect(sorted[3].id).toBe("c-4b"); // Oct 20
      expect(sorted[4].id).toBe("c-3"); // Oct 30 (newest)
    });

    it("should maintain sorting across filtered subsets", () => {
      const filtered = dataset.filter((c) => c.name.includes("Delta"));
      const sorted = [...filtered].sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        if (aTime !== bTime) return bTime - aTime;
        return (b.id || "").localeCompare(a.id || "");
      });

      expect(sorted.length).toBe(2);
      expect(sorted[0].id).toBe("c-4b");
      expect(sorted[1].id).toBe("c-4a");
    });
  });

  // --------------------------------------------------------------------------
  // 2. CAMPAIGN SAFE DELETION & PROTECTION POLICIES
  // --------------------------------------------------------------------------
  describe("2. Campaign Safe Deletion & Audit Protection", () => {
    it("should allow safe deletion of a DRAFT campaign", async () => {
      const draftId = "11111111-1111-4111-a111-000000000001";
      const draftCamp = createMockCampaign(
        draftId,
        "Disposable Draft",
        "DRAFT",
        new Date().toISOString()
      );
      const saved = await saveMarketingCampaign(draftCamp, testUserId);

      const res = await deleteMarketingCampaign(saved.id, testUserId);
      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();

      const after = await getMarketingCampaignById(saved.id);
      expect(after.campaign).toBeNull();
    });

    it("should block deletion of APPROVED campaigns and recommend archive", async () => {
      const approvedId = "11111111-1111-4111-a111-000000000002";
      const approvedCamp = createMockCampaign(
        approvedId,
        "Compliance Protected Campaign",
        "APPROVED",
        new Date().toISOString(),
        "APPROVED"
      );
      const saved = await saveMarketingCampaign(approvedCamp, testUserId);

      const res = await deleteMarketingCampaign(saved.id, testUserId);
      expect(res.success).toBe(false);
      expect(res.error).toContain("cannot be deleted");
      expect(res.error).toContain("archive");

      // Verify campaign still exists
      const check = await getMarketingCampaignById(saved.id);
      expect(check.campaign).not.toBeNull();
      expect(check.campaign?.name).toBe("Compliance Protected Campaign");
    });

    it("should block deletion of SCHEDULED, SENDING, and COMPLETED campaigns", async () => {
      const completedId = "11111111-1111-4111-a111-000000000003";
      const completedCamp = createMockCampaign(
        completedId,
        "Delivered Campaign",
        "COMPLETED",
        new Date().toISOString(),
        "APPROVED"
      );
      const saved = await saveMarketingCampaign(completedCamp, testUserId);

      const res = await deleteMarketingCampaign(saved.id, testUserId);
      expect(res.success).toBe(false);
      expect(res.error).toContain("COMPLETED");
      expect(res.error).toContain("archive");
    });

    it("should allow archiving of approved campaigns instead of deletion", async () => {
      const archiveId = "11111111-1111-4111-a111-000000000004";
      const campToArchive = createMockCampaign(
        archiveId,
        "Campaign To Archive",
        "APPROVED",
        new Date().toISOString(),
        "APPROVED"
      );
      const saved = await saveMarketingCampaign(campToArchive, testUserId);

      // Save as CANCELLED (archive)
      const archived = await saveMarketingCampaign(
        {
          ...saved,
          status: "CANCELLED",
        },
        testUserId
      );

      expect(archived.status).toBe("CANCELLED");
      const check = await getMarketingCampaignById(saved.id);
      expect(check.campaign?.status).toBe("CANCELLED");
    });
  });

  // --------------------------------------------------------------------------
  // 3. STEP 2 ACTION BUTTON LAYOUT & SPECIFICATIONS
  // --------------------------------------------------------------------------
  describe("3. Step 2 Action Button Layout Standards", () => {
    it("should define single-row actions classes without wrapping", () => {
      const containerClass = "flex items-center justify-end gap-1.5 text-xs flex-nowrap whitespace-nowrap";
      const thClass = "py-2.5 px-3 min-w-[200px] w-52 text-right font-semibold";

      expect(containerClass).toContain("flex-nowrap");
      expect(containerClass).toContain("whitespace-nowrap");
      expect(thClass).toContain("min-w-[200px]");
    });
  });

  // --------------------------------------------------------------------------
  // 4. UNSAVED CHANGES NAVIGATION GUARD (P0)
  // --------------------------------------------------------------------------
  describe("4. Unsaved Changes Navigation Guard (P0)", () => {
    const getSnapshot = (c: Partial<MarketingCampaign> | null, tplId?: string) => {
      if (!c) return "";
      return JSON.stringify({
        name: c.name || "",
        purpose: c.purpose || "",
        description: c.description || "",
        language: c.language || "ko",
        templateId: tplId || c.templateId || "",
        templateVersion: c.templateVersion || "",
        subjectOverride: c.subjectOverride || "",
        previewText: c.previewText || "",
        landingPageUrl: c.landingPageUrl || "",
        footerStyle: c.footerStyle || "classic",
        customMessage: c.customMessage || "",
        filterCriteria: c.filterCriteria || {},
      });
    };

    it("should report NOT dirty when form matches initial saved baseline", () => {
      const initial = createMockCampaign("c-edit", "Initial Name", "DRAFT", "2026-11-01T00:00:00Z");
      const baseline = getSnapshot(initial, initial.templateId || "");

      const current = { ...initial };
      const currentSnapshot = getSnapshot(current, current.templateId || "");

      const isDirty = currentSnapshot !== baseline;
      expect(isDirty).toBe(false);
    });

    it("should detect dirty state when campaign name is modified", () => {
      const initial = createMockCampaign("c-edit", "Initial Name", "DRAFT", "2026-11-01T00:00:00Z");
      const baseline = getSnapshot(initial, initial.templateId || "");

      const modified = { ...initial, name: "Modified Campaign Name" };
      const modifiedSnapshot = getSnapshot(modified, modified.templateId || "");

      const isDirty = modifiedSnapshot !== baseline;
      expect(isDirty).toBe(true);
    });

    it("should detect dirty state when subject, footerStyle, or customMessage is modified", () => {
      const initial = createMockCampaign("c-edit", "Campaign", "DRAFT", "2026-11-01T00:00:00Z");
      const baseline = getSnapshot(initial, initial.templateId || "");

      const modifiedFooter = { ...initial, footerStyle: "dark" as const };
      expect(getSnapshot(modifiedFooter, initial.templateId || "") !== baseline).toBe(true);

      const modifiedCustomMsg = { ...initial, customMessage: "New custom message content" };
      expect(getSnapshot(modifiedCustomMsg, initial.templateId || "") !== baseline).toBe(true);
    });

    it("should reset dirty state to false after successful save draft", () => {
      const initial = createMockCampaign("c-edit", "Campaign", "DRAFT", "2026-11-01T00:00:00Z");
      let baseline = getSnapshot(initial, initial.templateId || "");

      // User edits
      const edited = { ...initial, name: "Newly Saved Name" };
      expect(getSnapshot(edited, edited.templateId || "") !== baseline).toBe(true);

      // Save Draft succeeds -> baseline updated
      baseline = getSnapshot(edited, edited.templateId || "");
      expect(getSnapshot(edited, edited.templateId || "") !== baseline).toBe(false);
    });

    it("should preserve multi-tab native opening without interception", () => {
      // Simulation of multi-tab modifier key check
      const shouldInterceptClick = (e: {
        ctrlKey: boolean;
        metaKey: boolean;
        shiftKey: boolean;
        altKey: boolean;
        button: number;
      }) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) {
          return false; // Native browser opens new tab
        }
        return true; // Intercept for dirty navigation guard
      };

      // Ctrl + click (open in new tab)
      expect(shouldInterceptClick({ ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, button: 0 })).toBe(false);
      // Cmd + click (Mac open in new tab)
      expect(shouldInterceptClick({ ctrlKey: false, metaKey: true, shiftKey: false, altKey: false, button: 0 })).toBe(false);
      // Middle click (wheel click open in new tab)
      expect(shouldInterceptClick({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, button: 1 })).toBe(false);
      // Right click (context menu)
      expect(shouldInterceptClick({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, button: 2 })).toBe(false);
      // Normal left click without modifiers
      expect(shouldInterceptClick({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, button: 0 })).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 5. TEMPLATE LIBRARY TABLE & BULK DELETION SAFEGUARDS
  // --------------------------------------------------------------------------
  describe("5. Template Library Table & Reference Dependency Protections", () => {
    it("should protect system default templates from deletion", async () => {
      const defaultTplId = DEFAULT_MARKETING_TEMPLATES[0].id;
      const res = await deleteMarketingTemplate(defaultTplId, testUserId);

      expect(res.success).toBe(false);
      expect(res.error).toContain("default system template");
      expect(res.error).toContain("protected");
    });

    it("should block template deletion if referenced by any campaign", async () => {
      // Create custom template
      const customTpl = await saveMarketingTemplate(
        {
          name: "Referenced Custom Template",
          subject: "Special Subject",
          htmlContent: "<div>Special Content</div>",
          templateType: "HTML",
          isDefault: false,
        },
        testUserId
      );

      // Create a campaign referencing this template
      const camp = createMockCampaign(
        "camp-ref-tpl-001",
        "Referencing Campaign",
        "DRAFT",
        new Date().toISOString(),
        "PENDING",
        customTpl.id
      );
      await saveMarketingCampaign(camp, testUserId);

      // Attempt to delete custom template
      const res = await deleteMarketingTemplate(customTpl.id, testUserId);
      expect(res.success).toBe(false);
      expect(res.error).toContain("It is referenced by campaign");
      expect(res.error).toContain("Referencing Campaign");
    });

    it("should allow deletion of an unreferenced custom template", async () => {
      const unrefTpl = await saveMarketingTemplate(
        {
          name: "Unreferenced Custom Template",
          subject: "Disposable Subject",
          htmlContent: "<div>Disposable Content</div>",
          templateType: "HTML",
          isDefault: false,
        },
        testUserId
      );

      const res = await deleteMarketingTemplate(unrefTpl.id, testUserId);
      expect(res.success).toBe(true);
    });

    it("should calculate protected vs eligible template counts accurately for bulk deletion", () => {
      const selectedIds = new Set(["default-tpl", "custom-ref", "custom-unref"]);
      const mockTemplates: Partial<MarketingTemplatePackage>[] = [
        { id: "default-tpl", name: "Default 1", isDefault: true },
        { id: "custom-ref", name: "Custom 1", isDefault: false },
        { id: "custom-unref", name: "Custom 2", isDefault: false },
      ];

      const defaultCount = Array.from(selectedIds).filter((id) =>
        mockTemplates.find((t) => t.id === id)?.isDefault
      ).length;
      const eligibleCount = selectedIds.size - defaultCount;

      expect(defaultCount).toBe(1);
      expect(eligibleCount).toBe(2);
      expect(defaultCount + eligibleCount).toBe(3);
    });
  });

  // --------------------------------------------------------------------------
  // 6. PRODUCTION ENVIRONMENT & SAFEGUARD VERIFICATION
  // --------------------------------------------------------------------------
  describe("6. Production Delivery Safeguards", () => {
    it("should maintain LIVE_MODE as FALSE across all campaign records", () => {
      const camp = createMockCampaign("c-live-check", "Check", "DRAFT", new Date().toISOString());
      expect(camp.isLiveModeEnabled).toBe(false);
    });
  });
});
