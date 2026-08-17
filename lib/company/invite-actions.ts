"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deactivateUserSessions } from "@/lib/auth/admin-actions";
import { publicEnv } from "@/lib/env/public";
import { requireCompanyAdmin } from "@/lib/company/dal";
import { normalizeEmail, checkUserEmailDuplicate } from "@/lib/user/validation";
import { getBilingualError } from "@/lib/errors/bilingual-messages";

export type InviteFormState = { error: string } | undefined;

const inviteSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요."),
  email: z.email({ message: "올바른 이메일 형식이 아닙니다." }),
  companyRole: z.enum(["company_admin", "company_staff"] as const),
});

/**
 * 08_주요화면과AC.md "소속 사용자 관리" — 초대 발송.
 * 별도의 초대 토큰 테이블을 만드는 대신 Supabase의 admin.inviteUserByEmail()을 쓴다 —
 * auth.users 계정 생성과 초대 메일 발송을 한 번에 처리해주고, 초대 링크의 보안(만료,
 * 1회성)도 Supabase Auth가 담당하므로 우리가 따로 토큰을 관리하지 않아도 된다.
 */
export async function inviteCompanyUser(
  _prevState: InviteFormState,
  formData: FormData
): Promise<InviteFormState> {
  const { companyId, userId } = await requireCompanyAdmin();

  const parsed = inviteSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    companyRole: formData.get("companyRole"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? getBilingualError("REQUIRED_FIELD") };
  }

  const { name, email, companyRole } = parsed.data;
  const normalizedEmail = normalizeEmail(email);

  // 1. System-wide Email Duplicate Validation (One Email = One User = One Company)
  const dupCheck = await checkUserEmailDuplicate(normalizedEmail, companyId);
  if (dupCheck.status !== "AVAILABLE") {
    return { error: dupCheck.message };
  }

  const admin = createAdminClient();

  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
      data: { role: "portal", display_name: name },
      redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/portal/invite/accept`,
    });

  if (inviteError || !invited.user) {
    if (inviteError?.code === "over_email_send_rate_limit") {
      return {
        error:
          "이메일 발송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.\nRate limit exceeded. Please try again later.",
      };
    }
    if (inviteError?.message?.includes("already been registered")) {
      return { error: getBilingualError("EMAIL_ALREADY_IN_OTHER_COMPANY") };
    }
    return { error: getBilingualError("INVITATION_FAILED") };
  }

  const { error: companyUserError } = await admin.from("company_users").insert({
    id: invited.user.id,
    company_id: companyId,
    name,
    email: normalizedEmail,
    company_role: companyRole,
    status: "invited",
    invited_by: userId,
    invited_at: new Date().toISOString(),
  });

  if (companyUserError) {
    // Rollback auth user to prevent Orphan records
    try {
      await admin.auth.admin.deleteUser(invited.user.id);
    } catch (rbErr) {
      console.error("Auth rollback error:", rbErr);
    }
    return { error: getBilingualError("SAVE_FAILED") };
  }

  revalidatePath("/portal/company/users");
}

/** 초대 링크가 만료된 뒤(7일) 관리자가 다시 초대 메일을 보낸다. */
export async function reinviteCompanyUser(targetUserId: string) {
  const { companyId } = await requireCompanyAdmin();
  const admin = createAdminClient();

  const { data: target } = await admin
    .from("company_users")
    .select("email, name, company_id, status")
    .eq("id", targetUserId)
    .single();

  if (!target || target.company_id !== companyId || target.status !== "invited") {
    return;
  }

  await admin.auth.admin.inviteUserByEmail(target.email, {
    data: { role: "portal", display_name: target.name },
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/portal/invite/accept`,
  });

  await admin
    .from("company_users")
    .update({ invited_at: new Date().toISOString(), expiry_notified_at: null })
    .eq("id", targetUserId);

  revalidatePath("/portal/company/users");
}

/** 초청 대기중(invited) 상태인 사용자의 초청을 취소한다. */
export async function cancelCompanyUserInvite(targetUserId: string) {
  const { companyId } = await requireCompanyAdmin();
  const admin = createAdminClient();

  const { data: target } = await admin
    .from("company_users")
    .select("id, email, company_id, status")
    .eq("id", targetUserId)
    .single();

  if (!target || target.company_id !== companyId) {
    return { error: getBilingualError("PERMISSION_DENIED") };
  }

  // 가입 완료된 활성 사용자는 초청 취소 대상이 아님
  if (target.status !== "invited") {
    return { error: "아직 가입 대기 중인 초청 사용자만 초청을 취소할 수 있습니다.\nOnly pending invited users can have their invitation cancelled." };
  }

  // 1. Delete company_users record
  const { error: deleteErr } = await admin
    .from("company_users")
    .delete()
    .eq("id", targetUserId);

  if (deleteErr) {
    console.error("Cancel invite error:", deleteErr);
    return { error: getBilingualError("SAVE_FAILED") };
  }

  // 2. Delete pending Auth User
  try {
    await admin.auth.admin.deleteUser(targetUserId);
  } catch (authErr) {
    console.error("Auth user delete error during invite cancel:", authErr);
  }

  revalidatePath("/portal/company/users");
  return { success: true };
}

