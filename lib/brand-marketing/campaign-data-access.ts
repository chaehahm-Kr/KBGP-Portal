import "server-only";
import { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  MarketingCampaign,
  MarketingTemplatePackage,
  MarketingCampaignRecipientItem,
  CampaignAuditLogItem,
  DryRunReport,
  CampaignApprovalSnapshot,
  SampleRecipientPreview,
  TemplateFilterOptions,
} from "./campaign-types";
import {
  MarketingFooterSettings,
  DEFAULT_MARKETING_FOOTER,
  assembleEmailWithMarketingFooter,
  validateMarketingFooterCompleteness,
} from "./marketing-footer";
import {
  buildUnsubscribeUrl,
  isEmailSuppressed,
  buildOneClickUnsubscribeEndpoint,
} from "./unsubscribe";
import { DEFAULT_MARKETING_TEMPLATES, resolveTemplateId } from "./default-templates";
import { compileImageTemplateToHtml } from "./image-template-compiler";
import { personalizeEmail } from "./personalization-engine";
import { sendEmail, maskEmailAddress } from "@/lib/notifications/email";
import {
  getMarketingTestAllowlist,
  isTestRecipientAllowlisted,
} from "./test-allowlist";

// In-memory fallback stores for local resilience or when DB migration is pending Owner execution
const memoryTemplates = new Map<string, MarketingTemplatePackage>(
  DEFAULT_MARKETING_TEMPLATES.map((t) => [t.id, { ...t }])
);
const memoryCampaigns = new Map<string, MarketingCampaign>();
const memoryRecipients = new Map<string, MarketingCampaignRecipientItem[]>();
const memoryLogs = new Map<string, CampaignAuditLogItem[]>();
const memorySuppression = new Set<string>();

async function getClient(customClient?: SupabaseClient): Promise<SupabaseClient> {
  if (customClient) return customClient;
  return await createClient();
}

/**
 * -----------------------------------------------------------------------------
 * 1. TEMPLATE LIBRARY DATA ACCESS
 * -----------------------------------------------------------------------------
 */
export async function listMarketingTemplates(
  filterOrClient?: TemplateFilterOptions | SupabaseClient,
  customClient?: SupabaseClient
): Promise<MarketingTemplatePackage[]> {
  const filter: TemplateFilterOptions =
    filterOrClient && !("from" in (filterOrClient as any))
      ? (filterOrClient as TemplateFilterOptions)
      : {};
  const client =
    filterOrClient && "from" in (filterOrClient as any)
      ? (filterOrClient as SupabaseClient)
      : customClient;

  let list: MarketingTemplatePackage[] = [];

  try {
    const supabase = await getClient(client);
    const { data, error } = await supabase
      .from("marketing_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      list = data.map((d: any) => ({
        id: d.id,
        name: d.name,
        templateType: (d.template_type || d.metadata?.template_type || "HTML") as any,
        version: d.version,
        language: d.language,
        subject: d.subject,
        previewText: d.preview_text,
        htmlContent: d.html_content,
        plainText: d.plain_text,
        variables: d.variables || [],
        landingPageUrl: d.landing_page_url,
        status: d.status,
        isDefault: d.is_default,
        imageSections: d.metadata?.image_sections || [],
        importedAssets: d.metadata?.imported_assets || [],
        designerPromptSettings: d.metadata?.designer_prompt_settings,
        metadata: d.metadata,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));
    }
  } catch (err) {
    console.warn("[campaigns:templates] DB read failed, falling back to memory store:", err);
  }

  if (list.length === 0) {
    list = Array.from(memoryTemplates.values());
  }

  // Apply filters
  let filtered = list;

  if (filter.status === "ACTIVE") {
    filtered = filtered.filter((t) => t.status === "ACTIVE" || (!t.status && !t.isDefault));
  } else if (filter.status === "ARCHIVED") {
    filtered = filtered.filter((t) => t.status === "ARCHIVED");
  } else if (!filter.status) {
    filtered = filtered.filter((t) => t.status !== "ARCHIVED");
  }

  if (filter.templateType && filter.templateType !== "ALL") {
    filtered = filtered.filter((t) => t.templateType === filter.templateType);
  }

  if (filter.language && filter.language !== "ALL") {
    filtered = filtered.filter((t) => t.language === filter.language);
  }

  if (filter.searchQuery && filter.searchQuery.trim().length > 0) {
    const q = filter.searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.subject && t.subject.toLowerCase().includes(q))
    );
  }

  if (filter.sortBy === "name") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  return filtered;
}

