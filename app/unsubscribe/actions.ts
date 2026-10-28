"use server";

import {
  verifyUnsubscribeToken,
  recordEmailOptOut,
  maskEmailAddress,
  maskTokenForLogging,
} from "@/lib/brand-marketing/unsubscribe";

export interface ConfirmUnsubscribeResult {
  success: boolean;
  maskedEmail?: string;
  alreadySuppressed?: boolean;
  message?: string;
  error?: string;
}

export async function confirmUnsubscribeAction(
  token: string
): Promise<ConfirmUnsubscribeResult> {
  if (!token || typeof token !== "string") {
    return {
      success: false,
      error: "수신 거부 토큰이 제공되지 않았습니다. (Missing token)",
    };
  }

  const result = verifyUnsubscribeToken(token);
  if (!result.valid || !result.email) {
    console.warn(`[unsubscribe:confirm] Invalid token attempt: ${maskTokenForLogging(token)}`);
    return {
      success: false,
      error: result.error || "유효하지 않거나 위변조된 수신 거부 링크입니다.",
    };
  }

  try {
    const optOut = await recordEmailOptOut(
      result.email,
      "UNSUBSCRIBED",
      "User confirmed unsubscribe via web interface",
      result.campaignId
    );

    if (!optOut.success && !optOut.alreadySuppressed) {
      return {
        success: false,
        error: optOut.error || "수신 거부 처리 중 데이터베이스 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      };
    }

    return {
      success: true,
      maskedEmail: maskEmailAddress(result.email),
      alreadySuppressed: optOut.alreadySuppressed || false,
      message: optOut.alreadySuppressed
        ? "이미 수신 거부 처리가 완료된 이메일 주소입니다."
        : "수신 거부가 정상적으로 완료되었습니다. 앞으로 K SELECT NETWORK 마케팅 이메일 발송 목록에서 제외됩니다.",
    };
  } catch (err: any) {
    console.error("[unsubscribe:confirm] Unexpected error:", err);
    return {
      success: false,
      error: err.message || "서버 통신 중 예기치 않은 오류가 발생했습니다.",
    };
  }
}
