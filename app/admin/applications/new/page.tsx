import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { AdminInvitePartnerClient } from "@/components/admin/admin-invite-partner-client";

export const metadata: Metadata = {
  title: "파트너 초대 (Invite Partner) | K SELECT NETWORK 어드민",
};

export default async function AdminInvitePartnerPage() {
  await verifyAdminSession();

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <Link href="/admin/applications" className="hover:underline hover:text-zinc-800 dark:hover:text-zinc-200">
          신청서 관리
        </Link>
        <span>/</span>
        <span className="font-bold text-zinc-900 dark:text-white">파트너 초대 (Invite Partner)</span>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-extrabold text-zinc-950 dark:text-white">
          + 파트너 초대 (Invite Partner)
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          K SELECT가 직접 승인하였거나 어드민에서 사전 온보딩을 진행할 브랜드 또는 리테일러 파트너를 선택하여 정식 초대를 발송합니다.
        </p>
      </div>

      <AdminInvitePartnerClient />
    </div>
  );
}
