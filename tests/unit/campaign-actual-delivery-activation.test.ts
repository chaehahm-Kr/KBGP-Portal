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

// Mock email sending provider
const mockSendEmail = vi.fn().mockResolvedValue({
  success: true,
  messageId: "re_test_live_msg_12345",
});
vi.mock("@/lib/notifications/email", () => ({
  sendEmail: (...args: any[]) => mockSendEmail(...args),
  sendEmailBatch: async (payloads: any[]) => Promise.all(payloads.map((p) => mockSendEmail(p))),
  maskEmailAddress: (email: string) => email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
  isRecipientAllowlisted: (email: string) =>
    email.endsWith("@kselectnetwork.com") ||
    email.endsWith("@letusto.com") ||
    email === "test-authorized@partner.com",
}));

import {
  executeCampaignDeliverySimulation,
  executeCampaignRealDelivery,
  getMarketingCampaignById,
} from "@/lib/brand-marketing/campaign-data-access";
import {
  executeCampaignDryRunAction,
  executeCampaignLiveDeliveryAction,
  executeCampaignDeliveryAction,
} from "@/lib/brand-marketing/campaign-actions";

describe("ADM-EMAIL-APP-004: Actual Campaign Delivery Activation & Metrics Integrity", () => {
  const dummyCampaignId = "c1111111-2222-4000-a000-333333333333";

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

        if (table === "marketing_templates") {
          return {
            select: () => ({
              order: () => Promise.resolve({
                data: [
                  {
                    id: "tpl-default-001",
                    name: "Default Brand Outreach",
                    subject: "[K SELECT] Partnership Proposal",
                    html_content: "<p>Hello {{company_name}}</p>",
                    plain_text: "Hello {{company_name}}",
                    status: "ACTIVE",
                    is_default: true,
                  },
                ],
                error: null,
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
            select: (cols?: string) => ({
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

        if (table === "marketing_footer_settings") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: "central_marketing_footer",
                      company_name: "K SELECT Inc.",
                      business_registration_number: "123-45-67890",
                      address_line1: "123 Gangnam-daero, Seoul",
                      phone_number: "02-1234-5678",
                      cs_email: "support@kselectnetwork.com",
                      privacy_manager_name: "Chae Hahm",
                      hosting_provider: "Vercel / Supabase",
                      style: "COMPACT_CARD",
                      include_report_link: true,
                    },
                    error: null,
                  }),
              }),
            }),
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
    vi.clearAllMocks();
    delete process.env.ENABLE_LIVE_MARKETING_CAMPAIGN_DISPATCH;

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
        recipient_email: "test@letusto.com",
        send_eligibility: "ELIGIBLE",
        status: "PENDING",
      },
      {
        id: "rec-2",
        campaign_id: dummyCampaignId,
        company_id: "comp-2",
        recipient_email: "test@kselectnetwork.com",
        send_eligibility: "ELIGIBLE",
        status: "PENDING",
      },
    ];

    mockSuppressionList = [];
  });

  it("1. getMarketingCampaignById normalizes simulated campaigns to real Sent = 0, Delivered = 0, status = SIMULATED", async () => {
    // Simulate historical scenario: campaign status was COMPLETED in DB, with sim_ IDs
    mockCampaignRecord.status = "COMPLETED";
    mockRecipients[0].provider_message_id = "sim_abc_123";
    mockRecipients[0].status = "DELIVERED";
    mockRecipients[1].provider_message_id = "sim_def_456";
    mockRecipients[1].status = "DELIVERED";

    const mockSupabase = createMockSupabase();
    const result = await getMarketingCampaignById(dummyCampaignId, mockSupabase);

    expect(result.campaign).toBeDefined();
    // Authoritative check: Real sent and delivered must be 0 for simulation
    expect(result.campaign!.stats.sentCount).toBe(0);
    expect(result.campaign!.stats.deliveredCount).toBe(0);
    expect(result.campaign!.status).toBe("SIMULATED");
    expect(result.campaign!.stats.simulationStats).toBeDefined();
    expect(result.campaign!.stats.simulationStats!.simulatedCount).toBe(2);
  });

  it("2. getMarketingCampaignById preserves real Sent and Delivered counts when genuine provider message IDs exist", async () => {
    mockCampaignRecord.status = "SENT";
    mockRecipients[0].provider_message_id = "re_real_msg_001";
    mockRecipients[0].status = "DELIVERED";
    mockRecipients[1].provider_message_id = "re_real_msg_002";
    mockRecipients[1].status = "SENT";

    const mockSupabase = createMockSupabase();
    const result = await getMarketingCampaignById(dummyCampaignId, mockSupabase);

    expect(result.campaign).toBeDefined();
    expect(result.campaign!.stats.sentCount).toBe(2);
    expect(result.campaign!.stats.deliveredCount).toBe(1);
    expect(result.campaign!.status).toBe("SENT");
  });

  it("3. executeCampaignRealDelivery blocks execution when live sending is not enabled", async () => {
    const mockSupabase = createMockSupabase();

    await expect(
      executeCampaignRealDelivery(
        dummyCampaignId,
        "admin@kselectnetwork.com",
        { mode: "LIVE" },
        mockSupabase
      )
    ).rejects.toThrow("Live delivery is not activated");

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("4. executeCampaignRealDelivery under authorized internal test mode dispatches only to allowlisted recipient", async () => {
    const mockSupabase = createMockSupabase();

    const res = await executeCampaignRealDelivery(
      dummyCampaignId,
      "admin@kselectnetwork.com",
      {
        mode: "LIVE",
        internalTestOnly: true,
        approvedInternalRecipient: "test@letusto.com",
      },
      mockSupabase
    );

    expect(res.success).toBe(true);
    expect(res.totalSent).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockRecipients[0].provider_message_id).toBe("re_test_live_msg_12345");
    expect(mockRecipients[0].status).toBe("SENT");
    // rec-2 was not the targeted internal recipient
    expect(mockRecipients[1].status).toBe("PENDING");
  });

  it("5. executeCampaignRealDelivery strictly respects suppression list during live dispatch", async () => {
    // Suppress test@letusto.com
    mockSuppressionList = ["test@letusto.com"];
    const mockSupabase = createMockSupabase();

    const res = await executeCampaignRealDelivery(
      dummyCampaignId,
      "admin@kselectnetwork.com",
      {
        mode: "LIVE",
        internalTestOnly: true,
        approvedInternalRecipient: "test@letusto.com",
      },
      mockSupabase
    );

    expect(res.success).toBe(true);
    expect(res.totalSent).toBe(0);
    expect(res.totalBlockedSuppressed).toBe(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("6. executeCampaignDeliverySimulation sets status to SIMULATED and does not modify real delivery ledger", async () => {
    const mockSupabase = createMockSupabase();

    const res = await executeCampaignDeliverySimulation(
      dummyCampaignId,
      "admin@kselectnetwork.com",
      mockSupabase
    );

    expect(res.success).toBe(true);
    expect(res.isSimulated).toBe(true);
    expect(res.totalSent).toBe(0);
    expect(res.totalDelivered).toBe(0);
    expect(res.simulatedCount).toBe(2);
    expect(mockCampaignRecord.status).toBe("SIMULATED");
    expect(mockCampaignRecord.stats.sentCount).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("7. executeCampaignDeliveryAction strictly separates SIMULATE and LIVE modes", async () => {
    // Invalid mode should be rejected
    const invalidRes = await executeCampaignDeliveryAction(dummyCampaignId, { mode: "INVALID" as any });
    expect(invalidRes.success).toBe(false);
    expect(invalidRes.error).toContain("발송 모드를 명시해야 합니다");
  });
});
