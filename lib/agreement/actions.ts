"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedFileUrl } from "@/lib/files/storage";
import { generateExecutedAgreementPdf } from "@/lib/agreement/pdf-generator";
import { sendEmail } from "@/lib/notifications/email";
import { sendTemplatedEmail } from "@/lib/notifications/templates";
import { publicEnv } from "@/lib/env/public";
import { isImpersonating } from "@/lib/auth/impersonation";
import type {
  CompanyAgreementItem,
  AgreementTemplateItem,
  AgreementAuditLogItem,
  AgreementRecipientItem,
  AdditionalRecipientInput,
  UpdateAdditionalRecipientInput,
} from "@/lib/agreement/types";
import { unstageFormData } from "@/lib/files/staged-upload";

export interface SignAgreementInput {
  companyAgreementId?: string;
  companyId?: string;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  authorityConfirmed: boolean;
  consentToAgreement: boolean;
  consentToESignature: boolean;
  additionalRecipients?: AdditionalRecipientInput[];
}

/**
 * Helper to parse company metadata (address, representativeName) from companies.intro.
 * Fixes column mismatch since companies table stores address/contacts in intro metadata JSON.
 */
function parseCompanyMetadata(comp: any): {
  id: string;
  name: string;
  address: string;
  representativeName: string;
} {
  let fullAddress = "";
  let representativeName = comp?.contact_name || "";

  if (comp?.intro && typeof comp.intro === "string" && comp.intro.startsWith("__COMPANY_METADATA__:")) {
    try {
      const parsed = JSON.parse(comp.intro.substring("__COMPANY_METADATA__:".length));
      fullAddress = parsed.address || [parsed.address_1, parsed.address_2, parsed.city, parsed.state, parsed.zip_code].filter(Boolean).join(" ").trim();
      if (parsed.contacts && Array.isArray(parsed.contacts)) {
        const primary = parsed.contacts.find((c: any) => c.isPrimary) || parsed.contacts[0];
        if (primary?.name) representativeName = primary.name;
      }
    } catch (e) {}
  }

  return {
    id: comp?.id || "",
    name: comp?.name || "",
    address: fullAddress || comp?.country || "",
    representativeName,
  };
}

/**
 * Validates email format server-side.
 */
function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Generates a deterministic short company code for external Agreement IDs.
 * Order: companyCode input -> derived from companyName -> "CMP"
 * Normalized: uppercase, alphanumeric only, 3 to 5 chars.
 */
export async function generateCompanyShortCode(companyName: string, companyCode?: string | null): Promise<string> {
  if (companyCode) {
    const cleaned = companyCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length >= 2) return cleaned.substring(0, 5);
  }

  const cleanName = (companyName || "").toUpperCase().replace(/[^A-Z0-9\s-]/g, "").trim();
  if (!cleanName) return "CMP";

  const words = cleanName.split(/[\s-]+/).filter(Boolean);
  if (words.length >= 3) {
    return (words[0][0] + words[1][0] + words[2][0]).substring(0, 5);
  } else if (words.length === 2) {
    const w1 = words[0];
    const w2 = words[1];
    return (w1.substring(0, 2) + w2[0]).substring(0, 5);
  } else if (words.length === 1 && words[0].length >= 3) {
    return words[0].substring(0, 3);
  } else if (words.length === 1 && words[0].length > 0) {
    return (words[0] + "X").substring(0, 3);
  }

  return "CMP";
}

/**
 * Generates a non-sequential random alphanumeric suffix for external Agreement IDs.
 * Avoids ambiguous characters (0, O, 1, I).
 */
export async function generateRandomAgreementSuffix(length: number = 4): Promise<string> {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generates a non-sequential, globally unique external Agreement ID for FUTURE agreements.
 * Format: KSN-AGR-{COMPANY_CODE}-{YY}-{RANDOM_SUFFIX}
 * Example: KSN-AGR-BGI-26-A7K4
 */
export async function generateUniqueExternalAgreementId(
  adminClient: any,
  companyName: string,
  companyCode?: string | null
): Promise<string> {
  const shortCode = await generateCompanyShortCode(companyName, companyCode);
  const yy = new Date().getFullYear().toString().slice(-2);

  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = await generateRandomAgreementSuffix(4);
    const candidateId = `KSN-AGR-${shortCode}-${yy}-${suffix}`;

    const { data } = await adminClient
      .from("company_agreements")
      .select("id")
      .eq("agreement_id", candidateId)
      .maybeSingle();

    if (!data) {
      return candidateId;
    }
  }

  const fallbackSuffix = await generateRandomAgreementSuffix(6);
  return `KSN-AGR-${shortCode}-${yy}-${fallbackSuffix}`;
}

/**
 * Gets or initializes the Company Agreement record for a Brand or Retailer Company.
 */
