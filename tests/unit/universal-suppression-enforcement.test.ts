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
  }),
  headers: async () => new Headers(),
}));

const mockVerifyAdminSession = vi.fn();
const mockGetAdminStaffContext = vi.fn();

vi.mock("@/lib/auth/dal", () => ({
  verifyAdminSession: () => mockVerifyAdminSession(),
  getAdminStaffContext: () => mockGetAdminStaffContext(),
}));

// Mock email notification provider
const mockSendEmail = vi.fn();
vi.mock("@/lib/notifications/email", async () => {
  const actual = await vi.importActual<any>("@/lib/notifications/email");
  return {
    ...actual,
    sendEmail: (payload: any) => mockSendEmail(payload),
    maskEmailAddress: actual.maskEmailAddress,
  };
});

// Mock Supabase admin client for suppression list queries
let mockDbSuppression = new Map<string, any>();
let simulateDbError = false;

function mockFromTable(table: string) {
  if (table === "marketing_suppression_list") {
    return {
      select: (cols: string) => ({
        eq: (col: string, val: any) => ({
          order: () => Promise.resolve({ data: Array.from(mockDbSuppression.values()), error: null }),
          limit: () => {
            if (simulateDbError) {
              return Promise.resolve({
                data: null,
                error: { code: "50000", message: "Simulated database connection timeout/error" },
              });
            }
            const normalized = String(val).toLowerCase().trim();
            const record = mockDbSuppression.get(normalized);
            return Promise.resolve({
              data: record ? [record] : [],
              error: null,
            });
          },
        }),
      }),
    };
  }
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        limit: () => Promise.resolve({ data: [], error: null }),
      }),
      order: () => Promise.resolve({ data: [], error: null }),
    }),
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => mockFromTable(table),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: (table: string) => mockFromTable(table),
  }),
}));

import {
  checkEmailSuppression,
  isEmailSuppressed,
  formatSuppressionReasonKorean,
  clearMemorySuppression,
} from "@/lib/brand-marketing/unsubscribe";
import {
  sendTestCampaignEmailsAction,
  sendTestCampaignEmailAction,
} from "@/lib/brand-marketing/campaign-actions";
import {
  sendTestCampaignEmail,
  runCampaignDryRun,
} from "@/lib/brand-marketing/campaign-data-access";

