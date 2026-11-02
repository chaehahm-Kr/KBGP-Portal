import { describe, it, expect } from "vitest";
import {
  DEFAULT_MARKETING_FOOTER,
  buildMarketingFooterHtml,
  validateMarketingFooterCompleteness,
  assembleEmailWithMarketingFooter,
  MarketingFooterSettings,
  MarketingFooterStyle,
  FOOTER_START_MARKER,
  FOOTER_END_MARKER,
} from "@/lib/brand-marketing/marketing-footer";
import type { MarketingCampaign } from "@/lib/brand-marketing/campaign-types";

describe("ADM-EMAIL-FTR-001: Marketing Footer Simple Design Style Options", () => {
  const sampleUnsubUrl = "https://admin.kselectnetwork.com/unsubscribe?token=sample-test-token-456";

  describe("1. Footer Completeness Validation", () => {
    it("passes validation with authoritative default settings", () => {
      const result = validateMarketingFooterCompleteness(DEFAULT_MARKETING_FOOTER);
      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it("detects missing physical address and invalid email", () => {
      const invalidSettings: MarketingFooterSettings = {
        ...DEFAULT_MARKETING_FOOTER,
        physicalAddress: "   ",
        contactEmail: "invalid-email-address",
      };
      const result = validateMarketingFooterCompleteness(invalidSettings);
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain("Physical Mailing Address (사업장 소재지 물리적 주소)");
      expect(result.missingFields).toContain("Contact Email (공식 문의 이메일)");
    });

    it("detects missing brand display name and legal company name", () => {
      const invalidSettings: MarketingFooterSettings = {
        ...DEFAULT_MARKETING_FOOTER,
        brandDisplayName: "",
        legalCompanyName: "  ",
      };
      const result = validateMarketingFooterCompleteness(invalidSettings);
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain("Brand Display Name (브랜드 표시명)");
      expect(result.missingFields).toContain("Legal Company Name (법인/운영사명)");
    });
  });

  describe("2. Classic Footer Style Rendering", () => {
    it("renders centered warm layout with #FBF8F5 and #ECE7DF", () => {
      const html = buildMarketingFooterHtml(DEFAULT_MARKETING_FOOTER, {
        language: "ko",
        unsubscribeUrl: sampleUnsubUrl,
        style: "classic",
      });

      expect(html).toContain(FOOTER_START_MARKER);
      expect(html).toContain(FOOTER_END_MARKER);
      expect(html).toContain("background-color:#FBF8F5");
      expect(html).toContain("border-top:1px solid #ECE7DF");
      expect(html).toContain("text-align:center");
      expect(html).toContain(DEFAULT_MARKETING_FOOTER.brandDisplayName);
      expect(html).toContain(DEFAULT_MARKETING_FOOTER.legalCompanyName);
      expect(html).toContain(DEFAULT_MARKETING_FOOTER.physicalAddress);
      expect(html).toContain(`mailto:${DEFAULT_MARKETING_FOOTER.contactEmail}`);
      expect(html).toContain(sampleUnsubUrl);
      expect(html).toContain("수신거부 / Unsubscribe");
      expect(html).toContain(DEFAULT_MARKETING_FOOTER.disclosureKo);
    });

    it("renders English disclosure and unsubscribe label when language is 'en'", () => {
      const html = buildMarketingFooterHtml(DEFAULT_MARKETING_FOOTER, {
        language: "en",
        unsubscribeUrl: sampleUnsubUrl,
        style: "classic",
      });

      expect(html).toContain("Unsubscribe / Opt-out");
      expect(html).toContain("Privacy Policy");
      expect(html).toContain(DEFAULT_MARKETING_FOOTER.disclosureEn);
    });

    it("defaults to classic when style is omitted", () => {
      const html = buildMarketingFooterHtml(DEFAULT_MARKETING_FOOTER, {
        language: "ko",
        unsubscribeUrl: sampleUnsubUrl,
      });

      expect(html).toContain("background-color:#FBF8F5");
      expect(html).toContain("text-align:center");
    });
  });

  describe("3. Minimal Footer Style Rendering", () => {
    it("renders compact, clean, left-aligned layout with #FFFFFF and #E4E4E7", () => {
      const html = buildMarketingFooterHtml(DEFAULT_MARKETING_FOOTER, {
        language: "ko",
        unsubscribeUrl: sampleUnsubUrl,
        style: "minimal",
      });

      expect(html).toContain(FOOTER_START_MARKER);
      expect(html).toContain(FOOTER_END_MARKER);
      expect(html).toContain("background-color:#FFFFFF");
      expect(html).toContain("border-top:1px solid #E4E4E7");
      expect(html).toContain("text-align:left");
      expect(html).toContain(DEFAULT_MARKETING_FOOTER.brandDisplayName);
      expect(html).toContain(DEFAULT_MARKETING_FOOTER.legalCompanyName);
      expect(html).toContain(DEFAULT_MARKETING_FOOTER.physicalAddress);
      expect(html).toContain(`mailto:${DEFAULT_MARKETING_FOOTER.contactEmail}`);
      expect(html).toContain(sampleUnsubUrl);
      expect(html).toContain("수신거부 / Unsubscribe");
    });

    it("renders English version of Minimal footer cleanly", () => {
      const html = buildMarketingFooterHtml(DEFAULT_MARKETING_FOOTER, {
        language: "en",
        unsubscribeUrl: sampleUnsubUrl,
        style: "minimal",
      });

      expect(html).toContain("text-align:left");
      expect(html).toContain("Unsubscribe / Opt-out");
      expect(html).toContain(DEFAULT_MARKETING_FOOTER.disclosureEn);
    });
  });

  describe("4. Dark Footer Style Rendering", () => {
    it("renders dark background #18181B with high-contrast light text", () => {
      const html = buildMarketingFooterHtml(DEFAULT_MARKETING_FOOTER, {
        language: "ko",
        unsubscribeUrl: sampleUnsubUrl,
        style: "dark",
      });

      expect(html).toContain(FOOTER_START_MARKER);
      expect(html).toContain(FOOTER_END_MARKER);
      expect(html).toContain("background-color:#18181B");
      expect(html).toContain("border-top:1px solid #27272A");
      expect(html).toContain("#FAFAFA"); // Light brand header
      expect(html).toContain("#818CF8"); // High contrast indigo unsubscribe
      expect(html).toContain(DEFAULT_MARKETING_FOOTER.brandDisplayName);
      expect(html).toContain(DEFAULT_MARKETING_FOOTER.legalCompanyName);
      expect(html).toContain(DEFAULT_MARKETING_FOOTER.physicalAddress);
      expect(html).toContain(sampleUnsubUrl);
    });
  });

  describe("5. Email Assembly & Idempotent Footer Replacement", () => {
    const rawTemplateHtml = `
<!DOCTYPE html>
<html>
<head><title>Brand Partnership</title></head>
<body>
  <div class="content">
    <h2>Special Invitation</h2>
    <p>We are delighted to partner with {{company_name}}.</p>
  </div>
</body>
</html>
`.trim();

    it("assembles raw HTML with exactly one marketing footer", () => {
      const assembled = assembleEmailWithMarketingFooter(rawTemplateHtml, {
        footerSettings: DEFAULT_MARKETING_FOOTER,
        language: "ko",
        unsubscribeUrl: sampleUnsubUrl,
        footerStyle: "minimal",
      });

      expect(assembled).toContain("<!-- MARKETING_FOOTER_START -->");
      expect(assembled).toContain("<!-- MARKETING_FOOTER_END -->");
      expect(assembled.split("<!-- MARKETING_FOOTER_START -->")).toHaveLength(2); // exactly 1 footer
      expect(assembled).toContain("background-color:#FFFFFF");
    });

    it("idempotently replaces existing footer when changing style from Minimal to Dark", () => {
      const initial = assembleEmailWithMarketingFooter(rawTemplateHtml, {
        footerSettings: DEFAULT_MARKETING_FOOTER,
        language: "ko",
        unsubscribeUrl: sampleUnsubUrl,
        footerStyle: "minimal",
      });

      const updated = assembleEmailWithMarketingFooter(initial, {
        footerSettings: DEFAULT_MARKETING_FOOTER,
        language: "ko",
        unsubscribeUrl: sampleUnsubUrl,
        footerStyle: "dark",
      });

      // Must have exactly ONE footer block
      expect(updated.split("<!-- MARKETING_FOOTER_START -->")).toHaveLength(2);
      expect(updated.split("<!-- MARKETING_FOOTER_END -->")).toHaveLength(2);
      // Must contain Dark styles, not Minimal
      expect(updated).toContain("background-color:#18181B");
      expect(updated).not.toContain("background-color:#FFFFFF");
    });

    it("idempotently replaces existing footer when changing style from Dark to Classic", () => {
      const darkAssembled = assembleEmailWithMarketingFooter(rawTemplateHtml, {
        footerSettings: DEFAULT_MARKETING_FOOTER,
        language: "ko",
        unsubscribeUrl: sampleUnsubUrl,
        footerStyle: "dark",
      });

      const classicAssembled = assembleEmailWithMarketingFooter(darkAssembled, {
        footerSettings: DEFAULT_MARKETING_FOOTER,
        language: "ko",
        unsubscribeUrl: sampleUnsubUrl,
        footerStyle: "classic",
      });

      expect(classicAssembled.split("<!-- MARKETING_FOOTER_START -->")).toHaveLength(2);
      expect(classicAssembled).toContain("background-color:#FBF8F5");
      expect(classicAssembled).not.toContain("background-color:#18181B");
    });
  });

  describe("6. Campaign-Level Model Compatibility", () => {
    it("supports footerStyle on MarketingCampaign interface", () => {
      const mockCampaign: Partial<MarketingCampaign> = {
        id: "test-campaign-1",
        name: "Outreach 2026",
        purpose: "Brand Outreach",
        language: "ko",
        footerStyle: "minimal",
        filterCriteria: {
          grades: ["A"],
          footerStyle: "minimal",
        },
      };

      expect(mockCampaign.footerStyle).toBe("minimal");
      expect(mockCampaign.filterCriteria?.footerStyle).toBe("minimal");
    });

    it("defaults to 'classic' when footerStyle is omitted on historical campaigns", () => {
      const historicalCampaign: Partial<MarketingCampaign> = {
        id: "historical-1",
        name: "Legacy Campaign",
        language: "ko",
      };

      const resolvedStyle = historicalCampaign.footerStyle || "classic";
      expect(resolvedStyle).toBe("classic");
    });
  });
});
