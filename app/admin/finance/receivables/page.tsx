import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import {
  getAdminInvoicesAction,
  getGlobalARSummary,
  getEligibleOrdersForInvoicingAction,
} from "@/lib/finance/invoice-actions";
import { InvoicesReceivablesManager } from "@/components/admin/invoices-receivables-manager";

export const metadata: Metadata = {
  title: "Invoices & Accounts Receivable (AR) | K SELECT NETWORK Admin",
};

export default async function AdminReceivablesPage() {
  await verifyAdminSession();

  const [invoicesRes, summary, eligibleOrdersRes] = await Promise.all([
    getAdminInvoicesAction(),
    getGlobalARSummary(),
    getEligibleOrdersForInvoicingAction(),
  ]);

  return (
    <div className="w-full space-y-6">
      <InvoicesReceivablesManager
        initialInvoices={invoicesRes.invoices}
        initialSummary={summary}
        eligibleOrders={eligibleOrdersRes.orders}
      />
    </div>
  );
}
