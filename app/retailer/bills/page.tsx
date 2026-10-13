import React from "react";
import type { Metadata } from "next";
import { verifyRetailerSession, getRetailerUserContext } from "@/lib/auth/dal";
import { getRetailerBillsAction } from "@/lib/retailer/bill-actions";
import { resolveEffectivePaymentPolicy } from "@/lib/retailer/payment-policy-server";
import { RetailerBillsManager } from "@/components/retailer/bills-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bills & Payments | K SELECT HUB Retailer",
  description: "View outstanding invoices, due dates, accounts receivable balances, and pay store bills.",
};

export default async function RetailerBillsPage() {
  await verifyRetailerSession();
  const userContext = await getRetailerUserContext();
  const billsRes = await getRetailerBillsAction();

  const effectivePolicy = userContext.companyId
    ? await resolveEffectivePaymentPolicy(userContext.companyId)
    : null;

  const initialFeed = billsRes.data || {
    summary: {
      companyId: userContext.companyId || "",
      openAR: 0,
      pastDueAmount: 0,
      dueSoonAmount: 0,
      openInvoiceCount: 0,
      pastDueInvoiceCount: 0,
      hasPastDue: false,
      creditLimit: 0,
      availableCredit: 0,
    },
    invoices: [],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Bills & Payments
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Review your store invoice ledger, payment due dates, and settle outstanding balances.
          </p>
        </div>
      </div>

      {/* Main Bills Manager Component */}
      <RetailerBillsManager
        initialFeed={initialFeed}
        effectivePolicy={effectivePolicy}
      />
    </div>
  );
}
