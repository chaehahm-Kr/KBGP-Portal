/**
 * Brand Sourcing Duplicate Detection & Prevention Engine
 * Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001
 * Task: ADM-BSRC-010
 *
 * Implements deterministic normalization for URLs, Korean/English company names,
 * official website domains, and similarity algorithms (Levenshtein & Token Dice).
 */

// Common tracking parameters to strip during URL normalization
const TRACKING_QUERY_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "fbclid",
  "gclid",
  "_hsenc",
  "_hsmi",
  "mc_cid",
  "mc_eid",
  "trk",
  "source",
  "campaign",
  "_ga",
  "ref_src",
  "ref_url",
]);

/**
 * Normalizes any exhibitor or company source URL:
 * - Decodes URL encoding where appropriate
 * - Strips fragments (# and #/...)
 * - Strips trailing slashes
 * - Strips tracking query parameters
 * - Deterministically sorts remaining query parameters
 * - Preserves essential exhibitor identifiers (e.g., org-... in InterCHARM URLs)
 */
export function normalizeSourceUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";

  let trimmed = rawUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  try {
    // Decode URI if it was encoded (e.g. %EC%A3%BC...)
    let decoded = trimmed;
    try {
      decoded = decodeURI(trimmed);
    } catch {
      decoded = trimmed;
    }

    // Strip hash fragment first (e.g. #/ or #overview)
    const hashIndex = decoded.indexOf("#");
    const withoutHash = hashIndex !== -1 ? decoded.slice(0, hashIndex) : decoded;

    // Parse URL safely
    const parsed = new URL(withoutHash);

    // Normalize protocol and host
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();

    // Filter query parameters
    const cleanedParams = new URLSearchParams();
    const sortedKeys = Array.from(parsed.searchParams.keys()).sort();
    for (const key of sortedKeys) {
      if (!TRACKING_QUERY_PARAMS.has(key.toLowerCase())) {
        const val = parsed.searchParams.get(key);
        if (val !== null) {
          cleanedParams.set(key, val);
        }
      }
    }

    // Strip trailing slashes from pathname (preserving root '/')
    let pathname = parsed.pathname.replace(/\/+$/, "");
    if (!pathname) pathname = "/";

    const queryString = cleanedParams.toString();
    const result = `${parsed.protocol}//${parsed.hostname}${pathname}${queryString ? `?${queryString}` : ""}`;

    return result.replace(/\/+$/, "");
  } catch {
    // Fallback for non-standard or relative URLs
    return trimmed
      .replace(/#.*$/, "")
      .replace(/\/+$/, "")
      .toLowerCase();
  }
}

/**
 * Extracts unique exhibitor identifier (e.g. org-58dc1b85-d7a8-4c59-a5c2-afc1e4823d7b)
 * from InterCHARM or other exhibition URLs.
 */
export function extractExhibitorIdentifier(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(org-[0-9a-fA-F-]+)/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Normalizes Korean company names for strict and fuzzy duplicate matching.
 * - Strips legal company designations: (주), ㈜, 주식회사, (유), 유한회사, (합), 합자회사, 합명회사, (재), 재단법인, (사), 사단법인
 * - Collapses and strips all whitespace
 * - Strips common brackets and punctuation
 * - Converts any English letters to lowercase
 */
export function normalizeKoreanCompanyName(rawName: string): string {
  if (!rawName || typeof rawName !== "string") return "";

  return rawName
    .replace(/\(주\)|\㈜|\주식회사|\(유\)|\유한회사|\(합\)|\합자회사|\합명회사|\(재\)|\재단법인|\(사\)|\사단법인/gi, "")
    .replace(/[()[\]{}.,\-_/·ㆍ]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Normalizes English company names for strict duplicate matching.
 * - Lowercases and trims
 * - Strips common corporate legal suffixes (e.g. Inc., LLC, Co., Ltd., Corp., etc.)
 * - Strips surrounding punctuation
 * - Collapses whitespace
 */
export function normalizeEnglishCompanyName(rawName: string): string {
  if (!rawName || typeof rawName !== "string") return "";

  let cleaned = rawName.toLowerCase().trim();

  // Strip corporate suffixes at the end of the name
  cleaned = cleaned.replace(
    /\b(co\.?,?\s*ltd\.?|co\.?|ltd\.?|inc\.?|incorporated|llc|l\.l\.c\.|corp\.?|corporation|llp|gmbh|s\.a\.|pty\s*ltd|limited)\b/gi,
    ""
  );

  // Strip punctuation and special characters
  cleaned = cleaned.replace(/[()[\]{}.,\-_/&]/g, " ");

  // Collapse whitespace
  return cleaned.replace(/\s+/g, " ").trim();
}

/**
 * Normalizes brand names for strict duplicate matching.
 * Task: ADM-BSRC-012-R1
 * - Lowercases and trims
 * - Strips common brackets and punctuation: ()[]{}.,-_/·ㆍ'"
 * - Collapses whitespace
 */
export function normalizeBrandName(rawName: string): string {
  if (!rawName || typeof rawName !== "string") return "";

  return rawName
    .toLowerCase()
    .replace(/[()[\]{}.,\-_/·ㆍ'"`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes an official website URL down to its canonical domain:
 * - Strips protocol, path, query, fragment
 * - Strips leading 'www.' and 'm.'
 * - Lowercases
 */
export function normalizeWebsiteDomain(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";

  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
    return parsed.hostname.replace(/^(www|m)\./i, "").toLowerCase();
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/^(www|m)\./i, "")
      .split("/")[0]
      .split("?")[0]
      .split("#")[0]
      .toLowerCase();
  }
}

/**
 * Computes standard Levenshtein distance between two strings.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Calculates normalized string similarity ratio between 0.0 and 1.0.
 */
export function calculateStringSimilarity(s1: string, s2: string): number {
  if (!s1 && !s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  if (s1 === s2) return 1.0;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshteinDistance(s1, s2);
  return 1.0 - dist / maxLen;
}

/**
 * Checks whether two company names are similar enough to flag a potential duplicate.
 * - Levenshtein distance <= 1 for names of length >= 3
 * - Levenshtein distance <= 2 for names of length >= 6
 * - Similarity ratio >= 0.82
 */
export function areCompanyNamesSimilar(name1: string, name2: string): {
  isSimilar: boolean;
  distance: number;
  similarity: number;
} {
  const norm1 = normalizeKoreanCompanyName(name1);
  const norm2 = normalizeKoreanCompanyName(name2);

  if (!norm1 || !norm2) return { isSimilar: false, distance: 99, similarity: 0 };
  if (norm1 === norm2) return { isSimilar: true, distance: 0, similarity: 1.0 };

  const distance = levenshteinDistance(norm1, norm2);
  const similarity = calculateStringSimilarity(norm1, norm2);

  const minLen = Math.min(norm1.length, norm2.length);

  // For very short names (<= 2 chars), require exact match
  if (minLen <= 2) {
    return { isSimilar: false, distance, similarity };
  }

  // Length 3-5: distance <= 1
  if (minLen <= 5 && distance <= 1) {
    return { isSimilar: true, distance, similarity };
  }

  // Length >= 6: distance <= 2 or similarity >= 0.82
  if (minLen >= 6 && (distance <= 2 || similarity >= 0.82)) {
    return { isSimilar: true, distance, similarity };
  }

  return { isSimilar: false, distance, similarity };
}
