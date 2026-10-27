import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskEmailAddress } from "@/lib/notifications/email";

// Fallback in-memory suppression registry for fast lookup and local testing
const memorySuppressionList = new Set<string>();

/**
 * Secret key used to sign opaque unsubscribe tokens.
 * Falls back to server environment variables or durable fallback.
 */
function getUnsubscribeSecret(): string {
  return (
    process.env.MARKETING_UNSUBSCRIBE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
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
  error?: string;
} {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { valid: false, error: "Invalid token format." };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "Malformed token segments." };
  }

  const [encodedPayload, signature] = parts;

  // Verify HMAC signature
  const hmac = crypto.createHmac("sha256", getUnsubscribeSecret());
  hmac.update(encodedPayload);
  const expectedSignature = hmac.digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return { valid: false, error: "Token signature verification failed." };
  }

  try {
    const jsonStr = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const payload: UnsubscribeTokenPayload = JSON.parse(jsonStr);

    if (!payload.email || !payload.email.includes("@")) {
      return { valid: false, error: "Token payload missing valid email." };
    }

    return {
      valid: true,
      email: payload.email.toLowerCase().trim(),
      campaignId: payload.campaignId,
    };
  } catch (err: any) {
    return { valid: false, error: "Failed to decode token payload." };
  }
}

/**
 * Resolves the absolute HTTPS unsubscribe URL for a recipient.
 */
export function buildUnsubscribeUrl(email: string, campaignId?: string | null): string {
  const token = generateUnsubscribeToken(email, campaignId);
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    "https://admin.kselectnetwork.com"
  ).replace(/\/$/, "");

  return `${siteUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Resolves the RFC 8058 One-Click Unsubscribe endpoint URL.
 */
export function buildOneClickUnsubscribeEndpoint(email: string, campaignId?: string | null): string {
  const token = generateUnsubscribeToken(email, campaignId);
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    "https://admin.kselectnetwork.com"
  ).replace(/\/$/, "");

  return `${siteUrl}/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`;
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
    return { success: false, error: "Invalid email address format." };
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
