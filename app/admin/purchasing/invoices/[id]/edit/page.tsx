import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getSupplierInvoiceById, getEligiblePurchaseOrders } from "@/lib/supplier-invoice/actions";
import { getSuppliersForPo } from "@/lib/purchase-order/actions";
import { InvoiceForm } from "@/components/admin/invoice-form";

export const metadata: Metadata = {
  title: "인보이스 수정 | K SELECT NETWORK 어드민",
};

interface EditPageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceEditPage({ params }: EditPageProps) {
  await verifyAdminSession();
  const { id } = await params;

  let invoice: any = null;
  try {
    invoice = await getSupplierInvoiceById(id);
  } catch (err) {
    notFound();
  }

  // Only allow editing DRAFT or REJECTED invoices
  if (invoice.invoice_status !== "DRAFT" && invoice.invoice_status !== "REJECTED") {
    redirect(`/admin/purchasing/invoices/${invoice.id}`);
  }

  // 1. Fetch eligible POs
  const eligiblePos = await getEligiblePurchaseOrders();

  // 2. Fetch suppliers
  const suppliers = await getSuppliersForPo();

  const formattedSuppliers = suppliers.map((s: any) => ({
    id: s.company_id,
    name: s.supplier_name
  }));

  // Ensure the invoice's PO is included in the options even if its status changed
  const formattedPos = eligiblePos.map((po: any) => ({
    id: po.id,
    po_number: po.po_number,
    supplier_id: po.supplier_id,
    supplier: {
      id: po.supplier?.id || "",
      name: po.supplier?.name || ""
    },
    currency: po.currency,
    payment_terms: po.payment_terms || "",
    incoterms: po.incoterms || ""
  }));

  // Append the invoice's linked PO if it isn't already present in the list
  const hasCurrentPo = formattedPos.some(po => po.id === invoice.purchase_order_id);
  if (!hasCurrentPo && invoice.po) {
    formattedPos.push({
      id: invoice.purchase_order_id,
      po_number: invoice.po.po_number,
      supplier_id: invoice.supplier_company_id,
      supplier: {
        id: invoice.supplier_company_id,
        name: invoice.supplier?.name || ""
      },
      currency: invoice.currency,
      payment_terms: invoice.payment_terms_snapshot || "",
      incoterms: invoice.incoterms_snapshot || ""
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-955 dark:text-white">인보이스 수정 (Edit Supplier Invoice)</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400">
          초안 혹은 반려된 인보이스의 기입 내역을 보정하여 승인을 위해 재제출할 수 있습니다.
        </p>
      </div>

      <InvoiceForm
        invoice={invoice}
        eligiblePos={formattedPos}
        suppliers={formattedSuppliers}
      />
    </div>
  );
}
