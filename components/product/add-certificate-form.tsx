"use client";

import { useActionState, useState, startTransition } from "react";
import type { ProductFormState } from "@/lib/product/actions";
import { CERTIFICATE_TYPE_LABEL, type CertificateType } from "@/lib/product/types";
import { compressImageIfNeeded } from "@/lib/files/client-compress";

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700";

type AddCertificateFormProps = {
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
};

export function AddCertificateForm({ action }: AddCertificateFormProps) {
  const [state, formAction, pending] = useActionState<
    ProductFormState,
    FormData
  >(action, undefined);

  const [clientError, setClientError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setClientError(null);
    setCompressing(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const file = formData.get("file") as File | null;
    const maxLimit = 10 * 1024 * 1024; // 10MB

    if (file && file.size > 0) {
      if (file.type.startsWith("image/")) {
        try {
          const processedFile = await compressImageIfNeeded(file, maxLimit);
          if (processedFile.size > maxLimit) {
            setClientError(
              `인증서 이미지 크기는 10MB를 초과할 수 없습니다. (현재 크기: ${(processedFile.size / (1024 * 1024)).toFixed(1)}MB)`
            );
            setCompressing(false);
            return;
          }
          formData.set("file", processedFile);
        } catch (err) {
          console.error("Certificate image compression error:", err);
        }
      } else {
        if (file.size > maxLimit) {
          setClientError(
            `인증서 파일 크기는 10MB를 초과할 수 없습니다. (현재 크기: ${(file.size / (1024 * 1024)).toFixed(1)}MB)`
          );
          setCompressing(false);
          return;
        }
      }
    }

    setCompressing(false);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4 sm:flex-row sm:items-end dark:border-zinc-800 dark:bg-zinc-900/10"
    >
      <div>
        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          인증서 종류
        </label>
        <select name="certificateType" defaultValue="ingredient_certification" className={inputClass}>
          {(Object.keys(CERTIFICATE_TYPE_LABEL) as CertificateType[]).map(
            (value) => (
              <option key={value} value={value}>
                {CERTIFICATE_TYPE_LABEL[value]}
              </option>
            )
          )}
        </select>
      </div>
      <div className="flex-1">
        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          파일 (PDF 또는 이미지)
        </label>
        <input
          name="file"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          required
          className="mt-1.5 block text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-850 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-800"
        />
      </div>
      <button
        type="submit"
        disabled={pending || compressing}
        className="rounded-md bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
      >
        {pending || compressing ? (compressing ? "압축 중..." : "업로드 중...") : "추가"}
      </button>
      {(clientError || state?.error) && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-450 sm:basis-full" role="alert">
          {clientError || state?.error}
        </p>
      )}
    </form>
  );
}
