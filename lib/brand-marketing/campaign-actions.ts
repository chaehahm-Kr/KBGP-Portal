"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession, getAdminStaffContext } from "@/lib/auth/dal";
import {
  MarketingCampaign,
  MarketingTemplatePackage,
  DryRunReport,
} from "./campaign-types";
import {
  listMarketingTemplates,
  saveMarketingTemplate,
  listMarketingCampaigns,
  getMarketingCampaignById,
  saveMarketingCampaign,
  runCampaignDryRun,
  sendTestCampaignEmail,
  approveMarketingCampaign,
} from "./campaign-data-access";
import { validateAndSanitizeTemplate } from "./template-parser";

/**
 * Asserts admin session before accessing marketing campaign tools.
 */
async function requireCampaignAdmin() {
  const session = await verifyAdminSession();
  const staffCtx = await getAdminStaffContext();
  return { userId: session.userId, email: staffCtx?.email || "admin@kselectnetwork.com" };
}

/**
 * Lists available external template packages.
 */
export async function listMarketingTemplatesAction(): Promise<{
  success: boolean;
  templates?: MarketingTemplatePackage[];
  error?: string;
}> {
  try {
    await requireCampaignAdmin();
    const templates = await listMarketingTemplates();
    return { success: true, templates };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load templates" };
  }
}

/**
 * Uploads, sanitizes, and registers an external designer template package.
 */
export async function uploadMarketingTemplateAction(payload: {
  name: string;
  version?: string;
  language?: "ko" | "en";
  subject: string;
  previewText?: string;
  htmlContent: string;
  landingPageUrl?: string;
}): Promise<{
  success: boolean;
  template?: MarketingTemplatePackage;
  warnings?: string[];
  error?: string;
}> {
  try {
    const admin = await requireCampaignAdmin();

    // Sanitize and validate HTML
    const validation = validateAndSanitizeTemplate(
      payload.htmlContent,
      payload.subject,
      payload.landingPageUrl
    );

    if (!validation.isValid) {
      return {
        success: false,
        error: `Template validation failed: ${validation.errors.join("; ")}`,
      };
    }

    const saved = await saveMarketingTemplate(
      {
        name: payload.name.trim(),
        version: payload.version || "1.0.0",
        language: payload.language || "ko",
        subject: payload.subject.trim(),
        previewText: payload.previewText?.trim() || "",
        htmlContent: validation.sanitizedHtml,
        plainText: validation.plainText,
        variables: validation.detectedVariables,
        landingPageUrl: payload.landingPageUrl?.trim() || "https://www.kselectnetwork.com",
        status: "ACTIVE",
      },
      admin.userId
    );

    try { revalidatePath("/admin/brand-marketing"); } catch {}

    return {
      success: true,
      template: saved,
      warnings: validation.warnings,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to upload template" };
  }
}

/**
 * Lists marketing campaigns.
 */
export async function listMarketingCampaignsAction(): Promise<{
  success: boolean;
  campaigns?: MarketingCampaign[];
  error?: string;
}> {
  try {
    await requireCampaignAdmin();
    const campaigns = await listMarketingCampaigns();
    return { success: true, campaigns };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to list campaigns" };
  }
}

/**
 * Fetches campaign details by ID.
 */
export async function getMarketingCampaignByIdAction(id: string): Promise<{
  success: boolean;
  campaign?: MarketingCampaign | null;
  recipients?: any[];
  logs?: any[];
  error?: string;
}> {
  try {
    await requireCampaignAdmin();
    const result = await getMarketingCampaignById(id);
    return {
      success: true,
      campaign: result.campaign,
      recipients: result.recipients,
      logs: result.logs,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load campaign" };
  }
}

/**
 * Creates or updates a campaign draft.
 */
export async function saveMarketingCampaignAction(
  campaign: Partial<MarketingCampaign> & { name: string }
): Promise<{
  success: boolean;
  campaign?: MarketingCampaign;
  error?: string;
}> {
  try {
    const admin = await requireCampaignAdmin();
    const saved = await saveMarketingCampaign(campaign, admin.userId);
    try { revalidatePath("/admin/brand-marketing"); } catch {}
    return { success: true, campaign: saved };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save campaign" };
  }
}

/**
 * Duplicates an existing campaign.
 */
export async function duplicateMarketingCampaignAction(
  campaignId: string
): Promise<{ success: boolean; campaign?: MarketingCampaign; error?: string }> {
  try {
    const admin = await requireCampaignAdmin();
    const existing = await getMarketingCampaignById(campaignId);
    if (!existing.campaign) {
      return { success: false, error: "Source campaign not found" };
    }

    const copyData = {
      ...existing.campaign,
      id: undefined,
      name: `${existing.campaign.name} (Copy)`,
      status: "DRAFT" as const,
      approvalStatus: "PENDING" as const,
      approvedBy: null,
      approvedAt: null,
      approvalSnapshot: null,
      scheduledAt: null,
    };

    const duplicated = await saveMarketingCampaign(copyData, admin.userId);
    try { revalidatePath("/admin/brand-marketing"); } catch {}
    return { success: true, campaign: duplicated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to duplicate campaign" };
  }
}

/**
 * Archives a campaign.
 */
export async function archiveMarketingCampaignAction(
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireCampaignAdmin();
    const existing = await getMarketingCampaignById(campaignId);
    if (!existing.campaign) {
      return { success: false, error: "Campaign not found" };
    }

    await saveMarketingCampaign(
      {
        ...existing.campaign,
        status: "CANCELLED",
      },
      admin.userId
    );

    try { revalidatePath("/admin/brand-marketing"); } catch {}
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to archive campaign" };
  }
}

/**
 * Executes a simulated dry-run: freezes recipients, checks consent, deduplicates, and produces report.
 * Zero external emails are sent!
 */
export async function runCampaignDryRunAction(
  campaignId: string,
  criteria: MarketingCampaign["filterCriteria"]
): Promise<{
  success: boolean;
  report?: DryRunReport;
  error?: string;
}> {
  try {
    await requireCampaignAdmin();
    const report = await runCampaignDryRun(campaignId, criteria);
    try { revalidatePath("/admin/brand-marketing"); } catch {}
    return { success: true, report };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to execute dry run" };
  }
}

/**
 * Dispatches a controlled test email STRICTLY to an allowlisted internal test address.
 */
export async function sendTestCampaignEmailAction(
  campaignId: string,
  targetEmail: string,
  templateSubject: string,
  templateHtml: string,
  templatePlainText?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    await requireCampaignAdmin();
    const res = await sendTestCampaignEmail(
      campaignId,
      targetEmail,
      templateSubject,
      templateHtml,
      templatePlainText
    );
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Test dispatch failed" };
  }
}

/**
 * Approves a campaign and locks its immutable approval snapshot.
 */
export async function approveMarketingCampaignAction(
  campaignId: string
): Promise<{ success: boolean; campaign?: MarketingCampaign; error?: string }> {
  try {
    const admin = await requireCampaignAdmin();
    const approved = await approveMarketingCampaign(campaignId, admin.email);
    try { revalidatePath("/admin/brand-marketing"); } catch {}
    return { success: true, campaign: approved };
  } catch (err: any) {
    return { success: false, error: err.message || "Approval failed" };
  }
}
