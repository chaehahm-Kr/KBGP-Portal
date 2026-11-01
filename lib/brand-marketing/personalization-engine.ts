/**
 * Email Personalization Engine
 * Task ID: ADM-BSRC-006 (Section 5)
 */

export interface PersonalizationContext {
  companyName: string;
  contactName?: string | null;
  brandName?: string | null;
  customMessage?: string | null;
  language?: "ko" | "en";
  landingUrl?: string | null;
  senderName?: string | null;
  senderTitle?: string | null;
  companyAddress?: string | null;
}

export interface RenderedEmailResult {
  subject: string;
  html: string;
  plainText: string;
  unresolvedPlaceholders: string[];
  warnings: string[];
}

/**
 * HTML-escapes raw string variables before embedding into HTML templates.
 */
export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Resolves all supported personalization placeholders in subject and body (case-insensitive).
 */
export function personalizeEmail(
  templateSubject: string,
  templateHtml: string,
  templatePlainText: string | undefined,
  context: PersonalizationContext
): RenderedEmailResult {
  const warnings: string[] = [];
  const isEn = context.language === "en";

  const companyName = context.companyName?.trim() || (isEn ? "Your Company" : "귀사");
  const contactName = context.contactName?.trim() || (isEn ? "Representative" : "담당자님");
  const brandName = context.brandName?.trim() || companyName;
  const customMessage = context.customMessage?.trim() || "";
  const landingUrl = context.landingUrl?.trim() || "https://www.kselectnetwork.com";
  const senderName = context.senderName?.trim() || "Letusto Inc. / K SELECT NETWORK";
  const senderTitle = context.senderTitle?.trim() || "Partner Relations Team";
  const companyAddress = context.companyAddress?.trim() || "23B Roland Ave., Mount Laurel, NJ 08054, USA";

  const replacements: Record<string, string> = {
    company_name: companyName,
    company: companyName,
    contact_name: contactName,
    contact: contactName,
    brand_name: brandName,
    brand: brandName,
    custom_message: customMessage,
    message: customMessage,
    landing_url: landingUrl,
    landing_page_url: landingUrl,
    cta_url: landingUrl,
    sender_name: senderName,
    sender_title: senderTitle,
    company_address: companyAddress,
  };

  // Helper to replace variables in plain strings (subject / text)
  const replaceInText = (source: string): string => {
    let result = source;
    for (const [key, val] of Object.entries(replacements)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
      result = result.replace(regex, val);
    }
    return result;
  };

  // Helper to replace variables in HTML with escaping
  const replaceInHtml = (source: string): string => {
    let result = source;
    for (const [key, val] of Object.entries(replacements)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
      // Don't escape URLs with HTML entity escaping if they will be used in href attributes
      const isUrl = key.includes("url");
      const safeVal = isUrl ? val : escapeHtml(val).replace(/\n/g, "<br />");
      result = result.replace(regex, safeVal);
    }
    return result;
  };

  const resolvedSubject = replaceInText(templateSubject);
  const resolvedHtml = replaceInHtml(templateHtml);
  const resolvedPlainText = templatePlainText ? replaceInText(templatePlainText) : "";

  // Check for unresolved placeholders across subject, html, and plain text
  const subjectMatches = resolvedSubject.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
  const htmlMatches = resolvedHtml.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
  const textMatches = resolvedPlainText.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
  const allMatches = [...subjectMatches, ...htmlMatches, ...textMatches];

  // System placeholders that are resolved during email assembly / footer addition
  const systemPlaceholders = new Set([
    "landing_url",
    "landing_page_url",
    "cta_url",
    "image_host",
    "unsubscribe_url",
    "company_address",
    "sender_name",
    "sender_title",
  ]);

  const unresolvedPlaceholders = Array.from(
    new Set(allMatches.map((m) => m.replace(/[\{\}]/g, "").trim().toLowerCase()))
  ).filter((p) => !systemPlaceholders.has(p));

  if (unresolvedPlaceholders.length > 0) {
    warnings.push(
      `Unresolved placeholders detected: ${unresolvedPlaceholders.map((p) => `{{${p}}}`).join(", ")}`
    );
  }

  return {
    subject: resolvedSubject,
    html: resolvedHtml,
    plainText: resolvedPlainText,
    unresolvedPlaceholders,
    warnings,
  };
}
