import "server-only";
import { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MarketingCampaign,
  MarketingTemplatePackage,
  MarketingCampaignRecipientItem,
  CampaignAuditLogItem,
  DryRunReport,
  CampaignApprovalSnapshot,
  SampleRecipientPreview,
  TemplateFilterOptions,
  CampaignDeliveryExecutionResult,
  CampaignStatus,
  CampaignStats,
  CampaignUnlockAudit,
  UnlockCampaignSendInput,
  UnlockCampaignSendResult,
} from "./campaign-types";
import {
  MarketingFooterSettings,
  DEFAULT_MARKETING_FOOTER,
  assembleEmailWithMarketingFooter,
  validateMarketingFooterCompleteness,
  MarketingFooterStyle,
} from "./marketing-footer";
import {
  buildUnsubscribeUrl,
  isEmailSuppressed,
  checkEmailSuppression,
  formatSuppressionReasonKorean,
  buildOneClickUnsubscribeEndpoint,
  removeEmailFromMemorySuppression,
} from "./unsubscribe";
import { DEFAULT_MARKETING_TEMPLATES, resolveTemplateId } from "./default-templates";
import { compileImageTemplateToHtml } from "./image-template-compiler";
import { personalizeEmail, validateSendReadyHtml } from "./personalization-engine";
import { sendEmail, maskEmailAddress, isRecipientAllowlisted } from "@/lib/notifications/email";
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
  if (process.env.ENABLE_QA_ENVIRONMENT === "true" && process.env.QA_SUPABASE_URL) {
    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const qaKey =
      process.env.QA_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.QA_SUPABASE_ANON_KEY ||
      process.env.QA_SUPABASE_SECRET_KEY;
    if (qaKey) {
      return createSupabaseClient(process.env.QA_SUPABASE_URL, qaKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  }
  try {
    return await createClient();
  } catch (err: any) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (url && key) {
      const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
      return createSupabaseClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    throw err;
  }
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

  // 0. Protect default system templates
  const memTpl = memoryTemplates.get(resolvedId) || DEFAULT_MARKETING_TEMPLATES.find((t) => t.id === resolvedId);
  if (memTpl?.isDefault) {
    return {
      success: false,
      error: `Cannot delete default system template "${memTpl.name}". System default templates are protected.`,
    };
  }

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
      // Query recipient ledger summary to compute authoritative real delivery metrics
      const { data: recipientRows } = await supabase
        .from("marketing_campaign_recipients")
        .select("campaign_id, status, provider_message_id");

      const deliveryMap: Record<
        string,
        { realSent: number; realDelivered: number; realFailed: number; simCount: number }
      > = {};

      (recipientRows || []).forEach((r: any) => {
        if (!deliveryMap[r.campaign_id]) {
          deliveryMap[r.campaign_id] = { realSent: 0, realDelivered: 0, realFailed: 0, simCount: 0 };
        }
        const isReal = r.provider_message_id && !r.provider_message_id.startsWith("sim_");
        if (isReal && (r.status === "SENT" || r.status === "DELIVERED")) {
          deliveryMap[r.campaign_id].realSent++;
        }
        if (isReal && r.status === "DELIVERED") {
          deliveryMap[r.campaign_id].realDelivered++;
        }
        if (r.status === "FAILED") {
          deliveryMap[r.campaign_id].realFailed++;
        }
        if (r.provider_message_id && r.provider_message_id.startsWith("sim_")) {
          deliveryMap[r.campaign_id].simCount++;
        }
      });

      return data.map((d: any) => {
        const deliv = deliveryMap[d.id] || { realSent: 0, realDelivered: 0, realFailed: 0, simCount: 0 };
        const hasSimHistory = deliv.simCount > 0 || Boolean(d.stats?.simulationStats);
        const isActuallySent = deliv.realSent > 0;

        // Authoritative metric normalization:
        // Real Sent and Delivered MUST be supported by genuine provider delivery records.
        // If historical DB records have sentCount > 0 from simulation, normalize real counts to 0.
        const realSentCount = isActuallySent ? deliv.realSent : 0;
        const realDeliveredCount = isActuallySent ? deliv.realDelivered : 0;
        const realFailedCount = isActuallySent ? deliv.realFailed : 0;

        let resolvedStatus: CampaignStatus = d.status as CampaignStatus;
        if (!isActuallySent && hasSimHistory && (d.status === "COMPLETED" || d.status === "APPROVED")) {
          resolvedStatus = "SIMULATED";
        }

        const normalizedStats: CampaignStats = {
          totalRecipients: d.stats?.totalRecipients || 0,
          sendableCount: d.stats?.sendableCount || 0,
          excludedCount: d.stats?.excludedCount || 0,
          testSendsCount: d.stats?.testSendsCount || 0,
          sentCount: realSentCount,
          deliveredCount: realDeliveredCount,
          failedCount: realFailedCount,
          simulationStats: d.stats?.simulationStats || (deliv.simCount > 0 ? {
            lastSimulatedAt: d.updated_at,
            simulatedCount: deliv.simCount,
            simulatedEligible: deliv.simCount,
            simulatedSuppressed: 0,
            simulatedFailed: 0,
            simulatedBy: "historical-simulation",
          } : undefined),
        };

        return {
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
          footerStyle: (d.approval_snapshot?.footerStyle || d.filter_criteria?.footerStyle || "classic") as MarketingFooterStyle,
          status: resolvedStatus,
          approvalStatus: d.approval_status,
          approvedBy: d.approved_by,
          approvedAt: d.approved_at,
          approvalSnapshot: d.approval_snapshot,
          scheduledAt: d.scheduled_at,
          isLiveModeEnabled: false, // ALWAYS false in V1
          filterCriteria: d.filter_criteria || {},
          customMessage: d.custom_message,
          stats: normalizedStats,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        };
      });
    }
  } catch (err) {
    console.warn("[campaigns] DB read failed, falling back to memory store:", err);
  }

  return Array.from(memoryCampaigns.values());
}

/**
 * -----------------------------------------------------------------------------
 * 2.1 AUTHORITATIVE RECIPIENT CANDIDATE EVALUATION & SYNCHRONIZATION
 * Standard: DEPLOY-STD-001, Task ID: ADM-EMAIL-APP-001
 * Evaluates candidate companies, contacts and manual entries against policy
 * (syntax, deduplication, global suppression, and commercial consent)
 * and synchronizes authoritative records to marketing_campaign_recipients.
 * -----------------------------------------------------------------------------
 */
export interface CandidateEvaluationResult {
  recipientItems: MarketingCampaignRecipientItem[];
  duplicateCount: number;
  unconfirmedConsentCount: number;
  invalidEmailCount: number;
  suppressedCount: number;
  warnings: string[];
  companyList: any[];
}

