import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminSession } from "@/lib/auth/dal";
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

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

export const COOKIE_NAME = "ksn_impersonation_session";
export const SESSION_DURATION_SECONDS = 3600; // 60 minutes maximum

export function getSecretKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "KSN_SECURE_IMPERSONATION_SECRET_2026";
}

/**
 * Gets base URL for target portal type
 */
export function getPortalBaseUrl(portalType: "BRAND" | "RETAILER"): string {
  if (process.env.NODE_ENV === "development") {
    return "";
  }
  if (portalType === "RETAILER") {
    return "https://portal.kselecthub.com";
  }
  return "https://portal.kselectnetwork.com";
}

/**
 * Gets clean landing path for target portal type
 */
export function getPortalLandingPath(portalType: "BRAND" | "RETAILER"): string {
  if (portalType === "RETAILER") {
    return process.env.NODE_ENV === "development" ? "/retailer" : "/";
  }
  return "/portal";
}

/**
 * Gets base URL for Admin Console
 */
export function getAdminBaseUrl(): string {
  if (process.env.NODE_ENV === "development") {
    return "";
  }
  return "https://admin.kselectnetwork.com";
}

/**
 * Authoritatively resolves portal type for a company from DB records
 */
export async function resolveAuthoritativePortalType(
  admin: SupabaseClient,
  companyId: string
): Promise<"BRAND" | "RETAILER"> {
  try {
    // 1. Check company_roles
    const { data: roles } = await admin
      .from("company_roles")
      .select("role")
      .eq("company_id", companyId);

    if (roles && roles.some((r: any) => r.role?.toLowerCase() === "retailer")) {
      return "RETAILER";
    }

    // 2. Check retailer_user_roles
    const { data: retUserRoles } = await admin
      .from("retailer_user_roles")
      .select("id")
      .eq("company_id", companyId)
      .limit(1);

    if (retUserRoles && retUserRoles.length > 0) {
      return "RETAILER";
    }

    // 3. Check stores
    const { data: stores } = await admin
      .from("stores")
      .select("id")
      .eq("company_id", companyId)
      .limit(1);

    if (stores && stores.length > 0) {
      return "RETAILER";
    }

    // 4. Check company_code or intro metadata
    const { data: company } = await admin
      .from("companies")
      .select("company_code, intro")
      .eq("id", companyId)
      .maybeSingle();

    if (company) {
      if (company.company_code?.toUpperCase().startsWith("RET-")) {
        return "RETAILER";
      }
      if (company.intro && typeof company.intro === "string" && company.intro.includes('"types"')) {
        try {
          const meta = JSON.parse(company.intro.substring("__COMPANY_METADATA__:".length));
          if (Array.isArray(meta.types) && meta.types.some((t: string) => t.toLowerCase() === "retailer")) {
            return "RETAILER";
          }
        } catch (e) {}
      }
    }
  } catch (err) {
    console.warn("[IMPERSONATION_PORTAL_TYPE_UNRESOLVED] Resolution error:", err);
  }

  return "BRAND";
}

/**
 * Creates a signed token string for the impersonation session
 */
