import React from "react";
import { getPortalInvoices, getPortalAdjustments, getPortalPayments } from "@/lib/portal/actions";
import { FinanceClient } from "@/components/portal/finance-client";
import { hasPortalPermission } from "@/lib/company/permissions";
import { AccessDeniedView } from "@/components/portal/access-denied";

export default async function PortalFinancePage() {
  const canRead = await hasPortalPermission("finance", "read");
  if (!canRead) {
    return (
      <AccessDeniedView
        title="접근 권한이 없습니다."
        message="정산 / 인보이스 메뉴를 이용할 권한이 없습니다. 권한 조정을 원하시면 회사 관리자에게 문의해주세요."
      />
    );
  }

  const invoices = await getPortalInvoices();
  const adjustments = await getPortalAdjustments();
  const payments = await getPortalPayments();

  return (
    <div className="w-full max-w-7xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">정산 관리 (Finance & Invoices)</h1>
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
