import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AdminProductCreateForm } from "@/components/admin/admin-product-create-form";

export const metadata: Metadata = {
  title: "신규 제품 등록 | K SELECT NETWORK 어드민",
};

export default async function AdminNewProductPage() {
  await verifyAdminSession();
  const supabase = await createClient();

  // 회사 목록 조회
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .order("name", { ascending: true });

  // 브랜드 목록 조회
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, company_id")
    .order("name", { ascending: true });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 py-6 px-4">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-zinc-550 dark:text-zinc-400">
        <Link href="/admin/products" className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
          제품 통합 관리
        </Link>
        <span>&gt;</span>
        <span className="font-bold text-zinc-800 dark:text-zinc-200">신규 제품 등록</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">신규 제품 등록</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400 mt-1">
          특정 회사와 브랜드를 지정하여 새로운 제품 카탈로그 레코드를 직접 등록합니다.
        </p>
      </div>

      {/* Product Creation Form Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <AdminProductCreateForm
          companies={companies ?? []}
          brands={brands ?? []}
        />
      </div>
    </div>
  );
}
