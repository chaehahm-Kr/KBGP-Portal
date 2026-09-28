import { NextResponse, type NextRequest } from "next/server";
import {
  verifyHandoffToken,
  createSignedToken,
  COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  getPortalBaseUrl,
} from "@/lib/auth/impersonation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");

    if (!code) {
      console.warn("[IMPERSONATION_REDIRECT_FAILED] Missing handoff code parameter");
      const fallbackUrl = new URL("/login?error=invalid_handoff", request.url);
      return NextResponse.redirect(fallbackUrl);
    }

    const sessionData = verifyHandoffToken(code);
    if (!sessionData) {
      console.warn("[IMPERSONATION_REDIRECT_FAILED] Invalid or expired handoff token");
      const fallbackUrl = new URL("/login?error=expired_handoff", request.url);
      return NextResponse.redirect(fallbackUrl);
    }

    const token = createSignedToken(sessionData);

    const landingPath = sessionData.portalType === "RETAILER" ? "/retailer" : "/portal";
    const baseUrl = getPortalBaseUrl(sessionData.portalType);
    const targetUrlStr = baseUrl ? `${baseUrl}${landingPath}` : landingPath;

    const response = NextResponse.redirect(new URL(targetUrlStr, request.url));

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
    });

    // Record audit log for successful handoff
    try {
      const admin = createAdminClient();
      await admin.from("impersonation_audit_logs").insert({
        session_id: sessionData.sessionId,
        admin_user_id: sessionData.adminUserId,
        admin_email: sessionData.adminEmail,
        target_user_id: sessionData.targetUserId,
        target_user_email: sessionData.targetUserEmail,
        target_company_id: sessionData.targetCompanyId,
        target_company_name: sessionData.targetCompanyName,
        portal_type: sessionData.portalType,
        action: "IMPERSONATION_HANDOFF_SUCCESS",
        reason: sessionData.reason,
        started_at: sessionData.startedAt,
      });
    } catch (auditErr) {
      console.warn("[impersonation-handoff] Audit log warning:", auditErr);
    }

    return response;
  } catch (err: any) {
    console.error("[IMPERSONATION_REDIRECT_FAILED] Route error:", err);
    return NextResponse.redirect(new URL("/login?error=handoff_error", request.url));
  }
}
