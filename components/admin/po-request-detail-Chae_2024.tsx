"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startReviewPoRequest,
  requestChangesPoRequest,
  rejectPoRequest,
  updateAdminRequestAdjustments,
} from "@/lib/purchase-order/request-actions";
import {
  PoRequestDetail,
  PO_REQUEST_STATUS_LABELS_EN,
  PO_REQUEST_STATUS_COLORS,
} from "@/lib/purchase-order/request-types";
import { formatEasternDate, formatEasternDateTime } from "@/lib/utils/timezone";

interface AdminPoRequestDetailViewProps {
  request: PoRequestDetail;
}

export function AdminPoRequestDetailView({ request }: AdminPoRequestDetailViewProps) {
  const router = useRouter();

  // Line item adjustments state
  const [lineAdjustments, setLineAdjustments] = useState(() =>
    request.lines.map((l) => ({
      id: l.id,
      admin_final_qty: l.admin_final_qty !== null ? l.admin_final_qty : l.requested_qty,
      admin_final_unit_cost: l.admin_final_unit_cost !== null ? l.admin_final_unit_cost : l.reference_unit_cost,
    }))
  );

  const [isSavingAdjustments, setIsSavingAdjustments] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Modal states
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleQtyChange = (lineId: string, val: number) => {
    setLineAdjustments((prev) =>
      prev.map((a) => (a.id === lineId ? { ...a, admin_final_qty: Math.max(1, val) } : a))
    );
  };

  const handleCostChange = (lineId: string, val: number) => {
    setLineAdjustments((prev) =>
      prev.map((a) => (a.id === lineId ? { ...a, admin_final_unit_cost: Math.max(0, val) } : a))
    );
  };

  const handleSaveAdjustments = async () => {
    setActionError("");
    setActionSuccess("");
    setIsSavingAdjustments(true);
    try {
      await updateAdminRequestAdjustments(request.id, lineAdjustments);
      setActionSuccess("Admin Final Quantities & Pricing adjustments saved successfully.");
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to save adjustments.");
    } finally {
      setIsSavingAdjustments(false);
    }
  };

  const handleStartReview = async () => {
    setActionError("");
    setActionSuccess("");
    setIsActionLoading(true);
    try {
      await startReviewPoRequest(request.id);
      setActionSuccess("Request status updated to Under Review.");
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to start review.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRequestChangesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError("");
    setActionSuccess("");
    setIsActionLoading(true);
    try {
      await requestChangesPoRequest(request.id, changeReason);
      setIsChangeModalOpen(false);
      setActionSuccess("Change request sent to partner portal.");
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to submit change request.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError("");
    setActionSuccess("");
    setIsActionLoading(true);
    try {
      await rejectPoRequest(request.id, rejectReason);
      setIsRejectModalOpen(false);
      setActionSuccess("PO Request has been rejected.");
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to reject request.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const totalAdminQty = lineAdjustments.reduce((sum, a) => sum + a.admin_final_qty, 0);
  const totalAdminAmount = lineAdjustments.reduce(
    (sum, a) => sum + a.admin_final_qty * a.admin_final_unit_cost,
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/purchasing/requests"
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              ← PO Requests
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
              {request.request_number}
            </span>
          </div>
          <h1 className="text-xl font-bold text-zinc-950 dark:text-white flex items-center gap-3">
            <span>PO Request Review</span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                PO_REQUEST_STATUS_COLORS[request.status]
              }`}
            >
              {PO_REQUEST_STATUS_LABELS_EN[request.status] || request.status}
            </span>
          </h1>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {request.status === "SUBMITTED" && (
            <button
              type="button"
              onClick={handleStartReview}
              disabled={isActionLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              {isActionLoading ? "Processing..." : "Start Review"}
            </button>
          )}

          {request.status !== "CONVERTED_TO_PO" && request.status !== "CANCELLED" && request.status !== "REJECTED" && (
            <>
              <button
                type="button"
                onClick={() => setIsChangeModalOpen(true)}
                disabled={isActionLoading}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Request Changes
              </button>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(true)}
                disabled={isActionLoading}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Reject
              </button>
              <Link
                href={`/admin/purchasing/new?request_id=${request.id}`}
                className="px-5 py-2 bg-zinc-950 hover:bg-zinc-850 text-white dark:bg-white dark:text-zinc-950 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <span>⚡ Convert to PO</span>
              </Link>
            </>
          )}

          {request.status === "CONVERTED_TO_PO" && request.converted_po_id && (
            <Link
              href={`/admin/purchasing/${request.converted_po_id}`}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>📄 Official PO #{request.converted_po_number}</span>
            </Link>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 font-bold text-xs">
          ⚠️ {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs">
          ✅ {actionSuccess}
        </div>
      )}

      {/* Request Information Summary */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4 text-xs">
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
          Request Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <span className="text-[10px] text-zinc-400 block mb-0.5">Supplier Company</span>
            <span className="font-bold text-zinc-900 dark:text-white text-sm">{request.company_name}</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 block mb-0.5">Contact Person</span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {request.contact_name || "-"} {request.contact_email ? `(${request.contact_email})` : ""}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 block mb-0.5">Shipping Origin</span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {request.shipping_origin_name || "Not specified"}
              {request.shipping_origin_address ? ` (${request.shipping_origin_address})` : ""}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 block mb-0.5">Requested Ready Date</span>
            <span className="font-semibold text-zinc-900 dark:text-white">
              {request.requested_ready_date || "Not set"}
            </span>
          </div>
        </div>

        {request.notes && (
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] text-zinc-400 block mb-1">Partner Request Notes</span>
            <p className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-850 text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
              {request.notes}
            </p>
          </div>
        )}

        {request.change_request_reason && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200">
            <strong className="block mb-0.5">Current Change Request Reason:</strong>
            {request.change_request_reason}
          </div>
        )}

        {request.rejection_reason && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200">
            <strong className="block mb-0.5">Rejection Reason:</strong>
            {request.rejection_reason}
          </div>
        )}
      </div>

      {/* Product Lines Review & Adjustment Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="p-5 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/20">
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-white text-sm">Product Lines Review & Finalization</h3>
            <p className="text-[11px] text-zinc-500">
              Portal 원본 요청값(Requested)과 Admin 최종 확정값(Final)을 검토 및 조정할 수 있습니다.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveAdjustments}
            disabled={isSavingAdjustments || request.status === "CONVERTED_TO_PO"}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 rounded-lg font-bold text-xs transition-all disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {isSavingAdjustments ? "Saving..." : "Save Adjustments"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-500 font-bold dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                <th className="px-3.5 py-3">Product Name</th>
                <th className="px-3.5 py-3 font-mono">Letusto SKU</th>
                <th className="px-3.5 py-3 font-mono">Supplier SKU</th>
                <th className="px-3.5 py-3 text-right bg-blue-50/30 dark:bg-blue-950/10 border-l border-zinc-200 dark:border-zinc-800">
                  Req. Qty
                </th>
                <th className="px-3.5 py-3 text-right bg-blue-50/30 dark:bg-blue-950/10">Ref FOB</th>
                <th className="px-3.5 py-3 text-right bg-blue-50/30 dark:bg-blue-950/10">Est. Total</th>
                <th className="px-3.5 py-3 w-28 text-right bg-emerald-50/30 dark:bg-emerald-950/10 border-l border-zinc-200 dark:border-zinc-800">
                  Final Qty *
                </th>
                <th className="px-3.5 py-3 w-32 text-right bg-emerald-50/30 dark:bg-emerald-950/10">
                  Final FOB ($) *
                </th>
                <th className="px-3.5 py-3 text-right bg-emerald-50/30 dark:bg-emerald-950/10 font-bold">
                  Final Total
                </th>
                <th className="px-3.5 py-3">Line Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {request.lines.map((line) => {
                const adj = lineAdjustments.find((a) => a.id === line.id) || {
                  admin_final_qty: line.requested_qty,
                  admin_final_unit_cost: line.reference_unit_cost,
                };
                const lineFinalTotal = adj.admin_final_qty * adj.admin_final_unit_cost;

                return (
                  <tr key={line.id} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-850/10">
                    {/* Product Name */}
                    <td className="px-3.5 py-3 font-bold text-zinc-900 dark:text-white max-w-xs truncate">
                      {line.product_name_snapshot}
                    </td>

                    {/* Letusto SKU */}
                    <td className="px-3.5 py-3 font-mono font-bold text-zinc-800 dark:text-zinc-200">
                      {line.letusto_sku_snapshot || "-"}
                    </td>

                    {/* Supplier SKU */}
                    <td className="px-3.5 py-3 font-mono text-zinc-500">
                      {line.manufacture_sku_snapshot || "-"}
                    </td>

                    {/* Requested Qty */}
                    <td className="px-3.5 py-3 text-right font-mono text-zinc-700 dark:text-zinc-300 bg-blue-50/20 dark:bg-blue-950/5 border-l border-zinc-150 dark:border-zinc-850">
                      {line.requested_qty.toLocaleString()}
                    </td>

                    {/* Reference FOB */}
                    <td className="px-3.5 py-3 text-right font-mono text-zinc-600 dark:text-zinc-400 bg-blue-50/20 dark:bg-blue-950/5">
                      ${line.reference_unit_cost.toFixed(2)}
                    </td>

                    {/* Est. Total */}
                    <td className="px-3.5 py-3 text-right font-mono text-zinc-600 dark:text-zinc-400 bg-blue-50/20 dark:bg-blue-950/5">
                      ${line.estimated_line_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Admin Final Qty Input */}
                    <td className="px-3.5 py-3 text-right bg-emerald-50/20 dark:bg-emerald-950/5 border-l border-zinc-150 dark:border-zinc-850">
                      <input
                        type="number"
                        min="1"
                        disabled={request.status === "CONVERTED_TO_PO"}
                        value={adj.admin_final_qty}
                        onChange={(e) => handleQtyChange(line.id, parseInt(e.target.value) || 0)}
                        className="w-full text-right font-mono font-bold rounded border border-zinc-200 p-1.5 dark:border-zinc-750 dark:bg-zinc-950 dark:text-white"
                      />
                    </td>

                    {/* Admin Final Unit Cost Input */}
                    <td className="px-3.5 py-3 text-right bg-emerald-50/20 dark:bg-emerald-950/5">
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        disabled={request.status === "CONVERTED_TO_PO"}
                        value={adj.admin_final_unit_cost}
                        onChange={(e) => handleCostChange(line.id, parseFloat(e.target.value) || 0)}
                        className="w-full text-right font-mono font-bold rounded border border-zinc-200 p-1.5 dark:border-zinc-750 dark:bg-zinc-950 dark:text-white"
                      />
                    </td>

                    {/* Admin Final Line Total */}
                    <td className="px-3.5 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/5">
                      ${lineFinalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Line Note */}
                    <td className="px-3.5 py-3 text-zinc-500 max-w-xs truncate">
                      {line.line_note || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Aggregation Summary Strip */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-[10px] text-zinc-400 block uppercase">Requested Total Qty</span>
              <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">
                {request.total_requested_qty.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block uppercase">Requested Est. Amount</span>
              <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">
                ${request.total_estimated_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block uppercase font-bold">
                Admin Final Qty
              </span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white text-sm">
                {totalAdminQty.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block uppercase font-bold">
                Admin Final PO Amount
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                ${totalAdminAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* History Log */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4 text-xs">
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
          Audit History Trail
        </h3>
        <div className="space-y-3">
          {request.history.map((h, i) => (
            <div key={h.id || i} className="border-l-2 border-indigo-500 pl-3 py-1 space-y-0.5">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-bold text-zinc-900 dark:text-white">{h.action}</span>
                <span className="text-zinc-400">{formatEasternDateTime(h.created_at)}</span>
              </div>
              {h.notes && <p className="text-zinc-700 dark:text-zinc-300">{h.notes}</p>}
              <span className="text-[9px] text-zinc-400 font-mono">{h.actor_name} ({h.actor_role})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Request Changes Modal */}
      {isChangeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-xs">
          <form
            onSubmit={handleRequestChangesSubmit}
            className="w-full max-w-lg rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-6 space-y-4"
          >
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">파트너사 수정 요청 (Request Changes)</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs">
              파트너사에 전달할 수정 요청 사유 및 변경 가이드를 입력해 주세요. 요청서 상태가 CHANGE_REQUESTED로 변경되며 파트너사에서 수정할 수 있게 됩니다.
            </p>

            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">수정 요청 사유 *</label>
              <textarea
                placeholder="예: MOQ 미달 품목이 포함되어 있습니다. 최소 주문 수량을 200개 이상으로 조정해 주세요..."
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 p-3 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none min-h-[100px]"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsChangeModalOpen(false)}
                className="px-4 py-2 border border-zinc-200 rounded-lg font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isActionLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold disabled:opacity-50"
              >
                {isActionLoading ? "Sending..." : "Submit Change Request"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-xs">
          <form
            onSubmit={handleRejectSubmit}
            className="w-full max-w-lg rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-6 space-y-4"
          >
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">발주 요청 반려 (Reject PO Request)</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs">
              발주 요청을 반려 처리합니다. 파트너사에 표시될 반려 사유를 입력해 주세요.
            </p>

            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">반려 사유 *</label>
              <textarea
                placeholder="예: 현재 해당 제품의 재고 소진 및 단종 계획으로 인해 발주 진행이 불가합니다..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 p-3 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none min-h-[100px]"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 border border-zinc-200 rounded-lg font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isActionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold disabled:opacity-50"
              >
                {isActionLoading ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
