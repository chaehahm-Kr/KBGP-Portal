"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { finalizeReceiving } from "@/lib/inbound/actions";

interface LineItem {
  id: string;
  inbound_shipment_line_id: string;
  purchase_order_line_id: string;
  product_id: string;
  received_qty: number;
  damaged_qty: number;
  hold_qty: number;
  line_note: string | null;
  product_name: string;
  letusto_sku: string;
  manufacture_sku: string;
  shipped_qty: number;
}

interface ReceivingDetailProps {
  receiving: {
    id: string;
    receiving_number: string;
    inbound_shipment_id: string;
    purchase_order_id: string;
    warehouse_id: string;
    received_date: string;
    status: "DRAFT" | "FINALIZED" | "CANCELLED";
    received_by: string | null;
    internal_note: string | null;
    created_at: string;
    updated_at: string;
    finalized_at: string | null;
    finalized_by: string | null;
    shipment: {
      shipment_number: string;
      shipping_method: string;
    };
    po: {
      po_number: string;
      currency: string;
      supplier: { name: string };
    };
    warehouse: {
      name: string;
      code: string;
      address1: string;
      city: string;
      state: string;
      zip_code: string;
      country: string;
    };
    creator: { full_name: string } | null;
    finalizer: { full_name: string } | null;
    lines: LineItem[];
  };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-650 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  FINALIZED: "bg-emerald-50 text-emerald-750 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "검수 대기 (Draft)",
  FINALIZED: "입고 확정 (Finalized)",
  CANCELLED: "취소됨 (Cancelled)",
};

const METHOD_LABELS: Record<string, string> = {
  Ocean: "해상 (Ocean)",
  Air: "항공 (Air)",
  Ground: "육상 (Ground)",
  Courier: "택배 (Courier)",
  Other: "기타 (Other)",
};

