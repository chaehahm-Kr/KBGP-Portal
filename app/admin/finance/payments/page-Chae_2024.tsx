import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getPaymentsDashboardData } from "@/lib/supplier-payment/actions";
import { PaymentsList } from "@/components/admin/payments-list";

export const metadata: Metadata = {
  title: "공급사 대금 지급 대시보드 | K SELECT NETWORK 어드민",
};

export default async function AdminPaymentsPage() {
  await verifyAdminSession();
  
  const dashboardData = await getPaymentsDashboardData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-955 dark:text-white">
            공급사 대금 지급 대시보드 (Payments Dashboard)
          </h1>
          <p className="text-xs text-zinc-550 dark:text-zinc-400">
            승인된 공급사 인보이스의 지급 기한 및 미지급 잔액을 실시간 추적하고 송금 내역을 통합 관리합니다.
          </p>
        </div>
        <Link
          href="/admin/finance/payments/new"
          className="inline-flex items-center px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer w-fit"
        >
          + 지급 수기 기입 (Record Payment)
        </Link>
      </div>

      <PaymentsList
        kpis={dashboardData.kpis}
        schedule={dashboardData.schedule}
        history={dashboardData.history}
      />
    </div>
  );
}
