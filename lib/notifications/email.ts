import "server-only";
import { serverEnv } from "@/lib/env/server";

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64 encoded string
  }>;
};

/**
 * Approved internal domains for controlled testing in non-production environments.
 */
const DEFAULT_ALLOWED_TEST_DOMAINS = ["letusto.com", "kselectnetwork.com"];

/**
 * Masks an email address to protect recipient PII in system logs.
 * e.g. "admin@letusto.com" -> "ad***@letusto.com"
 */
export function maskEmailAddress(email: string): string {
  if (!email || !email.includes("@")) return "***@***.***";
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***.***";
  const visibleLen = Math.min(2, Math.max(1, Math.floor(local.length / 2)));
  return `${local.slice(0, visibleLen)}***@${domain}`;
}

/**
 * Determines whether the current execution runtime is authentic Production.
 * CRITICAL DIRECTIVE: NEVER rely on NODE_ENV alone, because local production builds
 * and Vercel Preview deployments also set NODE_ENV="production".
 */
export function isProductionEnvironment(): boolean {
  // 1. Explicit QA / Testing flags fail closed immediately
  if (process.env.ENABLE_QA_ENVIRONMENT === "true") return false;
  if (process.env.QA_ENVIRONMENT_NAME) return false;

  // 2. Vercel Preview or Development environments are strictly non-production
  if (process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development") {
    return false;
  }

  // 3. Supabase URL must strictly match Production project ref (shzfrppdobpmrstcjfqu)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isProdSupabase = supabaseUrl.includes("shzfrppdobpmrstcjfqu");
  if (!isProdSupabase) return false;

  // 4. Must be on Vercel production deployment OR explicit production custom domain
  const isVercelProd = process.env.VERCEL_ENV === "production";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const isProdDomain = siteUrl.includes("kselectnetwork.com") && !siteUrl.includes("vercel.app");

  return isVercelProd || (process.env.NODE_ENV === "production" && isProdDomain);
}

/**
 * Checks if a recipient is on the controlled allowlist for non-production testing.
 */
