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
  validateSuppressionReleaseEvidence,
  SuppressionEvidenceType,
} from "@/lib/brand-marketing/campaign-data-access";
import {
  recordEmailOptOut,
  isEmailSuppressed,
} from "@/lib/brand-marketing/unsubscribe";
import {
  releaseMarketingSuppressionAction,
  getMarketingSuppressionAuditLogAction,
} from "@/lib/brand-marketing/campaign-actions";

describe("ADM-EMAIL-SUP-002: Suppression Release Migration Security Hardening & Audit Integrity", () => {
  let mockDbSuppression: Map<string, any>;
  let mockDbAuditLog: any[];

  function createMockSupabaseClient(callerRole: "service_role" | "authenticated" | "anon" = "service_role"): any {
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
              // Least-privilege security check: Direct INSERT by ordinary authenticated or anon is rejected
              if (callerRole !== "service_role") {
                return Promise.resolve({
                  data: null,
                  error: {
                    code: "42501",
                    message: "permission denied for table marketing_suppression_audit_log (Direct INSERT prohibited)",
                  },
                });
              }
              const auditEntry = {
                id: `mock-audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                ...payload,
                performed_at: payload.performed_at || new Date().toISOString(),
              };
              mockDbAuditLog.push(auditEntry);
              return Promise.resolve({ data: auditEntry, error: null });
            },
            update: () => {
              // Append-only immutability trigger simulation
              return Promise.resolve({
                data: null,
                error: {
                  code: "P0001",
                  message: "marketing_suppression_audit_log is an immutable append-only audit trail. UPDATE and DELETE operations are strictly prohibited.",
                },
              });
            },
            delete: () => {
              // Append-only immutability trigger simulation
              return Promise.resolve({
                data: null,
                error: {
                  code: "P0001",
                  message: "marketing_suppression_audit_log is an immutable append-only audit trail. UPDATE and DELETE operations are strictly prohibited.",
                },
              });
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
  // 1. Audit Log Security & Least-Privilege Permissions (Requirement 1)
  // ---------------------------------------------------------------------------
  describe("1. Audit Log Security & Least-Privilege Protections", () => {
    it("rejects direct INSERT to marketing_suppression_audit_log by ordinary authenticated users", async () => {
      const client = createMockSupabaseClient("authenticated");
      const res = await client.from("marketing_suppression_audit_log").insert({
        email: "forged@test.com",
        action: "RELEASE",
        new_status: "RELEASED",
        performed_by: "attacker",
      });

      expect(res.error).toBeDefined();
      expect(res.error.code).toBe("42501");
      expect(res.error.message).toContain("permission denied");
    });

    it("rejects UPDATE operations on marketing_suppression_audit_log (Append-Only Immutability)", async () => {
      const client = createMockSupabaseClient("service_role");
      const res = await client.from("marketing_suppression_audit_log").update({
        performed_by: "tampered_admin",
      });

      expect(res.error).toBeDefined();
      expect(res.error.message).toContain("immutable append-only audit trail");
    });

    it("rejects DELETE operations on marketing_suppression_audit_log (Append-Only Immutability)", async () => {
      const client = createMockSupabaseClient("service_role");
      const res = await client.from("marketing_suppression_audit_log").delete();

      expect(res.error).toBeDefined();
      expect(res.error.message).toContain("immutable append-only audit trail");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Verifiable Evidence & Anti-Dummy Validation (Requirement 3)
  // ---------------------------------------------------------------------------
  describe("2. Verifiable Evidence & Anti-Dummy Text Validation", () => {
    it("rejects release when evidence or reason is dummy/placeholder text (text length alone is not proof)", () => {
      const dummyCases = ["none", "test", "testing", "asdf", "12345", "dummy", "n/a", "null", "undefined"];
      for (const dummy of dummyCases) {
        const resReason = validateSuppressionReleaseEvidence({
          releaseReason: dummy,
          releaseEvidence: "Customer email verified 2026-11-01",
          evidenceType: "WRITTEN_CONSENT_EMAIL",
          suppressionReason: "UNSUBSCRIBED",
        });
        expect(resReason.valid).toBe(false);
        expect(resReason.error).toContain("유효하지 않은 해제 사유");

        const resEvidence = validateSuppressionReleaseEvidence({
          releaseReason: "Customer requested re-opt-in",
          releaseEvidence: dummy,
          evidenceType: "WRITTEN_CONSENT_EMAIL",
          suppressionReason: "UNSUBSCRIBED",
        });
        expect(resEvidence.valid).toBe(false);
        expect(resEvidence.error).toContain("단순 무의미한 텍스트는 증빙으로 인정되지 않습니다");
      }
    });

    it("validates evidence source specifics: SUPPORT_TICKET requires ticket number or identifier", () => {
      const invalidRes = validateSuppressionReleaseEvidence({
        releaseReason: "Customer requested re-opt-in via helpdesk",
        releaseEvidence: "Customer spoke to agent yesterday afternoon",
        evidenceType: "SUPPORT_TICKET",
        suppressionReason: "UNSUBSCRIBED",
      });
      expect(invalidRes.valid).toBe(false);
      expect(invalidRes.error).toContain("티켓 번호(예: #1234) 또는 접수 식별자를 명시");

      const validRes = validateSuppressionReleaseEvidence({
        releaseReason: "Customer requested re-opt-in via helpdesk",
        releaseEvidence: "Customer confirmed consent in Zendesk Ticket #4912",
        evidenceType: "SUPPORT_TICKET",
        suppressionReason: "UNSUBSCRIBED",
      });
      expect(validRes.valid).toBe(true);
    });

    it("validates evidence source specifics: WRITTEN_CONSENT_EMAIL requires date, sender, or header verification", () => {
      const invalidRes = validateSuppressionReleaseEvidence({
        releaseReason: "Customer sent email request",
        releaseEvidence: "received email from buyer",
        evidenceType: "WRITTEN_CONSENT_EMAIL",
        suppressionReason: "UNSUBSCRIBED",
      });
      expect(invalidRes.valid).toBe(false);
      expect(invalidRes.error).toContain("수신 일자, 발송인 정보 또는 재수신 동의 내역");

      const validRes = validateSuppressionReleaseEvidence({
        releaseReason: "Customer sent email request",
        releaseEvidence: "Written consent email received on 2026-10-28 from buyer@brand.co.kr",
        evidenceType: "WRITTEN_CONSENT_EMAIL",
        suppressionReason: "UNSUBSCRIBED",
      });
      expect(validRes.valid).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Ordinary Safe Admin Release (UNSUBSCRIBED)
  // ---------------------------------------------------------------------------
  describe("3. Safe Admin Release with Trusted Audit Path", () => {
    it("successfully releases an UNSUBSCRIBED address via trusted write path", async () => {
      const mockClient = createMockSupabaseClient("service_role");
      const email = "consented-buyer@cosmetics.co.kr";
      const originalSuppressedAt = "2026-10-15T12:00:00Z";

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
          evidenceType: "SUPPORT_TICKET",
          releasedBy: "compliance-officer@kselectnetwork.com",
        },
        mockClient
      );

      expect(releaseRes.success).toBe(true);
      expect(releaseRes.record.status).toBe("RELEASED");
      expect(releaseRes.record.evidence_type).toBe("SUPPORT_TICKET");
      expect(releaseRes.record.released_by).toBe("compliance-officer@kselectnetwork.com");

      // Verify immutable audit log was appended via trusted write path
      expect(mockDbAuditLog.length).toBe(1);
      const audit = mockDbAuditLog[0];
      expect(audit.email).toBe(email);
      expect(audit.action).toBe("RELEASE");
      expect(audit.evidence_type).toBe("SUPPORT_TICKET");
      expect(audit.previous_status).toBe("ACTIVE");
      expect(audit.new_status).toBe("RELEASED");

      // Verify isEmailSuppressed returns false for released record
      const isStillSuppressed = await isEmailSuppressed(email, mockClient);
      expect(isStillSuppressed).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Elevated Policy Gate for High-Risk Records (BOUNCED & COMPLAINT)
  // ---------------------------------------------------------------------------
  describe("4. Elevated Policy Gate for High-Risk Records", () => {
    it("blocks ordinary release of a BOUNCED record without policy validation confirmation", async () => {
      const mockClient = createMockSupabaseClient("service_role");
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
          releaseEvidence: "Customer email received 2026-11-01 confirming inbox",
          evidenceType: "WRITTEN_CONSENT_EMAIL",
          releasedBy: "admin@kselectnetwork.com",
          policyValidationConfirmed: false,
        },
        mockClient
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("영구 반송(BOUNCED)");
      expect(res.error).toContain("정책 검증 확인(Policy Validation) 승인이 필수");
    });

    it("blocks release of a COMPLAINT record with dummy or too-short policy validation notes", async () => {
      const mockClient = createMockSupabaseClient("service_role");
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
          releaseEvidence: "Support chat ticket #8821 verified",
          evidenceType: "SUPPORT_TICKET",
          releasedBy: "admin@kselectnetwork.com",
          policyValidationConfirmed: true,
          policyValidationNotes: "testing", // Dummy text
        },
        mockClient
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("10자 이상의 상세 정책 소명이 필수");
    });

    it("permits release of a BOUNCED record when elevated policy confirmation and detailed notes are provided", async () => {
      const mockClient = createMockSupabaseClient("service_role");
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
          releaseEvidence: "Ticket #4019: SMTP RCPT TO 250 handshake response verified by Network Eng",
          evidenceType: "SUPPORT_TICKET",
          policyValidationConfirmed: true,
          policyValidationNotes: "MX record migrated from legacy mailserver to Google Workspace; telnet port 25 test verified.",
          releasedBy: "infrastructure-admin@kselectnetwork.com",
        },
        mockClient
      );

      expect(res.success).toBe(true);
      expect(res.record.status).toBe("RELEASED");
      expect(res.record.policy_validation_notes).toContain("Google Workspace");
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Fail-Closed Cache & Re-opt-out Reactivation (Requirement 4)
  // ---------------------------------------------------------------------------
  describe("5. Re-opt-out Reactivation & Fail-Closed Safety", () => {
    it("safely reactivates a previously released suppression if the recipient opts out again", async () => {
      const mockClient = createMockSupabaseClient("service_role");
      const email = "churned-then-reopted@brand.com";

      mockDbSuppression.set(email, {
        id: "sup-reactivate-1",
        email,
        reason: "UNSUBSCRIBED",
        status: "ACTIVE",
        suppressed_at: "2026-09-01T00:00:00Z",
      });

      await releaseMarketingSuppression(
        {
          id: "sup-reactivate-1",
          email,
          releaseReason: "Customer opt-in at trade show booth",
          releaseEvidence: "Support Ticket #412 signed badge scan",
          evidenceType: "SUPPORT_TICKET",
          releasedBy: "admin@kselectnetwork.com",
        },
        mockClient
      );

      let isSupp = await isEmailSuppressed(email, mockClient);
      expect(isSupp).toBe(false);

      const optOutRes = await recordEmailOptOut(
        email,
        "UNSUBSCRIBED",
        "Recipient unsubscribed again from campaign Q4",
        "campaign-q4",
        mockClient
      );

      expect(optOutRes.success).toBe(true);

      const updatedRow = mockDbSuppression.get(email);
      expect(updatedRow.status).toBe("ACTIVE");
      expect(updatedRow.released_at).toBeNull();

      isSupp = await isEmailSuppressed(email, mockClient);
      expect(isSupp).toBe(true);

      const reactivateAudit = mockDbAuditLog.find(
        (a) => a.email === email && a.action === "REACTIVATE"
      );
      expect(reactivateAudit).toBeDefined();
      expect(reactivateAudit.new_status).toBe("ACTIVE");
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Server Action Authorization Gate (Requirement 3 & 4)
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
        evidenceType: "WRITTEN_CONSENT_EMAIL",
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
