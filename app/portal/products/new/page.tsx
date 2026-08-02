import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/product/product-form";
import { createProduct } from "@/lib/product/actions";

export const metadata: Metadata = {
  title: "새 제품 | 파트너 포털",
};

export default async function NewProductPage() {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (!brands || brands.length === 0) {
    redirect("/portal/brands/new");
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">새 제품 등록</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">포털 및 신청서에 추가할 뷰티 제품 사양을 등록합니다.</p>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <ProductForm action={createProduct} brands={brands} />
      </div>
    </div>
  );
}
