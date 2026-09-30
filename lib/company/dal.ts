import "server-only";
import { redirect } from "next/navigation";
import { verifyPortalSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CompanyRole } from "@/lib/company/types";

export type CompanyMembership = {
  userId: string;
  companyId: string;
  companyRole: CompanyRole;
  isImpersonating?: boolean;
};

/**
 * "로그인은 되어 있고, 정상적으로 활동 중인 회사 소속원인가"를 확인한다.
 * 브랜드/제품 등록처럼 Company Admin·Staff 둘 다 할 수 있는 화면·액션에서 쓴다.
 * 지원 세션(Impersonation) 실행 시 RLS 차단을 방지하기 위해 Service Role 클라이언트를 안전하게 사용한다.
 */
export async function requireCompanyMembership(): Promise<CompanyMembership> {
  const session = await verifyPortalSession();
  const supabase = createAdminClient();

  const { data: companyUser } = await supabase
    .from("company_users")
    .select("company_id, company_role, status")
    .eq("id", session.userId)
    .maybeSingle();

  if (!companyUser || companyUser.status !== "active") {
    console.warn(`[Auth Security Audit] Company membership check failed for user ${session.userId}, status: ${companyUser?.status || "missing"}`);
    redirect("/portal/login?reason=membership_inactive");
  }

  return {
    userId: session.userId,
    companyId: companyUser.company_id,
    companyRole: companyUser.company_role as CompanyRole,
    isImpersonating: session.isImpersonating,
  };
}

/**
 * 포털 테넌트 컨텍스트 및 안전하게 바인딩된 Supabase 클라이언트를 반환합니다.
 * Impersonation 세션인 경우 createAdminClient()를 사용하고, 일반 세션인 경우 createClient()를 사용합니다.
 */
export async function getPortalTenantContext() {
  const membership = await requireCompanyMembership();
  const supabase = membership.isImpersonating ? createAdminClient() : await createClient();
  return {
    ...membership,
    supabase,
  };
}

/**
 * 소속 사용자 관리 권한 확인 (Company Admin 전용).
 */
export async function requireCompanyAdmin(): Promise<CompanyMembership> {
  const membership = await requireCompanyMembership();
  if (membership.companyRole !== "company_admin") {
    console.warn(`[Auth Security Audit] Company admin role check failed for user ${membership.userId}, role: ${membership.companyRole}`);
    redirect("/portal/login?reason=role_mismatch");
  }
  return membership;
}
