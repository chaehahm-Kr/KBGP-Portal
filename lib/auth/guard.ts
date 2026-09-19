import "server-only";

export const PROTECTED_PRODUCTION_EMAILS = new Set([
  "account@letusto.com",
  "chae@letusto.com",
  "tammy@letusto.com",
]);

/**
 * Checks if a given email is a protected production account.
 * Test automation, seed scripts, and destructive QA operations must NEVER mutate or ban these accounts.
 */
export function isProtectedProductionEmail(email: string): boolean {
  return PROTECTED_PRODUCTION_EMAILS.has(email.trim().toLowerCase());
}

/**
 * Asserts that the target email is NOT a protected production account before running destructive operations.
 */
export function assertNotProtectedProductionAccount(email: string, operation: string) {
  if (isProtectedProductionEmail(email)) {
    throw new Error(
      `[SECURITY GUARD] Blocked destructive operation "${operation}" on protected production account "${email}". Dedicated QA account (qa-portal-test@letusto.com) must be used for QA tests.`
    );
  }
}
