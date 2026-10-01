import type { Metadata } from "next";
import { BrandForm } from "@/components/brand/brand-form";
import { createBrand } from "@/lib/brand/actions";
import { hasPortalPermission } from "@/lib/company/permissions";
import { AccessDeniedView } from "@/components/portal/access-denied";

export const metadata: Metadata = {
  title: "새 브랜드 | 파트너 포털",
};

export default async function NewBrandPage() {
  const canWrite = await hasPortalPermission("brands", "write");
  if (!canWrite) {
    return (
      <AccessDeniedView
        title="접근 권한이 없습니다."
        message="새 브랜드를 등록할 권한이 없습니다. 권한 조정을 원하시면 회사 관리자에게 문의해주세요."
      />
    );
  }

  return (
    <div className="w-full max-w-7xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">새 브랜드 등록</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">포털에서 관리할 브랜드 정보를 입력해 주세요.</p>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <BrandForm action={createBrand} submitLabel="등록" />
      </div>
    </div>
  );
}
