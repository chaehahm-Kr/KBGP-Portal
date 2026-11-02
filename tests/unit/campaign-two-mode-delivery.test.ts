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

// Mock email provider
const mockSendEmail = vi.fn().mockResolvedValue({
  success: true,
  messageId: "re_live_provider_msg_app008_abc",
});
vi.mock("@/lib/notifications/email", () => ({
  sendEmail: (...args: any[]) => mockSendEmail(...args),
  maskEmailAddress: (email: string) => email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
  isRecipientAllowlisted: () => true,
}));

import {
  activateCampaignLiveMode,
  deactivateCampaignLiveMode,
  executeCampaignRealDelivery,
  executeCampaignDeliverySimulation,
  unlockCampaignSend,
  isGenuineProviderMessageId,
} from "@/lib/brand-marketing/campaign-data-access";

describe("ADM-EMAIL-APP-008: Two-Mode Campaign Delivery — Simulation & LIVE", () => {
  const dummyCampaignId = "c8888888-0008-4000-a000-888888888888";
  const adminEmail = "admin@kselectnetwork.com";

  let mockCampaignRecord: any = null;
  let mockRecipients: any[] = [];
  let mockLogs: any[] = [];
  let dbUpdates: Array<{ table: string; payload: any }> = [];

  function createMockSupabase() {
    return {
      from: (table: string) => {
        if (table === "marketing_suppression_list") {
          return {
            select: () => ({
              eq: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          };
        }

        if (table === "marketing_templates") {
          return {
            select: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "tpl-default-001",
                      name: "Default Template",
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

        if (table === "marketing_footer_settings") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: "central_marketing_footer",
                      company_name_en: "Letusto Inc.",
                      company_name_kr: "(주)레투스토",
                      physical_address: "123 Business Way, Los Angeles, CA",
                      support_email: "support@letusto.com",
                      opt_out_mechanism_type: "ONE_CLICK_LINK",
                    },
                    error: null,
                  }),
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
                dbUpdates.push({ table: "marketing_campaigns", payload });
                if (mockCampaignRecord && mockCampaignRecord.id === val) {
                  mockCampaignRecord = {
                    ...mockCampaignRecord,
                    ...payload,
                    status: payload.status !== undefined ? payload.status : mockCampaignRecord.status,
                    is_live_mode_enabled:
                      payload.is_live_mode_enabled !== undefined
                        ? payload.is_live_mode_enabled
                        : mockCampaignRecord.is_live_mode_enabled,
                    stats: payload.stats !== undefined ? payload.stats : mockCampaignRecord.stats,
                    updated_at: payload.updated_at || new Date().toISOString(),
                  };
                }
                return {
                  data: [mockCampaignRecord],
                  error: null,
                  select: () => Promise.resolve({ data: [mockCampaignRecord], error: null }),
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
                dbUpdates.push({ table: "marketing_campaign_recipients", payload });
                const idx = mockRecipients.findIndex((r) => r.id === val);
                if (idx >= 0) {
                  mockRecipients[idx] = { ...mockRecipients[idx], ...payload };
                }
                return {
                  data: [mockRecipients[idx]],
                  error: null,
                  then: (cb: any) => cb({ data: [mockRecipients[idx]], error: null }),
                };
              },
            }),
          };
        }

        if (table === "marketing_campaign_logs" || table === "marketing_campaign_audit_logs") {
          return {
            select: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: mockLogs, error: null }),
                then: (cb: any) => cb({ data: mockLogs, error: null }),
              }),
            }),
            insert: (log: any) => {
              mockLogs.push(log);
              return {
                data: [log],
                error: null,
                then: (cb: any) => cb({ data: [log], error: null }),
              };
            },
          };
        }

        return {
          select: () => ({
            eq: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      },
    } as any;
  }

  beforeEach(() => {
    mockSendEmail.mockClear();
    dbUpdates = [];
    mockLogs = [];

    mockRecipients = [
      {
        id: "rec-app008-001",
        campaign_id: dummyCampaignId,
        company_id: "comp-001",
        company_name_en: "Alpha Brand",
        company_name_kr: "알파 브랜드",
        recipient_name: "John Doe",
        recipient_email: "john@alphabrand.com",
        status: "APPROVED",
        send_eligibility: "ELIGIBLE",
        provider_message_id: null,
      },
      {
        id: "rec-app008-002",
        campaign_id: dummyCampaignId,
        company_id: "comp-002",
        company_name_en: "Beta Brand",
        company_name_kr: "베타 브랜드",
        recipient_name: "Jane Smith",
        recipient_email: "jane@betabrand.com",
        status: "APPROVED",
        send_eligibility: "ELIGIBLE",
        provider_message_id: null,
      },
    ];

    mockCampaignRecord = {
      id: dummyCampaignId,
      name: "20261102-TwoMode-Outreach",
      status: "APPROVED",
      approval_status: "APPROVED",
      approved_by: adminEmail,
      approved_at: new Date().toISOString(),
      is_live_mode_enabled: false,
      approval_snapshot: {
        templateId: "tpl-default-001",
        templateVersion: "1.0.0",
        sendableCount: 2,
        approvedAt: new Date().toISOString(),
      },
      stats: {
        totalRecipients: 2,
        sendableCount: 2,
        excludedCount: 0,
        testSendsCount: 0,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        isLiveModeEnabled: false,
      },
      filter_criteria: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  it("1. SIMULATION mode does NOT invoke real email provider and does NOT increment real metrics", async () => {
    const mockClient = createMockSupabase();

    const simResult = await executeCampaignDeliverySimulation(
      dummyCampaignId,
      adminEmail,
      mockClient
    );

    expect(simResult.success).toBe(true);
    expect(simResult.simulatedCount).toBe(2);
    expect(simResult.simulatedEligible).toBe(2);

    // ZERO provider calls
    expect(mockSendEmail).not.toHaveBeenCalled();

    // Real sentCount remains 0
    expect(mockCampaignRecord.stats.sentCount).toBe(0);
    expect(mockCampaignRecord.stats.deliveredCount).toBe(0);
    expect(mockCampaignRecord.status).toBe("SIMULATED");
  });

  it("2. LIVE mode activation requires confirmation phrase 'ACTIVATE LIVE'", async () => {
    const mockClient = createMockSupabase();

    // Wrong phrase should reject
    await expect(
      activateCampaignLiveMode(dummyCampaignId, adminEmail, {
        confirmationPhrase: "activate",
      }, mockClient)
    ).rejects.toThrow("확인 문구('ACTIVATE LIVE')가 올바르지 않습니다.");

    // Correct phrase succeeds
    const actResult = await activateCampaignLiveMode(dummyCampaignId, adminEmail, {
      confirmationPhrase: "ACTIVATE LIVE",
      reason: "Owner authorized live deployment",
    }, mockClient);

    expect(actResult.success).toBe(true);
    expect(actResult.isLiveModeEnabled).toBe(true);
    expect(actResult.eligibleRecipients).toBe(2);
    expect(mockCampaignRecord.stats.isLiveModeEnabled).toBe(true);
  });

  it("3. LIVE mode delivery invokes real provider (sendEmail) and records message IDs", async () => {
    const mockClient = createMockSupabase();

    // First activate LIVE mode
    await activateCampaignLiveMode(dummyCampaignId, adminEmail, {
      confirmationPhrase: "ACTIVATE LIVE",
    }, mockClient);

    // Execute real delivery
    const deliveryResult = await executeCampaignRealDelivery(
      dummyCampaignId,
      adminEmail,
      { mode: "LIVE" },
      mockClient
    );

    expect(deliveryResult.success).toBe(true);
    expect(deliveryResult.totalSent).toBe(2);
    expect(deliveryResult.totalFailed).toBe(0);

    // Email provider called exactly twice
    expect(mockSendEmail).toHaveBeenCalledTimes(2);

    // Recipient records updated with provider message ID
    expect(isGenuineProviderMessageId(mockRecipients[0].provider_message_id)).toBe(true);
    expect(isGenuineProviderMessageId(mockRecipients[1].provider_message_id)).toBe(true);

    // Campaign status transitioned to SENT and locked
    expect(["SENT", "COMPLETED"]).toContain(mockCampaignRecord.status);
    expect(mockCampaignRecord.stats.sentCount).toBe(2);
    expect(mockCampaignRecord.stats.isSendLocked).toBe(true);
  });

  it("4. Send Now is locked after completion; duplicate delivery is blocked", async () => {
    const mockClient = createMockSupabase();

    // Set campaign as already completed
    mockCampaignRecord.status = "COMPLETED";
    mockCampaignRecord.stats.isSendLocked = true;
    mockCampaignRecord.stats.sentCount = 2;
    mockRecipients[0].status = "SENT";
    mockRecipients[0].provider_message_id = "re_msg_prev_001";
    mockRecipients[1].status = "SENT";
    mockRecipients[1].provider_message_id = "re_msg_prev_002";

    // Attempting send again should fail-safe block
    await expect(
      executeCampaignRealDelivery(
        dummyCampaignId,
        adminEmail,
        { mode: "LIVE" },
        mockClient
      )
    ).rejects.toThrow("이미 발송 완료된 캠페인입니다. 미발송 대상에게 추가 발송하려면 먼저 관리자 잠금 해제(Unlock Send)를 완료해야 합니다.");

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("5. Admin Unlock Send requires reason >= 5 chars, preserves previous sends, and allows remaining sends", async () => {
    const mockClient = createMockSupabase();

    // 1 recipient sent, 1 unsent
    mockCampaignRecord.status = "COMPLETED";
    mockCampaignRecord.stats.isSendLocked = true;
    mockCampaignRecord.stats.sentCount = 1;
    mockRecipients[0].status = "SENT";
    mockRecipients[0].provider_message_id = "re_msg_already_sent";
    mockRecipients[1].status = "APPROVED";
    mockRecipients[1].provider_message_id = null;

    // Reason < 5 chars rejected
    await expect(
      unlockCampaignSend(dummyCampaignId, adminEmail, { reason: "test" }, mockClient)
    ).rejects.toThrow("잠금 해제 사유(최소 5자 이상)를 반드시 입력해야 합니다.");

    // Valid unlock succeeds
    const unlockRes = await unlockCampaignSend(
      dummyCampaignId,
      adminEmail,
      { reason: "Sending remaining recipient after initial batch" },
      mockClient
    );

    expect(unlockRes.success).toBe(true);
    expect(unlockRes.unsentCount).toBe(1);
    expect(mockCampaignRecord.status).toBe("APPROVED");
    expect(mockCampaignRecord.stats.isSendLocked).toBe(false);

    // Existing sent recipient preserved
    expect(mockRecipients[0].status).toBe("SENT");
    expect(mockRecipients[0].provider_message_id).toBe("re_msg_already_sent");
  });

  it("6. Deactivating LIVE mode switches back to SIMULATION safely", async () => {
    const mockClient = createMockSupabase();

    // Activate first
    await activateCampaignLiveMode(dummyCampaignId, adminEmail, {
      confirmationPhrase: "ACTIVATE LIVE",
    }, mockClient);
    expect(mockCampaignRecord.stats.isLiveModeEnabled).toBe(true);

    // Deactivate
    const deactRes = await deactivateCampaignLiveMode(dummyCampaignId, adminEmail, mockClient);
    expect(deactRes.success).toBe(true);
    expect(mockCampaignRecord.stats.isLiveModeEnabled).toBe(false);
  });
});
