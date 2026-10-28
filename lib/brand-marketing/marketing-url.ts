/**
 * Centralized Canonical Marketing URL Configuration
 *
 * Requirements (ADM-BSRC-009-R4):
 * - Eliminates internal Vercel deployment domains (e.g. kbgp-portal.vercel.app).
 * - Routes to verified canonical domains where public endpoints are deployed.
 * - Supports explicit environment override (MARKETING_PUBLIC_CANONICAL_URL) once
 *   domain routing or rewrites are enabled on www.kselectnetwork.com.
 * - Defaults to https://portal.kselectnetwork.com which is the public-facing domain
 *   hosted by this project and verified serving /unsubscribe (HTTP 200).
 */

export const DEFAULT_CANONICAL_MARKETING_URL = "https://portal.kselectnetwork.com";

/**
 * Returns the authoritative canonical base URL for public marketing communications
 * (unsubscribe links, landing redirects, public asset references).
 */
export function getCanonicalMarketingBaseUrl(): string {
  // 1. Explicit override via environment variables (clean trailing slashes)
  const envUrl =
    process.env.MARKETING_PUBLIC_CANONICAL_URL ||
    process.env.NEXT_PUBLIC_MARKETING_CANONICAL_URL ||
    "";

  if (envUrl && !envUrl.includes("vercel.app")) {
    return envUrl.trim().replace(/\/$/, "");
  }

  // 2. Fallback to public portal domain (strictly never returns vercel.app domains)
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (siteUrl && siteUrl.includes("kselectnetwork.com") && !siteUrl.includes("vercel.app")) {
    return siteUrl;
  }

  return DEFAULT_CANONICAL_MARKETING_URL;
}
