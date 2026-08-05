"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplatedEmail } from "@/lib/notifications/templates";
import { validateUploadedFile } from "@/lib/files/validate";
import { createNotification } from "@/lib/notification/actions";

export type InfoRequestFormState = { error: string } | undefined;

const requestSchema = z.object({
  requestContent: z.string().trim().min(1, "요청 내용을 입력해주세요."),
  productId: z.string().trim().optional(),
});

// 09_알림및문서관리규칙.md는 정확한 회신 기한 일수를 정하지 않았다 — 제 판단으로
// 5영업일 상당을 기본값으로 잡았다. 다르게 운영하고 싶다면 이 상수만 고치면 된다.
const REPLY_DUE_DAYS = 5;

function formatDueDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * 08_주요화면과AC.md 화면 10. 신청서 전체에 대한 요청(productId 없음)일 수도,
 * 특정 제품에 대한 요청일 수도 있다. 요청을 보내는 즉시 신청 상태가
 * "추가자료요청"으로 바뀐다.
 */
export async function createInfoRequest(
  applicationId: string,
  _prevState: InfoRequestFormState,
  formData: FormData
): Promise<InfoRequestFormState> {
  const session = await verifyAdminSession();

  const parsed = requestSchema.safeParse({
    requestContent: formData.get("requestContent"),
    productId: formData.get("productId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." };
  }

  const admin = createAdminClient();

  const { data: application } = await admin
    .from("applications")
    .select("id, company_id, application_number")
    .eq("id", applicationId)
    .single();

  if (!application) {
    return { error: "신청서를 찾을 수 없습니다." };
  }

  const hasDeadline = formData.get("hasDeadline") === "true";
  const replyDueAtStr = formData.get("replyDueAt");

  let replyDueAt: string | null = null;
  if (hasDeadline && typeof replyDueAtStr === "string") {
    replyDueAt = new Date(`${replyDueAtStr}T23:59:59`).toISOString();
  }

  const { error: insertError } = await admin.from("additional_info_requests").insert({
    application_id: applicationId,
    company_id: application.company_id,
    product_id: parsed.data.productId || null,
    request_content: parsed.data.requestContent,
    requested_by: session.userId,
    reply_due_at: replyDueAt,
  });

  if (insertError) {
    return { error: "요청을 저장하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }

  await admin
    .from("applications")
    .update({ status: "info_requested" })
    .eq("id", applicationId);

  const { data: recipients } = await admin
    .from("company_users")
    .select("id, email")
    .eq("company_id", application.company_id)
    .in("status", ["active", "invited"]);

  const firstUserId = recipients?.[0]?.id;
  if (firstUserId) {
    // 1:1 문의 채널에 '조치 필요(Action Required)' 형태로 추가 자료 요청 내용 연동 삽입
    await admin.from("partner_inquiries").insert({
      company_id: application.company_id,
      created_by: firstUserId,
      category: "onboarding",
      title: `[자료요청] 신청서 ${application.application_number} 추가 자료 요청`,
      content: `어드민 심사위원으로부터 신청서 ${application.application_number}에 대한 추가 자료 요청이 접수되었습니다. 아래 요청 내용을 검토하시고 필요한 조치를 이행해 주세요.`,
      status: "replied",
      reply_content: parsed.data.requestContent,
      replied_by: session.userId,
      replied_at: new Date().toISOString(),
      is_action_required: true,
    });

    // 실시간 B2B 알림 센터에 추가 자료 요청 알림 주입
    await createNotification(
      firstUserId,
      session.userId,
      "추가 자료 요청",
      `신청서 ${application.application_number} 건에 대한 추가 자료 요청이 등록되었습니다. 내용을 확인하고 조치해 주세요.`,
      "/portal/support"
    );
  }

  const dueDateVal = replyDueAt ? formatDueDate(replyDueAt) : "";

  for (const recipient of recipients ?? []) {
    await sendTemplatedEmail("info_request_created", recipient.email, {
      applicationNumber: application.application_number,
      requestContent: parsed.data.requestContent,
      dueDate: dueDateVal,
    });
  }

  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath(`/portal/applications/${applicationId}`);
  revalidatePath(`/portal/support`);
}

/**
 * 08_주요화면과AC.md 화면 7의 회신 처리. 회신을 제출하면 신청 상태가 자동으로
 * "재검토중"으로 바뀌고, 요청했던 담당자에게 알림이 간다. 요청·회신 쌍은 삭제/덮어쓰기
 * 없이 그대로 남아 여러 차례 주고받은 이력이 전부 보존된다.
 */
export async function replyToInfoRequest(
  requestId: string,
  applicationId: string,
  _prevState: InfoRequestFormState,
  formData: FormData
): Promise<InfoRequestFormState> {
  const { companyId } = await requireCompanyMembership();

  const replyContent = String(formData.get("replyContent") ?? "").trim();
  if (!replyContent) {
    return { error: "회신 내용을 입력해주세요." };
  }

  // RLS(air_select_own_or_admin)가 본인 회사 요청이 아니면 애초에 못 읽는다.
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("additional_info_requests")
    .select("id, company_id, status")
    .eq("id", requestId)
    .single();

  if (!request || request.company_id !== companyId) {
    return { error: "요청을 찾을 수 없습니다." };
  }
  if (request.status === "replied") {
    return { error: "이미 회신을 제출한 요청입니다." };
  }

  let attachmentPath: string | null = null;
  const file = formData.get("attachment");
  if (file instanceof File && file.size > 0) {
    const validation = await validateUploadedFile(file, [
      "document",
      "image",
      "spreadsheet",
    ]);
    if (!validation.ok) {
      return { error: validation.error };
    }

    attachmentPath = `${companyId}/applications/${applicationId}/info-requests/${requestId}/${crypto.randomUUID()}`;
    const { error: uploadError } = await supabase.storage
      .from("company-uploads")
      .upload(attachmentPath, file, { contentType: validation.detectedMime });
    if (uploadError) {
      return { error: "파일 업로드에 실패했습니다." };
    }
  }

  const admin = createAdminClient();

  await admin
    .from("additional_info_requests")
    .update({
      reply_content: replyContent,
      reply_attachment_path: attachmentPath,
      status: "replied",
      replied_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  const { data: application } = await admin
    .from("applications")
    .select("application_number")
    .eq("id", applicationId)
    .single();

  await admin
    .from("applications")
    .update({ status: "re_review" })
    .eq("id", applicationId);

  const { data: originalRequest } = await admin
    .from("additional_info_requests")
    .select("requested_by")
    .eq("id", requestId)
    .single();

  if (originalRequest) {
    const { data: staffMember } = await admin
      .from("staff_members")
      .select("email")
      .eq("id", originalRequest.requested_by)
      .maybeSingle();

    if (staffMember) {
      await sendTemplatedEmail("info_request_replied", staffMember.email, {
        applicationNumber: application?.application_number ?? "",
      });
    }
  }

  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath(`/portal/applications/${applicationId}`);
}
