"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplatedEmail, type TemplateKey } from "@/lib/notifications/templates";
import { canReviewApplication } from "@/lib/application/assignment-dal";
import { recordActivity } from "@/lib/activity/log";
import { createNotification } from "@/lib/notification/actions";
import type { ApplicationStatus } from "@/lib/application/types";

export type ReviewFormState = { error: string } | undefined;

const reviewSchema = z
  .object({
    reviewStatus: z.enum(["approved", "on_hold", "rejected"] as const),
    reviewReason: z.string().trim().optional(),
  })
  // 08_주요화면과AC.md 화면 9 AC: "반려·보류 선택 시 사유를 입력하지 않으면 저장 불가(강제)".
  .refine(
    (data) => data.reviewStatus === "approved" || Boolean(data.reviewReason),
    { message: "보류 또는 반려 사유를 입력해주세요.", path: ["reviewReason"] }
  );

const FINAL_STATUSES: ApplicationStatus[] = [
  "approved",
  "partial_approved",
  "on_hold",
  "rejected",
];

/**
 * 06_상태값정의.md의 자동 집계 규칙을 그대로 구현한다. 제품이 하나라도 아직 최종
 * 판단 전(검토대기/검토중/보완요청)이면 신청 상태는 심사중으로 유지한다.
 *
 * "일부는 반려, 일부는 보류이고 승인은 하나도 없는" 조합은 06_상태값정의.md의 4가지
 * 규칙 어디에도 명시되어 있지 않다 — 문서 스스로 "제 판단으로 설계한 부분"이라고
 * 밝힌 영역이라, 여기서는 보수적으로 보류로 처리한다(반려로 단정하기엔 이르다고 봄).
 * 실제 운영 방식이 다르면 이 함수만 고치면 된다.
 */
function computeAggregatedStatus(
  reviewStatuses: string[]
): ApplicationStatus {
  const stillPending = reviewStatuses.some(
    (s) => s === "pending" || s === "reviewing" || s === "info_requested"
  );
  if (stillPending) return "under_review";

  const total = reviewStatuses.length;
  const approvedCount = reviewStatuses.filter((s) => s === "approved").length;
  const rejectedCount = reviewStatuses.filter((s) => s === "rejected").length;

  if (approvedCount === total) return "approved";
  if (rejectedCount === total) return "rejected";
  if (approvedCount === 0) return "on_hold";
  return "partial_approved";
}

const RESULT_TEMPLATE_KEY: Partial<Record<ApplicationStatus, TemplateKey>> = {
  approved: "review_result_approved",
  partial_approved: "review_result_partial_approved",
  on_hold: "review_result_on_hold",
  rejected: "review_result_rejected",
};

async function notifyCompanyOfResult(
  companyId: string,
  applicationNumber: string,
  status: ApplicationStatus
) {
  const templateKey = RESULT_TEMPLATE_KEY[status];
  if (!templateKey) return;

  const admin = createAdminClient();
  const { data: recipients } = await admin
    .from("company_users")
    .select("id, email")
    .eq("company_id", companyId)
    .eq("status", "active");

  const statusLabel: Record<string, string> = {
    approved: "최종 승인",
    partial_approved: "부분 승인",
    on_hold: "심사 보류",
    rejected: "심사 반려",
  };

  const title = `입점 신청 결과 안내`;
  const content = `신청서(${applicationNumber})의 심사 결과가 [${statusLabel[status] || status}] 상태로 변경되었습니다.`;

  for (const recipient of recipients ?? []) {
    await sendTemplatedEmail(templateKey, recipient.email, { applicationNumber });

    // Create database notification for company users
    await createNotification(
      recipient.id,
      null,
      title,
      content,
      `/portal/applications`
    );
  }
}

/**
 * 08_주요화면과AC.md 화면 9(관리자 신청서 상세 — 심사). 제품 하나에 대한 승인/보류/반려를
 * 저장하고, 그 즉시 06_상태값정의.md 자동 집계 규칙에 따라 신청서 전체 상태를 다시
 * 계산한다 — "관리자가 별도로 '전체 승인' 버튼을 누를 필요가 없다"는 AC를 만족시키는
 * 지점이다. 최종 상태로 확정되는 순간에만(그리고 실제로 상태가 바뀐 경우에만)
 * 회사에 이메일을 보낸다.
 *
 * 배정된 담당자가 있으면 그 사람 또는 Super Admin만 심사할 수 있다(명세서 07,
 * lib/application/assignment-dal.ts). 아직 아무도 배정되지 않았으면 관리자 누구나
 * 심사할 수 있다.
 */
export async function reviewApplicationProduct(
  applicationProductId: string,
  applicationId: string,
  _prevState: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  const session = await verifyAdminSession();

  if (!(await canReviewApplication(applicationId, session.userId))) {
    return { error: "배정된 담당자만 이 신청서를 심사할 수 있습니다." };
  }

  const parsed = reviewSchema.safeParse({
    reviewStatus: formData.get("reviewStatus"),
    reviewReason: formData.get("reviewReason"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.",
    };
  }

  const admin = createAdminClient();

  const { data: previousLink } = await admin
    .from("application_products")
    .select("review_status")
    .eq("id", applicationProductId)
    .single();

  const { error: updateError } = await admin
    .from("application_products")
    .update({
      review_status: parsed.data.reviewStatus,
      review_reason: parsed.data.reviewReason || null,
      reviewed_at: new Date().toISOString(),
      reviewer_id: session.userId,
    })
    .eq("id", applicationProductId)
    .eq("application_id", applicationId);

  if (updateError) {
    return { error: "저장하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }

  await recordActivity({
    entityType: "application_product",
    entityId: applicationProductId,
    beforeState: previousLink?.review_status ?? null,
    afterState: parsed.data.reviewStatus,
    changedBy: session.userId,
    reason: parsed.data.reviewReason || null,
  });

  const { data: application } = await admin
    .from("applications")
    .select("id, company_id, application_number, status")
    .eq("id", applicationId)
    .single();

  if (!application) {
    return { error: "신청서를 찾을 수 없습니다." };
  }

  const { data: links } = await admin
    .from("application_products")
    .select("review_status")
    .eq("application_id", applicationId);

  const aggregatedStatus = computeAggregatedStatus(
    (links ?? []).map((l) => l.review_status)
  );

  if (aggregatedStatus !== application.status) {
    await admin
      .from("applications")
      .update({ status: aggregatedStatus })
      .eq("id", applicationId);

    await recordActivity({
      entityType: "application",
      entityId: applicationId,
      beforeState: application.status,
      afterState: aggregatedStatus,
      changedBy: session.userId,
    });

    if (FINAL_STATUSES.includes(aggregatedStatus) && application.application_number) {
      await notifyCompanyOfResult(
        application.company_id,
        application.application_number,
        aggregatedStatus
      );
    }
  }

  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath(`/portal/applications/${applicationId}`);
}
