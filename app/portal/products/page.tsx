import type { Metadata } from "next";
import Link from "next/link";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { PRODUCT_CATEGORY_LABEL, type ProductCategory } from "@/lib/product/types";

export const metadata: Metadata = {
  title: "제품 관리 | 파트너 포털",
};

export default async function ProductsPage() {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, category, brand_id, letusto_sku, manufacture_sku")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("is_active", true);

  const brandNameById = new Map((brands ?? []).map((b) => [b.id, b.name]));
  const hasBrand = (brands?.length ?? 0) > 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">제품 관리</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            입점 신청서에 등록할 제품군 카탈로그를 관리합니다.
          </p>
        </div>
        {hasBrand ? (
          <Link
            href="/portal/products/new"
            className="w-full sm:w-auto text-center rounded-md bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
          >
            새 제품 추가
          </Link>
        ) : (
          <Link
            href="/portal/brands/new"
            className="text-xs font-semibold text-amber-600 hover:text-amber-700 underline underline-offset-2"
          >
            ⚠️ 새 제품 추가를 위해 먼저 브랜드를 등록해주세요.
          </Link>
        )}
      </div>

      {/* Table Container Card */}
      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                <th className="px-6 py-3">제품명</th>
                <th className="px-6 py-3">Letusto SKU</th>
                <th className="px-6 py-3">제조사 SKU</th>
                <th className="px-6 py-3">브랜드</th>
                <th className="px-6 py-3">카테고리</th>
                <th className="px-6 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs dark:divide-zinc-800/60">
              {(products ?? []).map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/20 transition-colors"
                >
                  <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-white">
                    <Link
                      href={`/portal/products/${product.id}`}
                      className="hover:underline"
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-zinc-650 dark:text-zinc-400 font-mono">
                    {product.letusto_sku ?? "-"}
                  </td>
                  <td className="px-6 py-4 text-zinc-650 dark:text-zinc-400 font-mono">
                    {product.manufacture_sku ?? "-"}
                  </td>
                  <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300 font-medium">
                    {brandNameById.get(product.brand_id) ?? "(미확인 브랜드)"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-800 dark:text-zinc-300">
                      {PRODUCT_CATEGORY_LABEL[product.category as ProductCategory]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/portal/products/${product.id}`}
                      className="font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                    >
                      수정 및 세부 정보
                    </Link>
                  </td>
                </tr>
              ))}

              {(products ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-zinc-450 dark:text-zinc-500"
                  >
                    아직 등록된 입점 제품이 존재하지 않습니다. 상단의 '새 제품 추가'를 통해 등록을 완료해 주세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

