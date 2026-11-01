/**
 * Email Personalization Engine & Preflight Validator
 * Task ID: ADM-EMAIL-TPL-005 (Fidelity & Preflight Validation)
 * Standards: DEPLOY-STD-001, AGENTS.md Rule 27
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
  kakaoOpenchatUrl?: string | null;
  kakaoQrUrl?: string | null;
  imageHost?: string | null;
}

export interface RenderedEmailResult {
  subject: string;
  html: string;
  plainText: string;
  unresolvedPlaceholders: string[];
  warnings: string[];
}

export interface ValidationIssue {
  severity: "BLOCKING" | "WARNING" | "INFO";
  category: "PLACEHOLDER" | "IMAGE" | "LINK" | "FOOTER" | "SECURITY";
  message: string;
  token?: string;
}

export interface SendReadyHtmlValidationResult {
  isValid: boolean; // true if blockingCount === 0
  blockingCount: number;
  warningCount: number;
  issues: ValidationIssue[];
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
  
  // Kakao OpenChat and QR destinations
  const defaultKakaoUrl = "https://open.kakao.com/o/sKSelectNetwork";
  const kakaoUrl = context.kakaoOpenchatUrl?.trim() || defaultKakaoUrl;
  const kakaoQrUrl = context.kakaoQrUrl?.trim() || kakaoUrl;

  // Image Host
  const imageHost = context.imageHost?.trim() || "https://admin.kselectnetwork.com/assets";

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
    kakao_openchat_url: kakaoUrl,
    kakao_url: kakaoUrl,
    kakao_chat_url: kakaoUrl,
    kakao_qr_url: kakaoQrUrl,
    image_host: imageHost,
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
      // Don't escape URLs with HTML entity escaping if they will be used in href/src attributes
      const isUrl = key.includes("url") || key.includes("host");
      const safeVal = isUrl ? val : escapeHtml(val).replace(/\n/g, "<br />");
      result = result.replace(regex, safeVal);
    }
    return result;
  };

  const resolvedSubject = replaceInText(templateSubject);
  const resolvedHtml = replaceInHtml(templateHtml);
  const resolvedPlainText = templatePlainText ? replaceInText(templatePlainText) : "";

  // Check for unresolved placeholders across subject, html, and plain text
  const subjectMatches = resolvedSubject.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || [];
  const htmlMatches = resolvedHtml.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || [];
  const textMatches = resolvedPlainText.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || [];
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
    "kakao_openchat_url",
    "kakao_url",
    "kakao_chat_url",
    "kakao_qr_url",
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

/**
 * Validates a finalized Send-Ready HTML document before campaign dispatch or approval.
 * Scans both text nodes and tag attributes (href, src, etc.) for unresolved placeholders,
 * broken images, dummy links, or security violations.
 */
export function validateSendReadyHtml(
  html: string,
  subject: string,
  options?: {
    allowSystemPlaceholders?: boolean;
    isTestSend?: boolean;
  }
): SendReadyHtmlValidationResult {
  const issues: ValidationIssue[] = [];

  if (!html || !html.trim()) {
    issues.push({
      severity: "BLOCKING",
      category: "SECURITY",
      message: "Email HTML content is completely empty.",
    });
    return {
      isValid: false,
      blockingCount: 1,
      warningCount: 0,
      issues,
    };
  }

  // 1. Scan for any unresolved {{placeholder}} in subject and HTML (including inside attributes)
  const combined = `${subject} ${html}`;
  const matches = combined.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || [];
  const uniquePlaceholders = Array.from(
    new Set(matches.map((m) => m.replace(/[\{\}]/g, "").trim().toLowerCase()))
  );

  for (const token of uniquePlaceholders) {
    // If unsubscribe_url is still present in an unassembled raw template, it's allowed only if requested
    if (token === "unsubscribe_url" && options?.allowSystemPlaceholders) {
      issues.push({
        severity: "INFO",
        category: "PLACEHOLDER",
        message: `System token {{${token}}} will be resolved during final footer injection.`,
        token,
      });
      continue;
    }

    issues.push({
      severity: "BLOCKING",
      category: "PLACEHOLDER",
      message: `Unresolved placeholder token '{{${token}}}' found in email subject or body. Delivery is blocked.`,
      token,
    });
  }

  // 2. Scan image sources
  const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
  for (const match of imgMatches) {
    const src = match[1].trim();
    if (!src) {
      issues.push({
        severity: "BLOCKING",
        category: "IMAGE",
        message: "An image tag has an empty 'src' attribute.",
      });
    } else if (src.includes("{{") || src.includes("}}")) {
      issues.push({
        severity: "BLOCKING",
        category: "IMAGE",
        message: `Image source contains unresolved placeholder: ${src}`,
      });
    } else if (
      src.startsWith("http://localhost") ||
      src.startsWith("http://127.0.0.1") ||
      src.startsWith("file://") ||
      src.startsWith("blob:")
    ) {
      issues.push({
        severity: "BLOCKING",
        category: "IMAGE",
        message: `Image source uses local or invalid origin URL: ${src}`,
      });
    } else if (src.startsWith("http://")) {
      issues.push({
        severity: "WARNING",
        category: "SECURITY",
        message: `Image source uses insecure HTTP protocol: ${src}. HTTPS is strongly recommended.`,
      });
    }
  }

  // 3. Scan link URLs
  const linkMatches = html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi);
  for (const match of linkMatches) {
    const href = match[1].trim();
    if (href.includes("{{") || href.includes("}}")) {
      // If it's unsubscribe_url and allowSystemPlaceholders is true
      if (href.includes("{{unsubscribe_url}}") && options?.allowSystemPlaceholders) {
        continue;
      }
      issues.push({
        severity: "BLOCKING",
        category: "LINK",
        message: `Hyperlink destination contains unresolved placeholder: ${href}`,
      });
    } else if (href === "#" || href === "") {
      issues.push({
        severity: "WARNING",
        category: "LINK",
        message: "Hyperlink has an empty or dummy '#' destination.",
      });
    }
  }

  // 4. Verify Kakao QR section consistency if present
  const lowerHtml = html.toLowerCase();
  if (lowerHtml.includes("kakao")) {
    // Check if Kakao link has a valid target
    const kakaoLinkMatch = html.match(/href=["'](https?:\/\/[^"']*kakao[^"']*)["']/i);
    if (!kakaoLinkMatch && !options?.isTestSend) {
      issues.push({
        severity: "WARNING",
        category: "LINK",
        message: "Kakao branding is present but no valid Kakao OpenChat URL was resolved.",
      });
    }
  }

  // 5. Unsubscribe link verification
  if (!options?.allowSystemPlaceholders) {
    const hasUnsubLink =
      lowerHtml.includes("unsubscribe") ||
      lowerHtml.includes("수신거부") ||
      lowerHtml.includes("수신 거부");
    if (!hasUnsubLink) {
      issues.push({
        severity: "BLOCKING",
        category: "FOOTER",
        message: "Mandatory Unsubscribe link or disclosure is missing from final email content.",
      });
    }
  }

  const blockingCount = issues.filter((i) => i.severity === "BLOCKING").length;
  const warningCount = issues.filter((i) => i.severity === "WARNING").length;

  return {
    isValid: blockingCount === 0,
    blockingCount,
    warningCount,
    issues,
  };
}
