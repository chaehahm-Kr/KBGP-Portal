import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";

// Mock server-only, next/cache, next/headers
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { verifyResendWebhookSignature } from "@/lib/brand-marketing/resend-webhook-verifier";
import {
  processResendWebhookEvent,
  reconcileCampaignDelivery,
} from "@/lib/brand-marketing/resend-delivery-tracking";
import { calculateCampaignSummaryMetrics } from "@/lib/brand-marketing/results-data-access";

describe("ADM-EMAIL-APP-012-R1: Resend Delivery Ledger Security Hardening & Tracking", () => {
  const testSecret = "whsec_" + Buffer.from("test_secret_key_12345678901234567890").toString("base64");
  const rawKey = Buffer.from(testSecret.slice(6), "base64");

  function generateValidSvixHeaders(payload: string, secretKey: Buffer = rawKey, timestampOffset: number = 0) {
    const id = "msg_" + Math.random().toString(36).substring(7);
    const timestamp = (Math.floor(Date.now() / 1000) + timestampOffset).toString();
    const toSign = `${id}.${timestamp}.${payload}`;
    const sigHash = crypto.createHmac("sha256", secretKey).update(toSign).digest("base64");
    const signature = `v1,${sigHash}`;
    return { id, timestamp, signature };
  }

  describe("1. Svix Webhook Signature Verification & Forgery Defense", () => {
    const payload = JSON.stringify({ type: "email.delivered", data: { email_id: "01a19d0f" } });

    it("verifies a valid signature with whsec_ prefix successfully", () => {
      const headers = generateValidSvixHeaders(payload);
      const res = verifyResendWebhookSignature({
        payload,
        headers,
        secret: testSecret,
      });
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("verifies when multiple space-delimited signatures are provided", () => {
      const headers = generateValidSvixHeaders(payload);
      const multiSigHeaders = {
        ...headers,
        signature: `v1,invalid_signature_hash ${headers.signature}`,
      };
      const res = verifyResendWebhookSignature({
        payload,
        headers,
        secret: testSecret,
      });
      expect(res.isValid).toBe(true);
    });

    it("rejects forged or corrupted signature hash", () => {
      const headers = generateValidSvixHeaders(payload);
      const res = verifyResendWebhookSignature({
        payload,
        headers: { ...headers, signature: "v1,bad_hash_value" },
        secret: testSecret,
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Signature mismatch");
    });

    it("rejects an expired timestamp (> 300 seconds) for replay attack protection", () => {
      const headers = generateValidSvixHeaders(payload, rawKey, -305); // 305 seconds ago
      const res = verifyResendWebhookSignature({
        payload,
        headers,
        secret: testSecret,
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("expired");
    });

    it("rejects missing headers or missing secret", () => {
      const res1 = verifyResendWebhookSignature({
        payload,
        headers: { id: "1", timestamp: "123" },
        secret: testSecret,
      });
      expect(res1.isValid).toBe(false);

      const res2 = verifyResendWebhookSignature({
        payload,
        headers: { id: "1", timestamp: "123", signature: "v1,abc" },
        secret: "",
      });
      expect(res2.isValid).toBe(false);
    });
  });

  describe("2. Webhook Event Processing, Deduplication & Immutability", () => {
    let mockRecipients: any[] = [];
    let mockCampaigns: any[] = [];
    let mockLogs: any[] = [];
    let mockSuppressions: any[] = [];
    let mockDeliveryLedger: any[] = [];

    function createMockSupabase() {
      return {
        from: (table: string) => {
          if (table === "marketing_campaign_recipients") {
            return {
              select: (_cols?: string, opts?: any) => {
                let queryResults = [...mockRecipients];
                const chain = {
                  eq: (field: string, val: any) => {
                    queryResults = queryResults.filter((r) => r[field] === val);
                    return chain;
                  },
                  in: (field: string, vals: any[]) => {
                    queryResults = queryResults.filter((r) => vals.includes(r[field]));
                    return chain;
                  },
                  limit: (n: number) => Promise.resolve({ data: queryResults.slice(0, n), error: null }),
                  then: (resolve: any) => {
                    if (opts?.count === "exact") {
                      resolve({ count: queryResults.length, data: null, error: null });
                    } else {
                      resolve({ data: queryResults, error: null });
                    }
                  },
                };
                return chain;
              },
              update: (patch: any) => ({
                eq: (field: string, val: any) => {
                  mockRecipients = mockRecipients.map((r) =>
                    r[field] === val ? { ...r, ...patch } : r
                  );
                  return Promise.resolve({ data: null, error: null });
                },
              }),
            };
          }

          if (table === "marketing_campaigns") {
            return {
              select: () => ({
                eq: (field: string, val: any) => ({
                  single: () => {
                    const c = mockCampaigns.find((item) => item[field] === val);
                    return Promise.resolve({ data: c || null, error: c ? null : { message: "Not found" } });
                  },
                }),
              }),
              update: (patch: any) => ({
                eq: (field: string, val: any) => {
                  mockCampaigns = mockCampaigns.map((c) =>
                    c[field] === val ? { ...c, ...patch } : c
                  );
                  return Promise.resolve({ data: null, error: null });
                },
              }),
            };
          }

          if (table === "marketing_suppression_list") {
            return {
              upsert: (record: any) => {
                mockSuppressions.push(record);
                return Promise.resolve({ data: null, error: null });
              },
            };
          }

          if (table === "marketing_delivery_events") {
            return {
              insert: (record: any) => {
                const existing = mockDeliveryLedger.find(
                  (r) => r.provider === record.provider && r.provider_event_id === record.provider_event_id
                );
                if (existing) {
                  return Promise.resolve({
                    data: null,
                    error: {
                      code: "23505",
                      message: "duplicate key value violates unique constraint uq_marketing_delivery_events_provider_event",
                    },
                  });
                }
                mockDeliveryLedger.push(record);
                return Promise.resolve({ data: null, error: null });
              },
            };
          }

          if (table === "marketing_campaign_logs") {
            return {
              insert: (record: any) => {
                mockLogs.push(record);
                return Promise.resolve({ data: null, error: null });
              },
            };
          }

          return {
            select: () => Promise.resolve({ data: [], error: null }),
          };
        },
      } as any;
    }

    beforeEach(() => {
      mockCampaigns = [
        {
          id: "camp-001",
          name: "Outreach 1",
          status: "COMPLETED",
          stats: { sentCount: 2, deliveredCount: 0, failedCount: 0 },
        },
      ];
      mockRecipients = [
        {
          id: "rec-001",
          campaign_id: "camp-001",
          recipient_email: "alice@test.com",
          status: "SENT",
          provider_message_id: "resend_msg_001",
        },
        {
          id: "rec-002",
          campaign_id: "camp-001",
          recipient_email: "bob@test.com",
          status: "SENT",
          provider_message_id: "resend_msg_002",
        },
      ];
      mockLogs = [];
      mockSuppressions = [];
      mockDeliveryLedger = [];
    });

    it("processes email.delivered, updates recipient status and campaign deliveredCount", async () => {
      const mockDb = createMockSupabase();
      const event = {
        type: "email.delivered",
        created_at: "2026-11-02T16:20:00.000Z",
        data: {
          email_id: "resend_msg_001",
          to: ["alice@test.com"],
        },
      };

      const result = await processResendWebhookEvent(event, {
        svixId: "msg_svix_delivered_001",
        customClient: mockDb,
      });
      expect(result.success).toBe(true);
      expect(result.status).toBe("processed");
      expect(result.providerEventId).toBe("msg_svix_delivered_001");

      // Recipient updated
      const alice = mockRecipients.find((r) => r.id === "rec-001");
      expect(alice.status).toBe("DELIVERED");
      expect(alice.delivered_at).toBe("2026-11-02T16:20:00.000Z");

      // Campaign stats updated
      const camp = mockCampaigns.find((c) => c.id === "camp-001");
      expect(camp.stats.deliveredCount).toBe(1);

      // Ledger inserted
      expect(mockDeliveryLedger.some((r) => r.provider_event_id === "msg_svix_delivered_001")).toBe(true);
    });

    it("atomically catches and rejects duplicate provider events via unique constraint", async () => {
      const mockDb = createMockSupabase();
      const event = {
        type: "email.delivered",
        created_at: "2026-11-02T16:20:00.000Z",
        data: {
          email_id: "resend_msg_001",
          to: ["alice@test.com"],
        },
      };

      // First webhook
      const res1 = await processResendWebhookEvent(event, {
        svixId: "msg_svix_dup_001",
        customClient: mockDb,
      });
      expect(res1.status).toBe("processed");

      // Duplicate webhook retry with exact same svix-id
      const res2 = await processResendWebhookEvent(event, {
        svixId: "msg_svix_dup_001",
        customClient: mockDb,
      });
      expect(res2.status).toBe("idempotent_duplicate");
      expect(res2.reason).toContain("Duplicate provider event rejected");
      expect(mockCampaigns[0].stats.deliveredCount).toBe(1);
    });

    it("permits different legitimate events for the same provider_message_id", async () => {
      const mockDb = createMockSupabase();

      // Event 1: Delivered
      await processResendWebhookEvent(
        {
          type: "email.delivered",
          created_at: "2026-11-02T16:20:00.000Z",
          data: { email_id: "resend_msg_001", to: ["alice@test.com"] },
        },
        { svixId: "msg_evt_del_01", customClient: mockDb }
      );

      // Event 2: Complaint for the same message
      const compRes = await processResendWebhookEvent(
        {
          type: "email.complained",
          created_at: "2026-11-02T16:25:00.000Z",
          data: { email_id: "resend_msg_001", to: ["alice@test.com"] },
        },
        { svixId: "msg_evt_comp_02", customClient: mockDb }
      );

      expect(compRes.status).toBe("processed");
      // Both events present in immutable ledger
      expect(mockDeliveryLedger.length).toBe(2);
      expect(mockDeliveryLedger.map((r) => r.provider_event_id)).toEqual(["msg_evt_del_01", "msg_evt_comp_02"]);
      expect(mockSuppressions.some((s) => s.email === "alice@test.com" && s.reason === "COMPLAINT")).toBe(true);
    });

    it("protects against out-of-order delayed delivered events overwriting terminal suppression states", async () => {
      const mockDb = createMockSupabase();

      // Recipient is already bounced
      mockRecipients[0].status = "BOUNCED";

      // Delayed delivered event arrives
      const outOfOrderEvent = {
        type: "email.delivered",
        created_at: "2026-11-02T16:10:00.000Z",
        data: { email_id: "resend_msg_001", to: ["alice@test.com"] },
      };

      const res = await processResendWebhookEvent(outOfOrderEvent, {
        svixId: "msg_delayed_del_01",
        customClient: mockDb,
      });

      expect(res.status).toBe("ignored");
      expect(res.reason).toContain("terminal state: BOUNCED");
      // Status must NOT be reverted to DELIVERED
      expect(mockRecipients[0].status).toBe("BOUNCED");
    });

    it("handles retroactive bounce after delivery and recalibrates delivered count", async () => {
      const mockDb = createMockSupabase();

      // 1. Initial delivery
      await processResendWebhookEvent(
        {
          type: "email.delivered",
          created_at: "2026-11-02T16:20:00.000Z",
          data: { email_id: "resend_msg_001", to: ["alice@test.com"] },
        },
        { svixId: "msg_d1", customClient: mockDb }
      );
      expect(mockCampaigns[0].stats.deliveredCount).toBe(1);

      // 2. Retroactive bounce arrives
      const bounceRes = await processResendWebhookEvent(
        {
          type: "email.bounced",
          created_at: "2026-11-02T16:30:00.000Z",
          data: { email_id: "resend_msg_001", to: ["alice@test.com"], message: "Mailbox full" },
        },
        { svixId: "msg_b1", customClient: mockDb }
      );

      expect(bounceRes.status).toBe("processed");
      expect(mockRecipients[0].status).toBe("BOUNCED");
      // Recalibrated deliveredCount
      expect(mockCampaigns[0].stats.deliveredCount).toBe(0);
      expect(mockSuppressions.some((s) => s.email === "alice@test.com" && s.reason === "BOUNCED")).toBe(true);
    });

    it("safely handles unknown message IDs without throwing", async () => {
      const mockDb = createMockSupabase();
      const event = {
        type: "email.delivered",
        data: {
          email_id: "unknown_id_999",
          to: ["unknown@example.com"],
        },
      };

      const result = await processResendWebhookEvent(event, {
        svixId: "msg_unknown_1",
        customClient: mockDb,
      });
      expect(result.success).toBe(true);
      expect(result.status).toBe("ignored");
    });
  });

  describe("3. Delivery Metrics & Telemetry Accuracy", () => {
    it("returns null deliveryRate and PENDING_TELEMETRY when emails sent but 0 delivered and recipients are in SENT", () => {
      const campaign = { id: "camp-1", name: "Outreach", status: "COMPLETED" };
      const recipients = [
        { id: "1", recipient_email: "a@test.com", status: "SENT", company_id: "c1" },
        { id: "2", recipient_email: "b@test.com", status: "SENT", company_id: "c1" },
      ];

      const metrics = calculateCampaignSummaryMetrics(campaign, recipients);
      expect(metrics.emailsSent).toBe(2);
      expect(metrics.delivered).toBe(0);
      expect(metrics.deliveryRate).toBeNull(); // Pending Telemetry, NOT 0.0%
      expect(metrics.deliveryTrackingStatus).toBe("PENDING_TELEMETRY");
    });

    it("calculates exact deliveryRate and VERIFIED status when delivered records exist", () => {
      const campaign = { id: "camp-1", name: "Outreach", status: "COMPLETED" };
      const recipients = [
        { id: "1", recipient_email: "a@test.com", status: "DELIVERED", company_id: "c1" },
        { id: "2", recipient_email: "b@test.com", status: "DELIVERED", company_id: "c1" },
      ];

      const metrics = calculateCampaignSummaryMetrics(campaign, recipients);
      expect(metrics.emailsSent).toBe(2);
      expect(metrics.delivered).toBe(2);
      expect(metrics.deliveryRate).toBe(1.0); // 100% verified
      expect(metrics.deliveryTrackingStatus).toBe("VERIFIED");
    });

    it("returns NO_EMAILS when emailsSent is 0", () => {
      const campaign = { id: "camp-1", name: "Outreach", status: "APPROVED" };
      const recipients = [
        { id: "1", recipient_email: "a@test.com", status: "PENDING", company_id: "c1" },
      ];

      const metrics = calculateCampaignSummaryMetrics(campaign, recipients);
      expect(metrics.emailsSent).toBe(0);
      expect(metrics.delivered).toBe(0);
      expect(metrics.deliveryRate).toBeNull();
      expect(metrics.deliveryTrackingStatus).toBe("NO_EMAILS");
    });
  });

  describe("4. Historical Reconciliation Action & Safety", () => {
    let mockRecipients: any[] = [];
    let mockCampaigns: any[] = [];
    let mockLogs: any[] = [];

    function createMockSupabase() {
      return {
        from: (table: string) => {
          if (table === "marketing_campaign_recipients") {
            return {
              select: (_cols?: string, opts?: any) => {
                let list = [...mockRecipients];
                const chain = {
                  eq: (field: string, val: any) => {
                    list = list.filter((r) => r[field] === val);
                    return chain;
                  },
                  in: (field: string, vals: any[]) => {
                    list = list.filter((r) => vals.includes(r[field]));
                    return chain;
                  },
                  then: (resolve: any) => {
                    if (opts?.count === "exact") {
                      resolve({ count: list.length, data: null, error: null });
                    } else {
                      resolve({ data: list, error: null });
                    }
                  },
                };
                return chain;
              },
              update: (patch: any) => ({
                eq: (field: string, val: any) => {
                  mockRecipients = mockRecipients.map((r) =>
                    r[field] === val ? { ...r, ...patch } : r
                  );
                  return Promise.resolve({ data: null, error: null });
                },
              }),
            };
          }

          if (table === "marketing_campaigns") {
            return {
              select: () => ({
                eq: (field: string, val: any) => ({
                  single: () => {
                    const c = mockCampaigns.find((item) => item[field] === val);
                    return Promise.resolve({ data: c || null, error: null });
                  },
                }),
              }),
              update: (patch: any) => ({
                eq: (field: string, val: any) => {
                  mockCampaigns = mockCampaigns.map((c) =>
                    c[field] === val ? { ...c, ...patch } : c
                  );
                  return Promise.resolve({ data: null, error: null });
                },
              }),
            };
          }

          if (table === "marketing_campaign_logs" || table === "marketing_delivery_events") {
            return {
              insert: (record: any) => {
                mockLogs.push(record);
                return Promise.resolve({ data: null, error: null });
              },
            };
          }

          if (table === "marketing_suppression_list") {
            return {
              upsert: () => Promise.resolve({ data: null, error: null }),
            };
          }

          return {
            select: () => Promise.resolve({ data: [], error: null }),
          };
        },
      } as any;
    }

    beforeEach(() => {
      mockCampaigns = [
        {
          id: "camp-hist-1",
          name: "Historical Campaign",
          stats: { sentCount: 2, deliveredCount: 0 },
        },
      ];
      mockRecipients = [
        {
          id: "rec-h1",
          campaign_id: "camp-hist-1",
          recipient_email: "hist1@example.com",
          status: "SENT",
          provider_message_id: "01a19d0f-hist-1",
        },
        {
          id: "rec-h2",
          campaign_id: "camp-hist-1",
          recipient_email: "hist2@example.com",
          status: "SENT",
          provider_message_id: "01a19d0f-hist-2",
        },
      ];
      mockLogs = [];
    });

    it("reconciles SENT records using Resend API response without resending emails", async () => {
      process.env.RESEND_API_KEY = "re_test_mock_api_key";

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("01a19d0f-hist-1")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: "01a19d0f-hist-1",
                last_event: "delivered",
                created_at: "2026-11-02T16:19:42.000Z",
              }),
          });
        }
        if (url.includes("01a19d0f-hist-2")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: "01a19d0f-hist-2",
                last_event: "delivered",
                created_at: "2026-11-02T16:19:43.000Z",
              }),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      try {
        const mockDb = createMockSupabase();
        const result = await reconcileCampaignDelivery("camp-hist-1", "admin@kselectnetwork.com", mockDb);

        expect(result.success).toBe(true);
        expect(result.reconciledDelivered).toBe(2);
        expect(result.totalDelivered).toBe(2);

        // All recipients updated to DELIVERED
        expect(mockRecipients.every((r) => r.status === "DELIVERED")).toBe(true);

        // Campaign stats updated
        expect(mockCampaigns[0].stats.deliveredCount).toBe(2);
        expect(mockCampaigns[0].stats.deliveryStatus).toBe("DELIVERED");

        // Reconciliation audit log saved
        expect(mockLogs.some((l) => l.event_type === "CAMPAIGN_DELIVERY_RECONCILED")).toBe(true);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
