"use client";

import { useActionState } from "react";
import type { ApplicationFormState } from "@/lib/application/actions";
import { SELF_CHECK_ITEMS } from "@/lib/application/types";

type ProductOption = {
  id: string;
  name: string;
  brandName: string;
};

type ApplicationDraftFormProps = {
  action: (
    state: ApplicationFormState,
    formData: FormData
  ) => Promise<ApplicationFormState>;
  products: ProductOption[];
  selectedProductIds: string[];
  selfCheckAnswers: boolean[];
};

export function ApplicationDraftForm({
  action,
  products,
  selectedProductIds,
  selfCheckAnswers,
}: ApplicationDraftFormProps) {
  const [state, formAction, pending] = useActionState<
    ApplicationFormState,
    FormData
  >(action, undefined);

  const selectedSet = new Set(selectedProductIds);
  const productsByBrand = new Map<string, ProductOption[]>();
  for (const product of products) {
    const list = productsByBrand.get(product.brandName) ?? [];
    list.push(product);
    productsByBrand.set(product.brandName, list);
  }

  return (
    <form action={formAction} className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">제품 선택</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            이번 신청서에 담을 제품을 1개 이상 선택해주세요. 여러 브랜드 제품을 함께 담을
            수 있습니다.
          </p>
        </div>
        {products.length === 0 && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            등록된 제품이 없습니다. 먼저 제품을 등록해주세요.
          </p>
        )}
        <div className="space-y-4">
          {[...productsByBrand.entries()].map(([brandName, brandProducts]) => (
            <div key={brandName} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10">
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 pb-1.5 dark:border-zinc-800 mb-2">{brandName}</p>
              <div className="space-y-2">
                {brandProducts.map((product) => (
                  <label
                    key={product.id}
                    className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-350 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      name="productIds"
                      value={product.id}
                      defaultChecked={selectedSet.has(product.id)}
                      className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:checked:bg-white"
                    />
                    {product.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>



      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
            참여 조건 자가진단 재확인
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            모든 조건을 충족하지 않아도 제출은 가능합니다. 현재 상황을 있는 그대로
            체크해주세요.
          </p>
        </div>
        <div className="space-y-2 rounded-lg border border-zinc-105 p-3 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-900/5">
          {SELF_CHECK_ITEMS.map((item, index) => (
            <label key={item} className="flex items-start gap-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-350 cursor-pointer select-none">
              <input
                type="checkbox"
                name={`selfCheck_${index}`}
                defaultChecked={selfCheckAnswers[index] ?? false}
                className="mt-0.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950 dark:border-zinc-800 dark:bg-zinc-950"
              />
              <span className="leading-tight">{item}</span>
            </label>
          ))}
        </div>
      </section>

      {state?.error && (
        <p className="text-xs font-medium text-rose-600 dark:text-rose-450" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
      >
        {pending ? "저장 중..." : "임시저장"}
      </button>
    </form>
  );
}
