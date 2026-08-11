import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { AdminCompanyCreateForm } from "@/components/admin/admin-company-create-form";

export const metadata: Metadata = {
  title: "신규 회사 등록 | K SELECT NETWORK 어드민",
};

export default async function AdminNewCompanyPage() {
  await verifyAdminSession();

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 py-6 px-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-550 dark:text-zinc-400">
        <Link href="/admin/companies" className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
          회사 관리
        </Link>
        <span>&gt;</span>
        <span className="font-bold text-zinc-800 dark:text-zinc-200">신규 회사 등록</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">신규 회사 등록</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400 mt-1">
          K SELECT NETWORK 플랫폼에 등록할 새로운 파트너 뷰티 기업(제조사/브랜드사) 정보를 입력합니다.
        </p>
      </div>

      {/* Form Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <AdminCompanyCreateForm />
      </div>
    </div>
  );
}
