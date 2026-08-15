import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getSupplierPayments } from "@/lib/supplier-payment/actions";
import { PaymentsList } from "@/components/admin/payments-list";

export const metadata: Metadata = {
  title: "공급사 대금 지급 관리 | K SELECT NETWORK 어드민",
};

export default async function AdminPaymentsPage() {
  await verifyAdminSession();
  
  const payments = await getSupplierPayments();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-zinc-955 dark:text-white">공급사 지급 내역 (Supplier Payments)</h1>
          <p className="text-xs text-zinc-550 dark:text-zinc-400">
            인보이스 및 미지급 채무 정산이 종결된 공급업체에 대한 실제 현금/은행 송금 거래(Remittance Transaction)를 기입하고 이력을 관리합니다.
          </p>
        </div>
        <Link
          href="/admin/finance/payments/new"
          className="inline-flex items-center px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
        >
          + 신규 지급 기입 (Record Payment)
        </Link>
      </div>

      <PaymentsList initialPayments={payments} />
    </div>
  );
}
