"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplatedEmail } from "@/lib/notifications/templates";
import { recordActivity } from "@/lib/activity/log";

export type AssignmentFormState = { error: string } | undefined;

/**
 * 08_주요화면과AC.md 화면 12. 02_사용자유형과권한표.md 권한 매트릭스: "담당자 배정 |
 * 자기 자신만 가능(제안, Reviewer) | 허용(전체 배정, Super Admin)". Super Admin은
 * 누구에게나 배정할 수 있고, 그 외 관리자는 아직 담당자가 없는 신청서를 자기
 * 자신에게 가져가는 것만 허용한다(남에게 넘기는 건 Super Admin만).
 *
 * 최초 배정 시에만 신청 상태를 제출됨 -> 배정됨으로 바꾼다(이미 심사가 진행된
 * 신청서를 재배정해도 심사중 상태 등은 그대로 유지).
 */
export async function assignApplication(
  applicationId: string,
  _prevState: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const session = await verifyAdminSession();
  const staffId = String(formData.get("staffId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!staffId) {
    return { error: "담당자를 선택해주세요." };
  }

  const admin = createAdminClient();

  const { data: callerRoles } = await admin
    .from("staff_roles")
    .select("role")
    .eq("staff_id", session.userId);
  const isSuperAdmin = (callerRoles ?? []).some((r) => r.role === "super_admin");

  const { data: currentAssignment } = await admin
    .from("assignments")
    .select("id, staff_id")
    .eq("application_id", applicationId)
    .eq("is_current", true)
    .maybeSingle();

  if (!isSuperAdmin && (currentAssignment || staffId !== session.userId)) {
    return {
      error: "이미 배정된 신청서를 다른 담당자로 바꾸는 것은 Super Admin만 할 수 있습니다.",
    };
  }

  if (currentAssignment) {
    await admin
      .from("assignments")
      .update({ is_current: false })
      .eq("id", currentAssignment.id);
  }

  const { error: insertError } = await admin.from("assignments").insert({
    application_id: applicationId,
    staff_id: staffId,
    assigned_by: session.userId,
    assignment_reason: reason || null,
  });

  if (insertError) {
    return { error: "배정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }

  const { data: application } = await admin
    .from("applications")
    .select("application_number, status")
    .eq("id", applicationId)
    .single();

  if (application?.status === "submitted") {
    await admin
      .from("applications")
      .update({ status: "assigned" })
      .eq("id", applicationId);
  }

  const { data: newStaff } = await admin
    .from("staff_members")
    .select("name, email")
    .eq("id", staffId)
    .single();

  await recordActivity({
    entityType: "assignment",
    entityId: applicationId,
    beforeState: currentAssignment ? `이전 담당자 ID ${currentAssignment.staff_id}` : null,
    afterState: `담당자: ${newStaff?.name || newStaff?.email || staffId}`,
    changedBy: session.userId,
    reason: reason || null,
  });

  if (newStaff) {
    await sendTemplatedEmail("assignment_assigned", newStaff.email, {
      applicationNumber: application?.application_number ?? "",
      reasonLine: reason ? ` 배정 사유: ${reason}` : "",
    });
  }

  // 09_알림및문서관리규칙.md 표에는 "배정 해제됨" 알림 채널이 인앱으로 되어 있지만,
  // 인앱 알림함 화면은 아직 없다(명세서 09 대시보드 범위) — 지금은 이메일로 대체한다.
  if (currentAssignment && currentAssignment.staff_id !== staffId) {
    const { data: prevStaff } = await admin
      .from("staff_members")
      .select("email")
      .eq("id", currentAssignment.staff_id)
      .single();
    if (prevStaff) {
      await sendTemplatedEmail("assignment_unassigned", prevStaff.email, {
        applicationNumber: application?.application_number ?? "",
      });
    }
  }

  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath(`/admin/applications`);
}
