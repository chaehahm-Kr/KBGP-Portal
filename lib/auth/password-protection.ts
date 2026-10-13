import "server-only";

/**
 * List of authoritative production business accounts that must NEVER be mutated
 * by any automated test, QA script, or background task.
 */
export const PROTECTED_BUSINESS_EMAILS = Object.freeze([
  "tammyhahm@gmail.com",
  "tammyhahm77@gmail.com",
  "chae@letusto.com",
  "jslee@letusto.com",
]);

/**
 * Assert that an account is eligible for test-driven mutation.
 * Throws a fatal Error if an automated script attempts to mutate a real business user's credential.
 */
export function assertNotProtectedBusinessAccount(email: string | null | undefined, operation = "password mutation"): void {
  if (!email) return;
  const normalized = email.trim().toLowerCase();
  if (PROTECTED_BUSINESS_EMAILS.includes(normalized)) {
    throw new Error(
      `[SECURITY RECURRENCE PREVENTION GUARD] Refusing ${operation} for protected business user (${normalized}). ` +
      `Automated tests must strictly use dedicated QA test accounts (e.g. qa-retailer-test@letusto.com).`
    );
  }
}
