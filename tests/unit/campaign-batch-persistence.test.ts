import { describe, it, expect, vi, beforeEach } from "vitest";

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

import {
  executeCampaignRealDelivery,
} from "@/lib/brand-marketing/campaign-data-access";
import { processResendWebhookEvent } from "@/lib/brand-marketing/resend-delivery-tracking";
import { sendEmailBatch } from "@/lib/notifications/email";

describe("ADM-EMAIL-APP-016: Campaign Batch Persistence & Webhook Resilience", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. executeCampaignRealDelivery passes complete recipient rows (including company_id & company_name_kr) to upsert", async () => {
    let capturedUpsertPayload: any[] = [];
    const campaignId = "camp-batch-persist-001";
    const companyId = "comp-uuid-1234-5678";

    const mockDbCamp = {
      id: campaignId,
      name: "Batch Persistence Campaign",
      approval_status: "APPROVED",
      status: "APPROVED",
      is_live_mode_enabled: true,
      stats: {
        totalRecipients: 2,
        sendableCount: 2,
        excludedCount: 0,
        testSendsCount: 0,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        isLiveModeEnabled: true,
      },
      updated_at: new Date().toISOString(),
    };

    const mockRecipients = [
      {
        id: "rec-001",
        campaign_id: campaignId,
        company_id: companyId,
        recipient_email: "ceo@brandalpha.com",
        recipient_name: "홍길동",
        company_name_kr: "주식회사 알파",
        company_name_en: "Alpha Corp",
        brand_name: "Alpha Brand",
        send_eligibility: "ELIGIBLE",
        status: "PENDING",
      },
      {
        id: "rec-002",
        campaign_id: campaignId,
        company_id: companyId,
        recipient_email: "marketing@brandbeta.com",
        recipient_name: "이순신",
        company_name_kr: "주식회사 베타",
        company_name_en: "Beta Corp",
        brand_name: "Beta Brand",
        send_eligibility: "ELIGIBLE",
        status: "PENDING",
      },
    ];

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "marketing_campaigns") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockDbCamp, error: null }),
                single: vi.fn().mockResolvedValue({ data: mockDbCamp, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        if (table === "marketing_campaign_recipients") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation(() => {
                const res = Promise.resolve({ data: mockRecipients, error: null });
                (res as any).order = vi.fn().mockResolvedValue({ data: mockRecipients, error: null });
                return res;
              }),
            }),
            upsert: vi.fn().mockImplementation((payload: any[]) => {
              capturedUpsertPayload = payload;
              return Promise.resolve({ data: null, error: null });
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        if (table === "marketing_campaign_logs") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === "marketing_suppression_list") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === "marketing_footer_settings") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              const res = Promise.resolve({ data: [], error: null });
              (res as any).order = vi.fn().mockResolvedValue({ data: [], error: null });
              return res;
            }),
          }),
        };
      }),
    };

    const result = await executeCampaignRealDelivery(
      campaignId,
      "admin@kselectnetwork.com",
      { mode: "LIVE" },
      mockClient as any
    );

    expect(result.success).toBe(true);
    expect(capturedUpsertPayload.length).toBe(2);

    // Verify all critical NOT NULL columns are present
    for (const item of capturedUpsertPayload) {
      expect(item.id).toBeDefined();
      expect(item.campaign_id).toBe(campaignId);
      expect(item.company_id).toBe(companyId);
      expect(item.company_name_kr).toBeDefined();
      expect(item.company_name_kr.length).toBeGreaterThan(0);
      expect(item.recipient_email).toBeDefined();
      expect(item.send_eligibility).toBe("ELIGIBLE");
      expect(item.status).toBe("SENT");
      expect(item.provider_message_id).toBeDefined();
    }
  });

  it("2. executeCampaignRealDelivery falls back to per-recipient update if upsert returns error", async () => {
    const campaignId = "camp-batch-fallback-002";
    const companyId = "comp-uuid-9999";
    const updatedIds: string[] = [];

    const mockDbCamp = {
      id: campaignId,
      name: "Fallback Campaign",
      approval_status: "APPROVED",
      status: "APPROVED",
      is_live_mode_enabled: true,
      stats: {
        totalRecipients: 1,
        sendableCount: 1,
        excludedCount: 0,
        testSendsCount: 0,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        isLiveModeEnabled: true,
      },
      updated_at: new Date().toISOString(),
    };

    const mockRecipients = [
      {
        id: "rec-fallback-001",
        campaign_id: campaignId,
        company_id: companyId,
        recipient_email: "owner@brandgamma.com",
        recipient_name: "박문수",
        company_name_kr: "주식회사 감마",
        send_eligibility: "ELIGIBLE",
        status: "PENDING",
      },
    ];

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "marketing_campaigns") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockDbCamp, error: null }),
                single: vi.fn().mockResolvedValue({ data: mockDbCamp, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        if (table === "marketing_campaign_recipients") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation(() => {
                const res = Promise.resolve({ data: mockRecipients, error: null });
                (res as any).order = vi.fn().mockResolvedValue({ data: mockRecipients, error: null });
                return res;
              }),
            }),
            // Upsert returns error to test graceful fallback
            upsert: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Simulated PostgREST batch error", code: "PGRST_ERROR" },
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((col: string, val: string) => {
                updatedIds.push(val);
                return Promise.resolve({ data: null, error: null });
              }),
            }),
          };
        }
        if (table === "marketing_campaign_logs") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === "marketing_suppression_list") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === "marketing_footer_settings") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              const res = Promise.resolve({ data: [], error: null });
              (res as any).order = vi.fn().mockResolvedValue({ data: [], error: null });
              return res;
            }),
          }),
        };
      }),
    };

    const result = await executeCampaignRealDelivery(
      campaignId,
      "admin@kselectnetwork.com",
      { mode: "LIVE" },
      mockClient as any
    );

    expect(result.success).toBe(true);
    // Verified that individual update fallback was called with the recipient id
    expect(updatedIds).toContain("rec-fallback-001");
  });

  it("3. processResendWebhookEvent falls back to matching by recipient_email when provider_message_id is unmapped", async () => {
    const unmappedEmailId = "resend-unmapped-msg-777";
    const recipientEmail = "contact@branddelta.com";
    const campaignId = "camp-delta-888";
    const recipientId = "rec-delta-999";
    let backfilledProviderId: string | null = null;
    let ledgerCampaignId: string | null = null;

    const mockRecipient = {
      id: recipientId,
      campaign_id: campaignId,
      recipient_email: recipientEmail,
      status: "SENT",
      provider_message_id: null,
    };

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "marketing_campaign_recipients") {
          const chain: any = {};
          chain.select = vi.fn().mockReturnValue(chain);
          chain.eq = vi.fn().mockImplementation((col: string, val: string) => {
            if (col === "provider_message_id") {
              const res = Promise.resolve({ data: [], error: null });
              (res as any).limit = vi.fn().mockResolvedValue({ data: [], error: null });
              return res;
            }
            if (col === "recipient_email") {
              const res = Promise.resolve({ data: [mockRecipient], error: null });
              (res as any).order = vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [mockRecipient], error: null }),
              });
              return res;
            }
            // For count queries (syncCampaignDeliveredStats)
            return chain;
          });
          chain.order = vi.fn().mockReturnValue(chain);
          chain.limit = vi.fn().mockImplementation(() => Promise.resolve({ data: [], error: null }));
          chain.update = vi.fn().mockImplementation((updates: any) => {
            if (updates.provider_message_id) {
              backfilledProviderId = updates.provider_message_id;
            }
            return {
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          });
          chain.then = (resolve: any) => resolve({ data: [mockRecipient], error: null, count: 1 });
          return chain;
        }
        if (table === "marketing_delivery_events") {
          return {
            insert: vi.fn().mockImplementation((entry: any) => {
              ledgerCampaignId = entry.campaign_id;
              return Promise.resolve({ data: null, error: null });
            }),
          };
        }
        if (table === "marketing_campaign_logs") {
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === "marketing_campaigns") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { stats: { sentCount: 1 } }, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }),
    };

    const webhookPayload = {
      type: "email.delivered",
      data: {
        email_id: unmappedEmailId,
        to: [recipientEmail],
        created_at: new Date().toISOString(),
      },
    };

    const result = await processResendWebhookEvent(webhookPayload, {
      customClient: mockClient as any,
      svixId: "msg_test_svix_016",
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe("processed");
    expect(result.campaignId).toBe(campaignId);
    expect(backfilledProviderId).toBe(unmappedEmailId);
    expect(ledgerCampaignId).toBe(campaignId);
  });

  it("4. sendEmailBatch properly processes and returns results for multiple payloads", async () => {
    const payloads = [
      { to: "test1@example.com", subject: "Test 1", text: "Text 1", html: "<p>1</p>" },
      { to: "test2@example.com", subject: "Test 2", text: "Text 2", html: "<p>2</p>" },
      { to: "test3@example.com", subject: "Test 3", text: "Text 3", html: "<p>3</p>" },
    ];

    const results = await sendEmailBatch(payloads);
    expect(results.length).toBe(3);
    for (const r of results) {
      expect(r.success).toBe(true);
      expect(r.messageId).toBeDefined();
    }
  });
});
