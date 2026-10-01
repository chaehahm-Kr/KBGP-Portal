"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  PoRequestDetail,
  PoRequestStatus,
  PO_REQUEST_STATUS_LABELS_KO,
  PO_REQUEST_STATUS_COLORS,
} from "@/lib/purchase-order/request-types";
import { formatEasternDate } from "@/lib/utils/timezone";

interface PoRequestListProps {
  requests: PoRequestDetail[];
  companyName: string;
}

export function PoRequestList({ requests, companyName }: PoRequestListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filteredRequests = requests.filter((r) => {
    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      r.request_number.toLowerCase().includes(term) ||
      (r.converted_po_number || "").toLowerCase().includes(term) ||
      (r.contact_name || "").toLowerCase().includes(term) ||
      r.lines.some(
        (l) =>
          l.product_name_snapshot.toLowerCase().includes(term) ||
          (l.letusto_sku_snapshot || "").toLowerCase().includes(term)
      );

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header with CTA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-950 dark:text-white">발주 요청 (PO Requests)</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Letusto 본사에 정식 발주서 생성을 제안·요청하는 워크스페이스입니다. 검토 후 공식 PO로 전환됩니다.
          </p>
        </div>

        <Link
          href="/portal/orders/requests/new"
          className="px-4 py-2.5 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
        >
          <span>+ 새 발주 요청 작성</span>
        </Link>
      </div>

      {/* Non-binding Pricing Notice Banner */}
      <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 dark:bg-blue-950/20 dark:border-blue-900/50 flex items-center gap-3 text-xs text-blue-800 dark:text-blue-300">
        <span className="text-base">ℹ️</span>
        <div className="flex-1">
          <strong className="font-bold">안내:</strong> 발주 요청서의 가격은 상품 마스터 기준 예상 참고 가격(Reference FOB)이며,{" "}
          <span className="underline font-semibold">최종 발주 가격 및 수량은 Letusto 검토 후 확정됩니다.</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col sm:flex-row gap-3 items-center justify-between text-xs">
        <div className="flex-1 w-full sm:w-auto">
          <input
            type="text"
            placeholder="요청 번호, PO 번호, 제품명, SKU 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 p-2 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400 text-xs"
          />
        </div>

        <div className="w-full sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 p-2 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none text-xs font-medium"
          >
            <option value="ALL">전체 상태 ({requests.length})</option>
            <option value="DRAFT">작성 중 (DRAFT)</option>
            <option value="SUBMITTED">제출 완료 (SUBMITTED)</option>
            <option value="UNDER_REVIEW">검토 중 (UNDER REVIEW)</option>
            <option value="CHANGE_REQUESTED">수정 요청 (CHANGE REQUESTED)</option>
            <option value="CONVERTED_TO_PO">PO 전환 완료 (CONVERTED)</option>
            <option value="REJECTED">반려 (REJECTED)</option>
            <option value="CANCELLED">취소됨 (CANCELLED)</option>
          </select>
        </div>
      </div>

      {/* Request List Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-150 bg-zinc-50/70 text-zinc-500 font-bold dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                <th className="px-4 py-3.5">요청 번호</th>
                <th className="px-4 py-3.5">요청일자</th>
                <th className="px-4 py-3.5 text-center">제품 품목수</th>
                <th className="px-4 py-3.5 text-right">총 요청 수량</th>
                <th className="px-4 py-3.5 text-right">예상 참고 금액</th>
                <th className="px-4 py-3.5">희망 Ready Date</th>
                <th className="px-4 py-3.5 text-center">상태</th>
                <th className="px-4 py-3.5">연결된 PO 번호</th>
                <th className="px-4 py-3.5 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredRequests.map((req) => (
                <tr key={req.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/20 transition-colors">
                  {/* Request Number */}
                  <td className="px-4 py-3.5 font-mono font-bold text-zinc-950 dark:text-white">
                    <Link
                      href={`/portal/orders/requests/${req.id}`}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                    >
                      {req.request_number}
                    </Link>
                  </td>

                  {/* Request Date */}
                  <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400">
                    {req.submitted_at ? formatEasternDate(req.submitted_at) : formatEasternDate(req.created_at)}
                  </td>

                  {/* Product Count */}
                  <td className="px-4 py-3.5 text-center font-mono font-medium text-zinc-800 dark:text-zinc-300">
                    {req.lines.length}개
                  </td>

                  {/* Total Requested Qty */}
                  <td className="px-4 py-3.5 text-right font-mono font-bold text-zinc-900 dark:text-white">
                    {req.total_requested_qty.toLocaleString()}
                  </td>

                  {/* Estimated Amount */}
                  <td className="px-4 py-3.5 text-right font-mono font-bold text-zinc-700 dark:text-zinc-300">
                    ${req.total_estimated_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* Ready Date */}
                  <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400">
                    {req.requested_ready_date || "-"}
                  </td>

                  {/* Status Badge */}
                  <td className="px-4 py-3.5 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                        PO_REQUEST_STATUS_COLORS[req.status] || "bg-zinc-100 text-zinc-700 border-zinc-200"
                      }`}
                    >
                      {PO_REQUEST_STATUS_LABELS_KO[req.status] || req.status}
                    </span>
                  </td>

                  {/* Converted PO Link */}
                  <td className="px-4 py-3.5">
                    {req.converted_po_id && req.converted_po_number ? (
                      <Link
                        href={`/portal/orders/purchase-orders/${req.converted_po_id}`}
                        className="font-mono font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>📄 {req.converted_po_number}</span>
                      </Link>
                    ) : (
                      <span className="text-zinc-400 text-[11px]">-</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        href={`/portal/orders/requests/${req.id}`}
                        className="px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-[11px] transition-colors"
                      >
                        상세보기
                      </Link>
                      {(req.status === "DRAFT" || req.status === "CHANGE_REQUESTED") && (
                        <Link
                          href={`/portal/orders/requests/${req.id}/edit`}
                          className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold text-[11px] transition-colors"
                        >
                          수정
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center p-8 text-zinc-400 font-semibold">
                    조회된 발주 요청 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
