"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmPortalPurchaseOrder,
  submitPortalPoChangeRequest,
  withdrawPortalPoChangeRequest
} from "@/lib/portal/actions";

interface PoLine {
  id: string;
  qty: number;
  confirmed_qty: number | null;
  unit_cost: number;
  line_note: string | null;
  product: {
    id: string;
    name: string;
    letusto_sku: string;
    manufacture_sku: string;
  };
}

interface ChangeRequest {
  id: string;
  purchaseOrderLineId: string;
  requestType: "QUANTITY" | "PRICE" | "OTHER";
  originalQty: number;
  proposedQty: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  reviewerName: string | null;
}

interface PoDetailClientProps {
  po: {
    id: string;
    po_number: string;
    po_status: string;
    fulfillment_status: string;
    supplier_confirmation_status: string;
    order_date: string;
    currency: string;
    created_at: string;
    lines: PoLine[];
  };
  changeRequests: ChangeRequest[];
}

export default function PoDetailClient({ po, changeRequests }: PoDetailClientProps) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isChangeFormOpen, setIsChangeFormOpen] = useState(false);
  const [isSubmittingChange, setIsSubmittingChange] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState<string | null>(null);
  
  // State for proposed line quantities and reasons
  const [proposedQties, setProposedQties] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    po.lines.forEach(l => {
      initial[l.id] = l.confirmed_qty ?? l.qty;
    });
    return initial;
  });
  
  const [reasons, setReasons] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    po.lines.forEach(l => {
      initial[l.id] = "";
    });
    return initial;
  });

  const [generalError, setGeneralError] = useState<string | null>(null);

  // Totals calculations
  const totalOrdered = po.lines.reduce((sum, l) => sum + l.qty, 0);
  const totalConfirmed = po.lines.every(l => l.confirmed_qty !== null)
    ? po.lines.reduce((sum, l) => sum + (l.confirmed_qty || 0), 0)
    : null;

  // Handle Confirm PO
  const handleConfirm = async () => {
    if (!window.confirm("발주 항목 수량을 그대로 수락하고 확인하시겠습니까?")) return;
    setIsConfirming(true);
    setGeneralError(null);
    try {
      await confirmPortalPurchaseOrder(po.id);
      router.refresh();
    } catch (err: any) {
      setGeneralError(err.message || "확인 처리 중 오류가 발생했습니다.");
    } finally {
      setIsConfirming(false);
    }
  };

  // Handle Submit Change Request
  const handleSubmitChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Filter lines that have differences
    const requests = po.lines
      .map(l => ({
        lineId: l.id,
        proposedQty: proposedQties[l.id],
        reason: reasons[l.id].trim()
      }))
      .filter(req => {
        const origLine = po.lines.find(l => l.id === req.lineId);
        return origLine && req.proposedQty !== origLine.qty;
      });

    if (requests.length === 0) {
      alert("변경된 수량이 존재하지 않습니다. 수량을 변경한 후 요청해 주세요.");
      return;
    }

    const missingReason = requests.find(r => !r.reason);
    if (missingReason) {
      alert("수량이 변경된 항목에는 반드시 변경 사유를 입력하셔야 합니다.");
      return;
    }

    if (!window.confirm(`총 ${requests.length}건의 수량 변경 제안을 제출하시겠습니까?`)) return;

    setIsSubmittingChange(true);
    setGeneralError(null);
    try {
      await submitPortalPoChangeRequest(po.id, requests);
      setIsChangeFormOpen(false);
      router.refresh();
    } catch (err: any) {
      setGeneralError(err.message || "변경 요청 등록 실패");
    } finally {
      setIsSubmittingChange(false);
    }
  };

  // Handle Withdraw
  const handleWithdraw = async (requestId: string) => {
    if (!window.confirm("제출한 변경 요청을 철회하시겠습니까?")) return;
    setIsWithdrawing(requestId);
    setGeneralError(null);
    try {
      await withdrawPortalPoChangeRequest(requestId);
      router.refresh();
    } catch (err: any) {
      setGeneralError(err.message || "철회 중 오류 발생");
    } finally {
      setIsWithdrawing(null);
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
      {/* Back button */}
      <div>
        <button
          onClick={() => router.push("/portal/orders/purchase-orders")}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
        >
          ← 발주 목록으로 돌아가기
        </button>
      </div>

      {/* Header Info */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              PO {po.po_number}
            </h1>
            {getConfirmationBadge(po.supplier_confirmation_status)}
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            발주 일자: {new Date(po.order_date).toLocaleDateString()} | 통화: {po.currency}
          </p>
        </div>

        {/* Action Panel */}
        {po.supplier_confirmation_status !== "CONFIRMED" && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleConfirm}
              disabled={isConfirming || isSubmittingChange}
              className="inline-flex justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {isConfirming ? "처리 중..." : "Confirm PO (수락 확정)"}
            </button>
            <button
              onClick={() => setIsChangeFormOpen(true)}
              disabled={isConfirming || isSubmittingChange}
              className="inline-flex justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 disabled:opacity-50 dark:bg-zinc-900 dark:text-white dark:ring-zinc-700 dark:hover:bg-zinc-800"
            >
              Request Change (수량 제안)
            </button>
          </div>
        )}
      </div>

      {generalError && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-950/20">
          <div className="text-sm font-medium text-red-800 dark:text-red-400">
            {generalError}
          </div>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider dark:text-zinc-400">총 주문 수량 (Ordered)</div>
          <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{totalOrdered.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider dark:text-zinc-400">총 확정 수량 (Confirmed)</div>
          <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {totalConfirmed !== null ? totalConfirmed.toLocaleString() : (
              <span className="text-zinc-400 dark:text-zinc-500 font-medium text-lg">확인 대기 중</span>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider dark:text-zinc-400">수량 차이 (Difference)</div>
          <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {totalConfirmed !== null ? (
              <span className={totalConfirmed - totalOrdered !== 0 ? "text-indigo-600 dark:text-indigo-400" : ""}>
                {(totalConfirmed - totalOrdered).toLocaleString()}
              </span>
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500 font-medium text-lg">-</span>
            )}
          </div>
        </div>
      </div>

      {/* Change Proposal Form Modal */}
      {isChangeFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 overflow-y-auto max-h-[90vh]">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">발주 수량 변경 제안 (Request Change)</h2>
            <form onSubmit={handleSubmitChange} className="space-y-4">
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {po.lines.map(line => {
                  const hasActivePending = changeRequests.some(r => r.purchaseOrderLineId === line.id && r.status === "PENDING");
                  return (
                    <div key={line.id} className="py-4 space-y-3">
                      <div className="flex justify-between">
                        <div>
                          <div className="font-semibold text-zinc-900 dark:text-white">{line.product.name}</div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">SKU: {line.product.manufacture_sku}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-zinc-500">Ordered Qty</div>
                          <div className="font-bold text-zinc-850 dark:text-zinc-300">{line.qty}</div>
                        </div>
                      </div>

                      {hasActivePending ? (
                        <div className="text-xs text-indigo-650 bg-indigo-50 p-2 rounded dark:bg-indigo-950/20">
                          이 항목은 이미 Pending 상태의 변경 제안이 존재합니다. 중복 요청할 수 없습니다.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">제안 수량 (Proposed Qty)</label>
                            <input
                              type="number"
                              min="0"
                              required
                              value={proposedQties[line.id]}
                              onChange={e => setProposedQties({ ...proposedQties, [line.id]: Number(e.target.value) })}
                              className="w-full rounded-md border-zinc-300 bg-white text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">변경 사유 (Reason)</label>
                            <input
                              type="text"
                              placeholder="납기 단축, 생산 한계 등 사유 입력"
                              value={reasons[line.id]}
                              onChange={e => setReasons({ ...reasons, [line.id]: e.target.value })}
                              className="w-full rounded-md border-zinc-300 bg-white text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsChangeFormOpen(false)}
                  className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-white dark:ring-zinc-700 dark:hover:bg-zinc-800"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingChange}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 disabled:opacity-50"
                >
                  {isSubmittingChange ? "제출 중..." : "변경 제안 제출"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Lines List */}
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">발주 품목 상세</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <th className="px-6 py-3">품목 정보</th>
                <th className="px-6 py-3">제조사 SKU</th>
                <th className="px-6 py-3">Letusto SKU</th>
                <th className="px-6 py-3 text-right">단가 ({po.currency})</th>
                <th className="px-6 py-3 text-right">주문 수량</th>
                <th className="px-6 py-3 text-right">확정 수량</th>
                <th className="px-6 py-3 text-right">총액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {po.lines.map(line => (
                <tr key={line.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                  <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-white">
                    {line.product.name}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {line.product.manufacture_sku}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {line.product.letusto_sku}
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    {Number(line.unit_cost).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right font-bold">
                    {line.qty.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {line.confirmed_qty !== null ? (
                      <span className={`font-bold ${line.confirmed_qty !== line.qty ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-900 dark:text-white"}`}>
                        {line.confirmed_qty.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500 font-medium">대기</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold">
                    {((line.confirmed_qty ?? line.qty) * Number(line.unit_cost)).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Change Requests History */}
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">변경 제안 이력</h2>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {changeRequests.length === 0 ? (
            <div className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400">
              제출된 변경 요청 이력이 없습니다.
            </div>
          ) : (
            changeRequests.map(req => {
              const matchedLine = po.lines.find(l => l.id === req.purchaseOrderLineId);
              return (
                <div key={req.id} className="p-6 space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="font-semibold text-zinc-900 dark:text-white">
                        {matchedLine?.product.name || "Unknown SKU"}
                      </span>
                      <span className="ml-2 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                        (SKU: {matchedLine?.product.manufacture_sku || "-"})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400">
                        {new Date(req.createdAt).toLocaleString()}
                      </span>
                      {req.status === "PENDING" && (
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-650/10">Pending</span>
                      )}
                      {req.status === "APPROVED" && (
                        <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Approved</span>
                      )}
                      {req.status === "REJECTED" && (
                        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">Rejected</span>
                      )}
                      {req.status === "WITHDRAWN" && (
                        <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">Withdrawn</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm bg-zinc-50 p-4 rounded dark:bg-zinc-900">
                    <div>
                      <div className="text-xs text-zinc-500">원래 수량</div>
                      <div className="font-bold text-zinc-900 dark:text-white">{req.originalQty}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">제안 수량</div>
                      <div className="font-bold text-zinc-900 dark:text-white">{req.proposedQty}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">수량 차이</div>
                      <div className="font-bold text-indigo-600 dark:text-indigo-400">
                        {req.proposedQty - req.originalQty}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">상태</div>
                      <div className="font-bold capitalize">{req.status}</div>
                    </div>
                  </div>

                  <div className="text-sm space-y-1">
                    <div className="font-semibold text-zinc-700 dark:text-zinc-300">변경 사유:</div>
                    <div className="text-zinc-600 dark:text-zinc-400 p-2 border-l-2 border-zinc-350 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50">
                      {req.reason || "(사유가 입력되지 않음)"}
                    </div>
                  </div>

                  {req.reviewNote && (
                    <div className="text-sm space-y-1 bg-amber-50/30 p-3 rounded border border-amber-100 dark:bg-amber-950/10 dark:border-amber-900/30">
                      <div className="font-semibold text-amber-800 dark:text-amber-400">
                        관리자 검토 메모 ({req.reviewerName || "Admin"}):
                      </div>
                      <div className="text-zinc-700 dark:text-zinc-300">
                        {req.reviewNote}
                      </div>
                    </div>
                  )}

                  {req.status === "PENDING" && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleWithdraw(req.id)}
                        disabled={isWithdrawing === req.id}
                        className="text-xs font-semibold text-red-600 hover:text-red-500 disabled:opacity-50"
                      >
                        {isWithdrawing === req.id ? "철회 중..." : "철회하기 (Withdraw)"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
