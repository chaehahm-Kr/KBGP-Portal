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
 * Validates email format server-side.
 */
function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
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

  // Fetch Company Info
  const admin = createAdminClient();
  const { data: comp } = await admin
    .from("companies")
    .select("id, name, address, address_detail, representative_name, city, state, country, zip_code")
    .eq("id", targetCompanyId)
    .single();

  const fullAddress = [
    comp?.address,
    comp?.address_detail,
    comp?.city,
    comp?.state,
    comp?.country,
    comp?.zip_code
  ].filter(Boolean).join(" ").trim();

  const companyInfo = {
    id: targetCompanyId,
    name: comp?.name || "",
    address: fullAddress || null,
    representativeName: comp?.representative_name || null,
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
      const { data: newCa, error: createErr } = await admin
        .from("company_agreements")
        .insert({
          company_id: targetCompanyId,
          template_id: tmpl.id,
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

  // 1. Fetch agreement & company with robust multi-tier fallback
  let ca: any = null;
  if (input.companyAgreementId) {
    const { data: fetchCa } = await admin
      .from("company_agreements")
      .select("*, companies(id, name, address, address_detail, representative_name, city, state, country, zip_code)")
      .eq("id", input.companyAgreementId)
      .maybeSingle();

    ca = fetchCa;
  }

  const targetCompanyId = input.companyId || ca?.company_id;

  // Fallback 1: lookup by companyId if ca wasn't found by companyAgreementId
  if (!ca && targetCompanyId) {
    const { data: companyCa } = await admin
      .from("company_agreements")
      .select("*, companies(id, name, address, address_detail, representative_name, city, state, country, zip_code)")
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
        .select("*, companies(id, name, address, address_detail, representative_name, city, state, country, zip_code)")
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
      const { data: newCa } = await admin
        .from("company_agreements")
        .insert({
          company_id: finalCompId,
          template_id: tmpl.id,
          version: tmpl.version || "1.0",
          status: "pending",
        })
        .select("*, companies(id, name, address, address_detail, representative_name, city, state, country, zip_code)")
        .single();

      ca = newCa;
    }
  }

  if (!ca) {
    return { success: false, error: "계약서 정보를 찾을 수 없습니다. 소속 회사 정보를 다시 확인해 주세요." };
  }

  // Idempotency: If already Active, return success directly
  if (ca.status === "active" && ca.final_pdf_path) {
    const comp = ca.companies || {};
    const fullAddress = [
      comp?.address,
      comp?.address_detail,
      comp?.city,
      comp?.state,
      comp?.country,
      comp?.zip_code
    ].filter(Boolean).join(" ").trim();

    return {
      success: true,
      agreement: {
        ...ca,
        companyName: comp.name,
        companyAddress: fullAddress,
        representativeName: comp.representative_name,
      },
    };
  }

  const comp = (ca as any).companies;
  const fullAddress = [
    comp?.address,
    comp?.address_detail,
    comp?.city,
    comp?.state,
    comp?.country,
    comp?.zip_code
  ].filter(Boolean).join(" ").trim();

  // Prerequisite Check: Company Name & Company Address
  if (!comp?.name || !fullAddress) {
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
    companyName: comp.name,
    companyAddress: fullAddress,
    representativeName: comp.representative_name,
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
        subject: `[K SELECT NETWORK] ${comp.name} 브랜드 공급 및 유통 기본계약서 체결 완료 (${ca.agreement_id})`,
        text: `안녕하세요 ${r.recipient_name}님 (${r.recipient_title}),\n\n${comp.name}의 K SELECT NETWORK 브랜드 공급·미국 유통 및 플랫폼 이용 기본계약서 (v${ca.version || "1.0"}, ${ca.agreement_id}) 전자서명이 완료되었습니다.\n\n체결 일자: ${executedDateStr}\n계약 ID: ${ca.agreement_id}\n문서 해시 (SHA-256): ${pdfHash}\n\n감사합니다.\nK SELECT NETWORK 드림`,
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
      companyName: comp.name,
      companyAddress: fullAddress,
      representativeName: comp.representative_name,
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
 */
export async function getSignedExecutedPdfUrlAction(storagePath: string): Promise<{
  url: string | null;
  error?: string;
}> {
  if (!storagePath) return { url: null, error: "저장된 PDF 경로가 없습니다." };

  try {
    const url = await getSignedFileUrl(storagePath, 3600, "company-uploads");
    if (!url) return { url: null, error: "서명된 다운로드 URL을 생성할 수 없습니다." };
    return { url };
  } catch (err: any) {
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
    .select("*, companies(name, address, address_detail, representative_name, city, state, country, zip_code)")
    .order("created_at", { ascending: false });

  if (companyIdFilter) {
    query = query.eq("company_id", companyIdFilter);
  }

  const { data, error } = await query;
  if (error) return { agreements: [], error: error.message };

  const formatted: CompanyAgreementItem[] = (data || []).map((ca: any) => {
    const comp = ca.companies;
    const fullAddress = [
      comp?.address,
      comp?.address_detail,
      comp?.city,
      comp?.state,
      comp?.country,
      comp?.zip_code
    ].filter(Boolean).join(" ").trim();

    return {
      ...ca,
      companyName: comp?.name || "-",
      companyAddress: fullAddress || "-",
      representativeName: comp?.representative_name || "-",
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
