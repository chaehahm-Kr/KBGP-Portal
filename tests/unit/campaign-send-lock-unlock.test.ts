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
  messageId: "re_live_provider_msg_98765",
});
vi.mock("@/lib/notifications/email", () => ({
  sendEmail: (...args: any[]) => mockSendEmail(...args),
  sendEmailBatch: async (payloads: any[]) => Promise.all(payloads.map((p) => mockSendEmail(p))),
  maskEmailAddress: (email: string) => email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
  isRecipientAllowlisted: (email: string) =>
    email.endsWith("@kselectnetwork.com") ||
    email.endsWith("@letusto.com") ||
    email === "authorized-buyer@partner.com",
}));

import {
  executeCampaignRealDelivery,
  unlockCampaignSend,
  getMarketingCampaignById,
  isGenuineProviderMessageId,
} from "@/lib/brand-marketing/campaign-data-access";

describe("ADM-EMAIL-APP-006: Controlled Live Email Delivery, Send Lock & Safe Unlock", () => {
  const dummyCampaignId = "c8888888-4444-4000-a000-888888888888";

  let mockCampaignRecord: any = null;
  let mockRecipients: any[] = [];
  let mockLogs: any[] = [];

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
                      subject: "[K SELECT] Partnership Offer",
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
                order: () => Promise.resolve({ data: mockLogs, error: null }),
                then: (cb: any) => cb({ data: mockLogs, error: null }),
              }),
            }),
            insert: (payload: any) => {
              mockLogs.push(payload);
              return Promise.resolve({ data: payload, error: null });
            },
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
                      address_line1: "Gangnam, Seoul",
                      phone_number: "02-1234-5678",
                      cs_email: "support@kselectnetwork.com",
                      privacy_manager_name: "Privacy Officer",
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

    mockLogs = [];
    mockCampaignRecord = {
      id: dummyCampaignId,
      name: "KBGP Partner Outreach",
      purpose: "Brand Outreach",
      language: "ko",
      status: "APPROVED",
      approval_status: "APPROVED",
      approved_by: "owner@kselectnetwork.com",
      approved_at: new Date().toISOString(),
      template_id: "tpl-default-001",
      stats: {
        totalRecipients: 2,
        sendableCount: 2,
        excludedCount: 0,
        testSendsCount: 0,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockRecipients = [
      {
        id: "rec-1",
        campaign_id: dummyCampaignId,
        recipient_email: "operator1@kselectnetwork.com",
        recipient_name: "Manager 1",
        company_name_kr: "파트너사 1",
        send_eligibility: "ELIGIBLE",
        status: "PENDING",
        provider_message_id: null,
      },
      {
        id: "rec-2",
        campaign_id: dummyCampaignId,
        recipient_email: "operator2@kselectnetwork.com",
        recipient_name: "Manager 2",
        company_name_kr: "파트너사 2",
        send_eligibility: "ELIGIBLE",
        status: "PENDING",
        provider_message_id: null,
      },
    ];
  });

  it("Helper: isGenuineProviderMessageId correctly distinguishes simulation from real provider IDs", () => {
    expect(isGenuineProviderMessageId(null)).toBe(false);
    expect(isGenuineProviderMessageId(undefined)).toBe(false);
    expect(isGenuineProviderMessageId("")).toBe(false);
    expect(isGenuineProviderMessageId("sim_1762013898144_abc123")).toBe(false);
    expect(isGenuineProviderMessageId("re_123456789")).toBe(true);
    expect(isGenuineProviderMessageId("<20261102.abcdef@resend.dev>")).toBe(true);
  });

  it("Test 1: Automatically locks Send Now after dispatch and rejects re-dispatch without unlock", async () => {
    process.env.ENABLE_LIVE_MARKETING_CAMPAIGN_DISPATCH = "true";
    const mockDb = createMockSupabase();

    // 1. Initial dispatch
    const result = await executeCampaignRealDelivery(
      dummyCampaignId,
      "owner@kselectnetwork.com",
      { mode: "LIVE" },
      mockDb
    );

    expect(result.success).toBe(true);
    expect(result.totalSent).toBe(2);
    expect(["SENT", "COMPLETED"]).toContain(mockCampaignRecord.status);
    expect(mockCampaignRecord.stats.isSendLocked).toBe(true);

    // 2. Immediate re-attempt without unlock must throw lock error
    await expect(
      executeCampaignRealDelivery(
        dummyCampaignId,
        "owner@kselectnetwork.com",
        { mode: "LIVE" },
        mockDb
      )
    ).rejects.toThrow("이미 발송 완료된 캠페인입니다. 미발송 대상에게 추가 발송하려면 먼저 관리자 잠금 해제(Unlock Send)를 완료해야 합니다.");
  });

  it("Test 2: Double-click & in-flight concurrent execution prevention", async () => {
    process.env.ENABLE_LIVE_MARKETING_CAMPAIGN_DISPATCH = "true";
    const mockDb = createMockSupabase();

    // Simulate in-flight status SENDING
    mockCampaignRecord.status = "SENDING";

    await expect(
      executeCampaignRealDelivery(
        dummyCampaignId,
        "owner@kselectnetwork.com",
        { mode: "LIVE" },
        mockDb
      )
    ).rejects.toThrow("캠페인 발송이 이미 진행 중입니다. 중복 발송을 방지합니다.");
  });

  it("Test 3: Recipient-level strict deduplication - never resends to already contacted recipients", async () => {
    process.env.ENABLE_LIVE_MARKETING_CAMPAIGN_DISPATCH = "true";
    const mockDb = createMockSupabase();

    // Mark rec-1 as already sent with a real provider message ID
    mockRecipients[0].status = "SENT";
    mockRecipients[0].provider_message_id = "re_live_existing_msg_11111";

    // Set campaign status to APPROVED (as if unlocked for rec-2)
    mockCampaignRecord.status = "APPROVED";
    mockCampaignRecord.stats.sentCount = 1;

    // Dispatch remaining
    const result = await executeCampaignRealDelivery(
      dummyCampaignId,
      "owner@kselectnetwork.com",
      { mode: "LIVE" },
      mockDb
    );

    expect(result.success).toBe(true);
    expect(result.totalSent).toBe(1); // Only rec-2 was sent

    // Verify sendEmail was called ONLY once (for rec-2)
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "operator2@kselectnetwork.com",
      })
    );

    // rec-1 must remain untouched
    expect(mockRecipients[0].provider_message_id).toBe("re_live_existing_msg_11111");
  });

  it("Test 4: Admin Unlock Send workflow requires justification, logs audit, and unlocks for unsent targets", async () => {
    const mockDb = createMockSupabase();

    // Mark campaign as SENT
    mockCampaignRecord.status = "SENT";
    mockCampaignRecord.stats.sentCount = 1;
    mockRecipients[0].status = "SENT";
    mockRecipients[0].provider_message_id = "re_delivered_001";
    // rec-2 is still PENDING

    // A. Reject short reason
    await expect(
      unlockCampaignSend(dummyCampaignId, "admin@kselectnetwork.com", { reason: "abc" }, mockDb)
    ).rejects.toThrow("잠금 해제 사유(최소 5자 이상)를 반드시 입력해야 합니다.");

    // B. Successful unlock
    const unlockRes = await unlockCampaignSend(
      dummyCampaignId,
      "admin@kselectnetwork.com",
      { reason: "미발송 1건 대상 순차 발송 진행" },
      mockDb
    );

    expect(unlockRes.success).toBe(true);
    expect(unlockRes.unsentCount).toBe(1);
    expect(mockCampaignRecord.status).toBe("APPROVED");
    expect(mockCampaignRecord.stats.isSendLocked).toBe(false);
    expect(mockCampaignRecord.stats.unlockHistory).toHaveLength(1);
    expect(mockCampaignRecord.stats.unlockHistory[0].reason).toBe("미발송 1건 대상 순차 발송 진행");
    expect(mockCampaignRecord.stats.unlockHistory[0].unlockedBy).toBe("admin@kselectnetwork.com");

    // C. Re-unlock when 0 unsent targets remain must throw error
    mockRecipients[1].status = "SENT";
    mockRecipients[1].provider_message_id = "re_delivered_002";
    mockCampaignRecord.status = "SENT";

    await expect(
      unlockCampaignSend(
        dummyCampaignId,
        "admin@kselectnetwork.com",
        { reason: "모두 발송되었으나 재잠금 해제 시도" },
        mockDb
      )
    ).rejects.toThrow("모든 적격 수신자에게 이미 발송이 완료되어 잠금 해제할 대상이 없습니다. (중복 발송 방지)");
  });

  it("Test 5: Controlled internal testing mode limits to allowlist and max 3 recipients", async () => {
    const mockDb = createMockSupabase();

    // Attempt internal test with non-allowlisted email
    await expect(
      executeCampaignRealDelivery(
        dummyCampaignId,
        "admin@kselectnetwork.com",
        {
          mode: "LIVE",
          internalTestOnly: true,
          approvedInternalRecipient: "unauthorized-external@gmail.com",
        },
        mockDb
      )
    ).rejects.toThrow("승인되지 않은 내부 테스트 수신자입니다");

    // Valid allowlisted internal test dispatch
    const testResult = await executeCampaignRealDelivery(
      dummyCampaignId,
      "admin@kselectnetwork.com",
      {
        mode: "LIVE",
        internalTestOnly: true,
        approvedInternalRecipient: "operator1@kselectnetwork.com",
      },
      mockDb
    );

    expect(testResult.success).toBe(true);
    expect(testResult.totalSent).toBe(1);
  });

  it("Test 6: Historical simulation contamination guard blocks unreconciled campaigns from live send", async () => {
    process.env.ENABLE_LIVE_MARKETING_CAMPAIGN_DISPATCH = "true";
    const mockDb = createMockSupabase();

    // Contaminate recipients with historical sim_ records and SENT status (as found in APP-005 audit)
    mockRecipients[0].provider_message_id = "sim_1762013898144_test";
    mockRecipients[0].status = "SENT";

    await expect(
      executeCampaignRealDelivery(
        dummyCampaignId,
        "owner@kselectnetwork.com",
        { mode: "LIVE" },
        mockDb
      )
    ).rejects.toThrow("과거 시뮬레이션 이력이 존재하는 캠페인입니다. 실제 고객 발송 전 데이터 정합성 보정(APP-005 Reconciliation) 승인 및 적용이 필요합니다.");
  });
});
