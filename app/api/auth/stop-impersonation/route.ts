import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  COOKIE_NAME,
  getImpersonationSession,
  getAdminBaseUrl,
} from "@/lib/auth/impersonation";

export async function GET(request: NextRequest) {
  let targetPath = "/admin/companies";

  try {
    const sessionData = await getImpersonationSession();
    if (sessionData) {
      targetPath =
        sessionData.portalType === "RETAILER"
          ? "/admin/retailers"
          : "/admin/companies";

      const endedAt = new Date().toISOString();
      const durationSeconds = Math.round(
        (new Date(endedAt).getTime() - new Date(sessionData.startedAt).getTime()) / 1000
      );

      const admin = createAdminClient();
      try {
        await admin.from("impersonation_audit_logs").insert({
          session_id: sessionData.sessionId,
          admin_user_id: sessionData.adminUserId,
          admin_email: sessionData.adminEmail,
          target_user_id: sessionData.targetUserId,
          target_user_email: sessionData.targetUserEmail,
          target_company_id: sessionData.targetCompanyId,
          target_company_name: sessionData.targetCompanyName,
          portal_type: sessionData.portalType,
          action: "IMPERSONATION_ENDED",
          reason: sessionData.reason,
          note: sessionData.note || null,
          exit_reason: "manual",
          duration_seconds: durationSeconds,
          started_at: sessionData.startedAt,
          ended_at: endedAt,
        });
      } catch (auditErr) {
        console.warn("[stop-impersonation API] Audit log warning:", auditErr);
      }
    }
  } catch (err) {
    console.error("[stop-impersonation API] Error ending session:", err);
  }

  const adminBaseUrl = getAdminBaseUrl();
  const redirectUrl = adminBaseUrl ? `${adminBaseUrl}${targetPath}` : targetPath;

  const response = NextResponse.redirect(redirectUrl, 302);
  response.cookies.set(COOKIE_NAME, "", {
    maxAge: 0,
    path: "/",
    expires: new Date(0),
  });

  return response;
}