export async function duplicateMarketingTemplate(
  sourceTemplateId: string,
  newName?: string,
  userId?: string,
  customClient?: SupabaseClient
): Promise<MarketingTemplatePackage> {
  const templates = await listMarketingTemplates({ status: "ALL" }, customClient);
  const source = templates.find((t) => t.id === sourceTemplateId) || memoryTemplates.get(sourceTemplateId);
  if (!source) {
    throw new Error(`Source template '${sourceTemplateId}' not found.`);
  }

  const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "00000000-0000-4000-b000-" + Date.now().toString(16).padStart(12, "0");
  const resolvedName = newName && newName.trim().length > 0 ? newName.trim() : `${source.name} (Copy)`;

  const cloned: MarketingTemplatePackage = {
    ...source,
    id: newId,
    name: resolvedName,
    status: "ACTIVE",
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return await saveMarketingTemplate(cloned, userId, customClient);
}

export async function archiveMarketingTemplate(
  templateId: string,
  userId?: string,
  customClient?: SupabaseClient
): Promise<MarketingTemplatePackage> {
  const templates = await listMarketingTemplates({ status: "ALL" }, customClient);
  const existing = templates.find((t) => t.id === templateId) || memoryTemplates.get(templateId);
  if (!existing) {
    throw new Error(`Template '${templateId}' not found.`);
  }

  const updated: MarketingTemplatePackage = {
    ...existing,
    status: "ARCHIVED",
    updatedAt: new Date().toISOString(),
  };

  return await saveMarketingTemplate(updated, userId, customClient);
}

export async function restoreMarketingTemplate(
  templateId: string,
  userId?: string,
  customClient?: SupabaseClient
): Promise<MarketingTemplatePackage> {
  const templates = await listMarketingTemplates({ status: "ALL" }, customClient);
  const existing = templates.find((t) => t.id === templateId) || memoryTemplates.get(templateId);
  if (!existing) {
    throw new Error(`Template '${templateId}' not found.`);
  }

  const updated: MarketingTemplatePackage = {
    ...existing,
    status: "ACTIVE",
    updatedAt: new Date().toISOString(),
  };

  return await saveMarketingTemplate(updated, userId, customClient);
}

export async function deleteMarketingTemplate(
  templateId: string,
  userId?: string,
  customClient?: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  const resolvedId = resolveTemplateId(templateId);
  if (!resolvedId) return { success: false, error: "Template not found" };

  // 1. Check in-memory campaigns first (ensures test/fallback integrity)
  for (const c of memoryCampaigns.values()) {
    if (c.templateId === resolvedId) {
      return {
        success: false,
        error: `Cannot delete template: It is referenced by campaign "${c.name}". Please Archive the template instead.`,
      };
    }
  }

  // 2. Check database campaigns if available
  try {
    const supabase = await getClient(customClient);
    const { data: camps, error: campErr } = await supabase
      .from("marketing_campaigns")
      .select("id, name")
      .eq("template_id", resolvedId)
      .limit(1);

    if (!campErr && camps && camps.length > 0) {
      return {
        success: false,
        error: `Cannot delete template: It is referenced by campaign "${camps[0].name}". Please Archive the template instead.`,
      };
    }

    const { error } = await supabase.from("marketing_templates").delete().eq("id", resolvedId);
    if (error) {
      console.warn("[campaigns:templates] DB delete warning:", error.message);
    }
  } catch (err: any) {
    console.warn("[campaigns:templates] DB delete exception:", err.message);
  }

  memoryTemplates.delete(resolvedId);
  return { success: true };
}

export async function saveMarketingTemplate(
  template: Partial<MarketingTemplatePackage> & { name: string; htmlContent: string; subject: string },
  userId?: string,
  customClient?: SupabaseClient
): Promise<MarketingTemplatePackage> {
  const resolvedId = resolveTemplateId(template.id);
  const isUuid = (val?: string | null) =>
    Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
  const tplId = isUuid(resolvedId)
    ? resolvedId!
    : (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "00000000-0000-4000-b000-" + Date.now().toString(16).padStart(12, "0"));
  const now = new Date().toISOString();

  const templateType = template.templateType || "HTML";
  let htmlContent = template.htmlContent;
  let plainText = template.plainText || "";
  
  if (templateType === "IMAGE" && template.imageSections && template.imageSections.length > 0) {
    const compiled = compileImageTemplateToHtml({
      sections: template.imageSections,
      language: template.language || "ko",
      subject: template.subject,
      previewText: template.previewText || "",
      defaultLandingUrl: template.landingPageUrl || "https://www.kselectnetwork.com",
    });
    htmlContent = compiled.html;
    if (!plainText) plainText = compiled.plainText;
  }

  const fullRecord: MarketingTemplatePackage = {
    id: tplId,
    name: template.name,
    templateType,
    version: template.version || "1.0.0",
    language: template.language || "ko",
    subject: template.subject,
    previewText: template.previewText || "",
    htmlContent,
    plainText,
    variables: template.variables || ["company_name", "contact_name", "brand_name", "custom_message"],
    landingPageUrl: template.landingPageUrl || "https://www.kselectnetwork.com",
    status: template.status || "ACTIVE",
    isDefault: template.isDefault || false,
    imageSections: template.imageSections || [],
    designerPromptSettings: template.designerPromptSettings,
    metadata: {
      ...(template.metadata || {}),
      template_type: templateType,
      image_sections: template.imageSections || [],
      designer_prompt_settings: template.designerPromptSettings,
    },
    createdAt: template.createdAt || now,
    updatedAt: now,
  };

  try {
    const supabase = await getClient(customClient);
    const row: any = {
      id: fullRecord.id,
      name: fullRecord.name,
      template_type: fullRecord.templateType,
      version: fullRecord.version,
      language: fullRecord.language,
      subject: fullRecord.subject,
      preview_text: fullRecord.previewText,
      html_content: fullRecord.htmlContent,
      plain_text: fullRecord.plainText,
      variables: fullRecord.variables,
      landing_page_url: fullRecord.landingPageUrl,
      status: fullRecord.status,
      is_default: fullRecord.isDefault,
      metadata: fullRecord.metadata,
      updated_by: userId || null,
      updated_at: now,
    };

    const { error } = await supabase.from("marketing_templates").upsert(row);
    if (error) {
      console.warn("[campaigns:templates] DB upsert failed:", error.message);
    }
  } catch (err) {
    console.warn("[campaigns:templates] DB exception, updating memory store:", err);
  }

  memoryTemplates.set(fullRecord.id, fullRecord);
  return fullRecord;
}

/**
 * -----------------------------------------------------------------------------
 * 2. CAMPAIGN MANAGEMENT DATA ACCESS
 * -----------------------------------------------------------------------------
 */
export async function listMarketingCampaigns(
  customClient?: SupabaseClient
): Promise<MarketingCampaign[]> {
  try {
    const supabase = await getClient(customClient);
    const { data, error } = await supabase
      .from("marketing_campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((d: any) => ({
        id: d.id,
        name: d.name,
        purpose: d.purpose,
        description: d.description,
        language: d.language,
        templateId: d.template_id,
        templateVersion: d.template_version,
        subjectOverride: d.subject_override || d.approval_snapshot?.subjectOverride || null,
        previewText: d.preview_text || d.approval_snapshot?.previewText || d.filter_criteria?.previewText || null,
        landingPageUrl: d.landing_page_url || d.approval_snapshot?.landingPageUrl || d.filter_criteria?.landingPageUrl || null,
        status: d.status,
        approvalStatus: d.approval_status,
        approvedBy: d.approved_by,
        approvedAt: d.approved_at,
        approvalSnapshot: d.approval_snapshot,
        scheduledAt: d.scheduled_at,
        isLiveModeEnabled: false, // ALWAYS false in V1
        filterCriteria: d.filter_criteria || {},
        customMessage: d.custom_message,
        stats: d.stats || {
          totalRecipients: 0,
          sendableCount: 0,
          excludedCount: 0,
          testSendsCount: 0,
          sentCount: 0,
          deliveredCount: 0,
          failedCount: 0,
        },
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));
    }
  } catch (err) {
    console.warn("[campaigns] DB read failed, falling back to memory store:", err);
  }

  return Array.from(memoryCampaigns.values());
}