export function createSignedToken(data: ImpersonationSessionData): string {
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
export function parseAndVerifyToken(token: string): ImpersonationSessionData | null {
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
 * Creates a short-lived (60s) single-use handoff token for cross-domain redirection
 */
export function createHandoffToken(sessionData: ImpersonationSessionData): string {
  const payload = {
    sessionData,
    createdAt: Date.now(),
  };
  const base64Str = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", getSecretKey());
  hmac.update(base64Str);
  const sig = hmac.digest("base64url");
  return `${base64Str}.${sig}`;
}

/**
 * Verifies a single-use handoff token
 */
export function verifyHandoffToken(token: string): ImpersonationSessionData | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [base64Str, sig] = parts;

    const hmac = crypto.createHmac("sha256", getSecretKey());
    hmac.update(base64Str);
    if (sig !== hmac.digest("base64url")) {
      console.warn("[Auth Security Audit] IMPERSONATION_HANDOFF_TOKEN_INVALID_SIG");
      return null;
    }

    const payload = JSON.parse(Buffer.from(base64Str, "base64url").toString("utf-8"));
    const age = Date.now() - payload.createdAt;
    if (age > 60000) { // 60s TTL
      console.warn("[Auth Security Audit] IMPERSONATION_HANDOFF_TOKEN_EXPIRED");
      return null;
    }

    return payload.sessionData;
  } catch (err) {
    console.warn("[Auth Security Audit] IMPERSONATION_HANDOFF_TOKEN_PARSE_ERROR", err);
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
    if (!data) {
      // Stale or expired cookie -> delete automatically
      try {
        cookieStore.delete(COOKIE_NAME);
      } catch (e) {}
      return null;
    }

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
  portalType?: "BRAND" | "RETAILER";
  reason: string;
  note?: string;
  forceRestart?: boolean;
}

export interface ActiveSessionDetails {
  targetUserId?: string;
  targetUserName: string;
  targetCompanyName: string;
  portalType: "BRAND" | "RETAILER";
}

/**
 * Server Action: Starts a secure Admin Impersonation session
 */
export async function startImpersonationAction(input: StartImpersonationInput): Promise<{
  success: boolean;
  redirectUrl?: string;
  activeSession?: ActiveSessionDetails;
  error?: string;
}> {
  try {
    // 1. Verify Admin authentication & staff status
    let adminSession: any = null;
    try {
      adminSession = await verifyAdminSession();
    } catch (authErr) {
      console.warn("[IMPERSONATION_ADMIN_NOT_AUTHORIZED] Admin authentication failed:", authErr);
      return { success: false, error: "관리자 로그인 인증이 필요합니다." };
    }

    const admin = createAdminClient();

    const { data: staff } = await admin
      .from("staff_members")
      .select("id, status, email")
      .eq("id", adminSession.userId)
      .maybeSingle();

    if (!staff || staff.status !== "active") {
      console.warn(`[IMPERSONATION_ADMIN_NOT_AUTHORIZED] Staff member ${adminSession.userId} is missing or inactive`);
      return { success: false, error: "관리자 전용 권한이 필요합니다." };
    }

    // 2. Check & Clean Stale / Expired Impersonation Session
    const currentImp = await getImpersonationSession();
    if (currentImp) {
      const isExpired = new Date(currentImp.expiresAt).getTime() <= Date.now();
      const isSameUser = currentImp.targetUserId === input.targetUserId;

      if (isExpired || input.forceRestart || isSameUser) {
        // Automatically delete stale/overridden cookie on Admin domain
        try {
          const cookieStore = await cookies();
          cookieStore.delete(COOKIE_NAME);
        } catch (e) {}
      } else {
        console.warn(`[IMPERSONATION_NESTED_BLOCKED] Active session already exists for admin ${staff.id}`);
        const existingBaseUrl = getPortalBaseUrl(currentImp.portalType);
        const existingLandingPath = getPortalLandingPath(currentImp.portalType);
        const existingRedirectUrl = existingBaseUrl ? `${existingBaseUrl}${existingLandingPath}` : existingLandingPath;

        return {
          success: false,
          redirectUrl: existingRedirectUrl,
          activeSession: {
            targetUserId: currentImp.targetUserId,
            targetUserName: currentImp.targetUserName,
            targetCompanyName: currentImp.targetCompanyName,
            portalType: currentImp.portalType,
          },
          error: `현재 [${currentImp.targetCompanyName} - ${currentImp.targetUserName}] 지원 세션이 실행 중입니다.`,
        };
      }
    }

    // 3. Verify Target User & Status
    const { data: targetUser, error: userErr } = await admin
      .from("company_users")
      .select("id, name, email, status, company_id, company_role")
      .eq("id", input.targetUserId)
      .maybeSingle();

    if (userErr || !targetUser) {
      console.warn(`[IMPERSONATION_TARGET_USER_NOT_FOUND] Target user ${input.targetUserId} not found in DB`);
      return { success: false, error: "대상 사용자 정보를 찾을 수 없습니다." };
    }

    if (targetUser.status !== "active") {
      console.warn(`[IMPERSONATION_TARGET_USER_INACTIVE] Target user ${targetUser.id} is in status [${targetUser.status}]`);
      return {
        success: false,
        error: `대상 사용자 계정이 [${targetUser.status}] 상태입니다. 가입 완료(active) 상태의 계정만 임퍼소네이션할 수 있습니다.`,
      };
    }

    // 4. Verify Target Company & Membership Match
    const targetCompanyId = input.targetCompanyId || targetUser.company_id;
    if (targetUser.company_id !== targetCompanyId) {
      console.warn(`[IMPERSONATION_COMPANY_MISMATCH] User company_id (${targetUser.company_id}) does not match input targetCompanyId (${targetCompanyId})`);
      return { success: false, error: "대상 사용자 및 회사 소속 정보가 일치하지 않습니다." };
    }

    const { data: company, error: compErr } = await admin
      .from("companies")
      .select("id, name, status, company_code")
      .eq("id", targetCompanyId)
      .maybeSingle();

    if (compErr || !company) {
      console.warn(`[IMPERSONATION_COMPANY_MISMATCH] Target company ${targetCompanyId} not found`);
      return { success: false, error: "대상 회사 정보를 찾을 수 없습니다." };
    }

    if (company.status === "suspended" || company.status === "inactive") {
      console.warn(`[IMPERSONATION_COMPANY_INACTIVE] Target company ${company.id} status is ${company.status}`);
      return { success: false, error: "비활성화 또는 정지 상태의 회사는 지원 로그인할 수 없습니다." };
    }

    // 5. Authoritatively Resolve Portal Type from DB Data Model
    const resolvedPortalType = await resolveAuthoritativePortalType(admin, company.id);
    if (!resolvedPortalType) {
      console.warn(`[IMPERSONATION_PORTAL_TYPE_UNRESOLVED] Failed to resolve portal type for company ${company.id}`);
      return { success: false, error: "대상 포털 타입을 결정할 수 없습니다." };
    }

    // 6. Construct Session Data
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
      portalType: resolvedPortalType,
      startedAt,
      expiresAt,
      reason: input.reason || "Customer Support",
      note: input.note?.trim() || undefined,
    };

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
        portal_type: resolvedPortalType,
        action: "IMPERSONATION_STARTED",
        reason: input.reason || "Customer Support",
        note: input.note?.trim() || null,
        started_at: startedAt,
      });
    } catch (auditErr) {
      console.warn("[startImpersonationAction] Audit log insert warning:", auditErr);
    }

    // 8. Generate Single-Use Cross-Domain Handoff Token & Redirect URL
    const handoffCode = createHandoffToken(sessionData);
    const baseUrl = getPortalBaseUrl(resolvedPortalType);
    const handoffPath = `/api/auth/impersonation-handoff?code=${encodeURIComponent(handoffCode)}`;
    const redirectUrl = baseUrl ? `${baseUrl}${handoffPath}` : handoffPath;

    return { success: true, redirectUrl };
  } catch (err: any) {
    console.error("[IMPERSONATION_SESSION_CREATE_FAILED] Error:", err);
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
    try {
      cookieStore.delete(COOKIE_NAME);
    } catch (e) {}

    const adminBaseUrl = getAdminBaseUrl();
    let targetPath = "/admin";

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
        console.warn("[stopImpersonationAction] Audit log warning:", auditErr);
      }
    }

    const redirectUrl = adminBaseUrl ? `${adminBaseUrl}${targetPath}` : targetPath;

    return { success: true, redirectUrl };
  } catch (err: any) {
    const adminBaseUrl = getAdminBaseUrl();
    const redirectUrl = adminBaseUrl ? `${adminBaseUrl}/admin` : "/admin";
    return { success: false, redirectUrl, error: err?.message || "세션 종료 처리 중 오류가 발생했습니다." };
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

export const startImpersonationActionInternal = startImpersonationAction;
export const stopImpersonationActionInternal = stopImpersonationAction;
export const getImpersonationAuditLogsActionInternal = getImpersonationAuditLogsAction;
