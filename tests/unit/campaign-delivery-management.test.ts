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
const dummyCompanyId = "d1111111-1111-4111-a111-111111111111";

let mockCampaignRecord: any = null;
let mockRecipients: any[] = [];
let mockSuppressionList: string[] = [];
let mockLogs: any[] = [];

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

  if (table === "marketing_campaigns") {
    return {
      select: () => {
        const chain: any = {
          eq: (col: string, val: any) => {
            if (col === "status") {
              const matches = mockCampaignRecord && mockCampaignRecord.status === val ? [mockCampaignRecord] : [];
              return {
                ...chain,
                lte: () => Promise.resolve({ data: matches, error: null }),
                then: (cb: any) => cb({ data: matches, error: null }),
              };
            }
            return {
              single: () => Promise.resolve({ data: mockCampaignRecord, error: mockCampaignRecord ? null : { message: "Not found" } }),
              maybeSingle: () => Promise.resolve({ data: mockCampaignRecord, error: null }),
            };
          },
        };
        return chain;
      },
      update: (payload: any) => ({
        eq: (col: string, val: any) => {
          if (mockCampaignRecord && mockCampaignRecord.id === val) {
            mockCampaignRecord = { ...mockCampaignRecord, ...payload };
          }
          return {
            select: () => ({
              single: () => Promise.resolve({ data: mockCampaignRecord, error: null }),
            }),
            then: (cb: any) => cb({ data: mockCampaignRecord, error: null }),
          };
        },
      }),
    };
  }

  if (table === "marketing_campaign_recipients") {
    return {
      select: () => ({
        eq: (col: string, val: any) => Promise.resolve({
          data: mockRecipients.filter((r) => r.campaign_id === val),
          error: null,
        }),
      }),
      update: (payload: any) => ({
        eq: (col: string, val: any) => {
          const idx = mockRecipients.findIndex((r) => r.id === val);
          if (idx >= 0) {
            mockRecipients[idx] = { ...mockRecipients[idx], ...payload };
          }
          return Promise.resolve({ data: mockRecipients[idx], error: null });
        },
      }),
    };
  }

  if (table === "marketing_campaign_logs") {
    return {
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: mockLogs, error: null }),
        }),
      }),
      insert: (log: any) => {
        mockLogs.push(log);
        return Promise.resolve({ data: log, error: null });
      },
    };
  }

  return {
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: null, error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
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
  updateCampaignSchedule,
  executeCampaignDeliverySimulation,
  processScheduledCampaigns,
  getMarketingCampaignById,
} from "@/lib/brand-marketing/campaign-data-access";
import {
  scheduleMarketingCampaignAction,
  cancelCampaignScheduleAction,
  executeCampaignDeliveryAction,
} from "@/lib/brand-marketing/campaign-actions";

