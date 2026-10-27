import { InvalidSourceUrlError, SsrFProtectionError } from "./errors";

/**
 * Checks if a hostname or IP address resolves to a private, loopback, or metadata address.
 */
export function isPrivateOrReservedHost(hostname: string): boolean {
  if (!hostname) return true;
  const clean = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");

  // Localhost checks
  if (
    clean === "localhost" ||
    clean.endsWith(".localhost") ||
    clean.endsWith(".local") ||
    clean.endsWith(".internal") ||
    clean === "127.0.0.1" ||
    clean === "0.0.0.0" ||
    clean === "::1"
  ) {
    return true;
  }

  // Cloud metadata services
  if (
    clean === "169.254.169.254" ||
    clean === "metadata.google.internal" ||
    clean === "instance-data"
  ) {
    return true;
  }

  // IPv4 Private Ranges (RFC 1918 / RFC 3927)
  const ipParts = clean.split(".").map((part) => parseInt(part, 10));
  if (ipParts.length === 4 && ipParts.every((n) => !isNaN(n) && n >= 0 && n <= 255)) {
    const [p0, p1] = ipParts;
    // 10.0.0.0/8
    if (p0 === 10) return true;
    // 172.16.0.0/12
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;
    // 192.168.0.0/16
    if (p0 === 192 && p1 === 168) return true;
    // 169.254.0.0/16 (Link-Local)
    if (p0 === 169 && p1 === 254) return true;
    // 127.0.0.0/8 (Loopback)
    if (p0 === 127) return true;
    // 0.0.0.0/8
    if (p0 === 0) return true;
  }

  return false;
}

/**
 * Validates any external URL before sending HTTP requests, ensuring protection against SSRF.
 */
export function validateSafeExternalUrl(rawUrl: string): URL {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new InvalidSourceUrlError("URL must be a non-empty string", String(rawUrl));
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch (err) {
    throw new InvalidSourceUrlError(`Malformed URL: ${rawUrl}`, rawUrl);
  }

  // Only allow HTTP/HTTPS
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InvalidSourceUrlError(
      `Unsupported protocol '${parsed.protocol}'. Only http: and https: are allowed.`,
      rawUrl
    );
  }

  // Prevent SSRF against private networks
  if (isPrivateOrReservedHost(parsed.hostname)) {
    throw new SsrFProtectionError(
      `Blocked request to private or reserved host: ${parsed.hostname}`,
      parsed.hostname
    );
  }

  return parsed;
}

/**
 * Validates that a URL is an authentic InterCHARM Korea exhibitor directory link.
 */
export function validateIntercharmUrl(rawUrl: string): { url: URL; orgId: string } {
  const parsed = validateSafeExternalUrl(rawUrl);

  const allowedHosts = ["www.intercharmkorea.com", "intercharmkorea.com"];
  if (!allowedHosts.includes(parsed.hostname.toLowerCase())) {
    throw new InvalidSourceUrlError(
      `URL host '${parsed.hostname}' is not a valid InterCHARM Korea domain.`,
      rawUrl
    );
  }

  // Extract organisationId from pathname or hash:
  // e.g. Exhibitor_detail.주제이코모.org-ec0b85bc-960d-49d4-9dca-146c10ae59cb.html#/
  const orgMatch = (parsed.pathname + parsed.hash).match(
    /(org-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );

  if (!orgMatch) {
    throw new InvalidSourceUrlError(
      "URL does not contain a valid InterCHARM organization identifier (org-UUID).",
      rawUrl
    );
  }

  return {
    url: parsed,
    orgId: orgMatch[1].toLowerCase(),
  };
}

/**
 * Strips HTML tags and normalizes whitespace to avoid stored XSS.
 */
export function sanitizeText(text: string | null | undefined): string | null {
  if (!text) return null;
  const stripped = text.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
  return stripped.length > 0 ? stripped : null;
}

/**
 * Strips HTML tags while preserving meaningful multi-line paragraph breaks.
 */
export function sanitizeParagraphs(text: string | null | undefined): string | null {
  if (!text) return null;
  const stripped = text
    .replace(/<[^>]*>?/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/(\r\n|\r|\n)\s*(\r\n|\r|\n)+/g, "\n\n")
    .replace(/(\r\n|\r|\n)/g, "\n")
    .trim();
  return stripped.length > 0 ? stripped : null;
}
