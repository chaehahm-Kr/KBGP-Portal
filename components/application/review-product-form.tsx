"use client";

import { useActionState } from "react";
import type { ReviewFormState } from "@/lib/application/review-actions";
import { REVIEW_STATUS_LABEL, type ApplicationProductReviewStatus } from "@/lib/application/types";

type ReviewProductFormProps = {
  action: (
    state: ReviewFormState,
    formData: FormData
  ) => Promise<ReviewFormState>;
  productName: string;
  currentStatus: ApplicationProductReviewStatus;
  currentReason: string | null;
  disabled?: boolean;
};

const DECIDABLE_STATUSES: ApplicationProductReviewStatus[] = [
  "approved",
  "on_hold",
  "rejected",
];

export function ReviewProductForm({
  action,
  productName,
  currentStatus,
  currentReason,
  disabled,
}: ReviewProductFormProps) {
  const [state, formAction, pending] = useActionState<
    ReviewFormState,
    FormData
  >(action, undefined);

  return (
    <form
      action={formAction}
      className="rounded-md border border-zinc-200 dark:border-zinc-800 p-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-900 dark:text-white">{productName}</p>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          현재: {REVIEW_STATUS_LABEL[currentStatus]}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <select
          name="reviewStatus"
          defaultValue={
            DECIDABLE_STATUSES.includes(currentStatus) ? currentStatus : "approved"
          }
          disabled={disabled}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-500 dark:focus:border-zinc-700 disabled:opacity-50"
        >
          {DECIDABLE_STATUSES.map((value) => (
            <option key={value} value={value} className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
              {REVIEW_STATUS_LABEL[value]}
            </option>
          ))}
        </select>
        <input
          name="reviewReason"
          defaultValue={currentReason ?? ""}
          placeholder="보류·반려 시 사유 필수"
          disabled={disabled}
          className="min-w-[240px] flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-500 dark:focus:border-zinc-700 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={pending || disabled}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
      </div>

      {disabled && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          배정된 담당자만 이 신청서를 심사할 수 있습니다.
        </p>
      )}
      {state?.error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
