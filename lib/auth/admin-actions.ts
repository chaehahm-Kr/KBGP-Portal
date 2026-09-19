import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeAdminAuthMutation } from "@/lib/auth/guard";

/**
 * 계정을 비활성화할 때 호출한다 (직원 퇴사 처리, 회사 사용자 삭제 등).
 * 10_보안과권한요구사항.md 3번 요구사항: "다음 로그인부터 차단"이 아니라
 * "지금 로그인되어 있어도 즉시 튕겨나감"이어야 한다.
 */
export async function deactivateUserSessions(userId: string) {
  return await safeAdminAuthMutation(userId, "deactivateUserSessions", async () => {
    const supabase = createAdminClient();
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: "876000h", // 약 100년 — 사실상 영구 정지. 해제 시 "none"으로 갱신
    });

    if (error) {
      throw new Error(`계정 비활성화에 실패했습니다: ${error.message}`);
    }
  });
}

export async function reactivateUserSessions(userId: string) {
  return await safeAdminAuthMutation(userId, "reactivateUserSessions", async () => {
    const supabase = createAdminClient();
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: "none",
    });

    if (error) {
      throw new Error(`계정 재활성화에 실패했습니다: ${error.message}`);
    }
  });
}

