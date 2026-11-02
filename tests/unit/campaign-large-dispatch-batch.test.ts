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
  saveMarketingCampaign,
} from "@/lib/brand-marketing/campaign-data-access";
import { checkEmailsSuppressionBatch } from "@/lib/brand-marketing/unsubscribe";
import { sendEmailBatch } from "@/lib/notifications/email";

describe("ADM-EMAIL-APP-013: 699-Recipient LIVE Campaign Dispatch & Batch Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. sendEmailBatch handles simulated dispatch in non-production environment", async () => {
    const payloads = Array.from({ length: 150 }, (_, i) => ({
      to: `recipient${i}@example.com`,
      subject: `Subject ${i}`,
      text: `Text ${i}`,
      html: `<p>HTML ${i}</p>`,
    }));

    const results = await sendEmailBatch(payloads);
    expect(results.length).toBe(150);
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.every((r) => r.simulated || r.messageId)).toBe(true);
  });

  it("2. checkEmailsSuppressionBatch handles batch suppression correctly", async () => {
    const emails = ["user1@example.com", "user2@test.com", "user3@kselectnetwork.com"];
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [
              { email: "user2@test.com", status: "ACTIVE", reason: "UNSUBSCRIBED" },
              { email: "user3@kselectnetwork.com", status: "RELEASED", reason: "RELEASED" },
            ],
            error: null,
          }),
        }),
      }),
    };

    const map = await checkEmailsSuppressionBatch(emails, mockClient as any);
    expect(map.get("user1@example.com")?.isSuppressed).toBe(false);
    expect(map.get("user2@test.com")?.isSuppressed).toBe(true);
    expect(map.get("user2@test.com")?.reason).toBe("UNSUBSCRIBED");
    expect(map.get("user3@kselectnetwork.com")?.isSuppressed).toBe(false);
  });

  it("3. saveMarketingCampaign preserves isLiveModeEnabled and stats across saves", async () => {
    const campaignId = "11111111-2222-3333-4444-555555555555";
    const mockDbCamp = {
      id: campaignId,
      name: "Existing LIVE Campaign",
      purpose: "Brand Outreach",
      description: "",
      language: "ko",
      template_id: null,
      template_version: "1.0.0",
      subject_override: null,
      preview_text: null,
      landing_page_url: null,
      status: "APPROVED",
      approval_status: "APPROVED",
      approved_by: "admin@kselectnetwork.com",
      approved_at: "2026-11-02T20:00:00Z",
      approval_snapshot: {},
      is_live_mode_enabled: true,
      stats: {
        totalRecipients: 700,
        sendableCount: 699,
        excludedCount: 1,
        testSendsCount: 0,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        isLiveModeEnabled: true,
        liveActivatedAt: "2026-11-02T20:00:00Z",
        liveActivatedBy: "admin@kselectnetwork.com",
      },
      filter_criteria: {},
      created_at: "2026-11-02T19:00:00Z",
      updated_at: "2026-11-02T20:00:00Z",
    };

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "marketing_campaigns") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockDbCamp, error: null }),
                single: vi.fn().mockResolvedValue({ data: mockDbCamp, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
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

    // Save with minimal partial update (preserving name and approval)
    const saved = await saveMarketingCampaign(
      { id: campaignId, name: "Existing LIVE Campaign" },
      "admin@kselectnetwork.com",
      mockClient as any
    );

    // isLiveModeEnabled MUST be preserved from existing DB record!
    expect(saved.isLiveModeEnabled).toBe(true);
    expect(saved.stats.isLiveModeEnabled).toBe(true);
    expect(saved.stats.liveActivatedBy).toBe("admin@kselectnetwork.com");
  });

  it("4. executeCampaignRealDelivery dispatches 699 recipients via batch engine in under 5 seconds", async () => {
    const campaignId = "69900000-0000-0000-0000-000000000699";
    const recipientCount = 699;

    const mockRecipients = Array.from({ length: recipientCount }, (_, i) => ({
      id: `rec-${i}`,
      campaign_id: campaignId,
      recipient_email: `brand_partner_${i}@kselectnetwork.com`,
      recipient_name: `Partner ${i}`,
      company_name_kr: `브랜드사 ${i}`,
      send_eligibility: "ELIGIBLE",
      status: "PENDING",
      provider_message_id: null,
    }));

    const mockDbCamp = {
      id: campaignId,
      name: "699-Recipient Outreach",
      status: "APPROVED",
      approval_status: "APPROVED",
      is_live_mode_enabled: true,
      stats: {
        totalRecipients: 699,
        sendableCount: 699,
        excludedCount: 0,
        testSendsCount: 0,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        isLiveModeEnabled: true,
      },
      filter_criteria: {},
      created_at: "2026-11-02T19:00:00Z",
      updated_at: "2026-11-02T20:00:00Z",
    };

    const upsertSpy = vi.fn().mockResolvedValue({ error: null });
    const updateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "marketing_campaigns") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockDbCamp, error: null }),
                single: vi.fn().mockResolvedValue({ data: mockDbCamp, error: null }),
              }),
            }),
            update: updateSpy,
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
            upsert: upsertSpy,
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === "marketing_suppression_list") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
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

    const startTime = Date.now();
    const result = await executeCampaignRealDelivery(
      campaignId,
      "admin@kselectnetwork.com",
      { mode: "LIVE" },
      mockClient as any
    );
    const elapsedMs = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(result.totalEvaluated).toBe(699);
    expect(result.totalSent).toBe(699);
    expect(result.totalFailed).toBe(0);
    expect(result.totalBlockedSuppressed).toBe(0);

    // Check performance: 699 recipients processed in under 5000ms (5 seconds)
    expect(elapsedMs).toBeLessThan(5000);

    // Verify batch upserts were called (699 items in chunks of 100 = 7 upsert calls)
    expect(upsertSpy).toHaveBeenCalledTimes(7);
  });
});
