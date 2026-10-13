/**
 * Permanent Recurrence Prevention Guard for QA/Test Scripts
 * Prohibits any QA or automated script from resetting or mutating real business user passwords.
 */
const PROTECTED_BUSINESS_EMAILS = Object.freeze([
  'tammyhahm@gmail.com',
  'tammyhahm77@gmail.com',
  'chae@letusto.com',
  'jslee@letusto.com',
]);

function assertCanMutatePassword(targetEmail, scriptName = 'unknown script') {
  if (!targetEmail) return;
  const normalized = targetEmail.trim().toLowerCase();
  if (PROTECTED_BUSINESS_EMAILS.includes(normalized)) {
    throw new Error(
      `[SECURITY RECURRENCE PREVENTION GUARD] Blocked attempt by ${scriptName} to mutate password for protected business user: ${normalized}. ` +
      `Automated QA must use dedicated test account 'qa-retailer-test@letusto.com'.`
    );
  }
}

module.exports = {
  PROTECTED_BUSINESS_EMAILS,
  assertCanMutatePassword,
};
