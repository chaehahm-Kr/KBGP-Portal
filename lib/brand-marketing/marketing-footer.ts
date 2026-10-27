export interface MarketingFooterSettings {
  id: string;
  brandDisplayName: string;
  legalCompanyName: string;
  physicalAddress: string;
  contactEmail: string;
  contactWebsite?: string;
  disclosureKo: string;
  disclosureEn: string;
  defaultLanguage: "ko" | "en";
  updatedAt?: string;
  updatedBy?: string | null;
}

export const DEFAULT_MARKETING_FOOTER: MarketingFooterSettings = {
  id: "central_marketing_footer",
  brandDisplayName: "K SELECT NETWORK",
  legalCompanyName: "Operated by Letusto Inc.",
  physicalAddress: "1201 Orange St, Suite 600, Wilmington, DE 19801, USA",
  contactEmail: "support@kselectnetwork.com",
  contactWebsite: "https://www.kselectnetwork.com",
  disclosureKo: "본 메일은 K SELECT NETWORK의 브랜드 파트너십 안내 이메일입니다.",
  disclosureEn: "This email provides information about K SELECT NETWORK brand partnerships.",
  defaultLanguage: "ko",
  updatedAt: new Date().toISOString(),
};

export const FOOTER_START_MARKER = "<!-- MARKETING_FOOTER_START -->";
export const FOOTER_END_MARKER = "<!-- MARKETING_FOOTER_END -->";

/**
 * Validates whether all legally required fields are configured in the footer.
 */
export function validateMarketingFooterCompleteness(settings: MarketingFooterSettings): {
  isValid: boolean;
  missingFields: string[];
} {
  const missing: string[] = [];
  if (!settings.physicalAddress || settings.physicalAddress.trim().length === 0) {
    missing.push("Physical Mailing Address (사업장 소재지 물리적 주소)");
  }
  if (!settings.contactEmail || settings.contactEmail.trim().length === 0 || !settings.contactEmail.includes("@")) {
    missing.push("Contact Email (공식 문의 이메일)");
  }
  if (!settings.brandDisplayName || settings.brandDisplayName.trim().length === 0) {
    missing.push("Brand Display Name (브랜드 표시명)");
  }
  if (!settings.legalCompanyName || settings.legalCompanyName.trim().length === 0) {
    missing.push("Legal Company Name (법인/운영사명)");
  }

  return {
    isValid: missing.length === 0,
    missingFields: missing,
  };
}

/**
 * Compiles the minimal premium, email-client compatible HTML markup for the marketing footer.
 */
