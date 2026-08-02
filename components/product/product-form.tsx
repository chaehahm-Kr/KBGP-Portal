"use client";

import { useActionState, useState, startTransition } from "react";
import type { ProductFormState } from "@/lib/product/actions";
import { PRODUCT_CATEGORY_LABEL, type ProductCategory } from "@/lib/product/types";
import { compressImageIfNeeded } from "@/lib/files/client-compress";

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

type ProductFormProps = {
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  brands: { id: string; name: string }[];
};

export function ProductForm({ action, brands }: ProductFormProps) {
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

    const imageFiles = formData.getAll("images") as File[];
    const maxLimit = 10 * 1024 * 1024; // 10MB

    if (imageFiles.length > 0) {
      try {
        const processedFiles = await Promise.all(
          imageFiles.map(async (file) => {
            if (file.size === 0) return file;
            return await compressImageIfNeeded(file, maxLimit);
          })
        );

        const tooLargeFile = processedFiles.find((f) => f.size > maxLimit);
        if (tooLargeFile) {
          setClientError(
            `제품 이미지 중 10MB를 초과하는 파일이 존재합니다. (초과 파일: ${tooLargeFile.name}, 크기: ${(tooLargeFile.size / (1024 * 1024)).toFixed(1)}MB)`
          );
          setCompressing(false);
          return;
        }

        formData.delete("images");
        processedFiles.forEach((file) => {
          formData.append("images", file);
        });
      } catch (err) {
        console.error("Image compression error:", err);
      }
    }

    setCompressing(false);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div>
        <label htmlFor="brandId" className={labelClass}>
          브랜드
        </label>
        <select id="brandId" name="brandId" required className={inputClass}>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="name" className={labelClass}>
          제품명
        </label>
        <input id="name" name="name" required className={inputClass} />
      </div>

      <div>
        <label htmlFor="category" className={labelClass}>
          카테고리
        </label>
        <select id="category" name="category" required className={inputClass}>
          {(Object.keys(PRODUCT_CATEGORY_LABEL) as ProductCategory[]).map(
            (value) => (
              <option key={value} value={value}>
                {PRODUCT_CATEGORY_LABEL[value]}
              </option>
            )
          )}
        </select>
      </div>

      <div>
        <label htmlFor="volume" className={labelClass}>
          용량 (선택)
        </label>
        <input id="volume" name="volume" placeholder="예: 50ml" className={inputClass} />
      </div>

      <div>
        <label htmlFor="estimatedRetailPrice" className={labelClass}>
          소비자가 추정 (USD, 선택)
        </label>
        <input
          id="estimatedRetailPrice"
          name="estimatedRetailPrice"
          type="number"
          step="0.01"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="ingredientsText" className={labelClass}>
          성분표 (텍스트, 선택)
        </label>
        <textarea
          id="ingredientsText"
          name="ingredientsText"
          rows={3}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="images" className={labelClass}>
          제품 이미지 (최소 1장, 최대 5장, JPG/PNG/WEBP)
        </label>
        <input
          id="images"
          name="images"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          required
          className="mt-1.5 block text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-850 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-800"
        />
      </div>

      {(clientError || state?.error) && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-450" role="alert">
          {clientError || state?.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || compressing}
        className="rounded-md bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
      >
        {pending || compressing ? (compressing ? "이미지 압축 중..." : "등록 중...") : "제품 등록"}
      </button>
    </form>
  );
}