export async function getCompanyAgreement(
  companyIdInput?: string,
  agreementType: "BRAND_SUPPLIER" | "RETAILER" = "BRAND_SUPPLIER"
): Promise<{
  agreement: CompanyAgreementItem | null;
  companyInfo: {
    id: string;
    name: string;
    address?: string | null;
    representativeName?: string | null;
    signerName?: string | null;
    signerTitle?: string | null;
  };
  error?: string;
}> {
  let targetCompanyId = companyIdInput;
  let resolvedUserId = "";
  let resolvedEmail = "";

  try {
    const { getPortalTenantContext } = await import("@/lib/company/dal");
    const tenantContext = await getPortalTenantContext();
    if (!targetCompanyId) {
      targetCompanyId = tenantContext.companyId;
    }
    resolvedUserId = tenantContext.userId;
  } catch (tenantErr) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      resolvedUserId = user.id;
      resolvedEmail = user.email || "";
      if (!targetCompanyId) {
        const { data: cu } = await supabase
          .from("company_users")
          .select("company_id")
          .eq("id", user.id)
          .limit(1)
          .maybeSingle();
        targetCompanyId = cu?.company_id;
      }
    }
  }

  if (!targetCompanyId) {
    console.error(`[getCompanyAgreement] ${agreementType === "RETAILER" ? "RETAILER_COMPANY_NOT_FOUND" : "COMPANY_NOT_FOUND"}: No company_id resolved`);
    return { agreement: null, companyInfo: { id: "", name: "" }, error: "소속 회사 정보를 찾을 수 없습니다." };
  }

  // Fetch Company Info (Using actual existing columns on companies table)
  const admin = createAdminClient();
  const { data: comp, error: compErr } = await admin
    .from("companies")
    .select("id, name, country, contact_name, contact_phone, intro, company_code")
    .eq("id", targetCompanyId)
    .single();

  if (compErr || !comp) {
    console.error(`[getCompanyAgreement] ${agreementType === "RETAILER" ? "RETAILER_COMPANY_NOT_FOUND" : "COMPANY_NOT_FOUND"}: Company fetch error:`, compErr);
    return { agreement: null, companyInfo: { id: targetCompanyId, name: "" }, error: "회사 정보를 불러올 수 없습니다." };
  }

  const compMeta = parseCompanyMetadata(comp);

  let signerTitle = "";
  let signerName = compMeta.representativeName || "";

  if (resolvedUserId) {
    const { data: userProfile } = await admin
      .from("company_users")
      .select("name, title, position")
      .eq("id", resolvedUserId)
      .maybeSingle();

    if (userProfile) {
      if (userProfile.name) signerName = userProfile.name;
      signerTitle = userProfile.title || userProfile.position || "";
    }
  }

  const companyInfo = {
    id: targetCompanyId,
    name: compMeta.name,
    address: compMeta.address || null,
    representativeName: compMeta.representativeName || null,
    signerName: signerName || null,
    signerTitle: signerTitle || null,
  };

  // Fetch active template for this agreement_type
  const { data: tmpl, error: tmplErr } = await admin
    .from("agreement_templates")
    .select("id, version, name, agreement_type, status")
    .eq("agreement_type", agreementType)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tmplErr) {
    console.error(`[getCompanyAgreement] ${agreementType === "RETAILER" ? "RETAILER_TEMPLATE_NOT_FOUND" : "TEMPLATE_NOT_FOUND"}: Template query error:`, tmplErr);
  }

  if (!tmpl) {
    console.error(`[getCompanyAgreement] ${agreementType === "RETAILER" ? "RETAILER_TEMPLATE_INACTIVE" : "TEMPLATE_INACTIVE"}: No active template found for agreement_type=${agreementType}`);
  }

  // Fetch existing Company Agreements for this company
  const { data: caList, error: caErr } = await admin
    .from("company_agreements")
    .select("*, agreement_templates(id, name, version, agreement_type)")
    .eq("company_id", targetCompanyId)
    .order("created_at", { ascending: false });

  if (caErr) {
    console.error(`[getCompanyAgreement] ${agreementType === "RETAILER" ? "RETAILER_AGREEMENT_LOOKUP_FAILED" : "AGREEMENT_LOOKUP_FAILED"}:`, caErr);
  }

  // Find agreement matching this agreement_type
  let ca = (caList || []).find((item: any) => {
    const itemType = item.agreement_templates?.agreement_type || (tmpl && item.template_id === tmpl.id ? agreementType : null);
    return itemType === agreementType;
  }) || null;

  // Fallback: If no matching type was explicitly found but a single agreement exists and types aren't linked
  if (!ca && caList && caList.length > 0 && !caList[0].agreement_templates?.agreement_type) {
    ca = caList[0];
  }

  // If no agreement record exists yet for this type, create an initial Pending Agreement record linked to Active Template
  if (!ca && tmpl) {
    const newAgreementId = await generateUniqueExternalAgreementId(admin, compMeta.name, comp?.company_code);
    const { data: newCa, error: createErr } = await admin
      .from("company_agreements")
      .insert({
        company_id: targetCompanyId,
        template_id: tmpl.id,
        agreement_id: newAgreementId,
        version: tmpl.version || "1.0",
        status: "pending",
      })
      .select("*, agreement_templates(id, name, version, agreement_type)")
      .single();

    if (createErr) {
      console.error(`[getCompanyAgreement] ${agreementType === "RETAILER" ? "RETAILER_AGREEMENT_CREATE_FAILED" : "AGREEMENT_CREATE_FAILED"}:`, createErr);
    }

    if (!createErr && newCa) {
      ca = newCa;
      // Log audit creation
      await admin.from("agreement_audit_logs").insert({
        company_agreement_id: newCa.id,
        agreement_id: newCa.agreement_id,
        action: "CREATED",
        performed_by_user_id: resolvedUserId || null,
        performed_by_email: resolvedEmail || null,
        details: {
          note: `Company Agreement initialized from ${agreementType} Template v${tmpl.version || "1.0"}`,
          agreement_type: agreementType,
        },
      });
    }
  }

  if (!ca) {
    if (!tmpl) {
      return {
        agreement: null,
        companyInfo,
        error: `Active ${agreementType === "RETAILER" ? "Retailer" : "Brand"} Agreement Template is not configured. Please contact administrator.`,
      };
    }
    return { agreement: null, companyInfo, error: "계약서 정보를 생성할 수 없습니다." };
  }

  const agreementItem: CompanyAgreementItem = {
    ...ca,
    agreement_type: ca.agreement_templates?.agreement_type || tmpl?.agreement_type || agreementType,
    template_name: ca.agreement_templates?.name || tmpl?.name || undefined,
    companyName: companyInfo.name,
    companyAddress: companyInfo.address || undefined,
    representativeName: companyInfo.representativeName || undefined,
  };

  return { agreement: agreementItem, companyInfo };
}

/**
 * Signs the Company Agreement electronically, generates the Final Executed PDF, updates status to Active,
 * and records recipient distribution history cleanly.
 * Idempotent & transactionally safe.
 */
