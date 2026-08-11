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

  if (!companies || companies.length === 0) {
    return (
      <div className="w-full max-w-xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="text-6xl animate-bounce">🏢</div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">등록된 회사 정보가 존재하지 않습니다.</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
          제품을 등록하기 전에 먼저 최소 하나 이상의 회사(브랜드사)가 어드민 시스템에 등록되어야 합니다.
        </p>
        <div className="pt-2">
          <Link
            href="/admin/companies/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-650 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-650 transition-colors cursor-pointer"
          >
            + 신규 회사 추가하러 가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 py-6 px-4">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-zinc-555 dark:text-zinc-400">
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
