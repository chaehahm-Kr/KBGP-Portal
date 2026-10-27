/**
 * Image Template HTML Compiler & Plain-Text Generator
 * Task ID: ADM-BSRC-006-R1-ADD1
 * Standards: DEPLOY-STD-001, AGENTS.md Rule 27
 *
 * Compiles slice-based image assets into 100% email-client compatible HTML table markup
 * with native <a> tags, zero absolute positioning, zero imagemaps, responsive max-width 600px,
 * accessible alt text, and graceful plain-text fallback.
 */

import { ImageTemplateSection } from "./campaign-types";

export interface CompileImageTemplateOptions {
  sections: ImageTemplateSection[];
  language?: "ko" | "en";
  subject?: string;
  previewText?: string;
  defaultLandingUrl?: string;
}

export interface ImageTemplateCompileResult {
  html: string;
  plainText: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function compileImageTemplateToHtml(
  options: CompileImageTemplateOptions
): ImageTemplateCompileResult {
  const {
    sections = [],
    language = "ko",
    subject = "",
    previewText = "",
    defaultLandingUrl = "https://www.kselectnetwork.com",
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!sections || sections.length === 0) {
    errors.push("At least one image slice section is required to compile an Image Template.");
  }

  // Validate sections
  sections.forEach((sec, idx) => {
    if (!sec.imageUrl || !sec.imageUrl.trim()) {
      errors.push(`Section #${idx + 1} is missing an image asset URL.`);
    } else if (
      !sec.imageUrl.startsWith("https://") &&
      !sec.imageUrl.startsWith("http://") &&
      !sec.imageUrl.startsWith("data:image/")
    ) {
      warnings.push(`Section #${idx + 1} image URL should be a secure HTTPS URL or valid image data.`);
    }

    if (sec.linkUrl && !sec.linkUrl.startsWith("https://") && !sec.linkUrl.startsWith("http://")) {
      warnings.push(`Section #${idx + 1} link URL should use a secure HTTPS protocol.`);
    }
  });

  const isKorean = language === "ko";
  const safeTitle = subject.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safePreheader = previewText.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Build rows for each image slice
  const sectionRows = sections
    .map((sec, idx) => {
      const link = (sec.linkUrl && sec.linkUrl.trim()) || defaultLandingUrl;
      const alt = (sec.altText && sec.altText.trim()) || `K SELECT NETWORK Section ${idx + 1}`;
      const safeAlt = alt.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const safeLink = link.replace(/"/g, "&quot;");

      const imgHtml = `
        <tr>
          <td align="center" style="padding: 0; margin: 0; line-height: 0; font-size: 0; background-color: #ffffff;">
            <a href="${safeLink}" target="_blank" rel="noopener noreferrer" style="display: block; text-decoration: none; border: 0; outline: none;">
              <img
                src="${sec.imageUrl}"
                alt="${safeAlt}"
                width="600"
                style="display: block; width: 100%; max-width: 600px; height: auto; border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;"
              />
            </a>
          </td>
        </tr>`;

      let ctaHtml = "";
      if (sec.hasCtaButton && sec.ctaButtonLabel && sec.ctaButtonLabel.trim()) {
        const ctaUrl = (sec.ctaButtonUrl && sec.ctaButtonUrl.trim()) || link;
        const safeCtaUrl = ctaUrl.replace(/"/g, "&quot;");
        const safeCtaLabel = sec.ctaButtonLabel.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const align = sec.ctaButtonAlign || "center";

        ctaHtml = `
        <tr>
          <td align="${align}" style="padding: 16px 24px; background-color: #ffffff;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeCtaUrl}" style="height:44px;v-text-anchor:middle;width:240px;" arcsize="14%" stroke="f" fillcolor="#09090b">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:sans-serif;font-size:13px;font-weight:bold;">${safeCtaLabel}</center>
            </v:roundrect>
            <![endif]-->
            <a
              href="${safeCtaUrl}"
              target="_blank"
              rel="noopener noreferrer"
              style="display: inline-block; background-color: #09090b; color: #ffffff; padding: 12px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 6px; text-align: center; mso-hide: all;"
            >
              ${safeCtaLabel}
            </a>
          </td>
        </tr>`;
      }

      return `${imgHtml}${ctaHtml}`;
    })
    .join("\n");

  // Footer text
  const footerCompanyName = "K SELECT NETWORK · Letusto Inc.";
  const footerUnsubscribe = isKorean
    ? "본 메일은 수신 동의 또는 공개된 비즈니스 파트너십 채널을 기반으로 발송되었습니다. 수신을 원치 않으시면 Contact@letusto.com으로 회신해 주시기 바랍니다."
    : "This email was sent based on business partnership inquiries or professional directory contact. If you no longer wish to receive updates, please reply to Contact@letusto.com.";

  // Full email markup
  const html = `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${safeTitle}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .fluid-img { width: 100% !important; max-width: 100% !important; height: auto !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f4f4f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  ${
    safePreheader
      ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #f4f4f5;">
          ${safePreheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
        </div>`
      : ""
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f5; margin: 0; padding: 0;">
    <tr>
      <td align="center" style="padding: 0 12px;">
        <!-- Email Canvas Table (Max 600px) -->
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          ${sectionRows}
        </table>

        <!-- Email Footer -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; margin-top: 20px;">
          <tr>
            <td align="center" style="padding: 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; line-height: 1.6; color: #71717a;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #52525b;">${footerCompanyName}</p>
              <p style="margin: 0 0 8px 0;">${footerUnsubscribe}</p>
              <p style="margin: 0; color: #a1a1aa;">© ${new Date().getFullYear()} K SELECT NETWORK. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Generate plain-text version
  const textLines: string[] = [];
  if (subject) textLines.push(`[${subject}]`);
  if (previewText) textLines.push(previewText);
  textLines.push("--------------------------------------------------");

  sections.forEach((sec, idx) => {
    if (sec.altText) textLines.push(sec.altText);
    if (sec.hasCtaButton && sec.ctaButtonLabel) {
      textLines.push(`\n▶ ${sec.ctaButtonLabel}: ${sec.ctaButtonUrl || sec.linkUrl || defaultLandingUrl}`);
    } else if (sec.linkUrl && sec.linkUrl !== defaultLandingUrl) {
      textLines.push(`링크: ${sec.linkUrl}`);
    }
  });

  textLines.push("\n--------------------------------------------------");
  textLines.push(footerCompanyName);
  textLines.push(`안내 및 웹사이트: ${defaultLandingUrl}`);
  textLines.push(footerUnsubscribe);

  const plainText = textLines.join("\n").trim();

  return {
    html,
    plainText,
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
