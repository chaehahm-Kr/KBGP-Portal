"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminSession } from "@/lib/auth/dal";
import crypto from "crypto";

export interface ImpersonationSessionData {
  sessionId: string;
  adminUserId: string;
  adminEmail: string;
  targetUserId: string;
  targetUserEmail: string;
  targetUserName: string;
  targetCompanyId: string;
  targetCompanyName: string;
  portalType: "BRAND" | "RETAILER";
  startedAt: string;
  expiresAt: string;
  reason: string;
  note?: string;
}

const COOKIE_NAME = "ksn_impersonation_session";
const SESSION_DURATION_SECONDS = 3600; // 60 minutes maximum

function getSecretKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "KSN_SECURE_IMPERSONATION_SECRET_2026";
}

/**
 * Creates a signed token string for the impersonation session
 */
function createSignedToken(data: ImpersonationSessionData): string {
  const payloadStr = JSON.stringify(data);
  const base64Payload = Buffer.from(payloadStr).toString("base64url");
  const hmac = crypto.createHmac("sha256", getSecretKey());
  hmac.update(base64Payload);
  const signature = hmac.digest("base64url");
  return `${base64Payload}.${signature}`;
}

/**
 * Parses and verifies a signed impersonation token string
 */
function parseAndVerifyToken(token: string): ImpersonationSessionData | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [base64Payload, signature] = parts;
    const hmac = crypto.createHmac("sha256", getSecretKey());
    hmac.update(base64Payload);
    const expectedSignature = hmac.digest("base64url");

    if (signature !== expectedSignature) {
      console.warn("[Auth Security Audit] Impersonation token signature mismatch");
      return null;
    }

    const payloadStr = Buffer.from(base64Payload, "base64url").toString("utf-8");
    const data: ImpersonationSessionData = JSON.parse(payloadStr);

    // Verify expiration
    if (new Date(data.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    return data;
  } catch (err) {
    return null;
  }
}

/**
 * Gets active Impersonation Session from request cookies
 */
export async function getImpersonationSession(): Promise<ImpersonationSessionData | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const data = parseAndVerifyToken(token);
    if (!data) return null;

    return data;
  } catch (err) {
    return null;
  }
}

/**
 * Helper to check if current request is running under an active impersonation session.
 */
export async function isImpersonating(): Promise<boolean> {
  const session = await getImpersonationSession();
  return !!session;
}

export interface StartImpersonationInput {
  targetUserId: string;
  targetCompanyId: string;
  portalType: "BRAND" | "RETAILER";
  reason: string;
  note?: string;
}

/**
 * Server Action: Starts a secure Admin Impersonation session
 */
export async function startImpersonationAction(input: StartImpersonationInput): Promise<{
  success: boolean;
  redirectUrl?: string;
  error?: string;
}> {
  try {
    // 1. Verify Admin authentication & staff status
    const adminSession = await verifyAdminSession();
    const admin = createAdminClient();

    const { data: staff } = await admin
      .from("staff_members")
      .select("id, status, email")
      .eq("id", adminSession.userId)
      .maybeSingle();

    if (!staff || staff.status !== "active") {
      return { success: false, error: "관리자 전용 권한이 필요합니다." };
    }

    // 2. Reject nested impersonation if already impersonating
    const currentImp = await getImpersonationSession();
    if (currentImp) {
      return {
        success: false,
        error: "이미 다른 계정을 임퍼소네이션 중입니다. 먼저 기존 지원 세션을 종료해 주세요.",
      };
    }

    // 3. Verify Target Company & Status
    const { data: company, error: compErr } = await admin
      .from("companies")
      .select("id, name, status, company_roles(role)")
      .eq("id", input.targetCompanyId)
      .maybeSingle();

    if (compErr || !company) {
      return { success: false, error: "대상 회사 정보를 찾을 수 없습니다." };
    }

    if (company.status === "suspended" || company.status === "inactive") {
      return { success: false, error: "비활성화 또는 정지 상태의 회사는 지원 로그인할 수 없습니다." };
    }

    // 4. Verify Target User & Status & Membership
    const { data: targetUser, error: userErr } = await admin
      .from("company_users")
      .select("id, name, email, status, company_id, company_role")
      .eq("id", input.targetUserId)
      .eq("company_id", input.targetCompanyId)
      .maybeSingle();

    if (userErr || !targetUser) {
      return { success: false, error: "해당 회사의 대상 사용자 정보를 찾을 수 없습니다." };
    }

    if (targetUser.status !== "active") {
      return {
        success: false,
        error: `대상 사용자 계정이 [${targetUser.status}] 상태입니다. 가입 완료(active) 상태의 계정만 임퍼소네이션할 수 있습니다.`,
      };
    }

    // 5. Construct Session Data
    const sessionId = `imp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const startedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000).toISOString();

    const sessionData: ImpersonationSessionData = {
      sessionId,
      adminUserId: staff.id,
      adminEmail: staff.email || adminSession.email,
      targetUserId: targetUser.id,
      targetUserEmail: targetUser.email,
      targetUserName: targetUser.name || targetUser.email,
      targetCompanyId: company.id,
      targetCompanyName: company.name,
      portalType: input.portalType,
      startedAt,
      expiresAt,
      reason: input.reason || "Customer Support",
      note: input.note?.trim() || undefined,
    };

    // 6. Set Impersonation Cookie
    const token = createSignedToken(sessionData);
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
    });

    // 7. Insert Audit Log
    try {
      await admin.from("impersonation_audit_logs").insert({
        session_id: sessionId,
        admin_user_id: staff.id,
        admin_email: staff.email || adminSession.email,
        target_user_id: targetUser.id,
        target_user_email: targetUser.email,
        target_company_id: company.id,
        target_company_name: company.name,
        portal_type: input.portalType,
        action: "IMPERSONATION_STARTED",
        reason: input.reason || "Customer Support",
        note: input.note?.trim() || null,
        started_at: startedAt,
      });
    } catch (auditErr) {
      console.warn("[startImpersonationAction] Audit log warning:", auditErr);
    }

    const redirectUrl = input.portalType === "RETAILER" ? "/retailer" : "/portal";
    return { success: true, redirectUrl };
  } catch (err: any) {
    console.error("[startImpersonationAction] Error:", err);
    return { success: false, error: err?.message || "임퍼소네이션 세션 시작 중 오류가 발생했습니다." };
  }
}

/**
 * Server Action: Stops the current Admin Impersonation session
 */
export async function stopImpersonationAction(): Promise<{
  success: boolean;
  redirectUrl: string;
  error?: string;
}> {
  try {
    const sessionData = await getImpersonationSession();
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);

    let redirectUrl = "/admin";

    if (sessionData) {
      redirectUrl =
        sessionData.portalType === "RETAILER"
          ? `/admin/retailers/${sessionData.targetCompanyId}`
          : `/admin/companies/${sessionData.targetCompanyId}`;

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
        console.warn("[stopImpersonationAction] Audit log warning:", auditErr);
      }
    }

    return { success: true, redirectUrl };
  } catch (err: any) {
    return { success: false, redirectUrl: "/admin", error: err?.message || "세션 종료 처리 중 오류가 발생했습니다." };
  }
}

/**
 * Server Action: Fetches Impersonation Audit Trail for Admin Audit Page
 */
export async function getImpersonationAuditLogsAction(): Promise<{
  logs: any[];
  error?: string;
}> {
  try {
    await verifyAdminSession();
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("impersonation_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return { logs: [], error: error.message };
    return { logs: data || [] };
  } catch (err: any) {
    return { logs: [], error: err?.message || "감사 로그를 불러오지 못했습니다." };
  }
}