/**
 * 08_주요화면과AC.md 예외: "Company Admin이 자기 자신의 Admin 권한을 스스로
 * 회수하려 할 때, 회사에 남은 Admin이 자신뿐이면 차단(회사가 관리자 없는 상태가
 * 되는 것을 방지)". 제거도 사실상 같은 위험이 있으므로 동일하게 막는다.
 *
 * 즉시 세션 무효화(10_보안과권한요구사항.md 3번)는 lib/auth/admin-actions.ts를 그대로 재사용한다.
 */
export async function removeCompanyUser(targetUserId: string) {
  const { companyId, userId } = await requireCompanyAdmin();
  const admin = createAdminClient();

  const { data: target } = await admin
    .from("company_users")
    .select("company_id, company_role, status")
    .eq("id", targetUserId)
    .single();

  if (!target || target.company_id !== companyId) {
    return;
  }

  if (target.company_role === "company_admin") {
    const { count } = await admin
      .from("company_users")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("company_role", "company_admin")
      .eq("status", "active");

    if ((count ?? 0) <= 1) {
      throw new Error(
        "회사에 남은 관리자가 자신뿐이라 제거할 수 없습니다. 다른 사람을 관리자로 지정한 뒤 다시 시도해주세요."
      );
    }
  }

  await admin
    .from("company_users")
    .update({ status: "suspended" })
    .eq("id", targetUserId);

  if (targetUserId !== userId) {
    await deactivateUserSessions(targetUserId);
  }

  revalidatePath("/portal/company/users");
  revalidatePath("/portal/company/info");
}

/**
 * 소속 사용자 정보, 역할, 활성 상태, 주 컨택 여부 및 메뉴별 ACL 권한 수정
 */
export async function updateCompanyUser(
  targetUserId: string,
  payload: {
    name: string;
    title: string;
    position: string;
    phone: string;
    companyRole: "company_admin" | "company_staff";
    status: "active" | "suspended" | "invited";
    isPrimary: boolean;
    permissions: Record<string, any>;
  }
) {
  const { companyId, userId } = await requireCompanyAdmin();
  const admin = createAdminClient();

  // 1. 대상 사용자 조회 및 유효성 검증
  const { data: target } = await admin
    .from("company_users")
    .select("company_id, company_role, status")
    .eq("id", targetUserId)
    .single();

  if (!target || target.company_id !== companyId) {
    throw new Error("해당 사용자를 찾을 수 없거나 권한이 없습니다.");
  }

  // 2. 마지막 관리자 셀프 다운그레이드/비활성화 방지
  const targetIsSelf = targetUserId === userId;
  const isDowngradingOrDeactivating =
    (payload.companyRole === "company_staff" && target.company_role === "company_admin") ||
    (payload.status === "suspended" && target.status === "active");

  if (targetIsSelf && isDowngradingOrDeactivating) {
    const { count } = await admin
      .from("company_users")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("company_role", "company_admin")
      .eq("status", "active");

    if ((count ?? 0) <= 1) {
      throw new Error(
        "회사에 남은 관리자가 자신뿐이라 권한을 내리거나 비활성화할 수 없습니다. 다른 사람을 관리자로 지정한 뒤 다시 시도해주세요."
      );
    }
  }

  // 3. 주 컨택(대표 담당자) 설정 처리 (true인 경우 해당 회사의 다른 사용자의 is_primary를 해제)
  if (payload.isPrimary) {
    await admin
      .from("company_users")
      .update({ is_primary: false })
      .eq("company_id", companyId);
  }

  // 4. 레코드 업데이트
  const { error: updateError } = await admin
    .from("company_users")
    .update({
      name: payload.name.trim(),
      title: payload.title.trim() || null,
      position: payload.position.trim() || null,
      phone: payload.phone.trim() || null,
      company_role: payload.companyRole,
      status: payload.status,
      is_primary: payload.isPrimary,
      permissions: payload.permissions,
    })
    .eq("id", targetUserId);

  if (updateError) {
    if (updateError.message.includes("column") || updateError.code === "P0002") {
      throw new Error("데이터베이스 컬럼이 누락되었습니다. supabase/migrations/0017 마이그레이션을 데이터베이스에 먼저 적용해 주세요.");
    }
    throw new Error(`사용자 정보 업데이트 실패: ${updateError.message}`);
  }

  // 5. 비활성화 또는 역할 변경 시 세션 무효화
  const roleChanged = target.company_role !== payload.companyRole;
  const deactivated = payload.status === "suspended" && target.status !== "suspended";
  if (!targetIsSelf && (deactivated || roleChanged)) {
    await deactivateUserSessions(targetUserId);
  }
  if (deactivated) {
    const { handleUserSuspensionTaskCheck } = await import("./task-actions");
    await handleUserSuspensionTaskCheck(targetUserId, target.company_id);
  }

  revalidatePath("/portal/company/users");
  revalidatePath("/portal/company/info");
}

/**
 * 초대 이메일의 링크를 클릭해 비밀번호까지 설정한 뒤 호출된다.
 * company_users.status를 invited -> active로 전환한다. 일반 인증 사용자는 이 컬럼을
 * 직접 update할 RLS 권한이 없으므로(0002 마이그레이션 참고) admin 클라이언트로 처리한다.
 */
export async function completeInviteAcceptance() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/portal/login");
  }

  const admin = createAdminClient();
  await admin
    .from("company_users")
    .update({ status: "active", joined_at: new Date().toISOString() })
    .eq("id", user.id)
    .eq("status", "invited");

  redirect("/portal");
}

