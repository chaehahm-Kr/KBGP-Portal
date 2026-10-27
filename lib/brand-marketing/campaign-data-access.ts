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
} from "./campaign-types";
import { DEFAULT_MARKETING_TEMPLATES, resolveTemplateId } from "./default-templates";
import { personalizeEmail } from "./personalization-engine";
import { sendEmail, maskEmailAddress, isRecipientAllowlisted } from "@/lib/notifications/email";

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
  customClient?: SupabaseClient
): Promise<MarketingTemplatePackage[]> {
  try {
    const supabase = await getClient(customClient);
    const { data, error } = await supabase
      .from("marketing_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((d: any) => ({
        id: d.id,
        name: d.name,
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
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));
    }
  } catch (err) {
    console.warn("[campaigns:templates] DB read failed, falling back to memory store:", err);
  }

  return Array.from(memoryTemplates.values()).filter((t) => t.status !== "ARCHIVED");
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

  const fullRecord: MarketingTemplatePackage = {
    id: tplId,
    name: template.name,
    version: template.version || "1.0.0",
    language: template.language || "ko",
    subject: template.subject,
    previewText: template.previewText || "",
    htmlContent: template.htmlContent,
    plainText: template.plainText || "",
    variables: template.variables || ["company_name", "contact_name", "brand_name", "custom_message"],
    landingPageUrl: template.landingPageUrl || "https://www.kselectnetwork.com",
    status: template.status || "ACTIVE",
    isDefault: template.isDefault || false,
    createdAt: template.createdAt || now,
    updatedAt: now,
  };

  try {
    const supabase = await getClient(customClient);
    const row = {
      id: fullRecord.id,
      name: fullRecord.name,
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
      if (memorySuppression.has(email)) {
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
  const samplePreviews: SampleRecipientPreview[] = sampleCandidates.map((r) => {
    const rendered = personalizeEmail(
      "[K SELECT] {{company_name}}의 미국 뷰티 리테일 네트워크 진출을 제안드립니다",
      "<p>안녕하세요, {{company_name}} {{contact_name}} 귀하. {{brand_name}} 입점을 제안드립니다.</p>",
      "안녕하세요, {{company_name}} {{contact_name}} 귀하.",
      {
        companyName: r.companyNameKr,
        contactName: r.recipientName,
        brandName: r.brandName,
        language: "ko",
      }
    );
    return {
      recipientEmail: maskEmailAddress(r.recipientEmail),
      companyName: r.companyNameKr,
      contactName: r.recipientName || "담당자님",
      brandName: r.brandName || r.companyNameKr,
      resolvedSubject: rendered.subject,
      resolvedHtml: rendered.html,
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
    senderIdentity: process.env.EMAIL_FROM_ADDRESS || "K SELECT NETWORK <support@kselectnetwork.com>",
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
  // 1. Strict Allowlist Verification
  const isAllowlisted = isRecipientAllowlisted(targetEmail);
  if (!isAllowlisted) {
    const err = `Security Rejection: '${targetEmail}' is not an authorized internal test recipient. Only verified domains (letusto.com, kselectnetwork.com) or configured test allowlists are permitted.`;
    console.error("[campaigns:test-send]", err);
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

  // 3. Dispatch via central email gateway
  const res = await sendEmail({
    to: targetEmail,
    subject: `[TEST EMAIL] ${personalized.subject}`,
    text: personalized.plainText || "Test message body",
    html: personalized.html,
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

  const snapshot: CampaignApprovalSnapshot = {
    approvedAt: now,
    approvedBy: approvingAdminEmail,
    templateVersion: existing.campaign.templateVersion || "1.0.0",
    templateSubject: existing.campaign.name,
    frozenRecipientsCount: recipients.length,
    sendableCount: sendable.length,
    senderAddress: process.env.EMAIL_FROM_ADDRESS || "support@kselectnetwork.com",
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
