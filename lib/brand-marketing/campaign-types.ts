/**
 * Brand Marketing Phase 2 — Email Campaigns V1 Types
 * Task ID: ADM-BSRC-006 / ADM-EMAIL-FTR-001
 * Standards: DEPLOY-STD-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 27
 */

import type { MarketingFooterStyle } from "./marketing-footer";

export type CampaignStatus =
  | "DRAFT"
  | "TESTING"
  | "READY_FOR_APPROVAL"
  | "APPROVED"
  | "SIMULATED"
  | "SCHEDULED"
  | "SENDING"
  | "SENT"
  | "PAUSED"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
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
  companyTypeMatchMode?: "ANY" | "ALL";
  categories?: string[];
  primaryCategories?: string[];
  status?: string;
  marketingConsentStatus?: string;
  companyIds?: string[];
  contactIds?: string[];
  manualEmails?: string[];
  requireConsentedOnly?: boolean;
  searchQuery?: string;
  footerStyle?: MarketingFooterStyle;
}

export interface MarketingCampaignRecipientItem {
  id: string;
  campaignId: string;
  companyId?: string | null;
  contactId?: string | null;
  recipientEmail: string;
  recipientName?: string | null;
  companyNameKr?: string;
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

export interface CampaignSimulationStats {
  lastSimulatedAt?: string;
  simulatedCount: number;
  simulatedEligible: number;
  simulatedSuppressed: number;
  simulatedFailed: number;
  simulatedBy?: string;
}

export interface CampaignUnlockAudit {
  unlockedAt: string;
  unlockedBy: string;
  reason: string;
  eligibleUnsentCount: number;
}

export interface CampaignStats {
  totalRecipients: number;
  sendableCount: number;
  excludedCount: number;
  testSendsCount: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  simulationStats?: CampaignSimulationStats;
  unlockHistory?: CampaignUnlockAudit[];
  isSendLocked?: boolean;
  isLiveModeEnabled?: boolean;
  liveActivatedAt?: string;
  liveActivatedBy?: string;
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
  footerStyle?: MarketingFooterStyle;
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
  footerStyle?: MarketingFooterStyle;
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


export interface CampaignDeliveryExecutionResult {
  success: boolean;
  campaignId: string;
  status: CampaignStatus;
  totalEvaluated: number;
  totalSent: number;
  totalDelivered: number;
  totalBlockedSuppressed: number;
  totalFailed: number;
  isSimulated: boolean;
  simulatedCount?: number;
  simulatedEligible?: number;
  message?: string;
  error?: string;
}

export interface ScheduleCampaignInput {
  campaignId: string;
  scheduledAt: string;
}

export interface UnlockCampaignSendInput {
  reason: string;
}

export interface UnlockCampaignSendResult {
  success: boolean;
  campaignId: string;
  unlockedBy: string;
  unlockedAt: string;
  reason: string;
  unsentCount: number;
  error?: string;
}

export interface ActivateCampaignLiveModeInput {
  confirmationPhrase: string;
  reason?: string;
}

export interface ActivateCampaignLiveModeResult {
  success: boolean;
  campaignId: string;
  isLiveModeEnabled: boolean;
  eligibleRecipients: number;
  activatedBy: string;
  activatedAt: string;
  error?: string;
}
