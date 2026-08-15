import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getSupplierPaymentById, getEligibleInvoicesForPayment } from "@/lib/supplier-payment/actions";
import { PaymentForm } from "@/components/admin/payment-form";

export const metadata: Metadata = {
  title: "지급 내역 수정 | K SELECT NETWORK 어드민",
};

interface EditPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPaymentPage({ params }: EditPageProps) {
  await verifyAdminSession();
  
  const { id } = await params;
  let payment: any = null;

  try {
    payment = await getSupplierPaymentById(id);
  } catch (err) {
    notFound();
  }

  // Only DRAFT payments can be edited
  if (payment.status !== "DRAFT") {
    redirect(`/admin/finance/payments/${payment.id}`);
  }

  const eligibleInvoices = await getEligibleInvoicesForPayment();

  // If the invoice connected to this payment is not in the eligible list (e.g. because it's already PAID),
  // we still format it and add it to the list so the dropdown shows it as selected.
  const isInvoiceInList = eligibleInvoices.some(inv => inv.id === payment.supplier_invoice_id);
  if (!isInvoiceInList && payment.invoice) {
    // Reconstruct PO adjustments for final_payable
    const adjs = payment.invoice.adjustments || [];
    let credits = 0;
    let charges = 0;
    adjs.forEach((a: any) => {
      if (a.status === "APPROVED") {
        if (a.adjustment_direction === "CREDIT") credits += Number(a.adjustment_amount);
        else charges += Number(a.adjustment_amount);
      }
    });
    const finalPayable = Number(payment.invoice.invoice_total) + charges - credits;

    eligibleInvoices.push({
      id: payment.invoice.id,
      internal_ap_number: payment.invoice.internal_ap_number,
      supplier_invoice_number: payment.invoice.supplier_invoice_number,
      currency: payment.invoice.currency,
      invoice_total: Number(payment.invoice.invoice_total),
      amount_paid: Number(payment.invoice.amount_paid),
      balance_due: Number(payment.invoice.balance_due),
      supplier_name: payment.invoice.supplier?.name || "(미지정)",
      final_payable: finalPayable
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-955 dark:text-white">지급 내역 수정 (Edit Record)</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400">
          초안(DRAFT) 상태인 공급사 송금 결제 사실을 수정합니다.
        </p>
      </div>

      <PaymentForm
        isEdit={true}
        payment={payment}
        eligibleInvoices={eligibleInvoices}
      />
    </div>
  );
}