export async function getMarketingCampaignById(
  id: string,
  customClient?: SupabaseClient
): Promise<{
  campaign: MarketingCampaign | null;
  recipients: MarketingCampaignRecipientItem[];
  logs: CampaignAuditLogItem[];
}> {
  let campaign: MarketingCampaign | null = null;
  let recipients: MarketingCampaignRecipientItem[] = [];
  let logs: CampaignAuditLogItem[] = [];

  try {
    const supabase = await getClient(customClient);
    const { data: cData } = await supabase
      .from("marketing_campaigns")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (cData) {
      campaign = {
        id: cData.id,
        name: cData.name,
        purpose: cData.purpose,
        description: cData.description,
        language: cData.language,
        templateId: cData.template_id,
        templateVersion: cData.template_version,
        subjectOverride: cData.subject_override || cData.approval_snapshot?.subjectOverride || null,
        previewText: cData.preview_text || cData.approval_snapshot?.previewText || cData.filter_criteria?.previewText || null,
        landingPageUrl: cData.landing_page_url || cData.approval_snapshot?.landingPageUrl || cData.filter_criteria?.landingPageUrl || null,
        status: cData.status,
        approvalStatus: cData.approval_status,
        approvedBy: cData.approved_by,
        approvedAt: cData.approved_at,
        approvalSnapshot: cData.approval_snapshot,
        scheduledAt: cData.scheduled_at,
        isLiveModeEnabled: false,
        filterCriteria: cData.filter_criteria || {},
        customMessage: cData.custom_message,
        stats: cData.stats || {
          totalRecipients: 0,
          sendableCount: 0,
          excludedCount: 0,
          testSendsCount: 0,
          sentCount: 0,
          deliveredCount: 0,
          failedCount: 0,
        },
        createdAt: cData.created_at,
        updatedAt: cData.updated_at,
      };

      const [rRes, lRes] = await Promise.all([
        supabase.from("marketing_campaign_recipients").select("*").eq("campaign_id", id),
        supabase.from("marketing_campaign_logs").select("*").eq("campaign_id", id).order("created_at", { ascending: false }),
      ]);

      if (rRes.data) {
        recipients = rRes.data.map((r: any) => ({
          id: r.id,
          campaignId: r.campaign_id,
          companyId: r.company_id,
          contactId: r.contact_id,
          recipientEmail: r.recipient_email,
          recipientName: r.recipient_name,
          companyNameKr: r.company_name_kr,
          companyNameEn: r.company_name_en,
          brandName: r.brand_name,
          customMessageOverride: r.custom_message_override,
          sendEligibility: r.send_eligibility,
          exclusionReason: r.exclusion_reason,
          status: r.status,
          providerMessageId: r.provider_message_id,
          sentAt: r.sent_at,
          deliveredAt: r.delivered_at,
          errorMessage: r.error_message,
        }));
      }

      if (lRes.data) {
        logs = lRes.data.map((l: any) => ({
          id: l.id,
          campaignId: l.campaign_id,
          recipientId: l.recipient_id,
          eventType: l.event_type,
          isTestMode: l.is_test_mode,
          details: l.details || {},
          performedBy: l.performed_by,
          createdAt: l.created_at,
        }));
      }
    }
  } catch (err) {
    console.warn("[campaigns:getById] DB lookup failed, checking memory:", err);
  }

  if (!campaign && memoryCampaigns.has(id)) {
    campaign = memoryCampaigns.get(id)!;
    recipients = memoryRecipients.get(id) || [];
    logs = memoryLogs.get(id) || [];
  }

  return { campaign, recipients, logs };
}

