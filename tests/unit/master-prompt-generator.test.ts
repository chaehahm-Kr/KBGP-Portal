/**
 * Brand Marketing Phase 2 — Universal Master AI Prompt & Brief Unit Tests
 * Task ID: ADM-EMAIL-TPL-002
 * Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 27
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_CAMPAIGN_BRIEF,
  CAMPAIGN_BRIEF_PRESETS,
  SUPPORTED_PERSONALIZATION_VARIABLES,
  PROPOSED_DELIVERY_PACKAGE_CONTRACT,
  validateCampaignBrief,
  generateUniversalMasterPrompt,
} from "../../lib/brand-marketing/master-prompt-generator";
import { CampaignBrief } from "../../lib/brand-marketing/master-prompt-types";

describe("ADM-EMAIL-TPL-002: Universal Master AI Prompt & Campaign Brief", () => {
  describe("1. Campaign Brief Validation (6 Primary Fields)", () => {
    it("should validate default campaign brief as completely valid", () => {
      const result = validateCampaignBrief(DEFAULT_CAMPAIGN_BRIEF);
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it("should fail validation if any of the 6 primary required fields are missing", () => {
      const emptyBrief: Partial<CampaignBrief> = {};
      const result = validateCampaignBrief(emptyBrief);

      expect(result.isValid).toBe(false);
      expect(result.errors.campaignObjective).toBeDefined();
      expect(result.errors.targetAudience).toBeDefined();
      expect(result.errors.coreMessage).toBeDefined();
      expect(result.errors.requiredContent).toBeDefined();
      expect(result.errors.designDirection).toBeDefined();
      expect(result.errors.primaryCtaText).toBeDefined();
      expect(Object.keys(result.errors)).toHaveLength(6);
    });

    it("should reject invalid CTA URL protocols (e.g. javascript:, ftp:)", () => {
      const briefWithBadUrl: CampaignBrief = {
        ...DEFAULT_CAMPAIGN_BRIEF,
        primaryCtaUrl: "javascript:alert(1)",
      };
      const result = validateCampaignBrief(briefWithBadUrl);
      expect(result.isValid).toBe(false);
      expect(result.errors.primaryCtaUrl).toContain("HTTP/HTTPS");
    });

    it("should reject malformed secondary CTA URLs", () => {
      const briefWithBadSecondaryUrl: CampaignBrief = {
        ...DEFAULT_CAMPAIGN_BRIEF,
        secondaryCtaUrl: "not-a-valid-url",
      };
      const result = validateCampaignBrief(briefWithBadSecondaryUrl);
      expect(result.isValid).toBe(false);
      expect(result.errors.secondaryCtaUrl).toBeDefined();
    });

    it("should accept valid HTTPS CTA URLs", () => {
      const briefWithValidUrl: CampaignBrief = {
        ...DEFAULT_CAMPAIGN_BRIEF,
        primaryCtaUrl: "https://www.kselectnetwork.com/apply",
        secondaryCtaUrl: "https://www.kselectnetwork.com/deck",
      };
      const result = validateCampaignBrief(briefWithValidUrl);
      expect(result.isValid).toBe(true);
      expect(result.errors.primaryCtaUrl).toBeUndefined();
      expect(result.errors.secondaryCtaUrl).toBeUndefined();
    });

    it("should emit optimization warnings when inputs are overly brief", () => {
      const briefWithShortText: CampaignBrief = {
        ...DEFAULT_CAMPAIGN_BRIEF,
        campaignObjective: "Short goal",
        coreMessage: "Short msg",
      };
      const result = validateCampaignBrief(briefWithShortText);
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("2. Recommended Campaign Brief Presets", () => {
    it("should contain exactly 3 production-grade presets", () => {
      expect(CAMPAIGN_BRIEF_PRESETS).toHaveLength(3);
      expect(CAMPAIGN_BRIEF_PRESETS.map((p) => p.id)).toEqual([
        "us-wholesale-retail",
        "amazon-hybrid-fba",
        "global-exhibitor-outreach",
      ]);
    });

    it("should have each preset's brief pass validation with 0 errors", () => {
      for (const preset of CAMPAIGN_BRIEF_PRESETS) {
        const result = validateCampaignBrief(preset.brief);
        expect(result.isValid).toBe(true);
        expect(Object.keys(result.errors)).toHaveLength(0);
        expect(preset.brief.primaryCtaText.trim().length).toBeGreaterThan(0);
        expect(preset.brief.primaryCtaUrl).toMatch(/^https:\/\//);
      }
    });
  });

  describe("3. Supported Personalization Variables (Strict Dispatch Invariant)", () => {
    it("should strictly define the 4 authoritative placeholders supported by the platform", () => {
      const names = SUPPORTED_PERSONALIZATION_VARIABLES.map((v) => v.name);
      expect(names).toEqual([
        "{{company_name}}",
        "{{contact_name}}",
        "{{brand_name}}",
        "{{custom_message}}",
      ]);
    });
  });

  describe("4. Universal Master AI Prompt Generation", () => {
    it("should generate a prompt containing all 6 primary business fields", () => {
      const prompt = generateUniversalMasterPrompt(DEFAULT_CAMPAIGN_BRIEF);

      expect(prompt).toContain(DEFAULT_CAMPAIGN_BRIEF.campaignObjective);
      expect(prompt).toContain(DEFAULT_CAMPAIGN_BRIEF.targetAudience);
      expect(prompt).toContain(DEFAULT_CAMPAIGN_BRIEF.coreMessage);
      expect(prompt).toContain(DEFAULT_CAMPAIGN_BRIEF.requiredContent);
      expect(prompt).toContain(DEFAULT_CAMPAIGN_BRIEF.designDirection);
      expect(prompt).toContain(DEFAULT_CAMPAIGN_BRIEF.primaryCtaText);
      expect(prompt).toContain(DEFAULT_CAMPAIGN_BRIEF.primaryCtaUrl!);
    });

    it("should enforce canonical 600px desktop table rules and MSO conditional comments", () => {
      const prompt = generateUniversalMasterPrompt(DEFAULT_CAMPAIGN_BRIEF);

      expect(prompt).toContain("Exactly 600px");
      expect(prompt).toContain("TABLE-BASED ARCHITECTURE");
      expect(prompt).toContain("<!--[if (gte mso 9)|(IE)]>");
      expect(prompt).toContain("<![endif]-->");
      expect(prompt).toContain("<table role=\"presentation\"");
    });

    it("should enforce strict inline CSS rules and WCAG 4.5:1 contrast", () => {
      const prompt = generateUniversalMasterPrompt(DEFAULT_CAMPAIGN_BRIEF);

      expect(prompt).toContain("INLINE via the 'style=\"\"' attribute");
      expect(prompt).toContain("4.5:1 (WCAG AA accessibility standard)");
      expect(prompt).toContain("Minimum body font size: 14px–16px");
    });

    it("should enforce Zero Scripts and Security hygiene", () => {
      const prompt = generateUniversalMasterPrompt(DEFAULT_CAMPAIGN_BRIEF);

      expect(prompt).toContain("ABSOLUTELY NO <script>, <iframe>");
      expect(prompt).toContain("NO inline JavaScript event handlers");
      expect(prompt).toContain("NO 'javascript:' pseudo-protocol links");
    });

    it("should explicitly forbid unsupported placeholders like {{first_name}}", () => {
      const prompt = generateUniversalMasterPrompt(DEFAULT_CAMPAIGN_BRIEF);

      expect(prompt).toContain("{{company_name}}");
      expect(prompt).toContain("{{contact_name}}");
      expect(prompt).toContain("{{brand_name}}");
      expect(prompt).toContain("{{custom_message}}");
      expect(prompt).toContain("Do NOT invent or use unsupported placeholders");
      expect(prompt).toContain("{{first_name}}");
    });

    it("should require platform footer placeholder <!-- K_SELECT_FOOTER_PLACEHOLDER --> and forbid duplicate footers", () => {
      const prompt = generateUniversalMasterPrompt(DEFAULT_CAMPAIGN_BRIEF);

      expect(prompt).toContain("FOOTER & COMPLIANCE SEPARATION");
      expect(prompt).toContain("<!-- K_SELECT_FOOTER_PLACEHOLDER -->");
      expect(prompt).toContain("Do NOT hardcode a second duplicate legal footer");
      expect(prompt).toContain("23B Roland Ave., Mount Laurel, NJ 08054");
    });

    it("should contain fallback markdown code blocks instructions for AI tools without ZIP capability", () => {
      const prompt = generateUniversalMasterPrompt(DEFAULT_CAMPAIGN_BRIEF);

      expect(prompt).toContain("IF YOU CANNOT GENERATE A ZIP FILE DIRECTLY");
      expect(prompt).toContain("```json:manifest.json");
      expect(prompt).toContain("```html:email.html");
      expect(prompt).toContain("```text:email.txt");
      expect(prompt).toContain("```json:links.json");
    });
  });

  describe("5. Proposed Delivery Package Contract", () => {
    it("should specify manifest.json, email.html, email.txt as required files", () => {
      const requiredFiles = PROPOSED_DELIVERY_PACKAGE_CONTRACT.files.filter((f) => f.required);
      expect(requiredFiles.map((f) => f.fileName)).toEqual([
        "manifest.json",
        "email.html",
        "email.txt",
      ]);
    });

    it("should provide valid manifest and links JSON examples", () => {
      expect(PROPOSED_DELIVERY_PACKAGE_CONTRACT.manifestSchemaExample.templateName).toBeDefined();
      expect(PROPOSED_DELIVERY_PACKAGE_CONTRACT.manifestSchemaExample.variables).toEqual([
        "company_name",
        "contact_name",
        "brand_name",
        "custom_message",
      ]);
      expect(PROPOSED_DELIVERY_PACKAGE_CONTRACT.linksJsonExample.primary_cta).toMatch(/^https:\/\//);
    });
  });
});
