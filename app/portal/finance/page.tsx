import React from "react";
import { getPortalInvoices, getPortalAdjustments, getPortalPayments } from "@/lib/portal/actions";
import { FinanceClient } from "@/components/portal/finance-client";

export default async function PortalFinancePage() {
  const invoices = await getPortalInvoices();
  const adjustments = await getPortalAdjustments();
  const payments = await getPortalPayments();

  return (
    <div className="w-full max-w-7xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">정산 관리 (Finance & Invoices)</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          청구 인보이스를 발행하고 정산 금액 조정 및 지급 완료 내역을 추적합니다.
        </p>
      </div>

      <FinanceClient
        initialInvoices={invoices}
        initialAdjustments={adjustments}
        initialPayments={payments}
      />
    </div>
  );
}
