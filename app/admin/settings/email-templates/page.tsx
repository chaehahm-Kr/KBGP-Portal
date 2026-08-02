import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_KEYS, DEFAULT_TEMPLATES } from "@/lib/notifications/templates";
import { updateEmailTemplate, sendTestEmail } from "@/lib/notifications/template-actions";
import { EmailTemplateForm } from "@/components/settings/email-template-form";

export const metadata: Metadata = {
  title: "이메일 템플릿 설정 | 관리자 콘솔",
};

/**
 * 08_주요화면과AC.md 화면 20 "설정(이메일 템플릿) | Super Admin | 템플릿 문구 수정 후
 * 발송 테스트 기능 제공". 09_알림및문서관리규칙.md Part 1 이벤트 목록 중 우리가 직접
 * 문구를 구성해서 보내는 항목(회원가입/초대는 Supabase Auth 기본 메일러가 처리하므로
 * 제외)이 전부 여기서 편집된다.
 */
export default async function EmailTemplatesSettingsPage() {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("email_templates")
    .select("key, description, subject_template, body_template");

  const templateByKey = new Map((templates ?? []).map((t) => [t.key, t]));

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-lg font-semibold text-zinc-900">이메일 템플릿 설정</h1>
      <p className="mt-1 text-sm text-zinc-500">
        업무 이벤트에 따라 자동으로 발송되는 이메일의 제목·본문을 수정합니다. 회원가입
        확인·비밀번호 재설정·소속 사용자 초대 메일은 Supabase 자체 인증 메일러가 보내므로
        이 화면에 포함되지 않습니다.
      </p>

      <div className="mt-8 space-y-4">
        {TEMPLATE_KEYS.map((key) => {
          const row = templateByKey.get(key);
          const fallback = DEFAULT_TEMPLATES[key];
          return (
            <EmailTemplateForm
              key={key}
              templateKey={key}
              description={row?.description ?? fallback.description}
              subject={row?.subject_template ?? fallback.subject}
              body={row?.body_template ?? fallback.body}
              updateAction={updateEmailTemplate.bind(null, key)}
              testAction={sendTestEmail.bind(null, key)}
            />
          );
        })}
      </div>
    </div>
  );
}
