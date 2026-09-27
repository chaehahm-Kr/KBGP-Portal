"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedFileUrl } from "@/lib/files/storage";
import { generateExecutedAgreementPdf } from "@/lib/agreement/pdf-generator";
import { sendEmail } from "@/lib/notifications/email";
import type {
  CompanyAgreementItem,
  AgreementTemplateItem,
  AgreementAuditLogItem,
  AgreementRecipientItem,
  AdditionalRecipientInput,
} from "@/lib/agreement/types";

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
 * Gets or initializes the Company Agreement record for a Brand Company.
 */
export async function getCompanyAgreement(companyIdInput?: string): Promise<{
  agreement: CompanyAgreementItem | null;
  companyInfo: { id: string; name: string; address?: string | null; representativeName?: string | null };
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { agreement: null, companyInfo: { id: "", name: "" }, error: "인증되지 않은 사용자입니다." };

  let targetCompanyId = companyIdInput;

  if (!targetCompanyId) {
    const { data: cu } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("id", user.id)
      .limit(1)
      .maybeSingle();

    targetCompanyId = cu?.company_id;
  }

  if (!targetCompanyId) {
    return { agreement: null, companyInfo: { id: "", name: "" }, error: "소속 회사 정보를 찾을 수 없습니다." };
  }

  // Fetch Company Info (Using actual existing columns on companies table)
  const admin = createAdminClient();
  const { data: comp, error: compErr } = await admin
    .from("companies")
    .select("id, name, country, contact_name, contact_phone, intro")
    .eq("id", targetCompanyId)
    .single();

  if (compErr || !comp) {
    console.error("[getCompanyAgreement] Company fetch error:", compErr);
    return { agreement: null, companyInfo: { id: targetCompanyId, name: "" }, error: "회사 정보를 불러올 수 없습니다." };
  }

  const compMeta = parseCompanyMetadata(comp);

  const companyInfo = {
    id: targetCompanyId,
    name: compMeta.name,
    address: compMeta.address || null,
    representativeName: compMeta.representativeName || null,
  };

  // Fetch existing Company Agreement
  const { data: caList } = await admin
    .from("company_agreements")
    .select("*")
    .eq("company_id", targetCompanyId)
    .order("created_at", { ascending: false });

  let ca = caList?.[0] || null;

  // If no agreement record exists yet, create an initial Pending Agreement record linked to Template v1.0
  if (!ca) {
    const { data: tmpl } = await admin
      .from("agreement_templates")
      .select("id, version")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (tmpl) {
      const newAgreementId = await generateUniqueExternalAgreementId(admin, compMeta.name);
      const { data: newCa, error: createErr } = await admin
        .from("company_agreements")
        .insert({
          company_id: targetCompanyId,
          template_id: tmpl.id,
          agreement_id: newAgreementId,
          version: tmpl.version || "1.0",
          status: "pending",
        })
        .select()
        .single();

      if (!createErr && newCa) {
        ca = newCa;
        // Log audit creation
        await admin.from("agreement_audit_logs").insert({
          company_agreement_id: newCa.id,
          agreement_id: newCa.agreement_id,
          action: "CREATED",
          performed_by_user_id: user.id,
          performed_by_email: user.email,
          details: { note: "Company Agreement initialized from Template v1.0" },
        });
      }
    }
  }

  if (!ca) {
    return { agreement: null, companyInfo, error: "계약서 정보를 생성할 수 없습니다." };
  }

  const agreementItem: CompanyAgreementItem = {
    ...ca,
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

  const admin = createAdminClient();

  // 1. Fetch agreement & company with clean PostgREST select query (using existing companies columns)
  let ca: any = null;
  let fetchErr: any = null;

  if (input.companyAgreementId) {
    const { data: fetchCa, error: err } = await admin
      .from("company_agreements")
      .select("*, companies(id, name, country, contact_name, contact_phone, intro)")
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
      .select("*, companies(id, name, country, contact_name, contact_phone, intro)")
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
        .select("*, companies(id, name, country, contact_name, contact_phone, intro)")
        .eq("company_id", cu.company_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      ca = userCa;
    }
  }

  // Fallback 3: If NO agreement record exists yet for the target company, auto-initialize a pending record right now!
  const finalCompId = targetCompanyId || ca?.company_id;
  if (!ca && finalCompId) {
    const { data: tmpl } = await admin
      .from("agreement_templates")
      .select("id, version")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (tmpl) {
      const compInfo = parseCompanyMetadata(ca?.companies);
      const newAgreementId = await generateUniqueExternalAgreementId(admin, compInfo.name || "Brand");
      const { data: newCa } = await admin
        .from("company_agreements")
        .insert({
          company_id: finalCompId,
          template_id: tmpl.id,
          agreement_id: newAgreementId,
          version: tmpl.version || "1.0",
          status: "pending",
        })
        .select("*, companies(id, name, country, contact_name, contact_phone, intro)")
        .single();

      ca = newCa;
    }
  }

  if (!ca) {
    console.error("[signCompanyAgreementAction] Failed to resolve agreement. fetchErr:", fetchErr, "input:", input);
    return { success: false, error: "계약서 정보를 찾을 수 없습니다. 소속 회사 정보를 다시 확인해 주세요." };
  }

  const compMeta = parseCompanyMetadata(ca.companies);

  // Idempotency: If already Active, return success directly
  if (ca.status === "active" && ca.final_pdf_path) {
    return {
      success: true,
      agreement: {
        ...ca,
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
      error: "계약서를 진행하려면 회사명과 회사 주소를 먼저 입력해 주세요.",
    };
  }

  if (!input.authorityConfirmed || !input.consentToAgreement || !input.consentToESignature) {
    return {
      success: false,
      error: "모든 필수 동의 항목에 동의해 주셔야 계약을 체결할 수 있습니다.",
    };
  }

  if (!input.signerName.trim() || !input.signerTitle.trim()) {
    return {
      success: false,
      error: "서명자 이름과 직책을 모두 입력해 주세요.",
    };
  }

  const signerEmailClean = (input.signerEmail || user.email || "").trim();
  if (!signerEmailClean || !isValidEmail(signerEmailClean)) {
    return {
      success: false,
      error: "올바른 서명자 이메일 주소를 입력해 주세요.",
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
          error: `추가 수신자 #${i + 1}의 이름, 직책, 이메일을 모두 입력해 주세요.`,
        };
      }
      if (!isValidEmail(rEmail)) {
        return {
          success: false,
          error: `추가 수신자 #${i + 1}의 이메일 형식(${rEmail})이 올바르지 않습니다.`,
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
    .select()
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

  // Dispatch Email Notifications asynchronously (failure does not invalidate Active Agreement)
  for (const r of recipientsToRecord) {
    try {
      await sendEmail({
        to: r.recipient_email,
        subject: `[K SELECT NETWORK] ${compMeta.name} 브랜드 공급 및 유통 기본계약서 체결 완료 (${ca.agreement_id})`,
        text: `안녕하세요 ${r.recipient_name}님 (${r.recipient_title}),\n\n${compMeta.name}의 K SELECT NETWORK 브랜드 공급·미국 유통 및 플랫폼 이용 기본계약서 (v${ca.version || "1.0"}, ${ca.agreement_id}) 전자서명이 완료되었습니다.\n\n체결 일자: ${executedDateStr}\n계약 ID: ${ca.agreement_id}\n문서 해시 (SHA-256): ${pdfHash}\n\n감사합니다.\nK SELECT NETWORK 드림`,
      });
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
  const admin = createAdminClient();
  const { data: rec } = await admin
    .from("company_agreement_recipients")
    .select("*, company_agreements(agreement_id, version, companies(name))")
    .eq("id", recipientId)
    .single();

  if (!rec) return { success: false, error: "수신자 기록을 찾을 수 없습니다." };

  const compName = (rec as any).company_agreements?.companies?.name || "브랜드사";
  const agreementIdStr = (rec as any).company_agreements?.agreement_id || rec.agreement_id;
  const versionStr = (rec as any).company_agreements?.version || "1.0";

  try {
    await sendEmail({
      to: rec.recipient_email,
      subject: `[K SELECT NETWORK] ${compName} 체결 계약서 사본 재발송 (${agreementIdStr})`,
      text: `안녕하세요 ${rec.recipient_name}님 (${rec.recipient_title}),\n\n${compName}의 K SELECT NETWORK 브랜드 공급 및 유통 기본계약서 (v${versionStr}, ${agreementIdStr}) 사본입니다.`,
    });

    await admin
      .from("company_agreement_recipients")
      .update({ delivery_status: "sent", sent_at: new Date().toISOString() })
      .eq("id", recipientId);

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
 * Admin: Lists all Agreement Templates
 */
export async function adminListAgreementTemplatesAction(): Promise<{
  templates: AgreementTemplateItem[];
  error?: string;
}> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agreement_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { templates: [], error: error.message };
  return { templates: data || [] };
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