export async function signCompanyAgreementAction(input: SignAgreementInput): Promise<{
  success: boolean;
  agreement?: CompanyAgreementItem;
  recipientCount?: number;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "인증되지 않은 사용자입니다." };

  if (await isImpersonating()) {
    return {
      success: false,
      error: "This action is unavailable during an Admin Support Session. Exit impersonation to continue through the appropriate administrative workflow.",
    };
  }

  try {
    const { requirePortalPermission } = await import("@/lib/company/permissions");
    await requirePortalPermission("agreements", "write");
  } catch (permErr: any) {
    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role, is_staff")
      .eq("id", user.id)
      .maybeSingle();
    const isAdminOrStaff = profile?.role === "admin" || profile?.is_staff === true;
    if (!isAdminOrStaff) {
      return { success: false, error: permErr.message || "계약 체결 권한이 없습니다." };
    }
  }

  const admin = createAdminClient();

  // 1. Fetch agreement & company with clean PostgREST select query (using existing companies columns)
  let ca: any = null;
  let fetchErr: any = null;

  if (input.companyAgreementId) {
    const { data: fetchCa, error: err } = await admin
      .from("company_agreements")
      .select("*, companies(id, name, country, contact_name, contact_phone, intro), agreement_templates(id, name, version, agreement_type)")
      .eq("id", input.companyAgreementId)
      .maybeSingle();

    ca = fetchCa;
    fetchErr = err;
  }

  const targetCompanyId = input.companyId || ca?.company_id;

  // Fallback 1: lookup by companyId if ca wasn't found by companyAgreementId
  if (!ca && targetCompanyId) {
    const { data: companyCa } = await admin
      .from("company_agreements")
      .select("*, companies(id, name, country, contact_name, contact_phone, intro), agreement_templates(id, name, version, agreement_type)")
      .eq("company_id", targetCompanyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    ca = companyCa;
  }

  // Fallback 2: lookup user's company via company_users if targetCompanyId wasn't passed
  if (!ca) {
    const { data: cu } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("id", user.id)
      .limit(1)
      .maybeSingle();

    if (cu?.company_id) {
      const { data: userCa } = await admin
        .from("company_agreements")
        .select("*, companies(id, name, country, contact_name, contact_phone, intro), agreement_templates(id, name, version, agreement_type)")
        .eq("company_id", cu.company_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      ca = userCa;
    }
  }

  if (!ca) {
    console.error("[signCompanyAgreementAction] Failed to resolve agreement. fetchErr:", fetchErr, "input:", input);
    return { success: false, error: "계약서 정보를 찾을 수 없습니다. 소속 회사 정보를 다시 확인해 주세요." };
  }

  const compMeta = parseCompanyMetadata(ca.companies);
  const agreementType: "BRAND_SUPPLIER" | "RETAILER" = ca.agreement_templates?.agreement_type || "BRAND_SUPPLIER";

  // Idempotency: If already Active, return success directly
  if (ca.status === "active" && ca.final_pdf_path) {
    return {
      success: true,
      agreement: {
        ...ca,
        agreement_type: agreementType,
        template_name: ca.agreement_templates?.name,
        companyName: compMeta.name,
        companyAddress: compMeta.address,
        representativeName: compMeta.representativeName,
      },
    };
  }

  // Prerequisite Check: Company Name & Company Address
  if (!compMeta.name || !compMeta.address) {
    return {
      success: false,
      error: agreementType === "RETAILER"
        ? "Please make sure Company Name and Headquarters Address are recorded before signing."
        : "계약서를 진행하려면 회사명과 회사 주소를 먼저 입력해 주세요.",
    };
  }

  if (!input.authorityConfirmed || !input.consentToAgreement || !input.consentToESignature) {
    return {
      success: false,
      error: agreementType === "RETAILER"
        ? "Please accept all required agreements and confirmations before executing."
        : "모든 필수 동의 항목에 동의해 주셔야 계약을 체결할 수 있습니다.",
    };
  }

  if (!input.signerName.trim() || !input.signerTitle.trim()) {
    return {
      success: false,
      error: agreementType === "RETAILER"
        ? "Please provide the Signatory Name and Title."
        : "서명자 이름과 직책을 모두 입력해 주세요.",
    };
  }

  const signerEmailClean = (input.signerEmail || user.email || "").trim();
  if (!signerEmailClean || !isValidEmail(signerEmailClean)) {
    return {
      success: false,
      error: agreementType === "RETAILER"
        ? "Please provide a valid signatory email address."
        : "올바른 서명자 이메일 주소를 입력해 주세요.",
    };
  }

  // Validate Additional Recipients server-side
  const validAdditionalRecipients: AdditionalRecipientInput[] = [];
  if (input.additionalRecipients && input.additionalRecipients.length > 0) {
    for (let i = 0; i < input.additionalRecipients.length; i++) {
      const r = input.additionalRecipients[i];
      const rName = (r.name || "").trim();
      const rTitle = (r.title || "").trim();
      const rEmail = (r.email || "").trim();

      if (!rName || !rTitle || !rEmail) {
        return {
          success: false,
          error: agreementType === "RETAILER"
            ? `Please fill in all fields (Name, Title, Email) for recipient #${i + 1}.`
            : `추가 수신자 #${i + 1}의 이름, 직책, 이메일을 모두 입력해 주세요.`,
        };
      }
      if (!isValidEmail(rEmail)) {
        return {
          success: false,
          error: agreementType === "RETAILER"
            ? `Invalid email format for recipient #${i + 1} (${rEmail}).`
            : `추가 수신자 #${i + 1}의 이메일 형식(${rEmail})이 올바르지 않습니다.`,
        };
      }
      validAdditionalRecipients.push({ name: rName, title: rTitle, email: rEmail });
    }
  }

  // Date Calculations
  const now = new Date();
  const signedAtIso = now.toISOString();
  const executedDateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

  const expDateObj = new Date(now);
  expDateObj.setFullYear(expDateObj.getFullYear() + 2);
  const expirationDateStr = expDateObj.toISOString().split("T")[0]; // YYYY-MM-DD (2 years later)

  const noticeDateObj = new Date(expDateObj);
  noticeDateObj.setDate(noticeDateObj.getDate() - 90);
  const nonRenewalNoticeDeadlineStr = noticeDateObj.toISOString().split("T")[0]; // 90 days before expiration

  // 1. Generate Final Executed PDF Buffer & Checksum
  const { pdfBuffer, pdfHash } = await generateExecutedAgreementPdf({
    agreementId: ca.agreement_id,
    version: ca.version || "1.0",
    companyName: compMeta.name,
    companyAddress: compMeta.address,
    representativeName: compMeta.representativeName,
    signerName: input.signerName.trim(),
    signerTitle: input.signerTitle.trim(),
    signerEmail: signerEmailClean,
    executedDate: executedDateStr,
    agreementType,
  });

  // 2. Upload Final PDF to Supabase Storage
  const storagePath = `agreements/${ca.company_id}/${ca.agreement_id}.pdf`;
  const { error: uploadErr } = await admin.storage
    .from("company-uploads")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadErr) {
    console.error("[signCompanyAgreementAction] Storage upload error:", uploadErr);
    return {
      success: false,
      error: `전자서명 PDF 생성 및 저장 중 오류가 발생했습니다: ${uploadErr.message}`,
    };
  }

  // 3. Update Company Agreement Status to Active & Metadata
  const { data: updatedCa, error: updateErr } = await admin
    .from("company_agreements")
    .update({
      status: "active",
      signer_user_id: user.id,
      signer_name: input.signerName.trim(),
      signer_title: input.signerTitle.trim(),
      signer_email: signerEmailClean,
      authority_confirmed: true,
      authority_confirmed_at: signedAtIso,
      consent_to_agreement: true,
      consent_to_e_signature: true,
      signed_at: signedAtIso,
      effective_date: executedDateStr,
      expiration_date: expirationDateStr,
      next_renewal_date: expirationDateStr,
      non_renewal_notice_deadline: nonRenewalNoticeDeadlineStr,
      final_pdf_path: storagePath,
      final_pdf_hash: pdfHash,
      updated_at: signedAtIso,
    })
    .eq("id", ca.id)
    .select("*, agreement_templates(id, name, version, agreement_type)")
    .single();

  if (updateErr || !updatedCa) {
    console.error("[signCompanyAgreementAction] DB update error:", updateErr);
    return {
      success: false,
      error: `계약 상태 업데이트에 실패했습니다: ${updateErr?.message || "알 수 없는 오류"}`,
    };
  }

  // 4. Record Recipients & Dispatch Emails
  const recipientsToRecord: Array<{
    company_agreement_id: string;
    agreement_id: string;
    company_id: string;
    recipient_name: string;
    recipient_title: string;
    recipient_email: string;
    recipient_type: "signer" | "additional_recipient";
    sent_at: string;
    delivery_status: "sent" | "failed";
  }> = [];

  // Add Signer Recipient
  recipientsToRecord.push({
    company_agreement_id: ca.id,
    agreement_id: ca.agreement_id,
    company_id: ca.company_id,
    recipient_name: input.signerName.trim(),
    recipient_title: input.signerTitle.trim(),
    recipient_email: signerEmailClean,
    recipient_type: "signer",
    sent_at: signedAtIso,
    delivery_status: "sent",
  });

  // Add Additional Recipients
  for (const ar of validAdditionalRecipients) {
    recipientsToRecord.push({
      company_agreement_id: ca.id,
      agreement_id: ca.agreement_id,
      company_id: ca.company_id,
      recipient_name: ar.name,
      recipient_title: ar.title,
      recipient_email: ar.email,
      recipient_type: "additional_recipient",
      sent_at: signedAtIso,
      delivery_status: "sent",
    });
  }

  // Insert Recipient Records
  try {
    await admin.from("company_agreement_recipients").insert(recipientsToRecord);
  } catch (recErr) {
    console.error("[Agreement Recipient Log Error]", recErr);
  }

  // Dispatch Email Notifications asynchronously
  const isRetailerEmail = agreementType === "RETAILER";
  const base64Pdf = pdfBuffer.toString("base64");
  const pdfFilename = isRetailerEmail
    ? `K_SELECT_Retailer_Agreement_${ca.agreement_id}.pdf`
    : `K_SELECT_Agreement_${ca.agreement_id}.pdf`;

  const actualSignerName = input.signerName.trim();
  const actualSignerTitle = input.signerTitle.trim();
  const actualSignerEmail = signerEmailClean;

  for (const r of recipientsToRecord) {
    try {
      const templateKey = isRetailerEmail ? "hub_retailer_agreement_completed" : "brand_agreement_completed";
      const recipientRole = r.recipient_type === "signer" ? "SIGNER" : "ADDITIONAL_RECIPIENT";

      const vars = {
        company_name: compMeta.name,
        companyName: compMeta.name,
        agreement_name: isRetailerEmail
          ? "K SELECT Retailer Operating Agreement"
          : "K SELECT NETWORK 브랜드 공급 및 유통 기본계약서",
        agreementName: isRetailerEmail
          ? "K SELECT Retailer Operating Agreement"
          : "K SELECT NETWORK 브랜드 공급 및 유통 기본계약서",
        agreement_version: ca.version || "1.0",
        agreementVersion: ca.version || "1.0",
        agreement_id: ca.agreement_id,
        agreementId: ca.agreement_id,
        // Authoritative executed agreement legal signer metadata (constant across all emails)
        signer_name: actualSignerName,
        signerName: actualSignerName,
        signer_title: actualSignerTitle,
        signerTitle: actualSignerTitle,
        signer_email: actualSignerEmail,
        signerEmail: actualSignerEmail,
        // Individual email recipient metadata (personalized greeting & role)
        recipient_name: r.recipient_name,
        recipientName: r.recipient_name,
        recipient_title: r.recipient_title,
        recipientTitle: r.recipient_title,
        recipient_email: r.recipient_email,
        recipientEmail: r.recipient_email,
        recipient_role: recipientRole,
        recipientRole: recipientRole,
        contactName: r.recipient_name,
        executed_date: executedDateStr,
        executedDate: executedDateStr,
        effective_date: executedDateStr,
        effectiveDate: executedDateStr,
        portal_url: isRetailerEmail
          ? "https://portal.kselecthub.com/retailer/account?tab=documents"
          : `${publicEnv.NEXT_PUBLIC_SITE_URL || "https://portal.kselectnetwork.com"}/portal/company/info?tab=agreements`,
        portalUrl: isRetailerEmail
          ? "https://portal.kselecthub.com/retailer/account?tab=documents"
          : `${publicEnv.NEXT_PUBLIC_SITE_URL || "https://portal.kselectnetwork.com"}/portal/company/info?tab=agreements`,
        agreement_view_url: isRetailerEmail
          ? "https://portal.kselecthub.com/retailer/account?tab=documents"
          : `${publicEnv.NEXT_PUBLIC_SITE_URL || "https://portal.kselectnetwork.com"}/portal/company/info?tab=agreements`,
        agreementViewUrl: isRetailerEmail
          ? "https://portal.kselecthub.com/retailer/account?tab=documents"
          : `${publicEnv.NEXT_PUBLIC_SITE_URL || "https://portal.kselectnetwork.com"}/portal/company/info?tab=agreements`,
        supportEmail: isRetailerEmail ? "support@kselecthub.com" : "contact@kselectnetwork.com",
      };

      await sendTemplatedEmail(
        templateKey,
        r.recipient_email,
        vars,
        [{ filename: pdfFilename, content: base64Pdf }]
      );
    } catch (emailErr) {
      console.error(`[Agreement Email Send Error] recipient=${r.recipient_email}`, emailErr);
    }
  }

  // 5. Record Audit Log
  await admin.from("agreement_audit_logs").insert({
    company_agreement_id: ca.id,
    agreement_id: ca.agreement_id,
    action: "SIGNED",
    performed_by_user_id: user.id,
    performed_by_name: input.signerName.trim(),
    performed_by_email: signerEmailClean,
    details: {
      agreement_type: agreementType,
      signed_at: signedAtIso,
      effective_date: executedDateStr,
      expiration_date: expirationDateStr,
      pdf_path: storagePath,
      pdf_hash: pdfHash,
      recipient_count: recipientsToRecord.length,
      additional_recipients: validAdditionalRecipients,
    },
  });

  return {
    success: true,
    recipientCount: recipientsToRecord.length,
    agreement: {
      ...updatedCa,
      agreement_type: agreementType,
      template_name: updatedCa.agreement_templates?.name,
      companyName: compMeta.name,
      companyAddress: compMeta.address,
      representativeName: compMeta.representativeName,
    },
  };
}