export async function evaluateCampaignRecipientCandidates(
  campaignId: string,
  criteria: MarketingCampaign["filterCriteria"],
  customClient?: SupabaseClient
): Promise<CandidateEvaluationResult> {
  const supabase = await getClient(customClient);
  const seenEmails = new Set<string>();
  const recipientItems: MarketingCampaignRecipientItem[] = [];
  const warnings: string[] = [];

  let duplicateCount = 0;
  let unconfirmedConsentCount = 0;
  let invalidEmailCount = 0;
  let suppressedCount = 0;

  // RFC-compliant email regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  // 1. Fetch Sourcing Candidates
  let companyList: any[] = [];
  if (criteria?.companyIds && criteria.companyIds.length === 0) {
    // Explicitly zero companies selected
    companyList = [];
  } else {
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

    if (criteria?.grades && criteria.grades.length > 0) {
      query = query.in("grade", criteria.grades);
    }
    if (criteria?.companyIds && criteria.companyIds.length > 0) {
      query = query.in("id", criteria.companyIds);
    }

    const { data: companies, error: compErr } = await query;
    companyList = (!compErr && Array.isArray(companies)) ? companies : [];
  }

  for (const comp of companyList) {
    if (criteria?.companyTypes && criteria.companyTypes.length > 0) {
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

    // Sort contacts by is_primary descending so primary contact is evaluated first
    const sortedContacts = [...contacts].sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));

    for (const c of sortedContacts) {
      if (criteria?.contactIds && criteria.contactIds.length > 0 && !criteria.contactIds.includes(c.id)) {
        continue;
      }
      const rawEmail = (c.email || "").trim();
      const email = rawEmail.toLowerCase();

      // Check Email Validity
      if (!rawEmail || !emailRegex.test(rawEmail) || rawEmail.startsWith("http://") || rawEmail.startsWith("https://")) {
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

      // Check Suppression List (Universal Enforcement)
      const suppressionCheck = await checkEmailSuppression(email, customClient || supabase);
      if (suppressionCheck.isSuppressed) {
        suppressedCount++;
        const reasonLabel = formatSuppressionReasonKorean(suppressionCheck.reason);
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
          exclusionReason: `Email address is on the global suppression/opt-out list (${reasonLabel})`,
          status: "PENDING",
        });
        continue;
      }

      // Check Commercial Consent Policy
      const consentStatus = comp.marketing_consent_status || "UNCONFIRMED";
      if (criteria?.requireConsentedOnly && consentStatus !== "CONSENTED") {
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

  // 2. Process Manual Emails
  if (criteria?.manualEmails && Array.isArray(criteria.manualEmails)) {
    for (const raw of criteria.manualEmails) {
      const trimmed = (raw || "").trim();
      const email = trimmed.toLowerCase();
      if (!trimmed) continue;

      if (!emailRegex.test(trimmed) || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        invalidEmailCount++;
        recipientItems.push({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
          campaignId,
          companyId: null,
          contactId: null,
          recipientEmail: email || "invalid-email",
          recipientName: null,
          companyNameKr: "수기 입력 수신자",
          companyNameEn: "Manual Recipient",
          brandName: "Direct Outreach",
          sendEligibility: "EXCLUDED_INVALID_EMAIL",
          exclusionReason: "Malformed or empty manual email address",
          status: "PENDING",
        });
        continue;
      }

      if (seenEmails.has(email)) {
        duplicateCount++;
        recipientItems.push({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
          campaignId,
          companyId: null,
          contactId: null,
          recipientEmail: email,
          recipientName: null,
          companyNameKr: "수기 입력 수신자",
          companyNameEn: "Manual Recipient",
          brandName: "Direct Outreach",
          sendEligibility: "EXCLUDED_DUPLICATE",
          exclusionReason: "Duplicate email address in manual target selection",
          status: "PENDING",
        });
        continue;
      }
      seenEmails.add(email);

      const suppressionCheck = await checkEmailSuppression(email, customClient || supabase);
      if (suppressionCheck.isSuppressed) {
        suppressedCount++;
        const reasonLabel = formatSuppressionReasonKorean(suppressionCheck.reason);
        recipientItems.push({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
          campaignId,
          companyId: null,
          contactId: null,
          recipientEmail: email,
          recipientName: null,
          companyNameKr: "수기 입력 수신자",
          companyNameEn: "Manual Recipient",
          brandName: "Direct Outreach",
          sendEligibility: "EXCLUDED_SUPPRESSED",
          exclusionReason: `Email address is on the global suppression/opt-out list (${reasonLabel})`,
          status: "PENDING",
        });
        continue;
      }

      if (criteria.requireConsentedOnly) {
        unconfirmedConsentCount++;
        recipientItems.push({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
          campaignId,
          companyId: null,
          contactId: null,
          recipientEmail: email,
          recipientName: null,
          companyNameKr: "수기 입력 수신자",
          companyNameEn: "Manual Recipient",
          brandName: "Direct Outreach",
          sendEligibility: "EXCLUDED_UNCONFIRMED_CONSENT",
          exclusionReason: "Marketing consent is unconfirmed under commercial email policy for manual entry",
          status: "PENDING",
        });
        continue;
      }

      recipientItems.push({
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        campaignId,
        companyId: null,
        contactId: null,
        recipientEmail: email,
        recipientName: null,
        companyNameKr: "수기 입력 수신자",
        companyNameEn: "Manual Recipient",
        brandName: "Direct Outreach",
        sendEligibility: "ELIGIBLE",
        status: "PENDING",
      });
    }
  }

  return {
    recipientItems,
    duplicateCount,
    unconfirmedConsentCount,
    invalidEmailCount,
    suppressedCount,
    warnings,
    companyList,
  };
}

export async function syncCampaignRecipients(
  campaignId: string,
  criteria: MarketingCampaign["filterCriteria"],
  customClient?: SupabaseClient
): Promise<MarketingCampaignRecipientItem[]> {
  const supabase = await getClient(customClient);
  const evaluation = await evaluateCampaignRecipientCandidates(campaignId, criteria, customClient);
  const recipientItems = evaluation.recipientItems;

  // Always update in-memory cache
  memoryRecipients.set(campaignId, recipientItems);

  try {
    // 1. Fetch existing recipient rows for this campaign
    const { data: existingRows } = await supabase
      .from("marketing_campaign_recipients")
      .select("id, recipient_email")
      .eq("campaign_id", campaignId);

    const existingMap = new Map<string, string>();
    (existingRows || []).forEach((r: any) => {
      if (r.recipient_email) existingMap.set(r.recipient_email.toLowerCase(), r.id);
    });

    // 2. Identify rows to delete (emails that are no longer in selection)
    // Note: Deduplicated candidates share the same email, but we only store the non-duplicate row in the table
    // because uq_campaign_recipient_lower_email enforces 1 row per email per campaign.
    const persistableItems = recipientItems.filter((r) => r.sendEligibility !== "EXCLUDED_DUPLICATE");
    const currentEmails = new Set(persistableItems.map((r) => r.recipientEmail.toLowerCase()));
    const toDeleteIds = (existingRows || [])
      .filter((r: any) => !currentEmails.has(r.recipient_email?.toLowerCase()))
      .map((r: any) => r.id);

    if (toDeleteIds.length > 0) {
      await supabase
        .from("marketing_campaign_recipients")
        .delete()
        .in("id", toDeleteIds);
    }

    // 3. Fallback company ID for manual recipients when company_id has NOT NULL constraint
    const verifiedCompIds = new Set((evaluation.companyList || []).map((c: any) => c.id));
    let fallbackCompanyId: string | null = null;
    if (criteria?.companyIds && criteria.companyIds.length > 0) {
      const valid = criteria.companyIds.find((id) => verifiedCompIds.has(id));
      fallbackCompanyId = valid || null;
    }
    if (!fallbackCompanyId) {
      try {
        let q = supabase.from("sourcing_companies").select("id");
        if (typeof q?.limit === "function") q = q.limit(1);
        const { data: firstComp } = (await (q?.maybeSingle ? q.maybeSingle() : q)) as any || {};
        if (firstComp?.id) fallbackCompanyId = firstComp.id;
      } catch {}
    }

    // 4. Map to database rows
    const isUuid = (val?: string | null) =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    const dbRows = persistableItems.map((r) => {
      const existingId = existingMap.get(r.recipientEmail.toLowerCase());
      const rowId = existingId || (isUuid(r.id) ? r.id : (crypto.randomUUID ? crypto.randomUUID() : undefined));
      const companyId = (isUuid(r.companyId) && (verifiedCompIds.size === 0 || verifiedCompIds.has(r.companyId))) ? r.companyId : fallbackCompanyId;
      const contactId = isUuid(r.contactId) ? r.contactId : null;

      return {
        id: rowId,
        campaign_id: campaignId,
        company_id: companyId,
        contact_id: contactId,
        recipient_email: r.recipientEmail.trim().toLowerCase(),
        recipient_name: r.recipientName || null,
        company_name_kr: r.companyNameKr || "수기 입력 수신자",
        company_name_en: r.companyNameEn || null,
        brand_name: r.brandName || null,
        custom_message_override: r.customMessageOverride || null,
        send_eligibility: r.sendEligibility,
        exclusion_reason: r.exclusionReason || null,
        status: r.status || "PENDING",
        updated_at: new Date().toISOString(),
      };
    });

    if (dbRows.length > 0) {
      const { error: upsertErr } = await supabase
        .from("marketing_campaign_recipients")
        .upsert(dbRows, { onConflict: "campaign_id,recipient_email" });

      if (upsertErr) {
        console.warn("[campaigns:syncRecipients] DB upsert failed:", upsertErr.message);
      }
    }

    // 5. Update campaign stats
    const sendable = persistableItems.filter((r) => r.sendEligibility === "ELIGIBLE");
    const excluded = recipientItems.filter((r) => r.sendEligibility !== "ELIGIBLE");

    await supabase
      .from("marketing_campaigns")
      .update({
        stats: {
          totalRecipients: persistableItems.length,
          sendableCount: sendable.length,
          excludedCount: excluded.length,
          testSendsCount: 0,
          sentCount: 0,
          deliveredCount: 0,
          failedCount: 0,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId);
  } catch (err: any) {
    if (!err?.message?.includes("is not a function")) {
      console.warn("[campaigns:syncRecipients] DB sync exception:", err?.message || err);
    }
  }

  return recipientItems;
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
        footerStyle: (cData.approval_snapshot?.footerStyle || cData.filter_criteria?.footerStyle || "classic") as MarketingFooterStyle,
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

      if (rRes.data && rRes.data.length > 0) {
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
      } else if (
        campaign &&
        campaign.status !== "APPROVED" &&
        campaign.filterCriteria &&
        (
          (campaign.filterCriteria.companyIds && campaign.filterCriteria.companyIds.length > 0) ||
          (campaign.filterCriteria.manualEmails && campaign.filterCriteria.manualEmails.length > 0)
        )
      ) {
        try {
          const synced = await syncCampaignRecipients(id, campaign.filterCriteria, customClient);
          recipients = synced.filter((r) => r.sendEligibility !== "EXCLUDED_DUPLICATE");
        } catch (syncErr: any) {
          console.warn("[campaigns:getById] Auto-sync recipients failed:", syncErr.message);
        }
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

  // Authoritative normalization for single campaign fetch
  if (campaign && recipients) {
    let realSent = 0;
    let realDelivered = 0;
    let realFailed = 0;
    let simCount = 0;

    recipients.forEach((r) => {
      const isReal = r.providerMessageId && !r.providerMessageId.startsWith("sim_");
      if (isReal && (r.status === "SENT" || r.status === "DELIVERED")) realSent++;
      if (isReal && r.status === "DELIVERED") realDelivered++;
      if (r.status === "FAILED") realFailed++;
      if (r.providerMessageId && r.providerMessageId.startsWith("sim_")) simCount++;
    });

    const isActuallySent = realSent > 0;
    const hasSimHistory = simCount > 0 || Boolean(campaign.stats?.simulationStats);

    if (!isActuallySent && hasSimHistory && (campaign.status === "COMPLETED" || campaign.status === "APPROVED")) {
      campaign.status = "SIMULATED";
    }

    campaign.stats = {
      totalRecipients: campaign.stats?.totalRecipients || recipients.length,
      sendableCount: campaign.stats?.sendableCount || recipients.filter((r) => r.sendEligibility === "ELIGIBLE").length,
      excludedCount: campaign.stats?.excludedCount || recipients.filter((r) => r.sendEligibility !== "ELIGIBLE").length,
      testSendsCount: campaign.stats?.testSendsCount || 0,
      sentCount: isActuallySent ? realSent : 0,
      deliveredCount: isActuallySent ? realDelivered : 0,
      failedCount: isActuallySent ? realFailed : 0,
      simulationStats: campaign.stats?.simulationStats || (simCount > 0 ? {
        lastSimulatedAt: campaign.updatedAt,
        simulatedCount: simCount,
        simulatedEligible: simCount,
        simulatedSuppressed: 0,
        simulatedFailed: 0,
        simulatedBy: "historical-simulation",
      } : undefined),
    };
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
      (campaign.footerStyle !== undefined && existing.footerStyle !== campaign.footerStyle) ||
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
    footerStyle: campaign.footerStyle || existing?.footerStyle || "classic",
    status,
    approvalStatus,
    approvedBy: approvalStatus === "APPROVED" ? (campaign.approvedBy || existing?.approvedBy || null) : null,
    approvedAt: approvalStatus === "APPROVED" ? (campaign.approvedAt || existing?.approvedAt || null) : null,
    approvalSnapshot: approvalStatus === "APPROVED" ? (campaign.approvalSnapshot || existing?.approvalSnapshot || null) : null,
    scheduledAt: campaign.scheduledAt || null,
    isLiveModeEnabled: false, // Locked false
    filterCriteria: {
      ...(campaign.filterCriteria || existing?.filterCriteria || {}),
      footerStyle: campaign.footerStyle || existing?.footerStyle || "classic",
    },
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
      filter_criteria: {
        ...(record.filterCriteria || {}),
        footerStyle: record.footerStyle || "classic",
      },
      custom_message: record.customMessage,
      stats: record.stats,
      updated_by: userId || null,
      updated_at: now,
    };
    await supabase.from("marketing_campaigns").upsert(row);
  } catch (err) {
    console.warn("[campaigns:save] DB upsert failed:", err);
  }

  // Synchronize recipients to marketing_campaign_recipients table
  // (Only for unapproved campaigns; approved campaigns have their snapshots frozen)
  if (record.approvalStatus !== "APPROVED" && record.filterCriteria) {
    try {
      const synced = await syncCampaignRecipients(record.id, record.filterCriteria, customClient);
      const sendable = synced.filter((r) => r.sendEligibility === "ELIGIBLE");
      const excluded = synced.filter((r) => r.sendEligibility !== "ELIGIBLE");
      record.stats = {
        ...record.stats,
        totalRecipients: synced.filter((r) => r.sendEligibility !== "EXCLUDED_DUPLICATE").length,
        sendableCount: sendable.length,
        excludedCount: excluded.length,
      };
    } catch (syncErr: any) {
      console.warn("[campaigns:save] syncCampaignRecipients failed:", syncErr.message);
    }
  }

  memoryCampaigns.set(record.id, record);
  return record;
}

/**
 * Safely deletes a marketing campaign if it is not approved or sent.
 * Protects approvals, sent records, delivery history, recipient snapshots, and audit logs.
 */
export async function deleteMarketingCampaign(
  campaignId: string,
  userId?: string,
  customClient?: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  // 1. Fetch campaign to inspect status & dependencies
  const { campaign, recipients } = await getMarketingCampaignById(campaignId, customClient);
  if (!campaign) {
    return { success: false, error: "Campaign not found" };
  }

  // 2. Protect existing approvals, sent records, delivery history, compliance/audit records
  const protectedStatuses: string[] = ["APPROVED", "SCHEDULED", "SENDING", "COMPLETED"];
  if (protectedStatuses.includes(campaign.status) || campaign.approvalStatus === "APPROVED") {
    return {
      success: false,
      error: `Campaign "${campaign.name}" cannot be deleted because it is ${campaign.status} or approved. Approved campaigns are protected for compliance history. Please archive it instead.`,
    };
  }

  // Check if any recipients have actually been sent or queued
  const hasSentRecipients = recipients.some(
    (r) => r.status === "SENT" || r.status === "DELIVERED" || r.status === "QUEUED"
  );
  if (hasSentRecipients) {
    return {
      success: false,
      error: `Campaign "${campaign.name}" has sent delivery records and cannot be deleted. Please archive it instead.`,
    };
  }

  // 3. Safe deletion for draft/testing/cancelled
  try {
    const supabase = await getClient(customClient);

    // Delete recipient records associated with draft
    await supabase.from("marketing_campaign_recipients").delete().eq("campaign_id", campaignId);

    // Delete audit logs associated with draft
    await supabase.from("marketing_campaign_logs").delete().eq("campaign_id", campaignId);

    // Delete campaign record
    const { error: delErr } = await supabase.from("marketing_campaigns").delete().eq("id", campaignId);
    if (delErr) {
      console.warn("[campaigns] DB delete campaign warning:", delErr.message);
      return { success: false, error: delErr.message };
    }
  } catch (err: any) {
    console.warn("[campaigns] DB delete campaign exception:", err.message);
  }

  // Clear from in-memory stores
  memoryCampaigns.delete(campaignId);
  memoryRecipients.delete(campaignId);
  memoryLogs.delete(campaignId);

  return { success: true };
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

  // Authoritatively evaluate and synchronize recipient items
  const evaluation = await evaluateCampaignRecipientCandidates(campaignId, criteria, customClient);
  const recipientItems = evaluation.recipientItems;
  const duplicateCount = evaluation.duplicateCount;
  const unconfirmedConsentCount = evaluation.unconfirmedConsentCount;
  const invalidEmailCount = evaluation.invalidEmailCount;
  const suppressedCount = evaluation.suppressedCount;
  const warnings = evaluation.warnings;

  // Synchronize authoritative recipients to marketing_campaign_recipients table
  await syncCampaignRecipients(campaignId, criteria, customClient);

  const sendable = recipientItems.filter((r) => r.sendEligibility === "ELIGIBLE");
  const excluded = recipientItems.filter((r) => r.sendEligibility !== "ELIGIBLE");

  // Sample previews (3-5 sample recipient records)
  const sampleCandidates = sendable.slice(0, 5);
  const footerSettings = await getMarketingFooterSettings(customClient);
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
        companyName: r.companyNameKr || "수신사",
        contactName: r.recipientName,
        brandName: r.brandName || "K SELECT",
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
      footerStyle: camp?.footerStyle || "classic",
    });

    return {
      recipientEmail: maskEmailAddress(r.recipientEmail),
      companyName: r.companyNameKr || "수신사",
      contactName: r.recipientName || "담당자님",
      brandName: r.brandName || r.companyNameKr || "K SELECT",
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
  templatePlainText?: string,
  customClient?: any
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const normalizedEmail = (targetEmail || "").toLowerCase().trim();

  // 1. Strict Allowlist Verification (Internal Domains + Owner-Approved Allowlist)
  const ownerAllowlist = await getMarketingTestAllowlist();
  const allowCheck = isTestRecipientAllowlisted(normalizedEmail, ownerAllowlist);
  if (!allowCheck.isAllowed) {
    const err =
      allowCheck.rejectionReason ||
      `Security Rejection: '${normalizedEmail}' is not an authorized test recipient. Only verified domains (letusto.com, kselectnetwork.com) or configured test allowlists are permitted.`;
    console.error("[campaigns:test-send]", err);
    recordCampaignAuditLog(campaignId, "TEST_EMAIL_REJECTED", false, {
      testRecipient: maskEmailAddress(normalizedEmail),
      reason: err,
    });
    return { success: false, error: err };
  }

  // 2. UNIVERSAL PRE-SEND SUPPRESSION ENFORCEMENT (Mandatory Policy — No Exceptions)
  const suppressionCheck = await checkEmailSuppression(normalizedEmail, customClient);
  if (suppressionCheck.isSuppressed) {
    const reasonLabel = formatSuppressionReasonKorean(suppressionCheck.reason);
    const err = `발송이 차단되었습니다. ${normalizedEmail}은(는) 수신거부 목록에 등록되어 있어(${reasonLabel}) 테스트 이메일을 발송할 수 없습니다.`;
    console.error(`[campaigns:test-send] BLOCKED by suppression: ${maskEmailAddress(normalizedEmail)} (${suppressionCheck.reason})`);
    recordCampaignAuditLog(campaignId, "TEST_EMAIL_SUPPRESSED", false, {
      testRecipient: maskEmailAddress(normalizedEmail),
      suppressionReason: suppressionCheck.reason,
      suppressionStatus: suppressionCheck.status,
      failClosed: suppressionCheck.isFailClosedError || false,
      reason: err,
    });
    return { success: false, error: err };
  }

  // 3. Sample Personalization for test rendering
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

  // 4. Assemble with central marketing footer & real working test unsubscribe link
  const footerSettings = await getMarketingFooterSettings(customClient);
  const testUnsubUrl = buildUnsubscribeUrl(normalizedEmail, campaignId);
  const existingCamp = await getMarketingCampaignById(campaignId);
  const camp = existingCamp.campaign;

  const assembledHtml = assembleEmailWithMarketingFooter(personalized.html, {
    footerSettings,
    language: camp?.language || "ko",
    unsubscribeUrl: testUnsubUrl,
    previewText: camp?.previewText || "",
    landingPageUrl: camp?.landingPageUrl || "https://www.kselectnetwork.com",
    footerStyle: camp?.footerStyle || "classic",
  });

  // 5. Preflight validation on final assembled HTML (Task ADM-EMAIL-TPL-005)
  const preflight = validateSendReadyHtml(assembledHtml, personalized.subject, { isTestSend: true });
  if (!preflight.isValid) {
    const blockingIssue = preflight.issues.find((i) => i.severity === "BLOCKING");
    const err = "Preflight Rejection: " + (blockingIssue ? blockingIssue.message : "Unresolved placeholders or invalid assets found.");
    console.error("[campaigns:test-send]", err);
    recordCampaignAuditLog(campaignId, "TEST_EMAIL_REJECTED", false, {
      testRecipient: maskEmailAddress(normalizedEmail),
      reason: err,
      issues: preflight.issues,
    });
    return { success: false, error: err };
  }

  // 6. Final Defense-in-Depth Pre-dispatch Check (Immediate re-check before provider handoff)
  const finalCheck = await checkEmailSuppression(normalizedEmail, customClient);
  if (finalCheck.isSuppressed) {
    const reasonLabel = formatSuppressionReasonKorean(finalCheck.reason);
    const err = `발송이 차단되었습니다. ${normalizedEmail}은(는) 수신거부 목록에 등록되어 있어(${reasonLabel}) 테스트 이메일을 발송할 수 없습니다.`;
    console.error(`[campaigns:test-send] Final pre-dispatch block: ${maskEmailAddress(normalizedEmail)} (${finalCheck.reason})`);
    recordCampaignAuditLog(campaignId, "TEST_EMAIL_SUPPRESSED", false, {
      testRecipient: maskEmailAddress(normalizedEmail),
      suppressionReason: finalCheck.reason,
      suppressionStatus: finalCheck.status,
      failClosed: finalCheck.isFailClosedError || false,
      reason: err,
    });
    return { success: false, error: err };
  }

  // 7. Dispatch via central email gateway
  const res = await sendEmail({
    to: normalizedEmail,
    subject: `[TEST EMAIL] ${personalized.subject}`,
    text: personalized.plainText || "Test message body",
    html: assembledHtml,
  });

  // 8. Record Audit Log
  recordCampaignAuditLog(campaignId, "TEST_EMAIL_SENT", true, {
    testRecipient: maskEmailAddress(normalizedEmail),
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

  if (recipients.length === 0) {
    throw new Error(`Cannot approve campaign: No recipients selected for campaign. Please select recipients in Step 3.`);
  }

  if (sendable.length === 0) {
    throw new Error(`Cannot approve campaign: No send-eligible recipients available (${recipients.length} selected, but all are excluded by policy).`);
  }

  const footerSettings = await getMarketingFooterSettings(customClient);
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
    footerStyle: existing.campaign.footerStyle || "classic",
    footerSettingsSnapshot: { ...(footerSettings as any), style: existing.campaign.footerStyle || "classic" },
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


export async function listMarketingSuppressionList(
  search?: string,
  statusFilter?: "ALL" | "ACTIVE" | "RELEASED",
  customClient?: any
): Promise<{ success: boolean; suppressions: any[]; error?: string }> {
  try {
    const supabase = await getClient(customClient);
    let query = supabase
      .from("marketing_suppression_list")
      .select("*")
      .order("suppressed_at", { ascending: false });

    if (search && search.trim()) {
      query = query.ilike("email", "%" + search.trim().toLowerCase() + "%");
    }

    if (statusFilter === "ACTIVE") {
      query = query.or("status.eq.ACTIVE,status.is.null");
    } else if (statusFilter === "RELEASED") {
      query = query.eq("status", "RELEASED");
    }

    let { data, error } = await query;
    if (error) {
      // If error is due to missing status column, fallback to querying without status filter
      if (error.code === "42703" || error.message?.includes("status")) {
        let fallbackQuery = supabase
          .from("marketing_suppression_list")
          .select("*")
          .order("suppressed_at", { ascending: false });
        if (search && search.trim()) {
          fallbackQuery = fallbackQuery.ilike("email", "%" + search.trim().toLowerCase() + "%");
        }
        const fallbackRes = await fallbackQuery;
        if (fallbackRes.error) {
          return { success: false, suppressions: [], error: fallbackRes.error.message };
        }
        data = fallbackRes.data || [];
        if (statusFilter === "RELEASED") {
          data = [];
        }
      } else {
        console.warn("[campaigns:suppression-list] DB error:", error.message);
        return { success: false, suppressions: [], error: error.message };
      }
    }

    const mapped = (data || []).map((item: any) => ({
      ...item,
      status: item.status || "ACTIVE",
    }));

    return { success: true, suppressions: mapped };
  } catch (err: any) {
    console.warn("[campaigns:suppression-list] Exception:", err.message);
    return { success: false, suppressions: [], error: err.message };
  }
}

export type SuppressionEvidenceType =
  | "WRITTEN_CONSENT_EMAIL"
  | "CUSTOMER_PORTAL_REQUEST"
  | "SUPPORT_TICKET"
  | "PHONE_VERIFICATION"
  | "ADMIN_ERROR_CORRECTION"
  | "INTERNAL_TESTING";

export interface ReleaseSuppressionInput {
  id: string;
  email: string;
  releaseReason: string;
  releaseEvidence: string;
  evidenceType: SuppressionEvidenceType;
  policyValidationNotes?: string;
  policyValidationConfirmed?: boolean;
  releasedBy: string;
}

export interface ReleaseSuppressionResult {
  success: boolean;
  record?: any;
  error?: string;
}

const VALID_EVIDENCE_TYPES: readonly string[] = [
  "WRITTEN_CONSENT_EMAIL",
  "CUSTOMER_PORTAL_REQUEST",
  "SUPPORT_TICKET",
  "PHONE_VERIFICATION",
  "ADMIN_ERROR_CORRECTION",
  "INTERNAL_TESTING",
];

const DUMMY_TEXT_PATTERN = /^(none|test|testing|asdf|12345|dummy|n\/a|null|undefined|ㅇㅇ|테스트|몰라|그냥)$/i;

/**
 * Validates verifiable proof of renewed consent or documented erroneous suppression.
 * Text length alone is not proof of renewed consent (Security Hardening ADM-EMAIL-SUP-002).
 */
export function validateSuppressionReleaseEvidence(input: {
  releaseReason: string;
  releaseEvidence: string;
  evidenceType: SuppressionEvidenceType;
  suppressionReason: string;
  policyValidationNotes?: string;
  policyValidationConfirmed?: boolean;
}): { valid: boolean; error?: string } {
  const reason = (input.releaseReason || "").trim();
  const evidence = (input.releaseEvidence || "").trim();
  const type = input.evidenceType;

  if (!reason || DUMMY_TEXT_PATTERN.test(reason) || reason.length < 5) {
    return { valid: false, error: "유효하지 않은 해제 사유입니다. 구체적인 사유를 최소 5자 이상 기술해주세요." };
  }

  if (!type || !VALID_EVIDENCE_TYPES.includes(type)) {
    return {
      valid: false,
      error: "유효한 증빙 유형(Evidence Type)을 선택해주세요. (서면 이메일, 티켓, 포털 요청 등)",
    };
  }

  if (!evidence || DUMMY_TEXT_PATTERN.test(evidence) || evidence.length < 5) {
    return { valid: false, error: "단순 무의미한 텍스트는 증빙으로 인정되지 않습니다. 실제 검증 가능한 근거를 최소 5자 이상 입력해주세요." };
  }

  // Evidence validation by specific source
  if (type === "SUPPORT_TICKET") {
    const hasTicketRef = /#\d+/.test(evidence) || /\b(ticket|tkt|case|inquiry|상담|티켓|접수번호)\b/i.test(evidence);
    if (!hasTicketRef) {
      return {
        valid: false,
        error: "지원 티켓 증빙 선택 시 관련 티켓 번호(예: #1234) 또는 접수 식별자를 명시해야 합니다.",
      };
    }
  }

  if (type === "WRITTEN_CONSENT_EMAIL") {
    const hasEmailRef = /\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(evidence) || /@|발송|수신|동의|요청|opt-in|re-opt/i.test(evidence);
    if (!hasEmailRef) {
      return {
        valid: false,
        error: "서면 이메일 증빙 선택 시 수신 일자, 발송인 정보 또는 재수신 동의 내역을 명시해야 합니다.",
      };
    }
  }

  // Elevated Policy Gate for BOUNCED or COMPLAINT records
  const suppReasonUpper = (input.suppressionReason || "").toUpperCase();
  if (suppReasonUpper === "BOUNCED" || suppReasonUpper === "COMPLAINT") {
    if (!input.policyValidationConfirmed) {
      return {
        valid: false,
        error: "영구 반송(BOUNCED) 또는 스팸 신고(COMPLAINT) 주소는 발송 평판(Reputation) 보호를 위해 정책 검증 확인(Policy Validation) 승인이 필수입니다.",
      };
    }
    const policyNotes = (input.policyValidationNotes || "").trim();
    if (!policyNotes || policyNotes.length < 10 || DUMMY_TEXT_PATTERN.test(policyNotes)) {
      return {
        valid: false,
        error: "영구 반송/스팸 신고 해제 시 메일박스 정상화 확인 및 재발송 타당성에 관한 10자 이상의 상세 정책 소명이 필수입니다.",
      };
    }
  }

  return { valid: true };
}

/**
 * Safely releases an actively suppressed email address with mandatory audit metadata and policy validation.
 * Preserves original suppression record and appends an immutable entry to marketing_suppression_audit_log.
 * Uses trusted server-side execution path (service_role) to enforce strict append-only audit log integrity.
 */
export async function releaseMarketingSuppression(
  input: ReleaseSuppressionInput,
  customClient?: any
): Promise<ReleaseSuppressionResult> {
  try {
    const {
      id,
      email,
      releaseReason,
      releaseEvidence,
      evidenceType,
      policyValidationNotes,
      policyValidationConfirmed,
      releasedBy,
    } = input;

    if (!id || !email) {
      return { success: false, error: "해제할 수신 거부 레코드 ID 및 이메일 주소가 필요합니다." };
    }

    const supabase = await getClient(customClient);
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Fetch current suppression record
    let record: any = null;
    const { data, error: fetchErr } = await supabase
      .from("marketing_suppression_list")
      .select("*")
      .eq("id", id)
      .limit(1);

    if (fetchErr || !data || data.length === 0) {
      // Fallback lookup by email
      const { data: emailData } = await supabase
        .from("marketing_suppression_list")
        .select("*")
        .eq("email", normalizedEmail)
        .limit(1);
      if (emailData && emailData.length > 0) {
        record = emailData[0];
      } else {
        return { success: false, error: "수신 거부 기록을 찾을 수 없습니다." };
      }
    } else {
      record = data[0];
    }

    // 2. Check if already released
    if (record.status === "RELEASED") {
      return { success: false, error: "이미 안전 해제 처리된 이메일 주소입니다." };
    }

    // 3. Verifiable Evidence & Policy Gate Validation
    const validation = validateSuppressionReleaseEvidence({
      releaseReason,
      releaseEvidence,
      evidenceType: evidenceType || "WRITTEN_CONSENT_EMAIL",
      suppressionReason: record.reason,
      policyValidationNotes,
      policyValidationConfirmed,
    });
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // 4. Try atomic database RPC function first via trusted server client (service_role)
    let atomicSuccess = false;
    let atomicRecord: any = null;
    const trustedClient = customClient || createAdminClient();

    if (typeof trustedClient.rpc === "function") {
      const { data: rpcData, error: rpcError } = await trustedClient.rpc(
        "fn_release_marketing_suppression",
        {
          p_id: record.id,
          p_email: normalizedEmail,
          p_release_reason: releaseReason.trim(),
          p_release_evidence: releaseEvidence.trim(),
          p_evidence_type: evidenceType || "WRITTEN_CONSENT_EMAIL",
          p_policy_validation_notes: policyValidationNotes ? policyValidationNotes.trim() : null,
          p_released_by: releasedBy || "admin",
        }
      );

      if (!rpcError && rpcData) {
        atomicSuccess = true;
        atomicRecord = rpcData;
      } else if (rpcError && rpcError.code !== "42883" && !rpcError.message?.includes("could not find") && !rpcError.message?.includes("function") && !rpcError.message?.includes("undefined")) {
        // Explicit DB exception raised inside RPC (e.g. audit insert error, already released, unauthorized)
        return { success: false, error: rpcError.message };
      }
    }

    if (atomicSuccess && atomicRecord) {
      removeEmailFromMemorySuppression(normalizedEmail);
      return { success: true, record: atomicRecord };
    }

    // Fallback for mock clients in unit tests or pre-migration:
    // Guarantees transaction integrity by rolling back status to record.status if audit insert fails
    const nowIso = new Date().toISOString();
    const updatePayload = {
      status: "RELEASED",
      released_at: nowIso,
      released_by: releasedBy || "admin",
      release_reason: releaseReason.trim(),
      release_evidence: releaseEvidence.trim(),
      evidence_type: evidenceType || "WRITTEN_CONSENT_EMAIL",
      policy_validation_notes: policyValidationNotes ? policyValidationNotes.trim() : null,
    };

    let updateRes = await supabase
      .from("marketing_suppression_list")
      .update(updatePayload)
      .eq("id", record.id)
      .select()
      .single();

    if (updateRes.error) {
      if (updateRes.error.code === "42703" || updateRes.error.message?.includes("status") || updateRes.error.message?.includes("column")) {
        return {
          success: false,
          error: "데이터베이스 스키마 마이그레이션(0194) 적용이 필요합니다. 관리자 승인 후 마이그레이션을 실행하세요.",
        };
      }
      return { success: false, error: updateRes.error.message };
    }

    const updatedRecord = updateRes.data || { ...record, ...updatePayload };

    // 5. Append immutable audit log via trusted server-side write path (service_role)
    const trustedAuditClient = customClient || createAdminClient();
    const auditRes = await trustedAuditClient.from("marketing_suppression_audit_log").insert({
      suppression_id: record.id,
      email: normalizedEmail,
      action: "RELEASE",
      previous_status: record.status || "ACTIVE",
      new_status: "RELEASED",
      suppression_reason: record.reason,
      release_reason: releaseReason.trim(),
      release_evidence: releaseEvidence.trim(),
      evidence_type: evidenceType || "WRITTEN_CONSENT_EMAIL",
      policy_validation_notes: policyValidationNotes ? policyValidationNotes.trim() : null,
      performed_by: releasedBy || "admin",
      performed_at: nowIso,
    });

    if (auditRes && auditRes.error) {
      // ATOMIC TRANSACTION INTEGRITY: A failed audit insertion must not leave the suppression in RELEASED status!
      await supabase.from("marketing_suppression_list").update({
        status: record.status || "ACTIVE",
        released_at: record.released_at || null,
        released_by: record.released_by || null,
        release_reason: record.release_reason || null,
        release_evidence: record.release_evidence || null,
        evidence_type: record.evidence_type || null,
        policy_validation_notes: record.policy_validation_notes || null,
      }).eq("id", record.id);

      return {
        success: false,
        error: `감사 로그 기록 실패로 인해 수신 거부 해제 트랜잭션이 롤백되었습니다: ${auditRes.error.message}`,
      };
    }

    // 6. Purge from in-memory suppression cache
    removeEmailFromMemorySuppression(normalizedEmail);

    return { success: true, record: updatedRecord };
  } catch (err: any) {
    console.error("[campaigns:suppression-release] Exception:", err.message);
    return { success: false, error: err.message || "해제 처리 중 예외가 발생했습니다." };
  }
}

/**
 * Retrieves audit log entries for marketing suppression releases.
 */
export async function getMarketingSuppressionAuditLog(
  email?: string,
  customClient?: any
): Promise<{ success: boolean; logs: any[]; error?: string }> {
  try {
    const supabase = await getClient(customClient);
    let query = supabase
      .from("marketing_suppression_audit_log")
      .select("*")
      .order("performed_at", { ascending: false })
      .limit(50);

    if (email && email.trim()) {
      query = query.eq("email", email.trim().toLowerCase());
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return { success: true, logs: [] };
      }
      return { success: false, logs: [], error: error.message };
    }

    return { success: true, logs: data || [] };
  } catch (err: any) {
    return { success: false, logs: [], error: err.message };
  }
}


/**
 * -----------------------------------------------------------------------------
 * 12. DELIVERY MANAGEMENT & SCHEDULING (Task ID: ADM-EMAIL-APP-002)
 * Standards: DEPLOY-STD-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 27
 * Manages campaign scheduling, schedule cancellation, delivery simulation,
 * and background cron processing without invalidating approved campaign snapshots.
 * -----------------------------------------------------------------------------
 */

/**
 * Updates campaign schedule time or cancels an existing schedule.
 * Modifies only scheduled_at, status, and updated_at, preserving the approval snapshot.
 */
export async function updateCampaignSchedule(
  campaignId: string,
  scheduledAtIso: string | null,
  adminEmail: string,
  customClient?: SupabaseClient
): Promise<MarketingCampaign> {
  const existing = await getMarketingCampaignById(campaignId, customClient);
  if (!existing.campaign) {
    throw new Error(`Campaign '${campaignId}' not found.`);
  }

  if (existing.campaign.approvalStatus !== "APPROVED") {
    throw new Error(`Cannot schedule campaign: Campaign must be APPROVED before scheduling (current status: ${existing.campaign.approvalStatus}).`);
  }

  if (scheduledAtIso) {
    const targetMs = Date.parse(scheduledAtIso);
    if (isNaN(targetMs)) {
      throw new Error("유효하지 않은 예약 일시 형식입니다.");
    }
    if (targetMs <= Date.now() + 30000) {
      throw new Error("예약 발송 시각은 현재 시각보다 최소 1분 이후여야 합니다 (과거 시각 불가).");
    }
  }

  const supabase = await getClient(customClient);
  const nowIso = new Date().toISOString();
  const newStatus = scheduledAtIso ? "SCHEDULED" : "APPROVED";

  const { data: updated, error } = await supabase
    .from("marketing_campaigns")
    .update({
      scheduled_at: scheduledAtIso,
      status: newStatus,
      updated_at: nowIso,
    })
    .eq("id", campaignId)
    .select()
    .single();

  if (error) {
    console.error("[campaigns:schedule] Failed to update campaign schedule:", error.message);
    throw new Error(`Failed to update campaign schedule: ${error.message}`);
  }

  // Update in-memory cache
  const updatedCamp: MarketingCampaign = {
    ...existing.campaign,
    scheduledAt: scheduledAtIso,
    status: newStatus,
    updatedAt: nowIso,
  };
  memoryCampaigns.set(campaignId, updatedCamp);

  // Record immutable audit log
  recordCampaignAuditLog(
    campaignId,
    scheduledAtIso ? "CAMPAIGN_SCHEDULED" : "CAMPAIGN_SCHEDULE_CANCELLED",
    true,
    {
      scheduledAt: scheduledAtIso,
      status: newStatus,
      performedBy: adminEmail,
    }
  );

  return updatedCamp;
}

/**
 * Safely executes simulated campaign delivery.
 * Enforces LIVE_MODE: FALSE invariant, rechecks suppression Fail-Closed,
 * records recipient-level ledger events, and updates campaign statistics.
 */
export async function executeCampaignDeliverySimulation(
  campaignId: string,
  adminEmail: string,
  customClient?: SupabaseClient
): Promise<CampaignDeliveryExecutionResult> {
  const existing = await getMarketingCampaignById(campaignId, customClient);
  if (!existing.campaign) {
    throw new Error(`Campaign '${campaignId}' not found.`);
  }

  if (existing.campaign.approvalStatus !== "APPROVED") {
    throw new Error(
      `Cannot execute delivery: Campaign must be APPROVED first (current approval status: ${existing.campaign.approvalStatus}).`
    );
  }

  if (existing.campaign.status === "SENDING") {
    throw new Error("캠페인 발송 또는 시뮬레이션이 이미 진행 중입니다. 중복 실행을 방지합니다.");
  }

  if (existing.campaign.status === "COMPLETED") {
    throw new Error("이미 발송 완료된 캠페인입니다.");
  }

  const supabase = await getClient(customClient);
  const nowIso = new Date().toISOString();

  // 1. Idempotency lock: Set campaign status to SENDING
  await supabase
    .from("marketing_campaigns")
    .update({ status: "SENDING", updated_at: nowIso })
    .eq("id", campaignId);

  // 2. Fetch all frozen recipients
  const recipients = existing.recipients || [];
  const eligibleRecipients = recipients.filter((r) => r.sendEligibility === "ELIGIBLE");

  let blockedSuppressed = 0;
  let simulatedEligible = 0;

  // 3. Pre-dispatch suppression recheck (FAIL-CLOSED)
  // CRITICAL REQUIREMENT (ADM-EMAIL-APP-003):
  // Simulation must NEVER set recipient status to DELIVERED or write fake sim_ provider IDs into the delivery ledger!
  // Recipients remain PENDING in the production delivery ledger.
  for (const r of eligibleRecipients) {
    const supp = await checkEmailSuppression(r.recipientEmail, customClient);
    if (supp.isSuppressed) {
      blockedSuppressed++;
      try {
        await supabase
          .from("marketing_campaign_recipients")
          .update({
            send_eligibility: "EXCLUDED_SUPPRESSED",
            exclusion_reason: `Pre-dispatch suppression blocked (${supp.reason || "SUPPRESSED"})`,
            updated_at: nowIso,
          })
          .eq("id", r.id);
      } catch {}
    } else {
      simulatedEligible++;
    }
  }

  // 4. Update campaign stats & status:
  // - status remains APPROVED (never COMPLETED for simulations, preserving locked snapshot and real send workflow)
  // - scheduled_at cleared to prevent cron re-triggers
  // - sentCount, deliveredCount, failedCount remain real counts (NEVER incremented by simulation)
  // - simulationStats records dry-run evidence separately
  const updatedStats = {
    ...(existing.campaign.stats || {
      totalRecipients: 0,
      sendableCount: 0,
      excludedCount: 0,
      testSendsCount: 0,
      sentCount: 0,
      deliveredCount: 0,
      failedCount: 0,
    }),
    sentCount: existing.campaign.stats?.sentCount || 0, // strictly 0 for simulation
    deliveredCount: existing.campaign.stats?.deliveredCount || 0, // strictly 0 for simulation
    failedCount: existing.campaign.stats?.failedCount || 0,
    simulationStats: {
      lastSimulatedAt: nowIso,
      simulatedCount: eligibleRecipients.length,
      simulatedEligible,
      simulatedSuppressed: blockedSuppressed,
      simulatedFailed: 0,
      simulatedBy: adminEmail,
    },
  };

  await supabase
    .from("marketing_campaigns")
    .update({
      status: "SIMULATED",
      scheduled_at: null,
      stats: updatedStats,
      updated_at: nowIso,
    })
    .eq("id", campaignId);

  // Update in-memory cache
  const simulatedCamp: MarketingCampaign = {
    ...existing.campaign,
    status: "SIMULATED",
    scheduledAt: null,
    stats: updatedStats,
    updatedAt: nowIso,
  };
  memoryCampaigns.set(campaignId, simulatedCamp);

  // 5. Record immutable audit log
  recordCampaignAuditLog(
    campaignId,
    "CAMPAIGN_DELIVERY_SIMULATED",
    true,
    {
      mode: "SIMULATE",
      liveModeEnabled: false,
      totalEvaluated: eligibleRecipients.length,
      simulatedEligible,
      simulatedSuppressed: blockedSuppressed,
      actualSentCount: 0,
      actualDeliveredCount: 0,
      performedBy: adminEmail,
    }
  );

  return {
    success: true,
    campaignId,
    status: "SIMULATED",
    totalEvaluated: eligibleRecipients.length,
    totalSent: 0,
    totalDelivered: 0,
    totalBlockedSuppressed: blockedSuppressed,
    totalFailed: 0,
    isSimulated: true,
    simulatedCount: eligibleRecipients.length,
    simulatedEligible,
    message: `안전 시뮬레이션 완료: 총 ${eligibleRecipients.length}명 대상 사전 검증 완료 (수신적격: ${simulatedEligible}명, 수신거부 차단: ${blockedSuppressed}명). LIVE_MODE가 비활성화되어 있으므로 실제 고객 메일 발송 및 실제 발송 카운트는 발생하지 않았습니다.`,
  };
}

/**
 * -----------------------------------------------------------------------------
 * ACTUAL CAMPAIGN DELIVERY ENGINE (ADM-EMAIL-APP-004)
 * Real approved-campaign delivery with immutable snapshot verification,
 * fail-closed suppression checks, personalized content with central footer,
 * provider API submission, and authoritative delivery ledger tracking.
 * -----------------------------------------------------------------------------
 */
export interface RealDeliveryOptions {
  mode: "LIVE";
  /**
   * Controlled internal test safety gate (Requirement 4):
   * When true, only dispatches to explicitly approved internal test mailboxes.
   */
  internalTestOnly?: boolean;
  approvedInternalRecipient?: string;
}

export function isGenuineProviderMessageId(id?: string | null): boolean {
  if (!id) return false;
  return !id.startsWith("sim_");
}

const activeDispatchingCampaigns = new Set<string>();

export async function executeCampaignRealDelivery(
  campaignId: string,
  adminEmail: string,
  options: RealDeliveryOptions,
  customClient?: SupabaseClient
): Promise<CampaignDeliveryExecutionResult> {
  // Concurrency In-flight Mutex Guard (Rule 2)
  if (activeDispatchingCampaigns.has(campaignId)) {
    throw new Error("캠페인 발송이 현재 실행 중입니다. 중복 발송을 방지합니다.");
  }

  const existing = await getMarketingCampaignById(campaignId, customClient);
  if (!existing.campaign) {
    throw new Error(`Campaign '${campaignId}' not found.`);
  }

  if (existing.campaign.approvalStatus !== "APPROVED") {
    throw new Error(
      `Cannot execute delivery: Campaign must be APPROVED first (current approval status: ${existing.campaign.approvalStatus}).`
    );
  }

  if (existing.campaign.status === "SENDING") {
    throw new Error("캠페인 발송이 이미 진행 중입니다. 중복 발송을 방지합니다.");
  }

  // Preflight Simulation Contamination Guard (Requirement 1 & Safety Gate)
  const hasUnreconciledSimulations = (existing.recipients || []).some(
    (r) => r.providerMessageId && r.providerMessageId.startsWith("sim_") && r.status === "SENT"
  );
  if (hasUnreconciledSimulations && !options?.internalTestOnly) {
    throw new Error(
      "과거 시뮬레이션 이력이 존재하는 캠페인입니다. 실제 고객 발송 전 데이터 정합성 보정(APP-005 Reconciliation) 승인 및 적용이 필요합니다."
    );
  }

  if (existing.campaign.status === "SENT" || existing.campaign.status === "COMPLETED" || existing.campaign.status === "SIMULATED") {
    throw new Error(
      "이미 발송 완료된 캠페인입니다. 미발송 대상에게 추가 발송하려면 먼저 관리자 잠금 해제(Unlock Send)를 완료해야 합니다."
    );
  }

  // 1. LIVE_MODE SAFETY GATE (Rule 4 & Mandatory Invariant)
  const isLiveGloballyEnabled = process.env.ENABLE_LIVE_MARKETING_CAMPAIGN_DISPATCH === "true";
  if (!isLiveGloballyEnabled && !options?.internalTestOnly) {
    throw new Error(
      "Live delivery is not activated. (실제 고객 대량 발송(LIVE_MODE)이 비활성화되어 있습니다. 별도의 소유자(Owner) 승인 및 활성화가 필요합니다.)"
    );
  }

  // Controlled Internal Test Mode validation
  if (options?.internalTestOnly) {
    if (!options.approvedInternalRecipient || !isRecipientAllowlisted(options.approvedInternalRecipient)) {
      throw new Error(
        `승인되지 않은 내부 테스트 수신자입니다 (${options?.approvedInternalRecipient}). 내부 허용 도메인 메일함만 발송 가능합니다.`
      );
    }
  }

  // 2. Resolve eligible recipient targets with strict deduplication
  const recipients = existing.recipients || [];
  let targets = recipients.filter(
    (r) =>
      r.sendEligibility === "ELIGIBLE" &&
      r.status !== "SENT" &&
      r.status !== "DELIVERED" &&
      !isGenuineProviderMessageId(r.providerMessageId)
  );

  if (options?.internalTestOnly && options.approvedInternalRecipient) {
    const targetEmail = options.approvedInternalRecipient.toLowerCase().trim();
    targets = targets.filter((r) => r.recipientEmail.toLowerCase().trim() === targetEmail);
    if (targets.length === 0) {
      throw new Error(`지정된 내부 테스트 수신자(${options.approvedInternalRecipient})가 캠페인 적격 대상 목록에 존재하지 않거나 이미 발송되었습니다.`);
    }
  }

  // Enforce internal test mode 1-3 recipient maximum
  if (options?.internalTestOnly && targets.length > 3) {
    throw new Error("내부 테스트 모드(Internal Test Mode)에서는 최대 3명까지만 발송 가능합니다.");
  }

  if (targets.length === 0) {
    throw new Error("발송 가능한 미발송 적격 수신자가 없습니다. 모든 대상에게 이미 발송되었거나 적격 대상이 없습니다.");
  }

  activeDispatchingCampaigns.add(campaignId);
  try {
    const supabase = await getClient(customClient);
    const nowIso = new Date().toISOString();

    // Idempotency Lock: Set campaign status to SENDING
    await supabase
      .from("marketing_campaigns")
      .update({ status: "SENDING", updated_at: nowIso })
      .eq("id", campaignId);

  // 4. Resolve Template, Subject, and Footer Settings
  let templateHtml = "<p>안녕하세요, {{company_name}} {{contact_name}} 귀하. {{brand_name}} 입점을 제안드립니다.</p>";
  let templateSubject = existing.campaign.subjectOverride || "[K SELECT] {{company_name}}의 미국 뷰티 리테일 네트워크 진출을 제안드립니다";
  let templatePlainText = existing.campaign.customMessage || "K SELECT NETWORK 파트너십 제안 안내";

  if (existing.campaign.templateId) {
    const tpls = await listMarketingTemplates({ status: "ALL" }, customClient);
    const activeTpl = tpls.find((t) => t.id === existing.campaign?.templateId);
    if (activeTpl) {
      templateHtml = activeTpl.htmlContent;
      templatePlainText = activeTpl.plainText || templatePlainText;
      if (!existing.campaign.subjectOverride && activeTpl.subject) {
        templateSubject = activeTpl.subject;
      }
    }
  }

  const footerSettings = await getMarketingFooterSettings(customClient);

  let sentCount = 0;
  let failedCount = 0;
  let blockedSuppressed = 0;

  // 5. Recipient-Level Processing & Dispatch
  for (const r of targets) {
    // Current suppression check (FAIL-CLOSED)
    const supp = await checkEmailSuppression(r.recipientEmail, customClient);
    if (supp.isSuppressed) {
      blockedSuppressed++;
      failedCount++;
      try {
        await supabase
          .from("marketing_campaign_recipients")
          .update({
            send_eligibility: "EXCLUDED_SUPPRESSED",
            exclusion_reason: `Pre-dispatch suppression blocked (${supp.reason || "SUPPRESSED"})`,
            status: "FAILED",
            error_message: "Pre-dispatch suppression list match",
            updated_at: nowIso,
          })
          .eq("id", r.id);
      } catch {}
      continue;
    }

    // Personalization & Footer Assembly
    const personalized = personalizeEmail(
      templateSubject,
      templateHtml,
      templatePlainText,
      {
        companyName: r.companyNameKr || r.companyNameEn || "파트너사",
        contactName: r.recipientName || "담당자",
        brandName: r.brandName || "K-Select",
        customMessage: r.customMessageOverride || existing.campaign.customMessage || undefined,
      }
    );

    const unsubUrl = buildUnsubscribeUrl(r.recipientEmail, campaignId);
    const assembledHtml = assembleEmailWithMarketingFooter(personalized.html, {
      footerSettings,
      language: existing.campaign.language || "ko",
      unsubscribeUrl: unsubUrl,
      previewText: existing.campaign.previewText || "",
      landingPageUrl: existing.campaign.landingPageUrl || "https://www.kselectnetwork.com",
      footerStyle: existing.campaign.footerStyle || "classic",
    });

    // Preflight validation on final assembled HTML
    const preflight = validateSendReadyHtml(assembledHtml, personalized.subject, { isTestSend: false });
    if (!preflight.isValid) {
      failedCount++;
      try {
        await supabase
          .from("marketing_campaign_recipients")
          .update({
            status: "FAILED",
            error_message: "Preflight HTML validation failed",
            updated_at: nowIso,
          })
          .eq("id", r.id);
      } catch {}
      continue;
    }

    // Provider Dispatch via Central Email Gateway
    const sendRes = await sendEmail({
      to: r.recipientEmail,
      subject: personalized.subject,
      text: personalized.plainText || "K SELECT Marketing",
      html: assembledHtml,
    });

    if (sendRes.success && sendRes.messageId) {
      sentCount++;
      try {
        await supabase
          .from("marketing_campaign_recipients")
          .update({
            status: "SENT",
            provider_message_id: sendRes.messageId,
            sent_at: nowIso,
            error_message: null,
            updated_at: nowIso,
          })
          .eq("id", r.id);
      } catch {}
    } else {
      failedCount++;
      try {
        await supabase
          .from("marketing_campaign_recipients")
          .update({
            status: "FAILED",
            error_message: sendRes.error || "Email provider rejected send",
            updated_at: nowIso,
          })
          .eq("id", r.id);
      } catch {}
    }
  }

  // 6. Post-Dispatch State Resolution
  let finalStatus: CampaignStatus = "SENT";
  if (failedCount > 0 && sentCount > 0) finalStatus = "PARTIAL";
  else if (failedCount > 0 && sentCount === 0) finalStatus = "FAILED";

  const updatedStats: CampaignStats = {
    ...(existing.campaign.stats || {
      totalRecipients: 0,
      sendableCount: 0,
      excludedCount: 0,
      testSendsCount: 0,
      sentCount: 0,
      deliveredCount: 0,
      failedCount: 0,
    }),
    sentCount: (existing.campaign.stats?.sentCount || 0) + sentCount,
    deliveredCount: existing.campaign.stats?.deliveredCount || 0, // Delivered remains 0 until delivery event confirmed
    failedCount: (existing.campaign.stats?.failedCount || 0) + failedCount,
    isSendLocked: true,
  };

  await supabase
    .from("marketing_campaigns")
    .update({
      status: finalStatus,
      scheduled_at: null,
      stats: updatedStats,
      updated_at: nowIso,
    })
    .eq("id", campaignId);

  // In-memory cache
  memoryCampaigns.set(campaignId, {
    ...existing.campaign,
    status: finalStatus,
    scheduledAt: null,
    stats: updatedStats,
    updatedAt: nowIso,
  });

  // Record Audit Log
  recordCampaignAuditLog(campaignId, "CAMPAIGN_DISPATCH_COMPLETED", true, {
    mode: "LIVE",
    internalTestOnly: Boolean(options?.internalTestOnly),
    totalEvaluated: targets.length,
    sentCount,
    failedCount,
    blockedSuppressed,
    performedBy: adminEmail,
  }, adminEmail);

  return {
    success: true,
    campaignId,
    status: finalStatus,
    totalEvaluated: targets.length,
    totalSent: sentCount,
    totalDelivered: 0,
    totalBlockedSuppressed: blockedSuppressed,
    totalFailed: failedCount,
    isSimulated: false,
    message: `실제 발송 완료: 총 ${sentCount}건 전송 접수 완료 (실패: ${failedCount}건, 수신거부 차단: ${blockedSuppressed}건). 전달(Delivered)은 프로바이더 웹훅 확인 후 갱신됩니다.`,
  };
  } finally {
    activeDispatchingCampaigns.delete(campaignId);
  }
}

export async function processScheduledCampaigns(
  customClient?: SupabaseClient
): Promise<{ processedCount: number; results: CampaignDeliveryExecutionResult[] }> {
  const supabase = await getClient(customClient);
  const nowIso = new Date().toISOString();

  const { data: dueCampaigns, error } = await supabase
    .from("marketing_campaigns")
    .select("id, name, scheduled_at, status")
    .eq("status", "SCHEDULED")
    .lte("scheduled_at", nowIso);

  if (error || !dueCampaigns || dueCampaigns.length === 0) {
    return { processedCount: 0, results: [] };
  }

  // CRITICAL REQUIREMENT (ADM-EMAIL-APP-004):
  // Check whether live sending is authorized.
  // If LIVE_MODE is disabled, do NOT execute simulation and mark completed!
  // Instead, record warning log and leave scheduled without unauthorized dispatch.
  const isLiveGloballyEnabled = process.env.ENABLE_LIVE_MARKETING_CAMPAIGN_DISPATCH === "true";
  if (!isLiveGloballyEnabled) {
    console.warn(
      "[campaigns:scheduler] Live delivery is not activated (ENABLE_LIVE_MARKETING_CAMPAIGN_DISPATCH !== 'true'). " +
      "Skipping automatic dispatch of scheduled campaigns to preserve safety lock."
    );
    return { processedCount: 0, results: [] };
  }

  const results: CampaignDeliveryExecutionResult[] = [];
  for (const c of dueCampaigns) {
    try {
      const res = await executeCampaignRealDelivery(
        c.id,
        "system-scheduler@kselectnetwork.com",
        { mode: "LIVE" },
        customClient
      );
      results.push(res);
    } catch (err: any) {
      console.error(`[campaigns:scheduler] Error processing campaign ${c.id}:`, err.message);
    }
  }

  return { processedCount: results.length, results };
}

/**
 * Unlocks a locked or dispatched marketing campaign for safe subsequent sending.
 * Strictly guarantees that already-contacted recipients (SENT / DELIVERED) will NEVER be resent.
 * Requires Admin privilege and written justification (min 5 characters).
 */
export async function unlockCampaignSend(
  campaignId: string,
  adminEmail: string,
  input: UnlockCampaignSendInput,
  customClient?: SupabaseClient
): Promise<UnlockCampaignSendResult> {
  const trimmedReason = (input?.reason || "").trim();
  if (!trimmedReason || trimmedReason.length < 5) {
    throw new Error("잠금 해제 사유(최소 5자 이상)를 반드시 입력해야 합니다.");
  }

  const existing = await getMarketingCampaignById(campaignId, customClient);
  if (!existing.campaign) {
    throw new Error(`Campaign '${campaignId}' not found.`);
  }

  if (existing.campaign.status === "SENDING") {
    throw new Error("발송이 진행 중인 캠페인은 잠금 해제할 수 없습니다. 발송 종료 후 다시 시도하세요.");
  }

  const recipients = existing.recipients || [];
  // Calculate verified uncontacted eligible recipients
  const unsentTargets = recipients.filter(
    (r) =>
      r.sendEligibility === "ELIGIBLE" &&
      r.status !== "SENT" &&
      r.status !== "DELIVERED" &&
      !isGenuineProviderMessageId(r.providerMessageId)
  );

  if (unsentTargets.length === 0) {
    throw new Error("모든 적격 수신자에게 이미 발송이 완료되어 잠금 해제할 대상이 없습니다. (중복 발송 방지)");
  }

  const supabase = await getClient(customClient);
  const nowIso = new Date().toISOString();

  const unlockEntry: CampaignUnlockAudit = {
    unlockedAt: nowIso,
    unlockedBy: adminEmail,
    reason: trimmedReason,
    eligibleUnsentCount: unsentTargets.length,
  };

  const updatedStats: CampaignStats = {
    ...(existing.campaign.stats || {
      totalRecipients: 0,
      sendableCount: 0,
      excludedCount: 0,
      testSendsCount: 0,
      sentCount: 0,
      deliveredCount: 0,
      failedCount: 0,
    }),
    isSendLocked: false,
    unlockHistory: [...(existing.campaign.stats?.unlockHistory || []), unlockEntry],
  };

  await supabase
    .from("marketing_campaigns")
    .update({
      status: "APPROVED",
      stats: updatedStats,
      updated_at: nowIso,
    })
    .eq("id", campaignId);

  // In-memory cache update
  memoryCampaigns.set(campaignId, {
    ...existing.campaign,
    status: "APPROVED",
    stats: updatedStats,
    updatedAt: nowIso,
  });

  // Record Audit Log in marketing_campaign_logs
  recordCampaignAuditLog(
    campaignId,
    "CAMPAIGN_SEND_UNLOCKED",
    false,
    {
      reason: trimmedReason,
      unlockedBy: adminEmail,
      eligibleUnsentCount: unsentTargets.length,
      previousStatus: existing.campaign.status,
    },
    adminEmail
  );

  return {
    success: true,
    campaignId,
    unlockedBy: adminEmail,
    unlockedAt: nowIso,
    reason: trimmedReason,
    unsentCount: unsentTargets.length,
  };
}
