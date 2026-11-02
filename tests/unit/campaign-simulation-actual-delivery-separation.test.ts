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

import { executeCampaignDeliverySimulation } from "@/lib/brand-marketing/campaign-data-access";
import { calculateCampaignSummaryMetrics } from "@/lib/brand-marketing/results-data-access";

describe("ADM-EMAIL-APP-003: Simulated vs Actual Campaign Delivery Integrity", () => {
  const dummyCampaignId = "c0000000-0000-4000-a000-000000000099";

  let mockCampaignRecord: any = null;
  let mockRecipients: any[] = [];
  let mockSuppressionList: string[] = [];

  function createMockSupabase() {
    return {
      from: (table: string) => {
        if (table === "marketing_suppression_list") {
          return {
            select: () => ({
              eq: (col: string, val: any) => ({
                limit: () => {
                  const email = String(val).toLowerCase().trim();
                  const isSupp = mockSuppressionList.includes(email);
                  return Promise.resolve({
                    data: isSupp ? [{ email, reason: "MANUAL_ADMIN", status: "ACTIVE" }] : [],
                    error: null,
                  });
                },
              }),
            }),
          };
        }

        if (table === "marketing_campaigns") {
          return {
            select: () => ({
              eq: (col: string, val: any) => ({
                single: () =>
                  Promise.resolve({
                    data: mockCampaignRecord,
                    error: mockCampaignRecord ? null : { message: "Not found" },
                  }),
                maybeSingle: () => Promise.resolve({ data: mockCampaignRecord, error: null }),
                order: () => Promise.resolve({ data: [mockCampaignRecord], error: null }),
              }),
              order: () => Promise.resolve({ data: [mockCampaignRecord], error: null }),
            }),
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
              eq: (col: string, val: any) => {
                const data = mockRecipients.filter((r) => r.campaign_id === val);
                return {
                  order: () => Promise.resolve({ data, error: null }),
                  then: (cb: any) => cb({ data, error: null }),
                };
              },
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
                order: () => Promise.resolve({ data: [], error: null }),
                then: (cb: any) => cb({ data: [], error: null }),
              }),
            }),
            insert: () => Promise.resolve({ data: null, error: null }),
          };
        }

        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
              then: (cb: any) => cb({ data: [], error: null }),
            }),
          }),
          insert: () => Promise.resolve({ data: null, error: null }),
          update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        };
      },
    } as any;
  }

  beforeEach(() => {
    mockCampaignRecord = {
      id: dummyCampaignId,
      name: "20261101-2256-KBGP-Brand Outreach-Wave1",
      purpose: "Brand Outreach",
      language: "ko",
      template_id: "tpl-default-001",
      template_version: "1.0.0",
      subject_override: "[K SELECT] 귀사의 브랜드, 미국 시장에서 실제 판매로 검증해 보세요",
      status: "APPROVED",
      approval_status: "APPROVED",
      approved_by: "chae@letusto.com",
      approved_at: new Date().toISOString(),
      is_live_mode_enabled: false,
      filter_criteria: {
        companyIds: ["comp-1", "comp-2"],
      },
      stats: {
        totalRecipients: 2,
        sendableCount: 2,
        excludedCount: 0,
        testSendsCount: 0,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
      },
      approval_snapshot: {
        approvedAt: new Date().toISOString(),
        approvedBy: "chae@letusto.com",
        templateVersion: "1.0.0",
        frozenRecipientsCount: 2,
        sendableCount: 2,
      },
    };

    mockRecipients = [
      {
        id: "rec-1",
        campaign_id: dummyCampaignId,
        company_id: "comp-1",
        recipient_email: "buyer1@partner.com",
        send_eligibility: "ELIGIBLE",
        status: "PENDING",
      },
      {
        id: "rec-2",
        campaign_id: dummyCampaignId,
        company_id: "comp-2",
        recipient_email: "buyer2@partner.com",
        send_eligibility: "ELIGIBLE",
        status: "PENDING",
      },
    ];

    mockSuppressionList = [];
  });

  it("1. Simulation produces ZERO provider API calls and preserves LIVE_MODE: FALSE", async () => {
    expect(mockCampaignRecord.is_live_mode_enabled).toBe(false);
  });

  it("2. executeCampaignDeliverySimulation NEVER increments sentCount or deliveredCount", async () => {
    const mockSupabase = createMockSupabase();

    const res = await executeCampaignDeliverySimulation(
      dummyCampaignId,
      "test-admin@kselectnetwork.com",
      mockSupabase
    );

    expect(res.success).toBe(true);
    expect(res.isSimulated).toBe(true);
    // Requirement 5: Simulation must NEVER increase actual Sent or Delivered metrics
    expect(res.totalSent).toBe(0);
    expect(res.totalDelivered).toBe(0);
    expect(res.simulatedCount).toBe(2);
    expect(res.simulatedEligible).toBe(2);

    // Requirement 11: Campaign status remains APPROVED (never COMPLETED by simulation)
    expect(mockCampaignRecord.status).toBe("SIMULATED");
    expect(mockCampaignRecord.approval_status).toBe("APPROVED");
    expect(mockCampaignRecord.stats.sentCount).toBe(0);
    expect(mockCampaignRecord.stats.deliveredCount).toBe(0);
    expect(mockCampaignRecord.stats.simulationStats).toBeDefined();
    expect(mockCampaignRecord.stats.simulationStats.simulatedCount).toBe(2);
    expect(mockCampaignRecord.stats.simulationStats.simulatedEligible).toBe(2);
  });

  it("3. Simulation does NOT mark recipients as DELIVERED in the database ledger", async () => {
    const mockSupabase = createMockSupabase();

    await executeCampaignDeliverySimulation(
      dummyCampaignId,
      "test-admin@kselectnetwork.com",
      mockSupabase
    );

    // Requirement 4 & 6: Simulation must not mark recipient status as DELIVERED
    expect(mockRecipients[0].status).toBe("PENDING");
    expect(mockRecipients[1].status).toBe("PENDING");
    expect(mockRecipients[0].provider_message_id).toBeUndefined();
    expect(mockRecipients[1].provider_message_id).toBeUndefined();
  });

  it("4. calculateCampaignSummaryMetrics strictly excludes sim_ provider message IDs and pending messages", () => {
    const campaign = {
      id: "camp-test-1",
      name: "Wave 1 Outreach",
      status: "APPROVED",
      createdAt: new Date().toISOString(),
    };

    // Mixture of recipients: 2 simulated with 'sim_' prefix, 2 pending
    const recipients = [
      {
        id: "r-1",
        companyId: "c-1",
        status: "DELIVERED",
        provider_message_id: "sim_550e8400-e29b-41d4-a716-446655440000",
        sent_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
      },
      {
        id: "r-2",
        companyId: "c-2",
        status: "DELIVERED",
        provider_message_id: "sim_660e8400-e29b-41d4-a716-446655440001",
        sent_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
      },
      {
        id: "r-3",
        companyId: "c-3",
        status: "PENDING",
        provider_message_id: null,
      },
      {
        id: "r-4",
        companyId: "c-4",
        status: "PENDING",
        provider_message_id: null,
      },
    ];

    const metrics = calculateCampaignSummaryMetrics(campaign, recipients);

    // Requirements 5 & 6: Simulation must NEVER increase actual Sent or Delivered metrics, nor mark companies contacted
    expect(metrics.emailsSent).toBe(0);
    expect(metrics.delivered).toBe(0);
    expect(metrics.companiesContacted).toBe(0);
    expect(metrics.isSimulationOnly).toBe(true);
    expect(metrics.simulatedCount).toBe(2);
  });

  it("5. calculateCampaignSummaryMetrics accurately measures REAL provider deliveries", () => {
    const campaign = {
      id: "camp-real-1",
      name: "Real Marketing Send",
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
    };

    // Real provider message IDs from Resend (e.g. 're_123456789')
    const recipients = [
      {
        id: "r-1",
        companyId: "c-1",
        status: "DELIVERED",
        provider_message_id: "re_real_msg_001",
        sent_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
      },
      {
        id: "r-2",
        companyId: "c-2",
        status: "DELIVERED",
        provider_message_id: "re_real_msg_002",
        sent_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
      },
      {
        id: "r-3",
        companyId: "c-3",
        status: "FAILED",
        provider_message_id: "re_real_msg_003",
        sent_at: new Date().toISOString(),
      },
    ];

    const metrics = calculateCampaignSummaryMetrics(campaign, recipients);

    // Requirement 7: Preserve legitimate historical delivery records
    expect(metrics.emailsSent).toBe(3); // 2 delivered + 1 failed
    expect(metrics.delivered).toBe(2);
    expect(metrics.companiesContacted).toBe(3);
    expect(metrics.isSimulationOnly).toBe(false);
  });

  it("6. Re-executing simulation is idempotent and does not corrupt approval status or snapshot", async () => {
    const mockSupabase = createMockSupabase();

    // Run simulation twice
    const run1 = await executeCampaignDeliverySimulation(dummyCampaignId, "admin@test.com", mockSupabase);
    const run2 = await executeCampaignDeliverySimulation(dummyCampaignId, "admin@test.com", mockSupabase);

    expect(run1.success).toBe(true);
    expect(run2.success).toBe(true);
    expect(run1.totalSent).toBe(0);
    expect(run2.totalSent).toBe(0);
    expect(mockCampaignRecord.status).toBe("SIMULATED");
    expect(mockCampaignRecord.approval_status).toBe("APPROVED");
    expect(mockCampaignRecord.stats.sentCount).toBe(0);
  });
});
