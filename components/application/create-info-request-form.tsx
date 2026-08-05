"use client";

import { useActionState, useState } from "react";
import type { InfoRequestFormState } from "@/lib/application/info-request-actions";

type CreateInfoRequestFormProps = {
  action: (
    state: InfoRequestFormState,
    formData: FormData
  ) => Promise<InfoRequestFormState>;
  products: { id: string; name: string }[];
};

export function CreateInfoRequestForm({
  action,
  products,
}: CreateInfoRequestFormProps) {
  const [state, formAction, pending] = useActionState<
    InfoRequestFormState,
    FormData
  >(action, undefined);

  const [hasDeadline, setHasDeadline] = useState(false);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-md border border-zinc-200 dark:border-zinc-800 p-4"
    >
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          대상 (선택하지 않으면 신청서 전체 대상)
        </label>
        <select
          name="productId"
          defaultValue=""
          className="mt-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-500 dark:focus:border-zinc-700"
        >
          <option value="" className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">신청서 전체</option>
          {products.map((p) => (
            <option key={p.id} value={p.id} className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2 py-1">
        <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 font-semibold cursor-pointer select-none">
          <input
            type="checkbox"
            name="hasDeadline"
            value="true"
            checked={hasDeadline}
            onChange={(e) => setHasDeadline(e.target.checked)}
            className="cursor-pointer rounded border-zinc-300 accent-zinc-900 dark:accent-white"
          />
          <span>회신 기한 설정하기</span>
        </label>

        {hasDeadline && (
          <div className="pl-5">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              회신 기한 선택
            </label>
            <input
              type="date"
              name="replyDueAt"
              required
              min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
              className="block rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-500 dark:focus:border-zinc-700"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          요청 내용
        </label>
        <textarea
          name="requestContent"
          rows={2}
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-500 dark:focus:border-zinc-700"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-955 dark:hover:bg-zinc-100 h-9"
      >
        {pending ? "전송 중..." : "추가 자료 요청 보내기"}
      </button>
    </form>
  );
}
