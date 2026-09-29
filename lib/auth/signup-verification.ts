"use server";

import crypto from "crypto";
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

  const sanitizedBrn = businessRegistrationNumber.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  if (!sanitizedBrn) {
    return {
      success: false,
      case: "A",
      message: "사업자등록번호를 입력해주세요.",
    };
  }

  const admin = createAdminClient();

  // 1. 전체 회사 목록 조회 (대소문자/공백/대시 무시 매칭 수행)
  const { data: allCompanies, error: companyError } = await admin
    .from("companies")
    .select("id, name, business_registration_number, contact_name");

  if (companyError || !allCompanies) {
    return {
      success: false,
      case: "A",
      message: "회사 정보를 조회하는 중 오류가 발생했습니다.",
    };
  }

  // 2. 입력받은 사업자번호와 DB 사업자번호를 동일하게 위생처리하여 비교
  const matchedCompanies = allCompanies.filter((c) => {
    const dbSanitized = (c.business_registration_number || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
    return dbSanitized === sanitizedBrn;
  });

  if (matchedCompanies.length === 0) {
    return {
      success: false,
      case: "A",
      message: "입점 신청 내역을 찾을 수 없습니다. kselectnetwork.com에서 먼저 신청서를 작성해 주세요.",
    };
  }

  // 3. 일치하는 회사들의 ID 추출
  const companyIds = matchedCompanies.map((c) => c.id);

  // 4. 해당 회사들에 소속된 사용자(신청자 계정) 조회
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

  const matchedCompany = matchedCompanies.find((c) => c.id === matchedUser.company_id)!;
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

/**
 * PORT-ONB-003: Secure Brand Invitation Token Verification Action
 * Verifies raw invitation token from email CTA URL against company_users token hash.
 */
export async function verifyBrandInvitationTokenAction(
  rawToken: string
): Promise<VerificationResult> {
  if (!rawToken || typeof rawToken !== "string" || !rawToken.trim()) {
    return {
      success: false,
      case: "A",
      message: "유효하지 않은 초청 토큰입니다. 이메일 내 초청 버튼을 통해 접속해 주세요.",
    };
  }

  const admin = createAdminClient();
  const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");

  // 1. Query company_users
  const { data: matchedUsers } = await admin
    .from("company_users")
    .select("id, company_id, name, email, status, invited_at, invitation_expires_at, companies(name)");

  let user = (matchedUsers || []).find(
    (u) => (u as any).invitation_token_hash === tokenHash
  );

  // Fallback: If token hash column query didn't match, check if rawToken is user id
  if (!user && rawToken.length >= 32) {
    user = (matchedUsers || []).find((u) => u.id === rawToken.trim());
  }

  if (!user) {
    return {
      success: false,
      case: "A",
      message: "초대 링크가 유효하지 않거나 만료되었습니다. 어드민 관리자에게 재초대를 요청해 주세요.",
    };
  }

  const compName = (user as any)?.companies?.name || "파트너사";

  // Case C: 이미 가입 및 활성화 완료 상태
  if (user.status === "active") {
    return {
      success: false,
      case: "C",
      message: "이미 파트너 포털 가입 및 비밀번호 설정이 완료된 계정입니다. 로그인해 주세요.",
      email: user.email,
    };
  }

  // Case B / Expired link
  if (user.status !== "invited" || !user.invited_at) {
    return {
      success: false,
      case: "A",
      message: "초대 링크가 만료되었거나 취소되었습니다. 어드민 관리자에게 문의해 주세요.",
    };
  }

  if ((user as any).invitation_expires_at) {
    const exp = new Date((user as any).invitation_expires_at);
    if (!isNaN(exp.getTime()) && exp < new Date()) {
      return {
        success: false,
        case: "A",
        message: "초대 링크 유효 기간(7일)이 만료되었습니다. 관리자에게 재초대를 요청해 주세요.",
      };
    }
  }

  return {
    success: true,
    case: "D",
    userId: user.id,
    companyName: compName,
    contactName: user.name || "담당자",
    email: user.email,
  };
}

/**
 * PORT-ONB-003: Token-based Partner Account Password Activation
 */
export async function activatePartnerAccountWithTokenAction(
  rawToken: string,
  password: string
): Promise<{ success: boolean; error?: string; email?: string }> {
  const verifyRes = await verifyBrandInvitationTokenAction(rawToken);

  if (!verifyRes.success || verifyRes.case !== "D") {
    return {
      success: false,
      error: (verifyRes as any).message || "초대 토큰 검증에 실패했습니다.",
    };
  }

  // 비밀번호 안전성 검사
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "올바른 비밀번호 형식이 아닙니다.",
    };
  }

  const userId = verifyRes.userId;
  const admin = createAdminClient();

  // 1. Update or create Auth Account password & confirm email
  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    password: password,
    email_confirm: true,
  });

  if (authError) {
    console.error("[activatePartnerAccountWithTokenAction] auth update error:", authError);
    return { success: false, error: "비밀번호 설정 중 오류가 발생했습니다: " + authError.message };
  }

  // 2. Update company_users status to active and clear token hash
  const { error: dbError } = await admin
    .from("company_users")
    .update({
      status: "active",
      joined_at: new Date().toISOString(),
      invitation_token_hash: null,
      invitation_expires_at: null,
    })
    .eq("id", userId);

  if (dbError) {
    console.error("[activatePartnerAccountWithTokenAction] DB update error:", dbError);
    return { success: false, error: "계정 활성화 처리 실패: " + dbError.message };
  }

  // 3. Update associated applications status to approved
  const { data: userRow } = await admin
    .from("company_users")
    .select("company_id")
    .eq("id", userId)
    .single();

  if (userRow?.company_id) {
    await admin
      .from("applications")
      .update({
        status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", userRow.company_id)
      .eq("status", "invitation_sent");
  }

  return { success: true, email: verifyRes.email };
}
