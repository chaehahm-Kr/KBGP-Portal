"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

import { TASK_DEFINITIONS, type TaskCode } from "./task-constants";

export interface TaskAssignmentItem {
  taskCode: TaskCode;
  label: string;
  desc: string;
  isPrimary: boolean;
  emailNotify: boolean;
  userId: string | null;
  userName: string | null;
  userTitle: string | null;
  userPosition: string | null;
  userEmail: string | null;
  userPhone: string | null;
}

/**
 * 1. 특정 회사의 6대 담당 업무 배정 및 알림 수신 상태 조회
 */
export async function getCompanyTaskAssignments(companyId: string): Promise<TaskAssignmentItem[]> {
  const admin = createAdminClient();

  // 회사 전체 배정 정보 조회
  let assignments: any[] = [];
  try {
    const { data, error } = await admin
      .from("company_task_assignments")
      .select("user_id, task_code, is_primary, email_notify")
      .eq("company_id", companyId);
    if (!error && data) {
      assignments = data;
    }
  } catch (e) {
    console.warn("company_task_assignments table not ready yet, falling back to empty list", e);
  }

  // 회사 소속 모든 멤버 목록 조회
  const { data: companyUsers } = await admin
    .from("company_users")
    .select("id, name, title, position, email, phone")
    .eq("company_id", companyId);

  const usersMap = new Map(companyUsers?.map(u => [u.id, u]) || []);

  return TASK_DEFINITIONS.map(def => {
    // 해당 업무의 주 담당자 및 이메일 수신자 조합 매핑
    // 우선 주 담당자(is_primary = true)가 있는지 탐색
    const primaryAssign = assignments?.find(a => a.task_code === def.code && a.is_primary);
    const primaryUser = primaryAssign ? usersMap.get(primaryAssign.user_id) : null;

    // 만약 주 담당자가 지정되어 있다면 그 담당자 기준으로, 없으면 미지정으로 기본 생성
    const targetUserId = primaryAssign?.user_id || null;

    return {
      taskCode: def.code,
      label: def.label,
      desc: def.desc,
      isPrimary: !!primaryAssign,
      emailNotify: primaryAssign ? primaryAssign.email_notify : false,
      userId: targetUserId,
      userName: primaryUser?.name || null,
      userTitle: primaryUser?.title || null,
      userPosition: primaryUser?.position || null,
      userEmail: primaryUser?.email || null,
      userPhone: primaryUser?.phone || null,
    };
  });
}

/**
 * 2. 특정 사용자의 전체 담당 업무(주 담당자 및 이메일 알림) 일괄 업데이트
 */
export async function updateUserTaskAssignments(
  userId: string,
  companyId: string,
  assignments: { task_code: string; is_primary: boolean; email_notify: boolean }[],
  path: "portal" | "admin"
) {
  const admin = createAdminClient();

  // 변경 유저 구하기 (이력 저장용)
  let changerId: string | null = null;
  try {
    if (path === "admin") {
      const sess = await verifyAdminSession();
      changerId = sess.userId;
    } else {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      changerId = user?.id || null;
    }
  } catch (e) {
    // Fallback if session checking fails
  }

  // 트랜잭션 대신 순차 쿼리로 동기화 안전하게 처리
  for (const item of assignments) {
    // 1. 주 담당자로 지정하려는 경우 다른 사람의 주 담당자 해제
    if (item.is_primary) {
      // 해당 회사의 같은 업무를 맡은 기존 주 담당자를 찾아 해제
      await admin
        .from("company_task_assignments")
        .update({ is_primary: false, updated_at: new Date().toISOString(), updated_by: changerId, updated_path: path })
        .eq("company_id", companyId)
        .eq("task_code", item.task_code)
        .eq("is_primary", true)
        .neq("user_id", userId);
    }

    // 2. 본인의 해당 업무 할당 레코드 upsert
    const { error: upsertError } = await admin
      .from("company_task_assignments")
      .upsert({
        company_id: companyId,
        user_id: userId,
        task_code: item.task_code,
        is_primary: item.is_primary,
        email_notify: item.email_notify,
        updated_at: new Date().toISOString(),
        updated_by: changerId,
        updated_path: path
      }, {
        onConflict: "company_id,user_id,task_code"
      });

    if (upsertError) {
      throw new Error(`담당 업무 업데이트 실패: ${upsertError.message}`);
    }

    // 3. 로그 남기기
    await admin.from("company_task_assignment_logs").insert({
      company_id: companyId,
      user_id: userId,
      task_code: item.task_code,
      is_primary: item.is_primary,
      email_notify: item.email_notify,
      changed_at: new Date().toISOString(),
      changed_by: changerId,
      changed_path: path
    });
  }

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/users");
  revalidatePath("/portal/company/info");
  revalidatePath("/portal");
}

