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
 * Resolves all supported personalization placeholders in subject and body.
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

  const replacements: Record<string, string> = {
    company_name: companyName,
    contact_name: contactName,
    brand_name: brandName,
    custom_message: customMessage,
  };

  // Helper to replace variables in plain strings (subject / text)
  const replaceInText = (source: string): string => {
    let result = source;
    for (const [key, val] of Object.entries(replacements)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
      result = result.replace(regex, val);
    }
    return result;
  };

  // Helper to replace variables in HTML with escaping
  const replaceInHtml = (source: string): string => {
    let result = source;
    for (const [key, val] of Object.entries(replacements)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
      const safeVal = escapeHtml(val).replace(/\n/g, "<br />");
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
  const unresolvedPlaceholders = Array.from(
    new Set(allMatches.map((m) => m.replace(/[\{\}]/g, "").trim()))
  );

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
