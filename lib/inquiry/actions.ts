"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyMembership } from "@/lib/company/dal";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notification/actions";
import { validateUploadedFile } from "@/lib/files/validate";
import { getSignedFileUrl } from "@/lib/files/storage";
import { sendEmail } from "@/lib/notifications/email";
import { publicEnv } from "@/lib/env/public";
import type { CaseStatus, MessageType, InquiryMessageItem, PartnerInquiryItem } from "@/lib/inquiry/types";
import { CASE_STATUS_LABEL } from "@/lib/inquiry/types";

// Re-export types only (plain objects cannot be exported from 'use server' files)
export type { CaseStatus, MessageType, InquiryMessageItem, PartnerInquiryItem } from "@/lib/inquiry/types";

// ────────────────────────────────────────────────────────────────────────────
// Category labels (internal — not exported from 'use server')
// ────────────────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  product:     "제품 등록 및 스펙 수정",
  onboarding:  "입점 신청 및 심사 현황",
  logistics:   "물류 공급 및 패키징",
  translation: "번역 및 전성분표 기재",
  settlement:  "정산 / 인보이스 문의",
  system:      "시스템 오류 제보 및 기능 제안",
  general:     "기타 일반 문의"
};

// ────────────────────────────────────────────────────────────────────────────
// Utility functions
// ────────────────────────────────────────────────────────────────────────────

function extensionFor(mime: string) {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  return "bin";
}

/** Normalize legacy status strings to new CaseStatus */
function normalizeStatus(raw: string): CaseStatus {
  if (!raw) return "open";
  const s = raw.toLowerCase().trim();
  if (s === "pending") return "open";
  if (s === "replied" || s === "action_resolved") return "in_review";
  return s as CaseStatus;
}