export async function saveMarketingCampaign(
  campaign: Partial<MarketingCampaign> & { name: string },
  userId?: string,
  customClient?: SupabaseClient
): Promise<MarketingCampaign> {
  const isUuid = (val?: string | null) =>
    Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
  const campId = isUuid(campaign.id)
    ? campaign.id!
    : (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "00000000-0000-4000-a000-" + Date.now().toString(16).padStart(12, "0"));
  const resolvedTemplateId = resolveTemplateId(campaign.templateId);
  const now = new Date().toISOString();

  // If already existing, fetch prior to check for invalidating approval on edit
  const existing = memoryCampaigns.get(campId);
  let approvalStatus = campaign.approvalStatus || existing?.approvalStatus || "PENDING";
  let status = campaign.status || existing?.status || "DRAFT";

  // If approved but content or recipients changed, invalidate approval
  if (existing && existing.approvalStatus === "APPROVED") {
    const contentChanged =
      existing.name !== campaign.name ||
      existing.templateId !== resolvedTemplateId ||
      (campaign.subjectOverride !== undefined && existing.subjectOverride !== campaign.subjectOverride) ||
      (campaign.previewText !== undefined && existing.previewText !== campaign.previewText) ||
      (campaign.landingPageUrl !== undefined && existing.landingPageUrl !== campaign.landingPageUrl) ||
      existing.customMessage !== campaign.customMessage ||
      JSON.stringify(existing.filterCriteria) !== JSON.stringify(campaign.filterCriteria);

    if (contentChanged) {
      approvalStatus = "INVALIDATED";
      status = "DRAFT";
      console.log(`[campaigns] Campaign ${campId} modified after approval — resetting approval status to INVALIDATED`);
    }
  }

  const record: MarketingCampaign = {
    id: campId,
    name: campaign.name,
    purpose: campaign.purpose || "Brand Outreach",
    description: campaign.description || "",
    language: campaign.language || "ko",
    templateId: resolvedTemplateId || null,
    templateVersion: campaign.templateVersion || "1.0.0",
    subjectOverride: campaign.subjectOverride !== undefined ? campaign.subjectOverride : (existing?.subjectOverride || null),
    previewText: campaign.previewText !== undefined ? campaign.previewText : (existing?.previewText || null),
    landingPageUrl: campaign.landingPageUrl !== undefined ? campaign.landingPageUrl : (existing?.landingPageUrl || null),
    status,
    approvalStatus,
    approvedBy: approvalStatus === "APPROVED" ? (campaign.approvedBy || existing?.approvedBy || null) : null,
    approvedAt: approvalStatus === "APPROVED" ? (campaign.approvedAt || existing?.approvedAt || null) : null,
    approvalSnapshot: approvalStatus === "APPROVED" ? (campaign.approvalSnapshot || existing?.approvalSnapshot || null) : null,
    scheduledAt: campaign.scheduledAt || null,
    isLiveModeEnabled: false, // Locked false
    filterCriteria: campaign.filterCriteria || existing?.filterCriteria || {},
    customMessage: campaign.customMessage !== undefined ? campaign.customMessage : existing?.customMessage || "",
    stats: campaign.stats || existing?.stats || {
      totalRecipients: 0,
      sendableCount: 0,
      excludedCount: 0,
      testSendsCount: 0,
      sentCount: 0,
      deliveredCount: 0,
      failedCount: 0,
    },
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  try {
    const supabase = await getClient(customClient);
    const row = {
      id: record.id,
      name: record.name,
      purpose: record.purpose,
      description: record.description,
      language: record.language,
      template_id: record.templateId,
      template_version: record.templateVersion,
      subject_override: record.subjectOverride,
      preview_text: record.previewText,
      landing_page_url: record.landingPageUrl,
      status: record.status,
      approval_status: record.approvalStatus,
      approved_by: record.approvedBy,
      approved_at: record.approvedAt,
      approval_snapshot: record.approvalSnapshot,
      scheduled_at: record.scheduledAt,
      is_live_mode_enabled: false,
      filter_criteria: record.filterCriteria,
      custom_message: record.customMessage,
      stats: record.stats,
      updated_by: userId || null,
      updated_at: now,
    };
    await supabase.from("marketing_campaigns").upsert(row);
  } catch (err) {
    console.warn("[campaigns:save] DB upsert failed:", err);
  }

  memoryCampaigns.set(record.id, record);
  return record;
}

/**
 * -----------------------------------------------------------------------------
 * 3. RECIPIENT SELECTION & DRY-RUN ENGINE (MANDATORY REQUIREMENT 6.D)
 * -----------------------------------------------------------------------------
 */
export async function runCampaignDryRun(
  campaignId: string,
  criteria: MarketingCampaign["filterCriteria"],
  customClient?: SupabaseClient
): Promise<DryRunReport> {
  const supabase = await getClient(customClient);
  const now = new Date().toISOString();

  // 1. Fetch Sourcing Candidates
  let query = supabase
    .from("sourcing_companies")
    .select(`
      id,
      company_name_kr,
      company_name_en,
      business_types,
      grade,
      status,
      marketing_consent_status,
      sourcing_brands (
        id,
        brand_name_kr,
        brand_name_en,
        categories
      ),
      sourcing_contacts (
        id,
        name,
        email,
        is_primary
      )
    `);

  // Apply filters
  if (criteria.grades && criteria.grades.length > 0) {
    query = query.in("grade", criteria.grades);
  }

  const { data: companies, error: compErr } = await query;
  const companyList = (!compErr && Array.isArray(companies)) ? companies : [];

  const seenEmails = new Set<string>();
  const recipientItems: MarketingCampaignRecipientItem[] = [];
  const warnings: string[] = [];

  let duplicateCount = 0;
  let unconfirmedConsentCount = 0;
  let invalidEmailCount = 0;
  let suppressedCount = 0;

  for (const comp of companyList) {
    // Check Company Type filter
    if (criteria.companyTypes && criteria.companyTypes.length > 0) {
      const types = comp.business_types || [];
      const hasMatch = criteria.companyTypes.some((t) => types.includes(t));
      if (!hasMatch) continue;
    }

    const primaryBrand = comp.sourcing_brands?.[0]?.brand_name_kr || comp.company_name_kr;
    const contacts = comp.sourcing_contacts || [];

    if (contacts.length === 0) {
      warnings.push(`Company '${comp.company_name_kr}' has no registered contacts.`);
      continue;
    }

    for (const c of contacts) {
      const email = (c.email || "").trim().toLowerCase();

      // Check Email Validity
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        invalidEmailCount++;
        recipientItems.push({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
          campaignId,
          companyId: comp.id,
          contactId: c.id,
          recipientEmail: email || "invalid-email",
          recipientName: c.name || null,
          companyNameKr: comp.company_name_kr,
          companyNameEn: comp.company_name_en,
          brandName: primaryBrand,
          sendEligibility: "EXCLUDED_INVALID_EMAIL",
          exclusionReason: "Malformed or empty email address",
          status: "PENDING",
        });
        continue;
      }

      // Check Deduplication
      if (seenEmails.has(email)) {
        duplicateCount++;
        recipientItems.push({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
          campaignId,
          companyId: comp.id,
          contactId: c.id,
          recipientEmail: email,
          recipientName: c.name || null,
          companyNameKr: comp.company_name_kr,
          companyNameEn: comp.company_name_en,
          brandName: primaryBrand,
          sendEligibility: "EXCLUDED_DUPLICATE",
          exclusionReason: "Duplicate email address in target selection",
          status: "PENDING",
        });
        continue;
      }
      seenEmails.add(email);

      // Check Suppression List
      const isSuppressed = memorySuppression.has(email) || (await isEmailSuppressed(email));
      if (isSuppressed) {
        suppressedCount++;
        recipientItems.push({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
          campaignId,
          companyId: comp.id,
          contactId: c.id,
          recipientEmail: email,
          recipientName: c.name || null,
          companyNameKr: comp.company_name_kr,
          companyNameEn: comp.company_name_en,
          brandName: primaryBrand,
          sendEligibility: "EXCLUDED_SUPPRESSED",
          exclusionReason: "Email address is on the global suppression/opt-out list",
          status: "PENDING",
        });
        continue;
      }

      // Check Commercial Consent Policy (Mandatory requirement 3: Do not assume UNCONFIRMED consent means approved)
      // When strict consent is required, flag UNCONFIRMED as excluded
      const consentStatus = comp.marketing_consent_status || "UNCONFIRMED";
      if (criteria.requireConsentedOnly && consentStatus !== "CONSENTED") {
        unconfirmedConsentCount++;
        recipientItems.push({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
          campaignId,
          companyId: comp.id,
          contactId: c.id,
          recipientEmail: email,
          recipientName: c.name || null,
          companyNameKr: comp.company_name_kr,
          companyNameEn: comp.company_name_en,
          brandName: primaryBrand,
          sendEligibility: "EXCLUDED_UNCONFIRMED_CONSENT",
          exclusionReason: "Marketing consent is unconfirmed under commercial email policy",
          status: "PENDING",
        });
        continue;
      }

      // Eligible
      recipientItems.push({
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        campaignId,
        companyId: comp.id,
        contactId: c.id,
        recipientEmail: email,
        recipientName: c.name || null,
        companyNameKr: comp.company_name_kr,
        companyNameEn: comp.company_name_en,
        brandName: primaryBrand,
        sendEligibility: "ELIGIBLE",
        status: "PENDING",
      });
    }
  }

  // Freeze recipients in memory store
  memoryRecipients.set(campaignId, recipientItems);

  const sendable = recipientItems.filter((r) => r.sendEligibility === "ELIGIBLE");
  const excluded = recipientItems.filter((r) => r.sendEligibility !== "ELIGIBLE");

  // Sample previews (3-5 sample recipient records)
  const sampleCandidates = sendable.slice(0, 5);
  const footerSettings = await getMarketingFooterSettings();
  const existingCamp = await getMarketingCampaignById(campaignId, customClient);
  const camp = existingCamp.campaign;
  let tplHtml = "<p>안녕하세요, {{company_name}} {{contact_name}} 귀하. {{brand_name}} 입점을 제안드립니다.</p>";
  let tplSubject = camp?.subjectOverride || "[K SELECT] {{company_name}}의 미국 뷰티 리테일 네트워크 진출을 제안드립니다";

  if (camp?.templateId) {
    const tpls = await listMarketingTemplates({ status: "ALL" }, customClient);
    const activeTpl = tpls.find((t) => t.id === camp.templateId);
    if (activeTpl) {
      tplHtml = activeTpl.htmlContent;
      if (!camp.subjectOverride && activeTpl.subject) {
        tplSubject = activeTpl.subject;
      }
    }
  }

  const samplePreviews: SampleRecipientPreview[] = sampleCandidates.map((r) => {
    const rendered = personalizeEmail(
      tplSubject,
      tplHtml,
      "안녕하세요, {{company_name}} {{contact_name}} 귀하.",
      {
        companyName: r.companyNameKr,
        contactName: r.recipientName,
        brandName: r.brandName,
        language: camp?.language || "ko",
      }
    );

    const testUnsubUrl = buildUnsubscribeUrl(r.recipientEmail, campaignId);
    const assembledHtml = assembleEmailWithMarketingFooter(rendered.html, {
      footerSettings,
      language: camp?.language || "ko",
      unsubscribeUrl: testUnsubUrl,
      previewText: camp?.previewText || "",
      landingPageUrl: camp?.landingPageUrl || "https://www.kselectnetwork.com",
    });

    return {
      recipientEmail: maskEmailAddress(r.recipientEmail),
      companyName: r.companyNameKr,
      contactName: r.recipientName || "담당자님",
      brandName: r.brandName || r.companyNameKr,
      resolvedSubject: rendered.subject,
      resolvedHtml: assembledHtml,
      warnings: rendered.warnings,
    };
  });

  const report: DryRunReport = {
    timestamp: now,
    campaignId,
    totalCandidatesEvaluated: recipientItems.length,
    sendableCount: sendable.length,
    excludedCount: excluded.length,
    duplicateEmailsFiltered: duplicateCount,
    unconfirmedConsentFiltered: unconfirmedConsentCount,
    suppressedFiltered: suppressedCount,
    invalidEmailFiltered: invalidEmailCount,
    samplePreviews,
    warnings,
    senderIdentity: process.env.EMAIL_FROM_ADDRESS || "K SELECT NETWORK <Contact@letusto.com>",
    isCompliant: true,
  };

  // Record audit log
  recordCampaignAuditLog(campaignId, "DRY_RUN_COMPLETED", true, {
    sendableCount: sendable.length,
    excludedCount: excluded.length,
  });

  return report;
}