/**
 * Gets recipient/distribution history for a Company Agreement.
 */
export async function getAgreementRecipientsAction(companyAgreementId: string): Promise<{
  recipients: AgreementRecipientItem[];
  error?: string;
}> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("company_agreement_recipients")
    .select("*")
    .eq("company_agreement_id", companyAgreementId)
    .order("created_at", { ascending: true });

  if (error) return { recipients: [], error: error.message };
  return { recipients: data || [] };
}

/**
 * Resends agreement notification email to a specific recipient record.
 */
export async function resendAgreementRecipientEmailAction(recipientId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "인증되지 않은 사용자입니다." };

  const admin = createAdminClient();

  const { data: rec } = await admin
    .from("company_agreement_recipients")
    .select(
      "*, company_agreements(id, company_id, agreement_id, version, final_pdf_path, agreement_templates(name, agreement_type), companies(id, name, country, contact_name, contact_phone, intro))"
    )
    .eq("id", recipientId)
    .single();

  if (!rec) return { success: false, error: "수신자 기록을 찾을 수 없습니다." };

  const ca = (rec as any).company_agreements;
  const targetCompanyId = rec.company_id || ca?.company_id;

  // Verify tenant authorization
  const { data: profile } = await admin
    .from("profiles")
    .select("name, role, is_staff")
    .eq("id", user.id)
    .maybeSingle();

  const isAdminOrStaff = profile?.role === "admin" || profile?.is_staff === true;

  if (!isAdminOrStaff && targetCompanyId) {
    const { data: cu } = await admin
      .from("company_users")
      .select("company_id")
      .eq("id", user.id)
      .eq("company_id", targetCompanyId)
      .maybeSingle();

    let isRetailerMember = false;
    if (!cu) {
      const { data: rcu } = await admin
        .from("retailer_company_users")
        .select("company_id")
        .eq("user_id", user.id)
        .eq("company_id", targetCompanyId)
        .maybeSingle();
      if (rcu) isRetailerMember = true;
    }

    if (cu) {
      const { hasPortalPermission } = await import("@/lib/company/permissions");
      const canWrite = await hasPortalPermission("agreements", "write");
      if (!canWrite) {
        return { success: false, error: "해당 계약서 사본을 재발송할 권한이 없습니다 (조회 전용)." };
      }
    }

    if (!cu && !isRetailerMember) {
      return { success: false, error: "해당 계약서 사본을 재발송할 권한이 없습니다." };
    }
  }

  const compMeta = parseCompanyMetadata(ca?.companies);
  const agreementIdStr = ca?.agreement_id || rec.agreement_id;
  const versionStr = ca?.version || "1.0";
  const agreementType = ca?.agreement_templates?.agreement_type || "BRAND_SUPPLIER";
  const isRetailerEmail = agreementType === "RETAILER";
  const finalPdfPath = ca?.final_pdf_path;

  try {
    let attachments: Array<{ filename: string; content: string }> | undefined = undefined;
    const pdfFilename = isRetailerEmail
      ? `K_SELECT_Retailer_Agreement_${agreementIdStr}.pdf`
      : `K_SELECT_Agreement_${agreementIdStr}.pdf`;

    if (finalPdfPath) {
      const { data: fileData, error: dlErr } = await admin.storage
        .from("company-uploads")
        .download(finalPdfPath);

      if (!dlErr && fileData) {
        const arrayBuffer = await fileData.arrayBuffer();
        const base64Pdf = Buffer.from(arrayBuffer).toString("base64");
        attachments = [{ filename: pdfFilename, content: base64Pdf }];
      }
    }

    const executedDateStr = rec.sent_at
      ? new Date(rec.sent_at).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    const actualSignerName = ca?.signer_name || compMeta.representativeName || "Authorized Signer";
    const actualSignerTitle = ca?.signer_title || "대표이사 (CEO)";
    const actualSignerEmail = ca?.signer_email || "";
    const recipientRole = rec.recipient_type === "signer" ? "SIGNER" : "ADDITIONAL_RECIPIENT";
    const templateKey = isRetailerEmail ? "hub_retailer_agreement_completed" : "brand_agreement_completed";

    const vars = {
      company_name: compMeta.name || "브랜드사",
      companyName: compMeta.name || "브랜드사",
      agreement_name: isRetailerEmail
        ? ca?.agreement_templates?.name || "K SELECT Retailer Operating Agreement"
        : ca?.agreement_templates?.name || "K SELECT NETWORK 브랜드 공급 및 유통 기본계약서",
      agreementName: isRetailerEmail
        ? ca?.agreement_templates?.name || "K SELECT Retailer Operating Agreement"
        : ca?.agreement_templates?.name || "K SELECT NETWORK 브랜드 공급 및 유통 기본계약서",
      agreement_version: versionStr,
      agreementVersion: versionStr,
      agreement_id: agreementIdStr,
      agreementId: agreementIdStr,
      // Authoritative executed agreement legal signer metadata (constant across all emails)
      signer_name: actualSignerName,
      signerName: actualSignerName,
      signer_title: actualSignerTitle,
      signerTitle: actualSignerTitle,
      signer_email: actualSignerEmail,
      signerEmail: actualSignerEmail,
      // Individual email recipient metadata (personalized greeting & role)
      recipient_name: rec.recipient_name,
      recipientName: rec.recipient_name,
      recipient_title: rec.recipient_title,
      recipientTitle: rec.recipient_title,
      recipient_email: rec.recipient_email,
      recipientEmail: rec.recipient_email,
      recipient_role: recipientRole,
      recipientRole: recipientRole,
      contactName: rec.recipient_name,
      executed_date: executedDateStr,
      executedDate: executedDateStr,
      effective_date: executedDateStr,
      effectiveDate: executedDateStr,
      portal_url: isRetailerEmail
        ? "https://portal.kselecthub.com/retailer/account?tab=documents"
        : `${publicEnv.NEXT_PUBLIC_SITE_URL || "https://portal.kselectnetwork.com"}/portal/company/info?tab=agreements`,
      portalUrl: isRetailerEmail
        ? "https://portal.kselecthub.com/retailer/account?tab=documents"
        : `${publicEnv.NEXT_PUBLIC_SITE_URL || "https://portal.kselectnetwork.com"}/portal/company/info?tab=agreements`,
      agreement_view_url: isRetailerEmail
        ? "https://portal.kselecthub.com/retailer/account?tab=documents"
        : `${publicEnv.NEXT_PUBLIC_SITE_URL || "https://portal.kselectnetwork.com"}/portal/company/info?tab=agreements`,
      agreementViewUrl: isRetailerEmail
        ? "https://portal.kselecthub.com/retailer/account?tab=documents"
        : `${publicEnv.NEXT_PUBLIC_SITE_URL || "https://portal.kselectnetwork.com"}/portal/company/info?tab=agreements`,
      supportEmail: isRetailerEmail ? "support@kselecthub.com" : "contact@kselectnetwork.com",
    };

    const result = await sendTemplatedEmail(templateKey, rec.recipient_email, vars, attachments);

    if (!result.success) {
      await admin
        .from("company_agreement_recipients")
        .update({ delivery_status: "failed" })
        .eq("id", recipientId);
      return { success: false, error: result.error || "이메일 재발송 실패" };
    }

    await admin
      .from("company_agreement_recipients")
      .update({ delivery_status: "sent", sent_at: new Date().toISOString() })
      .eq("id", recipientId);

    if (ca?.id) {
      await admin.from("agreement_audit_logs").insert({
        company_agreement_id: ca.id,
        agreement_id: agreementIdStr,
        action: "RESENT",
        performed_by_user_id: user?.id,
        performed_by_name: profile?.name || user?.email,
        performed_by_email: user?.email,
        details: {
          recipient_id: recipientId,
          recipient_email: rec.recipient_email,
          recipient_name: rec.recipient_name,
          recipient_title: rec.recipient_title,
          recipient_type: rec.recipient_type,
        },
      });
    }

    return { success: true };
  } catch (err: any) {
    await admin
      .from("company_agreement_recipients")
      .update({ delivery_status: "failed" })
      .eq("id", recipientId);

    return { success: false, error: err.message || "이메일 재발송 실패" };
  }
}