/**
 * 3. 회사 상세 정보 페이지에서 특정 업무의 주 담당자를 직접 지정/변경
 */
export async function assignTaskPrimaryUser(
  companyId: string,
  taskCode: string,
  targetUserId: string | null,
  path: "portal" | "admin"
) {
  const admin = createAdminClient();

  // 변경 유저 구하기
  let changerId: string | null = null;
  try {
    if (path === "admin") {
      const sess = await verifyAdminSession();
      changerId = sess.userId;
    } else {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      changerId = user?.id || null;
    }
  } catch (e) {}

  // 1. 기존에 해당 회사의 해당 업무 주 담당자가 있는지 확인하여 해제
  await admin
    .from("company_task_assignments")
    .update({ is_primary: false, updated_at: new Date().toISOString(), updated_by: changerId, updated_path: path })
    .eq("company_id", companyId)
    .eq("task_code", taskCode)
    .eq("is_primary", true);

  if (targetUserId) {
    // 2. 새 주 담당자의 해당 업무 upsert (이메일 알림 기본 체크 보장)
    // 기존에 해당 유저가 이메일 알림을 명시적으로 꺼두었는지 확인
    const { data: existing } = await admin
      .from("company_task_assignments")
      .select("email_notify")
      .eq("company_id", companyId)
      .eq("user_id", targetUserId)
      .eq("task_code", taskCode)
      .maybeSingle();

    const emailNotifyValue = existing ? existing.email_notify : true; // 기존 설정 보존, 없으면 기본값 true

    const { error: upsertError } = await admin
      .from("company_task_assignments")
      .upsert({
        company_id: companyId,
        user_id: targetUserId,
        task_code: taskCode,
        is_primary: true,
        email_notify: emailNotifyValue,
        updated_at: new Date().toISOString(),
        updated_by: changerId,
        updated_path: path
      }, {
        onConflict: "company_id,user_id,task_code"
      });

    if (upsertError) {
      throw new Error(`주 담당자 배정 실패: ${upsertError.message}`);
    }

    // 3. 로그 남기기
    await admin.from("company_task_assignment_logs").insert({
      company_id: companyId,
      user_id: targetUserId,
      task_code: taskCode,
      is_primary: true,
      email_notify: emailNotifyValue,
      changed_at: new Date().toISOString(),
      changed_by: changerId,
      changed_path: path
    });
  }

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/users");
  revalidatePath("/portal/company/info");
  revalidatePath("/portal");
}

/**
 * 4. 회사 단위 담당 업무 설정 진행 상태 조회
 * 리턴 예: { completedCount: 3, totalCount: 6, percent: 50 }
 */
export async function getCompanyTaskSetupStatus(companyId: string) {
  const admin = createAdminClient();

  let completedCount = 0;
  try {
    const { data: assignments, error } = await admin
      .from("company_task_assignments")
      .select("task_code")
      .eq("company_id", companyId)
      .eq("is_primary", true);
    if (!error && assignments) {
      completedCount = assignments.length;
    }
  } catch (e) {
    console.warn("company_task_assignments table not ready yet, returning 0 completed tasks", e);
  }
  const totalCount = TASK_DEFINITIONS.length;

  return {
    completedCount,
    totalCount,
    percent: Math.round((completedCount / totalCount) * 100),
  };
}

/**
 * 5. 유저가 소속에서 배제/비활성화 시 주 담당자 해제 처리 및 할 일 생성
 */
export async function handleUserSuspensionTaskCheck(userId: string, companyId: string) {
  const admin = createAdminClient();

  // 1. 해당 유저가 주 담당자로 있는 업무 목록 가져오기
  const { data: activeAssignments } = await admin
    .from("company_task_assignments")
    .select("task_code")
    .eq("user_id", userId)
    .eq("is_primary", true);

  if (!activeAssignments || activeAssignments.length === 0) return;

  const changerId = null;

  for (const item of activeAssignments) {
    // 주 담당자 해제
    await admin
      .from("company_task_assignments")
      .update({ is_primary: false, updated_at: new Date().toISOString(), updated_path: "portal" })
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .eq("task_code", item.task_code);

    // 이력 로그 기록
    await admin.from("company_task_assignment_logs").insert({
      company_id: companyId,
      user_id: userId,
      task_code: item.task_code,
      is_primary: false,
      email_notify: true,
      changed_at: new Date().toISOString(),
      changed_path: "portal"
    });
  }

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/users");
  revalidatePath("/portal/company/info");
  revalidatePath("/portal");
}
