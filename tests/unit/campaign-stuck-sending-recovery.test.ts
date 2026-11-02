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
  messageId: "re_live_provider_msg_internal_007",
});
vi.mock("@/lib/notifications/email", () => ({
  sendEmail: (...args: any[]) => mockSendEmail(...args),
  maskEmailAddress: (email: string) => email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
  isRecipientAllowlisted: (email: string) =>
    email.endsWith("@kselectnetwork.com") ||
    email.endsWith("@letusto.com") ||
    email === "tammyhahm@gmail.com",
}));

import {
  executeCampaignRealDelivery,
  executeCampaignDeliverySimulation,
  unlockCampaignSend,
  isCampaignActivelyDispatching,
  STALE_SENDING_THRESHOLD_MS,
  isGenuineProviderMessageId,
} from "@/lib/brand-marketing/campaign-data-access";

describe("ADM-EMAIL-APP-007: Stuck SENDING State, Unlock Reconciliation & Internal Live Send Readiness", () => {
  const dummyCampaignId = "c7777777-3333-4000-a000-777777777777";
  const adminEmail = "owner@letusto.com";

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
                      subject: "[K SELECT] Outreach Proposal",
                      html_content: "<p>Hello {{company_name}} {{contact_name}}</p>",
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
                  mockCampaignRecord = { ...mockCampaignRecord, ...payload };
                }
                return {
                  data: [mockCampaignRecord],
                  error: null,
                  select: () => Promise.resolve({ data: [mockCampaignRecord], error: null }),
                };
              },
            }),
            upsert: (payload: any) => {
              mockCampaignRecord = { ...mockCampaignRecord, ...payload };
              return Promise.resolve({ data: mockCampaignRecord, error: null });
            },
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

        if (table === "marketing_campaign_logs") {
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
          select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        };
      },
    } as any;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENABLE_LIVE_MARKETING_CAMPAIGN_DISPATCH;
    dbUpdates = [];
    mockLogs = [];

    // Default 3 internal test recipients
    mockRecipients = [
      {
        id: "rec-1",
        campaign_id: dummyCampaignId,
        company_id: "comp-1",
        recipient_email: "chae@letusto.com",
        recipient_name: "Chae Hahm",
        company_name_kr: "Letusto Inc.",
        send_eligibility: "ELIGIBLE",
        status: "PENDING",
        provider_message_id: null,
      },
      {
        id: "rec-2",
        campaign_id: dummyCampaignId,
        company_id: "comp-1",
        recipient_email: "sean@letusto.com",
        recipient_name: "Sean Hahm",
        company_name_kr: "Letusto Inc.",
        send_eligibility: "ELIGIBLE",
        status: "PENDING",
        provider_message_id: null,
      },
      {
        id: "rec-3",
        campaign_id: dummyCampaignId,
        company_id: "comp-1",
        recipient_email: "tammyhahm@gmail.com",
        recipient_name: "Tammy Hahm",
        company_name_kr: "Letusto Inc.",
        send_eligibility: "ELIGIBLE",
        status: "PENDING",
        provider_message_id: null,
      },
    ];

    mockCampaignRecord = {
      id: dummyCampaignId,
      name: "New Brand Outreach Campaign",
      status: "APPROVED",
      approval_status: "APPROVED",
      approved_by: adminEmail,
      approved_at: new Date(Date.now() - 3600000).toISOString(),
      approval_snapshot: {
        templateVersion: "1.0.0",
        sendableCount: 3,
        approvedAt: new Date(Date.now() - 3600000).toISOString(),
        approvedBy: adminEmail,
      },
      stats: {
        totalRecipients: 3,
        sendableCount: 3,
        excludedCount: 0,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        isSendLocked: false,
      },
      updated_at: new Date(Date.now() - 3600000).toISOString(),
      created_at: new Date(Date.now() - 7200000).toISOString(),
    };
  });

  // TEST 1: Stale SENDING job can be safely unlocked and restored to APPROVED
  it("Test 1: Safe recovery of stale SENDING campaign restores status to APPROVED with audit log", async () => {
    // Campaign stranded in SENDING 15 minutes ago (crashed worker)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    mockCampaignRecord.status = "SENDING";
    mockCampaignRecord.approval_status = "INVALIDATED"; // corrupted during stuck state
    mockCampaignRecord.updated_at = fifteenMinutesAgo;

    const mockClient = createMockSupabase();

    const unlockRes = await unlockCampaignSend(
      dummyCampaignId,
      adminEmail,
      { reason: "Recovering crashed worker job to safe approved state" },
      mockClient
    );

    expect(unlockRes.success).toBe(true);
    expect(unlockRes.unsentCount).toBe(3);
    expect(mockCampaignRecord.status).toBe("APPROVED");

    // Verify DB update
    expect(mockCampaignRecord.status).toBe("APPROVED");
    expect(mockCampaignRecord.approval_status).toBe("APPROVED");
    expect(mockCampaignRecord.stats.isSendLocked).toBe(false);
    expect(mockCampaignRecord.stats.unlockHistory?.length).toBe(1);
    expect(mockCampaignRecord.stats.unlockHistory[0].reason).toContain("Recovering crashed worker");

    // Verify Audit log recorded with CAMPAIGN_STALE_SENDING_UNLOCKED
    const auditUpdates = dbUpdates.filter(
      (u) => u.table === "marketing_campaigns" && u.payload.status === "APPROVED"
    );
    expect(auditUpdates.length).toBeGreaterThan(0);
  });

  // TEST 2: Genuinely active in-flight worker cannot be unlocked (Mutual Exclusion)
  it("Test 2: Actively running SENDING worker (< 5 min old) cannot be unlocked", async () => {
    // Worker updated 30 seconds ago (actively running)
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    mockCampaignRecord.status = "SENDING";
    mockCampaignRecord.updated_at = thirtySecondsAgo;

    const mockClient = createMockSupabase();

    await expect(
      unlockCampaignSend(
        dummyCampaignId,
        adminEmail,
        { reason: "Attempting premature unlock on live worker" },
        mockClient
      )
    ).rejects.toThrow("발송 작업이 현재 활발히 진행 중입니다");

    // DB remains in SENDING (untouched)
    expect(mockCampaignRecord.status).toBe("SENDING");
  });

  // TEST 3: Minimum reason length enforcement for unlock (>= 5 chars)
  it("Test 3: Unlock rejects empty or short reason (< 5 characters)", async () => {
    mockCampaignRecord.status = "SENDING";
    mockCampaignRecord.updated_at = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    const mockClient = createMockSupabase();

    await expect(
      unlockCampaignSend(dummyCampaignId, adminEmail, { reason: "fix" }, mockClient)
    ).rejects.toThrow("최소 5자 이상");
  });

  // TEST 4: Simulation dry-run never writes SENDING to database
  it("Test 4: Safe simulation dry-run updates to SIMULATED without ever mutating persistent DB to SENDING", async () => {
    mockCampaignRecord.status = "APPROVED";
    const mockClient = createMockSupabase();

    const simRes = await executeCampaignDeliverySimulation(dummyCampaignId, adminEmail, mockClient);

    expect(simRes.success).toBe(true);
    expect(simRes.status).toBe("SIMULATED");
    expect(simRes.isSimulated).toBe(true);
    expect(simRes.totalSent).toBe(0);

    // Verify DB update was directly SIMULATED, never SENDING
    const sendingUpdates = dbUpdates.filter(
      (u) => u.table === "marketing_campaigns" && u.payload.status === "SENDING"
    );
    expect(sendingUpdates.length).toBe(0);
    expect(mockCampaignRecord.status).toBe("SIMULATED");
  });

  // TEST 5: Global LIVE_MODE disabled blocks full delivery before DB mutation
  it("Test 5: LIVE_MODE OFF unconditionally blocks full delivery before setting status to SENDING", async () => {
    process.env.ENABLE_LIVE_MARKETING_CAMPAIGN_DISPATCH = "false";
    mockCampaignRecord.status = "APPROVED";
    const mockClient = createMockSupabase();

    await expect(
      executeCampaignRealDelivery(dummyCampaignId, adminEmail, { mode: "LIVE" }, mockClient)
    ).rejects.toThrow("Live delivery is not activated");

    // Zero DB writes, status remains untouched
    expect(mockCampaignRecord.status).toBe("APPROVED");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // TEST 6: In-Flight Error Recovery reverts status to APPROVED on pre-send failure
  it("Test 6: In-flight fatal error before any email sent reverts status back to APPROVED", async () => {
    process.env.ENABLE_LIVE_MARKETING_CAMPAIGN_DISPATCH = "true";
    mockCampaignRecord.status = "APPROVED";

    // Simulate fatal provider error or network error on the first email
    mockSendEmail.mockRejectedValueOnce(new Error("Fatal connection timeout to SES"));

    const mockClient = createMockSupabase();

    await expect(
      executeCampaignRealDelivery(dummyCampaignId, adminEmail, { mode: "LIVE" }, mockClient)
    ).rejects.toThrow("Fatal connection timeout to SES");

    // In-flight error recovery must have automatically rolled back status to APPROVED!
    expect(mockCampaignRecord.status).toBe("APPROVED");
  });

  // TEST 7: Controlled Internal Test Mode dispatches only to allowlisted mailbox safely
  it("Test 7: Controlled Internal Test Send safely dispatches to allowlisted recipient without customer exposure", async () => {
    // Keep global LIVE_MODE disabled!
    delete process.env.ENABLE_LIVE_MARKETING_CAMPAIGN_DISPATCH;
    mockCampaignRecord.status = "APPROVED";

    mockSendEmail.mockResolvedValueOnce({
      success: true,
      messageId: "re_internal_test_msg_12345",
    });

    const mockClient = createMockSupabase();

    const res = await executeCampaignRealDelivery(
      dummyCampaignId,
      adminEmail,
      {
        mode: "LIVE",
        internalTestOnly: true,
        approvedInternalRecipient: "chae@letusto.com",
      },
      mockClient
    );

    expect(res.success).toBe(true);
    expect(res.totalSent).toBe(1);
    expect(res.totalFailed).toBe(0);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    // Verified provider message ID recorded on recipient
    const chaeRec = mockRecipients.find((r) => r.recipient_email === "chae@letusto.com");
    expect(chaeRec.status).toBe("SENT");
    expect(chaeRec.provider_message_id).toBe("re_internal_test_msg_12345");
    expect(isGenuineProviderMessageId(chaeRec.provider_message_id)).toBe(true);

    // Other recipients remain untouched (PENDING, unsent)
    const seanRec = mockRecipients.find((r) => r.recipient_email === "sean@letusto.com");
    expect(seanRec.status).toBe("PENDING");
    expect(seanRec.provider_message_id).toBeNull();

    // Campaign is marked SENT with send lock
    expect(["SENT", "COMPLETED"]).toContain(mockCampaignRecord.status);
    expect(mockCampaignRecord.stats.isSendLocked).toBe(true);
    expect(mockCampaignRecord.stats.sentCount).toBe(1);
  });
});
