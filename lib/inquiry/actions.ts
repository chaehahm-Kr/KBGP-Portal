"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyMembership } from "@/lib/company/dal";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notification/actions";
import { validateUploadedFile } from "@/lib/files/validate";
import { getSignedFileUrl } from "@/lib/files/storage";
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
  if (raw === "pending") return "open";
  if (raw === "replied") return "in_review";
  return raw as CaseStatus;
}

/** Fetch threaded messages for an inquiry, with fallback for missing table */
async function getMessagesForInquiry(
  supabase: any,
  item: any,
  defaultSenderName: string,
  repliedStaffName: string | undefined
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
          senderName: repliedStaffName || "어드민 담당자",
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
      (m: any) => m.content === item.content && m.sender_type === "partner"
    );
    if (!hasInitial) {
      result.push({
        id: "initial-" + item.id,
        senderType: "partner",
        senderName: defaultSenderName,
        content: item.content,
        messageType: "message",
        isActionFlag: false,
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
      result.push({
        id: m.id,
        senderType: m.sender_type as "partner" | "admin" | "system",
        senderName: m.sender_name,
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
      if (file.size > 10 * 1024 * 1024) {
        return { success: false, error: "첨부파일은 최대 10MB를 초과할 수 없습니다." };
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

    const { data: newInquiry, error } = await supabase
      .from("partner_inquiries")
      .insert({
        company_id: companyId,
        created_by: userId,
        category,
        title,
        content,
        attachment_path: attachmentPath,
        attachment_filename: attachmentFilename,
        status: "open",
        is_action_required: false
      })
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("Could not find the table")) {
        console.warn("⚠️ [주의] partner_inquiries 테이블이 데이터베이스에 존재하지 않습니다. supabase/migrations/0021_partner_inquiries.sql 마이그레이션 SQL을 Supabase SQL Editor에서 실행해 주세요.");
        return { success: false, error: "1:1 문의 테이블이 존재하지 않습니다. Supabase SQL Editor에서 마이그레이션을 먼저 실행해주세요." };
      }
      console.error("Failed to create partner inquiry:", error);
      return { success: false, error: error.message };
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
      .order("created_at", { ascending: false });

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
          repliedStaffName
        );

        return {
          ...item,
          status: normalizeStatus(item.status) as CaseStatus,
          attachment_url: attachmentUrl,
          repliedStaffName,
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
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch admin partner inquiries:", error);
      return [];
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
          repliedStaffName
        );

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
          reopen_count: item.reopen_count ?? 0,
          satisfaction_score: item.satisfaction_score,
          satisfaction_comment: item.satisfaction_comment,
          created_at: item.created_at,
          updated_at: item.updated_at,
          companyName: item.companies?.name || "(알 수 없음)",
          repliedStaffName,
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
// answerPartnerInquiry (admin → 답변 + 상태 변경)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 어드민에서 케이스에 답변을 작성합니다.
 * isActionRequired = true 이면 status → action_required
 * isActionRequired = false 이면 status → in_review (awaiting_reply로 브랜드사 답변 대기)
 */
export async function answerPartnerInquiry(
  inquiryId: string,
  replyContent: string,
  isActionRequired: boolean
) {
  try {
    const session = await verifyAdminSession();
    const adminSupabase = createAdminClient();

    const { data: originalInquiry, error: fetchError } = await adminSupabase
      .from("partner_inquiries")
      .select("created_by, title, case_number")
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

    // Log message into thread
    await adminSupabase
      .from("partner_inquiry_messages")
      .insert({
        inquiry_id: inquiryId,
        sender_type: "admin",
        sender_id: session.userId,
        sender_name: "어드민 담당자",
        content: replyContent,
        message_type: isActionRequired ? "action_required" : "message",
        is_action_flag: isActionRequired
      });

    // Notify portal user
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
export async function resolvePartnerInquiryAction(inquiryId: string) {
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

    const { error: updateError } = await supabase
      .from("partner_inquiries")
      .update({
        is_action_required: false,
        status: "action_resolved",
        updated_at: new Date().toISOString()
      })
      .eq("id", inquiryId);

    if (updateError) {
      console.error("Failed to update inquiry action resolution:", updateError);
      return { success: false, error: updateError.message };
    }

    // Log action_resolved in thread
    const adminSupabase = createAdminClient();
    const { data: company } = await adminSupabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();

    await supabase
      .from("partner_inquiry_messages")
      .insert({
        inquiry_id: inquiryId,
        sender_type: "partner",
        sender_id: userId,
        sender_name: company?.name || "파트너사",
        content: "조치 요청 사항을 완료했습니다.",
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
        "조치 완료 접수",
        `[${company?.name || "회사"}]에서 ${caseLabel} 조치를 완료했습니다.`,
        "/admin/partner-inquiries"
      );
    }

    revalidatePath("/portal/support");
    revalidatePath("/admin/partner-inquiries");
    return { success: true };
  } catch (e) {
    console.error("Failed to resolve partner inquiry action:", e);
    return { success: false, error: e instanceof Error ? e.message : "조치 완료 제출 실패" };
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
      if (attachmentFile.size > 10 * 1024 * 1024) {
        return { success: false, error: "첨부파일은 최대 10MB를 초과할 수 없습니다." };
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
 * 케이스를 종료합니다. 포털 측에서 호출 시 만족도 평가를 포함할 수 있습니다.
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
      .select("id, title, case_number")
      .eq("id", inquiryId)
      .eq("company_id", companyId)
      .single();

    if (fetchError || !inquiry) {
      return { success: false, error: "해당 케이스를 찾을 수 없습니다." };
    }

    const now = new Date().toISOString();
    const updatePayload: any = {
      status: "closed",
      closed_at: now,
      closed_by: userId,
      is_action_required: false,
      updated_at: now
    };

    if (satisfactionScore != null) {
      updatePayload.satisfaction_score = satisfactionScore;
      updatePayload.satisfaction_comment = satisfactionComment ?? null;
      updatePayload.satisfaction_at = now;
    }

    const { error: updateError } = await supabase
      .from("partner_inquiries")
      .update(updatePayload)
      .eq("id", inquiryId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Log case_closed in thread
    const adminSupabase = createAdminClient();
    const { data: company } = await adminSupabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();

    const closedMsg = satisfactionScore != null
      ? `케이스가 종료되었습니다. (만족도: ${"★".repeat(satisfactionScore)}${"☆".repeat(5 - satisfactionScore)})`
      : "케이스가 종료되었습니다.";

    await supabase.from("partner_inquiry_messages").insert({
      inquiry_id: inquiryId,
      sender_type: "partner",
      sender_id: userId,
      sender_name: company?.name || "파트너사",
      content: closedMsg,
      message_type: "case_closed",
      is_action_flag: false
    });

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
    return { success: true };
  } catch (e) {
    console.error("Failed to close case:", e);
    return { success: false, error: e instanceof Error ? e.message : "케이스 종료 실패" };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// closeCaseAdmin (admin → 케이스 종료)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 어드민에서 케이스를 강제 종료합니다.
 */
export async function closeCaseAdmin(inquiryId: string) {
  try {
    const session = await verifyAdminSession();
    const adminSupabase = createAdminClient();

    const now = new Date().toISOString();
    const { error: updateError } = await adminSupabase
      .from("partner_inquiries")
      .update({
        status: "closed",
        closed_at: now,
        closed_by: session.userId,
        is_action_required: false,
        updated_at: now
      })
      .eq("id", inquiryId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    await adminSupabase.from("partner_inquiry_messages").insert({
      inquiry_id: inquiryId,
      sender_type: "admin",
      sender_id: session.userId,
      sender_name: "어드민 담당자",
      content: "어드민에 의해 케이스가 종료되었습니다.",
      message_type: "case_closed",
      is_action_flag: false
    });

    revalidatePath("/admin/partner-inquiries");
    revalidatePath("/portal/support");
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