/**
 * -----------------------------------------------------------------------------
 * 4. TEST EMAIL DISPATCH (MANDATORY REQUIREMENT 6.B)
 * Sends ONLY to explicitly allowlisted test recipients!
 * -----------------------------------------------------------------------------
 */
export async function sendTestCampaignEmail(
  campaignId: string,
  targetEmail: string,
  templateSubject: string,
  templateHtml: string,
  templatePlainText?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // 1. Strict Allowlist Verification (Internal Domains + Owner-Approved Allowlist)
  const ownerAllowlist = await getMarketingTestAllowlist();
  const allowCheck = isTestRecipientAllowlisted(targetEmail, ownerAllowlist);
  if (!allowCheck.isAllowed) {
    const err =
      allowCheck.rejectionReason ||
      `Security Rejection: '${targetEmail}' is not an authorized test recipient. Only verified domains (letusto.com, kselectnetwork.com) or configured test allowlists are permitted.`;
    console.error("[campaigns:test-send]", err);
    recordCampaignAuditLog(campaignId, "TEST_EMAIL_REJECTED", false, {
      testRecipient: maskEmailAddress(targetEmail),
      reason: err,
    });
    return { success: false, error: err };
  }

  // 2. Sample Personalization for test rendering
  const personalized = personalizeEmail(
    templateSubject,
    templateHtml,
    templatePlainText,
    {
      companyName: "(주)K SELECT 테스트사",
      contactName: "테스트 담당자",
      brandName: "K-Select Test Brand",
      customMessage: "이것은 관리자 내부 검증용 테스트 발송입니다.",
    }
  );

  // 3. Assemble with central marketing footer & real working test unsubscribe link
  const footerSettings = await getMarketingFooterSettings();
  const testUnsubUrl = buildUnsubscribeUrl(targetEmail, campaignId);
  const existingCamp = await getMarketingCampaignById(campaignId);
  const camp = existingCamp.campaign;

  const assembledHtml = assembleEmailWithMarketingFooter(personalized.html, {
    footerSettings,
    language: camp?.language || "ko",
    unsubscribeUrl: testUnsubUrl,
    previewText: camp?.previewText || "",
    landingPageUrl: camp?.landingPageUrl || "https://www.kselectnetwork.com",
  });

  // 4. Dispatch via central email gateway
  const res = await sendEmail({
    to: targetEmail,
    subject: `[TEST EMAIL] ${personalized.subject}`,
    text: personalized.plainText || "Test message body",
    html: assembledHtml,
  });

  // 4. Record Audit Log
  recordCampaignAuditLog(campaignId, "TEST_EMAIL_SENT", true, {
    testRecipient: maskEmailAddress(targetEmail),
    success: res.success,
    messageId: res.messageId,
  });

  return res;
}

