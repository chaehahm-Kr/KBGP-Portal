import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getSupplierInvoices } from "@/lib/supplier-invoice/actions";
import { getSuppliersForPo } from "@/lib/purchase-order/actions";
import { InvoicesList } from "@/components/admin/invoices-list";

export const metadata: Metadata = {
  title: "공급사 인보이스 (Supplier Invoices) | K SELECT NETWORK 어드민",
};

export default async function AdminInvoicesPage() {
  await verifyAdminSession();
  
  // 1. Fetch invoices
  const invoices = await getSupplierInvoices();

  // 2. Fetch suppliers for dropdown filter
  const suppliers = await getSuppliersForPo();

  const formattedSuppliers = suppliers.map((s: any) => ({
    id: s.company_id,
    name: s.supplier_name
  }));

  // Format invoices data to match UI props structure
  const formattedInvoices = invoices.map((inv: any) => ({
    id: inv.id,
    internal_ap_number: inv.internal_ap_number,
    supplier_invoice_number: inv.supplier_invoice_number,
    invoice_date: inv.invoice_date,
    due_date: inv.due_date,
    currency: inv.currency,
    invoice_total: Number(inv.invoice_total),
    amount_paid: Number(inv.amount_paid),
    balance_due: Number(inv.balance_due),
    invoice_status: inv.invoice_status,
    payment_status: inv.payment_status,
    supplier: {
      id: inv.supplier?.id || "",
      name: inv.supplier?.name || "(미지정 공급사)"
    },
    po: {
      id: inv.po?.id || "",
      po_number: inv.po?.po_number || "-"
    }
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-zinc-955 dark:text-white">공급사 인보이스 (Supplier Invoices)</h1>
          <p className="text-xs text-zinc-550 dark:text-zinc-400">
            공급업체(Supplier)가 청구한 인보이스와 3-Way Match 실물 입고 정합성 매핑을 관리합니다.
          </p>
        </div>
        <Link
          href="/admin/finance/invoices/new"
          className="inline-flex items-center px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
        >
          + 신규 인보이스 등록 (New Invoice)
        </Link>
      </div>

      <InvoicesList
        initialInvoices={formattedInvoices}
        suppliers={formattedSuppliers}
      />
    </div>
  );
}
