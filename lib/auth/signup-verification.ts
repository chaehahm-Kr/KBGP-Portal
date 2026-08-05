"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { passwordSchema } from "@/lib/auth/password";

const verificationSchema = z.object({
  businessRegistrationNumber: z
    .string()
    .trim()
    .min(1, "사업자등록번호를 입력해주세요."),
  email: z
    .string()
    .trim()
    .email("올바른 이메일 형식이 아닙니다."),
});

export type VerificationResult =
  | { success: false; case: "A"; message: string } // Not found
  | { success: false; case: "B"; message: string } // Pending approval (invited_at is null)
  | { success: false; case: "C"; message: string; email: string } // Already active
  | { success: true; case: "D"; userId: string; companyName: string; contactName: string; email: string }; // Approved, ready to set password

/**
 * 사업자등록번호와 이메일을 기준으로 파트너십 신청서 및 가입 승인 상태를 검증합니다.
 */
export async function verifyPartnerApplicationAction(
  businessRegistrationNumber: string,
  email: string
): Promise<VerificationResult> {
  const parsed = verificationSchema.safeParse({
    businessRegistrationNumber,
    email,
  });

  if (!parsed.success) {
    return {
      success: false,
      case: "A",
      message: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.",
    };
  }

  const sanitizedBrn = businessRegistrationNumber.replace(/[^0-9]/g, "");

  if (sanitizedBrn.length !== 10) {
    return {
      success: false,
      case: "A",
      message: "사업자등록번호는 숫자 10자리여야 합니다. (대시 없이 숫자만 입력)",
    };
  }

  const admin = createAdminClient();

  // 1. 사업자번호가 일치하는 모든 회사 조회
  const { data: companies, error: companyError } = await admin
    .from("companies")
    .select("id, name, contact_name")
    .eq("business_registration_number", sanitizedBrn);

  if (companyError || !companies || companies.length === 0) {
    return {
      success: false,
      case: "A",
      message: "입점 신청 내역을 찾을 수 없습니다. kselectnetwork.com에서 먼저 신청서를 작성해 주세요.",
    };
  }

  // 2. 일치하는 회사들의 ID 추출
  const companyIds = companies.map((c) => c.id);

  // 3. 해당 회사들에 소속된 사용자(신청자 계정) 조회
  const { data: users, error: userError } = await admin
    .from("company_users")
    .select("id, name, email, status, invited_at, company_role, company_id")
    .in("company_id", companyIds);

  if (userError || !users || users.length === 0) {
    return {
      success: false,
      case: "A",
      message: "해당 회사에 등록된 담당자 계정을 찾을 수 없습니다. 관리자에게 문의해 주세요.",
    };
  }

  // 4. 입력한 이메일과 일치하는 사용자 매칭 (대소문자 구분 없음)
  const matchedUser = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

  if (!matchedUser) {
    return {
      success: false,
      case: "A",
      message: "입력하신 이메일과 일치하는 담당자 계정을 찾을 수 없습니다. 신청 당시 기재한 이메일을 입력해 주세요.",
    };
  }

  const matchedCompany = companies.find((c) => c.id === matchedUser.company_id)!;
  const primaryUser = matchedUser;

  // Case C: 이미 가입 완료 상태인 경우
  if (primaryUser.status === "active") {
    return {
      success: false,
      case: "C",
      message: "이미 포털 가입 및 비밀번호 설정이 완료된 계정입니다. 로그인 화면으로 이동하여 로그인해 주세요.",
      email: primaryUser.email,
    };
  }

  // Case B: 신청서는 존재하나 어드민이 아직 승인(가입 요청 발송)하지 않은 경우
  if (primaryUser.status === "invited" && !primaryUser.invited_at) {
    return {
      success: false,
      case: "B",
      message: "제출해주신 입점 신청서의 검토가 진행 중입니다. 심사 및 가입 요청 승인이 완료되면 기재하신 이메일로 안내 메일이 발송됩니다. 조금만 기다려 주시기 바랍니다.",
    };
  }

  // Case D: 가입 승인 완료되어 비밀번호 설정 가능한 상태
  if (primaryUser.status === "invited" && primaryUser.invited_at) {
    return {
      success: true,
      case: "D",
      userId: primaryUser.id,
      companyName: matchedCompany.name,
      contactName: primaryUser.name || "담당자",
      email: primaryUser.email,
    };
  }

  // 기본 예외 처리
  return {
    success: false,
    case: "A",
    message: "계정 상태를 확인할 수 없습니다. 어드민 관리자에게 문의해 주세요.",
  };
}

/**
 * 가입 승인된 파트너 사용자의 비밀번호 설정을 완료하고 계정을 활성화합니다.
 */
export async function activatePartnerAccountAction(
  userId: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  // 비밀번호 안전성 검사
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "올바른 비밀번호 형식이 아닙니다.",
    };
  }

  const admin = createAdminClient();

  // 1. 해당 사용자가 실제로 초대 및 승인 상태인지 검증
  const { data: user, error: userError } = await admin
    .from("company_users")
    .select("status, invited_at")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    return { success: false, error: "사용자 정보를 확인할 수 없습니다." };
  }

  if (user.status !== "invited" || !user.invited_at) {
    return { success: false, error: "가입 승인 대기 상태의 계정이 아닙니다." };
  }

  // 2. Auth 계정의 비밀번호 설정 및 이메일 자동 확인 처리
  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    password: password,
    email_confirm: true,
  });

  if (authError) {
    console.error("[activatePartnerAccountAction] auth update error:", authError);
    return { success: false, error: "비밀번호 설정 중 오류가 발생했습니다: " + authError.message };
  }

  // 3. DB 내 사용자 상태를 active로 갱신
  const { error: dbError } = await admin
    .from("company_users")
    .update({
      status: "active",
      joined_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (dbError) {
    console.error("[activatePartnerAccountAction] DB update error:", dbError);
    return { success: false, error: "계정 상태 활성화 실패: " + dbError.message };
  }

  return { success: true };
}
