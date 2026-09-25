"use server";

import { revalidatePath } from "next/cache";
import { verifyPortalSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env/public";
import { passwordSchema, PASSWORD_RULE_DESCRIPTION } from "@/lib/auth/password";
import { requestPasswordReset } from "@/lib/auth/reset-password";

export interface MyAccountData {
  userId: string;
  email: string;
  name: string;
  phone: string;
  title: string;
  position: string;
  companyRole: "company_admin" | "company_staff";
  status: "active" | "invited" | "suspended" | "removed";
  isPrimary: boolean;
  companyId: string;
  companyName: string;
  createdAt: string;
  joinedAt: string;
}

export interface UpdateProfilePayload {
  name: string;
  phone?: string;
  title?: string;
  position?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * PORT-ACC-001: Get authenticated Brand Portal user's own account data
 */
export async function getMyAccountData(): Promise<MyAccountData> {
  const session = await verifyPortalSession();
  const adminClient = createAdminClient();

  const { data: userRecord, error: userError } = await adminClient
    .from("company_users")
    .select(
      "id, company_id, name, email, company_role, status, title, position, phone, is_primary, created_at, joined_at, companies(id, name)"
    )
    .eq("id", session.userId)
    .maybeSingle();

  if (userError) {
    console.error("[getMyAccountData] Error loading company user:", userError);
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("display_name, created_at")
    .eq("id", session.userId)
    .maybeSingle();

  const rawCompany = userRecord?.companies as any;

  return {
    userId: session.userId,
    email: session.email,
    name: userRecord?.name || profile?.display_name || "",
    phone: userRecord?.phone || "",
    title: userRecord?.title || "",
    position: userRecord?.position || "",
    companyRole: (userRecord?.company_role as any) || "company_staff",
    status: (userRecord?.status as any) || "active",
    isPrimary: userRecord?.is_primary || false,
    companyId: userRecord?.company_id || "",
    companyName: rawCompany?.name || "소속 회사",
    createdAt: userRecord?.created_at || profile?.created_at || "",
    joinedAt: userRecord?.joined_at || "",
  };
}

/**
 * PORT-ACC-001: Update user's own personal profile (name, phone, title, position/department).
 * Security: Strictly enforces that only the authenticated user's own record can be updated.
 * Role, company, status, and email cannot be altered through this action.
 */
export async function updateMyAccountProfileAction(
  payload: UpdateProfilePayload
): Promise<ActionResult> {
  try {
    const session = await verifyPortalSession();
    if (!session || !session.userId) {
      return { success: false, error: "인증 세션이 만료되었습니다. 다시 로그인해 주세요." };
    }

    const { name, phone, title, position } = payload;

    if (!name || !name.trim()) {
      return { success: false, error: "이름을 입력해 주세요." };
    }

    const adminClient = createAdminClient();

    // 1. Update company_users table
    const { error: updateError } = await adminClient
      .from("company_users")
      .update({
        name: name.trim(),
        phone: phone?.trim() || null,
        title: title?.trim() || null,
        position: position?.trim() || null,
      })
      .eq("id", session.userId);

    if (updateError) {
      console.error("[updateMyAccountProfileAction] update error:", updateError);
      return { success: false, error: "프로필 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
    }

    // 2. Synchronize profiles table display_name
    await adminClient
      .from("profiles")
      .update({ display_name: name.trim() })
      .eq("id", session.userId);

    revalidatePath("/portal/account");
    revalidatePath("/portal/company/users");
    revalidatePath("/portal");

    return { success: true, message: "프로필 정보가 성공적으로 변경되었습니다." };
  } catch (err: any) {
    if (err?.digest?.includes("NEXT_REDIRECT")) throw err;
    console.error("[updateMyAccountProfileAction] Unexpected error:", err);
    return { success: false, error: "프로필 저장 중 예기치 않은 오류가 발생했습니다." };
  }
}

/**
 * PORT-ACC-001: Self-Service Password Change for authenticated Brand Portal user.
 * Re-authenticates current password securely and updates password in Supabase Auth.
 */
export async function changeMyAccountPasswordAction(
  payload: ChangePasswordPayload
): Promise<ActionResult> {
  try {
    const session = await verifyPortalSession();
    if (!session || !session.userId || !session.email) {
      return { success: false, error: "인증 세션이 만료되었습니다. 다시 로그인해 주세요." };
    }

    const { currentPassword, newPassword, confirmPassword } = payload;

    if (!currentPassword || !currentPassword.trim()) {
      return { success: false, error: "현재 비밀번호를 입력해 주세요." };
    }

    if (!newPassword || !newPassword.trim()) {
      return { success: false, error: "새 비밀번호를 입력해 주세요." };
    }

    if (!confirmPassword || !confirmPassword.trim()) {
      return { success: false, error: "새 비밀번호 확인을 입력해 주세요." };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: "새 비밀번호와 확인 비밀번호가 서로 일치하지 않습니다." };
    }

    if (newPassword === currentPassword) {
      return { success: false, error: "새 비밀번호는 현재 비밀번호와 달라야 합니다." };
    }

    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || `비밀번호는 ${PASSWORD_RULE_DESCRIPTION}해야 합니다.`,
      };
    }

    // Current Password Re-Authentication using an isolated Supabase Client
    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const testAuthClient = createSupabaseClient(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: authData, error: authError } = await testAuthClient.auth.signInWithPassword({
      email: session.email,
      password: currentPassword,
    });

    if (authError || !authData.user) {
      return { success: false, error: "현재 비밀번호가 올바르지 않습니다." };
    }

    // Update in Supabase Auth using cookie client
    const supabase = await createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      const adminClient = createAdminClient();
      const { error: adminUpdateError } = await adminClient.auth.admin.updateUserById(
        session.userId,
        { password: newPassword }
      );

      if (adminUpdateError) {
        const msg = (adminUpdateError.message || updateError.message || "").toLowerCase();
        if (msg.includes("different") || msg.includes("same") || msg.includes("old password")) {
          return { success: false, error: "새 비밀번호는 현재 비밀번호와 달라야 합니다." };
        }
        return { success: false, error: "비밀번호 변경 처리에 실패했습니다. 잠시 후 다시 시도해 주세요." };
      }
    }

    return { success: true, message: "비밀번호가 성공적으로 변경되었습니다." };
  } catch (err: any) {
    if (err?.digest?.includes("NEXT_REDIRECT")) throw err;
    console.error("[changeMyAccountPasswordAction] Unexpected error:", err);
    return { success: false, error: "비밀번호 변경 중 예기치 않은 오류가 발생했습니다." };
  }
}

/**
 * PORT-ACC-001: Trigger a secure password reset email for the current logged-in user.
 */
export async function sendMyAccountPasswordResetEmailAction(): Promise<ActionResult> {
  try {
    const session = await verifyPortalSession();
    const formData = new FormData();
    formData.append("email", session.email);

    const res = await requestPasswordReset(undefined, formData);
    return {
      success: true,
      message: res?.message || "가입하신 이메일로 비밀번호 재설정 링크를 보내드렸습니다.",
    };
  } catch (err: any) {
    if (err?.digest?.includes("NEXT_REDIRECT")) throw err;
    console.error("[sendMyAccountPasswordResetEmailAction] Error:", err);
    return { success: false, error: "비밀번호 재설정 이메일 발송에 실패했습니다." };
  }
}
