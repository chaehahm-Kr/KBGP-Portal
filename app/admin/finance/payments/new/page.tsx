import type { Metadata } from "next";
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

  // If a preselected invoice is passed but not in the eligible list (e.g. if it's not SETTLED yet),
  // we still want to fetch it for error/warning display or UI convenience,
  // but to keep it simple, the dropdown list shows all eligible ones.
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-955 dark:text-white">공급사 지급 내역 등록 (Record Payment)</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400">
          공급사에 외상 대금(Accounts Payable) 송금을 진행한 실제 결제 사실을 기입합니다.
        </p>
      </div>

      <PaymentForm
        eligibleInvoices={eligibleInvoices}
        preselectedInvoiceId={invoice_id || null}
      />
    </div>
  );
}
