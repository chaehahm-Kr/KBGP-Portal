"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TEMPLATE_KEYS,
  SAMPLE_VARIABLES,
  type TemplateKey,
} from "@/lib/notifications/templates";

export type TemplateFormState = { error: string } | { success: string } | undefined;

const templateKeySchema = z.enum(TEMPLATE_KEYS as unknown as [TemplateKey, ...TemplateKey[]]);

const updateSchema = z.object({
  subject: z.string().trim().min(1, "제목을 입력해주세요."),
  body: z.string().trim().min(1, "본문을 입력해주세요."),
});

/**
 * 08_주요화면과AC.md 화면 20 "템플릿 문구 수정". Super Admin만 접근 가능
 * (lib/auth/dal.ts의 requireSuperAdmin).
 */
export async function updateEmailTemplate(
  key: string,
  _prevState: TemplateFormState,
  formData: FormData
): Promise<TemplateFormState> {
  const session = await requireSuperAdmin();

  const keyResult = templateKeySchema.safeParse(key);
  if (!keyResult.success) {
    return { error: "알 수 없는 템플릿입니다." };
  }

  const parsed = updateSchema.safeParse({
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("email_templates")
    .update({
      subject_template: parsed.data.subject,
      body_template: parsed.data.body,
      updated_at: new Date().toISOString(),
      updated_by: session.userId,
    })
    .eq("key", keyResult.data);

  if (error) {
    return { error: "저장하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }

  revalidatePath("/admin/settings/email-templates");
  return { success: "저장되었습니다." };
}

/**
 * "발송 테스트" — 예시 변수값(SAMPLE_VARIABLES)으로 렌더링한 실제 메일을 요청한
 * Super Admin 본인 이메일로 보낸다. 폼에서 아직 저장하지 않은 수정 중인 문구를
 * 그대로 테스트할 수 있도록, DB에 먼저 저장하지 않고 subject/body를 formData에서
 * 받아 그 자리에서 렌더링한다(sendTemplatedEmail을 거치지 않는 이유).
 */
export async function sendTestEmail(
  key: string,
  _prevState: TemplateFormState,
  formData: FormData
): Promise<TemplateFormState> {
  const session = await requireSuperAdmin();

  const keyResult = templateKeySchema.safeParse(key);
  if (!keyResult.success) {
    return { error: "알 수 없는 템플릿입니다." };
  }

  const parsed = updateSchema.safeParse({
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." };
  }

  if (!session.email) {
    return { error: "테스트를 보낼 이메일 주소를 확인할 수 없습니다." };
  }

  const { renderEmailHtml } = await import("@/lib/notifications/templates");
  const { sendEmail } = await import("@/lib/notifications/email");

  const { subject, text, html } = renderEmailHtml(
    parsed.data.subject,
    parsed.data.body,
    SAMPLE_VARIABLES
  );

  await sendEmail({
    to: session.email,
    subject: `[테스트] ${subject}`,
    text: `[테스트 발송 — 예시 변수로 렌더링됨]\n\n${text}`,
    html: html,
  });

  return { success: `${session.email}로 테스트 메일을 보냈습니다.` };
}

function render(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name) => variables[name] ?? "");
}

/**
 * 실시간 이메일 템플릿 미리보기용 HTML을 렌더링하여 반환합니다.
 */
export async function getEmailPreviewHtml(
  key: string,
  subjectTemplate: string,
  bodyTemplate: string
): Promise<{ success: boolean; html: string; error?: string }> {
  try {
    await requireSuperAdmin();
    const { renderEmailHtml } = await import("@/lib/notifications/templates");
    const { html } = renderEmailHtml(subjectTemplate, bodyTemplate, {
      ...SAMPLE_VARIABLES,
      key,
    });
    return { success: true, html };
  } catch (e) {
    return { success: false, html: "", error: e instanceof Error ? e.message : "미리보기 생성에 실패했습니다." };
  }
}