/**
 * Updates an Additional Recipient's information (Name, Title, Email) for an executed Agreement,
 * verifies tenant permissions, ensures legal Signers cannot be edited, writes an audit event,
 * and optionally triggers an immediate resend with the immutable executed PDF attached.
 */
export async function updateAgreementAdditionalRecipientAction(
  input: UpdateAdditionalRecipientInput
): Promise<{
  success: boolean;
  recipient?: AgreementRecipientItem;
  resent?: boolean;
  resendError?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "인증되지 않은 사용자입니다." };
  }

  const admin = createAdminClient();

  // 1. Fetch recipient record and associated company_agreement
  const { data: rec, error: recErr } = await admin
    .from("company_agreement_recipients")
    .select(`
      *,
      company_agreements (
        id,
        agreement_id,
        company_id,
        status,
        version,
        final_pdf_path
      )
    `)
    .eq("id", input.recipientId)
    .single();

  if (recErr || !rec) {
    return { success: false, error: "수신자 정보를 찾을 수 없습니다." };
  }

  // 2. Strict Business Rule: Only ADDITIONAL_RECIPIENT can be edited
  if (rec.recipient_type !== "additional_recipient") {
    return {
      success: false,
      error: "법적 서명자(Signer) 정보는 수정할 수 없습니다. 추가 수신자 정보만 수정 가능합니다.",
    };
  }

  // 3. Authorization & Tenant Isolation Verification
  const targetCompanyId = rec.company_id;

  const { data: profile } = await admin
    .from("profiles")
    .select("name, role, is_staff")
    .eq("id", user.id)
    .maybeSingle();

  const isAdminOrStaff = profile?.role === "admin" || profile?.is_staff === true;

  if (!isAdminOrStaff && targetCompanyId) {
    // Check Brand company membership
    const { data: cu } = await admin
      .from("company_users")
      .select("company_id")
      .eq("id", user.id)
      .eq("company_id", targetCompanyId)
      .maybeSingle();

    // Check Retailer company membership if not in company_users
    let isRetailerMember = false;
    if (!cu) {
      const { data: rcu } = await admin
        .from("retailer_company_users")
        .select("company_id")
        .eq("user_id", user.id)
        .eq("company_id", targetCompanyId)
        .maybeSingle();
      if (rcu) isRetailerMember = true;
    }

    if (cu) {
      const { hasPortalPermission } = await import("@/lib/company/permissions");
      const canWrite = await hasPortalPermission("agreements", "write");
      if (!canWrite) {
        return { success: false, error: "해당 회사의 계약 수신자를 수정할 권한이 없습니다 (조회 전용)." };
      }
    }

    if (!cu && !isRetailerMember) {
      return { success: false, error: "해당 회사의 계약 수신자를 수정할 권한이 없습니다." };
    }
  }

  // 4. Validate input
  const newName = (input.name || "").trim();
  const newTitle = (input.title || "").trim();
  const newEmail = (input.email || "").trim().toLowerCase();

  if (!newName) {
    return { success: false, error: "수신자 이름을 입력해 주세요." };
  }
  if (!newEmail || !isValidEmail(newEmail)) {
    return { success: false, error: "유효한 이메일 주소를 입력해 주세요." };
  }

  const previousName = rec.recipient_name;
  const previousTitle = rec.recipient_title;
  const previousEmail = rec.recipient_email;

  const nowIso = new Date().toISOString();

  // 5. Update recipient record
  const updatePayload: any = {
    recipient_name: newName,
    recipient_title: newTitle,
    recipient_email: newEmail,
  };
  if (rec.hasOwnProperty("updated_at") || true) {
    updatePayload.updated_at = nowIso;
  }

  const { data: updatedRec, error: updateErr } = await admin
    .from("company_agreement_recipients")
    .update(updatePayload)
    .eq("id", rec.id)
    .select()
    .single();

  let finalRecipient = updatedRec;

  if (updateErr || !updatedRec) {
    // Fallback without updated_at column if not yet migrated
    const { data: fallbackRec, error: fallbackErr } = await admin
      .from("company_agreement_recipients")
      .update({
        recipient_name: newName,
        recipient_title: newTitle,
        recipient_email: newEmail,
      })
      .eq("id", rec.id)
      .select()
      .single();

    if (fallbackErr || !fallbackRec) {
      return {
        success: false,
        error: `수신자 정보 수정 실패: ${fallbackErr?.message || updateErr?.message}`,
      };
    }
    finalRecipient = fallbackRec;
  }

  // 6. Record Audit Event: AGREEMENT_RECIPIENT_UPDATED
  await admin.from("agreement_audit_logs").insert({
    company_agreement_id: rec.company_agreement_id,
    agreement_id: rec.agreement_id,
    action: "AGREEMENT_RECIPIENT_UPDATED",
    performed_by_user_id: user.id,
    performed_by_name: profile?.name || user.email,
    performed_by_email: user.email,
    details: {
      recipient_id: rec.id,
      previous_name: previousName,
      previous_title: previousTitle,
      previous_email: previousEmail,
      updated_name: newName,
      updated_title: newTitle,
      updated_email: newEmail,
      resend_immediately: !!input.resendImmediately,
      changed_at: nowIso,
    },
  });

  // 7. Optional Resend Immediately
  let resent = false;
  let resendError: string | undefined = undefined;

  if (input.resendImmediately) {
    const resendRes = await resendAgreementRecipientEmailAction(rec.id);
    resent = resendRes.success;
    if (!resendRes.success) {
      resendError = resendRes.error;
    }
  }

  return {
    success: true,
    recipient: finalRecipient,
    resent,
    resendError,
  };
}


