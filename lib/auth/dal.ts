import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { getImpersonationSession } from "@/lib/auth/impersonation";

export type AppRole = "portal" | "admin" | "retailer";

export type VerifiedSession = {
  userId: string;
  email: string;
  role: AppRole;
  isImpersonating?: boolean;
  impersonationSession?: any;
};

const LOGIN_PATH: Record<AppRole, string> = {
  portal: "/portal/login",
  admin: "/admin/login",
  retailer: "/login",
};

/**
 * Data Access Layer의 핵심 함수. area("portal", "admin", "retailer")별로 세션을 검증한다.
 * React cache()로 동일 요청 내 중복 네트워크 및 DB 호출을 방지합니다.
 */
const verifySession = cache(async (area: AppRole): Promise<VerifiedSession> => {
  // Check Admin Impersonation override for portal and retailer areas
  if (area === "portal" || area === "retailer") {
    const impSession = await getImpersonationSession();
    if (impSession) {
      const expectedType = area === "portal" ? "BRAND" : "RETAILER";
      if (impSession.portalType === expectedType) {
        return {
          userId: impSession.targetUserId,
          email: impSession.targetUserEmail,
          role: area,
          isImpersonating: true,
          impersonationSession: impSession,
        };
      }
    }
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    const reasonCode = userError ? "AUTH_GET_USER_ERROR" : "AUTH_USER_NOT_FOUND";
    console.warn(`[Auth Security Audit] [${new Date().toISOString()}] DAL verifySession [${area}] rejected. Reason: ${reasonCode}`, userError?.message || "");
    redirect(`${LOGIN_PATH[area]}?reason=session_expired`);
  }

  const adminClient = createAdminClient();

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== area) {
    console.warn(`[Auth Security Audit] [${new Date().toISOString()}] DAL verifySession [${area}] role mismatch for user ${user.id}. Expected: ${area}, Found: ${profile?.role || "none"}`);
    redirect(`${LOGIN_PATH[area]}?reason=role_mismatch`);
  }

  if (area === "admin") {
    const { data: staffMember } = await adminClient
      .from("staff_members")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    // Allow invited, setting_up, and active to pass verifySession (so they can reach setup-profile page)
    if (!staffMember || !["active", "invited", "setting_up"].includes(staffMember.status)) {
      console.warn(`[Auth Security Audit] [${new Date().toISOString()}] DAL verifySession [${area}] staff status rejected for user ${user.id}. Status: ${staffMember?.status || "missing"}`);
      redirect(`${LOGIN_PATH[area]}?reason=account_inactive`);
    }
  } else if (area === "portal") {
    const { data: companyUser } = await adminClient
      .from("company_users")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    if (!companyUser || companyUser.status !== "active") {
      console.warn(`[Auth Security Audit] [${new Date().toISOString()}] DAL verifySession [${area}] company_user status rejected for user ${user.id}. Status: ${companyUser?.status || "missing"}`);
      redirect(`${LOGIN_PATH[area]}?reason=membership_inactive`);
    }
  } else if (area === "retailer") {
    const { data: companyUser } = await adminClient
      .from("company_users")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    if (!companyUser || !["active", "invited"].includes(companyUser.status)) {
      console.warn(`[Auth Security Audit] [${new Date().toISOString()}] DAL verifySession [${area}] retailer user status rejected for user ${user.id}. Status: ${companyUser?.status || "missing"}`);
      redirect(`${LOGIN_PATH[area]}?reason=membership_inactive`);
    }
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    role: profile.role as AppRole,
  };
});

/**
 * 안전하게 현재 호출자의 AppRole ("admin" | "portal" | "retailer")을 확인합니다.
 * 세션이 없거나 유효하지 않으면 null을 반환하며 redirect를 발생시키지 않습니다.
 */
export async function getCallerAppRole(): Promise<AppRole | null> {
  try {
    const impSession = await getImpersonationSession();
    if (impSession) {
      if (impSession.portalType === "BRAND") return "portal";
      if (impSession.portalType === "RETAILER") return "retailer";
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return null;

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || !profile.role) return null;
    return profile.role as AppRole;
  } catch {
    return null;
  }
}

// React cache()로 같은 렌더 패스 안에서는 중복 호출해도 한 번만 실제 검증한다.
export const verifyPortalSession = cache(() => verifySession("portal"));
export const verifyRetailerSession = cache(() => verifySession("retailer"));

