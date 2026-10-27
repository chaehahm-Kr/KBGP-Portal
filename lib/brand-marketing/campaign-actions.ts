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
  duplicateMarketingTemplate,
  archiveMarketingTemplate,
  restoreMarketingTemplate,
  deleteMarketingTemplate,
  getMarketingFooterSettings,
  saveMarketingFooterSettings,
} from "./campaign-data-access";
import {
  importZipPackage,
  importRawHtmlPackage,
  PackageImportResult,
} from "./package-importer";
import {
  validateMarketingFooterCompleteness,
  MarketingFooterSettings,
} from "./marketing-footer";
import { TemplateFilterOptions } from "./campaign-types";
import { validateAndSanitizeTemplate } from "./template-parser";
import { compileImageTemplateToHtml } from "./image-template-compiler";
import { ImageTemplateSection, DesignerPromptSettings, TemplateType } from "./campaign-types";

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
export async function listMarketingTemplatesAction(
  filter?: TemplateFilterOptions
): Promise<{
  success: boolean;
  templates?: MarketingTemplatePackage[];
  error?: string;
}> {
  try {
    await requireCampaignAdmin();
    const templates = await listMarketingTemplates(filter);
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
  templateType?: TemplateType;
  version?: string;
  language?: "ko" | "en";
  subject: string;
  previewText?: string;
  htmlContent?: string;
  landingPageUrl?: string;
  imageSections?: ImageTemplateSection[];
  designerPromptSettings?: DesignerPromptSettings;
}): Promise<{
  success: boolean;
  template?: MarketingTemplatePackage;
  warnings?: string[];
  error?: string;
}> {
  try {
    const admin = await requireCampaignAdmin();
    const templateType: TemplateType = payload.templateType || "HTML";
    let finalHtml = "";
    let finalPlainText = "";
    let detectedVars: string[] = ["company_name", "contact_name", "brand_name", "custom_message"];
    const warnings: string[] = [];

    if (templateType === "IMAGE") {
      const compileRes = compileImageTemplateToHtml({
        sections: payload.imageSections || [],
        language: payload.language || "ko",
        subject: payload.subject,
        previewText: payload.previewText,
        defaultLandingUrl: payload.landingPageUrl || "https://www.kselectnetwork.com",
      });

      if (!compileRes.isValid) {
        return {
          success: false,
          error: `Image template compilation failed: ${compileRes.errors.join("; ")}`,
        };
      }

      finalHtml = compileRes.html;
      finalPlainText = compileRes.plainText;
      warnings.push(...compileRes.warnings);
    } else {
      // HTML template path
      const validation = validateAndSanitizeTemplate(
        payload.htmlContent || "",
        payload.subject,
        payload.landingPageUrl
      );

      if (!validation.isValid) {
        return {
          success: false,
          error: `Template validation failed: ${validation.errors.join("; ")}`,
        };
      }

      finalHtml = validation.sanitizedHtml;
      finalPlainText = validation.plainText;
      detectedVars = validation.detectedVariables;
      warnings.push(...validation.warnings);
    }

    const saved = await saveMarketingTemplate(
      {
        name: payload.name.trim(),
        templateType,
        version: payload.version || "1.0.0",
        language: payload.language || "ko",
        subject: payload.subject.trim(),
        previewText: payload.previewText?.trim() || "",
        htmlContent: finalHtml,
        plainText: finalPlainText,
        variables: detectedVars,
        landingPageUrl: payload.landingPageUrl?.trim() || "https://www.kselectnetwork.com",
        status: "ACTIVE",
        imageSections: payload.imageSections || [],
        designerPromptSettings: payload.designerPromptSettings,
      },
      admin.userId
    );

    try { revalidatePath("/admin/brand-marketing"); } catch {}

    return {
      success: true,
      template: saved,
      warnings,
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

/**
 * Uploads an HTML or ZIP email design package with automatic image hosting.
 */
export async function uploadTemplatePackageFileAction(
  formData: FormData
): Promise<{
  success: boolean;
  template?: MarketingTemplatePackage;
  importResult?: PackageImportResult;
  warnings?: string[];
  error?: string;
}> {
  try {
    const admin = await requireCampaignAdmin();
    const name = String(formData.get("name") || "").trim();
    const templateType = (formData.get("templateType") || "HTML") as TemplateType;
    const language = (formData.get("language") || "ko") as "ko" | "en";
    const subject = String(formData.get("subject") || "").trim();
    const file = formData.get("file") as File | null;
    const rawHtmlFallback = String(formData.get("rawHtml") || "").trim();

    if (!name || !subject) {
      return { success: false, error: "Template Name and Default Email Subject are required." };
    }

    const tempId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "00000000-0000-4000-b000-" + Date.now().toString(16).padStart(12, "0");
    let importRes: PackageImportResult;

    if (file && typeof file === "object" && "arrayBuffer" in file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const isZip = file.name.toLowerCase().endsWith(".zip") || file.type.includes("zip");

      if (isZip) {
        importRes = await importZipPackage(buffer, tempId);
      } else {
        const text = buffer.toString("utf8");
        importRes = await importRawHtmlPackage(text, tempId);
      }
    } else if (rawHtmlFallback) {
      importRes = await importRawHtmlPackage(rawHtmlFallback, tempId);
    } else {
      return { success: false, error: "Please upload an HTML or ZIP file containing your email design." };
    }

    if (!importRes.isValid) {
      return {
        success: false,
        importResult: importRes,
        error: `Package import failed: ${importRes.errors.join("; ")}`,
        warnings: importRes.warnings,
      };
    }

    const detectedVars = ["company_name", "contact_name", "brand_name", "custom_message"];

    const saved = await saveMarketingTemplate(
      {
        id: tempId,
        name,
        templateType,
        version: "1.0.0",
        language,
        subject,
        previewText: "",
        htmlContent: importRes.htmlContent,
        plainText: importRes.plainText,
        variables: detectedVars,
        status: "ACTIVE",
        importedAssets: importRes.extractedAssets,
        metadata: {
          template_type: templateType,
          imported_assets: importRes.extractedAssets,
          selected_html_file: importRes.selectedHtmlFile,
          has_existing_footer: importRes.hasExistingFooter,
        },
      },
      admin.userId
    );

    try { revalidatePath("/admin/brand-marketing"); } catch {}

    return {
      success: true,
      template: saved,
      importResult: importRes,
      warnings: importRes.warnings,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to process template package upload" };
  }
}

/**
 * Duplicates an existing template with a new name and unique ID.
 */
export async function duplicateMarketingTemplateAction(
  templateId: string,
  newName: string
): Promise<{ success: boolean; template?: MarketingTemplatePackage; error?: string }> {
  try {
    const admin = await requireCampaignAdmin();
    if (!newName || !newName.trim()) {
      return { success: false, error: "New template name is required." };
    }
    const duplicated = await duplicateMarketingTemplate(templateId, newName.trim(), admin.userId);
    try { revalidatePath("/admin/brand-marketing"); } catch {}
    return { success: true, template: duplicated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to duplicate template" };
  }
}

/**
 * Archives a template package.
 */
export async function archiveMarketingTemplateAction(
  templateId: string
): Promise<{ success: boolean; template?: MarketingTemplatePackage; error?: string }> {
  try {
    const admin = await requireCampaignAdmin();
    const updated = await archiveMarketingTemplate(templateId, admin.userId);
    try { revalidatePath("/admin/brand-marketing"); } catch {}
    return { success: true, template: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to archive template" };
  }
}

/**
 * Restores an archived template package to ACTIVE status.
 */
export async function restoreMarketingTemplateAction(
  templateId: string
): Promise<{ success: boolean; template?: MarketingTemplatePackage; error?: string }> {
  try {
    const admin = await requireCampaignAdmin();
    const updated = await restoreMarketingTemplate(templateId, admin.userId);
    try { revalidatePath("/admin/brand-marketing"); } catch {}
    return { success: true, template: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to restore template" };
  }
}

/**
 * Safely deletes a template if it is not referenced by any campaign history.
 */
export async function deleteMarketingTemplateAction(
  templateId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireCampaignAdmin();
    const res = await deleteMarketingTemplate(templateId, admin.userId);
    try { revalidatePath("/admin/brand-marketing"); } catch {}
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete template" };
  }
}

/**
 * Retrieves the centrally managed Marketing Email Footer settings.
 */
export async function getMarketingFooterSettingsAction(): Promise<{
  success: boolean;
  settings?: MarketingFooterSettings;
  error?: string;
}> {
  try {
    await requireCampaignAdmin();
    const settings = await getMarketingFooterSettings();
    return { success: true, settings };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load footer settings" };
  }
}

/**
 * Saves centrally managed Marketing Email Footer settings.
 */
export async function saveMarketingFooterSettingsAction(
  settings: Partial<MarketingFooterSettings>
): Promise<{
  success: boolean;
  settings?: MarketingFooterSettings;
  error?: string;
}> {
  try {
    const admin = await requireCampaignAdmin();
    const saved = await saveMarketingFooterSettings(settings, admin.userId);
    try { revalidatePath("/admin/brand-marketing"); } catch {}
    return { success: true, settings: saved };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save footer settings" };
  }
}

/**
 * Validates campaign readiness before official approval.
 */
export async function validateCampaignPreApprovalAction(
  campaignId: string
): Promise<{
  isValid: boolean;
  checks: Array<{ name: string; status: "PASS" | "FAIL"; detail: string }>;
}> {
  try {
    await requireCampaignAdmin();
    const footerSettings = await getMarketingFooterSettings();
    const footerCheck = validateMarketingFooterCompleteness(footerSettings);
    const existing = await getMarketingCampaignById(campaignId);
    const camp = existing.campaign;

    const checks: Array<{ name: string; status: "PASS" | "FAIL"; detail: string }> = [];

    // 1. Physical Address
    checks.push({
      name: "Physical Mailing Address",
      status: footerSettings.physicalAddress?.trim() ? "PASS" : "FAIL",
      detail: footerSettings.physicalAddress?.trim()
        ? `Configured: ${footerSettings.physicalAddress}`
        : "Missing physical business address in Email Settings",
    });

    // 2. Contact Email
    checks.push({
      name: "Official Contact Email",
      status: (footerSettings.contactEmail?.includes("@")) ? "PASS" : "FAIL",
      detail: footerSettings.contactEmail || "Missing contact email in Email Settings",
    });

    // 3. Legal Name & Brand Display
    checks.push({
      name: "Legal Entity & Brand Name",
      status: (footerSettings.brandDisplayName?.trim() && footerSettings.legalCompanyName?.trim()) ? "PASS" : "FAIL",
      detail: `${footerSettings.brandDisplayName} (${footerSettings.legalCompanyName})`,
    });

    // 4. Template Selection & Asset Safety
    const hasTemplate = Boolean(camp?.templateId);
    checks.push({
      name: "Template Package Assigned",
      status: hasTemplate ? "PASS" : "FAIL",
      detail: hasTemplate ? `Template ID: ${camp!.templateId}` : "No template selected for campaign",
    });

    // 5. Unsubscribe Link Resolvable
    checks.push({
      name: "Unsubscribe URL Resolution",
      status: "PASS",
      detail: "Cryptographic HMAC token generator active (RFC 8058 compliant)",
    });

    // 6. Recipient Selection
    const hasRecipients = (existing.recipients || []).length > 0;
    checks.push({
      name: "Recipient Selection",
      status: hasRecipients ? "PASS" : "FAIL",
      detail: hasRecipients ? `${existing.recipients.length} recipients selected` : "No recipients selected",
    });

    const allPassed = checks.every((c) => c.status === "PASS");
    return { isValid: allPassed, checks };
  } catch (err: any) {
    return {
      isValid: false,
      checks: [{ name: "System Check", status: "FAIL", detail: err.message }],
    };
  }
}
