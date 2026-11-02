import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock server-only and next/cache before importing server modules
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const mockVerifyAdminSession = vi.fn();
const mockGetAdminStaffContext = vi.fn();

vi.mock("@/lib/auth/dal", () => ({
  verifyAdminSession: () => mockVerifyAdminSession(),
  getAdminStaffContext: () => mockGetAdminStaffContext(),
}));

import {
  releaseMarketingSuppression,
  listMarketingSuppressionList,
} from "@/lib/brand-marketing/campaign-data-access";
import {
  recordEmailOptOut,
  isEmailSuppressed,
} from "@/lib/brand-marketing/unsubscribe";
import {
  releaseMarketingSuppressionAction,
  getMarketingSuppressionAuditLogAction,
} from "@/lib/brand-marketing/campaign-actions";

describe("ADM-EMAIL-SUP-001: Suppression List — Safe Admin Release & Audit Integrity", () => {
  let mockDbSuppression: Map<string, any>;
  let mockDbAuditLog: any[];

  function createMockSupabaseClient() {
    return {
      from: (table: string) => {
        if (table === "marketing_suppression_list") {
          return {
            select: (cols: string = "*") => ({
              order: (col: string, { ascending }: { ascending: boolean }) => ({
                ilike: (field: string, pattern: string) => {
                  const term = pattern.replace(/%/g, "").toLowerCase();
                  const rows = Array.from(mockDbSuppression.values()).filter((r) =>
                    r.email.toLowerCase().includes(term)
                  );
                  return Promise.resolve({ data: rows, error: null });
                },
                or: (orClause: string) => {
                  const rows = Array.from(mockDbSuppression.values()).filter(
                    (r) => (r.status || "ACTIVE") === "ACTIVE"
                  );
                  return Promise.resolve({ data: rows, error: null });
                },
                eq: (field: string, val: any) => {
                  const rows = Array.from(mockDbSuppression.values()).filter(
                    (r) => r[field] === val
                  );
                  return Promise.resolve({ data: rows, error: null });
                },
                then: (resolve: any) =>
                  resolve({
                    data: Array.from(mockDbSuppression.values()),
                    error: null,
                  }),
              }),
              eq: (field: string, val: any) => ({
                limit: (n: number) => {
                  const rows = Array.from(mockDbSuppression.values()).filter(
                    (r) => r[field] === val
                  );
                  return Promise.resolve({ data: rows.slice(0, n), error: null });
                },
                single: () => {
                  const row = Array.from(mockDbSuppression.values()).find(
                    (r) => r[field] === val
                  );
                  return Promise.resolve({ data: row || null, error: row ? null : { message: "Not found" } });
                },
              }),
            }),
            update: (payload: any) => ({
              eq: (field: string, val: any) => ({
                select: () => ({
                  single: () => {
                    const row = Array.from(mockDbSuppression.values()).find(
                      (r) => r[field] === val
                    );
                    if (!row) {
                      return Promise.resolve({ data: null, error: { message: "Not found" } });
                    }
                    const updated = { ...row, ...payload };
                    mockDbSuppression.set(updated.email, updated);
                    return Promise.resolve({ data: updated, error: null });
                  },
                }),
                then: (resolve: any) => {
                  const row = Array.from(mockDbSuppression.values()).find(
                    (r) => r[field] === val
                  );
                  if (row) {
                    const updated = { ...row, ...payload };
                    mockDbSuppression.set(updated.email, updated);
                  }
                  resolve({ data: null, error: null });
                },
              }),
            }),
            insert: (payload: any) => {
              const email = payload.email?.toLowerCase().trim();
              if (mockDbSuppression.has(email)) {
                return Promise.resolve({
                  error: { code: "23505", message: "duplicate key value violates unique constraint" },
                });
              }
              const newRow = {
                id: payload.id || `mock-sup-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                ...payload,
                status: payload.status || "ACTIVE",
              };
              mockDbSuppression.set(email, newRow);
              return Promise.resolve({ data: newRow, error: null });
            },
          };
        }

        if (table === "marketing_suppression_audit_log") {
          return {
            insert: (payload: any) => {
              const auditEntry = {
                id: `mock-audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                ...payload,
                performed_at: payload.performed_at || new Date().toISOString(),
              };
              mockDbAuditLog.push(auditEntry);
              return Promise.resolve({ data: auditEntry, error: null });
            },
            select: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: mockDbAuditLog, error: null }),
              }),
            }),
          };
        }

        return {
          select: () => Promise.resolve({ data: [], error: null }),
        };
      },
    };
  }

  beforeEach(() => {
    mockDbSuppression = new Map<string, any>();
    mockDbAuditLog = [];
    mockVerifyAdminSession.mockReset();
    mockGetAdminStaffContext.mockReset();
  });

  // ---------------------------------------------------------------------------
  // 1. Mandatory Input Validation
  // ---------------------------------------------------------------------------
  describe("1. Server-Side Validation & Evidence Verification", () => {
    it("rejects release when ID or email is missing", async () => {
      const mockClient = createMockSupabaseClient();
      const res1 = await releaseMarketingSuppression(
        {
          id: "",
          email: "test@example.com",
          releaseReason: "Customer verified renewed consent",
          releaseEvidence: "Ticket #1234",
          releasedBy: "admin@kselectnetwork.com",
        },
        mockClient
      );
      expect(res1.success).toBe(false);
      expect(res1.error).toContain("ID");

      const res2 = await releaseMarketingSuppression(
        {
          id: "some-uuid",
          email: "",
          releaseReason: "Customer verified renewed consent",
          releaseEvidence: "Ticket #1234",
          releasedBy: "admin@kselectnetwork.com",
        },
        mockClient
      );
      expect(res2.success).toBe(false);
      expect(res2.error).toContain("이메일");
    });

    it("rejects release when releaseReason is empty or shorter than 5 characters", async () => {
      const mockClient = createMockSupabaseClient();
      const res = await releaseMarketingSuppression(
        {
          id: "sup-001",
          email: "test@example.com",
          releaseReason: "ok",
          releaseEvidence: "Ticket #1234",
          releasedBy: "admin@kselectnetwork.com",
        },
        mockClient
      );
      expect(res.success).toBe(false);
      expect(res.error).toContain("해제 사유를 최소 5자 이상");
    });

    it("rejects release when releaseEvidence is empty or shorter than 5 characters", async () => {
      const mockClient = createMockSupabaseClient();
      const res = await releaseMarketingSuppression(
        {
          id: "sup-001",
          email: "test@example.com",
          releaseReason: "Customer consented in written form",
          releaseEvidence: "none",
          releasedBy: "admin@kselectnetwork.com",
        },
        mockClient
      );
      expect(res.success).toBe(false);
      expect(res.error).toContain("소명 증빙을 최소 5자 이상");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Ordinary Release of Eligible Records (UNSUBSCRIBED / MANUAL_ADMIN)
  // ---------------------------------------------------------------------------
  describe("2. Safe Admin Release & History Preservation", () => {
    it("successfully releases an UNSUBSCRIBED address while preserving original opt-out metadata", async () => {
      const mockClient = createMockSupabaseClient();
      const email = "consented-buyer@cosmetics.co.kr";
      const originalSuppressedAt = "2026-10-15T12:00:00Z";

      // Seed initial active suppression
      mockDbSuppression.set(email, {
        id: "sup-uuid-101",
        email,
        reason: "UNSUBSCRIBED",
        notes: "Opted out via link in campaign 100",
        suppressed_at: originalSuppressedAt,
        created_by: "system:unsubscribe_flow",
        status: "ACTIVE",
      });

      const releaseRes = await releaseMarketingSuppression(
        {
          id: "sup-uuid-101",
          email,
          releaseReason: "Customer sent written request to rejoin newsletter",
          releaseEvidence: "Signed opt-in agreement in Support Ticket #9812",
          releasedBy: "compliance-officer@kselectnetwork.com",
        },
        mockClient
      );

      expect(releaseRes.success).toBe(true);
      expect(releaseRes.record).toBeDefined();
      expect(releaseRes.record.status).toBe("RELEASED");
      expect(releaseRes.record.released_by).toBe("compliance-officer@kselectnetwork.com");
      expect(releaseRes.record.release_reason).toContain("written request");
      expect(releaseRes.record.release_evidence).toContain("Ticket #9812");

      // Verify Non-Destructive Invariant: Original suppression metadata strictly preserved
      expect(releaseRes.record.id).toBe("sup-uuid-101");
      expect(releaseRes.record.suppressed_at).toBe(originalSuppressedAt);
      expect(releaseRes.record.reason).toBe("UNSUBSCRIBED");
      expect(releaseRes.record.created_by).toBe("system:unsubscribe_flow");

      // Verify Immutable Audit Log was created
      expect(mockDbAuditLog.length).toBe(1);
      const audit = mockDbAuditLog[0];
      expect(audit.email).toBe(email);
      expect(audit.action).toBe("RELEASE");
      expect(audit.previous_status).toBe("ACTIVE");
      expect(audit.new_status).toBe("RELEASED");
      expect(audit.suppression_reason).toBe("UNSUBSCRIBED");
      expect(audit.performed_by).toBe("compliance-officer@kselectnetwork.com");
      expect(audit.release_evidence).toContain("Ticket #9812");

      // Verify isEmailSuppressed returns false for released record
      const isStillSuppressed = await isEmailSuppressed(email, mockClient);
      expect(isStillSuppressed).toBe(false);
    });

    it("rejects releasing an already released record", async () => {
      const mockClient = createMockSupabaseClient();
      const email = "already-released@partner.com";
      mockDbSuppression.set(email, {
        id: "sup-uuid-102",
        email,
        reason: "UNSUBSCRIBED",
        status: "RELEASED",
        suppressed_at: "2026-10-01T00:00:00Z",
      });

      const res = await releaseMarketingSuppression(
        {
          id: "sup-uuid-102",
          email,
          releaseReason: "Re-releasing test",
          releaseEvidence: "Ticket #9999",
          releasedBy: "admin@kselectnetwork.com",
        },
        mockClient
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("이미 안전 해제 처리된");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Elevated Policy Gate for High-Risk Records (BOUNCED & COMPLAINT)
  // ---------------------------------------------------------------------------
  describe("3. Elevated Policy Gate for BOUNCED & COMPLAINT Records", () => {
    it("blocks ordinary release of a BOUNCED record without policy validation confirmation", async () => {
      const mockClient = createMockSupabaseClient();
      const email = "bounced-domain@defunct-inbox.com";
      mockDbSuppression.set(email, {
        id: "sup-bounce-1",
        email,
        reason: "BOUNCED",
        status: "ACTIVE",
        suppressed_at: "2026-10-20T00:00:00Z",
      });

      const res = await releaseMarketingSuppression(
        {
          id: "sup-bounce-1",
          email,
          releaseReason: "Customer said their email works now",
          releaseEvidence: "Email screenshot",
          releasedBy: "admin@kselectnetwork.com",
          policyValidationConfirmed: false, // Ordinary release without policy confirmation
        },
        mockClient
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("영구 반송(BOUNCED)");
      expect(res.error).toContain("정책 검증 확인(Policy Validation) 승인이 필수");
    });

    it("blocks ordinary release of a COMPLAINT record without detailed policy validation notes", async () => {
      const mockClient = createMockSupabaseClient();
      const email = "complaint-user@spam-reporter.com";
      mockDbSuppression.set(email, {
        id: "sup-complaint-1",
        email,
        reason: "COMPLAINT",
        status: "ACTIVE",
        suppressed_at: "2026-10-22T00:00:00Z",
      });

      const res = await releaseMarketingSuppression(
        {
          id: "sup-complaint-1",
          email,
          releaseReason: "Spam complaint false positive confirmed",
          releaseEvidence: "Support chat log #8821",
          releasedBy: "admin@kselectnetwork.com",
          policyValidationConfirmed: true,
          policyValidationNotes: "too short", // Less than 10 characters
        },
        mockClient
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("10자 이상의 상세 정책 소명이 필수");
    });

    it("permits release of a BOUNCED record when elevated policy confirmation and detailed notes are provided", async () => {
      const mockClient = createMockSupabaseClient();
      const email = "repaired-inbox@recovered-corp.com";
      mockDbSuppression.set(email, {
        id: "sup-bounce-2",
        email,
        reason: "BOUNCED",
        status: "ACTIVE",
        suppressed_at: "2026-10-25T00:00:00Z",
      });

      const res = await releaseMarketingSuppression(
        {
          id: "sup-bounce-2",
          email,
          releaseReason: "Domain MX DNS migrated and mailbox fully verified",
          releaseEvidence: "SMTP RCPT TO 250 handshake response verified by Network Eng",
          policyValidationConfirmed: true,
          policyValidationNotes: "MX record migrated from legacy mailserver to Google Workspace; telnet port 25 test verified.",
          releasedBy: "infrastructure-admin@kselectnetwork.com",
        },
        mockClient
      );

      expect(res.success).toBe(true);
      expect(res.record.status).toBe("RELEASED");
      expect(res.record.policy_validation_notes).toContain("Google Workspace");

      // Verify audit log captured policy validation notes
      const audit = mockDbAuditLog.find((a) => a.email === email);
      expect(audit).toBeDefined();
      expect(audit.policy_validation_notes).toContain("Google Workspace");
    });
  });

  // ---------------------------------------------------------------------------
  // 4. In-Memory Cache Synchronization & Subsequent Opt-Out Reactivation
  // ---------------------------------------------------------------------------
  describe("4. Fail-Closed Cache Synchronization & Subsequent Opt-Out Reactivation", () => {
    it("safely reactivates a previously released suppression if the recipient opts out again", async () => {
      const mockClient = createMockSupabaseClient();
      const email = "churned-then-reopted@brand.com";

      // 1. Initially active
      mockDbSuppression.set(email, {
        id: "sup-reactivate-1",
        email,
        reason: "UNSUBSCRIBED",
        status: "ACTIVE",
        suppressed_at: "2026-09-01T00:00:00Z",
      });

      // 2. Safe release
      await releaseMarketingSuppression(
        {
          id: "sup-reactivate-1",
          email,
          releaseReason: "Customer opt-in at trade show booth",
          releaseEvidence: "Signed badge scan #412",
          releasedBy: "admin@kselectnetwork.com",
        },
        mockClient
      );

      let isSupp = await isEmailSuppressed(email, mockClient);
      expect(isSupp).toBe(false);

      // 3. Recipient opts out again via unsubscribe link
      const optOutRes = await recordEmailOptOut(
        email,
        "UNSUBSCRIBED",
        "Recipient unsubscribed again from campaign Q4",
        "campaign-q4",
        mockClient
      );

      expect(optOutRes.success).toBe(true);

      // 4. Record is reactivated to ACTIVE in DB
      const updatedRow = mockDbSuppression.get(email);
      expect(updatedRow.status).toBe("ACTIVE");
      expect(updatedRow.released_at).toBeNull();
      expect(updatedRow.released_by).toBeNull();
      expect(updatedRow.notes).toContain("Recipient unsubscribed again");

      // 5. isEmailSuppressed returns true immediately
      isSupp = await isEmailSuppressed(email, mockClient);
      expect(isSupp).toBe(true);

      // 6. Audit log captured REACTIVATE action
      const reactivateAudit = mockDbAuditLog.find(
        (a) => a.email === email && a.action === "REACTIVATE"
      );
      expect(reactivateAudit).toBeDefined();
      expect(reactivateAudit.new_status).toBe("ACTIVE");
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Filtering and Listing
  // ---------------------------------------------------------------------------
  describe("5. Filtering and Listing Capabilities", () => {
    it("correctly lists all, active, and released suppression records", async () => {
      const mockClient = createMockSupabaseClient();
      mockDbSuppression.set("active1@test.com", {
        id: "1",
        email: "active1@test.com",
        reason: "UNSUBSCRIBED",
        status: "ACTIVE",
        suppressed_at: "2026-11-01T00:00:00Z",
      });
      mockDbSuppression.set("active2@test.com", {
        id: "2",
        email: "active2@test.com",
        reason: "BOUNCED",
        status: "ACTIVE",
        suppressed_at: "2026-11-01T01:00:00Z",
      });
      mockDbSuppression.set("released1@test.com", {
        id: "3",
        email: "released1@test.com",
        reason: "UNSUBSCRIBED",
        status: "RELEASED",
        suppressed_at: "2026-11-01T02:00:00Z",
      });

      const allRes = await listMarketingSuppressionList("", "ALL", mockClient);
      expect(allRes.success).toBe(true);
      expect(allRes.suppressions.length).toBe(3);

      const activeRes = await listMarketingSuppressionList("", "ACTIVE", mockClient);
      expect(activeRes.success).toBe(true);
      expect(activeRes.suppressions.length).toBe(2);

      const releasedRes = await listMarketingSuppressionList("", "RELEASED", mockClient);
      expect(releasedRes.success).toBe(true);
      expect(releasedRes.suppressions.length).toBe(1);
      expect(releasedRes.suppressions[0].email).toBe("released1@test.com");
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Server Action Authorization & Fail-Closed Gate
  // ---------------------------------------------------------------------------
  describe("6. Server Action Authorization Gate", () => {
    it("rejects unauthorized release action when admin session is missing or expired", async () => {
      mockVerifyAdminSession.mockRejectedValueOnce(
        new Error("Unauthorized: Admin authentication session is invalid or expired.")
      );

      const res = await releaseMarketingSuppressionAction({
        id: "sup-test-auth",
        email: "unauthorized@test.com",
        releaseReason: "Unauthorized attempt",
        releaseEvidence: "No evidence",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Unauthorized");
    });

    it("rejects audit log action when admin session is missing", async () => {
      mockVerifyAdminSession.mockRejectedValueOnce(
        new Error("Unauthorized: Admin authentication session is invalid.")
      );

      const res = await getMarketingSuppressionAuditLogAction("test@test.com");
      expect(res.success).toBe(false);
      expect(res.logs).toEqual([]);
      expect(res.error).toContain("Unauthorized");
    });
  });
});