/**
 * -----------------------------------------------------------------------------
 * 5. APPROVAL WORKFLOW & LOCKED SNAPSHOT (MANDATORY REQUIREMENT 7)
 * -----------------------------------------------------------------------------
 */
export async function approveMarketingCampaign(
  campaignId: string,
  approvingAdminEmail: string,
  customClient?: SupabaseClient
): Promise<MarketingCampaign> {
  const existing = await getMarketingCampaignById(campaignId, customClient);
  if (!existing.campaign) {
    throw new Error(`Campaign '${campaignId}' not found.`);
  }

  const now = new Date().toISOString();
  const recipients = existing.recipients || [];
  const sendable = recipients.filter((r) => r.sendEligibility === "ELIGIBLE");

  const footerSettings = await getMarketingFooterSettings();
  const footerCheck = validateMarketingFooterCompleteness(footerSettings);
  if (!footerCheck.isValid) {
    throw new Error(`Cannot approve campaign: Marketing footer is incomplete. Missing: ${footerCheck.missingFields.join(", ")}. Please configure Brand Marketing Email Settings.`);
  }

  const snapshot: CampaignApprovalSnapshot = {
    approvedAt: now,
    approvedBy: approvingAdminEmail,
    templateVersion: existing.campaign.templateVersion || "1.0.0",
    templateSubject: existing.campaign.name,
    subjectOverride: existing.campaign.subjectOverride || null,
    resolvedSubject: existing.campaign.subjectOverride || existing.campaign.name,
    frozenRecipientsCount: recipients.length,
    sendableCount: sendable.length,
    senderAddress: process.env.EMAIL_FROM_ADDRESS || "Contact@letusto.com",
    footerVersion: footerSettings.updatedAt || now,
    footerSettingsSnapshot: footerSettings as any,
    hash: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
  };

  const updated = await saveMarketingCampaign(
    {
      ...existing.campaign,
      status: "APPROVED",
      approvalStatus: "APPROVED",
      approvedBy: approvingAdminEmail,
      approvedAt: now,
      approvalSnapshot: snapshot,
    },
    approvingAdminEmail,
    customClient
  );

  recordCampaignAuditLog(campaignId, "CAMPAIGN_APPROVED", true, {
    approvedBy: approvingAdminEmail,
    snapshot,
  });

  return updated;
}