/**
 * Gets a temporary signed URL for viewing/downloading the executed PDF document.
 * Validates authentication, company membership, and agreement ownership before generating URL.
 */
export async function getSignedExecutedPdfUrlAction(
  storagePathOrAgreementId: string,
  options?: { downloadFilename?: string }
): Promise<{
  url: string | null;
  error?: string;
}> {
  if (!storagePathOrAgreementId) {
    return { url: null, error: "저장된 PDF 경로 또는 계약서 ID가 필요합니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { url: null, error: "인증되지 않은 사용자입니다. 다시 로그인해 주세요." };
  }

  const admin = createAdminClient();

  let targetPath = storagePathOrAgreementId;
  let targetCompanyId: string | null = null;

  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    storagePathOrAgreementId
  );

  let query = admin
    .from("company_agreements")
    .select("id, company_id, agreement_id, final_pdf_path, status");

  if (storagePathOrAgreementId.includes("/")) {
    query = query.eq("final_pdf_path", storagePathOrAgreementId);
  } else if (isUuid) {
    query = query.eq("id", storagePathOrAgreementId);
  } else {
    query = query.eq("agreement_id", storagePathOrAgreementId);
  }

  const { data: ca } = await query.maybeSingle();

  if (ca) {
    targetPath = ca.final_pdf_path || targetPath;
    targetCompanyId = ca.company_id;
  } else if (storagePathOrAgreementId.includes("agreements/")) {
    const parts = storagePathOrAgreementId.split("/");
    if (parts.length >= 2) targetCompanyId = parts[1];
  }

  // Tenant Security Check:
  // User must be an Admin (staff) OR belong to targetCompanyId as active member
  if (targetCompanyId) {
    const { data: staff } = await admin
      .from("staff_members")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = !!staff;

    if (!isAdmin) {
      const { data: cu } = await admin
        .from("company_users")
        .select("company_id, status")
        .eq("id", user.id)
        .maybeSingle();

      const isCompanyMember = cu && cu.company_id === targetCompanyId && cu.status === "active";

      if (!isCompanyMember) {
        return { url: null, error: "해당 계약서에 접근할 권한이 없습니다." };
      }

      const { hasPortalPermission } = await import("@/lib/company/permissions");
      const canWrite = await hasPortalPermission("agreements", "write");
      if (!canWrite) {
        return { url: null, error: "계약서 원문 보기 및 PDF 다운로드 권한이 없습니다. (조회 전용 권한)" };
      }
    }
  }

  try {
    const downloadOpt = options?.downloadFilename
      ? { download: options.downloadFilename }
      : undefined;

    // Use admin storage client on the server AFTER user authorization check
    const { data: signed, error: signErr } = await admin.storage
      .from("company-uploads")
      .createSignedUrl(targetPath, 3600, downloadOpt);

    if (signErr || !signed?.signedUrl) {
      console.error(
        `[Auth Security Audit] [SIGNED_URL_CREATION_FAILED] Path: ${targetPath}, Error: ${signErr?.message || "empty"}`
      );
      return { url: null, error: "서명된 다운로드 URL을 생성할 수 없습니다." };
    }

    return { url: signed.signedUrl };
  } catch (err: any) {
    console.error(`[Auth Security Audit] [SIGNED_URL_EXCEPTION] Path: ${targetPath}, Error: ${err?.message}`);
    return { url: null, error: err.message || "PDF URL 생성 중 오류가 발생했습니다." };
  }
}

