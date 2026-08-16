import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalInvoiceDetail, getPortalInvoiceAttachmentUrl } from "@/lib/portal/actions";
import { InvoiceDetail } from "@/components/portal/invoice-detail";

export default async function PortalInvoiceDetailPage({
  params
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await params;
  const { id } = resolvedParams;

  const invoice = await getPortalInvoiceDetail(id).catch(() => null);
  if (!invoice) {
    notFound();
  }

  // Get signed URL for supporting invoice file
  const attachmentUrl = invoice.attachmentPath
    ? await getPortalInvoiceAttachmentUrl(invoice.attachmentPath).catch(err => {
        console.error("Failed to generate signed URL for invoice attachment:", err);
        return null;
      })
    : null;

  return (
    <div className="w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/portal/finance"
            className="text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            ← 정산 목록으로 돌아가기
          </Link>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white mt-2">
            인보이스 상세 내역 ({invoice.supplierInvoiceNumber})
          </h1>
        </div>
      </div>

      <InvoiceDetail invoice={invoice} attachmentUrl={attachmentUrl} />
    </div>
  );
}
