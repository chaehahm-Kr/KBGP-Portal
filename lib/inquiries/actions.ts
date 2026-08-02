"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env/public";

export type InquiryFormState = { error: string } | undefined;

const convertSchema = z.object({
  country: z.string().trim().min(1, "국가를 입력해주세요."),
});

/**
 * 사용자 요청: "우리가 거래 할 사람들에게만 포털을 제공". inquiries는 그 자체로는
 * 로그인 권한이 없고, 이 액션을 거쳐야만 companies+company_users가 생기고 초대
 * 메일이 나간다 — lib/company/invite-actions.ts의 inviteCompanyUser와 같은 방식
 * (Supabase inviteUserByEmail)을 재사용하되, 여기서는 회사 자체도 함께 만든다.
 *
 * 마케팅 사이트 폼은 country를 받지 않으므로(대상이 사실상 한국 브랜드사라
 * "대한민국" 기본값이 대부분 맞다) 화면에서 기본값을 채워두고 관리자가 필요 시
 * 바로 고칠 수 있게 한다.
 */
export async function convertInquiryToCompany(
  inquiryId: string,
  _prevState: InquiryFormState,
  formData: FormData
): Promise<InquiryFormState> {
  const session = await verifyAdminSession();

  const parsed = convertSchema.safeParse({ country: formData.get("country") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." };
  }

  const admin = createAdminClient();

  const { data: inquiry } = await admin
    .from("inquiries")
    .select("*")
    .eq("id", inquiryId)
    .single();

  if (!inquiry) {
    return { error: "접수 건을 찾을 수 없습니다." };
  }
  if (inquiry.status !== "pending") {
    return { error: "이미 처리된 접수 건입니다." };
  }

  // 초대를 먼저 시도한다 — companies를 먼저 만들면 초대 실패 시(잘못된 이메일,
  // 이미 가입된 계정 등) 아무도 못 쓰는 회사 행만 남는 문제가 있었다(실제로
  // 검증 중 발견). 여기 실패하면 아무것도 만들어지지 않은 채 재시도할 수 있다.
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    inquiry.contact_email,
    {
      data: { role: "portal", display_name: inquiry.contact_name },
      redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/portal/invite/accept`,
    }
  );

  if (inviteError || !invited.user) {
    if (inviteError?.code === "over_email_send_rate_limit") {
      return { error: "이메일 발송 한도를 초과했습니다. 잠시 후 다시 시도해주세요." };
    }
    if (inviteError?.code === "email_exists") {
      return { error: "이미 다른 회사 계정으로 가입된 이메일입니다." };
    }
    return {
      error: `초대에 실패했습니다: ${inviteError?.message ?? "알 수 없는 오류"}`,
    };
  }

  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({
      name: inquiry.company_name,
      business_registration_number: inquiry.business_registration_number,
      country: parsed.data.country,
      contact_name: inquiry.contact_name,
      contact_phone: inquiry.contact_phone,
    })
    .select("id")
    .single();

  if (companyError || !company) {
    // 초대는 이미 나갔는데 회사 저장이 실패했다 — 발급된 계정이 소속 회사
    // 없이 떠 있으면 더 위험하므로(로그인은 되는데 아무 권한도 없는 상태),
    // 초대를 되돌린다.
    await admin.auth.admin.deleteUser(invited.user.id);
    return { error: "회사 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }

  const { error: companyUserError } = await admin.from("company_users").insert({
    id: invited.user.id,
    company_id: company.id,
    name: inquiry.contact_name,
    email: inquiry.contact_email,
    company_role: "company_admin",
    status: "invited",
    invited_by: session.userId,
    invited_at: new Date().toISOString(),
  });

  if (companyUserError) {
    return { error: "계정 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }

  await admin
    .from("inquiries")
    .update({
      status: "converted",
      converted_company_id: company.id,
      reviewed_by: session.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", inquiryId);

  revalidatePath("/admin/inquiries");
  redirect(`/admin/companies/${company.id}`);
}

export async function declineInquiry(
  inquiryId: string,
  _prevState: InquiryFormState,
  formData: FormData
): Promise<InquiryFormState> {
  const session = await verifyAdminSession();
  const reason = String(formData.get("reason") ?? "").trim();

  const admin = createAdminClient();
  const { data: inquiry } = await admin
    .from("inquiries")
    .select("status")
    .eq("id", inquiryId)
    .single();

  if (!inquiry) {
    return { error: "접수 건을 찾을 수 없습니다." };
  }
  if (inquiry.status !== "pending") {
    return { error: "이미 처리된 접수 건입니다." };
  }

  await admin
    .from("inquiries")
    .update({
      status: "declined",
      decline_reason: reason || null,
      reviewed_by: session.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", inquiryId);

  revalidatePath("/admin/inquiries");
  redirect("/admin/inquiries");
}
