import React from "react";
import { getEligiblePosForInvoice } from "@/lib/portal/actions";
import { InvoiceForm } from "@/components/portal/invoice-form";

export default async function NewPortalInvoicePage() {
  const pos = await getEligiblePosForInvoice();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">새 인보이스 청구 발행</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          승인/확인 완료된 발주서(PO)를 선택하고 인보이스 세부 품목별 수량과 단가를 기재하여 청구서를 작성합니다.
        </p>
      </div>

      <InvoiceForm eligiblePos={pos} />
    </div>
  );
}
