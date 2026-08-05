"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireSuperAdmin, verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ROLE_PERMISSIONS, type StaffRole, type StaffStatus, type StaffMenuPermissions } from "./types";
import { renderEmailHtml } from "@/lib/notifications/templates";
import { sendEmail } from "@/lib/notifications/email";

// Helper: Log staff change histories
async function logAudit({
  actorId,
  targetId,
  actionType,
  oldValues = null,
  newValues = null,
  reason = "",
}: {
  actorId: string;
  targetId: string;
  actionType: string;
  oldValues?: any;
  newValues?: any;
  reason?: string;
}) {
  const admin = createAdminClient();
  const headerList = await headers();
  const ipAddress = headerList.get("x-forwarded-for")?.split(",")[0] || headerList.get("x-real-ip") || "127.0.0.1";

  await admin.from("staff_audit_logs").insert({
    actor_id: actorId,
    target_id: targetId,
    action_type: actionType,
    old_values: oldValues,
    new_values: newValues,
    ip_address: ipAddress,
    reason,
  });
}

// Zod schemas for validation
const inviteSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요."),
  email: z.string().trim().email("올바른 이메일 형식이 아닙니다."),
  departmentId: z.string().uuid("부서를 선택해주세요."),
  jobTitleId: z.string().uuid("직책을 선택해주세요."),
  baseRole: z.string().min(1, "기본 역할을 지정해주세요."),
  customMessage: z.string().optional(),
});

/**
 * Super Admin이 직원 이메일 및 정보를 기반으로 임시 비밀번호를 발급하여 초대합니다.
 */
export async function inviteStaffMemberAction(
  _prevState: any,
  formData: FormData
) {
  const session = await requireSuperAdmin();

  const parsed = inviteSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    departmentId: formData.get("departmentId"),
    jobTitleId: formData.get("jobTitleId"),
    baseRole: formData.get("baseRole"),
    customMessage: formData.get("customMessage"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." };
  }

  const { name, email, departmentId, jobTitleId, baseRole, customMessage } = parsed.data;

  // 1. Generate secure temporary password
  const tempPassword = "Temp" + Math.random().toString(36).substring(2, 10) + "!";

  const admin = createAdminClient();

  // Check if staff member already exists in DB
  const { data: existingStaff } = await admin
    .from("staff_members")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingStaff) {
    return { error: "이미 등록되어 있는 이메일 주소입니다." };
  }

  // 2. Create Auth User in Supabase with auto email confirmation
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      role: "admin",
      display_name: name,
      base_role: baseRole,
      department_id: departmentId,
      job_title_id: jobTitleId,
    },
  });

  if (authError || !authData.user) {
    return { error: authError?.message || "직원 계정을 생성하지 못했습니다." };
  }

  const newUserId = authData.user.id;

  // 3. Assign base role default permissions in DB
  const defaultPerms = DEFAULT_ROLE_PERMISSIONS[baseRole as StaffRole] || DEFAULT_ROLE_PERMISSIONS["reviewer"];
  await admin
    .from("staff_members")
    .update({
      menu_permissions: defaultPerms,
    })
    .eq("id", newUserId);

  // Bind base role legacy data structure if needed
  await admin
    .from("staff_roles")
    .insert({ staff_id: newUserId, role: baseRole });

  // 4. Send email using Resend and templates helper
  const { subject, html } = renderEmailHtml(
    "[K SELECT NETWORK] {{contactName}}님, 관리자 포털로 초대합니다",
    "안녕하세요, {{contactName}}님.\n\nK SELECT NETWORK 관리자 포털의 내부 직원으로 초대되었습니다.\n\n아래 로그인 정보와 임시 비밀번호로 최초 로그인하신 후, 비밀번호 변경 및 계정 설정 절차를 완료해 주세요.\n\n- 접속 이메일: {{email}}\n- 임시 비밀번호: {{tempPassword}}\n\n* 본 임시 비밀번호는 최초 1회 로그인 전용입니다.\n\n{{ctaButton}}",
    {
      contactName: name,
      email,
      tempPassword,
      key: "staff_invited",
    }
  );

  try {
    await sendEmail({
      to: email,
      subject,
      html,
      text: "K SELECT NETWORK 관리자 포털 초대 메일입니다.",
    });
  } catch (e) {
    console.error("Failed to send invitation email:", e);
  }

  // 5. Log audit
  await logAudit({
    actorId: session.userId,
    targetId: newUserId,
    actionType: "invite",
    newValues: {
      name,
      email,
      baseRole,
      departmentId,
      jobTitleId,
    },
    reason: customMessage || "신규 직원 초대 발송",
  });

  revalidatePath("/admin/staff");
  return { success: "직원 초대 발송 완료. 임시 비밀번호: " + tempPassword };
}

