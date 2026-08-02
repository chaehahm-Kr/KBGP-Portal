"use server";

import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env/public";

export type ResetRequestState = { message: string } | undefined;

/**
 * 08_주요화면과AC.md 로그인/비밀번호재설정 AC: "재설정 링크는 1회용, 30분 유효".
 * 링크의 1회성·만료 시간은 Supabase 프로젝트 설정(Authentication > Email > Reset
 * Password 토큰 유효기간)에서 관리한다 — 이 서버 액션은 발송 요청만 담당한다.
 *
 * 계정 존재 여부를 노출하지 않기 위해(10_보안과권한요구사항.md 3번, 정보 노출 최소화
 * 원칙과 동일한 정신) 성공/실패와 무관하게 항상 같은 안내 문구를 반환한다.
 */
export async function requestPasswordReset(
  _prevState: ResetRequestState,
  formData: FormData
): Promise<ResetRequestState> {
  const email = formData.get("email");

  if (typeof email === "string" && email) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/portal/reset-password/confirm`,
    });
  }

  return {
    message:
      "입력하신 이메일로 가입된 계정이 있다면, 비밀번호 재설정 링크를 보내드렸습니다.",
  };
}
