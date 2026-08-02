"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { passwordSchema } from "@/lib/auth/password";

export type SignupFormState = { error: string } | undefined;

const signupSchema = z.object({
  companyName: z.string().trim().min(1, "회사명을 입력해주세요."),
  businessRegistrationNumber: z
    .string()
    .trim()
    .transform((value) => value.replace(/[^0-9]/g, ""))
    .refine((value) => value.length === 10, {
      message: "사업자등록번호는 숫자 10자리여야 합니다 (예: 123-45-67890).",
    }),
  country: z.string().trim().min(1, "국가를 입력해주세요."),
  contactName: z.string().trim().min(1, "담당자 이름을 입력해주세요."),
  email: z.email({ message: "올바른 이메일 형식이 아닙니다." }),
  contactPhone: z.string().trim().min(1, "담당자 연락처를 입력해주세요."),
  password: passwordSchema,
  agreedToTerms: z.literal("on", {
    message: "이용약관에 동의해야 가입할 수 있습니다.",
  }),
});

/**
 * 08_주요화면과AC.md 화면 1(회원가입) 서버 액션.
 * 가입 즉시 auth 계정 + Company + CompanyUser(company_admin)를 함께 만든다
 * (해당 화면 AC: "가입 완료 즉시 Company와 CompanyUser(역할: Admin) 레코드가 함께 생성된다").
 *
 * Supabase 프로젝트의 "Confirm email" 설정은 켜둔 채로 둔다(권장값 유지) — 이 설정을
 * 끄면 실제 이메일 확인 없이 email_confirmed_at이 가입 즉시 채워져 버려, "이메일
 * 인증"이라는 항목 자체가 유명무실해진다. 대신 Company/CompanyUser 레코드 생성은
 * (RLS가 적용되는 세션용 클라이언트가 아니라) admin 클라이언트로 수행해서, 이메일
 * 확인 전이라 세션이 아직 없는 상태에서도 이 두 레코드가 정상적으로 만들어지게 한다.
 * 세션이 이미 발급됐으면(=Confirm email이 꺼진 프로젝트라면) 바로 /portal로,
 * 아직 없으면(=기본값, 이메일 확인 대기 중) 안내 화면으로 보낸다.
 */
export async function signupCompanyAdmin(
  _prevState: SignupFormState,
  formData: FormData
): Promise<SignupFormState> {
  const parsed = signupSchema.safeParse({
    companyName: formData.get("companyName"),
    businessRegistrationNumber: formData.get("businessRegistrationNumber"),
    country: formData.get("country"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    contactPhone: formData.get("contactPhone"),
    password: formData.get("password"),
    agreedToTerms: formData.get("agreedToTerms"),
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { error: firstIssue?.message ?? "입력값을 확인해주세요." };
  }

  const {
    companyName,
    businessRegistrationNumber,
    country,
    contactName,
    email,
    contactPhone,
    password,
  } = parsed.data;

  const supabase = await createClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
    {
      email,
      password,
      options: { data: { role: "portal", display_name: contactName } },
    }
  );

  if (signUpError) {
    console.error("[signupCompanyAdmin] signUp error", signUpError);
    if (signUpError.message.toLowerCase().includes("already registered")) {
      return {
        error: "이미 사용 중인 이메일입니다. 로그인 화면을 이용해주세요.",
      };
    }
    return {
      error: "가입 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  // Supabase는 사용자 열거(enumeration) 공격을 막기 위해, 이미 존재하는 이메일로
  // 가입을 시도해도 겉으로는 성공처럼 응답하되 identities를 빈 배열로 반환한다.
  const user = signUpData.user;
  if (!user || (user.identities && user.identities.length === 0)) {
    return {
      error: "이미 사용 중인 이메일입니다. 로그인 화면을 이용해주세요.",
    };
  }

  const admin = createAdminClient();

  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({
      name: companyName,
      business_registration_number: businessRegistrationNumber,
      country,
      contact_name: contactName,
      contact_phone: contactPhone,
    })
    .select("id")
    .single();

  if (companyError || !company) {
    return {
      error: "회사 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  const { error: companyUserError } = await admin.from("company_users").insert({
    id: user.id,
    company_id: company.id,
    name: contactName,
    email,
    company_role: "company_admin",
    status: "active",
    joined_at: new Date().toISOString(),
  });

  if (companyUserError) {
    return {
      error: "계정 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  if (signUpData.session) {
    redirect("/portal");
  }
  redirect("/portal/signup/check-email");
}
