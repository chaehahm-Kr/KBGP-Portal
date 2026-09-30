"use server";

import { revalidatePath } from "next/cache";
import { verifyPortalSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env/public";
import { passwordSchema, PASSWORD_RULE_DESCRIPTION } from "@/lib/auth/password";
import { requestPasswordReset } from "@/lib/auth/reset-password";

import { getPersonStructuredNames, ResolvablePersonName } from "@/lib/user/name-helper";
import { validateEnglishName } from "@/lib/validation/global-validators";

export interface MyAccountData {
  userId: string;
  email: string;
  koreanLastName: string;
  koreanFirstName: string;
  name: string;
  firstName: string;
  lastName: string;
  englishName: string;
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
  koreanLastName?: string;
  koreanFirstName?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  englishName?: string;
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
  profile?: {
    koreanLastName: string;
    koreanFirstName: string;
    name: string;
    firstName: string;
    lastName: string;
    englishName: string;
    phone: string;
    title: string;
    position: string;
  };
}

/**
 * PORT-ACC-001 / PORT-NAME-001: Get authenticated Brand Portal user's own account data
 */
export async function getMyAccountData(): Promise<MyAccountData> {
  const session = await verifyPortalSession();
  const adminClient = createAdminClient();

  let userRecord: any = null;
  const { data: userById, error: userError } = await adminClient
    .from("company_users")
    .select(
      "id, company_id, name, email, company_role, status, title, position, phone, is_primary, permissions, created_at, joined_at"
    )
    .eq("id", session.userId)
    .maybeSingle();

  if (userById) {
    userRecord = userById;
  } else if (session.email) {
    const { data: userByEmail } = await adminClient
      .from("company_users")
      .select(
        "id, company_id, name, email, company_role, status, title, position, phone, is_primary, permissions, created_at, joined_at"
      )
      .eq("email", session.email.toLowerCase().trim())
      .maybeSingle();
    userRecord = userByEmail;
  }

  if (userError) {
    console.error("[getMyAccountData] Error loading company user:", userError);
  }

  let companyName = "소속 회사";
  if (userRecord?.company_id) {
    const { data: comp } = await adminClient
      .from("companies")
      .select("name")
      .eq("id", userRecord.company_id)
      .maybeSingle();
    if (comp?.name) {
      companyName = comp.name;
    }
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("display_name, created_at")
    .eq("id", session.userId)
    .maybeSingle();

  const structured = getPersonStructuredNames({
    ...userRecord,
    displayName: profile?.display_name,
    email: session.email,
  });

  return {
    userId: session.userId,
    email: session.email,
    koreanLastName: structured.koreanLastName,
    koreanFirstName: structured.koreanFirstName,
    name: structured.koreanFullName || userRecord?.name || profile?.display_name || "",
    firstName: structured.englishFirstName,
    lastName: structured.englishLastName,
    englishName: structured.englishFullName,
    phone: userRecord?.phone || "",
    title: userRecord?.title || "",
    position: userRecord?.position || "",
    companyRole: (userRecord?.company_role as any) || "company_staff",
    status: (userRecord?.status as any) || "active",
    isPrimary: userRecord?.is_primary || false,
    companyId: userRecord?.company_id || "",
    companyName: companyName,
    createdAt: userRecord?.created_at || profile?.created_at || "",
    joinedAt: userRecord?.joined_at || "",
  };
}

/**
 * PORT-ACC-001 / PORT-PROFILE-002: Update user's own personal profile (name, englishName, phone, title, position/department).
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

    const { koreanLastName, koreanFirstName, name, firstName, lastName, phone, title, position } = payload;

    const trimmedKoreanLast = (koreanLastName || "").trim();
    const trimmedKoreanFirst = (koreanFirstName || "").trim();
    const trimmedFirst = (firstName || "").trim();
    const trimmedLast = (lastName || "").trim();
    const computedKoreanName = trimmedKoreanLast && trimmedKoreanFirst
      ? `${trimmedKoreanLast}${trimmedKoreanFirst}`
      : (name || "").trim();
    const trimmedTitle = (title || "").trim();
    const trimmedPhone = (phone || "").trim();
    const trimmedPosition = (position || "").trim();

    if (!trimmedKoreanLast && !computedKoreanName) {
      return { success: false, error: "한글 성(Korean Last Name)을 입력해 주세요. (예: 박)" };
    }
    if (!trimmedKoreanFirst && !computedKoreanName) {
      return { success: false, error: "한글 이름(Korean First Name)을 입력해 주세요. (예: 은애)" };
    }
    const lastValidation = validateEnglishName(trimmedLast, {
      required: true,
      fieldNameKo: "영문 성",
      language: "ko",
    });
    if (!lastValidation.valid) {
      return { success: false, error: lastValidation.error! };
    }

    const firstValidation = validateEnglishName(trimmedFirst, {
      required: true,
      fieldNameKo: "영문 이름",
      language: "ko",
    });
    if (!firstValidation.valid) {
      return { success: false, error: firstValidation.error! };
    }
    if (!trimmedTitle) {
      return { success: false, error: "직함을 입력해 주세요. (예: 대표이사, 이사, 팀장)" };
    }
    if (!trimmedPhone) {
      return { success: false, error: "연락처를 입력해 주세요." };
    }

    const combinedEnglishName = `${trimmedFirst} ${trimmedLast}`.trim();

    const adminClient = createAdminClient();

    // 1. Update company_users table (Authoritative user record across Portal & Admin)
    let targetUserId = session.userId;
    const { data: existingUser } = await adminClient
      .from("company_users")
      .select("id, company_id, permissions")
      .or(`id.eq.${session.userId},email.eq.${session.email.toLowerCase().trim()}`)
      .maybeSingle();

    if (existingUser) {
      targetUserId = existingUser.id;
    }

    const updatedPermissions = {
      ...(existingUser?.permissions || {}),
      korean_last_name: trimmedKoreanLast,
      korean_first_name: trimmedKoreanFirst,
      english_name: combinedEnglishName,
      english_first_name: trimmedFirst,
      english_last_name: trimmedLast,
      first_name: trimmedFirst,
      last_name: trimmedLast,
    };

    const updatePayload: Record<string, any> = {
      name: computedKoreanName,
      phone: trimmedPhone,
      title: trimmedTitle,
      position: trimmedPosition || null,
      permissions: updatedPermissions,
      english_name: combinedEnglishName,
    };

    let { data: updatedUser, error: updateError } = await adminClient
      .from("company_users")
      .update(updatePayload)
      .eq("id", targetUserId)
      .select("id, company_id, name, phone, title, position, permissions")
      .single();

    if (updateError && updateError.code === "42703") {
      delete updatePayload.english_name;
      const retry = await adminClient
        .from("company_users")
        .update(updatePayload)
        .eq("id", targetUserId)
        .select("id, company_id, name, phone, title, position, permissions")
        .single();
      updatedUser = retry.data;
      updateError = retry.error;
    }

    if (updateError || !updatedUser) {
      console.error("[updateMyAccountProfileAction] update error:", updateError);
      return { success: false, error: "프로필 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
    }

    // 2. Strict read-back verification to guarantee DB persistence before returning success
    const { data: verifiedUser, error: verifyError } = await adminClient
      .from("company_users")
      .select("id, name, phone, title, position, company_id, permissions")
      .eq("id", targetUserId)
      .single();

    const verifiedEnglishName = (
      (verifiedUser as any)?.english_name ||
      verifiedUser?.permissions?.english_name ||
      ""
    ).trim();

    if (
      verifyError ||
      !verifiedUser ||
      verifiedUser.name !== computedKoreanName ||
      verifiedEnglishName !== combinedEnglishName ||
      verifiedUser.title !== trimmedTitle ||
      verifiedUser.phone !== trimmedPhone ||
      (verifiedUser.position || "") !== trimmedPosition
    ) {
      console.error("[updateMyAccountProfileAction] Read-back verification failed:", { verifyError, verifiedUser, verifiedEnglishName });
      return { success: false, error: "데이터베이스 저장 검증에 실패했습니다. 다시 시도해 주세요." };
    }

    // 3. Synchronize profiles table display_name
    await adminClient
      .from("profiles")
      .update({ display_name: computedKoreanName })
      .eq("id", session.userId);

    // 4. Mark admin_profile_onboarding_confirmed_at on company metadata AND sync contacts array
    const targetCompanyId = updatedUser.company_id || verifiedUser.company_id;
    if (targetCompanyId) {
      const { data: comp } = await adminClient
        .from("companies")
        .select("intro, contact_name, contact_phone")
        .eq("id", targetCompanyId)
        .single();

      let metaObj: Record<string, any> = {};
      if (comp?.intro && comp.intro.startsWith("__COMPANY_METADATA__:")) {
        try {
          metaObj = JSON.parse(comp.intro.substring("__COMPANY_METADATA__:".length));
        } catch {}
      }
      metaObj.admin_profile_onboarding_confirmed_at = new Date().toISOString();

      // Synchronize contacts in company intro metadata JSON
      if (Array.isArray(metaObj.contacts)) {
        const idx = metaObj.contacts.findIndex(
          (c: any) => c.id === targetUserId || (session.email && c.email?.toLowerCase() === session.email.toLowerCase())
        );
        if (idx !== -1) {
          metaObj.contacts[idx].koreanLastName = trimmedKoreanLast;
          metaObj.contacts[idx].koreanFirstName = trimmedKoreanFirst;
          metaObj.contacts[idx].name = computedKoreanName;
          metaObj.contacts[idx].englishName = combinedEnglishName;
          metaObj.contacts[idx].englishFirstName = trimmedFirst;
          metaObj.contacts[idx].englishLastName = trimmedLast;
          metaObj.contacts[idx].firstName = trimmedFirst;
          metaObj.contacts[idx].lastName = trimmedLast;
          metaObj.contacts[idx].phone = trimmedPhone;
          metaObj.contacts[idx].title = trimmedTitle;
          metaObj.contacts[idx].position = trimmedPosition;
        } else {
          metaObj.contacts.push({
            id: targetUserId,
            koreanLastName: trimmedKoreanLast,
            koreanFirstName: trimmedKoreanFirst,
            name: computedKoreanName,
            englishName: combinedEnglishName,
            englishFirstName: trimmedFirst,
            englishLastName: trimmedLast,
            firstName: trimmedFirst,
            lastName: trimmedLast,
            phone: trimmedPhone,
            email: session.email,
            title: trimmedTitle,
            position: trimmedPosition,
            isPrimary: true,
            status: "active",
          });
        }
      }

      await adminClient
        .from("companies")
        .update({
          intro: `__COMPANY_METADATA__:${JSON.stringify(metaObj)}`,
          contact_name: computedKoreanName,
          contact_phone: trimmedPhone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetCompanyId);

      revalidatePath(`/admin/companies/${targetCompanyId}`);
    }

    revalidatePath("/portal/account");
    revalidatePath("/portal/company/info");
    revalidatePath("/portal/company/users");
    revalidatePath("/portal");
    revalidatePath("/admin/companies");

    return {
      success: true,
      message: "관리자 프로필 정보가 성공적으로 저장되었습니다.",
      profile: {
        koreanLastName: trimmedKoreanLast,
        koreanFirstName: trimmedKoreanFirst,
        name: verifiedUser.name || computedKoreanName,
        firstName: trimmedFirst,
        lastName: trimmedLast,
        englishName: verifiedEnglishName || combinedEnglishName,
        title: verifiedUser.title || trimmedTitle,
        position: verifiedUser.position || trimmedPosition,
        phone: verifiedUser.phone || trimmedPhone,
      },
    };
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
