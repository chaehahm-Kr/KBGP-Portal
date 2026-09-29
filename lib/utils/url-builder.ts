/**
 * Canonical Production Domain Builder Utility
 * Standardizes domain resolution and email link creation according to DEPLOY-STD-001 & PORT-ONB-003.
 */

/**
 * Returns the canonical Production Brand Portal domain.
 * Production partner-facing links MUST use https://portal.kselectnetwork.com.
 * Never leak vercel.app preview URLs or ambiguous env values into emails.
 */
export function getCanonicalBrandPortalDomain(): string {
  if (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_SITE_URL &&
    process.env.NEXT_PUBLIC_SITE_URL.includes("localhost")
  ) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  return "https://portal.kselectnetwork.com";
}

/**
 * Returns the canonical Production Admin domain.
 */
export function getCanonicalAdminDomain(): string {
  if (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_SITE_URL &&
    process.env.NEXT_PUBLIC_SITE_URL.includes("localhost")
  ) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  return "https://admin.kselectnetwork.com";
}

/**
 * Canonical helper for building Brand Portal invitation URLs containing the raw invitation token.
 * Concept: buildBrandPortalInvitationUrl(rawInvitationToken)
 * Production result: https://portal.kselectnetwork.com/portal/signup?token={rawToken}
 */
export function buildBrandPortalInvitationUrl(rawInvitationToken: string): string {
  const domain = getCanonicalBrandPortalDomain();
  const cleanToken = (rawInvitationToken || "").trim();
  return `${domain}/portal/signup?token=${encodeURIComponent(cleanToken)}`;
}
