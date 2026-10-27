import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken, recordEmailOptOut } from "@/lib/brand-marketing/unsubscribe";

export const dynamic = "force-dynamic";

/**
 * Handles RFC 8058 One-Click List-Unsubscribe POST requests from mail clients.
 * e.g. List-Unsubscribe: <https://admin.kselectnetwork.com/api/marketing/unsubscribe?token=...>, <mailto:unsubscribe@...>
 * List-Unsubscribe-Post: List-Unsubscribe=One-Click
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing unsubscribe token" }, { status: 400 });
  }

  const result = verifyUnsubscribeToken(token);
  if (!result.valid || !result.email) {
    return NextResponse.json({ error: result.error || "Invalid token" }, { status: 400 });
  }

  const optOutRes = await recordEmailOptOut(
    result.email,
    "UNSUBSCRIBED",
    "RFC 8058 One-Click POST opt-out",
    result.campaignId
  );

  return NextResponse.json({
    success: true,
    email: result.email,
    alreadySuppressed: optOutRes.alreadySuppressed || false,
    message: "Recipient unsubscribed successfully",
  });
}

export async function GET(req: NextRequest) {
  // Scanner-protection: GET on API redirects to human-facing confirmation page
  const token = req.nextUrl.searchParams.get("token") || "";
  return NextResponse.redirect(new URL(`/unsubscribe?token=${encodeURIComponent(token)}`, req.url));
}
