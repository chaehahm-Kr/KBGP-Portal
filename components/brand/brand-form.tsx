"use client";

import { useActionState, useState, startTransition } from "react";
import type { BrandFormState } from "@/lib/brand/actions";
import { compressImageIfNeeded } from "@/lib/files/client-compress";

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

type BrandFormProps = {
  action: (state: BrandFormState, formData: FormData) => Promise<BrandFormState>;
  defaultName?: string;
  defaultIntro?: string;
  defaultLogoUrl?: string;
  defaultHasKrTrademark?: boolean;
  defaultKrTrademarkNumber?: string;
  defaultKrTrademarkFileUrl?: string;
  defaultKrTrademarkPath?: string;
  defaultHasUsTrademark?: boolean;
  defaultUsTrademarkNumber?: string;
  defaultUsTrademarkFileUrl?: string;
  defaultUsTrademarkPath?: string;
  submitLabel: string;
};

export function BrandForm({
  action,
  defaultName,
  defaultIntro,
  defaultLogoUrl,
  defaultHasKrTrademark,
  defaultKrTrademarkNumber,
  defaultKrTrademarkFileUrl,
  defaultKrTrademarkPath,
  defaultHasUsTrademark,
  defaultUsTrademarkNumber,
  defaultUsTrademarkFileUrl,
  defaultUsTrademarkPath,
  submitLabel,
}: BrandFormProps) {
  const [state, formAction, pending] = useActionState<BrandFormState, FormData>(
    action,
    undefined
  );

  const [clientError, setClientError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  // Trademark fields state
  const [hasKrTrademark, setHasKrTrademark] = useState(defaultHasKrTrademark ?? false);
  const [hasUsTrademark, setHasUsTrademark] = useState(defaultHasUsTrademark ?? false);

  // File deletion state
  const [deleteKrFile, setDeleteKrFile] = useState(false);
  const [deleteUsFile, setDeleteUsFile] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setClientError(null);
    setCompressing(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    // Compress logo
    const logoFile = formData.get("logo") as File | null;
    if (logoFile && logoFile.size > 0) {
      const maxLimit = 10 * 1024 * 1024; // 10MB
      try {
        const processedFile = await compressImageIfNeeded(logoFile, maxLimit);
        if (processedFile.size > maxLimit) {
          setClientError(
            `로고 이미지 크기는 10MB를 초과할 수 없습니다. (현재 크기: ${(processedFile.size / (1024 * 1024)).toFixed(1)}MB)`
          );
          setCompressing(false);
          return;
        }
        formData.set("logo", processedFile);
      } catch (err) {
        console.error("Logo compression error:", err);
      }
    }

    // Compress KR trademark file if image
    const krFile = formData.get("krTrademarkFile") as File | null;
    if (hasKrTrademark && krFile && krFile.size > 0) {
      const maxLimit = 10 * 1024 * 1024;
      if (krFile.type.startsWith("image/")) {
        try {
          const processedFile = await compressImageIfNeeded(krFile, maxLimit);
          if (processedFile.size > maxLimit) {
            setClientError(`대한민국 상표권 증빙 파일 크기는 10MB를 초과할 수 없습니다.`);
            setCompressing(false);
            return;
          }
          formData.set("krTrademarkFile", processedFile);
        } catch (err) {
          console.error("KR Trademark file processing error:", err);
        }
      } else {
        if (krFile.size > maxLimit) {
          setClientError(`대한민국 상표권 증빙 파일 크기는 10MB를 초과할 수 없습니다.`);
          setCompressing(false);
          return;
        }
      }
    }

    // Compress US trademark file if image
    const usFile = formData.get("usTrademarkFile") as File | null;
    if (hasUsTrademark && usFile && usFile.size > 0) {
      const maxLimit = 10 * 1024 * 1024;
      if (usFile.type.startsWith("image/")) {
        try {
          const processedFile = await compressImageIfNeeded(usFile, maxLimit);
          if (processedFile.size > maxLimit) {
            setClientError(`미국 상표권 증빙 파일 크기는 10MB를 초과할 수 없습니다.`);
            setCompressing(false);
            return;
          }
          formData.set("usTrademarkFile", processedFile);
        } catch (err) {
          console.error("US Trademark file processing error:", err);
        }
      } else {
        if (usFile.size > maxLimit) {
          setClientError(`미국 상표권 증빙 파일 크기는 10MB를 초과할 수 없습니다.`);
          setCompressing(false);
          return;
        }
      }
    }

    // Set states
    formData.set("hasKrTrademark", hasKrTrademark ? "true" : "false");
    formData.set("hasUsTrademark", hasUsTrademark ? "true" : "false");
    if (deleteKrFile) formData.set("deleteKrTrademarkFile", "true");
    if (deleteUsFile) formData.set("deleteUsTrademarkFile", "true");
    if (defaultKrTrademarkPath) formData.set("currentKrTrademarkPath", defaultKrTrademarkPath);
    if (defaultUsTrademarkPath) formData.set("currentUsTrademarkPath", defaultUsTrademarkPath);

    setCompressing(false);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-6">
      <div className="space-y-4">
        {/* 기본 정보 */}
        <div>
          <label htmlFor="name" className={labelClass}>
            브랜드명
          </label>
          <input
            id="name"
            name="name"
            defaultValue={defaultName}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="intro" className={labelClass}>
            브랜드 소개 (선택)
          </label>
          <textarea
            id="intro"
            name="intro"
            defaultValue={defaultIntro}
            rows={3}
            className={inputClass}
          />
        </div>

        {/* 로고 업로드 */}
        <div>
          <label htmlFor="logo" className={labelClass}>
            로고 이미지 (선택, JPG/PNG/WEBP, 10MB 이하)
          </label>
          {defaultLogoUrl && (
            <div className="mt-2 mb-3 space-y-1">
              <p className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">현재 로고 이미지</p>
              <div className="relative h-20 w-20 rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                <img src={defaultLogoUrl} alt="현재 브랜드 로고" className="max-h-full max-w-full object-contain" />
              </div>
            </div>
          )}
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-1.5 block text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-850 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-800"
          />
        </div>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* 대한민국 특허청 상표권 */}
      <div className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
        <div className="flex items-center justify-between">
          <label htmlFor="hasKrTrademark" className="text-sm font-bold text-zinc-900 dark:text-white cursor-pointer select-none">
            대한민국 특허청 상표권 등록 여부
          </label>
          <input
            id="hasKrTrademark"
            type="checkbox"
            checked={hasKrTrademark}
            onChange={(e) => setHasKrTrademark(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-850"
          />
        </div>

        {hasKrTrademark && (
          <div className="space-y-3.5 pt-1.5 border-t border-zinc-200/60 dark:border-zinc-800/60 animate-fadeIn">
            <div>
              <label htmlFor="krTrademarkNumber" className="text-xs font-semibold text-zinc-550 dark:text-zinc-450 block mb-1">
                상표권 등록 번호
              </label>
              <input
                id="krTrademarkNumber"
                name="krTrademarkNumber"
                type="text"
                defaultValue={defaultKrTrademarkNumber}
                placeholder="등록 번호를 입력해 주세요"
                required={hasKrTrademark}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="krTrademarkFile" className="text-xs font-semibold text-zinc-550 dark:text-zinc-450 block mb-1">
                상표권 증빙서류 첨부 (선택, 이미지/PDF, 10MB 이하)
              </label>
              {defaultKrTrademarkFileUrl && !deleteKrFile && (
                <div className="mt-2 mb-3 flex items-center justify-between gap-3 p-2 rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                  <a
                    href={defaultKrTrademarkFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 underline underline-offset-2 truncate hover:text-zinc-900"
                  >
                    등록된 증빙 문서 보기
                  </a>
                  <button
                    type="button"
                    onClick={() => setDeleteKrFile(true)}
                    className="text-[10px] font-bold text-rose-600 dark:text-rose-450 hover:underline shrink-0"
                  >
                    파일 제거
                  </button>
                </div>
              )}
              {(!defaultKrTrademarkFileUrl || deleteKrFile) && (
                <input
                  id="krTrademarkFile"
                  name="krTrademarkFile"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-850 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-800"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* 미국 USPTO 상표권 */}
      <div className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
        <div className="flex items-center justify-between">
          <label htmlFor="hasUsTrademark" className="text-sm font-bold text-zinc-900 dark:text-white cursor-pointer select-none">
            미국 USPTO 상표권 등록 여부
          </label>
          <input
            id="hasUsTrademark"
            type="checkbox"
            checked={hasUsTrademark}
            onChange={(e) => setHasUsTrademark(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-850"
          />
        </div>

        {hasUsTrademark && (
          <div className="space-y-3.5 pt-1.5 border-t border-zinc-200/60 dark:border-zinc-800/60 animate-fadeIn">
            <div>
              <label htmlFor="usTrademarkNumber" className="text-xs font-semibold text-zinc-550 dark:text-zinc-450 block mb-1">
                상표권 등록 번호
              </label>
              <input
                id="usTrademarkNumber"
                name="usTrademarkNumber"
                type="text"
                defaultValue={defaultUsTrademarkNumber}
                placeholder="등록 번호를 입력해 주세요"
                required={hasUsTrademark}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="usTrademarkFile" className="text-xs font-semibold text-zinc-550 dark:text-zinc-450 block mb-1">
                상표권 증빙서류 첨부 (선택, 이미지/PDF, 10MB 이하)
              </label>
              {defaultUsTrademarkFileUrl && !deleteUsFile && (
                <div className="mt-2 mb-3 flex items-center justify-between gap-3 p-2 rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                  <a
                    href={defaultUsTrademarkFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 underline underline-offset-2 truncate hover:text-zinc-900"
                  >
                    등록된 증빙 문서 보기
                  </a>
                  <button
                    type="button"
                    onClick={() => setDeleteUsFile(true)}
                    className="text-[10px] font-bold text-rose-600 dark:text-rose-450 hover:underline shrink-0"
                  >
                    파일 제거
                  </button>
                </div>
              )}
              {(!defaultUsTrademarkFileUrl || deleteUsFile) && (
                <input
                  id="usTrademarkFile"
                  name="usTrademarkFile"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-850 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-800"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {(clientError || state?.error) && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-450" role="alert">
          {clientError || state?.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || compressing}
        className="rounded-md bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 w-full"
      >
        {pending || compressing ? (compressing ? "이미지 압축 중..." : "저장 중...") : submitLabel}
      </button>
    </form>
  );
}
