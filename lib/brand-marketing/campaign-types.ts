/**
 * Brand Marketing Phase 2 — Email Campaigns V1 Types
 * Task ID: ADM-BSRC-006
 * Standards: DEPLOY-STD-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 27
 */

export type CampaignStatus =
  | "DRAFT"
  | "TESTING"
  | "READY_FOR_APPROVAL"
  | "APPROVED"
  | "SCHEDULED"
  | "SENDING"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED";

export type CampaignApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "INVALIDATED";

export type TemplateStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type CampaignLanguage = "ko" | "en";

export type SendEligibility =
  | "ELIGIBLE"
  | "EXCLUDED_UNCONFIRMED_CONSENT"
  | "EXCLUDED_OPTED_OUT"
  | "EXCLUDED_SUPPRESSED"
  | "EXCLUDED_INVALID_EMAIL"
  | "EXCLUDED_DUPLICATE";

export type RecipientDeliveryStatus =
  | "PENDING"
  | "TEST_SENT"
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  | "BOUNCED";

export type TemplateType = "IMAGE" | "HTML";

export interface ImageTemplateSection {
  id: string;
  imageUrl: string;
  altText?: string;
  linkUrl?: string;
  hasCtaButton?: boolean;
  ctaButtonLabel?: string;
  ctaButtonUrl?: string;
  ctaButtonAlign?: "center" | "left" | "right";
}

export interface DesignerPromptSettings {
  imagePrompt?: string;
  htmlPrompt?: string;
  lastUpdated?: string;
}

export interface MarketingTemplatePackage {
  id: string;
  name: string;
  templateType?: TemplateType;
  version: string;
  language: CampaignLanguage;
  subject: string;
  previewText?: string;
  htmlContent: string;
  plainText?: string;
  variables: string[];
  landingPageUrl?: string;
  status: TemplateStatus;
  isDefault?: boolean;
  imageSections?: ImageTemplateSection[];
  designerPromptSettings?: DesignerPromptSettings;
  importedAssets?: Array<{
    originalPath: string;
    hostedUrl: string;
    byteSize: number;
    contentType: string;
  }>;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateFilterOptions {
  searchQuery?: string;
  templateType?: "ALL" | "HTML" | "IMAGE";
  language?: "ALL" | "ko" | "en";
  status?: "ALL" | "ACTIVE" | "ARCHIVED";
  sortBy?: "recent" | "name";
}

export interface RecipientSelectionCriteria {
  grades?: Array<"A" | "B" | "C" | "UNRATED">;
  companyTypes?: string[];
  categories?: string[];
  companyIds?: string[];
  contactIds?: string[];
  requireConsentedOnly?: boolean;
  searchQuery?: string;
}

export interface MarketingCampaignRecipientItem {
  id: string;
  campaignId: string;
  companyId: string;
  contactId?: string | null;
  recipientEmail: string;
  recipientName?: string | null;
  companyNameKr: string;
  companyNameEn?: string | null;
  brandName?: string | null;
  customMessageOverride?: string | null;
  sendEligibility: SendEligibility;
  exclusionReason?: string | null;
  status: RecipientDeliveryStatus;
  providerMessageId?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  errorMessage?: string | null;
}

export interface CampaignStats {
  totalRecipients: number;
  sendableCount: number;
  excludedCount: number;
  testSendsCount: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
}

export interface CampaignApprovalSnapshot {
  approvedAt: string;
  approvedBy: string;
  templateVersion: string;
  templateSubject: string;
  subjectOverride?: string | null;
  resolvedSubject?: string;
  frozenRecipientsCount: number;
  sendableCount: number;
  dryRunReportId?: string;
  senderAddress: string;
  footerVersion?: string | null;
  footerSettingsSnapshot?: Record<string, any> | null;
  hash: string;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  purpose: string;
  description?: string | null;
  language: CampaignLanguage;
  templateId?: string | null;
  templateVersion?: string | null;
  subjectOverride?: string | null;
  previewText?: string | null;
  landingPageUrl?: string | null;
  status: CampaignStatus;
  approvalStatus: CampaignApprovalStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvalSnapshot?: CampaignApprovalSnapshot | null;
  scheduledAt?: string | null;
  isLiveModeEnabled: boolean;
  filterCriteria: RecipientSelectionCriteria;
  customMessage?: string | null;
  stats: CampaignStats;
  createdAt: string;
  updatedAt: string;
}

export interface SampleRecipientPreview {
  recipientEmail: string;
  companyName: string;
  contactName: string;
  brandName: string;
  resolvedSubject: string;
  resolvedHtml: string;
  warnings: string[];
}

export interface DryRunReport {
  timestamp: string;
  campaignId: string;
  totalCandidatesEvaluated: number;
  sendableCount: number;
  excludedCount: number;
  duplicateEmailsFiltered: number;
  unconfirmedConsentFiltered: number;
  suppressedFiltered: number;
  invalidEmailFiltered: number;
  samplePreviews: SampleRecipientPreview[];
  warnings: string[];
  senderIdentity: string;
  isCompliant: boolean;
}

export interface CampaignAuditLogItem {
  id: string;
  campaignId: string;
  recipientId?: string | null;
  eventType: string;
  isTestMode: boolean;
  details: Record<string, any>;
  performedBy?: string | null;
  createdAt: string;
}