// Zod schema for profile setup
const setupProfileSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요."),
  englishName: z.string().trim().min(1, "영문 이름을 입력해주세요."),
  nickname: z.string().trim().min(1, "닉네임을 입력해주세요."),
  phone: z.string().trim().min(1, "연락처를 입력해주세요."),
  region: z.string().trim().min(1, "근무 지역을 입력해주세요."),
  timezone: z.string().trim().min(1, "시간대를 선택해주세요."),
  language: z.string().trim().min(1, "선호 언어를 선택해주세요."),
  birthday: z.string().trim().optional().nullable(),
});

/**
 * 최초 로그인한 직원이 비밀번호를 변경하고 기본 인적 사항 등록을 마치는 액션
 */
export async function setupProfileCompleteAction(
  _prevState: any,
  formData: FormData
) {
  // Use createClient inside server action to verify session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증 세션이 만료되었습니다. 다시 로그인해주세요." };
  }

  const parsed = setupProfileSchema.safeParse({
    name: formData.get("name"),
    englishName: formData.get("englishName"),
    nickname: formData.get("nickname"),
    phone: formData.get("phone"),
    region: formData.get("region"),
    timezone: formData.get("timezone"),
    language: formData.get("language"),
    birthday: formData.get("birthday"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력 필드를 확인해 주세요." };
  }

  const admin = createAdminClient();

  // Retrieve current status
  const { data: currentStaff } = await admin
    .from("staff_members")
    .select("status")
    .eq("id", user.id)
    .single();

  if (!currentStaff || !["invited", "setting_up"].includes(currentStaff.status)) {
    return { error: "이미 설정을 완료한 계정이거나 접근 권한이 없습니다." };
  }

  // Update staff members basic info and upgrade status to active
  const { error: updateError } = await admin
    .from("staff_members")
    .update({
      name: parsed.data.name,
      english_name: parsed.data.englishName,
      nickname: parsed.data.nickname,
      phone: parsed.data.phone,
      region: parsed.data.region,
      timezone: parsed.data.timezone,
      language: parsed.data.language,
      birthday: parsed.data.birthday || null,
      status: "active",
      must_change_password: false,
    })
    .eq("id", user.id);

  if (updateError) {
    return { error: "프로필 정보 저장에 실패했습니다. 다시 시도해 주세요." };
  }

  // Update profile display_name in profiles table
  await admin
    .from("profiles")
    .update({ display_name: parsed.data.name })
    .eq("id", user.id);

  // Log Audit
  await logAudit({
    actorId: user.id,
    targetId: user.id,
    actionType: "setup_complete",
    newValues: { ...parsed.data, status: "active" },
    reason: "최초 로그인 프로필 및 계정 활성화 완료",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/staff");
  return { success: "설정이 정상적으로 완료되었습니다." };
}

/**
 * Super Admin이 특정 직원의 권한 및 역할 설정을 재설정합니다.
 */
export async function updateStaffPermissionsAction(
  targetId: string,
  baseRole: StaffRole,
  menuPermissions: StaffMenuPermissions,
  reason: string
) {
  const session = await requireSuperAdmin();
  const admin = createAdminClient();

  // Fetch current old values
  const { data: oldData } = await admin
    .from("staff_members")
    .select("base_role, menu_permissions")
    .eq("id", targetId)
    .single();

  // Save new values
  const { error } = await admin
    .from("staff_members")
    .update({
      base_role: baseRole,
      menu_permissions: menuPermissions,
    })
    .eq("id", targetId);

  if (error) {
    throw new Error("권한 변경 실패: " + error.message);
  }

  // Legacy roles updates (staff_roles table cleanup and sync)
  await admin.from("staff_roles").delete().eq("staff_id", targetId);
  await admin.from("staff_roles").insert({ staff_id: targetId, role: baseRole });

  // Log audit
  await logAudit({
    actorId: session.userId,
    targetId,
    actionType: "update_permissions",
    oldValues: oldData,
    newValues: { baseRole, menuPermissions },
    reason,
  });

  revalidatePath("/admin/staff");
}

/**
 * Super Admin이 특정 직원의 조직 정보(부서, 직책, 직속 관리자, 입사일 등)를 업데이트합니다.
 */
export async function updateStaffOrgInfoAction(
  targetId: string,
  orgData: {
    departmentId: string | null;
    jobTitleId: string | null;
    managerId: string | null;
    hireDate: string | null;
  },
  reason: string
) {
  const session = await requireSuperAdmin();
  const admin = createAdminClient();

  const { data: oldData } = await admin
    .from("staff_members")
    .select("department_id, job_title_id, manager_id, hire_date")
    .eq("id", targetId)
    .single();

  const { error } = await admin
    .from("staff_members")
    .update({
      department_id: orgData.departmentId || null,
      job_title_id: orgData.jobTitleId || null,
      manager_id: orgData.managerId || null,
      hire_date: orgData.hireDate || null,
    })
    .eq("id", targetId);

  if (error) {
    throw new Error("조직 정보 업데이트 실패: " + error.message);
  }

  await logAudit({
    actorId: session.userId,
    targetId,
    actionType: "update_org_info",
    oldValues: oldData,
    newValues: orgData,
    reason,
  });

  revalidatePath("/admin/staff");
}

/**
 * Super Admin이 특정 직원의 기본 인적정보(이름, 연락처, 선호언어 등)를 대신 수정합니다.
 */
export async function updateStaffBasicInfoAction(
  targetId: string,
  basicData: {
    name: string;
    englishName: string;
    nickname: string;
    phone: string;
    region: string;
    timezone: string;
    language: string;
    birthday: string | null;
  },
  reason: string
) {
  const session = await requireSuperAdmin();
  const admin = createAdminClient();

  const { data: oldData } = await admin
    .from("staff_members")
    .select("name, english_name, nickname, phone, region, timezone, language, birthday")
    .eq("id", targetId)
    .single();

  const { error } = await admin
    .from("staff_members")
    .update({
      name: basicData.name,
      english_name: basicData.englishName,
      nickname: basicData.nickname,
      phone: basicData.phone,
      region: basicData.region,
      timezone: basicData.timezone,
      language: basicData.language,
      birthday: basicData.birthday || null,
    })
    .eq("id", targetId);

  if (error) {
    throw new Error("인적 정보 수정 실패: " + error.message);
  }

  await admin
    .from("profiles")
    .update({ display_name: basicData.name })
    .eq("id", targetId);

  await logAudit({
    actorId: session.userId,
    targetId,
    actionType: "update_basic_info",
    oldValues: oldData,
    newValues: basicData,
    reason,
  });

  revalidatePath("/admin/staff");
}

/**
 * 직원 상태를 토글합니다 (비활성화, 재활성화, 퇴사(퇴사 처리는 비활성화로 간주))
 */
export async function updateStaffStatusAction(
  targetId: string,
  newStatus: StaffStatus,
  reason: string
) {
  const session = await requireSuperAdmin();

  if (targetId === session.userId) {
    throw new Error("본인 계정의 상태는 직접 비활성화하거나 수정할 수 없습니다.");
  }

  const admin = createAdminClient();
  const { data: oldData } = await admin
    .from("staff_members")
    .select("status")
    .eq("id", targetId)
    .single();

  const { error } = await admin
    .from("staff_members")
    .update({ status: newStatus })
    .eq("id", targetId);

  if (error) {
    throw new Error("계정 상태 변경 실패: " + error.message);
  }

  // If status is suspended or locked, force logout sessions
  const { deactivateUserSessions, reactivateUserSessions } = await import("@/lib/auth/admin-actions");
  if (newStatus === "suspended" || newStatus === "locked") {
    await deactivateUserSessions(targetId);
  } else if (newStatus === "active") {
    await reactivateUserSessions(targetId);
  }

  await logAudit({
    actorId: session.userId,
    targetId,
    actionType: "status_change",
    oldValues: oldData,
    newValues: { status: newStatus },
    reason,
  });

  revalidatePath("/admin/staff");
}

/**
 * Super Admin이 특정 직원의 비밀번호를 임시 비밀번호로 강제 재설정합니다.
 */
export async function resetStaffPasswordAction(targetId: string, reason: string) {
  const session = await requireSuperAdmin();
  const admin = createAdminClient();

  const { data: staff } = await admin
    .from("staff_members")
    .select("name, email")
    .eq("id", targetId)
    .single();

  if (!staff) {
    throw new Error("직원 정보를 찾을 수 없습니다.");
  }

  // 1. Generate temp password
  const tempPassword = "Reset" + Math.random().toString(36).substring(2, 10) + "!";

  // 2. Force auth password reset
  const { error: authError } = await admin.auth.admin.updateUserById(targetId, {
    password: tempPassword,
  });

  if (authError) {
    throw new Error("비밀번호 재설정 실패: " + authError.message);
  }

  // 3. Mark in DB that they must reset it on login
  await admin
    .from("staff_members")
    .update({
      must_change_password: true,
      status: "setting_up", // Force them to profile setup page
    })
    .eq("id", targetId);

  // Send notification email
  const { subject, html } = renderEmailHtml(
    "[K SELECT NETWORK] 귀하의 관리자 비밀번호가 초기화되었습니다",
    "안녕하세요, {{contactName}}님.\n\n요청에 의해 귀하의 K SELECT NETWORK 관리자 계정 비밀번호가 임시 비밀번호로 재설정되었습니다.\n\n아래 로그인 정보와 임시 비밀번호로 다시 로그인하신 후, 반드시 새 비밀번호로 교체해 주시기 바랍니다.\n\n- 접속 이메일: {{email}}\n- 임시 비밀번호: {{tempPassword}}\n\n* 로그인 후 첫 화면에서 비밀번호 및 계정 설정 절차가 강제 진행됩니다.\n\n{{ctaButton}}",
    {
      contactName: staff.name,
      email: staff.email,
      tempPassword,
      key: "staff_invited",
    }
  );

  try {
    await sendEmail({
      to: staff.email,
      subject,
      html,
      text: "K SELECT NETWORK 관리자 비밀번호 초기화 안내 메일입니다.",
    });
  } catch (e) {
    console.error("Failed to send reset email:", e);
  }

  // Log audit
  await logAudit({
    actorId: session.userId,
    targetId,
    actionType: "password_reset",
    newValues: { must_change_password: true, status: "setting_up" },
    reason,
  });

  revalidatePath("/admin/staff");
  return "초기화 성공. 임시 비밀번호: " + tempPassword;
}

/**
 * 초대 대기 중이거나 만료 전인 직원의 초대 이메일을 재생성하여 다시 보냅니다.
 */
export async function reinviteStaffAction(targetId: string) {
  const session = await requireSuperAdmin();
  const admin = createAdminClient();

  const { data: staff } = await admin
    .from("staff_members")
    .select("name, email, base_role")
    .eq("id", targetId)
    .single();

  if (!staff) {
    throw new Error("직원을 찾을 수 없습니다.");
  }

  const tempPassword = "Temp" + Math.random().toString(36).substring(2, 10) + "!";

  // Reset auth user to the new temporary password
  const { error: authError } = await admin.auth.admin.updateUserById(targetId, {
    password: tempPassword,
  });

  if (authError) {
    throw new Error("초대 재발송 처리 실패: " + authError.message);
  }

  await admin
    .from("staff_members")
    .update({ status: "invited", must_change_password: true })
    .eq("id", targetId);

  const { subject, html } = renderEmailHtml(
    "[초대 재발송] [K SELECT NETWORK] {{contactName}}님, 관리자 포털로 초대합니다",
    "안녕하세요, {{contactName}}님.\n\nK SELECT NETWORK 관리자 포털의 내부 직원으로 다시 초대되었습니다.\n\n아래 로그인 정보와 임시 비밀번호로 최초 로그인하신 후, 비밀번호 변경 및 계정 설정 절차를 완료해 주세요.\n\n- 접속 이메일: {{email}}\n- 임시 비밀번호: {{tempPassword}}\n\n* 본 임시 비밀번호는 최초 1회 로그인 전용입니다.\n\n{{ctaButton}}",
    {
      contactName: staff.name,
      email: staff.email,
      tempPassword,
      key: "staff_invited",
    }
  );

  try {
    await sendEmail({
      to: staff.email,
      subject,
      html,
      text: "K SELECT NETWORK 관리자 포털 초대 재발송 메일입니다.",
    });
  } catch (e) {
    console.error("Failed to resend invitation email:", e);
  }

  await logAudit({
    actorId: session.userId,
    targetId,
    actionType: "reinvite",
    reason: "초대장 이메일 재전송",
  });

  revalidatePath("/admin/staff");
}

/**
 * 부서 추가 액션
 */
export async function addDepartmentAction(name: string) {
  const session = await requireSuperAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("부서명을 입력해 주세요.");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("departments")
    .insert({ name: trimmed })
    .select()
    .single();

  if (error) {
    throw new Error("부서 추가 실패 (중복되었을 수 있습니다): " + error.message);
  }

  await logAudit({
    actorId: session.userId,
    targetId: session.userId,
    actionType: "create_department",
    newValues: { name: trimmed },
    reason: `신규 부서 추가: ${trimmed}`,
  });

  revalidatePath("/admin/staff");
  return data;
}

/**
 * 부서 활성화/비활성화 토글 액션
 */
export async function toggleDepartmentAction(id: string, active: boolean) {
  const session = await requireSuperAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("departments")
    .update({ is_active: active })
    .eq("id", id);

  if (error) {
    throw new Error("부서 상태 조절 실패: " + error.message);
  }

  await logAudit({
    actorId: session.userId,
    targetId: session.userId,
    actionType: "toggle_department",
    newValues: { department_id: id, is_active: active },
    reason: `부서 활성화 여부 변경: ${active ? '활성' : '비활성'}`,
  });

  revalidatePath("/admin/staff");
}

/**
 * 직책 추가 액션
 */
export async function addJobTitleAction(name: string) {
  const session = await requireSuperAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("직책명을 입력해 주세요.");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("job_titles")
    .insert({ name: trimmed })
    .select()
    .single();

  if (error) {
    throw new Error("직책 추가 실패 (중복되었을 수 있습니다): " + error.message);
  }

  await logAudit({
    actorId: session.userId,
    targetId: session.userId,
    actionType: "create_job_title",
    newValues: { name: trimmed },
    reason: `신규 직책 추가: ${trimmed}`,
  });

  revalidatePath("/admin/staff");
  return data;
}

/**
 * 직책 활성화/비활성화 토글 액션
 */
export async function toggleJobTitleAction(id: string, active: boolean) {
  const session = await requireSuperAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("job_titles")
    .update({ is_active: active })
    .eq("id", id);

  if (error) {
    throw new Error("직책 상태 조절 실패: " + error.message);
  }

  await logAudit({
    actorId: session.userId,
    targetId: session.userId,
    actionType: "toggle_job_title",
    newValues: { job_title_id: id, is_active: active },
    reason: `직책 활성화 여부 변경: ${active ? '활성' : '비활성'}`,
  });

  revalidatePath("/admin/staff");
}

/**
 * app/admin/invite/accept/page.tsx에서 비밀번호 설정 직후 호출하여 세션을 완료하고 대시보드로 이동시킵니다.
 */
export async function completeStaffInviteAcceptance() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/admin/login");
  }

  const { redirect } = await import("next/navigation");
  redirect("/admin");
}

/**
 * 어드민 헤더 내 프로필 정보 관리창에서 자신의 닉네임/한글 이름을 즉시 수정할 수 있도록 제공합니다.
 */
export async function updateMyName(name: string) {
  const { userId } = await verifyAdminSession();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("이름을 입력해주세요.");
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("staff_members")
    .update({ name: trimmed })
    .eq("id", userId);
  
  if (error) {
    throw new Error("이름 변경에 실패했습니다: " + error.message);
  }

  await admin
    .from("profiles")
    .update({ display_name: trimmed })
    .eq("id", userId);
  
  revalidatePath("/admin");
  revalidatePath("/admin/staff");
}

/**
 * 어드민 헤더 내 프로필 정보 관리창에서 자신의 전체 프로필을 직접 수정합니다.
 */
export async function updateMyProfile(data: {
  name: string;
  englishName: string;
  nickname: string;
  phone: string;
  region: string;
  timezone: string;
  language: string;
  birthday: string | null;
}) {
  const { userId } = await verifyAdminSession();
  
  const nameTrimmed = data.name.trim();
  if (!nameTrimmed) {
    throw new Error("이름을 입력해주세요.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("staff_members")
    .update({
      name: nameTrimmed,
      english_name: data.englishName.trim(),
      nickname: data.nickname.trim(),
      phone: data.phone.trim(),
      region: data.region.trim(),
      timezone: data.timezone,
      language: data.language,
      birthday: data.birthday || null,
    })
    .eq("id", userId);

  if (error) {
    throw new Error("프로필 변경에 실패했습니다: " + error.message);
  }

  await admin
    .from("profiles")
    .update({ display_name: nameTrimmed })
    .eq("id", userId);

  revalidatePath("/admin");
  revalidatePath("/admin/staff");
}
