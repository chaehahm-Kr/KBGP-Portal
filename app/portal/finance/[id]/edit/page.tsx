import React from "react";
import { notFound, redirect } from "next/navigation";
import { getPortalInvoiceDetail, getEligiblePosForInvoice } from "@/lib/portal/actions";
import { InvoiceForm } from "@/components/portal/invoice-form";

export default async function EditPortalInvoicePage({
  params
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await params;
  const { id } = resolvedParams;

  const invoice = await getPortalInvoiceDetail(id);
  if (!invoice) {
    notFound();
  }

  // Reject editing if not in DRAFT status
  if (invoice.invoiceStatus !== "DRAFT") {
    redirect(`/portal/finance/${id}`);
  }

  return (
    <div className="w-full max-w-7xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">인보이스 수정</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          임시저장된 인보이스 ({invoice.supplierInvoiceNumber})의 품목별 수량과 정보를 편집합니다.
        </p>
      </div>

      <InvoiceForm eligiblePos={[]} initialInvoice={invoice} />
    </div>
  );
}