/**
 * -----------------------------------------------------------------------------
 * 6. AUDIT LOGGING HELPER
 * -----------------------------------------------------------------------------
 */
export function recordCampaignAuditLog(
  campaignId: string,
  eventType: string,
  isTestMode: boolean,
  details: Record<string, any>,
  performedBy?: string
): void {
  const log: CampaignAuditLogItem = {
    id: "log-" + (crypto.randomUUID ? crypto.randomUUID() : Date.now()),
    campaignId,
    eventType,
    isTestMode,
    details,
    performedBy: performedBy || "admin",
    createdAt: new Date().toISOString(),
  };

  const existing = memoryLogs.get(campaignId) || [];
  memoryLogs.set(campaignId, [log, ...existing]);
}

/**
 * -----------------------------------------------------------------------------
 * 7. MARKETING FOOTER SETTINGS PERSISTENCE
 * -----------------------------------------------------------------------------
 */
let cachedFooterSettings: MarketingFooterSettings = { ...DEFAULT_MARKETING_FOOTER };

export async function getMarketingFooterSettings(
  customClient?: SupabaseClient
): Promise<MarketingFooterSettings> {
  try {
    const supabase = await getClient(customClient);
    const { data, error } = await supabase
      .from("marketing_footer_settings")
      .select("*")
      .eq("id", "central_marketing_footer")
      .maybeSingle();

    if (!error && data) {
      cachedFooterSettings = {
        id: data.id,
        brandDisplayName: data.brand_display_name || DEFAULT_MARKETING_FOOTER.brandDisplayName,
        legalCompanyName: data.legal_company_name || DEFAULT_MARKETING_FOOTER.legalCompanyName,
        physicalAddress: data.physical_address || DEFAULT_MARKETING_FOOTER.physicalAddress,
        contactEmail: data.contact_email || DEFAULT_MARKETING_FOOTER.contactEmail,
        contactWebsite: data.contact_website || DEFAULT_MARKETING_FOOTER.contactWebsite,
        disclosureKo: data.disclosure_ko || DEFAULT_MARKETING_FOOTER.disclosureKo,
        disclosureEn: data.disclosure_en || DEFAULT_MARKETING_FOOTER.disclosureEn,
        defaultLanguage: (data.default_language as "ko" | "en") || DEFAULT_MARKETING_FOOTER.defaultLanguage,
        updatedAt: data.updated_at,
        updatedBy: data.updated_by,
      };
    }
  } catch (err: any) {
    // Graceful fallback to memory/default
  }

  return { ...cachedFooterSettings };
}

