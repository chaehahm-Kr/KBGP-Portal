import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskEmailAddress } from "@/lib/notifications/email";
import { getCanonicalMarketingBaseUrl } from "./marketing-url";

// Fallback in-memory suppression registry for fast lookup and local testing
const memorySuppressionList = new Set<string>();

/**
 * Maximum lifetime for an unsubscribe token: 180 days (in milliseconds).
 */
export const MAX_UNSUBSCRIBE_TOKEN_AGE_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * Masks an unsubscribe token for safe logging without exposing the complete signature.
 */
export function maskTokenForLogging(token: string): string {
  if (!token || typeof token !== "string") return "[empty-token]";
  if (token.length <= 12) return "tok_***";
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

/**
 * Secret key used to sign opaque unsubscribe tokens.
 * Falls back to server environment variables or durable fallback.
 */
function getUnsubscribeSecret(): string {
  return (
    process.env.MARKETING_UNSUBSCRIBE_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.AUTH_SECRET ||
    "ksn-marketing-unsub-secret-key-2026"
  );
}

export interface UnsubscribeTokenPayload {
  email: string;
  campaignId?: string | null;
  ts: number;
}

/**
 * Generates a tamper-proof, opaque unsubscribe token for an email recipient.
 */
export function generateUnsubscribeToken(email: string, campaignId?: string | null): string {
  const normalizedEmail = email.toLowerCase().trim();
  const payload: UnsubscribeTokenPayload = {
    email: normalizedEmail,
    campaignId: campaignId || null,
    ts: Date.now(),
  };

  const payloadString = JSON.stringify(payload);
  const encodedPayload = Buffer.from(payloadString, "utf8").toString("base64url");
  const hmac = crypto.createHmac("sha256", getUnsubscribeSecret());
  hmac.update(encodedPayload);
  const signature = hmac.digest("base64url");

  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies an unsubscribe token and extracts its payload.
 */
export function verifyUnsubscribeToken(token: string): {
  valid: boolean;
  email?: string;
  campaignId?: string | null;
  expired?: boolean;
  error?: string;
} {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { valid: false, error: "유효하지 않은 수신 거부 토큰 형식입니다. (Invalid token format)" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "손상된 수신 거부 토큰입니다. (Malformed token segments)" };
  }

  const [encodedPayload, signature] = parts;

  // Verify HMAC signature with timing-safe comparison
  const hmac = crypto.createHmac("sha256", getUnsubscribeSecret());
  hmac.update(encodedPayload);
  const expectedSignature = hmac.digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: "수신 거부 토큰 서명 인증에 실패했습니다. (Signature verification failed)" };
  }

  try {
    const jsonStr = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const payload: UnsubscribeTokenPayload = JSON.parse(jsonStr);

    if (!payload.email || !payload.email.includes("@")) {
      return { valid: false, error: "토큰에 유효한 이메일 정보가 누락되었습니다. (Missing email)" };
    }

    // Check expiration (if timestamp is present and exceeds 180 days)
    if (typeof payload.ts === "number" && payload.ts > 0) {
      const ageMs = Date.now() - payload.ts;
      if (ageMs > MAX_UNSUBSCRIBE_TOKEN_AGE_MS) {
        return {
          valid: false,
          expired: true,
          error: "만료된 수신 거부 링크입니다. (Expired unsubscribe token)",
        };
      }
    }

    return {
      valid: true,
      email: payload.email.toLowerCase().trim(),
      campaignId: payload.campaignId || null,
    };
  } catch (err: any) {
    return { valid: false, error: "토큰 디코딩에 실패했습니다. (Failed to decode payload)" };
  }
}

/**
 * Resolves the absolute HTTPS unsubscribe URL for a recipient.
 * Strictly uses the centralized canonical marketing URL (never exposes internal Vercel domains).
 */
export function buildUnsubscribeUrl(email: string, campaignId?: string | null): string {
  const token = generateUnsubscribeToken(email, campaignId);
  const baseUrl = getCanonicalMarketingBaseUrl();
  return `${baseUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Resolves the RFC 8058 One-Click Unsubscribe endpoint URL.
 */
export function buildOneClickUnsubscribeEndpoint(email: string, campaignId?: string | null): string {
  const token = generateUnsubscribeToken(email, campaignId);
  const baseUrl = getCanonicalMarketingBaseUrl();
  return `${baseUrl}/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Records an email address into the authoritative marketing suppression list.
 */
export async function recordEmailOptOut(
  email: string,
  reason: "UNSUBSCRIBED" | "BOUNCED" | "COMPLAINT" | "MANUAL_ADMIN" = "UNSUBSCRIBED",
  notes?: string,
  campaignId?: string | null
): Promise<{ success: boolean; alreadySuppressed?: boolean; error?: string }> {
  const normalized = email.toLowerCase().trim();
  if (!normalized || !normalized.includes("@")) {
    return { success: false, error: "유효하지 않은 이메일 주소 형식입니다." };
  }

  // Update in-memory fallback
  memorySuppressionList.add(normalized);

  try {
    const admin = createAdminClient();
    const finalNotes = notes || (campaignId ? `Opt-out via unsubscribe link (Campaign: ${campaignId})` : "Direct recipient opt-out");

    const { error } = await admin.from("marketing_suppression_list").insert({
      email: normalized,
      reason,
      notes: finalNotes,
      suppressed_at: new Date().toISOString(),
      created_by: "system:unsubscribe_flow",
    });

    if (error) {
      // 23505 is PostgreSQL unique constraint violation
      if (error.code === "23505" || error.message.includes("unique") || error.message.includes("already exists")) {
        return { success: true, alreadySuppressed: true };
      }
      console.warn("[marketing:unsubscribe] DB insert warning:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, alreadySuppressed: false };
  } catch (err: any) {
    console.warn("[marketing:unsubscribe] Exception during DB insert (memory fallback used):", err.message);
    return { success: true, alreadySuppressed: false };
  }
}

/**
 * Checks whether an email address is currently suppressed.
 */
export async function isEmailSuppressed(email: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return false;

  if (memorySuppressionList.has(normalized)) {
    return true;
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("marketing_suppression_list")
      .select("id")
      .eq("email", normalized)
      .limit(1);

    if (error) {
      console.warn("[marketing:suppression] DB query warning:", error.message);
      return memorySuppressionList.has(normalized);
    }

    if (data && data.length > 0) {
      memorySuppressionList.add(normalized);
      return true;
    }
  } catch (err: any) {
    console.warn("[marketing:suppression] Exception querying DB:", err.message);
  }

  return memorySuppressionList.has(normalized);
}

/**
 * Helper to mask an email for safe public presentation on the unsubscribe page.
 */
export { maskEmailAddress };
