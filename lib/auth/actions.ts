"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/auth/dal";
import { checkLoginLockout, recordLoginAttempt, resetLoginAttempts } from "@/lib/auth/login-attempts";

export type LoginFormState = { error: string } | undefined;

const HOME_PATH: Record<AppRole, string> = {
  portal: "/portal",
  admin: "/admin",
};

/**
 * 이메일+비밀번호 로그인 처리. area별로 로그인 경로가 완전히 분리되어 있으므로
 * (10_보안과권한요구사항.md 2번) 이 함수도 portal/admin 각각의 서버 액션으로 감싸 노출한다.
 *
 * 5회 연속 실패 시 15분 잠금(10_보안과권한요구사항.md 2번)은 lib/auth/login-attempts.ts가
 * 담당한다. 잠긴 동안에는 Supabase Auth에 실제 로그인 요청 자체를 보내지 않는다 —
 * 무차별 대입 시도가 계속 Auth 서버까지 도달하는 것을 막기 위함이다.
 */
async function login(
  area: AppRole,
  formData: FormData
): Promise<LoginFormState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email ||
    !password
  ) {
    return { error: "이메일과 비밀번호를 입력해주세요." };
  }

  const normalizedEmail = email.trim().toLowerCase();

  const lockout = await checkLoginLockout(normalizedEmail);
  if (lockout.locked) {
    return {
      error: `로그인 시도가 너무 많습니다. ${lockout.retryAfterMinutes}분 후 다시 시도해주세요.`,
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    if (error.code === "email_not_confirmed" || error.message?.includes("Email not confirmed")) {
      return {
        error:
          "이메일 인증이 아직 완료되지 않았습니다. 가입 시 받으신 이메일의 링크를 먼저 확인해주세요.",
      };
    }
    
    // Server / Network / 5xx system failure
    if ((error.status && error.status >= 500) || error.message?.includes("fetch failed")) {
      console.error("[login] System auth error:", error);
      return {
        error: "로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
      };
    }

    // Record failure only for actual invalid credentials
    await recordLoginAttempt(normalizedEmail, false);
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  if (!data.user) {
    await recordLoginAttempt(normalizedEmail, false);
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  // Clear failure counter immediately upon successful credential authentication
  await resetLoginAttempts(normalizedEmail);

  const adminClient = createAdminClient();

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== area) {
    // 다른 area의 계정으로 로그인 시도 — 즉시 세션을 정리하고 area 전용 오류만 안내한다.
    await supabase.auth.signOut();
    return {
      error:
        area === "portal"
          ? "이 계정은 파트너 포털 계정이 아닙니다."
          : "이 계정은 관리자 계정이 아닙니다.",
    };
  }

  // 계정 상태 사전 검증
  if (area === "portal") {
    const { data: companyUser } = await adminClient
      .from("company_users")
      .select("status")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!companyUser) {
      await supabase.auth.signOut();
      return {
        error: "소속 회사 정보가 조회되지 않는 계정입니다. 관리자에게 문의해주세요.",
      };
    }
    if (companyUser.status === "invited") {
      await supabase.auth.signOut();
      return {
        error: "초대 수락 및 비밀번호 설정이 완료되지 않았습니다. 수신하신 초대 이메일의 링크를 통해 가입을 완료해주세요.",
      };
    }
    if (companyUser.status === "suspended") {
      await supabase.auth.signOut();
      return {
        error: "이용이 정지된 계정입니다. 회사 관리자에게 문의해주세요.",
      };
    }
    if (companyUser.status === "removed") {
      await supabase.auth.signOut();
      return {
        error: "소속 멤버에서 제외된 계정입니다. 회사 관리자에게 문의해주세요.",
      };
    }
  } else if (area === "admin") {
    const { data: staffMember } = await adminClient
      .from("staff_members")
      .select("status")
      .eq("id", data.user.id)
      .maybeSingle();

    if (staffMember && staffMember.status === "suspended") {
      await supabase.auth.signOut();
      return {
        error: "이용이 정지된 관리자 계정입니다.",
      };
    }
  }

  redirect(HOME_PATH[area]);
}

export async function loginPortal(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  return login("portal", formData);
}

export async function loginAdmin(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  return login("admin", formData);
}

export async function logoutPortal() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/portal/login");
}

export async function logoutAdmin() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
