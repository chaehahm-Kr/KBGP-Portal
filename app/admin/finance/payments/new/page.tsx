import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getEligibleInvoicesForPayment } from "@/lib/supplier-payment/actions";
import { PaymentForm } from "@/components/admin/payment-form";

export const metadata: Metadata = {
  title: "신규 지급 등록 | K SELECT NETWORK 어드민",
};

interface NewPaymentPageProps {
  searchParams: Promise<{ invoice_id?: string }>;
}

export default async function NewPaymentPage({ searchParams }: NewPaymentPageProps) {
  await verifyAdminSession();
  
  const { invoice_id } = await searchParams;
  const eligibleInvoices = await getEligibleInvoicesForPayment();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/admin/finance/payments"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
        >
          ← 지급 대시보드로 돌아가기
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold text-zinc-955 dark:text-white">공급사 지급 내역 등록 (Record Payment)</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400">
          공급사에 외상 대금(Accounts Payable) 송금을 진행한 실제 결제 사실을 기입합니다.
        </p>
      </div>

      <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-300">
        💡 <strong>빠른 지급 등록 팁:</strong> 대상 인보이스의 상세 화면(Invoice Detail) 내 <strong>[+ 지급 등록]</strong> 모달을 이용하시면 인보이스 번호, 공급사 계좌, 미지급 잔액이 자동 연계되어 더욱 신속하게 등록할 수 있습니다.
      </div>

      <PaymentForm
        eligibleInvoices={eligibleInvoices}
        preselectedInvoiceId={invoice_id || null}
      />
    </div>
  );
}
