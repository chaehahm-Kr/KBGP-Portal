import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalReadinessById, getShippingAttachmentUrl } from "@/lib/portal/actions";
import { DetailClient } from "./detail-client";

export default async function PortalReadinessDetailPage({
  params
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const readiness = await getPortalReadinessById(id);
  if (!readiness) {
    notFound();
  }

  // Generate signed URLs for private attachments
  const packingListUrl = readiness.packingListPath
    ? await getShippingAttachmentUrl(readiness.packingListPath)
    : null;

  const invoiceUrl = readiness.commercialInvoicePath
    ? await getShippingAttachmentUrl(readiness.commercialInvoicePath)
    : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/portal/orders/shipping"
            className="text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            ← 선적/출고 목록으로 돌아가기
          </Link>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white mt-2">
            출고 준비 상세 내역 ({readiness.poNumber})
          </h1>
        </div>
      </div>

      <DetailClient
        readiness={readiness}
        packingListUrl={packingListUrl}
        invoiceUrl={invoiceUrl}
      />
    </div>
  );
}
