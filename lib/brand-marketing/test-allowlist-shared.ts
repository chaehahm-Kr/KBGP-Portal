export const MAX_TEST_RECIPIENTS_PER_BATCH = 5;

export const DEFAULT_INTERNAL_ALLOWED_DOMAINS = ["letusto.com", "kselectnetwork.com"];

export interface ParsedRecipientSummary {
  raw: string;
  normalized: string;
  isValidFormat: boolean;
  formatError?: string;
  isDuplicate: boolean;
}

export interface ParseTestRecipientsResult {
  allNormalized: string[];
  uniqueRecipients: string[];
  invalidInputs: Array<{ raw: string; reason: string }>;
  duplicateCount: number;
  totalParsed: number;
  exceedsBatchLimit: boolean;
  maxBatchSize: number;
}

/**
 * Standard RFC 5322 compliant regex for basic email format validation.
 */
export const EMAIL_FORMAT_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Parses, normalizes, deduplicates, and validates test email recipients
 * from a raw multi-recipient string (supporting commas, semicolons, and newlines).
 */
export function parseAndValidateTestRecipients(
  rawInput: string,
  maxBatchSize: number = MAX_TEST_RECIPIENTS_PER_BATCH
): ParseTestRecipientsResult {
  if (!rawInput || typeof rawInput !== "string") {
    return {
      allNormalized: [],
      uniqueRecipients: [],
      invalidInputs: [],
      duplicateCount: 0,
      totalParsed: 0,
      exceedsBatchLimit: false,
      maxBatchSize,
    };
  }

  // Split on commas, semicolons, newlines, carriage returns, or multiple spaces
  const rawTokens = rawInput
    .split(/[\r\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const seen = new Set<string>();
  const uniqueRecipients: string[] = [];
  const invalidInputs: Array<{ raw: string; reason: string }> = [];
  let duplicateCount = 0;

  for (const token of rawTokens) {
    const normalized = token.toLowerCase().trim();

    if (!EMAIL_FORMAT_REGEX.test(normalized)) {
      invalidInputs.push({
        raw: token,
        reason: "올바른 이메일 주소 형식이 아닙니다 (Invalid email format)",
      });
      continue;
    }

    if (seen.has(normalized)) {
      duplicateCount++;
      continue;
    }

    seen.add(normalized);
    uniqueRecipients.push(normalized);
  }

  return {
    allNormalized: Array.from(seen),
    uniqueRecipients,
    invalidInputs,
    duplicateCount,
    totalParsed: rawTokens.length,
    exceedsBatchLimit: uniqueRecipients.length > maxBatchSize,
    maxBatchSize,
  };
}

/**
 * Checks whether an individual recipient email is authorized for test dispatch.
 * Allowed:
 * 1. Default internal domains (@letusto.com, @kselectnetwork.com)
 * 2. Owner-approved external test emails in system_settings or EMAIL_TEST_ALLOWLIST
 */
export function isTestRecipientAllowlisted(
  email: string,
  ownerAllowlist: string[] = []
): { isAllowed: boolean; rejectionReason?: string } {
  const normalized = (email || "").toLowerCase().trim();
  if (!normalized || !normalized.includes("@")) {
    return { isAllowed: false, rejectionReason: "Invalid email format" };
  }

  const domain = normalized.split("@")[1];

  // 1. Internal corporate domains
  if (DEFAULT_INTERNAL_ALLOWED_DOMAINS.includes(domain)) {
    return { isAllowed: true };
  }

  // 2. Owner-approved allowlist entries (matches exact email or full domain)
  const normalizedAllowlist = ownerAllowlist.map((e) => e.toLowerCase().trim());
  if (normalizedAllowlist.includes(normalized) || normalizedAllowlist.includes(domain)) {
    return { isAllowed: true };
  }

  return {
    isAllowed: false,
    rejectionReason: `Security Rejection: '${normalized}' is not on the authorized test allowlist. External addresses must be explicitly added to the Owner allowlist before test dispatch.`,
  };
}
