import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getEligiblePurchaseOrders } from "@/lib/supplier-invoice/actions";
import { getSuppliersForPo } from "@/lib/purchase-order/actions";
import { InvoiceForm } from "@/components/admin/invoice-form";

export const metadata: Metadata = {
  title: "신규 공급사 인보이스 등록 | K SELECT NETWORK 어드민",
};

export default async function NewInvoicePage() {
  await verifyAdminSession();

  // 1. Fetch eligible POs (status = 'SENT')
  const eligiblePos = await getEligiblePurchaseOrders();

  // 2. Fetch suppliers
  const suppliers = await getSuppliersForPo();

  const formattedSuppliers = suppliers.map((s: any) => ({
    id: s.company_id,
    name: s.supplier_name
  }));

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-955 dark:text-white">신규 공급사 인보이스 등록 (New Supplier Invoice)</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400">
          공급업체가 발행한 송장 내역(FOB 단가, 세액, 기타 수수료)을 수동으로 기입하여 외상 대금을 매칭합니다.
        </p>
      </div>

      <InvoiceForm
        eligiblePos={formattedPos}
        suppliers={formattedSuppliers}
      />
    </div>
  );
}
