"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplatedEmail } from "@/lib/notifications/templates";
import { publicEnv } from "@/lib/env/public";
import { SELF_CHECK_ITEMS } from "@/lib/application/types";
import { createNotification } from "@/lib/notification/actions";

export type ApplicationFormState = { error: string } | undefined;

/**
 * 08_주요화면과AC.md 화면 5(신청서 작성). "새 신청서 작성"을 누르면 빈 draft를 먼저
 * 만들고 편집 화면으로 보낸다 — 편집 중 이탈해도 임시저장된 상태로 남는다.
 */
export async function createDraftApplication() {
  const { companyId, userId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { data: application, error } = await supabase
    .from("applications")
    .insert({ company_id: companyId, created_by: userId })
    .select("id")
    .single();

  if (error || !application) {
    throw new Error("신청서를 생성하지 못했습니다.");
  }

  redirect(`/portal/applications/${application.id}`);
}

/**
 * 임시저장 — 제품 선택, 신청 동기, 자가진단 응답을 저장한다. draft 상태가 아니면
 * RLS(applications_update_while_draft)가 애초에 이 update를 거부한다.
 */
export async function saveDraftApplication(
  applicationId: string,
  _prevState: ApplicationFormState,
  formData: FormData
): Promise<ApplicationFormState> {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const productIds = formData.getAll("productIds").map(String);
  const selfCheckAnswers = SELF_CHECK_ITEMS.map(
    (_, index) => formData.get(`selfCheck_${index}`) === "on"
  );

  const { error: updateError } = await supabase
    .from("applications")
    .update({
      self_check_answers: selfCheckAnswers,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (updateError) {
    return { error: "저장하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }

  const { data: existingLinks } = await supabase
    .from("application_products")
    .select("id, product_id")
    .eq("application_id", applicationId);

  const existingProductIds = new Set((existingLinks ?? []).map((l) => l.product_id));
  const nextProductIds = new Set(productIds);

  const toRemove = (existingLinks ?? []).filter((l) => !nextProductIds.has(l.product_id));
  const toAdd = productIds.filter((id) => !existingProductIds.has(id));

  if (toRemove.length > 0) {
    await supabase
      .from("application_products")
      .delete()
      .in("id", toRemove.map((l) => l.id));
  }

  if (toAdd.length > 0) {
    await supabase.from("application_products").insert(
      toAdd.map((productId) => ({
        application_id: applicationId,
        product_id: productId,
        company_id: companyId,
      }))
    );
  }

  revalidatePath(`/portal/applications/${applicationId}`);
}

/**
 * 08_주요화면과AC.md 화면 5 AC: "제품을 최소 1개 선택하지 않으면 제출 불가",
 * "제출 즉시 신청서 상태가 제출됨으로 바뀌고... 신청번호가 자동 발급되어".
 */
export async function submitApplication(
  applicationId: string,
  _prevState: ApplicationFormState
): Promise<ApplicationFormState> {
  const { companyId, userId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { count } = await supabase
    .from("application_products")
    .select("id", { count: "exact", head: true })
    .eq("application_id", applicationId);

  if (!count || count === 0) {
    return { error: "제품을 최소 1개 선택해야 제출할 수 있습니다." };
  }

  const { data: numberResult, error: numberError } = await supabase.rpc(
    "generate_application_number"
  );

  if (numberError || !numberResult) {
    return { error: "신청번호를 발급하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }

  const { error: updateError } = await supabase
    .from("applications")
    .update({
      status: "submitted",
      application_number: numberResult,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .eq("status", "draft");

  if (updateError) {
    return { error: "제출하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }

  await notifySubmission(applicationId, companyId, userId, numberResult, count);

  redirect(`/portal/applications/${applicationId}`);
}

/**
 * 09_알림및문서관리규칙.md 이벤트 목록의 "신청서 제출 완료"(제출한 담당자 본인)와
 * "신규 신청서 접수"(내부 직원 전체)를 한 번에 처리한다. Phase 1에는 아직 별도
 * Reviewer 역할 배정이 없으므로(`02_사용자유형과권한표.md` — "Phase 1에서는 역할만
 * 만들어두고") 활성 상태인 staff_members 전원을 내부 수신자로 본다.
 */
async function notifySubmission(
  applicationId: string,
  companyId: string,
  submitterId: string,
  applicationNumber: string,
  productCount: number
) {
  const admin = createAdminClient();

  const [{ data: submitter }, { data: company }, { data: staffMembers }] = await Promise.all([
    admin.from("company_users").select("email").eq("id", submitterId).maybeSingle(),
    admin.from("companies").select("name").eq("id", companyId).maybeSingle(),
    admin.from("staff_members").select("id, email").eq("status", "active"),
  ]);

  if (submitter) {
    await sendTemplatedEmail("application_submitted_company", submitter.email, {
      applicationNumber,
    });

    // Create database notification for submitter
    await createNotification(
      submitterId,
      null,
      "신청서 제출 완료",
      `입점 신청서(${applicationNumber})가 성공적으로 제출되었습니다.`,
      `/portal/applications/${applicationId}`
    );
  }

  const link = `${publicEnv.NEXT_PUBLIC_SITE_URL}/admin/applications/${applicationId}`;
  for (const staff of staffMembers ?? []) {
    await sendTemplatedEmail("application_received_internal", staff.email, {
      applicationNumber,
      companyName: company?.name ?? "",
      productCount: String(productCount),
      link,
    });

    // Create database notification for staff/admin
    await createNotification(
      staff.id,
      submitterId,
      "신규 입점 신청서 접수",
      `[${company?.name || "회사"}]에서 신규 입점 신청서(${applicationNumber}, 제품 ${productCount}건)를 제출했습니다.`,
      `/admin/applications/${applicationId}`
    );
  }
}
