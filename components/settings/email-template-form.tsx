"use client";

import { useActionState, useState } from "react";
import type { TemplateFormState } from "@/lib/notifications/template-actions";

type EmailTemplateFormProps = {
  templateKey: string;
  description: string;
  subject: string;
  body: string;
  updateAction: (
    state: TemplateFormState,
    formData: FormData
  ) => Promise<TemplateFormState>;
  testAction: (
    state: TemplateFormState,
    formData: FormData
  ) => Promise<TemplateFormState>;
};

export function EmailTemplateForm({
  templateKey,
  description,
  subject: initialSubject,
  body: initialBody,
  updateAction,
  testAction,
}: EmailTemplateFormProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);

  const [saveState, saveFormAction, savePending] = useActionState<
    TemplateFormState,
    FormData
  >(updateAction, undefined);
  const [testState, testFormAction, testPending] = useActionState<
    TemplateFormState,
    FormData
  >(testAction, undefined);

  return (
    <div className="rounded-md border border-zinc-200 p-4">
      <p className="text-xs font-mono text-zinc-400">{templateKey}</p>
      <p className="mt-0.5 text-sm font-medium text-zinc-900">{description}</p>

      <div className="mt-3 space-y-2">
        <div>
          <label className="block text-xs font-medium text-zinc-500">제목</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">
            본문 ({"{{변수명}}"} 형태로 치환됩니다)
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={saveFormAction}>
            <input type="hidden" name="subject" value={subject} />
            <input type="hidden" name="body" value={body} />
            <button
              type="submit"
              disabled={savePending}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              {savePending ? "저장 중..." : "저장"}
            </button>
          </form>
          <form action={testFormAction}>
            <input type="hidden" name="subject" value={subject} />
            <input type="hidden" name="body" value={body} />
            <button
              type="submit"
              disabled={testPending}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50"
            >
              {testPending ? "발송 중..." : "테스트 발송 (예시 값으로 본인 이메일로)"}
            </button>
          </form>
          {saveState && "error" in saveState && (
            <p className="text-sm text-red-600" role="alert">
              {saveState.error}
            </p>
          )}
          {saveState && "success" in saveState && (
            <p className="text-sm text-emerald-600">{saveState.success}</p>
          )}
          {testState && "error" in testState && (
            <p className="text-sm text-red-600" role="alert">
              {testState.error}
            </p>
          )}
          {testState && "success" in testState && (
            <p className="text-sm text-emerald-600">{testState.success}</p>
          )}
        </div>
      </div>
    </div>
  );
}
