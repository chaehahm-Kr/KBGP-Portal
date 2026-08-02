import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 계정을 비활성화할 때 호출한다 (직원 퇴사 처리, 회사 사용자 삭제 등).
 * 10_보안과권한요구사항.md 3번 요구사항: "다음 로그인부터 차단"이 아니라
 * "지금 로그인되어 있어도 즉시 튕겨나감"이어야 한다.
 *
 * 구현 방법과 그 이유:
 *   - Supabase Auth의 액세스 토큰은 JWT라서, 이미 발급된 토큰 자체를 그 자리에서
 *     강제로 무효화하는 API는 없다(토큰은 만료 시각까지는 이론적으로 유효).
 *   - 대신 ban_duration으로 계정을 정지시키면 이후의 로그인·토큰 재발급이 모두 막히고,
 *     이 앱의 모든 세션 확인은 lib/auth/dal.ts의 verifySession()이 담당하는데
 *     그 함수는 캐시된 쿠키가 아니라 getUser()로 Supabase Auth 서버에 매번 재확인한다.
 *     정지된 계정은 getUser() 호출 시 서버가 즉시 오류를 반환하므로, 실질적으로는
 *     "비활성화 처리 직후의 다음 요청부터 튕겨나간다" — 이 앱의 세션 확인 방식과
 *     결합했을 때 사실상 즉시 차단과 동일한 효과를 낸다.
 *   - 완전 삭제(deleteUser)를 쓰지 않는 이유: 09_알림및문서관리규칙.md의 삭제 정책과
 *     10_보안과권한요구사항.md 5번("비활성화 + 접근 차단, 데이터는 보관")에 따라
 *     탈퇴·퇴사 시에도 데이터 자체는 남아있어야 하기 때문이다.
 */
export async function deactivateUserSessions(userId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "876000h", // 약 100년 — 사실상 영구 정지. 해제 시 "none"으로 갱신
  });

  if (error) {
    throw new Error(`계정 비활성화에 실패했습니다: ${error.message}`);
  }
}

export async function reactivateUserSessions(userId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });

  if (error) {
    throw new Error(`계정 재활성화에 실패했습니다: ${error.message}`);
  }
}
