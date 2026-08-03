"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin, verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deactivateUserSessions, reactivateUserSessions } from "@/lib/auth/admin-actions";
import { publicEnv } from "@/lib/env/public";
import { STAFF_ROLES, type StaffRole } from "@/lib/staff/types";

export type StaffFormState = { error: string } | undefined;

const inviteSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요."),
  email: z.email({ message: "올바른 이메일 형식이 아닙니다." }),
});

/**
 * 08_주요화면과AC.md "직원 관리 | Super Admin". company invite와 같은 이유로
 * Supabase의 inviteUserByEmail()을 쓴다 — 다만 role 메타데이터를 'admin'으로 보내면
 * handle_new_user() 트리거가 profiles+staff_members를 한 번에 만들어주므로,
 * company_users처럼 별도 status='invited' 단계 없이 초대 즉시 staff_members
 * 행이 active 상태로 생긴다(직원 계정은 "어느 회사에 속하는지" 같은 모호함이 없기 때문).
 */
export async function inviteStaffMember(
  _prevState: StaffFormState,
  formData: FormData
): Promise<StaffFormState> {
  await requireSuperAdmin();

  const parsed = inviteSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." };
  }

  const admin = createAdminClient();
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: { role: "admin", display_name: parsed.data.name },
      redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/admin/invite/accept`,
    }
  );

  if (inviteError) {
    if (inviteError.code === "over_email_send_rate_limit") {
      return {
        error:
          "이메일 발송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
      };
    }
    return { error: "이미 등록된 이메일이거나 초대에 실패했습니다." };
  }

  revalidatePath("/admin/staff");
}

/**
 * "역할 부여/회수 즉시 반영" AC — 체크된 역할 전체로 그대로 교체한다(추가/삭제
 * diff를 계산하지 않고 delete-then-insert가 더 단순하고, 이 규모(직원 몇 명)에서는
 * 성능 차이가 없다). 마지막 super_admin의 super_admin 역할은 회수할 수 없게 막는다
 * — 그렇지 않으면 아무도 이 화면에 접근할 수 없는 상태가 될 수 있다.
 */
export async function setStaffRoles(
  staffId: string,
  _prevState: StaffFormState,
  formData: FormData
): Promise<StaffFormState> {
  await requireSuperAdmin();

  const selectedRoles = formData
    .getAll("roles")
    .map(String)
    .filter((r): r is StaffRole => (STAFF_ROLES as readonly string[]).includes(r));

  const admin = createAdminClient();

  if (!selectedRoles.includes("super_admin")) {
    const { count } = await admin
      .from("staff_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin");

    const { data: existingRoles } = await admin
      .from("staff_roles")
      .select("role")
      .eq("staff_id", staffId);
    const wasSuperAdmin = (existingRoles ?? []).some((r) => r.role === "super_admin");

    if (wasSuperAdmin && (count ?? 0) <= 1) {
      return {
        error: "마지막 남은 Super Admin의 권한은 회수할 수 없습니다. 다른 사람을 먼저 Super Admin으로 지정해주세요.",
      };
    }
  }

  await admin.from("staff_roles").delete().eq("staff_id", staffId);

  if (selectedRoles.length > 0) {
    await admin.from("staff_roles").insert(
      selectedRoles.map((role) => ({ staff_id: staffId, role }))
    );
  }

  revalidatePath("/admin/staff");
}

/** 10_보안과권한요구사항.md 3번: 비활성화 즉시 로그인 차단. 본인 계정은 막는다. */
export async function suspendStaffMember(staffId: string) {
  const session = await requireSuperAdmin();

  if (staffId === session.userId) {
    throw new Error("본인 계정은 이 화면에서 비활성화할 수 없습니다.");
  }

  const admin = createAdminClient();
  await admin.from("staff_members").update({ status: "suspended" }).eq("id", staffId);
  await deactivateUserSessions(staffId);

  revalidatePath("/admin/staff");
}

export async function reactivateStaffMember(staffId: string) {
  await requireSuperAdmin();

  const admin = createAdminClient();
  await admin.from("staff_members").update({ status: "active" }).eq("id", staffId);
  await reactivateUserSessions(staffId);

  revalidatePath("/admin/staff");
}

/** app/admin/invite/accept/page.tsx에서 비밀번호 설정 직후 호출한다. */
export async function completeStaffInviteAcceptance() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  redirect("/admin");
}

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
  revalidatePath("/admin");
  revalidatePath("/admin/staff");
}
