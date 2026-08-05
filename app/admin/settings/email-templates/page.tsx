import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_KEYS, DEFAULT_TEMPLATES } from "@/lib/notifications/templates";
import {
  updateEmailTemplate,
  sendTestEmail,
  getEmailPreviewHtml,
} from "@/lib/notifications/template-actions";
import { EmailTemplatesWorkspace } from "@/components/settings/email-templates-workspace";

export const metadata: Metadata = {
  title: "이메일 템플릿 설정 | 관리자 콘솔",
};

export default async function EmailTemplatesSettingsPage() {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("email_templates")
    .select("key, description, subject_template, body_template");

  const templateByKey = new Map((templates ?? []).map((t) => [t.key, t]));

  // Prepare standard initial templates list formatted for the workspace component
  const initialTemplates = TEMPLATE_KEYS.map((key) => {
    const row = templateByKey.get(key);
    const fallback = DEFAULT_TEMPLATES[key];
    return {
      key,
      description: row?.description ?? fallback.description,
      subject: row?.subject_template ?? fallback.subject,
      body: row?.body_template ?? fallback.body,
    };
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
        <h1 className="text-sm font-bold text-zinc-900 dark:text-white">이메일 템플릿 설정</h1>
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal max-w-4xl">
          업무 이벤트에 따라 자동으로 발송되는 이메일의 제목·본문을 편집합니다. 
          회원가입 확인·비밀번호 재설정·사용자 초대 메일은 Supabase 자체 인증 메일러가 전송하므로 여기서 제외됩니다.
        </p>
      </div>

      <EmailTemplatesWorkspace
        initialTemplates={initialTemplates}
        updateAction={updateEmailTemplate}
        testAction={sendTestEmail}
        previewAction={getEmailPreviewHtml}
      />
    </div>
  );
}
