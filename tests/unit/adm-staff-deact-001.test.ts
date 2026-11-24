import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  isProtectedProductionEmail,
  isQaTestActorEmail,
  assertNotProtectedProductionAccount,
} from "@/lib/auth/guard";

describe("ADM-STAFF-DEACT-001 — Auth Guard & Super Admin Lifecycle Policy", () => {
  it("recognizes protected production emails and QA test actor emails", () => {
    expect(isProtectedProductionEmail("new_hub@naver.com")).toBe(true);
    expect(isProtectedProductionEmail("chae@letusto.com")).toBe(true);
    expect(isProtectedProductionEmail("qa-staff-test@letusto.com")).toBe(false);

    expect(isQaTestActorEmail("qa-admin-test@letusto.com")).toBe(true);
    expect(isQaTestActorEmail("kbgp-verify-superadmin@letusto.com")).toBe(true);
    expect(isQaTestActorEmail("chae@letusto.com")).toBe(false);
    expect(isQaTestActorEmail("jslee@letusto.com")).toBe(false);
  });

  it("blocks QA/automated actors from mutating protected production emails", async () => {
    await expect(
      assertNotProtectedProductionAccount("new_hub@naver.com", "deactivateUserSessions")
    ).rejects.toThrow("[SECURITY GUARD]");

    await expect(
      assertNotProtectedProductionAccount("new_hub@naver.com", "deactivateUserSessions", {
        actorEmail: "qa-admin-test@letusto.com",
        allowAuthorizedSuperAdmin: true,
      })
    ).rejects.toThrow("[SECURITY GUARD]");
  });

  it("allows real (non-QA) Super Admins to execute authorized staff lifecycle operations", async () => {
    await expect(
      assertNotProtectedProductionAccount("new_hub@naver.com", "deactivateUserSessions", {
        actorEmail: "chae@letusto.com",
        allowAuthorizedSuperAdmin: true,
      })
    ).resolves.toBeUndefined();
  });
});
