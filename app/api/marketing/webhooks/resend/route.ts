import { NextRequest, NextResponse } from "next/server";
import { verifyResendWebhookSignature } from "@/lib/brand-marketing/resend-webhook-verifier";
import { processResendWebhookEvent } from "@/lib/brand-marketing/resend-delivery-tracking";
import { serverEnv } from "@/lib/env/server";

export const dynamic = "force-dynamic";

/**
 * Public webhook endpoint for inbound Resend delivery events.
 * Enforces Svix signature authentication, replay protection, and idempotency.
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET || serverEnv.RESEND_WEBHOOK_SECRET;

    if (!secret) {
      console.error("[resend-webhook] RESEND_WEBHOOK_SECRET is not configured.");
      return NextResponse.json(
        { error: "Webhook secret not configured on server" },
        { status: 503 }
      );
    }

    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    const rawBody = await req.text();

    const verification = verifyResendWebhookSignature({
      payload: rawBody,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      secret,
    });

    if (!verification.isValid) {
      console.warn("[resend-webhook] Signature verification rejected:", verification.error);
      return NextResponse.json(
        { error: `Unauthorized webhook signature: ${verification.error}` },
        { status: 401 }
      );
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const result = await processResendWebhookEvent(event, {
      svixId: svixId || undefined,
      svixTimestamp: svixTimestamp || undefined,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    console.error("[resend-webhook] Unhandled exception:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error processing webhook" },
      { status: 500 }
    );
  }
}
