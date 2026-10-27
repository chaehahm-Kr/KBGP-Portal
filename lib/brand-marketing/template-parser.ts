/**
 * External Template Package Sanitizer & Validator
 * Task ID: ADM-BSRC-006 (Section 4 & 5)
 */

export const SUPPORTED_TEMPLATE_VARIABLES = [
  "company_name",
  "contact_name",
  "brand_name",
  "custom_message",
] as const;

export interface TemplateValidationResult {
  isValid: boolean;
  sanitizedHtml: string;
  plainText: string;
  detectedVariables: string[];
  missingVariables: string[];
  warnings: string[];
  errors: string[];
}

/**
 * Strips script tags, active event handlers, iframes, and dangerous attributes from external designer HTML.
 */
export function sanitizeEmailHtml(rawHtml: string): string {
  if (!rawHtml) return "";

  let cleaned = rawHtml
    // Strip script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Strip iframe, embed, object
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
    // Strip inline javascript: event handlers
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    // Strip javascript: pseudo protocols
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    .replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');

  return cleaned;
}

/**
 * Derives a clean plain text fallback from HTML markup.
 */
export function convertHtmlToPlainText(html: string): string {
  if (!html) return "";

  return html
    // Replace <br> and paragraph breaks with newlines
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    // Remove all remaining HTML tags
    .replace(/<[^>]*>?/gm, "")
    // Decode common entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Normalize excess whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/(\r\n|\r|\n){3,}/g, "\n\n")
    .trim();
}

/**
 * Validates external designer HTML package against security rules and placeholder requirements.
 */
export function validateAndSanitizeTemplate(
  rawHtml: string,
  subject: string,
  landingPageUrl?: string
): TemplateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rawHtml || !rawHtml.trim()) {
    errors.push("Email HTML content is required.");
    return {
      isValid: false,
      sanitizedHtml: "",
      plainText: "",
      detectedVariables: [],
      missingVariables: [],
      warnings,
      errors,
    };
  }

  if (!subject || !subject.trim()) {
    errors.push("Email subject is required.");
  }

  // Check landing page URL safety if supplied
  if (landingPageUrl && landingPageUrl.trim()) {
    try {
      const parsed = new URL(landingPageUrl.trim());
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        errors.push("Landing page URL must use http: or https: protocol.");
      }
    } catch {
      errors.push("Invalid landing page URL format.");
    }
  }

  // Detect placeholders: {{variable_name}}
  const varMatches = rawHtml.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
  const detectedVariables = Array.from(
    new Set(varMatches.map((m) => m.replace(/[\{\}]/g, "").trim()))
  );

  const missingVariables = SUPPORTED_TEMPLATE_VARIABLES.filter(
    (v) => !detectedVariables.includes(v)
  );

  if (!detectedVariables.includes("company_name")) {
    warnings.push("Template does not contain {{company_name}}. Personalization may be generic.");
  }

  const sanitizedHtml = sanitizeEmailHtml(rawHtml);
  const plainText = convertHtmlToPlainText(sanitizedHtml);

  // Check responsive meta tag
  if (!sanitizedHtml.includes("viewport")) {
    warnings.push("HTML does not include a responsive viewport meta tag. Mobile rendering might scale down.");
  }

  return {
    isValid: errors.length === 0,
    sanitizedHtml,
    plainText,
    detectedVariables,
    missingVariables,
    warnings,
    errors,
  };
}
