import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "127.0.0.1" })),
}));

// Shared in-memory DB state for deterministic rollback & concurrent race testing
type StaffRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  base_role: string;
};

let mockStaffRows: StaffRow[] = [];
let mockRoleRows: { staff_id: string; role: string }[] = [];
let mockAuditInserts: any[] = [];
let mockSession = {
  ok: true as const,
  session: { userId: "admin-1", email: "chae@letusto.com", role: "admin" as const },
};

const deactivateUserSessionsMock = vi.fn();
const reactivateUserSessionsMock = vi.fn();

vi.mock("@/lib/auth/dal", () => ({
  checkSuperAdminActionSession: vi.fn(async () => mockSession),
  requireSuperAdmin: vi.fn(async () => mockSession.session),
  verifyAdminSession: vi.fn(async () => mockSession.session),
}));

vi.mock("@/lib/auth/admin-actions", () => ({
  deactivateUserSessions: (...args: any[]) => deactivateUserSessionsMock(...args),
  reactivateUserSessions: (...args: any[]) => reactivateUserSessionsMock(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "staff_members") {
        return {
          select: () => ({
            eq: (col: string, val: any) => {
              const filtered = mockStaffRows.filter((r: any) => r[col] === val);
              return {
                maybeSingle: async () => ({ data: filtered[0] ? { ...filtered[0] } : null, error: null }),
                then: (resolve: any) => resolve({ data: filtered.map((r) => ({ ...r })), error: null }),
              };
            },
          }),
          update: (patch: Record<string, any>) => ({
            eq: async (col: string, val: any) => {
              for (const row of mockStaffRows) {
                if ((row as any)[col] === val) {
                  Object.assign(row, patch);
                }
              }
              return { error: null };
            },
          }),
        };
      }
      if (table === "staff_roles") {
        return {
          select: () => ({
            eq: async (col: string, val: any) => ({
              data: mockRoleRows.filter((r: any) => r[col] === val),
              error: null,
            }),
          }),
        };
      }
      if (table === "staff_audit_logs") {
        return {
          insert: async (row: any) => {
            mockAuditInserts.push(row);
            return { error: null };
          },
        };
      }
      return {};
    },
  }),
}));

import { updateStaffStatusAction } from "@/lib/staff/actions";

describe("ADM-STAFF-DEACT-001-R1 — Reconciliation, Forced Rollback & Concurrent Last Super Admin Protection", () => {
  beforeEach(() => {
    mockStaffRows = [];
    mockRoleRows = [];
    mockAuditInserts = [];
    deactivateUserSessionsMock.mockReset();
    reactivateUserSessionsMock.mockReset();
    mockSession = {
      ok: true,
      session: { userId: "admin-1", email: "chae@letusto.com", role: "admin" },
    };
  });

  it("reconciles an existing suspended account's Auth state idempotently WITHOUT ever setting status to active", async () => {
    mockStaffRows = [
      { id: "admin-1", name: "Super Admin", email: "chae@letusto.com", status: "active", base_role: "super_admin" },
      { id: "claire-1", name: "Claire Im", email: "new_hub@naver.com", status: "suspended", base_role: "account_manager" },
    ];
    mockRoleRows = [
      { staff_id: "admin-1", role: "super_admin" },
      { staff_id: "claire-1", role: "account_manager" },
    ];
    deactivateUserSessionsMock.mockResolvedValue(undefined);

    const result = await updateStaffStatusAction("claire-1", "suspended", "DB/Auth 상태 불일치 동기화");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyInStatus).toBe(true);
      expect(result.status).toBe("suspended");
    }
    expect(mockStaffRows.find((s) => s.id === "claire-1")?.status).toBe("suspended");
    expect(deactivateUserSessionsMock).toHaveBeenCalledTimes(1);
    expect(reactivateUserSessionsMock).not.toHaveBeenCalled();
    expect(mockAuditInserts).toHaveLength(1);
    expect(mockAuditInserts[0].action_type).toBe("status_sync");
    expect(mockAuditInserts[0].new_values.reconciled).toBe(true);
  });

  it("rolls back staff_members.status automatically when Auth ban fails (forced failure test)", async () => {
    mockStaffRows = [
      { id: "admin-1", name: "Super Admin", email: "chae@letusto.com", status: "active", base_role: "super_admin" },
      { id: "staff-2", name: "Target Staff", email: "target@letusto.com", status: "active", base_role: "account_manager" },
    ];
    mockRoleRows = [{ staff_id: "admin-1", role: "super_admin" }];
    deactivateUserSessionsMock.mockRejectedValue(new Error("Simulated Supabase Auth 503 outage"));

    const result = await updateStaffStatusAction("staff-2", "suspended", "강제 실패 롤백 테스트");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("원래대로 복구했습니다");
    }
    // DB status MUST be rolled back to 'active'
    expect(mockStaffRows.find((s) => s.id === "staff-2")?.status).toBe("active");
    // No misleading status_change audit log written
    expect(mockAuditInserts).toHaveLength(0);
  });

  it("blocks deactivating the last active Super Admin under both single and concurrent requests", async () => {
    // Case A: Single remaining active Super Admin (actor is admin-3, target admin-2 is the only active super_admin left)
    mockStaffRows = [
      { id: "admin-1", name: "Super 1", email: "s1@letusto.com", status: "suspended", base_role: "super_admin" },
      { id: "admin-2", name: "Super 2", email: "s2@letusto.com", status: "active", base_role: "super_admin" },
    ];
    mockRoleRows = [
      { staff_id: "admin-1", role: "super_admin" },
      { staff_id: "admin-2", role: "super_admin" },
    ];
    mockSession = {
      ok: true,
      session: { userId: "admin-3", email: "s3@letusto.com", role: "admin" },
    };

    const singleRes = await updateStaffStatusAction("admin-2", "suspended", "마지막 SA 차단 테스트");
    expect(singleRes.ok).toBe(false);
    expect(mockStaffRows.find((s) => s.id === "admin-2")?.status).toBe("active");
    expect(deactivateUserSessionsMock).not.toHaveBeenCalled();

    // Case B: Concurrent race — 2 active Super Admins (sa-a & sa-b) both targeted simultaneously
    mockStaffRows = [
      { id: "sa-a", name: "Super A", email: "saa@letusto.com", status: "active", base_role: "super_admin" },
      { id: "sa-b", name: "Super B", email: "sab@letusto.com", status: "active", base_role: "super_admin" },
    ];
    mockRoleRows = [
      { staff_id: "sa-a", role: "super_admin" },
      { staff_id: "sa-b", role: "super_admin" },
    ];
    deactivateUserSessionsMock.mockResolvedValue(undefined);

    const [resA, resB] = await Promise.all([
      updateStaffStatusAction("sa-a", "suspended", "동시 비활성화 A"),
      updateStaffStatusAction("sa-b", "suspended", "동시 비활성화 B"),
    ]);

    const activeSuperAdminsAfter = mockStaffRows.filter((s) => s.status === "active");
    expect(activeSuperAdminsAfter.length).toBeGreaterThanOrEqual(1);
    expect(resA.ok && resB.ok).toBe(false);
  });
});