export type RetailerUserContext = {
  userId: string;
  userEmail: string;
  userName: string;
  companyId?: string;
  companyName: string;
  role: string;
  storeName: string;
  isImpersonating?: boolean;
};

/**
 * React cache()로 감싼 Retailer 공통 세션 및 조직/매장 메타데이터 조회 함수.
 * layout 및 각 페이지에서 중복 호출해도 한 요청당 1회만 병렬 DB 조회(Promise.all)를 수행합니다.
 */
export const getRetailerUserContext = cache(async (): Promise<RetailerUserContext> => {
  const impSession = await getImpersonationSession();
  if (impSession && impSession.portalType === "RETAILER") {
    return {
      userId: impSession.targetUserId,
      userEmail: impSession.targetUserEmail,
      userName: impSession.targetUserName || "Retailer Partner",
      companyId: impSession.targetCompanyId,
      companyName: impSession.targetCompanyName || "K SELECT Retailer",
      role: "owner",
      storeName: "Main Store",
      isImpersonating: true,
    };
  }

  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  const [profileRes, companyUserRes, retailerRoleRes] = await Promise.all([
    adminClient
      .from("profiles")
      .select("display_name, role")
      .eq("id", session.userId)
      .maybeSingle(),
    adminClient
      .from("company_users")
      .select("company_id, company_role, companies!company_users_company_id_fkey(id, name)")
      .eq("id", session.userId)
      .maybeSingle(),
    adminClient
      .from("retailer_user_roles")
      .select("role, has_all_stores_access")
      .eq("user_id", session.userId)
      .maybeSingle(),
  ]);

  const company = companyUserRes.data?.companies as any;
  const companyId = company?.id || companyUserRes.data?.company_id;
  const companyName = company?.name || "K SELECT Retailer";

  let storeName = "Main Store";
  if (companyId) {
    const storeRes = await adminClient
      .from("stores")
      .select("name")
      .eq("company_id", companyId)
      .limit(1)
      .maybeSingle();

    if (storeRes.data?.name) {
      storeName = storeRes.data.name;
    }
  }

  return {
    userId: session.userId,
    userEmail: session.email,
    userName: profileRes.data?.display_name || session.email.split("@")[0] || "Retailer User",
    companyId,
    companyName,
    role: retailerRoleRes.data?.role || companyUserRes.data?.company_role || "owner",
    storeName,
  };
});

/**
 * 활성화된 일반 직원(Active)만 접근을 허용합니다.
 * 만약 'invited' 또는 'setting_up' 상태라면 프로필 설정 화면으로 강제 리디렉션합니다.
 */
export const verifyAdminSession = cache(async () => {
  const session = await verifySession("admin");
  const supabase = await createClient();
  
  const { data: staffMember } = await supabase
    .from("staff_members")
    .select("status")
    .eq("id", session.userId)
    .single();

  if (staffMember && (staffMember.status === "invited" || staffMember.status === "setting_up")) {
    redirect("/admin/setup-profile");
  }

  return session;
});

/**
 * 최초 로그인 단계에 있는 직원('invited', 'setting_up')만 프로필 설정을 위해 접근을 허용합니다.
 * 이미 활성화된 직원은 일반 어드민 홈(/admin)으로 돌려보냅니다.
 */
export const verifyPendingAdminSession = cache(async () => {
  const session = await verifySession("admin");
  const supabase = await createClient();
  
  const { data: staffMember } = await supabase
    .from("staff_members")
    .select("status")
    .eq("id", session.userId)
    .single();

  if (!staffMember || !["invited", "setting_up"].includes(staffMember.status)) {
    redirect("/admin");
  }

  return session;
});

/**
 * 이메일 템플릿 수정처럼 Super Admin 전용인 화면·액션에서 쓴다
 * (`08_주요화면과AC.md` 화면 20: "설정(이메일 템플릿) | Super Admin"). 일반 admin이
 * 접근하면 관리자 홈으로 돌려보낸다.
 */
export const requireSuperAdmin = cache(async (): Promise<VerifiedSession> => {
  const session = await verifyAdminSession();
  const supabase = await createClient();

  const { data: roles } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("staff_id", session.userId);

  const isSuperAdmin = (roles ?? []).some((r) => r.role === "super_admin");
  if (!isSuperAdmin) {
    redirect("/admin");
  }

  return session;
});