export function buildMarketingFooterHtml(
  settings: MarketingFooterSettings,
  options: {
    language: "ko" | "en";
    unsubscribeUrl: string;
  }
): string {
  const isKo = options.language === "ko";
  const disclosure = isKo ? settings.disclosureKo : settings.disclosureEn;
  const unsubLabel = isKo ? "수신거부 (Unsubscribe)" : "Unsubscribe from marketing emails";
  const privacyLabel = isKo ? "개인정보 처리방침" : "Privacy Policy";
  const contactWebsite = settings.contactWebsite || "https://www.kselectnetwork.com";

  return `
${FOOTER_START_MARKER}
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background-color:#FBF8F5;border-top:1px solid #ECE7DF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td style="padding:28px 24px;text-align:center;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="text-align:center;padding-bottom:10px;">
            <span style="font-size:13px;font-weight:700;color:#18181B;letter-spacing:0.5px;text-transform:uppercase;">
              ${escapeHtml(settings.brandDisplayName)}
            </span>
            <br />
            <span style="font-size:11px;color:#71717A;line-height:16px;">
              ${escapeHtml(settings.legalCompanyName)}
            </span>
          </td>
        </tr>
        <tr>
          <td style="text-align:center;padding-bottom:12px;font-size:11px;color:#71717A;line-height:18px;">
            ${escapeHtml(settings.physicalAddress)}
            <br />
            Contact: <a href="mailto:${escapeHtml(settings.contactEmail)}" style="color:#71717A;text-decoration:underline;">${escapeHtml(settings.contactEmail)}</a>
            ${settings.contactWebsite ? ` &nbsp;·&nbsp; <a href="${escapeHtml(contactWebsite)}" target="_blank" style="color:#71717A;text-decoration:underline;">${escapeHtml(contactWebsite.replace(/^https?:\/\//, ''))}</a>` : ''}
          </td>
        </tr>
        <tr>
          <td style="text-align:center;padding-bottom:14px;font-size:11px;color:#A1A1AA;line-height:17px;">
            ${escapeHtml(disclosure)}
          </td>
        </tr>
        <tr>
          <td style="text-align:center;padding-top:8px;border-top:1px solid #EBE6DE;font-size:11px;color:#71717A;line-height:16px;">
            <a href="${escapeHtml(options.unsubscribeUrl)}" target="_blank" style="color:#4F46E5;font-weight:600;text-decoration:underline;">
              ${unsubLabel}
            </a>
            &nbsp;&nbsp;·&nbsp;&nbsp;
            <a href="https://www.kselectnetwork.com/privacy" target="_blank" style="color:#71717A;text-decoration:none;">
              ${privacyLabel}
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
${FOOTER_END_MARKER}
`.trim();
}

/**
 * Detects whether the provided HTML already contains existing footer or unsubscribe markup.
 */
export function detectExistingFooterInHtml(html: string): {
  hasExistingFooter: boolean;
  detectedKeywords: string[];
  snippet?: string;
} {
  if (!html) return { hasExistingFooter: false, detectedKeywords: [] };

  const keywords = [
    "수신거부",
    "수신 거부",
    "unsubscribe",
    "opt-out",
    "opt out",
    "mailing address",
    "physical address",
  ];

  const found: string[] = [];
  const lower = html.toLowerCase();

  for (const kw of keywords) {
    if (lower.includes(kw)) {
      found.push(kw);
    }
  }

  // Also check for explicit footer HTML tags
  if (lower.includes("<footer") || lower.includes('class="footer"') || lower.includes("id=\"footer\"")) {
    found.push("<footer tag>");
  }

  let snippet: string | undefined;
  if (found.length > 0) {
    const idx = lower.indexOf(found[0]);
    if (idx !== -1) {
      snippet = html.substring(Math.max(0, idx - 40), Math.min(html.length, idx + 120)).trim();
    }
  }

  return {
    hasExistingFooter: found.length > 0,
    detectedKeywords: Array.from(new Set(found)),
    snippet,
  };
}

/**
 * Assembles the full send-ready email by idempotently appending/replacing the central marketing footer.
 */
export function assembleEmailWithMarketingFooter(
  html: string,
  options: {
    footerSettings: MarketingFooterSettings;
    language: "ko" | "en";
    unsubscribeUrl: string;
    landingPageUrl?: string;
    previewText?: string;
  }
): string {
  let assembled = html || "";

  // 1. Resolve Preheader / Preview Text at the top if provided
  if (options.previewText && options.previewText.trim().length > 0) {
    const cleanPreview = escapeHtml(options.previewText.trim());
    const preheaderSnippet = `
<!-- PREHEADER PREVIEW TEXT -->
<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
  ${cleanPreview}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>
`.trim();

    // Remove any previous preheader snippet to avoid duplicate stacking
    assembled = assembled.replace(/<!-- PREHEADER PREVIEW TEXT -->[\s\S]*?<\/div>/i, "");

    if (assembled.includes("<body")) {
      assembled = assembled.replace(/(<body[^>]*>)/i, `$1\n${preheaderSnippet}`);
    } else {
      assembled = `${preheaderSnippet}\n${assembled}`;
    }
  }

  // 2. Build the exact footer markup
  const footerHtml = buildMarketingFooterHtml(options.footerSettings, {
    language: options.language,
    unsubscribeUrl: options.unsubscribeUrl,
  });

  // 3. Idempotently replace or append the footer
  if (assembled.includes(FOOTER_START_MARKER) && assembled.includes(FOOTER_END_MARKER)) {
    // Replace existing assembled central footer block
    const regex = new RegExp(`${FOOTER_START_MARKER}[\\s\\S]*?${FOOTER_END_MARKER}`, "g");
    assembled = assembled.replace(regex, footerHtml);
  } else {
    // Append before </body> if present, or to end of markup
    if (assembled.includes("</body>")) {
      assembled = assembled.replace("</body>", `${footerHtml}\n</body>`);
    } else {
      assembled = `${assembled}\n${footerHtml}`;
    }
  }

  // 4. Resolve explicit CTA links if template designated a campaign CTA
  if (options.landingPageUrl && options.landingPageUrl.trim().length > 0) {
    const targetUrl = options.landingPageUrl.trim();
    assembled = assembled.replace(/\{\{landing_page_url\}\}/gi, targetUrl);
    assembled = assembled.replace(/href=["']\{\{cta_url\}\}["']/gi, `href="${escapeHtml(targetUrl)}"`);
  }

  // 5. Replace any standalone {{unsubscribe_url}} placeholders
  assembled = assembled.replace(/\{\{unsubscribe_url\}\}/gi, options.unsubscribeUrl);

  return assembled;
}

function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
