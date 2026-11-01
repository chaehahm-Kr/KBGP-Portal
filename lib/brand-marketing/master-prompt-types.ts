/**
 * Brand Marketing Phase 2 — Universal Master AI Prompt & Campaign Brief Types
 * Task ID: ADM-EMAIL-TPL-002
 * Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, AGENTS.md Rule 27
 */

export type CampaignLanguage = "ko" | "en" | "bilingual";
export type DesignFormat = "responsive-html" | "image-led-html";

export interface CampaignBrief {
  // Six Primary Business Inputs
  campaignObjective: string;
  targetAudience: string;
  coreMessage: string;
  requiredContent: string;
  designDirection: string;
  primaryCtaText: string;
  primaryCtaUrl?: string;

  // Optional Business & Creative Inputs
  campaignTitle?: string;
  preferredLanguage: CampaignLanguage;
  designFormat: DesignFormat;
  brandLogoDescription?: string;
  brandColors?: string;
  supportingDocuments?: string;
  referenceLinks?: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  additionalInstructions?: string;
}

export interface BriefValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: string[];
}

export interface ExamplePreset {
  id: string;
  title: string;
  description: string;
  brief: CampaignBrief;
}

export interface DeliveryPackageFileSpec {
  fileName: string;
  description: string;
  required: boolean;
  formatDetails: string;
}

export interface DeliveryPackageContract {
  packageName: string;
  proposedStandardVersion: string;
  files: DeliveryPackageFileSpec[];
  manifestSchemaExample: Record<string, any>;
  linksJsonExample: Record<string, any>;
}