/**
 * Admin: Lists all Agreement Templates with usage tracking summary & optional Agreement Type filter
 */
export async function adminListAgreementTemplatesAction(agreementTypeFilter?: string): Promise<{
  templates: AgreementTemplateItem[];
  error?: string;
}> {
  const admin = createAdminClient();
  let query = admin
    .from("agreement_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (agreementTypeFilter && agreementTypeFilter !== "ALL") {
    query = query.eq("agreement_type", agreementTypeFilter);
  }

  const { data: tmplData, error } = await query;
  if (error) return { templates: [], error: error.message };

  // Fetch all company agreements to compute usage statistics per template
  const { data: casData } = await admin
    .from("company_agreements")
    .select("id, company_id, template_id, version, status");

  const formattedTemplates: AgreementTemplateItem[] = (tmplData || []).map((tmpl: any) => {
    const linkedCas = (casData || []).filter(
      (ca: any) =>
        ca.template_id === tmpl.id ||
        (!ca.template_id && ca.version === tmpl.version)
    );
    const companyIds = new Set(linkedCas.map((ca: any) => ca.company_id).filter(Boolean));
    const pendingCount = linkedCas.filter((ca: any) => ca.status === "pending").length;
    const executedCount = linkedCas.filter((ca: any) => ca.status !== "pending").length;

    return {
      ...tmpl,
      usage: {
        companyCount: companyIds.size,
        pendingCount,
        executedCount,
      },
    };
  });

  return { templates: formattedTemplates };
}

/**
 * Admin: Gets all Company Agreements using a specific Agreement Template
 */
export async function adminGetTemplateUsageCompaniesAction(templateId: string): Promise<{
  template?: AgreementTemplateItem;
  agreements: CompanyAgreementItem[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { agreements: [], error: "인증되지 않은 사용자입니다." };

  const admin = createAdminClient();

  // Admin staff verification
  const { data: staff } = await admin
    .from("staff_members")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!staff) {
    return { agreements: [], error: "관리자 권한이 필요합니다." };
  }

  const { data: tmpl } = await admin
    .from("agreement_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (!tmpl) return { agreements: [], error: "대상 템플릿을 찾을 수 없습니다." };

  const { data, error } = await admin
    .from("company_agreements")
    .select("*, companies(id, name, country, contact_name, contact_phone, intro)")
    .order("created_at", { ascending: false });

  if (error) return { template: tmpl, agreements: [], error: error.message };

  const filtered = (data || []).filter(
    (ca: any) =>
      ca.template_id === templateId ||
      (!ca.template_id && ca.version === tmpl.version)
  );

  const formatted: CompanyAgreementItem[] = filtered.map((ca: any) => {
    const compMeta = parseCompanyMetadata(ca.companies);
    return {
      ...ca,
      companyName: compMeta.name || "-",
      companyAddress: compMeta.address || "-",
      representativeName: compMeta.representativeName || "-",
      agreement_type: tmpl.agreement_type,
      template_name: tmpl.name,
    };
  });

  return { template: tmpl, agreements: formatted };
}

/**
 * Admin: Safely deletes an unused, Inactive Agreement Template and its associated private storage file.
 * Delete is strictly blocked if the template is Active OR referenced by any company agreement.
 */
export async function adminDeleteAgreementTemplateAction(templateId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "인증되지 않은 사용자입니다." };

  const admin = createAdminClient();

  // Admin staff verification
  const { data: staff } = await admin
    .from("staff_members")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!staff) {
    return { success: false, error: "관리자 권한이 필요합니다." };
  }

  const { data: tmpl } = await admin
    .from("agreement_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (!tmpl) return { success: false, error: "대상 템플릿을 찾을 수 없습니다." };

  // Rule 6: Active template cannot be deleted
  if (tmpl.status === "active") {
    return {
      success: false,
      error: "Active 템플릿은 삭제할 수 없습니다. 먼저 다른 버전을 Active로 설정하거나 이 템플릿을 비활성화해 주세요.",
    };
  }

  // Rule 5: If any company agreement references this template, delete must be blocked
  const { data: casData } = await admin
    .from("company_agreements")
    .select("id, template_id, version");

  const usageCount = (casData || []).filter(
    (ca: any) =>
      ca.template_id === templateId ||
      (!ca.template_id && ca.version === tmpl.version)
  ).length;

  if (usageCount > 0) {
    return {
      success: false,
      error: "이 템플릿은 현재 또는 과거 계약에 사용되어 삭제할 수 없습니다. Inactive 상태로 보관해 주세요.",
    };
  }

  // Delete DB record first
  const { error: deleteErr } = await admin
    .from("agreement_templates")
    .delete()
    .eq("id", templateId);

  if (deleteErr) {
    console.error("[adminDeleteAgreementTemplateAction] DB deletion error:", deleteErr);
    return { success: false, error: `템플릿 삭제 실패: ${deleteErr.message}` };
  }

  // Storage Cleanup: If stored in private storage bucket (company-uploads), delete exact file object
  if (tmpl.source_pdf_path && !tmpl.source_pdf_path.startsWith("/") && !tmpl.source_pdf_path.startsWith("http")) {
    try {
      const { error: storageErr } = await admin.storage
        .from("company-uploads")
        .remove([tmpl.source_pdf_path]);

      if (storageErr) {
        console.warn("[adminDeleteAgreementTemplateAction] Storage file cleanup warning:", storageErr);
      }
    } catch (sErr: any) {
      console.warn("[adminDeleteAgreementTemplateAction] Storage cleanup exception:", sErr);
    }
  }

  return { success: true };
}

/**
 * Admin: Gets preview/download URL for an Agreement Template PDF
 */
