"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { transitionShipmentStatus, closeShipmentWithVariance } from "@/lib/inbound/actions";

interface LineItem {
  id: string;
  purchase_order_line_id: string;
  product_id: string;
  shipped_qty: number;
  received_qty: number;
  remaining_to_receive: number;
  line_note: string | null;
  product_name: string;
  letusto_sku: string;
  manufacture_sku: string;
  po_qty: number;
}

interface ShipmentDetailProps {
  shipment: {
    id: string;
    shipment_number: string;
    purchase_order_id: string;
    status: "DRAFT" | "BOOKED" | "IN_TRANSIT" | "ARRIVED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
    shipping_method: "Ocean" | "Air" | "Ground" | "Courier" | "Other";
    origin_port: string | null;
    destination_warehouse_id: string;
    etd: string | null;
    eta: string | null;
    actual_departure_date: string | null;
    actual_arrival_date: string | null;
    container_number: string | null;
    tracking_number: string | null;
    bill_of_lading: string | null;
    air_waybill: string | null;
    booking_number: string | null;
    internal_note: string | null;
    created_at: string;
    updated_at: string;
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
    lines: LineItem[];
    total_shipped: number;
    total_received: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-650 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  BOOKED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  IN_TRANSIT: "bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
  ARRIVED: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50",
  PARTIALLY_RECEIVED: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/50",
  RECEIVED: "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "초안 (Draft)",
  BOOKED: "예약 완료 (Booked)",
  IN_TRANSIT: "선적 이동중 (In Transit)",
  ARRIVED: "창고도착 (Arrived)",
  PARTIALLY_RECEIVED: "일부 입고 (Partially Received)",
  RECEIVED: "입고 완료 (Received)",
  CANCELLED: "취소됨 (Cancelled)",
};

const METHOD_LABELS: Record<string, string> = {
  Ocean: "해상 (Ocean)",
  Air: "항공 (Air)",
  Ground: "육상 (Ground)",
  Courier: "택배 (Courier)",
  Other: "기타 (Other)",
};

export function ShipmentDetail({ shipment }: ShipmentDetailProps) {
  const router = useRouter();
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [varianceNote, setVarianceNote] = useState("");

  const handleTransition = async (targetStatus: string) => {
    const msg = `선적 상태를 "${STATUS_LABELS[targetStatus]}" 상태로 변경하시겠습니까?`;
    if (!confirm(msg)) return;

    setErrorMessage("");
    setIsActionLoading(true);

    try {
      await transitionShipmentStatus(shipment.id, targetStatus);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "상태 변경에 실패했습니다.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCloseWithVariance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm("미입고 품목들이 존재하는 상태로 이 선적을 종결(강제 완료)하시겠습니까?")) {
      return;
    }

    setErrorMessage("");
    setIsActionLoading(true);
    setShowCloseModal(false);

    try {
      await closeShipmentWithVariance(shipment.id, varianceNote);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "선적 종결 처리에 실패했습니다.");
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/purchasing/shipments"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
        >
          ← 선적 목록으로 돌아가기
        </Link>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 font-bold dark:bg-rose-950/10 dark:border-rose-900/50 dark:text-rose-400 text-xs">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Top Operations Panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">선적 상태</span>
          <span className={`inline-flex items-center rounded px-3 py-1 text-xs font-bold border ${STATUS_COLORS[shipment.status] || STATUS_COLORS.DRAFT}`}>
            {STATUS_LABELS[shipment.status] || shipment.status}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {shipment.status === "DRAFT" && (
            <>
              <Link
                href={`/admin/purchasing/shipments/${shipment.id}/edit`}
                className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                선적 서류 수정 (Edit)
              </Link>
              <button
                onClick={() => handleTransition("BOOKED")}
                disabled={isActionLoading}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                선적 예약 완료 (Book)
              </button>
            </>
          )}

          {shipment.status === "BOOKED" && (
            <button
              onClick={() => handleTransition("IN_TRANSIT")}
              disabled={isActionLoading}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
            >
              선적 출발 처리 (In Transit)
            </button>
          )}

          {shipment.status === "IN_TRANSIT" && (
            <button
              onClick={() => handleTransition("ARRIVED")}
              disabled={isActionLoading}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
            >
              창고 도착 처리 (Arrived)
            </button>
          )}

          {(shipment.status === "ARRIVED" || shipment.status === "PARTIALLY_RECEIVED") && (
            <>
              <Link
                href={`/admin/purchasing/receiving/new?shipmentId=${shipment.id}`}
                className="px-3.5 py-2 bg-emerald-650 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                📥 실물 입고 검수 등록 (Create Receiving)
              </Link>
              <button
                onClick={() => setShowCloseModal(true)}
                disabled={isActionLoading}
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-950 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                ⚠️ 선적 종결 처리 (Variance Close)
              </button>
            </>
          )}

          {shipment.status !== "RECEIVED" && shipment.status !== "CANCELLED" && (
            <button
              onClick={() => handleTransition("CANCELLED")}
              disabled={isActionLoading}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-250 text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
            >
              선적 취소 (Cancel)
            </button>
          )}
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        
        {/* Left Side: General Info & Identifiers */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* General Inbound Shipment Details */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
              선적 물류 정보
            </h3>
            
            <div className="space-y-3.5">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">선적 번호 (Shipment No.)</span>
                <span className="font-mono text-sm font-bold text-zinc-955 dark:text-white">{shipment.shipment_number}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">연계 발주서 (Related PO)</span>
                <Link
                  href={`/admin/purchasing/${shipment.purchase_order_id}`}
                  className="font-mono text-xs font-bold text-indigo-650 hover:underline block"
                >
                  {shipment.po.po_number}
                </Link>
                <span className="text-[10px] text-zinc-400 mt-1 block">Supplier: {shipment.po.supplier.name}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">운송 수단</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-300">{METHOD_LABELS[shipment.shipping_method] || shipment.shipping_method}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">입고 목적 물류창고</span>
                <span className="font-semibold text-zinc-900 dark:text-white block">
                  [{shipment.warehouse.code}] {shipment.warehouse.name}
                </span>
                <span className="text-[10px] text-zinc-450 block mt-0.5">{shipment.warehouse.address1}, {shipment.warehouse.city}, {shipment.warehouse.state}</span>
              </div>
            </div>
          </div>

          {/* Schedule Dates */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
              운송 스케줄 일정
            </h3>

            <div className="space-y-3.5 font-semibold text-zinc-800 dark:text-zinc-300">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">출발 예정 (ETD)</span>
                  <span className="font-mono">{shipment.etd || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">도착 예정 (ETA)</span>
                  <span className="font-mono">{shipment.eta || "-"}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">실제 출발일</span>
                  <span className="font-mono text-zinc-900 dark:text-white">{shipment.actual_departure_date || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">실제 도착일</span>
                  <span className="font-mono text-zinc-900 dark:text-white">{shipment.actual_arrival_date || "-"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Identifiers */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
              화물 물류 식별정보 (Identifiers)
            </h3>

            <div className="space-y-3 font-mono font-bold text-zinc-850 dark:text-zinc-200">
              <div>
                <span className="text-[10px] font-sans font-bold text-zinc-400 dark:text-zinc-500 block mb-0.5">컨테이너 번호 (Container No.)</span>
                <span>{shipment.container_number || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-sans font-bold text-zinc-400 dark:text-zinc-500 block mb-0.5">선하증권 번호 (Bill of Lading / BL)</span>
                <span>{shipment.bill_of_lading || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-sans font-bold text-zinc-400 dark:text-zinc-500 block mb-0.5">부킹 번호 (Booking Number)</span>
                <span>{shipment.booking_number || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-sans font-bold text-zinc-400 dark:text-zinc-500 block mb-0.5">항공화물 운송장 (Air Waybill / AWB)</span>
                <span>{shipment.air_waybill || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-sans font-bold text-zinc-400 dark:text-zinc-500 block mb-0.5">택배 트래킹 번호 (Courier Tracking)</span>
                <span>{shipment.tracking_number || "-"}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Side: Lines Table & Notes */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Shipment Lines Table */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-sm font-bold text-zinc-850 dark:text-white">선적 품목 목록 (Shipment Lines)</h3>
            
            <div className="overflow-x-auto rounded-lg border border-zinc-150 dark:border-zinc-800/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-150 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-350">
                    <th className="px-4 py-2.5">Letusto SKU</th>
                    <th className="px-4 py-2.5">제조사 SKU</th>
                    <th className="px-4 py-2.5">제품명</th>
                    <th className="px-4 py-2.5 text-right w-20">PO 발주량</th>
                    <th className="px-4 py-2.5 text-right w-20">총 선적량</th>
                    <th className="px-4 py-2.5 text-right w-20">입고 완료량</th>
                    <th className="px-4 py-2.5 text-right w-20">미입고 잔량</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {shipment.lines.map((l) => (
                    <tr key={l.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                      <td className="px-4 py-3 font-mono font-bold text-zinc-900 dark:text-white">{l.letusto_sku}</td>
                      <td className="px-4 py-3 font-mono text-zinc-700 dark:text-zinc-400">{l.manufacture_sku}</td>
                      <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white max-w-xs truncate" title={l.product_name}>
                        <div>
                          <span>{l.product_name}</span>
                          {l.line_note && (
                            <span className="text-[10px] text-zinc-450 block font-normal italic mt-0.5">Note: {l.line_note}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-550">{l.po_qty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900 dark:text-white">{l.shipped_qty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-650 dark:text-emerald-400">{l.received_qty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-indigo-650 dark:text-indigo-400">{l.remaining_to_receive.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sum stats */}
            <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-150 dark:border-zinc-850 rounded-xl">
              <span className="font-bold text-zinc-500">선적 집계 요약</span>
              <div className="flex gap-6 font-mono font-bold">
                <div className="text-right">
                  <span className="text-[10px] font-sans text-zinc-400 uppercase block mb-0.5">총 선적 수량</span>
                  <span className="text-sm text-zinc-900 dark:text-white">{shipment.total_shipped.toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-sans text-zinc-400 uppercase block mb-0.5">총 입고 확정량</span>
                  <span className="text-sm text-emerald-650 dark:text-emerald-400">{shipment.total_received.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-2">
            <h4 className="font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wide">내부 물류 전달 메모</h4>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
              {shipment.internal_note || <span className="text-zinc-350 italic font-normal">등록된 메모가 없습니다.</span>}
            </p>
          </div>

        </div>
      </div>

      {/* Close with variance modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCloseWithVariance}
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white dark:bg-zinc-900 p-6 shadow-xl text-xs space-y-4 dark:border-zinc-800"
          >
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">선적 강제 완료 종결 (Close with Variance)</h3>
            <p className="text-zinc-500 leading-relaxed">
              도착 품목 수량 중 일부 손실이나 미도달(Shortage)이 확정되어 더 이상의 추가 입고 전표 입력 없이 이 선적을 종결 처리합니다. 종결 사유를 비고란에 작성해 주세요.
            </p>

            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-350">종결 사유 / 수량 불일치 비고 *</label>
              <textarea
                placeholder="예: 실도착 20개 부족 상태로 선적 종결 처리함..."
                value={varianceNote}
                onChange={(e) => setVarianceNote(e.target.value)}
                className="w-full rounded border border-zinc-200 p-2 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none min-h-[80px]"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 bg-zinc-50 border border-zinc-200 text-zinc-650 hover:bg-zinc-100 rounded-lg font-bold dark:bg-zinc-850 dark:border-zinc-800 dark:text-zinc-450 cursor-pointer"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold cursor-pointer"
              >
                강제 종결 확정
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
