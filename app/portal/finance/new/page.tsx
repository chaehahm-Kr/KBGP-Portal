import React from "react";
import { getEligiblePosForInvoice } from "@/lib/portal/actions";
import { InvoiceForm } from "@/components/portal/invoice-form";
import { hasPortalPermission } from "@/lib/company/permissions";
import { AccessDeniedView } from "@/components/portal/access-denied";

export default async function NewPortalInvoicePage() {
  const canWrite = await hasPortalPermission("finance", "write");
  if (!canWrite) {
    return (
      <AccessDeniedView
        title="접근 권한이 없습니다."
        message="신규 인보이스 청구를 작성할 권한이 없습니다. 권한 조정을 원하시면 회사 관리자에게 문의해주세요."
      />
    );
  }

  const pos = await getEligiblePosForInvoice();

  return (
    <div className="w-full max-w-7xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">새 인보이스 청구 발행</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          승인/확인 완료된 발주서(PO)를 선택하고 인보이스 세부 품목별 수량과 단가를 기재하여 청구서를 작성합니다.
        </p>
      </div>

      <InvoiceForm eligiblePos={pos} />
    </div>
  );
}
