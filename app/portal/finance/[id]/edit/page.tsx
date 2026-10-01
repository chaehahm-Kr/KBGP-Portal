import React from "react";
import { notFound, redirect } from "next/navigation";
import { getPortalInvoiceDetail, getEligiblePosForInvoice } from "@/lib/portal/actions";
import { InvoiceForm } from "@/components/portal/invoice-form";
import { hasPortalPermission } from "@/lib/company/permissions";
import { AccessDeniedView } from "@/components/portal/access-denied";

export default async function EditPortalInvoicePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const canWrite = await hasPortalPermission("finance", "write");
  if (!canWrite) {
    return (
      <AccessDeniedView
        title="접근 권한이 없습니다."
        message="인보이스 정보를 수정할 권한이 없습니다. 권한 조정을 원하시면 회사 관리자에게 문의해주세요."
      />
    );
  }

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
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">인보이스 수정</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          임시저장된 인보이스 ({invoice.supplierInvoiceNumber})의 품목별 수량과 정보를 편집합니다.
        </p>
      </div>

      <InvoiceForm eligiblePos={[]} initialInvoice={invoice} />
    </div>
  );
}