/** Fetch threaded messages for an inquiry, with fallback for missing table */
async function getMessagesForInquiry(
  supabase: any,
  item: any,
  defaultSenderName: string,
  repliedStaffName: string | undefined,
  isPortal: boolean = false
): Promise<InquiryMessageItem[]> {
  try {
    const { data: dbMessages, error: msgError } = await supabase
      .from("partner_inquiry_messages")
      .select("*")
      .eq("inquiry_id", item.id)
      .order("created_at", { ascending: true });

    if (msgError) {
      // Table not yet migrated – build fallback from main inquiry columns
      const fallback: InquiryMessageItem[] = [
        {
          id: "initial-" + item.id,
          senderType: "partner",
          senderName: defaultSenderName,
          content: item.content,
          messageType: "message",
          isActionFlag: false,
          attachmentUrl: item.attachment_url || null,
          attachmentFilename: item.attachment_filename || null,
          createdAt: item.created_at
        }
      ];
      if (item.reply_content) {
        fallback.push({
          id: "reply-" + item.id,
          senderType: "admin",
          senderName: isPortal ? "K SELECT NETWORK 담당자" : (repliedStaffName || "어드민 담당자"),
          content: item.reply_content,
          messageType: item.is_action_required ? "action_required" : "message",
          isActionFlag: !!item.is_action_required,
          attachmentUrl: null,
          attachmentFilename: null,
          createdAt: item.replied_at || item.created_at
        });
      }
      return fallback;
    }

    const result: InquiryMessageItem[] = [];

    // Seed initial inquiry message if not already in thread
    const hasInitial = (dbMessages || []).some(
      (m: any) => m.content === item.content && m.sender_type === (item.created_source === "admin" ? "admin" : "partner")
    );
    if (!hasInitial) {
      const isCreatedByAdmin = item.created_source === "admin";
      result.push({
        id: "initial-" + item.id,
        senderType: isCreatedByAdmin ? "admin" : "partner",
        senderName: isPortal
          ? (isCreatedByAdmin ? "K SELECT NETWORK 담당자" : defaultSenderName)
          : (isCreatedByAdmin ? (repliedStaffName || "어드민 담당자") : defaultSenderName),
        content: item.content,
        messageType: "message",
        isActionFlag: !!item.is_action_required,
        attachmentUrl: item.attachment_url || null,
        attachmentFilename: item.attachment_filename || null,
        createdAt: item.created_at
      });
    }

    for (const m of dbMessages || []) {
      let attachmentUrl = null;
      if (m.attachment_path) {
        attachmentUrl = await getSignedFileUrl(m.attachment_path);
      }
      const rawSenderName = m.sender_name || (m.sender_type === "admin" ? "어드민 담당자" : defaultSenderName);
      const displaySenderName = isPortal && m.sender_type === "admin" ? "K SELECT NETWORK 담당자" : rawSenderName;
      result.push({
        id: m.id,
        senderType: m.sender_type as "partner" | "admin" | "system",
        senderName: displaySenderName,
        content: m.content,
        messageType: (m.message_type || "message") as MessageType,
        isActionFlag: !!m.is_action_flag,
        attachmentUrl,
        attachmentFilename: m.attachment_filename,
        createdAt: m.created_at
      });
    }

    return result;
  } catch (e) {
    // Any unexpected error – minimal fallback
    return [
      {
        id: "initial-" + item.id,
        senderType: item.created_source === "admin" ? "admin" : "partner",
        senderName: isPortal && item.created_source === "admin" ? "K SELECT NETWORK 담당자" : defaultSenderName,
        content: item.content,
        messageType: "message",
        isActionFlag: false,
        attachmentUrl: item.attachment_url || null,
        attachmentFilename: item.attachment_filename || null,
        createdAt: item.created_at
      }
    ];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// createPartnerInquiry
// ────────────────────────────────────────────────────────────────────────────

/**
 * 포털에서 새 케이스(1:1 문의)를 등록합니다.
 */
export async function createPartnerInquiry(formData: FormData) {
  try {
    const { companyId, userId } = await requireCompanyMembership();
    const supabase = await createClient();

    const category = String(formData.get("category") ?? "general");
    const title = String(formData.get("title") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();
    const file = formData.get("file");

    if (!title) return { success: false, error: "제목을 입력해주세요." };
    if (!content) return { success: false, error: "내용을 입력해주세요." };

    let attachmentPath = null;
    let attachmentFilename = null;

    if (file instanceof File && file.size > 0) {
      if (file.size > 20 * 1024 * 1024) {
        return { success: false, error: "첨부파일은 최대 20MB까지 업로드할 수 있습니다.\nAttachment files must be 20MB or smaller." };
      }

      const validation = await validateUploadedFile(file, ["image", "document"]);
      if (!validation.ok) {
        return { success: false, error: validation.error };
      }

      const path = `${companyId}/inquiries/${crypto.randomUUID()}.${extensionFor(validation.detectedMime)}`;
      const { error: uploadError } = await supabase.storage
        .from("company-uploads")
        .upload(path, file, { contentType: validation.detectedMime });

      if (uploadError) {
        console.error("Failed to upload inquiry attachment:", uploadError);
        return { success: false, error: "첨부파일 업로드에 실패했습니다." };
      }

      attachmentPath = path;
      attachmentFilename = file.name;
    }

    const previousCaseId = (formData.get("previous_case_id") as string) || null;
    const relatedInvoiceId = (formData.get("related_invoice_id") as string) || null;
    const relatedPoId = (formData.get("related_po_id") as string) || null;

    const insertPayload: any = {
      company_id: companyId,
      created_by: userId,
      category,
      title,
      content,
      attachment_path: attachmentPath,
      attachment_filename: attachmentFilename,
      status: "open",
      is_action_required: false,
      created_source: "portal",
      priority: "normal"
    };

    if (previousCaseId) {
      insertPayload.previous_case_id = previousCaseId;
    }
    if (relatedInvoiceId) {
      insertPayload.related_invoice_id = relatedInvoiceId;
    }
    if (relatedPoId) {
      insertPayload.related_po_id = relatedPoId;
    }

    let { data: newInquiry, error } = await supabase
      .from("partner_inquiries")
      .insert(insertPayload)
      .select()
      .single();

    if (error && (error.message?.includes("created_source") || error.message?.includes("priority") || error.code === "42703")) {
      const fallbackPayload = { ...insertPayload };
      delete fallbackPayload.created_source;
      delete fallbackPayload.priority;
      const retryRes = await supabase
        .from("partner_inquiries")
        .insert(fallbackPayload)
        .select()
        .single();
      newInquiry = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      console.error("Failed to create partner inquiry:", error);
      if (error.code === "PGRST205" || error.message?.includes("Could not find the table")) {
        return { success: false, error: "문의 지원 서비스를 준비 중입니다. 관리자에게 문의해 주세요." };
      }
      if (error.message?.includes("previous_case_id") || error.code === "42703") {
        const fallbackPayload = { ...insertPayload };
        delete fallbackPayload.previous_case_id;
        delete fallbackPayload.created_source;
        delete fallbackPayload.priority;
        const { data: fallbackInquiry, error: fallbackErr } = await supabase
          .from("partner_inquiries")
          .insert(fallbackPayload)
          .select()
          .single();
        if (!fallbackErr && fallbackInquiry) {
          revalidatePath("/portal/support");
          return { success: true, data: fallbackInquiry };
        }
      }
      return { success: false, error: "문의를 등록하지 못했습니다. 다시 시도해 주세요." };
    }

    // Notify all active admin staff
    const adminSupabase = createAdminClient();
    const [{ data: company }, { data: staffMembers }] = await Promise.all([
      adminSupabase.from("companies").select("name").eq("id", companyId).maybeSingle(),
      adminSupabase.from("staff_members").select("id").eq("status", "active")
    ]);

    const catLabel = CATEGORY_LABELS[category] || category;
    for (const staff of staffMembers ?? []) {
      await createNotification(
        staff.id,
        userId,
        "신규 케이스 접수",
        `[${company?.name || "회사"}]에서 신규 케이스(${catLabel})를 등록했습니다. 24시간 내 검토가 필요합니다.`,
        "/admin/partner-inquiries"
      );
    }

    revalidatePath("/portal/support");
    return { success: true, data: newInquiry };
  } catch (e) {
    console.error("Failed to create partner inquiry:", e);
    return { success: false, error: e instanceof Error ? e.message : "문의 등록 실패" };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// getCompaniesAndUsersForCaseCreation (Admin Case Creation Support)
// ────────────────────────────────────────────────────────────────────────────

export interface CaseCreationCompany {
  id: string;
  name: string;
}

export interface CaseCreationUser {
  id: string;
  company_id: string;
  name: string;
  email: string;
  company_role: string;
}

/**
 * 어드민 새 케이스 생성 모달을 위한 회사 및 소속 담당자 목록 조회
 */
export async function getCompaniesAndUsersForCaseCreation(): Promise<{
  companies: CaseCreationCompany[];
  companyUsers: CaseCreationUser[];
}> {
  try {
    await verifyAdminSession();
    const adminSupabase = createAdminClient();

    const [{ data: companies, error: compErr }, { data: companyUsers, error: userErr }] = await Promise.all([
      adminSupabase
        .from("companies")
        .select("id, name, status")
        .eq("status", "active")
        .order("name", { ascending: true }),
      adminSupabase
        .from("company_users")
        .select("id, company_id, name, email, company_role, status")
        .eq("status", "active")
        .order("name", { ascending: true })
    ]);

    if (compErr) console.error("Failed to fetch companies for case creation:", compErr);
    if (userErr) console.error("Failed to fetch company users for case creation:", userErr);

    return {
      companies: (companies || []).map((c: any) => ({ id: c.id, name: c.name })),
      companyUsers: (companyUsers || []).map((u: any) => ({
        id: u.id,
        company_id: u.company_id,
        name: u.name || "담당자",
        email: u.email || "",
        company_role: u.company_role || "member"
      }))
    };
  } catch (e) {
    console.error("Failed in getCompaniesAndUsersForCaseCreation:", e);
    return { companies: [], companyUsers: [] };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// createAdminPartnerInquiry (Admin에서 새 케이스 직접 생성)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 어드민에서 특정 파트너/브랜드사 담당자 앞으로 새 케이스를 직접 등록합니다.
 */
export async function createAdminPartnerInquiry(formData: FormData) {
  try {
    const session = await verifyAdminSession();
    const adminSupabase = createAdminClient();

    const companyId = String(formData.get("company_id") || "").trim();
    const contactUserId = String(formData.get("contact_user_id") || "").trim();
    const category = String(formData.get("category") || "general").trim();
    const title = String(formData.get("title") || "").trim();
    const content = String(formData.get("content") || "").trim();
    const priority = String(formData.get("priority") || "normal").trim();
    const isActionRequired = formData.get("is_action_required") === "true" || formData.get("is_action_required") === "on";
    const sendEmailFlag = formData.get("send_email") === "true" || formData.get("send_email") === "on";
    const file = formData.get("file");

    if (!companyId) return { success: false, error: "회사를 선택해주세요." };
    if (!contactUserId) return { success: false, error: "담당자를 선택해주세요." };
    if (!title) return { success: false, error: "제목을 입력해주세요." };
    if (!content) return { success: false, error: "내용을 입력해주세요." };

    let attachmentPath = null;
    let attachmentFilename = null;

    if (file instanceof File && file.size > 0) {
      if (file.size > 20 * 1024 * 1024) {
        return { success: false, error: "첨부파일은 최대 20MB까지 업로드할 수 있습니다." };
      }

      const validation = await validateUploadedFile(file, ["image", "document"]);
      if (!validation.ok) {
        return { success: false, error: validation.error };
      }

      const path = `${companyId}/inquiries/${crypto.randomUUID()}.${extensionFor(validation.detectedMime)}`;
      const { error: uploadError } = await adminSupabase.storage
        .from("company-uploads")
        .upload(path, file, { contentType: validation.detectedMime });

      if (uploadError) {
        console.error("Failed to upload admin inquiry attachment:", uploadError);
        return { success: false, error: "첨부파일 업로드에 실패했습니다." };
      }

      attachmentPath = path;
      attachmentFilename = file.name;
    }

    const relatedInvoiceId = (formData.get("related_invoice_id") as string) || null;
    const relatedPoId = (formData.get("related_po_id") as string) || null;

    // Admin created case status: default 'in_review' (검토중), or 'action_required' (조치필요) if is_action_required is true
    const initialStatus: CaseStatus = isActionRequired ? "action_required" : "in_review";

    const insertPayload: any = {
      company_id: companyId,
      created_by: contactUserId,
      category,
      title,
      content,
      attachment_path: attachmentPath,
      attachment_filename: attachmentFilename,
      status: initialStatus,
      is_action_required: isActionRequired,
      created_source: "admin",
      priority: priority || "normal"
    };

    if (relatedInvoiceId) {
      insertPayload.related_invoice_id = relatedInvoiceId;
    }
    if (relatedPoId) {
      insertPayload.related_po_id = relatedPoId;
    }

    let { data: newInquiry, error: insertError } = await adminSupabase
      .from("partner_inquiries")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError && (insertError.message?.includes("created_source") || insertError.message?.includes("priority") || insertError.code === "42703")) {
      const fallbackPayload = { ...insertPayload };
      delete fallbackPayload.created_source;
      delete fallbackPayload.priority;
      const retryRes = await adminSupabase
        .from("partner_inquiries")
        .insert(fallbackPayload)
        .select()
        .single();
      newInquiry = retryRes.data;
      insertError = retryRes.error;
    }

    if (insertError || !newInquiry) {
      console.error("Failed to create admin partner inquiry:", insertError);
      return { success: false, error: "케이스를 등록하지 못했습니다. 다시 시도해 주세요." };
    }

    // Get staff name and contact user details for logging & email
    const [{ data: staffDoc }, { data: contactUser }] = await Promise.all([
      adminSupabase.from("staff_members").select("name, email").eq("id", session.userId).maybeSingle(),
      adminSupabase.from("company_users").select("name, email").eq("id", contactUserId).maybeSingle()
    ]);

    const staffName = staffDoc?.name || "어드민 담당자";
    const contactName = contactUser?.name || "담당자";
    const contactEmail = contactUser?.email || "";

    // 1. Initial Human Message in Conversation Thread
    await adminSupabase.from("partner_inquiry_messages").insert({
      inquiry_id: newInquiry.id,
      sender_type: "admin",
      sender_id: session.userId,
      sender_name: staffName,
      content: content,
      attachment_path: attachmentPath,
      attachment_filename: attachmentFilename,
      message_type: "message",
      is_action_flag: isActionRequired
    });

    // 2. Case Log Event: Admin Case Created & Contact Assigned
    await adminSupabase.from("partner_inquiry_messages").insert({
      inquiry_id: newInquiry.id,
      sender_type: "admin",
      sender_id: session.userId,
      sender_name: staffName,
      content: `어드민이 케이스를 생성하고 [${contactName}]을(를) 담당자로 지정함 (상태: ${isActionRequired ? "조치필요" : "검토중"})`,
      message_type: "status_change",
      is_action_flag: isActionRequired
    });

    // 3. Case Log Event: If Action Required
    if (isActionRequired) {
      await adminSupabase.from("partner_inquiry_messages").insert({
        inquiry_id: newInquiry.id,
        sender_type: "admin",
        sender_id: session.userId,
        sender_name: staffName,
        content: "어드민 조치 요청 (상태 전이: 조치필요)",
        message_type: "action_required",
        is_action_flag: true
      });
    }

    // 4. Case Log Event & Send Email if checked
    if (sendEmailFlag && contactEmail) {
      try {
        const caseLabel = newInquiry.case_number ? `#${newInquiry.case_number}` : title;
        const portalUrl = `${publicEnv.NEXT_PUBLIC_SITE_URL || "https://portal.kselectnetwork.com"}/portal/support?case=${newInquiry.case_number || newInquiry.id}`;
        const emailSubject = isActionRequired
          ? `[K SELECT NETWORK] 케이스 ${caseLabel} 조치 요청 안내`
          : `[K SELECT NETWORK] 신규 케이스 ${caseLabel} 등록 안내`;

        await sendEmail({
          to: contactEmail,
          subject: emailSubject,
          text: `안녕하세요 ${contactName}님,\n\nK SELECT NETWORK에서 귀사에 신규 케이스(${caseLabel} - ${title})를 등록하였습니다.\n\n[내용]\n${content}\n\n포털에 접속하여 상세 내용 확인 및 지원을 진행해 주시기 바랍니다.\n접속 주소: ${portalUrl}\n\n감사합니다.\nK SELECT NETWORK 팀`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #18181b; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #18181b; font-size: 18px; margin-bottom: 16px;">[K SELECT NETWORK] ${isActionRequired ? "케이스 조치 요청" : "신규 케이스 등록"}</h2>
              <p style="font-size: 14px; margin-bottom: 12px;">안녕하세요 ${contactName}님,</p>
              <p style="font-size: 14px; margin-bottom: 16px;">K SELECT NETWORK 운영팀에서 신규 케이스(<strong>${caseLabel}</strong>: ${title})를 등록하였습니다.</p>
              
              <div style="background-color: ${isActionRequired ? "#fff1f2" : "#f4f4f5"}; border-left: 4px solid ${isActionRequired ? "#e11d48" : "#18181b"}; padding: 14px 16px; margin: 20px 0; border-radius: 6px;">
                <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: bold; color: ${isActionRequired ? "#be123c" : "#18181b"};">${isActionRequired ? "⚠️ 조치 요청 내용" : "📋 케이스 내용"}</p>
                <p style="margin: 0; font-size: 13px; color: #374151; white-space: pre-wrap; line-height: 1.5;">${content}</p>
              </div>

              <div style="margin: 24px 0;">
                <a href="${portalUrl}" style="display: inline-block; background-color: #18181b; color: #ffffff; padding: 10px 20px; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 6px;">
                  포털에서 케이스 확인하기 →
                </a>
              </div>

              <p style="font-size: 12px; color: #71717a; border-top: 1px solid #e4e4e7; padding-top: 16px; margin-top: 24px;">
                본 메일은 K SELECT NETWORK 파트너 포털 케이스 알림 메일입니다.
              </p>
            </div>
          `
        });

        await adminSupabase.from("partner_inquiry_messages").insert({
          inquiry_id: newInquiry.id,
          sender_type: "admin",
          sender_id: session.userId,
          sender_name: staffName,
          content: `이메일 알림 발송 완료: ${contactEmail}`,
          message_type: "status_change",
          is_action_flag: false
        });
      } catch (emailErr) {
        console.error("Failed to send case email:", emailErr);
      }
    }

    revalidatePath("/admin/partner-inquiries");
    revalidatePath("/portal/support");
    revalidatePath("/admin", "layout");
    revalidatePath("/portal", "layout");

    return { success: true, data: newInquiry };
  } catch (e) {
    console.error("Failed to create admin partner inquiry:", e);
    return { success: false, error: e instanceof Error ? e.message : "케이스 등록 실패" };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// getPartnerInquiries
// ────────────────────────────────────────────────────────────────────────────

/**
 * 포털에서 소속 회사의 모든 케이스 목록을 조회합니다.
 */
export async function getPartnerInquiries(): Promise<PartnerInquiryItem[]> {
  try {
    const { companyId } = await requireCompanyMembership();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("partner_inquiries")
      .select("*")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("Could not find the table")) {
        console.warn("⚠️ [주의] partner_inquiries 테이블이 데이터베이스에 존재하지 않습니다.");
      } else {
        console.error("Failed to fetch partner inquiries:", error);
      }
      return [];
    }

    const adminSupabase = createAdminClient();
    const { data: staffList } = await adminSupabase.from("staff_members").select("id, name");
    const staffNameById = new Map((staffList ?? []).map((s) => [s.id, s.name || "관리자"]));

    // Map of inquiryId -> { case_number, title } for quick previous_case lookup
    const inquiryMap = new Map((data || []).map((i: any) => [i.id, { case_number: i.case_number, title: i.title }]));

    const poIds = Array.from(new Set((data || []).map((i: any) => i.related_po_id).filter(Boolean)));
    const invIds = Array.from(new Set((data || []).map((i: any) => i.related_invoice_id).filter(Boolean)));

    const poMap = new Map<string, string>();
    if (poIds.length > 0) {
      const { data: pos } = await adminSupabase.from("purchase_orders").select("id, po_number").in("id", poIds);
      (pos || []).forEach((p: any) => poMap.set(p.id, p.po_number));
    }

    const invMap = new Map<string, { invNumber: string; apNumber: string; poId?: string }>();
    if (invIds.length > 0) {
      const { data: invs } = await adminSupabase.from("supplier_invoices").select("id, supplier_invoice_number, internal_ap_number, purchase_order_id").in("id", invIds);
      (invs || []).forEach((inv: any) => invMap.set(inv.id, { invNumber: inv.supplier_invoice_number, apNumber: inv.internal_ap_number, poId: inv.purchase_order_id }));
    }

    const items = await Promise.all(
      (data || []).map(async (item) => {
        let attachmentUrl = null;
        if (item.attachment_path) {
          attachmentUrl = await getSignedFileUrl(item.attachment_path);
        }

        const repliedStaffName = item.replied_by ? staffNameById.get(item.replied_by) : undefined;
        const messages = await getMessagesForInquiry(
          supabase,
          { ...item, attachment_url: attachmentUrl },
          "파트너사",
          repliedStaffName,
          true // isPortal: true -> mask admin staff names
        );

        const prevInfo = item.previous_case_id ? inquiryMap.get(item.previous_case_id) : null;
        const isCreatedByAdmin = item.created_source === "admin" || (messages && messages.length > 0 && messages[0].senderType === "admin");
        const invInfo = item.related_invoice_id ? invMap.get(item.related_invoice_id) : null;
        const poNumber = item.related_po_id ? poMap.get(item.related_po_id) : (invInfo?.poId ? poMap.get(invInfo.poId) : null);

        return {
          ...item,
          status: normalizeStatus(item.status) as CaseStatus,
          attachment_url: attachmentUrl,
          repliedStaffName,
          created_source: isCreatedByAdmin ? "admin" : "portal",
          priority: item.priority || "normal",
          previous_case_id: item.previous_case_id || null,
          previous_case_number: item.previous_case_number || prevInfo?.case_number || null,
          previous_case_title: item.previous_case_title || prevInfo?.title || null,
          closed_by_side: item.closed_by_side || null,
          related_po_id: item.related_po_id || invInfo?.poId || null,
          related_invoice_id: item.related_invoice_id || null,
          related_po_number: poNumber || null,
          related_invoice_number: invInfo?.invNumber || null,
          related_ap_number: invInfo?.apNumber || null,
          messages
        } as PartnerInquiryItem;
      })
    );

    return items;
  } catch (e) {
    console.error("Failed to fetch partner inquiries:", e);
    return [];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// getAdminPartnerInquiries
// ────────────────────────────────────────────────────────────────────────────

/**
 * 어드민 콘솔에서 모든 파트너 케이스 목록을 조회합니다.
 */
export async function getAdminPartnerInquiries(): Promise<PartnerInquiryItem[]> {
  try {
    await verifyAdminSession();
    const adminSupabase = createAdminClient();

    const { data: inquiries, error } = await adminSupabase
      .from("partner_inquiries")
      .select(`
        *,
        companies ( name ),
        staff_members:replied_by ( name )
      `)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch admin partner inquiries:", error);
      return [];
    }

    // Query requester details for all created_by IDs
    const userIds = Array.from(new Set((inquiries || []).map((i: any) => i.created_by).filter(Boolean)));
    const userMap = new Map<string, { name: string; email: string }>();

    if (userIds.length > 0) {
      // 1. Check company_users
      const { data: companyUsers } = await adminSupabase
        .from("company_users")
        .select("id, name, email")
        .in("id", userIds);
      (companyUsers || []).forEach((u: any) => {
        if (u.id) userMap.set(u.id, { name: u.name, email: u.email });
      });

      // 2. Missing IDs check staff_members
      const missingStaffIds = userIds.filter((id) => !userMap.has(id));
      if (missingStaffIds.length > 0) {
        const { data: staffUsers } = await adminSupabase
          .from("staff_members")
          .select("id, name, email")
          .in("id", missingStaffIds);
        (staffUsers || []).forEach((s: any) => {
          if (s.id) userMap.set(s.id, { name: s.name, email: s.email });
        });
      }
    }

    const inquiryMap = new Map((inquiries || []).map((i: any) => [i.id, { case_number: i.case_number, title: i.title }]));

    const poIds = Array.from(new Set((inquiries || []).map((i: any) => i.related_po_id).filter(Boolean)));
    const invIds = Array.from(new Set((inquiries || []).map((i: any) => i.related_invoice_id).filter(Boolean)));

    const poMap = new Map<string, string>();
    if (poIds.length > 0) {
      const { data: pos } = await adminSupabase.from("purchase_orders").select("id, po_number").in("id", poIds);
      (pos || []).forEach((p: any) => poMap.set(p.id, p.po_number));
    }

    const invMap = new Map<string, { invNumber: string; apNumber: string; poId?: string }>();
    if (invIds.length > 0) {
      const { data: invs } = await adminSupabase.from("supplier_invoices").select("id, supplier_invoice_number, internal_ap_number, purchase_order_id").in("id", invIds);
      (invs || []).forEach((inv: any) => invMap.set(inv.id, { invNumber: inv.supplier_invoice_number, apNumber: inv.internal_ap_number, poId: inv.purchase_order_id }));
    }

    const items = await Promise.all(
      (inquiries ?? []).map(async (item: any) => {
        let attachmentUrl = null;
        if (item.attachment_path) {
          attachmentUrl = await getSignedFileUrl(item.attachment_path);
        }

        const repliedStaffName = item.staff_members?.name || undefined;
        const messages = await getMessagesForInquiry(
          adminSupabase,
          { ...item, attachment_url: attachmentUrl },
          "파트너사",
          repliedStaffName,
          false // isPortal: false -> show admin staff names in Admin
        );

        const prevInfo = item.previous_case_id ? inquiryMap.get(item.previous_case_id) : null;
        const requester = item.created_by ? userMap.get(item.created_by) : null;
        const isCreatedByAdmin = item.created_source === "admin" || (messages && messages.length > 0 && messages[0].senderType === "admin");
        const invInfo = item.related_invoice_id ? invMap.get(item.related_invoice_id) : null;
        const poNumber = item.related_po_id ? poMap.get(item.related_po_id) : (invInfo?.poId ? poMap.get(invInfo.poId) : null);

        return {
          id: item.id,
          company_id: item.company_id,
          created_by: item.created_by,
          category: item.category,
          title: item.title,
          content: item.content,
          attachment_path: item.attachment_path,
          attachment_filename: item.attachment_filename,
          attachment_url: attachmentUrl,
          case_number: item.case_number || null,
          status: normalizeStatus(item.status) as CaseStatus,
          reply_content: item.reply_content,
          replied_by: item.replied_by,
          replied_at: item.replied_at,
          is_action_required: item.is_action_required,
          closed_at: item.closed_at,
          closed_by: item.closed_by,
          closed_by_side: item.closed_by_side || null,
          created_source: isCreatedByAdmin ? "admin" : "portal",
          priority: item.priority || "normal",
          previous_case_id: item.previous_case_id || null,
          previous_case_number: item.previous_case_number || prevInfo?.case_number || null,
          previous_case_title: item.previous_case_title || prevInfo?.title || null,
          reopen_count: item.reopen_count ?? 0,
          satisfaction_score: item.satisfaction_score,
          satisfaction_comment: item.satisfaction_comment,
          created_at: item.created_at,
          updated_at: item.updated_at,
          companyName: item.companies?.name || "(알 수 없음)",
          requesterName: requester?.name || null,
          requesterEmail: requester?.email || null,
          repliedStaffName,
          related_po_id: item.related_po_id || invInfo?.poId || null,
          related_invoice_id: item.related_invoice_id || null,
          related_po_number: poNumber || null,
          related_invoice_number: invInfo?.invNumber || null,
          related_ap_number: invInfo?.apNumber || null,
          messages
        } as PartnerInquiryItem;
      })
    );

    return items;
  } catch (e) {
    console.error("Failed to fetch admin partner inquiries:", e);
    return [];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// getInquiriesForInvoice
// ────────────────────────────────────────────────────────────────────────────

/**
 * 특정 인보이스에 연결된 케이스 목록을 조회합니다.
 */
export async function getInquiriesForInvoice(invoiceId: string) {
  try {
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from("partner_inquiries")
      .select("id, case_number, title, category, status, is_action_required, created_at, updated_at")
      .eq("related_invoice_id", invoiceId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch inquiries for invoice:", error);
      return [];
    }

    return (data || []).map(item => ({
      ...item,
      status: normalizeStatus(item.status) as CaseStatus
    }));
  } catch (e) {
    console.error("Failed in getInquiriesForInvoice:", e);
    return [];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// answerPartnerInquiry (admin → 답변 + 상태 변경)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 어드민에서 케이스에 답변을 작성합니다.
 * isActionRequired = true 이면 status → action_required
 * isActionRequired = false 이면 status → in_review (awaiting_reply로 브랜드사 답변 대기)
 * sendEmailFlag: isActionRequired 일 때 담당자에게 이메일 발송 여부
 */
export async function answerPartnerInquiry(
  inquiryId: string,
  replyContent: string,
  isActionRequired: boolean,
  sendEmailFlag: boolean = true
) {
  try {
    const session = await verifyAdminSession();
    const adminSupabase = createAdminClient();

    const { data: originalInquiry, error: fetchError } = await adminSupabase
      .from("partner_inquiries")
      .select("created_by, title, case_number, company_id")
      .eq("id", inquiryId)
      .single();

    if (fetchError || !originalInquiry) {
      console.error("Failed to fetch original inquiry:", fetchError);
      return { success: false, error: "케이스를 찾을 수 없습니다." };
    }

    const newStatus: CaseStatus = isActionRequired ? "action_required" : "awaiting_reply";

    const { error: updateError } = await adminSupabase
      .from("partner_inquiries")
      .update({
        status: newStatus,
        reply_content: replyContent,
        replied_by: session.userId,
        replied_at: new Date().toISOString(),
        is_action_required: isActionRequired,
        updated_at: new Date().toISOString()
      })
      .eq("id", inquiryId);

    if (updateError) {
      console.error("Failed to save answer:", updateError);
      return { success: false, error: updateError.message };
    }

    // 1. Human Communication Message (Always renders in Conversation Thread)
    await adminSupabase
      .from("partner_inquiry_messages")
      .insert({
        inquiry_id: inquiryId,
        sender_type: "admin",
        sender_id: session.userId,
        sender_name: "어드민 담당자",
        content: replyContent,
        message_type: "message",
        is_action_flag: isActionRequired
      });

    // 2. Secondary Audit Event for Case Log if Action Required
    if (isActionRequired) {
      await adminSupabase
        .from("partner_inquiry_messages")
        .insert({
          inquiry_id: inquiryId,
          sender_type: "admin",
          sender_id: session.userId,
          sender_name: "어드민 담당자",
          content: "어드민 조치 요청 (상태 전이: 조치필요)",
          message_type: "action_required",
          is_action_flag: true
        });
    }

    // Lookup requester info for email & notification
    let targetEmail: string | null = null;
    let targetName: string | null = null;
    if (originalInquiry.created_by) {
      const { data: userDoc } = await adminSupabase
        .from("company_users")
        .select("name, email")
        .eq("id", originalInquiry.created_by)
        .maybeSingle();
      if (userDoc) {
        targetEmail = userDoc.email;
        targetName = userDoc.name;
      } else {
        const { data: staffDoc } = await adminSupabase
          .from("staff_members")
          .select("name, email")
          .eq("id", originalInquiry.created_by)
          .maybeSingle();
        if (staffDoc) {
          targetEmail = staffDoc.email;
          targetName = staffDoc.name;
        }
      }
    }

    if (!targetEmail && originalInquiry.company_id) {
      const { data: companyDoc } = await adminSupabase
        .from("companies")
        .select("contact_email, name")
        .eq("id", originalInquiry.company_id)
        .maybeSingle();
      if (companyDoc?.contact_email) {
        targetEmail = companyDoc.contact_email;
        targetName = targetName || companyDoc.name;
      }
    }

    // Send email ONLY IF isActionRequired === true && sendEmailFlag === true
    if (isActionRequired && sendEmailFlag && targetEmail) {
      try {
        const caseLabel = originalInquiry.case_number ? `#${originalInquiry.case_number}` : originalInquiry.title;
        const portalUrl = `${publicEnv.NEXT_PUBLIC_SITE_URL || "https://portal.kselectnetwork.com"}/portal/support`;
        await sendEmail({
          to: targetEmail,
          subject: `[K SELECT NETWORK] 케이스 ${caseLabel} 조치 요청 안내`,
          text: `안녕하세요 ${targetName || "담당자"}님,\n\nK SELECT NETWORK에서 등록하신 케이스(${caseLabel} - ${originalInquiry.title})에 대한 조치를 요청드립니다.\n\n[조치 요청 내용]\n${replyContent}\n\n포털에 접속하여 상세 내용 확인 및 조치를 진행해 주시기 바랍니다.\n접속 주소: ${portalUrl}\n\n감사합니다.\nK SELECT NETWORK 팀`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #18181b; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #18181b; font-size: 18px; margin-bottom: 16px;">[K SELECT NETWORK] 케이스 조치 요청</h2>
              <p style="font-size: 14px; margin-bottom: 12px;">안녕하세요 ${targetName || "담당자"}님,</p>
              <p style="font-size: 14px; margin-bottom: 16px;">등록하신 케이스(<strong>${caseLabel}</strong>: ${originalInquiry.title})에 대한 조치가 요청되었습니다.</p>
              
              <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 14px 16px; margin: 20px 0; border-radius: 6px;">
                <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: bold; color: #be123c;">⚠️ 조치 요청 내용</p>
                <p style="margin: 0; font-size: 13px; color: #374151; white-space: pre-wrap; line-height: 1.5;">${replyContent}</p>
              </div>

              <p style="font-size: 14px; color: #4b5563; margin-bottom: 20px;">브랜드 포털의 [문의 지원] 메뉴에서 상세 내용을 확인하시고 조치를 완료해 주시기 바랍니다.</p>
              
              <div style="margin: 24px 0;">
                <a href="${portalUrl}" style="background-color: #18181b; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-block;">
                  브랜드 포털에서 확인하기 →
                </a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 28px 0 16px 0;" />
              <p style="font-size: 11px; color: #a1a1aa; margin: 0;">본 메일은 K SELECT NETWORK 시스템에서 자동 발송되었습니다.</p>
            </div>
          `
        });
      } catch (emailErr) {
        console.error("Failed to send action required email:", emailErr);
      }
    }

    // Notify portal user in-app
    const caseLabel = originalInquiry.case_number
      ? `케이스 ${originalInquiry.case_number}`
      : `문의 '${originalInquiry.title}'`;

    const notificationTitle = isActionRequired ? "케이스 조치 요청" : "케이스 답변 완료";
    const notificationContent = isActionRequired
      ? `${caseLabel}에 대한 조치 요청이 등록되었습니다. 확인 후 조치해 주세요.`
      : `${caseLabel}에 대한 답변이 등록되었습니다. 내용을 확인해 주세요.`;

    await createNotification(
      originalInquiry.created_by,
      session.userId,
      notificationTitle,
      notificationContent,
      "/portal/support"
    );

    revalidatePath("/admin/partner-inquiries");
    revalidatePath("/portal/support");
    return { success: true };
  } catch (e) {
    console.error("Failed to answer partner inquiry:", e);
    return { success: false, error: e instanceof Error ? e.message : "답변 등록 실패" };
  }
}

/**
 * 어드민에서 답변 작성과 동시에 케이스를 종료(CLOSED)합니다.
 */
export async function answerAndClosePartnerInquiry(
  inquiryId: string,
  replyContent: string
) {
  try {
    const session = await verifyAdminSession();
    const adminSupabase = createAdminClient();

    const { data: originalInquiry, error: fetchError } = await adminSupabase
      .from("partner_inquiries")
      .select("created_by, title, case_number, status")
      .eq("id", inquiryId)
      .single();

    if (fetchError || !originalInquiry) {
      console.error("Failed to fetch original inquiry:", fetchError);
      return {
        success: false,
        error: "케이스를 찾을 수 없습니다.\nCase not found."
      };
    }

    const now = new Date().toISOString();
    const updatePayload: any = {
      status: "closed",
      reply_content: replyContent,
      replied_by: session.userId,
      replied_at: now,
      closed_at: now,
      closed_by: session.userId,
      closed_by_side: "admin",
      is_action_required: false,
      updated_at: now
    };

    // Update main inquiry row
    let updateRes = await adminSupabase
      .from("partner_inquiries")
      .update(updatePayload)
      .eq("id", inquiryId);

    // Fallback if closed_by_side column is temporarily missing
    if (updateRes.error && (updateRes.error.message?.includes("closed_by_side") || updateRes.error.code === "42703")) {
      delete updatePayload.closed_by_side;
      updateRes = await adminSupabase
        .from("partner_inquiries")
        .update(updatePayload)
        .eq("id", inquiryId);
    }

    if (updateRes.error) {
      console.error("Failed to save answer and close case:", updateRes.error);
      return {
        success: false,
        error: "답변 등록 및 케이스 종료를 완료하지 못했습니다. 다시 시도해주세요.\nUnable to send the reply and close the case. Please try again."
      };
    }

    // Insert Human Communication Message into thread
    await adminSupabase
      .from("partner_inquiry_messages")
      .insert({
        inquiry_id: inquiryId,
        sender_type: "admin",
        sender_id: session.userId,
        sender_name: "어드민 담당자",
        content: replyContent,
        message_type: "message",
        is_action_flag: false
      });

    // Insert Audit Trail Log Event for Case Close
    await adminSupabase
      .from("partner_inquiry_messages")
      .insert({
        inquiry_id: inquiryId,
        sender_type: "admin",
        sender_id: session.userId,
        sender_name: "어드민 담당자",
        content: "어드민 담당자가 답변 등록 후 케이스를 종료했습니다.",
        message_type: "case_closed",
        is_action_flag: false
      });

    // Notify portal user
    const caseLabel = originalInquiry.case_number
      ? `케이스 ${originalInquiry.case_number}`
      : `문의 '${originalInquiry.title}'`;

    await createNotification(
      originalInquiry.created_by,
      session.userId,
      "케이스 답변 완료 및 종료",
      `${caseLabel}에 대한 답변이 등록되었으며 케이스가 종료되었습니다.`,
      "/portal/support"
    );

    revalidatePath("/admin/partner-inquiries");
    revalidatePath("/portal/support");
    revalidatePath("/admin", "layout");
    revalidatePath("/portal", "layout");
    return { success: true };
  } catch (e) {
    console.error("Failed to answer and close partner inquiry:", e);
    return {
      success: false,
      error: "답변 등록 및 케이스 종료를 완료하지 못했습니다. 다시 시도해주세요.\nUnable to send the reply and close the case. Please try again."
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// updateCaseStatus (admin → 상태 수동 변경)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 어드민에서 케이스 상태를 수동으로 변경합니다.
 */
export async function updateCaseStatus(inquiryId: string, newStatus: CaseStatus) {
  try {
    const session = await verifyAdminSession();
    const adminSupabase = createAdminClient();

    const { data: inquiry, error: fetchError } = await adminSupabase
      .from("partner_inquiries")
      .select("created_by, title, case_number")
      .eq("id", inquiryId)
      .single();

    if (fetchError || !inquiry) {
      return { success: false, error: "케이스를 찾을 수 없습니다." };
    }

    const updatePayload: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    // Clear action required flag if no longer applicable
    if (!["action_required"].includes(newStatus)) {
      updatePayload.is_action_required = false;
    }

    const { error: updateError } = await adminSupabase
      .from("partner_inquiries")
      .update(updatePayload)
      .eq("id", inquiryId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Log system event in thread
    const statusLabel = CASE_STATUS_LABEL[newStatus] || newStatus;
    await adminSupabase
      .from("partner_inquiry_messages")
      .insert({
        inquiry_id: inquiryId,
        sender_type: "admin",
        sender_id: session.userId,
        sender_name: "어드민 담당자",
        content: `케이스 상태가 [${statusLabel}]로 변경되었습니다.`,
        message_type: "status_change",
        is_action_flag: false
      });

    revalidatePath("/admin/partner-inquiries");
    revalidatePath("/portal/support");
    return { success: true };
  } catch (e) {
    console.error("Failed to update case status:", e);
    return { success: false, error: e instanceof Error ? e.message : "상태 변경 실패" };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// resolvePartnerInquiryAction (portal → 조치 완료 표시)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 브랜드사 포털에서 조치 완료 버튼을 눌러 action_resolved 상태로 변경합니다.
 */
export async function resolvePartnerInquiryAction(
  inquiryId: string,
  resolveContent?: string | null,
  resolveFile?: File | null
) {
  try {
    const { companyId, userId } = await requireCompanyMembership();
    const supabase = await createClient();

    const { data: inquiry, error: fetchError } = await supabase
      .from("partner_inquiries")
      .select("id, title, case_number, is_action_required")
      .eq("id", inquiryId)
      .eq("company_id", companyId)
      .single();

    if (fetchError || !inquiry) {
      return { success: false, error: "해당 케이스를 찾을 수 없습니다." };
    }

    const adminSupabase = createAdminClient();

    // Action resolution transitions status to 'in_review' (UNDER_REVIEW), NEVER CLOSED
    // Use adminSupabase to guarantee DB update succeeds bypassing client RLS policies
    const { error: updateError } = await adminSupabase
      .from("partner_inquiries")
      .update({
        is_action_required: false,
        status: "in_review",
        updated_at: new Date().toISOString()
      })
      .eq("id", inquiryId);

    if (updateError) {
      console.error("Failed to update inquiry action resolution:", updateError);
      return { success: false, error: "조치 완료 상태 변경에 실패했습니다." };
    }
    const { data: company } = await adminSupabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();

    const senderName = company?.name || "파트너사";

    // Handle Optional Attachment Upload
    let attachmentPath = null;
    let attachmentFilename = null;
    if (resolveFile && resolveFile.size > 0) {
      if (resolveFile.size > 20 * 1024 * 1024) {
        return { success: false, error: "첨부파일은 최대 20MB까지 업로드할 수 있습니다." };
      }
      const validation = await validateUploadedFile(resolveFile, ["image", "document"]);
      if (!validation.ok) {
        return { success: false, error: validation.error };
      }
      const path = `${companyId}/inquiries/${crypto.randomUUID()}.${extensionFor(validation.detectedMime)}`;
      const { error: uploadError } = await supabase.storage
        .from("company-uploads")
        .upload(path, resolveFile, { contentType: validation.detectedMime });

      if (!uploadError) {
        attachmentPath = path;
        attachmentFilename = resolveFile.name;
      }
    }

    // 1. Human Communication Message (Conversation Thread)
    const textMsg = resolveContent?.trim() || "조치 요청 사항을 확인하고 완료 처리하였습니다.";
    await supabase
      .from("partner_inquiry_messages")
      .insert({
        inquiry_id: inquiryId,
        sender_type: "partner",
        sender_id: userId,
        sender_name: senderName,
        content: textMsg,
        message_type: "message",
        attachment_path: attachmentPath,
        attachment_filename: attachmentFilename,
        is_action_flag: false
      });

    // 2. Audit Trail Log Event (Case Log Thread)
    await supabase
      .from("partner_inquiry_messages")
      .insert({
        inquiry_id: inquiryId,
        sender_type: "partner",
        sender_id: userId,
        sender_name: senderName,
        content: "파트너 조치 완료 (상태 전이: 조치필요 → 검토중)",
        message_type: "action_resolved",
        is_action_flag: false
      });

    // Notify all admin staff
    const { data: staffMembers } = await adminSupabase
      .from("staff_members")
      .select("id")
      .eq("status", "active");

    const caseLabel = inquiry.case_number ? `케이스 ${inquiry.case_number}` : `'${inquiry.title}'`;
    for (const staff of staffMembers ?? []) {
      await createNotification(
        staff.id,
        userId,
        "조치 완료 접수 (검토중)",
        `[${senderName}]에서 ${caseLabel} 조치를 완료했습니다. 검토가 필요합니다.`,
        "/admin/partner-inquiries"
      );
    }

    revalidatePath("/portal/support");
    revalidatePath("/admin/partner-inquiries");
    revalidatePath("/portal", "layout");
    revalidatePath("/admin", "layout");
    return { success: true };
  } catch (e) {
    console.error("Failed to resolve partner inquiry action:", e);
    return { success: false, error: "조치 완료 제출 중 오류가 발생했습니다." };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// replyToPartnerInquiry (portal → 추가 답변)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 포털에서 케이스에 추가 메시지를 작성합니다.
 */
export async function replyToPartnerInquiry(
  inquiryId: string,
  replyContent: string,
  attachmentFile?: File | null
) {
  try {
    const { companyId, userId } = await requireCompanyMembership();
    const supabase = await createClient();

    const adminSupabase = createAdminClient();
    const { data: company } = await adminSupabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .single();
    const senderName = company?.name || "파트너사";

    let attachmentPath = null;
    let attachmentFilename = null;

    if (attachmentFile && attachmentFile.size > 0) {
      if (attachmentFile.size > 20 * 1024 * 1024) {
        return { success: false, error: "첨부파일은 최대 20MB까지 업로드할 수 있습니다.\nAttachment files must be 20MB or smaller." };
      }

      const validation = await validateUploadedFile(attachmentFile, ["image", "document"]);
      if (!validation.ok) {
        return { success: false, error: validation.error };
      }

      const path = `${companyId}/inquiries/${crypto.randomUUID()}.${extensionFor(validation.detectedMime)}`;
      const { error: uploadError } = await supabase.storage
        .from("company-uploads")
        .upload(path, attachmentFile, { contentType: validation.detectedMime });

      if (uploadError) {
        console.error("Failed to upload reply attachment:", uploadError);
        return { success: false, error: "첨부파일 업로드에 실패했습니다." };
      }

      attachmentPath = path;
      attachmentFilename = attachmentFile.name;
    }

    await supabase.from("partner_inquiry_messages").insert({
      inquiry_id: inquiryId,
      sender_type: "partner",
      sender_id: userId,
      sender_name: senderName,
      content: replyContent,
      attachment_path: attachmentPath,
      attachment_filename: attachmentFilename,
      message_type: "message",
      is_action_flag: false
    });

    // Status → open (awaiting admin response)
    await supabase
      .from("partner_inquiries")
      .update({ status: "open", updated_at: new Date().toISOString() })
      .eq("id", inquiryId);

    // Notify admin staff
    const { data: staffMembers } = await adminSupabase
      .from("staff_members")
      .select("id")
      .eq("status", "active");

    for (const staff of staffMembers ?? []) {
      await createNotification(
        staff.id,
        userId,
        "케이스 추가 답변",
        `[${senderName}]에서 케이스에 추가 메시지를 등록했습니다.`,
        "/admin/partner-inquiries"
      );
    }

    revalidatePath("/portal/support");
    revalidatePath("/admin/partner-inquiries");
    return { success: true };
  } catch (e) {
    console.error("Failed to reply to partner inquiry:", e);
    return { success: false, error: e instanceof Error ? e.message : "답변 등록 실패" };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// closeCase (portal or admin → 케이스 종료)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 케이스를 포털 측에서 종료합니다. 만족도 평가를 포함할 수 있습니다.
 */
export async function closeCase(
  inquiryId: string,
  satisfactionScore?: number | null,
  satisfactionComment?: string | null
) {
  try {
    const { companyId, userId } = await requireCompanyMembership();
    const supabase = await createClient();

    const { data: inquiry, error: fetchError } = await supabase
      .from("partner_inquiries")
      .select("id, title, case_number, status")
      .eq("id", inquiryId)
      .eq("company_id", companyId)
      .single();

    if (fetchError || !inquiry) {
      return { success: false, error: "해당 케이스를 찾을 수 없습니다." };
    }

    const now = new Date().toISOString();
    const isAlreadyClosed = normalizeStatus(inquiry.status) === "closed";

    const updatePayload: any = {
      status: "closed",
      closed_at: now,
      closed_by: userId,
      closed_by_side: "portal",
      is_action_required: false,
      updated_at: now
    };

    if (satisfactionScore != null) {
      updatePayload.satisfaction_score = satisfactionScore;
      updatePayload.satisfaction_comment = satisfactionComment ?? null;
      updatePayload.satisfaction_at = now;
    }

    const adminSupabase = createAdminClient();

    let { data: updatedCase, error: updateError } = await adminSupabase
      .from("partner_inquiries")
      .update(updatePayload)
      .eq("id", inquiryId)
      .eq("company_id", companyId)
      .select("id, status")
      .maybeSingle();

    // Fallback if closed_by_side column is temporarily missing or cached
    if (updateError && (updateError.message?.includes("closed_by_side") || updateError.code === "42703")) {
      delete updatePayload.closed_by_side;
      const fallbackRes = await adminSupabase
        .from("partner_inquiries")
        .update(updatePayload)
        .eq("id", inquiryId)
        .eq("company_id", companyId)
        .select("id, status")
        .maybeSingle();
      updatedCase = fallbackRes.data;
      updateError = fallbackRes.error;
    }

    if (updateError || !updatedCase || updatedCase.status !== "closed") {
      console.error("Failed to close case in portal (DB status update unverified):", updateError);
      return {
        success: false,
        error: "문의 종료를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.\nUnable to close the inquiry. Please try again."
      };
    }

    const { data: company } = await adminSupabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();

    // Log event ONLY if not previously closed (Strict Idempotent protection)
    if (!isAlreadyClosed) {
      const closedMsg = satisfactionScore != null
        ? `케이스가 파트너사에 의해 종료되었습니다. (만족도: ${"★".repeat(satisfactionScore)}${"☆".repeat(5 - satisfactionScore)})`
        : "케이스가 파트너사에 의해 종료되었습니다.";

      await adminSupabase.from("partner_inquiry_messages").insert({
        inquiry_id: inquiryId,
        sender_type: "partner",
        sender_id: userId,
        sender_name: company?.name || "파트너사",
        content: closedMsg,
        message_type: "case_closed",
        is_action_flag: false
      });
    }

    // Notify admin staff
      const { data: staffMembers } = await adminSupabase
        .from("staff_members")
        .select("id")
        .eq("status", "active");

      const caseLabel = inquiry.case_number ? `케이스 ${inquiry.case_number}` : `'${inquiry.title}'`;
      for (const staff of staffMembers ?? []) {
        await createNotification(
          staff.id,
          userId,
          "케이스 종료",
          `[${company?.name || "회사"}]에서 ${caseLabel}를 종료했습니다.${satisfactionScore != null ? ` (만족도: ${satisfactionScore}/5)` : ""}`,
          "/admin/partner-inquiries"
        );
      }

    revalidatePath("/portal/support");
    revalidatePath("/admin/partner-inquiries");
    revalidatePath("/portal", "layout");
    revalidatePath("/admin", "layout");
    return { success: true };
  } catch (e) {
    console.error("Failed to close case in portal:", e);
    return {
      success: false,
      error: "문의 종료를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.\nUnable to close the inquiry. Please try again."
    };
  }
}

/**
 * 포털 파트너사 사용자가 종료된 케이스의 만족도를 평가하거나 수정합니다.
 */
export async function submitSatisfactionRating(
  inquiryId: string,
  satisfactionScore: number,
  satisfactionComment?: string | null
) {
  try {
    const { companyId, userId } = await requireCompanyMembership();
    const supabase = await createClient();

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("partner_inquiries")
      .update({
        satisfaction_score: satisfactionScore,
        satisfaction_comment: satisfactionComment ?? null,
        satisfaction_at: now,
        updated_at: now
      })
      .eq("id", inquiryId)
      .eq("company_id", companyId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Log rating event into thread for Case Log (1 record per rating)
    const adminSupabase = createAdminClient();
    const { data: company } = await adminSupabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();

    await supabase.from("partner_inquiry_messages").insert({
      inquiry_id: inquiryId,
      sender_type: "partner",
      sender_id: userId,
      sender_name: company?.name || "파트너사",
      content: `파트너 만족도 평가 작성: ${"★".repeat(satisfactionScore)}${"☆".repeat(5 - satisfactionScore)} (${satisfactionScore}점)${satisfactionComment ? ` "${satisfactionComment}"` : ""}`,
      message_type: "satisfaction",
      is_action_flag: false
    });

    revalidatePath("/portal/support");
    revalidatePath("/admin/partner-inquiries");
    return { success: true };
  } catch (e) {
    console.error("Failed to submit satisfaction rating:", e);
    return { success: false, error: e instanceof Error ? e.message : "만족도 등록 실패" };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// closeCaseAdmin (admin → 케이스 종료)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 어드민에서 답변 없이 케이스를 종료합니다.
 */
export async function closeCaseAdmin(inquiryId: string) {
  try {
    const session = await verifyAdminSession();
    const adminSupabase = createAdminClient();

    const { data: inquiry, error: fetchError } = await adminSupabase
      .from("partner_inquiries")
      .select("status")
      .eq("id", inquiryId)
      .single();

    if (fetchError || !inquiry) {
      return { success: false, error: "해당 케이스를 찾을 수 없습니다." };
    }

    const isAlreadyClosed = normalizeStatus(inquiry.status) === "closed";
    const now = new Date().toISOString();

    const updatePayload: any = {
      status: "closed",
      closed_at: now,
      closed_by: session.userId,
      closed_by_side: "admin",
      is_action_required: false,
      updated_at: now
    };

    let { error: updateError } = await adminSupabase
      .from("partner_inquiries")
      .update(updatePayload)
      .eq("id", inquiryId);

    if (updateError && (updateError.message?.includes("closed_by_side") || updateError.code === "42703")) {
      delete updatePayload.closed_by_side;
      const fallbackRes = await adminSupabase
        .from("partner_inquiries")
        .update(updatePayload)
        .eq("id", inquiryId);
      updateError = fallbackRes.error;
    }

    if (updateError) {
      console.error("Failed to close case in admin:", updateError);
      return {
        success: false,
        error: "케이스를 종료하지 못했습니다. 잠시 후 다시 시도해주세요.\nUnable to close the case. Please try again."
      };
    }

    const { data: staffDoc } = await adminSupabase
      .from("staff_members")
      .select("name")
      .eq("id", session.userId)
      .maybeSingle();
    const actorName = staffDoc?.name || "어드민 담당자";

    if (!isAlreadyClosed) {
      await adminSupabase.from("partner_inquiry_messages").insert({
        inquiry_id: inquiryId,
        sender_type: "admin",
        sender_id: session.userId,
        sender_name: actorName,
        content: `어드민 담당자(${actorName})가 답변 없이 케이스를 종료했습니다.`,
        message_type: "case_closed",
        is_action_flag: false
      });
    }

    revalidatePath("/admin/partner-inquiries");
    revalidatePath("/portal/support");
    revalidatePath("/admin", "layout");
    revalidatePath("/portal", "layout");
    return { success: true };
  } catch (e) {
    console.error("Failed to close case (admin):", e);
    return { success: false, error: e instanceof Error ? e.message : "케이스 종료 실패" };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// reopenCase (admin or portal → 케이스 재오픈)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 종료된 케이스를 재오픈합니다.
 */
export async function reopenCase(
  inquiryId: string,
  calledBy: "admin" | "portal",
  messageContent?: string | null
) {
  try {
    let userId: string;
    let senderName: string;
    const adminSupabase = createAdminClient();

    if (calledBy === "admin") {
      const session = await verifyAdminSession();
      userId = session.userId;
      senderName = "어드민 담당자";
    } else {
      const membership = await requireCompanyMembership();
      userId = membership.userId;
      
      // Verify ownership of this inquiry using admin client before doing anything
      const { data: inquiryCheck, error: checkError } = await adminSupabase
        .from("partner_inquiries")
        .select("company_id")
        .eq("id", inquiryId)
        .single();
        
      if (checkError || !inquiryCheck || inquiryCheck.company_id !== membership.companyId) {
        return { success: false, error: "이 케이스에 대한 권한이 없습니다." };
      }

      const { data: company } = await adminSupabase
        .from("companies")
        .select("name")
        .eq("id", membership.companyId)
        .maybeSingle();
      senderName = company?.name || "파트너사";
    }

    // Fetch current reopen count using admin client
    const { data: inquiry, error: fetchError } = await adminSupabase
      .from("partner_inquiries")
      .select("reopen_count")
      .eq("id", inquiryId)
      .single();

    if (fetchError || !inquiry) {
      return { success: false, error: "케이스를 찾을 수 없습니다." };
    }

    const newCount = (inquiry.reopen_count ?? 0) + 1;

    // Update case status to 'open' (접수됨) using admin client to bypass RLS restrictions on closed cases
    const { error: updateError } = await adminSupabase
      .from("partner_inquiries")
      .update({
        status: "open",
        closed_at: null,
        closed_by: null,
        reopen_count: newCount,
        updated_at: new Date().toISOString()
      })
      .eq("id", inquiryId);

    if (updateError) {
      console.error("Reopen update error:", updateError);
      return { success: false, error: updateError.message };
    }

    // 1) Log the system state change event (using admin client to bypass RLS)
    await adminSupabase.from("partner_inquiry_messages").insert({
      inquiry_id: inquiryId,
      sender_type: calledBy === "admin" ? "admin" : "partner",
      sender_id: userId,
      sender_name: senderName,
      content: `케이스가 재오픈되었습니다. (재오픈 ${newCount}회차)`,
      message_type: "case_reopened",
      is_action_flag: false
    });

    // 2) Log the user message if provided (using admin client to bypass RLS)
    if (messageContent && messageContent.trim()) {
      await adminSupabase.from("partner_inquiry_messages").insert({
        inquiry_id: inquiryId,
        sender_type: calledBy === "admin" ? "admin" : "partner",
        sender_id: userId,
        sender_name: senderName,
        content: messageContent.trim(),
        message_type: "message",
        is_action_flag: false
      });
    }

    revalidatePath("/admin/partner-inquiries");
    revalidatePath("/portal/support");
    return { success: true };
  } catch (e) {
    console.error("Failed to reopen case:", e);
    return { success: false, error: e instanceof Error ? e.message : "케이스 재오픈 실패" };
  }
}

/**
 * Fetch total count of pending/unread partner inquiries for Admin notification badges
 */
export async function getPendingPartnerInquiriesCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("partner_inquiries")
      .select("*", { count: "exact", head: true })
      .or("status.in.(open,pending,in_review,replied,action_required,reopened),is_action_required.eq.true");

    if (error) {
      console.warn("⚠️ getPendingPartnerInquiriesCount error:", error);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.warn("⚠️ getPendingPartnerInquiriesCount error:", err);
    return 0;
  }
}