export async function saveMarketingFooterSettings(
  settings: Partial<MarketingFooterSettings>,
  userId?: string,
  customClient?: SupabaseClient
): Promise<MarketingFooterSettings> {
  const current = await getMarketingFooterSettings(customClient);
  const updated: MarketingFooterSettings = {
    ...current,
    ...settings,
    id: "central_marketing_footer",
    updatedAt: new Date().toISOString(),
    updatedBy: userId || current.updatedBy || null,
  };

  try {
    const supabase = await getClient(customClient);
    const { error } = await supabase.from("marketing_footer_settings").upsert({
      id: "central_marketing_footer",
      brand_display_name: updated.brandDisplayName,
      legal_company_name: updated.legalCompanyName,
      physical_address: updated.physicalAddress,
      contact_email: updated.contactEmail,
      contact_website: updated.contactWebsite,
      disclosure_ko: updated.disclosureKo,
      disclosure_en: updated.disclosureEn,
      default_language: updated.defaultLanguage,
      updated_by: updated.updatedBy,
      updated_at: updated.updatedAt,
    });

    if (error) {
      console.warn("[marketing:footer] DB upsert error:", error.message);
      if (error.code !== "42P01" && !error.message?.includes("does not exist")) {
        throw new Error(error.message);
      }
    }
  } catch (err: any) {
    console.warn("[marketing:footer] Exception saving footer settings:", err.message);
    if (!err.message?.includes("42P01") && !err.message?.includes("does not exist")) {
      throw err;
    }
  }

  cachedFooterSettings = { ...updated };
  return { ...cachedFooterSettings };
}
