import crypto from "crypto";

export interface VerifyWebhookOptions {
  payload: string; // Raw request text body
  headers: {
    id?: string | null;
    timestamp?: string | null;
    signature?: string | null;
  };
  secret: string;
  toleranceSeconds?: number;
}

/**
 * Verifies Resend Svix webhook signatures using HMAC-SHA256.
 * Complies with the Svix/Resend specification without external runtime dependencies.
 */
export function verifyResendWebhookSignature({
  payload,
  headers,
  secret,
  toleranceSeconds = 300,
}: VerifyWebhookOptions): { isValid: boolean; error?: string } {
  if (!secret) {
    return { isValid: false, error: "Missing webhook secret" };
  }

  const id = headers.id;
  const timestamp = headers.timestamp;
  const signature = headers.signature;

  if (!id || !timestamp || !signature) {
    return {
      isValid: false,
      error: "Missing required svix headers (svix-id, svix-timestamp, svix-signature)",
    };
  }

  // Validate timestamp freshness (Replay attack protection)
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return { isValid: false, error: "Invalid svix-timestamp header" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSeconds) {
    return { isValid: false, error: "Webhook timestamp expired (replay attack protection)" };
  }

  // Parse secret key: Svix secrets usually have format "whsec_<base64>"
  let key: Buffer;
  if (secret.startsWith("whsec_")) {
    key = Buffer.from(secret.slice(6), "base64");
  } else {
    key = Buffer.from(secret, "utf-8");
  }

  const toSign = `${id}.${timestamp}.${payload}`;
  const expectedSignature = crypto.createHmac("sha256", key).update(toSign).digest("base64");

  // svix-signature may contain multiple space-separated signatures (e.g. "v1,abc v1,def")
  const signatures = signature.split(" ");
  let matched = false;

  for (const sig of signatures) {
    const parts = sig.split(",");
    if (parts.length === 2 && parts[0] === "v1" && parts[1]) {
      try {
        const sigBuf = Buffer.from(parts[1], "base64");
        const expBuf = Buffer.from(expectedSignature, "base64");
        if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
          matched = true;
          break;
        }
      } catch {}
    }
  }

  if (!matched) {
    return { isValid: false, error: "Signature mismatch" };
  }

  return { isValid: true };
}
