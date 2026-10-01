"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cancelPoRequest } from "@/lib/purchase-order/request-actions";
import {
  PoRequestDetail,
  PO_REQUEST_STATUS_LABELS_KO,
  PO_REQUEST_STATUS_COLORS,
} from "@/lib/purchase-order/request-types";
import { formatEasternDate, formatEasternDateTime } from "@/lib/utils/timezone";

interface PoRequestDetailViewProps {
  request: PoRequestDetail;
}

export function PoRequestDetailView({ request }: PoRequestDetailViewProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const handleCancel = async () => {
    if (!confirm("이 발주 요청을 취소하시겠습니까? 취소 후에는 수정할 수 없습니다.")) {
      return;
    }

    setCancelError("");
    setIsCancelling(true);
    try {
      await cancelPoRequest(request.id);
      router.refresh();
    } catch (err: any) {
      setCancelError(err.message || "취소 처리 중 오류가 발생했습니다.");
    } finally {
      setIsCancelling(false);
    }
  };

  const stages = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "CONVERTED_TO_PO"];
  const stageLabels = ["작성 중", "제출 완료", "검토 중", "PO 전환 완료"];
  const currentStageIdx = stages.indexOf(request.status);

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/portal/orders/requests"
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              ← 발주 요청 목록
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
              {request.request_number}
            </span>
          </div>
          <h1 className="text-xl font-bold text-zinc-950 dark:text-white flex items-center gap-3">
            <span>발주 요청 상세</span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                PO_REQUEST_STATUS_COLORS[request.status]
              }`}
            >
              {PO_REQUEST_STATUS_LABELS_KO[request.status] || request.status}
            </span>
          </h1>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2.5">
          {(request.status === "DRAFT" || request.status === "CHANGE_REQUESTED") && (
            <Link
              href={`/portal/orders/requests/${request.id}/edit`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              요청서 수정하기
            </Link>
          )}

          {request.status === "CONVERTED_TO_PO" && request.converted_po_id && (
            <Link
              href={`/portal/orders/purchase-orders/${request.converted_po_id}`}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>📄 공식 발주서 보기 ({request.converted_po_number})</span>
            </Link>
          )}

          {request.status !== "CONVERTED_TO_PO" && request.status !== "CANCELLED" && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="px-3.5 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 transition-all cursor-pointer"
            >
              {isCancelling ? "취소 중..." : "요청 취소"}
            </button>
          )}
        </div>
      </div>

      {cancelError && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 font-bold text-xs">
          ⚠️ {cancelError}
        </div>
      )}

      {/* Special Status Banners */}
      {request.status === "CHANGE_REQUESTED" && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 dark:bg-amber-950/30 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm">
              <span>⚠️ 본사에서 수정을 요청하였습니다.</span>
            </div>
            <Link
              href={`/portal/orders/requests/${request.id}/edit`}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-all"
            >
              수정 후 재제출
            </Link>
          </div>
          <p className="p-3 bg-white/80 dark:bg-zinc-900/80 rounded-lg border border-amber-200 dark:border-amber-900/60 font-medium">
            <strong>수정 요청 사유:</strong> {request.change_request_reason || "세부 사유는 담당자에게 문의 바랍니다."}
          </p>
        </div>
      )}

      {request.status === "CONVERTED_TO_PO" && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">🎉</span>
            <div>
              <p className="font-bold text-sm">정식 발주서(PO)로 전환 완료되었습니다.</p>
              <p className="text-zinc-600 dark:text-zinc-400">
                발주 번호: <strong>{request.converted_po_number}</strong> · 전환 일시:{" "}
                {request.converted_at ? formatEasternDateTime(request.converted_at) : "-"}
              </p>
            </div>
          </div>
          {request.converted_po_id && (
            <Link
              href={`/portal/orders/purchase-orders/${request.converted_po_id}`}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm whitespace-nowrap"
            >
              발주서(PO) 바로가기 →
            </Link>
          )}
        </div>
      )}

      {request.status === "REJECTED" && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 dark:bg-rose-950/30 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 space-y-1.5">
          <p className="font-bold text-sm">❌ 발주 요청이 반려되었습니다.</p>
          <p className="p-3 bg-white/80 dark:bg-zinc-900/80 rounded-lg border border-rose-200 dark:border-rose-900/60 font-medium">
            <strong>반려 사유:</strong> {request.rejection_reason || "반려 사유가 등록되지 않았습니다."}
          </p>
        </div>
      )}

      {/* Lifecycle Progress Stepper (if in normal progression) */}
      {currentStageIdx >= 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex justify-between items-center w-full">
            {stages.map((stg, idx) => {
              const isPastOrCurrent = idx <= currentStageIdx;
              const isCurrent = idx === currentStageIdx;
              return (
                <div key={stg} className="flex-1 flex flex-col items-center relative">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border-2 z-10 ${
                      isCurrent
                        ? "bg-blue-600 border-blue-600 text-white shadow-md ring-4 ring-blue-100 dark:ring-blue-950"
                        : isPastOrCurrent
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-zinc-300 text-zinc-400 dark:bg-zinc-900 dark:border-zinc-700"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <span
                    className={`mt-2 text-[11px] font-bold ${
                      isCurrent ? "text-blue-600" : isPastOrCurrent ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-400"
                    }`}
                  >
                    {stageLabels[idx]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        {/* Left 2 Cols: Request Details & Product Lines */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request Header Summary */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
              발주 요청 기본 정보
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">요청 번호</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white">{request.request_number}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">요청 일시</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {request.submitted_at ? formatEasternDateTime(request.submitted_at) : formatEasternDate(request.created_at)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">희망 생산 완료일 (Ready Date)</span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {request.requested_ready_date || "미지정"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">출고지 창고 (Shipping Origin)</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {request.shipping_origin_name || "등록 출고지"}
                  {request.shipping_origin_address ? ` (${request.shipping_origin_address})` : ""}
                </span>
              </div>
            </div>

            {request.notes && (
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-400 block mb-1">요청 전달 메모</span>
                <p className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-150 dark:border-zinc-850">
                  {request.notes}
                </p>
              </div>
            )}
          </div>

          {/* Product Lines */}
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-0">
            <div className="px-5 py-3.5 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/20">
              <h3 className="font-bold text-zinc-900 dark:text-white">요청 품목 리스트 ({request.lines.length}건)</h3>
              <span className="text-[11px] text-zinc-500 font-mono">
                총 {request.total_requested_qty.toLocaleString()}개 · 예상 ${request.total_estimated_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-150 bg-zinc-50/80 text-zinc-500 font-bold dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                    <th className="px-4 py-3">제품명</th>
                    <th className="px-4 py-3 font-mono">Letusto SKU</th>
                    <th className="px-4 py-3 font-mono">제조사 SKU</th>
                    <th className="px-4 py-3 text-right">요청 수량</th>
                    <th className="px-4 py-3 text-right">참고 FOB 단가</th>
                    <th className="px-4 py-3 text-right">예상 금액</th>
                    <th className="px-4 py-3">메모</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {request.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/20">
                      <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white max-w-xs truncate">
                        {line.product_name_snapshot}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-800 dark:text-zinc-300">
                        {line.letusto_sku_snapshot || "-"}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-500">
                        {line.manufacture_sku_snapshot || "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                        {line.requested_qty.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        ${line.reference_unit_cost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                        ${line.estimated_line_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 max-w-xs truncate">
                        {line.line_note || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Non-binding Pricing Footer Note */}
            <div className="p-3 bg-zinc-50/60 border-t border-zinc-150 dark:bg-zinc-950/40 dark:border-zinc-800 text-[11px] text-zinc-500 flex justify-between items-center">
              <span>※ 표시된 단가는 예상 참고 가격이며, 최종 PO 전환 시 확정 단가로 정산됩니다.</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white">
                합계: ${request.total_estimated_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Right Col: Contact Profile & Audit History */}
        <div className="lg:col-span-1 space-y-6">
          {/* Contact Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
              요청 담당자 정보
            </h3>
            <div className="space-y-2">
              <div>
                <span className="text-[10px] text-zinc-400 block">담당자명</span>
                <span className="font-bold text-zinc-900 dark:text-white">{request.contact_name || "미지정"}</span>
              </div>
              {request.contact_email && (
                <div>
                  <span className="text-[10px] text-zinc-400 block">이메일</span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">{request.contact_email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Audit History Log */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
              진행 이력 (History Log)
            </h3>
            <div className="space-y-3">
              {request.history.map((h, i) => (
                <div key={h.id || i} className="border-l-2 border-blue-500 pl-3 py-0.5 space-y-0.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{h.action}</span>
                    <span className="text-zinc-400">{formatEasternDateTime(h.created_at)}</span>
                  </div>
                  {h.notes && <p className="text-[11px] text-zinc-600 dark:text-zinc-400">{h.notes}</p>}
                  <span className="text-[9px] text-zinc-400 font-mono">{h.actor_name} ({h.actor_role})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
