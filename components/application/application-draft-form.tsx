"use client";

import { useActionState } from "react";
import type { ApplicationFormState } from "@/lib/application/actions";
import { OFFICIAL_READINESS_ITEMS, type ReadinessResponseItem } from "@/lib/application/types";

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
  selfCheckAnswers?: boolean[];
  eligibilityResponses?: ReadinessResponseItem[];
};

export function ApplicationDraftForm({
  action,
  products,
  selectedProductIds,
  eligibilityResponses = [],
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



      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
            프로그램 참여 준비 사항 (Readiness)
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            K SELECT NETWORK 파트너십 추진을 위한 6개 관련 준비 사항에 응답해주세요. (진행 가능 또는 협의 필요 중 하나를 선택해 주세요)
          </p>
        </div>
        <div className="space-y-4">
          {OFFICIAL_READINESS_ITEMS.map((item) => (
            <div
              key={item.key}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/60 space-y-2.5"
            >
              <div>
                <h3 className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                  <span>{item.title}</span>
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  {item.desc}
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <label className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 p-2 text-xs font-bold cursor-pointer transition-all has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50 has-[:checked]:text-emerald-800 dark:has-[:checked]:border-emerald-600 dark:has-[:checked]:bg-emerald-950/20 dark:has-[:checked]:text-emerald-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                  <input
                    type="radio"
                    name={`readiness_${item.key}`}
                    value="available"
                    defaultChecked={
                      (eligibilityResponses.find((r) => r.itemKey === item.key)?.response ?? "available") === "available"
                    }
                    className="accent-emerald-600 cursor-pointer"
                  />
                  <span>🟢 진행 가능</span>
                </label>
                <label className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 p-2 text-xs font-bold cursor-pointer transition-all has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50/50 has-[:checked]:text-amber-800 dark:has-[:checked]:border-amber-600 dark:has-[:checked]:bg-amber-950/20 dark:has-[:checked]:text-amber-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                  <input
                    type="radio"
                    name={`readiness_${item.key}`}
                    value="discussion_required"
                    defaultChecked={
                      eligibilityResponses.find((r) => r.itemKey === item.key)?.response === "discussion_required"
                    }
                    className="accent-amber-600 cursor-pointer"
                  />
                  <span>🟡 협의 필요</span>
                </label>
              </div>
            </div>
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