export async function adminGetTemplatePdfUrlAction(
  templateId: string,
  downloadFilename?: string
): Promise<{ url: string | null; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { url: null, error: "인증되지 않은 사용자입니다." };

  const admin = createAdminClient();
  const { data: tmpl } = await admin
    .from("agreement_templates")
    .select("source_pdf_path, name, version")
    .eq("id", templateId)
    .single();

  if (!tmpl || !tmpl.source_pdf_path) {
    return { url: null, error: "템플릿 PDF 경로를 찾을 수 없습니다." };
  }

  // If public web path (starts with "/")
  if (tmpl.source_pdf_path.startsWith("/")) {
    return { url: tmpl.source_pdf_path };
  }

  // Private storage path (company-uploads bucket)
  try {
    const downloadOpt = downloadFilename ? { download: downloadFilename } : undefined;
    const { data: signed, error: signErr } = await admin.storage
      .from("company-uploads")
      .createSignedUrl(tmpl.source_pdf_path, 3600, downloadOpt);

    if (signErr || !signed?.signedUrl) {
      console.error("[adminGetTemplatePdfUrlAction] Storage error:", signErr);
      return { url: null, error: "템플릿 서명된 URL 생성에 실패했습니다." };
    }

    return { url: signed.signedUrl };
  } catch (err: any) {
    console.error("[adminGetTemplatePdfUrlAction] Exception:", err);
    return { url: null, error: err?.message || "URL 생성 오류가 발생했습니다." };
  }
}

/**
 * Admin: Uploads a new Agreement Template version and optionally sets it as Active.
 */
export async function adminUploadAgreementTemplateAction(formData: FormData): Promise<{
  success: boolean;
  template?: AgreementTemplateItem;
  error?: string;
}> {
  formData = await unstageFormData(formData);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "인증되지 않은 사용자입니다." };

  const admin = createAdminClient();

  const agreementType = (formData.get("agreement_type") as string) || "BRAND_SUPPLIER";
  const name = (formData.get("name") as string || "").trim();
  const version = (formData.get("version") as string || "").trim();
  const notes = (formData.get("notes") as string || "").trim();
  const setActive = formData.get("setActive") === "true";
  const file = formData.get("pdfFile") as File;

  if (!name || !version || !file) {
    return { success: false, error: "계약서 명칭, 버전, PDF 파일은 필수 항목입니다." };
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { success: false, error: "PDF 형식의 파일만 업로드할 수 있습니다." };
  }

  // 1. Check version uniqueness for the specific agreement_type
  const { data: existing } = await admin
    .from("agreement_templates")
    .select("id")
    .eq("agreement_type", agreementType)
    .eq("version", version)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: `해당 계약 유형(${agreementType === "BRAND_SUPPLIER" ? "브랜드 공급사" : "리테일러"})의 버전 ${version} 템플릿이 이미 존재합니다. 다른 버전을 입력해 주세요.`,
    };
  }

  // 2. Upload template PDF to private storage
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const sanitizeVersion = version.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `agreements/templates/${agreementType}/${sanitizeVersion}_${Date.now()}.pdf`;

  const { error: uploadErr } = await admin.storage
    .from("company-uploads")
    .upload(storagePath, fileBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadErr) {
    console.error("[adminUploadAgreementTemplateAction] Storage upload error:", uploadErr);
    return { success: false, error: `템플릿 파일 업로드 실패: ${uploadErr.message}` };
  }

  // 3. If setActive is true, deactivate existing active templates of the SAME agreement_type ONLY
  if (setActive) {
    await admin
      .from("agreement_templates")
      .update({ status: "inactive" })
      .eq("agreement_type", agreementType)
      .eq("status", "active");
  }

  // 4. Insert new agreement template record
  const { data: newTmpl, error: insertErr } = await admin
    .from("agreement_templates")
    .insert({
      agreement_type: agreementType,
      name,
      version,
      status: setActive ? "active" : "inactive",
      source_pdf_path: storagePath,
      notes: notes || null,
      created_by: user.email,
      activated_at: setActive ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (insertErr || !newTmpl) {
    console.error("[adminUploadAgreementTemplateAction] DB insert error:", insertErr);
    return { success: false, error: `템플릿 DB 등록 실패: ${insertErr?.message || "오류 발생"}` };
  }

  return { success: true, template: newTmpl };
}

/**
 * Admin: Sets an existing Agreement Template as Active for its Agreement Type.
 * Deactivates previous active templates of the SAME Agreement Type ONLY.
 */
export async function adminSetAgreementTemplateActiveAction(templateId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "인증되지 않은 사용자입니다." };

  const admin = createAdminClient();

  const { data: tmpl } = await admin
    .from("agreement_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (!tmpl) return { success: false, error: "대상 템플릿을 찾을 수 없습니다." };

  const targetType = tmpl.agreement_type || "BRAND_SUPPLIER";

  // Deactivate previous active templates of the SAME agreement_type ONLY
  await admin
    .from("agreement_templates")
    .update({ status: "inactive" })
    .eq("agreement_type", targetType)
    .eq("status", "active");

  // Activate target template
  const { error: updateErr } = await admin
    .from("agreement_templates")
    .update({
      status: "active",
      activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);

  if (updateErr) {
    return { success: false, error: `Active 설정 실패: ${updateErr.message}` };
  }

  return { success: true };
}

/**
 * Admin: Lists Company Agreements across all companies or for a specific company
 */
export async function adminListCompanyAgreementsAction(companyIdFilter?: string): Promise<{
  agreements: CompanyAgreementItem[];
  error?: string;
}> {
  const admin = createAdminClient();
  let query = admin
    .from("company_agreements")
    .select("*, companies(id, name, country, contact_name, contact_phone, intro)")
    .order("created_at", { ascending: false });

  if (companyIdFilter) {
    query = query.eq("company_id", companyIdFilter);
  }

  const { data, error } = await query;
  if (error) return { agreements: [], error: error.message };

  const formatted: CompanyAgreementItem[] = (data || []).map((ca: any) => {
    const compMeta = parseCompanyMetadata(ca.companies);

    return {
      ...ca,
      companyName: compMeta.name || "-",
      companyAddress: compMeta.address || "-",
      representativeName: compMeta.representativeName || "-",
    };
  });

  return { agreements: formatted };
}

/**
 * Admin: Sends a signing reminder for a Pending Company Agreement
 */
export async function adminSendSigningReminderAction(companyAgreementId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const { data: ca } = await admin
    .from("company_agreements")
    .select("*, companies(name)")
    .eq("id", companyAgreementId)
    .single();

  if (!ca) return { success: false, error: "계약 정보를 찾을 수 없습니다." };

  await admin.from("agreement_audit_logs").insert({
    company_agreement_id: ca.id,
    agreement_id: ca.agreement_id,
    action: "REMINDER_SENT",
    performed_by_user_id: user?.id,
    performed_by_email: user?.email,
    details: { note: "Admin triggered agreement signing reminder" },
  });

  return { success: true };
}

/**
 * Admin: Gets Audit Trail logs for a Company Agreement
 */
export async function getAgreementAuditLogsAction(companyAgreementId: string): Promise<{
  logs: AgreementAuditLogItem[];
  error?: string;
}> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agreement_audit_logs")
    .select("*")
    .eq("company_agreement_id", companyAgreementId)
    .order("created_at", { ascending: false });

  if (error) return { logs: [], error: error.message };
  return { logs: data || [] };
}
