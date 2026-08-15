import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupplierInvoiceById, getPurchaseOrderForInvoice } from "@/lib/supplier-invoice/actions";
import { InvoiceDetail } from "@/components/admin/invoice-detail";

export const metadata: Metadata = {
  title: "인보이스 상세 보기 | K SELECT NETWORK 어드민",
};

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: DetailPageProps) {
  await verifyAdminSession();
  const { id } = await params;

  let invoice: any = null;
  try {
    invoice = await getSupplierInvoiceById(id);
  } catch (err) {
    notFound();
  }

  // Load PO details (including receiving summary resolved quantities)
  const po = await getPurchaseOrderForInvoice(invoice.purchase_order_id);

  // Compute PO Merchandise Total
  const poMerchandiseTotal = po.lines.reduce(
    (sum: number, l: any) => sum + l.qty * Number(l.unit_cost),
    0
  );

  // Fetch sibling approved invoices for the same PO
  const supabase = createAdminClient();
  const { data: siblingInvoices } = await supabase
    .from("supplier_invoices")
    .select("invoice_total")
    .eq("purchase_order_id", invoice.purchase_order_id)
    .eq("invoice_status", "APPROVED")
    .neq("id", id);

  const prevInvoicesTotal = (siblingInvoices ?? []).reduce(
    (sum: number, item: any) => sum + Number(item.invoice_total),
    0
  );

  // Format invoice fields to numbers
  const formattedInvoice = {
    ...invoice,
    subtotal: Number(invoice.subtotal),
    tax_amount: Number(invoice.tax_amount),
    other_charges: Number(invoice.other_charges),
    invoice_total: Number(invoice.invoice_total),
    amount_paid: Number(invoice.amount_paid),
    balance_due: Number(invoice.balance_due),
    lines: invoice.lines.map((l: any) => ({
      ...l,
      invoiced_qty: Number(l.invoiced_qty),
      unit_price: Number(l.unit_price),
      line_amount: Number(l.line_amount),
    })),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-955 dark:text-white">인보이스 및 대금 지급 매칭 정보</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400">
          내부 AP 관리 번호 기준 발주 대금 승인 상태 및 3-Way Match 실물 입고 정합성을 비교 열람합니다.
        </p>
      </div>

      <InvoiceDetail
        invoice={formattedInvoice}
        po={po}
        prevInvoicesTotal={prevInvoicesTotal}
        poMerchandiseTotal={poMerchandiseTotal}
      />
    </div>
  );
}
