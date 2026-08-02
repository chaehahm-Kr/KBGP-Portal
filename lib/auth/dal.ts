import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "portal" | "admin";

export type VerifiedSession = {
  userId: string;
  email: string;
  role: AppRole;
};

const LOGIN_PATH: Record<AppRole, string> = {
  portal: "/portal/login",
  admin: "/admin/login",
};

/**
 * Data Access Layer의 핵심 함수. area("portal" 또는 "admin")별로 세션을 검증한다.
 *
 * getSession()이나 getClaims()가 아니라 getUser()를 쓴다: getSession()은 쿠키 내용을
 * 그대로 신뢰하는 "낙관적 확인"이고, getClaims()는 새 Supabase 프로젝트 기본값인
 * 비대칭 키 서명 방식에서는 로컬에서 JWT 서명만 검증하고 끝난다 — 둘 다 액세스 토큰이
 * 아직 만료 전이면 계정이 방금 정지(ban)되었어도 이를 감지하지 못한다.
 * (proxy.ts에서는 반대로 getClaims()를 쓴다 — 거기서는 "로그인 여부"만 빠르게 걸러내면
 * 충분하고, 권한이 필요한 화면의 최종 판단은 항상 이 DAL이 맡기 때문이다.)
 *
 * **명세서 10 검증 중 발견한 정정 사항**: 애초에는 getUser()가 Supabase Auth
 * 서버에 매번 재확인하므로 ban_duration 정지가 "다음 요청부터 즉시 반영"된다고
 * 가정하고 있었는데, 실제로 access token이 아직 만료 전이면 ban을 걸어도
 * `/auth/v1/user`(=getUser())가 여전히 200을 반환하는 것을 직접 REST 호출로
 * 확인했다 — GoTrue는 ban을 로그인/토큰 갱신 시점에만 걸러내고, 이미 발급된
 * 유효기간 내 JWT 자체를 즉시 무효화하지는 않는다. 그래서 "지금 로그인되어 있어도
 * 즉시 튕겨나감"(10_보안과권한요구사항.md 3번)을 실제로 만족시키는 건 ban이 아니라
 * 아래의 status 컬럼 확인이다 — company_users/staff_members 상태를 DB에서 직접
 * 매 요청마다 조회하므로 access token의 유효기간과 무관하게 즉시 반영된다.
 * ban_duration은 그래도 재로그인·토큰 갱신을 막는 보조 수단으로 유지한다.
 *
 * profiles.role이 area와 다르면(예: 포털 계정으로 /admin 진입 시도) 로그인 자체가
 * 안 된 것처럼 해당 area의 로그인 화면으로 돌려보낸다 — "왜 안 되는지" 상세히
 * 알려주지 않는다(10_보안과권한요구사항.md 3번, 정보 노출 최소화 원칙).
 */
async function verifySession(area: AppRole): Promise<VerifiedSession> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(LOGIN_PATH[area]);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== area) {
    redirect(LOGIN_PATH[area]);
  }

  if (area === "admin") {
    const { data: staffMember } = await supabase
      .from("staff_members")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    if (!staffMember || staffMember.status !== "active") {
      redirect(LOGIN_PATH[area]);
    }
  } else {
    const { data: companyUser } = await supabase
      .from("company_users")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    if (!companyUser || companyUser.status !== "active") {
      redirect(LOGIN_PATH[area]);
    }
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    role: profile.role as AppRole,
  };
}

// React cache()로 같은 렌더 패스 안에서는 중복 호출해도 한 번만 실제 검증한다.
export const verifyPortalSession = cache(() => verifySession("portal"));
export const verifyAdminSession = cache(() => verifySession("admin"));

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
