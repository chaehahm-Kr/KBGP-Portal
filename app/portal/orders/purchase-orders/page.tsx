import type { Metadata } from "next";
import Link from "next/link";
import { getPortalPurchaseOrders } from "@/lib/portal/actions";

export const metadata: Metadata = {
  title: "발주 관리 | 파트너 포털",
};

export default async function PortalPurchaseOrdersPage() {
  const pos = await getPortalPurchaseOrders();

  // Helper for formatting date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // Status mapping and badge helper
  const getPoStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">초안</span>;
      case "ISSUED":
        return <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">발행됨</span>;
      case "IN_TRANSIT":
        return <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">운송중</span>;
      case "DELIVERED":
        return <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-700/10">입고완료</span>;
      case "CANCELLED":
        return <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700">취소됨</span>;
      default:
        return <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">{status}</span>;
    }
  };

  const getConfirmationBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-650/10">대기 중</span>;
      case "CHANGE_REQUESTED":
        return <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">변경 요청됨</span>;
      case "CONFIRMED":
        return <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">확인 완료</span>;
      default:
        return <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">{status}</span>;
    }
  };

  return (
    <div className="w-full max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">발주 관리</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Letusto에서 발행한 발주서(PO) 목록입니다. 발주 수량을 검토하고 확인 및 변경 요청을 진행해 주세요.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <th className="px-6 py-4">발주 번호</th>
                <th className="px-6 py-4">발주 일자</th>
                <th className="px-6 py-4">진행 상태</th>
                <th className="px-6 py-4">공급사 확인</th>
                <th className="px-6 py-4 text-right">총 주문 수량</th>
                <th className="px-6 py-4 text-right">총 확정 수량</th>
                <th className="px-6 py-4 text-center">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {pos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
                    등록된 발주서가 없습니다.
                  </td>
                </tr>
              ) : (
                pos.map((po: any) => {
                  const lines = po.lines || [];
                  const totalOrdered = lines.reduce((sum: number, l: any) => sum + (l.qty || 0), 0);
                  const isAllConfirmed = lines.every((l: any) => l.confirmed_qty !== null);
                  const totalConfirmed = isAllConfirmed
                    ? lines.reduce((sum: number, l: any) => sum + (l.confirmed_qty || 0), 0)
                    : null;

                  return (
                    <tr
                      key={po.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono font-medium text-zinc-900 dark:text-white">
                        {po.po_number}
                      </td>
                      <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                        {formatDate(po.order_date)}
                      </td>
                      <td className="px-6 py-4">
                        {getPoStatusBadge(po.po_status)}
                      </td>
                      <td className="px-6 py-4">
                        {getConfirmationBadge(po.supplier_confirmation_status)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-zinc-700 dark:text-zinc-300">
                        {totalOrdered.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {totalConfirmed !== null ? (
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {totalConfirmed.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Link
                          href={`/portal/orders/purchase-orders/${po.id}`}
                          className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-white dark:ring-zinc-700 dark:hover:bg-zinc-800"
                        >
                          상세 보기
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