export function isRecipientAllowlisted(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const lowerEmail = email.toLowerCase().trim();
  const domain = lowerEmail.split("@")[1];

  // Custom configured allowlist via environment variable (comma-separated emails or domains)
  const customAllowlist = (process.env.EMAIL_TEST_ALLOWLIST || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (customAllowlist.length > 0) {
    if (customAllowlist.includes(lowerEmail) || customAllowlist.includes(domain)) {
      return true;
    }
  }

  return DEFAULT_ALLOWED_TEST_DOMAINS.includes(domain);
}

/**
 * Central transactional email dispatch gateway with centralized environment safety guard.
 * Protects against unintended external email delivery from Local, QA, and Vercel Preview.
 */
export async function sendEmail(payload: EmailPayload): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}> {
  // 1. Verify Resend credentials are configured
  if (!serverEnv.RESEND_API_KEY || !serverEnv.EMAIL_FROM_ADDRESS) {
    console.log(
      `[email:dev] RESEND_API_KEY 미설정 — 발송 시뮬레이션 (수신: ${maskEmailAddress(payload.to)}, 제목: "${payload.subject}")`
    );
    return { success: true, messageId: "dev-simulated-id", simulated: true };
  }

  // 2. Central Non-Production Safety Guard
  const isProd = isProductionEnvironment();
  if (!isProd) {
    const allowTestDispatch = process.env.ENABLE_TEST_EMAIL_DISPATCH === "true";
    const isAllowlisted = isRecipientAllowlisted(payload.to);

    // If test dispatch is NOT explicitly enabled OR recipient is not allowlisted, simulate delivery safely
    if (!allowTestDispatch || !isAllowlisted) {
      console.log(
        `[email:sandbox] 비운영 환경 외부 발송 차단 (Sandbox Simulation): ` +
        `수신=${maskEmailAddress(payload.to)}, 허용도메인=${isAllowlisted ? "일치" : "차단"}, 발송활성=${allowTestDispatch}`
      );
      return {
        success: true,
        messageId: `sandbox-simulated-${Date.now()}`,
        simulated: true,
      };
    }

    console.log(
      `[email:test-dispatch] 비운영 승인 수신자 발송 허용: 수신=${maskEmailAddress(payload.to)}, 제목="${payload.subject}"`
    );
  }

  // 3. Real Dispatch via Resend API (Production or explicitly permitted non-production test dispatch)
  try {
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
        html: payload.html,
        attachments: payload.attachments,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[email] Resend 발송 실패:", response.status, errorText);
      return { success: false, error: `Resend HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error("[email] 발송 예외 발생:", err?.message || err);
    return { success: false, error: err?.message || "이메일 전송 중 네트워크 오류가 발생했습니다." };
  }
}


/**
 * High-performance batch email dispatch gateway (Resend Batch API).
 * Supports up to 100 emails per request chunk with per-recipient personalization.
 * Enforces identical non-production simulation safety guards.
 */
export async function sendEmailBatch(
  payloads: EmailPayload[]
): Promise<Array<{ success: boolean; messageId?: string; error?: string; simulated?: boolean }>> {
  if (payloads.length === 0) {
    return [];
  }

  const results: Array<{ success: boolean; messageId?: string; error?: string; simulated?: boolean }> = new Array(
    payloads.length
  );

  // 1. Verify Resend credentials are configured
  if (!serverEnv.RESEND_API_KEY || !serverEnv.EMAIL_FROM_ADDRESS) {
    console.log(
      `[email:dev] RESEND_API_KEY 미설정 ? 배치 ${payloads.length}건 발송 시뮬레이션 완료`
    );
    return payloads.map((_, idx) => ({
      success: true,
      messageId: `dev-simulated-batch-${Date.now()}-${idx}`,
      simulated: true,
    }));
  }

  // 2. Central Non-Production Safety Guard
  const isProd = isProductionEnvironment();
  const allowTestDispatch = process.env.ENABLE_TEST_EMAIL_DISPATCH === "true";

  const realSendIndices: number[] = [];
  for (let i = 0; i < payloads.length; i++) {
    const p = payloads[i];
    if (!isProd) {
      const isAllowlisted = isRecipientAllowlisted(p.to);
      if (!allowTestDispatch || !isAllowlisted) {
        results[i] = {
          success: true,
          messageId: `sandbox-simulated-${Date.now()}-${i}`,
          simulated: true,
        };
        continue;
      }
    }
    realSendIndices.push(i);
  }

  if (realSendIndices.length === 0) {
    return results;
  }

  // 3. Batch Dispatch via Resend API (Chunks of up to 100)
  const BATCH_CHUNK_SIZE = 100;
  for (let c = 0; c < realSendIndices.length; c += BATCH_CHUNK_SIZE) {
    const chunkIndices = realSendIndices.slice(c, c + BATCH_CHUNK_SIZE);
    const chunkPayloads = chunkIndices.map((idx) => payloads[idx]);

    try {
      const response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serverEnv.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          chunkPayloads.map((p) => ({
            from: serverEnv.EMAIL_FROM_ADDRESS,
            to: p.to,
            subject: p.subject,
            text: p.text,
            html: p.html,
            attachments: p.attachments,
          }))
        ),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[email:batch] Resend 배치 발송 실패:", response.status, errorText);
        for (const idx of chunkIndices) {
          results[idx] = {
            success: false,
            error: `Resend HTTP ${response.status}: ${errorText}`,
          };
        }
        continue;
      }

      const resData = await response.json();
      const items = Array.isArray(resData?.data) ? resData.data : [];

      for (let i = 0; i < chunkIndices.length; i++) {
        const origIdx = chunkIndices[i];
        const resItem = items[i];
        if (resItem?.id) {
          results[origIdx] = {
            success: true,
            messageId: resItem.id,
          };
        } else if (resItem?.error) {
          results[origIdx] = {
            success: false,
            error: resItem.error.message || "Resend batch item error",
          };
        } else {
          // If response format has top-level id or unexpected shape
          results[origIdx] = {
            success: true,
            messageId: resItem?.id || `resend-batch-${Date.now()}-${origIdx}`,
          };
        }
      }

      // Safe throttle delay between consecutive batch chunks (600ms) to respect Resend rate limits
      if (c + BATCH_CHUNK_SIZE < realSendIndices.length) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    } catch (err: any) {
      console.error("[email:batch] 발송 예외 발생:", err?.message || err);
      for (const idx of chunkIndices) {
        results[idx] = {
          success: false,
          error: err?.message || "Resend 배치 전송 중 네트워크 오류",
        };
      }
    }
  }

  return results;
}