describe("ADM-EMAIL-APP-002: Approved Campaign Delivery Management & Scheduling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminSession.mockResolvedValue({ id: "admin-user-001", role: "ADMIN" });
    mockGetAdminStaffContext.mockResolvedValue({
      email: "admin@kselectnetwork.com",
      fullName: "Admin Staff",
    });

    mockSuppressionList = ["optout@example.com"];
    mockLogs = [];

    mockRecipients = [
      {
        id: "rec-1",
        campaign_id: dummyCampaignId,
        company_id: dummyCompanyId,
        recipient_email: "active.buyer@partner.com",
        recipient_name: "Buyer One",
        company_name_kr: "우수파트너사",
        send_eligibility: "ELIGIBLE",
        status: "PENDING",
      },
      {
        id: "rec-2",
        campaign_id: dummyCampaignId,
        company_id: dummyCompanyId,
        recipient_email: "optout@example.com",
        recipient_name: "Opted Out Buyer",
        company_name_kr: "수신거부파트너사",
        send_eligibility: "ELIGIBLE", // Flagged eligible initially, but on global suppression list
        status: "PENDING",
      },
      {
        id: "rec-3",
        campaign_id: dummyCampaignId,
        company_id: dummyCompanyId,
        recipient_email: "excluded@partner.com",
        recipient_name: "Unconfirmed Buyer",
        company_name_kr: "미동의파트너사",
        send_eligibility: "EXCLUDED_UNCONFIRMED_CONSENT",
        status: "PENDING",
      },
    ];

    mockCampaignRecord = {
      id: dummyCampaignId,
      name: "KBGP - Approved Delivery Campaign",
      purpose: "Brand Outreach",
      status: "APPROVED",
      approval_status: "APPROVED",
      approved_by: "owner@letusto.com",
      approved_at: "2026-11-01T22:00:00.000Z",
      scheduled_at: null,
      is_live_mode_enabled: false,
      approval_snapshot: {
        approvedAt: "2026-11-01T22:00:00.000Z",
        approvedBy: "owner@letusto.com",
        templateVersion: "1.0.0",
        templateSubject: "Exclusive Partnership Opportunity",
        frozenRecipientsCount: 3,
        sendableCount: 2,
        hash: "test-snapshot-hash-12345",
      },
      stats: {
        totalRecipients: 3,
        sendableCount: 2,
        excludedCount: 1,
        testSendsCount: 0,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
      },
      filter_criteria: {
        companyIds: [dummyCompanyId],
      },
      created_at: "2026-11-01T21:00:00.000Z",
      updated_at: "2026-11-01T22:00:00.000Z",
    };
  });

  describe("1. Campaign Scheduling & Time Validation", () => {
    it("rejects scheduling for unapproved campaign drafts", async () => {
      mockCampaignRecord.approval_status = "PENDING";
      mockCampaignRecord.status = "DRAFT";

      const futureTime = new Date(Date.now() + 86400000).toISOString();
      await expect(
        updateCampaignSchedule(dummyCampaignId, futureTime, "admin@kselectnetwork.com")
      ).rejects.toThrow("Cannot schedule campaign: Campaign must be APPROVED before scheduling");
    });

    it("rejects past or invalid schedule times", async () => {
      const pastTime = new Date(Date.now() - 3600000).toISOString();
      await expect(
        updateCampaignSchedule(dummyCampaignId, pastTime, "admin@kselectnetwork.com")
      ).rejects.toThrow("예약 발송 시각은 현재 시각보다 최소 1분 이후여야 합니다");

      await expect(
        updateCampaignSchedule(dummyCampaignId, "invalid-date-string", "admin@kselectnetwork.com")
      ).rejects.toThrow("유효하지 않은 예약 일시 형식입니다");
    });

    it("successfully sets future schedule time without invalidating approval snapshot", async () => {
      const futureTime = new Date(Date.now() + 7200000).toISOString(); // 2 hours in future
      const updated = await updateCampaignSchedule(
        dummyCampaignId,
        futureTime,
        "admin@kselectnetwork.com"
      );

      expect(updated.status).toBe("SCHEDULED");
      expect(updated.scheduledAt).toBe(futureTime);
      expect(updated.approvalStatus).toBe("APPROVED");
      // Verify approval snapshot remains immutable
      expect(updated.approvalSnapshot?.hash).toBe("test-snapshot-hash-12345");
      expect(updated.approvalSnapshot?.approvedBy).toBe("owner@letusto.com");
    });

    it("supports safe schedule cancellation and reverts status to APPROVED", async () => {
      // First schedule
      const futureTime = new Date(Date.now() + 7200000).toISOString();
      await updateCampaignSchedule(dummyCampaignId, futureTime, "admin@kselectnetwork.com");

      // Now cancel
      const cancelled = await updateCampaignSchedule(dummyCampaignId, null, "admin@kselectnetwork.com");
      expect(cancelled.status).toBe("APPROVED");
      expect(cancelled.scheduledAt).toBeNull();
      expect(cancelled.approvalStatus).toBe("APPROVED");
      expect(cancelled.approvalSnapshot?.hash).toBe("test-snapshot-hash-12345");
    });
  });

  describe("2. Server Action Guards (scheduleMarketingCampaignAction & cancelCampaignScheduleAction)", () => {
    it("executes scheduleMarketingCampaignAction with admin authentication and future time validation", async () => {
      const futureTime = new Date(Date.now() + 86400000).toISOString();
      const res = await scheduleMarketingCampaignAction(dummyCampaignId, futureTime);

      expect(res.success).toBe(true);
      expect(res.campaign?.status).toBe("SCHEDULED");
      expect(res.campaign?.scheduledAt).toBe(futureTime);
    });

    it("executes cancelCampaignScheduleAction to safely unschedule", async () => {
      const res = await cancelCampaignScheduleAction(dummyCampaignId);
      expect(res.success).toBe(true);
      expect(res.campaign?.status).toBe("APPROVED");
      expect(res.campaign?.scheduledAt).toBeNull();
    });
  });

  describe("3. Send Now & Delivery Simulation Execution", () => {
    it("blocks delivery execution if campaign is not approved", async () => {
      mockCampaignRecord.approval_status = "PENDING";
      mockCampaignRecord.status = "DRAFT";

      await expect(
        executeCampaignDeliverySimulation(dummyCampaignId, "admin@kselectnetwork.com")
      ).rejects.toThrow("Cannot execute delivery: Campaign must be APPROVED first");
    });

    it("prevents duplicate sends if campaign is already SENDING or COMPLETED", async () => {
      mockCampaignRecord.status = "SENDING";
      await expect(
        executeCampaignDeliverySimulation(dummyCampaignId, "admin@kselectnetwork.com")
      ).rejects.toThrow("캠페인 발송이 이미 진행 중입니다. 중복 발송을 방지합니다.");

      mockCampaignRecord.status = "COMPLETED";
      await expect(
        executeCampaignDeliverySimulation(dummyCampaignId, "admin@kselectnetwork.com")
      ).rejects.toThrow("이미 발송 완료된 캠페인입니다.");
    });

    it("re-evaluates recipient suppression immediately before dispatch and updates recipient ledger", async () => {
      const result = await executeCampaignDeliverySimulation(
        dummyCampaignId,
        "admin@kselectnetwork.com"
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe("COMPLETED");
      expect(result.totalSent).toBe(1);
      expect(result.totalDelivered).toBe(1);
      expect(result.totalBlockedSuppressed).toBe(1);

      // Verify recipient ledger in DB
      const activeBuyer = mockRecipients.find((r) => r.recipient_email === "active.buyer@partner.com");
      expect(activeBuyer.status).toBe("DELIVERED");
      expect(activeBuyer.provider_message_id).toBeDefined();
      expect(activeBuyer.sent_at).toBeDefined();

      const optedOutBuyer = mockRecipients.find((r) => r.recipient_email === "optout@example.com");
      expect(optedOutBuyer.status).toBe("FAILED");
      expect(optedOutBuyer.error_message).toContain("Pre-dispatch suppression recheck blocked");

      // Verify non-eligible recipient remained uncontacted PENDING
      const unconfirmed = mockRecipients.find((r) => r.recipient_email === "excluded@partner.com");
      expect(unconfirmed.status).toBe("PENDING");

      // Verify campaign stats updated
      expect(mockCampaignRecord.stats.sentCount).toBe(1);
      expect(mockCampaignRecord.stats.deliveredCount).toBe(1);
      expect(mockCampaignRecord.stats.failedCount).toBe(1);
    });

    it("LIVE_MODE safety gate unconditionally rejects mode = 'LIVE' in executeCampaignDeliveryAction", async () => {
      const liveAttempt = await executeCampaignDeliveryAction(dummyCampaignId, { mode: "LIVE" });
      expect(liveAttempt.success).toBe(false);
      expect(liveAttempt.error).toContain("실제 고객 대량 발송(LIVE_MODE)은 비활성화되어 있습니다");
    });
  });

  describe("4. Background / Cron Scheduler (processScheduledCampaigns)", () => {
    it("evaluates scheduled campaigns with scheduled_at <= now() and processes delivery", async () => {
      // Set campaign to SCHEDULED with past scheduled time (due now)
      mockCampaignRecord.status = "SCHEDULED";
      mockCampaignRecord.scheduled_at = new Date(Date.now() - 60000).toISOString();

      const cronSummary = await processScheduledCampaigns();
      expect(cronSummary.processedCount).toBe(1);
      expect(cronSummary.results[0].status).toBe("COMPLETED");
      expect(mockCampaignRecord.status).toBe("COMPLETED");
    });
  });
});