describe("ADM-EMAIL-SUP-006: Universal Suppression Enforcement for Marketing Test & Campaign Sends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMemorySuppression();
    mockDbSuppression.clear();
    simulateDbError = false;

    // Default admin session
    mockVerifyAdminSession.mockResolvedValue({ userId: "admin-user-001" });
    mockGetAdminStaffContext.mockResolvedValue({
      email: "admin@kselectnetwork.com",
      isSuperAdmin: true,
      hasPermission: () => true,
    });

    // Default mock send email implementation
    mockSendEmail.mockResolvedValue({
      success: true,
      messageId: "mock-resend-msg-12345",
    });
  });

  describe("1. Suppression Status & Fail-Closed Lookup Evaluation", () => {
    it("should correctly identify ACTIVE UNSUBSCRIBED status", async () => {
      mockDbSuppression.set("chae@letusto.com", {
        id: "sup-1",
        email: "chae@letusto.com",
        reason: "UNSUBSCRIBED",
        status: "ACTIVE",
        suppressed_at: "2026-11-01T12:00:00Z",
      });

      const res = await checkEmailSuppression("chae@letusto.com");
      expect(res.isSuppressed).toBe(true);
      expect(res.status).toBe("ACTIVE");
      expect(res.reason).toBe("UNSUBSCRIBED");
      expect(formatSuppressionReasonKorean(res.reason)).toBe("수신거부");
    });

    it("should correctly identify ACTIVE BOUNCED status", async () => {
      mockDbSuppression.set("bounced@letusto.com", {
        id: "sup-2",
        email: "bounced@letusto.com",
        reason: "BOUNCED",
        status: "ACTIVE",
        suppressed_at: "2026-11-01T12:00:00Z",
      });

      const res = await checkEmailSuppression("bounced@letusto.com");
      expect(res.isSuppressed).toBe(true);
      expect(res.status).toBe("ACTIVE");
      expect(res.reason).toBe("BOUNCED");
      expect(formatSuppressionReasonKorean(res.reason)).toBe("영구 반송");
    });

    it("should correctly identify ACTIVE COMPLAINT status", async () => {
      mockDbSuppression.set("complaint@letusto.com", {
        id: "sup-3",
        email: "complaint@letusto.com",
        reason: "COMPLAINT",
        status: "ACTIVE",
        suppressed_at: "2026-11-01T12:00:00Z",
      });

      const res = await checkEmailSuppression("complaint@letusto.com");
      expect(res.isSuppressed).toBe(true);
      expect(res.status).toBe("ACTIVE");
      expect(res.reason).toBe("COMPLAINT");
      expect(formatSuppressionReasonKorean(res.reason)).toBe("스팸 신고");
    });

    it("should correctly identify ACTIVE MANUAL_ADMIN status", async () => {
      mockDbSuppression.set("manual@letusto.com", {
        id: "sup-4",
        email: "manual@letusto.com",
        reason: "MANUAL_ADMIN",
        status: "ACTIVE",
        suppressed_at: "2026-11-01T12:00:00Z",
      });

      const res = await checkEmailSuppression("manual@letusto.com");
      expect(res.isSuppressed).toBe(true);
      expect(res.status).toBe("ACTIVE");
      expect(res.reason).toBe("MANUAL_ADMIN");
      expect(formatSuppressionReasonKorean(res.reason)).toBe("관리자 수동 제외");
    });

    it("should treat RELEASED records as not suppressed", async () => {
      mockDbSuppression.set("released@letusto.com", {
        id: "sup-5",
        email: "released@letusto.com",
        reason: "UNSUBSCRIBED",
        status: "RELEASED",
        released_at: "2026-11-01T15:00:00Z",
      });

      const res = await checkEmailSuppression("released@letusto.com");
      expect(res.isSuppressed).toBe(false);
      expect(res.status).toBe("RELEASED");
    });

    it("FAIL-CLOSED INVARIANT: should fail closed on database lookup failure or timeout", async () => {
      simulateDbError = true;

      const res = await checkEmailSuppression("any.user@letusto.com");
      expect(res.isSuppressed).toBe(true);
      expect(res.isFailClosedError).toBe(true);
      expect(res.reason).toBe("SYSTEM_LOOKUP_FAILURE");
      expect(formatSuppressionReasonKorean(res.reason)).toContain("Fail-Closed");

      // isEmailSuppressed helper must also return true
      const isBlocked = await isEmailSuppressed("any.user@letusto.com");
      expect(isBlocked).toBe(true);
    });
  });

  describe("2. Step 5 Test Send Universal Suppression Enforcement", () => {
    const testCampaignId = "camp-test-001";
    const testSubject = "K SELECT Network Partnership Proposal";
    const testHtml = "<html><body><p>Hello World</p></body></html>";

    it("BLOCKS test send to ACTIVE UNSUBSCRIBED recipient even when domain is internal allowlisted (@letusto.com)", async () => {
      mockDbSuppression.set("chae@letusto.com", {
        id: "sup-chae",
        email: "chae@letusto.com",
        reason: "UNSUBSCRIBED",
        status: "ACTIVE",
      });

      const res = await sendTestCampaignEmailsAction(
        testCampaignId,
        "chae@letusto.com",
        testSubject,
        testHtml
      );

      // Verify rejection
      expect(res.success).toBe(false);
      expect(res.totalSent).toBe(0);
      expect(res.totalFailed).toBe(1);
      expect(res.error).toContain("발송이 차단되었습니다");
      expect(res.error).toContain("chae@letusto.com");
      expect(res.error).toContain("수신거부");

      // Verify provider submission was NEVER called
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("BLOCKS test send to ACTIVE BOUNCED recipient with exact reason explanation", async () => {
      mockDbSuppression.set("bounced.admin@letusto.com", {
        id: "sup-bounced",
        email: "bounced.admin@letusto.com",
        reason: "BOUNCED",
        status: "ACTIVE",
      });

      const res = await sendTestCampaignEmailsAction(
        testCampaignId,
        "bounced.admin@letusto.com",
        testSubject,
        testHtml
      );

      expect(res.success).toBe(false);
      expect(res.totalSent).toBe(0);
      expect(res.error).toContain("영구 반송");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("BLOCKS test send to ACTIVE COMPLAINT recipient with exact reason explanation", async () => {
      mockDbSuppression.set("complaint.tester@kselectnetwork.com", {
        id: "sup-complaint",
        email: "complaint.tester@kselectnetwork.com",
        reason: "COMPLAINT",
        status: "ACTIVE",
      });

      const res = await sendTestCampaignEmailsAction(
        testCampaignId,
        "complaint.tester@kselectnetwork.com",
        testSubject,
        testHtml
      );

      expect(res.success).toBe(false);
      expect(res.totalSent).toBe(0);
      expect(res.error).toContain("스팸 신고");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("BLOCKS test send when suppression lookup fails (Fail-Closed)", async () => {
      simulateDbError = true;

      const res = await sendTestCampaignEmailsAction(
        testCampaignId,
        "valid.tester@letusto.com",
        testSubject,
        testHtml
      );

      expect(res.success).toBe(false);
      expect(res.totalSent).toBe(0);
      expect(res.error).toContain("발송이 차단되었습니다");
      expect(res.error).toContain("Fail-Closed");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("ALL-OR-NOTHING POLICY: Mixed batch with 1 suppressed and 1 allowed sends ZERO emails", async () => {
      mockDbSuppression.set("chae@letusto.com", {
        id: "sup-chae",
        email: "chae@letusto.com",
        reason: "UNSUBSCRIBED",
        status: "ACTIVE",
      });
      // skim@letusto.com is NOT suppressed and is an allowed internal domain

      const res = await sendTestCampaignEmailsAction(
        testCampaignId,
        "skim@letusto.com, chae@letusto.com",
        testSubject,
        testHtml
      );

      // Entire batch must be aborted
      expect(res.success).toBe(false);
      expect(res.totalRequested).toBe(2);
      expect(res.totalSent).toBe(0);
      expect(res.totalFailed).toBe(2);
      expect(res.error).toContain("chae@letusto.com");

      // Results must show individual status
      const chaeResult = res.results.find((r) => r.email === "chae@letusto.com");
      const skimResult = res.results.find((r) => r.email === "skim@letusto.com");
      expect(chaeResult?.success).toBe(false);
      expect(chaeResult?.error).toContain("수신거부");
      expect(skimResult?.success).toBe(false);
      expect(skimResult?.error).toContain("All-or-Nothing Policy");

      // Absolutely ZERO provider calls made
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("Admin role / Super Admin CANNOT bypass suppression enforcement", async () => {
      mockGetAdminStaffContext.mockResolvedValue({
        email: "superadmin@letusto.com",
        isSuperAdmin: true,
        hasPermission: () => true,
      });

      mockDbSuppression.set("chae@letusto.com", {
        id: "sup-chae",
        email: "chae@letusto.com",
        reason: "UNSUBSCRIBED",
        status: "ACTIVE",
      });

      const res = await sendTestCampaignEmailAction(
        testCampaignId,
        "chae@letusto.com",
        testSubject,
        testHtml
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("발송이 차단되었습니다");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("SUCCESS: Clean, unsuppressed allowlisted address succeeds and invokes gateway once", async () => {
      // unsuppressed@letusto.com is not in mockDbSuppression
      const res = await sendTestCampaignEmailsAction(
        testCampaignId,
        "unsuppressed@letusto.com",
        testSubject,
        testHtml
      );

      expect(res.success).toBe(true);
      expect(res.totalSent).toBe(1);
      expect(res.totalFailed).toBe(0);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "unsuppressed@letusto.com",
          subject: expect.stringContaining("[TEST EMAIL]"),
        })
      );
    });
  });

  describe("3. Defense-in-Depth in sendTestCampaignEmail Data Access", () => {
    it("DIRECT CALL: sendTestCampaignEmail unconditionally rejects suppressed address", async () => {
      mockDbSuppression.set("suppressed.direct@letusto.com", {
        id: "sup-dir",
        email: "suppressed.direct@letusto.com",
        reason: "MANUAL_ADMIN",
        status: "ACTIVE",
      });

      const res = await sendTestCampaignEmail(
        "camp-direct",
        "suppressed.direct@letusto.com",
        "Subject",
        "<p>Content</p>"
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("발송이 차단되었습니다");
      expect(res.error).toContain("관리자 수동 제외");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe("4. Candidate Selection & Dry-Run Suppression Exclusion", () => {
    const mockClient: any = {
      from: (table: string) => mockFromTable(table),
    };

    it("excludes suppressed address during campaign dry-run and marks EXCLUDED_SUPPRESSED", async () => {
      mockDbSuppression.set("suppressed.candidate@letusto.com", {
        id: "sup-cand",
        email: "suppressed.candidate@letusto.com",
        reason: "UNSUBSCRIBED",
        status: "ACTIVE",
      });

      // Run dry-run with manual email candidates
      const report = await runCampaignDryRun(
        "camp-dryrun",
        {
          requireConsentedOnly: false,
          manualEmails: [
            "clean.candidate@letusto.com",
            "suppressed.candidate@letusto.com",
          ],
        },
        mockClient
      );

      expect(report.suppressedFiltered).toBe(1);
      expect(report.sendableCount).toBe(1);
      expect(report.excludedCount).toBe(1);
    });

    it("RELEASED record still requires commercial consent under strict consent policy", async () => {
      mockDbSuppression.set("released.candidate@letusto.com", {
        id: "sup-rel",
        email: "released.candidate@letusto.com",
        reason: "UNSUBSCRIBED",
        status: "RELEASED",
      });

      // Manual entries under requireConsentedOnly = true must be flagged as EXCLUDED_UNCONFIRMED_CONSENT
      const report = await runCampaignDryRun(
        "camp-dryrun-rel",
        {
          requireConsentedOnly: true,
          manualEmails: [
            "released.candidate@letusto.com",
          ],
        },
        mockClient
      );

      // Not filtered as suppressed because it is RELEASED
      expect(report.suppressedFiltered).toBe(0);
      // But filtered as unconfirmed consent because released != consented
      expect(report.unconfirmedConsentFiltered).toBe(1);
      expect(report.sendableCount).toBe(0);
    });
  });
});
