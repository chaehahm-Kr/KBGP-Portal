/**
 * Production Account Mutation Protection Guardrail
 * 
 * Enforces strict rule:
 * NO test script or automated runner may mutate (password change, deletion, session invalidation)
 * any production account (including tammyhahm@gmail.com).
 * Only accounts with emails starting with 'qa-' (e.g. qa-retailer-test@letusto.com) are permitted.
 */
function assertSafeQAAccount(email) {
  if (!email) {
    throw new Error('[SECURITY FATAL] assertSafeQAAccount: No target email specified.');
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized.startsWith('qa-')) {
    throw new Error(
      `[SECURITY FATAL] Blocked attempted test mutation on non-QA account: "${email}". ` +
      `Mutations are strictly prohibited on production accounts. Use dedicated throwaway QA accounts (qa-*@letusto.com) only.`
    );
  }
}

module.exports = { assertSafeQAAccount };
