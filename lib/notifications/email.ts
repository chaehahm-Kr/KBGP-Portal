import "server-only";
import { serverEnv } from "@/lib/env/server";

export type EmailPayload = { to: string; subject: string; text: string };

/**
 * 09_알림및문서관리규칙.md Part 1: 회원가입 확인·비밀번호 재설정·초대 메일은
 * Supabase Auth의 기본 메일러가 보내주지만(명세서 01), "심사 결과 확정"처럼 업무
 * 이벤트에 따라 우리가 직접 내용을 구성해서 보내는 알림은 Supabase Auth 메일러로는
 * 보낼 수 없다 — 그래서 Resend 같은 별도 트랜잭션 이메일 서비스가 필요하다.
 *
 * RESEND_API_KEY가 설정되어 있지 않으면(아직 이메일 서비스 연동 전이라도 개발이
 * 막히지 않도록) 실제 발송 대신 콘솔에 로그만 남긴다. 이 함수의 호출부(예: 심사 결과
 * 확정 로직)는 이후 명세서 08에서 이벤트 목록을 전체 점검할 때 그대로 재사용된다.
 */
export async function sendEmail(payload: EmailPayload) {
  if (!serverEnv.RESEND_API_KEY || !serverEnv.EMAIL_FROM_ADDRESS) {
    console.log("[email:dev] RESEND_API_KEY 미설정 — 실제 발송 대신 로그로 남깁니다.", payload);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: serverEnv.EMAIL_FROM_ADDRESS,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    }),
  });

  if (!response.ok) {
    console.error("[email] 발송 실패", await response.text());
  }
}
