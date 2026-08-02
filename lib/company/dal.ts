import "server-only";
import { redirect } from "next/navigation";
import { verifyPortalSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { CompanyRole } from "@/lib/company/types";

export type CompanyMembership = {
  userId: string;
  companyId: string;
  companyRole: CompanyRole;
};

/**
 * "로그인은 되어 있고, 정상적으로 활동 중인 회사 소속원인가"를 확인한다.
 * 브랜드/제품 등록처럼 Company Admin·Staff 둘 다 할 수 있는 화면·액션에서 쓴다
 * (02_사용자유형과권한표.md 권한 매트릭스: "브랜드/제품 등록 | 본인 소속만 | 본인 소속만").
 */
export async function requireCompanyMembership(): Promise<CompanyMembership> {
  const session = await verifyPortalSession();
  const supabase = await createClient();

  const { data: companyUser } = await supabase
    .from("company_users")
    .select("company_id, company_role, status")
    .eq("id", session.userId)
    .single();

  if (!companyUser || companyUser.status !== "active") {
    redirect("/portal");
  }

  return {
    userId: session.userId,
    companyId: companyUser.company_id,
    companyRole: companyUser.company_role as CompanyRole,
  };
}

/**
 * 08_주요화면과AC.md "소속 사용자 관리" 권한 규칙: "Company Admin만 접근.
 * Company Staff는 이 화면 자체가 보이지 않음". 화면(Server Component)과 서버
 * 액션 양쪽에서 매번 이 확인을 거친다 — 메뉴를 숨기는 것만으로는 부족하다
 * (10_보안과권한요구사항.md 3번, 서버가 매 요청마다 권한을 재확인해야 함).
 */
export async function requireCompanyAdmin(): Promise<CompanyMembership> {
  const membership = await requireCompanyMembership();
  if (membership.companyRole !== "company_admin") {
    redirect("/portal");
  }
  return membership;
}