export function ReceivingDetail({ receiving }: ReceivingDetailProps) {
  const router = useRouter();
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleFinalize = async () => {
    const msg = `정말로 이 입고 내역을 최종 확정하시겠습니까?\n\n[주의] 확정 시 즉시 물류창고 실재고(Good Qty -> On Hand, Hold Qty -> Hold/Damaged)가 변경되며, 확정된 입고서는 더 이상 수정할 수 없습니다.`;
    if (!confirm(msg)) return;

    setErrorMessage("");
    setSuccessMessage("");
    setIsActionLoading(true);

    try {
      await finalizeReceiving(receiving.id);
      setSuccessMessage("입고 확정이 성공적으로 완료되었으며 재고에 반영되었습니다!");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "입고 확정 처리 도중 오류가 발생했습니다.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const totalShipped = receiving.lines.reduce((sum, l) => sum + l.shipped_qty, 0);
  const totalReceived = receiving.lines.reduce((sum, l) => sum + l.received_qty, 0);
  const totalDamaged = receiving.lines.reduce((sum, l) => sum + l.damaged_qty, 0);
  const totalHold = receiving.lines.reduce((sum, l) => sum + l.hold_qty, 0);

  // Check if any over-receiving or shortage exists for warning flags
  const hasVariance = receiving.lines.some((l) => l.received_qty !== l.shipped_qty);

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/purchasing/receiving"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
        >
          ← 입고 목록으로 돌아가기
        </Link>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-250 text-emerald-700 font-bold text-xs">
          ✅ {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-250 text-rose-600 font-bold dark:bg-rose-950/10 dark:border-rose-900/50 dark:text-rose-400 text-xs">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Top Operations Panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">진행 상태</span>
          <span className={`inline-flex items-center rounded px-3 py-1 text-xs font-bold border ${STATUS_COLORS[receiving.status] || STATUS_COLORS.DRAFT}`}>
            {STATUS_LABELS[receiving.status] || receiving.status}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {receiving.status === "DRAFT" && (
            <>
              <Link
                href={`/admin/purchasing/receiving/${receiving.id}/edit`}
                className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                검수 정보 수정 (Edit)
              </Link>
              <button
                onClick={handleFinalize}
                disabled={isActionLoading}
                className="px-4 py-2 bg-emerald-650 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                📥 재고 반영 및 확정 (Finalize)
              </button>
            </>
          )}

          {receiving.status === "FINALIZED" && (
            <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-250 text-emerald-700 text-[10px] font-bold rounded-xl dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50">
              ✔️ 이 전표는 확정되어 실재고에 가산되었습니다. 수정할 수 없습니다 (Read-Only).
            </div>
          )}
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        
        {/* Left Side: General Info */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* General Inbound Receiving Details */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
              입고 검수 조건
            </h3>
            
            <div className="space-y-3.5">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">입고 전표 번호</span>
                <span className="font-mono text-sm font-bold text-zinc-955 dark:text-white">{receiving.receiving_number}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">연계 선적 (Shipment No.)</span>
                <Link
                  href={`/admin/purchasing/shipments/${receiving.inbound_shipment_id}`}
                  className="font-mono text-xs font-bold text-indigo-650 hover:underline block"
                >
                  {receiving.shipment.shipment_number}
                </Link>
                <span className="text-[10px] text-zinc-400 mt-1 block">PO 번호: {receiving.po.po_number}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">입고 대상 물류창고</span>
                <span className="font-semibold text-zinc-900 dark:text-white block">
                  [{receiving.warehouse.code}] {receiving.warehouse.name}
                </span>
                <span className="text-[10px] text-zinc-450 block mt-0.5">{receiving.warehouse.address1}, {receiving.warehouse.city}, {receiving.warehouse.state}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-0.5">실제 입고일자</span>
                  <span className="font-mono font-bold text-zinc-850 dark:text-zinc-200">{receiving.received_date}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-0.5">최종 확정일</span>
                  <span className="font-mono">{receiving.finalized_at ? receiving.finalized_at.split("T")[0] : "-"}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-0.5">검수 담당자</span>
                  <span className="font-bold text-zinc-850 dark:text-zinc-200">{receiving.creator?.full_name || "System"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-0.5">확정 담당자</span>
                  <span className="font-bold text-zinc-850 dark:text-zinc-200">{receiving.finalizer?.full_name || "-"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Variance Warning Block */}
          {hasVariance && (
            <div className="rounded-xl border border-amber-250 bg-amber-50/30 p-5 shadow-sm space-y-2 dark:border-amber-900/50 dark:bg-amber-950/5">
              <h4 className="font-bold text-amber-700 dark:text-amber-400">⚠️ 수량 불일치 검수 감지</h4>
              <p className="text-[11px] leading-relaxed text-amber-650 dark:text-amber-500">
                선적된 선상(Shipped) 수량과 실제 입고 검수(Good + Damaged)된 수량 사이에 수량 불일치 차이가 발생했습니다. 입고 확정 전 메모 및 품목 비고 내용을 면밀히 확인하세요.
              </p>
            </div>
          )}

        </div>

        {/* Right Side: Lines Table */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Receiving Lines Table */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-sm font-bold text-zinc-850 dark:text-white font-sans">입고 상세 품목 목록 (Receiving Lines)</h3>
            
            <div className="overflow-x-auto rounded-lg border border-zinc-150 dark:border-zinc-800/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-150 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-350">
                    <th className="px-4 py-2.5">Letusto SKU</th>
                    <th className="px-4 py-2.5">제조사 SKU</th>
                    <th className="px-4 py-2.5">제품명</th>
                    <th className="px-4 py-2.5 text-right w-20">선적 수량</th>
                    <th className="px-4 py-2.5 text-right w-20">실물 입고 (Received)</th>
                    <th className="px-4 py-2.5 text-right w-20">정상 가용 (Good)</th>
                    <th className="px-4 py-2.5 text-right w-20">보류 (Hold)</th>
                    <th className="px-4 py-2.5 text-right w-20">파손 (Damaged)</th>
                    <th className="px-4 py-2.5 text-right w-20">미도착 (Shortage)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {receiving.lines.map((l) => {
                    const goodQty = l.received_qty - l.hold_qty;
                    const shortage = l.shipped_qty - (l.received_qty + l.damaged_qty);
                    const shortageColor =
                      shortage > 0
                        ? "text-rose-600 font-bold"
                        : shortage < 0
                        ? "text-emerald-600 font-bold"
                        : "text-zinc-500 font-medium";

                    return (
                      <tr key={l.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                        <td className="px-4 py-3 font-mono font-bold text-zinc-900 dark:text-white">{l.letusto_sku}</td>
                        <td className="px-4 py-3 font-mono text-zinc-750 dark:text-zinc-400">{l.manufacture_sku}</td>
                        <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white max-w-xs truncate" title={l.product_name}>
                          <div>
                            <span>{l.product_name}</span>
                            {l.line_note && (
                              <span className="text-[10px] text-zinc-450 block font-normal italic mt-0.5">Note: {l.line_note}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-550">{l.shipped_qty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-zinc-650">{l.received_qty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">{goodQty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-amber-500">{l.hold_qty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-rose-500">{l.damaged_qty.toLocaleString()}</td>
                        <td className={`px-4 py-3 text-right font-mono ${shortageColor}`}>
                          {shortage > 0 ? `-${shortage}` : shortage < 0 ? `+${Math.abs(shortage)}` : "0"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Sum stats */}
            <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-150 dark:border-zinc-850 rounded-xl">
              <span className="font-bold text-zinc-500">실물 입고 검수 요약</span>
              <div className="flex gap-6 font-mono font-bold">
                <div className="text-right">
                  <span className="text-[10px] font-sans text-zinc-400 block mb-0.5">총 선적 수량</span>
                  <span className="text-sm text-zinc-500">{totalShipped.toLocaleString()}</span>
                </div>
                <div className="text-right border-l border-zinc-250 pl-6 dark:border-zinc-800">
                  <span className="text-[10px] font-sans text-zinc-500 block mb-0.5">실물 입고 수량 (Physical Received)</span>
                  <span className="text-sm text-zinc-700">{totalReceived.toLocaleString()}</span>
                </div>
                <div className="text-right border-l border-zinc-250 pl-6 dark:border-zinc-800">
                  <span className="text-[10px] font-sans text-emerald-650 block mb-0.5">정상 가용 수량 (Good)</span>
                  <span className="text-sm text-emerald-650">{(totalReceived - totalHold).toLocaleString()}</span>
                </div>
                <div className="text-right border-l border-zinc-250 pl-6 dark:border-zinc-800">
                  <span className="text-[10px] font-sans text-amber-500 block mb-0.5">보류 수량 (Hold)</span>
                  <span className="text-sm text-amber-500">{totalHold.toLocaleString()}</span>
                </div>
                <div className="text-right border-l border-zinc-250 pl-6 dark:border-zinc-800">
                  <span className="text-[10px] font-sans text-rose-500 block mb-0.5">파손/거절 수량 (Damaged)</span>
                  <span className="text-sm text-rose-500">{totalDamaged.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-2">
            <h4 className="font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wide">입고 및 검수 특이사항</h4>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
              {receiving.internal_note || <span className="text-zinc-350 italic font-normal">등록된 특이사항이 없습니다.</span>}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
