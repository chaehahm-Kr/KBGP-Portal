import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const PROTECTED_PRODUCTION_EMAILS = new Set([
  "account@letusto.com",
  "chae@letusto.com",
  "tammy@letusto.com",
  "jslee@letusto.com",
  "new_hub@naver.com",
]);

/**
 * Checks if a given email is a protected production account.
 * Test automation, seed scripts, and destructive QA operations must NEVER mutate or ban these accounts.
 */
export function isProtectedProductionEmail(email?: string | null): boolean {
  if (!email) return false;
  return PROTECTED_PRODUCTION_EMAILS.has(email.trim().toLowerCase());
}

/**
 * Asserts that the target email or user ID is NOT a protected production account before running destructive operations.
 */
export async function assertNotProtectedProductionAccount(
  emailOrUserId: string,
  operation: string
): Promise<void> {
  if (!emailOrUserId) return;

  const target = emailOrUserId.trim().toLowerCase();
  
  // 1. Direct email check
  if (isProtectedProductionEmail(target)) {
    throw new Error(
      `[SECURITY GUARD] Blocked destructive operation "${operation}" on protected production account "${target}". Dedicated QA account (qa-portal-test@letusto.com) must be used for QA tests.`
    );
  }

  // 2. If it is a UUID (userId), resolve user email from auth.users
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(target)) {
    try {
      const admin = createAdminClient();
      const { data: { user } } = await admin.auth.admin.getUserById(target);
      if (user && user.email && isProtectedProductionEmail(user.email)) {
        throw new Error(
          `[SECURITY GUARD] Blocked destructive operation "${operation}" on protected production account "${user.email}" (ID: ${target}). Dedicated QA account (qa-portal-test@letusto.com) must be used for QA tests.`
        );
      }
    } catch (err: any) {
      if (err.message && err.message.includes("[SECURITY GUARD]")) {
        throw err;
      }
      // If fetching user fails for non-existent ID, continue
    }
  }
}

/**
 * Centralized wrapper to safely execute admin auth mutations with mandatory protected account checks.
 */
export async function safeAdminAuthMutation<T>(
  targetEmailOrUserId: string,
  operation: string,
  mutator: () => Promise<T>
): Promise<T> {
  await assertNotProtectedProductionAccount(targetEmailOrUserId, operation);
  return await mutator();
}
