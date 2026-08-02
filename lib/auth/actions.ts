"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/dal";
import { checkLoginLockout, recordLoginAttempt } from "@/lib/auth/login-attempts";

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

  const lockout = await checkLoginLockout(email);
  if (lockout.locked) {
    return {
      error: `로그인 시도가 너무 많습니다. ${lockout.retryAfterMinutes}분 후 다시 시도해주세요.`,
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  await recordLoginAttempt(email, !error && Boolean(data.user));

  if (error?.code === "email_not_confirmed") {
    return {
      error:
        "이메일 인증이 아직 완료되지 않았습니다. 가입 시 받으신 이메일의 링크를 먼저 확인해주세요.",
    };
  }

  if (error || !data.user) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (!profile || profile.role !== area) {
    // 다른 area의 계정으로 로그인 시도 — 즉시 세션을 정리하고 area 전용 오류만 안내한다.
    await supabase.auth.signOut();
    return {
      error:
        area === "portal"
          ? "이 계정은 파트너 포털 계정이 아닙니다."
          : "이 계정은 관리자 계정이 아닙니다.",
    };
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
