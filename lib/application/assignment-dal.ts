import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 08_주요화면과AC.md 화면 9 권한 규칙: "배정된 Reviewer 또는 Super Admin만 심사 가능.
 * 배정되지 않은 다른 Reviewer는 조회는 가능하되 심사 버튼 비활성화". 담당자가 아직
 * 없는 신청서는(화면 12 AC: "담당자가 없는 상태로도 신청서 열람과 심사가 기술적으로는
 * 가능") 관리자 누구나 심사할 수 있다.
 *
 * lib/application/review-actions.ts(서버에서 실제로 막는 곳)와 관리자 화면(버튼을
 * 보여줄지 결정하는 곳) 양쪽에서 재사용한다.
 */
export async function canReviewApplication(
  applicationId: string,
  staffId: string
): Promise<boolean> {
  const admin = createAdminClient();

  const { data: roles } = await admin
    .from("staff_roles")
    .select("role")
    .eq("staff_id", staffId);
  if ((roles ?? []).some((r) => r.role === "super_admin")) {
    return true;
  }

  const { data: assignment } = await admin
    .from("assignments")
    .select("staff_id")
    .eq("application_id", applicationId)
    .eq("is_current", true)
    .maybeSingle();

  if (!assignment) return true; // 미배정이면 전체 허용
  return assignment.staff_id === staffId;
}
