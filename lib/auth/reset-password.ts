"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { renderEmailHtml } from "@/lib/notifications/templates";
import { sendEmail } from "@/lib/notifications/email";
import { headers } from "next/headers";

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
    const emailStr = email.trim();
    const adminClient = createAdminClient();
    
    // Get current site URL dynamically from headers to prevent localhost redirection bugs
    const headersList = await headers();
    const host = headersList.get("host") || "portal.kselectnetwork.com";
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    const siteUrl = `${protocol}://${host}`;

    // Generate the recovery link
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: emailStr,
      options: {
        redirectTo: `${siteUrl}/portal/reset-password/confirm`,
      },
    });

    if (!error && data?.properties?.action_link) {
      const actionLink = data.properties.action_link;

      // Render branded email HTML
      const subjectTemplate = "[K SELECT NETWORK] 비밀번호 재설정 안내";
      const bodyTemplate = `비밀번호를 재설정해 주세요.
안녕하세요. K SELECT NETWORK 포털 비밀번호 재설정 요청이 접수되었습니다.
아래 버튼을 클릭하여 새로운 비밀번호 설정을 완료해 주세요.
본 비밀번호 재설정 링크는 30분 동안 유효합니다.

{{ctaButton}}`;

      const { subject, text, html } = renderEmailHtml(subjectTemplate, bodyTemplate, {
        link: actionLink,
        key: "password_reset",
      });

      // Send the email via Resend
      await sendEmail({
        to: emailStr,
        subject,
        text,
        html,
      });
    } else {
      // In case of error (e.g. user does not exist), log it but don't expose it to the user
      console.error("[resetPassword] Failed to generate recovery link:", error?.message);
    }
  }

  return {
    message:
      "입력하신 이메일로 가입된 계정이 있다면, 비밀번호 재설정 링크를 보내드렸습니다.",
  };
}

export async function completePasswordResetActivation() {
  const { createClient } = await import("@/lib/supabase/server");
  const { createAdminClient } = await import("@/lib/supabase/admin");
  
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const admin = createAdminClient();
    await admin
      .from("company_users")
      .update({ status: "active", joined_at: new Date().toISOString() })
      .eq("id", user.id)
      .eq("status", "invited");
  }
}