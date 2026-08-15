"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getInboundShipmentDetail,
  createReceiving,
  updateReceiving,
} from "@/lib/inbound/actions";

interface ShipmentOption {
  id: string;
  shipment_number: string;
  po_number: string;
  supplier_name: string;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface ReceivingFormProps {
  initialReceiving?: any;
  openShipments: ShipmentOption[];
  warehouses: WarehouseOption[];
  defaultWarehouseId: string;
  preselectedShipmentId?: string;
}

interface LineState {
  inbound_shipment_line_id: string;
  purchase_order_line_id: string;
  product_id: string;
  product_name: string;
  letusto_sku: string | null;
  manufacture_sku: string | null;
  shipped_qty: number;
  already_received: number;
  remaining_to_receive: number;
  received_qty: number;
  damaged_qty: number;
  hold_qty: number;
  line_note: string;
}

export function ReceivingForm({
  initialReceiving,
  openShipments,
  warehouses,
  defaultWarehouseId,
  preselectedShipmentId = "",
}: ReceivingFormProps) {
  const router = useRouter();
  const isEdit = !!initialReceiving;

  // Header State
  const [shipmentId, setShipmentId] = useState(
    initialReceiving?.inbound_shipment_id || preselectedShipmentId || ""
  );
  const [purchaseOrderId, setPurchaseOrderId] = useState(initialReceiving?.purchase_order_id || "");
  const [warehouseId, setWarehouseId] = useState(initialReceiving?.warehouse_id || defaultWarehouseId);
  const [receivedDate, setReceivedDate] = useState(
    initialReceiving?.received_date || new Date().toISOString().split("T")[0]
  );
  const [internalNote, setInternalNote] = useState(initialReceiving?.internal_note || "");

  // Lines State
  const [lines, setLines] = useState<LineState[]>([]);
  const [isLoadingLines, setIsLoadingLines] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Shipment lines when shipmentId changes (or on edit load)
  useEffect(() => {
    if (!shipmentId) {
      setLines([]);
      setPurchaseOrderId("");
      return;
    }

    const loadShipmentLines = async () => {
      setIsLoadingLines(true);
      try {
        const shp = await getInboundShipmentDetail(shipmentId);
        setPurchaseOrderId(shp.purchase_order_id);

        // Map to local LineState
        const mapped = shp.lines.map((l: any) => {
          // If editing, find current receiving line configuration
          const existingLine = initialReceiving?.lines?.find(
            (el: any) => el.inbound_shipment_line_id === l.id
          );

          // If editing, adjust remaining_to_receive to include the quantity currently received in this receiving
          const adjustedRemaining = l.remaining_to_receive + (existingLine ? existingLine.received_qty : 0);

          return {
            inbound_shipment_line_id: l.id,
            purchase_order_line_id: l.purchase_order_line_id,
            product_id: l.product_id,
            product_name: l.product_name,
            letusto_sku: l.letusto_sku,
            manufacture_sku: l.manufacture_sku,
            shipped_qty: l.shipped_qty,
            already_received: l.received_qty,
            remaining_to_receive: adjustedRemaining,
            received_qty: existingLine ? existingLine.received_qty : adjustedRemaining,
            damaged_qty: existingLine ? existingLine.damaged_qty : 0,
            hold_qty: existingLine ? existingLine.hold_qty : 0,
            line_note: existingLine ? existingLine.line_note || "" : "",
          };
        });

        setLines(mapped);
      } catch (err) {
        console.error("Failed to load shipment lines for receiving", err);
      } finally {
        setIsLoadingLines(false);
      }
    };

    loadShipmentLines();
  }, [shipmentId, initialReceiving]);

  // Handle Qty change
  const handleLineValueChange = (index: number, key: "received_qty" | "damaged_qty" | "hold_qty", val: number) => {
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      [key]: val,
    };
    setLines(updated);
  };

  // Line note change
  const handleLineNoteChange = (index: number, val: string) => {
    const updated = [...lines];
    updated[index].line_note = val;
    setLines(updated);
  };

  // Submit form handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setIsSubmitting(true);

    try {
      if (!shipmentId) throw new Error("선적 문서(Inbound Shipment)를 선택해 주세요.");
      if (!warehouseId) throw new Error("입고지 물류창고를 선택해 주세요.");

      // Validations
      lines.forEach((l) => {
        if (l.received_qty < 0) throw new Error(`[${l.product_name}]의 정상 입고수량은 음수일 수 없습니다.`);
        if (l.damaged_qty < 0) throw new Error(`[${l.product_name}]의 파손 수량은 음수일 수 없습니다.`);
        if (l.hold_qty < 0) throw new Error(`[${l.product_name}]의 보류 수량은 음수일 수 없습니다.`);
        if (l.hold_qty > l.received_qty) {
          throw new Error(`[${l.product_name}]의 보류 수량(${l.hold_qty}개)은 정상 입고 수량(${l.received_qty}개)을 초과할 수 없습니다.`);
        }
      });

      const payload = {
        inbound_shipment_id: shipmentId,
        purchase_order_id: purchaseOrderId,
        warehouse_id: warehouseId,
        received_date: receivedDate,
        internal_note: internalNote,
        lines: lines.map((l) => ({
          inbound_shipment_line_id: l.inbound_shipment_line_id,
          purchase_order_line_id: l.purchase_order_line_id,
          product_id: l.product_id,
          received_qty: l.received_qty,
          damaged_qty: l.damaged_qty,
          hold_qty: l.hold_qty,
          line_note: l.line_note,
        })),
      };

      if (isEdit) {
        await updateReceiving(initialReceiving.id, payload);
        router.push(`/admin/purchasing/receiving/${initialReceiving.id}`);
      } else {
        const res = await createReceiving(payload);
        router.push(`/admin/purchasing/receiving/${res.id}`);
      }
      router.refresh();
    } catch (err: any) {
      setSubmitError(err.message || "입고 전표 저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Find preselected/selected shipment details in open options for metadata display
  const selectedShipmentMeta = openShipments.find((s) => s.id === shipmentId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitError && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 font-bold dark:bg-rose-950/10 dark:border-rose-900/50 dark:text-rose-400 text-xs">
          ⚠️ {submitError}
        </div>
      )}

      {/* Header Fields Panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
          기본 입고 검수 요건
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* Related Inbound Shipment */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-650 dark:text-zinc-400">선적 번호 (Shipment Number) *</label>
            <select
              value={shipmentId}
              onChange={(e) => setSupplierIdAndReset(e.target.value)}
              disabled={isEdit || !!preselectedShipmentId}
              className="w-full rounded border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none disabled:bg-zinc-50 dark:disabled:bg-zinc-800 font-bold"
              required
            >
              <option value="">-- 입고 검수할 선적 번호를 선택하세요 --</option>
              {openShipments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shipment_number} ({s.supplier_name} - PO: {s.po_number})
                </option>
              ))}
            </select>
          </div>

          {/* Destination Warehouse */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-650 dark:text-zinc-400">검수 물류창고 (Warehouse) *</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
              required
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  [{wh.code}] {wh.name}
                </option>
              ))}
            </select>
          </div>

          {/* Received Date */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-650 dark:text-zinc-400">입고 일자 (Received Date) *</label>
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none"
              required
            />
          </div>
        </div>
      </div>

      {/* Lines Panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
          실물 도착 수량 검수 기입 (Good, Damaged, Hold Breakdown)
        </h3>

        {!shipmentId ? (
          <div className="p-6 rounded border border-dashed border-zinc-200 dark:border-zinc-850 text-center text-zinc-450 font-semibold text-xs">
            상단에서 선적 문서(Inbound Shipment)를 먼저 선택해 주세요.
          </div>
        ) : isLoadingLines ? (
          <div className="p-6 text-center text-zinc-400 text-xs">선적 상세 품목을 불러오는 중...</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-150 dark:border-zinc-800/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-150 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-350">
                  <th className="px-4 py-2.5">Letusto SKU</th>
                  <th className="px-4 py-2.5">제조사 SKU</th>
                  <th className="px-4 py-2.5">제품명</th>
                  <th className="px-4 py-2.5 text-right w-20">선적 수량</th>
                  <th className="px-4 py-2.5 text-right w-20">기입고 수량</th>
                  <th className="px-4 py-2.5 text-right w-24">재고 입고 (Inventory Received) *</th>
                  <th className="px-4 py-2.5 text-right w-24">파손 수량 (Damaged) *</th>
                  <th className="px-4 py-2.5 text-right w-24">보류 지정 (Hold) *</th>
                  <th className="px-4 py-2.5 text-right w-20">차이 (Variance)</th>
                  <th className="px-4 py-2.5">품목별 비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {lines.map((line, index) => {
                  const variance = line.received_qty - line.remaining_to_receive;
                  const varianceColor =
                    variance > 0
                      ? "text-emerald-600 font-bold"
                      : variance < 0
                      ? "text-rose-600 font-bold"
                      : "text-zinc-500 font-medium";

                  return (
                    <tr key={line.inbound_shipment_line_id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                      <td className="px-4 py-3 font-mono font-bold text-zinc-900 dark:text-white">{line.letusto_sku}</td>
                      <td className="px-4 py-3 font-mono text-zinc-750 dark:text-zinc-400">{line.manufacture_sku}</td>
                      <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white max-w-xs truncate">{line.product_name}</td>
                      
                      {/* Shipped Qty */}
                      <td className="px-4 py-3 text-right font-mono text-zinc-550">{line.shipped_qty.toLocaleString()}</td>
                      
                      {/* Already Received */}
                      <td className="px-4 py-3 text-right font-mono text-zinc-550">{line.already_received.toLocaleString()}</td>
                      
                      {/* Received Qty */}
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          value={line.received_qty}
                          onChange={(e) => handleLineValueChange(index, "received_qty", parseInt(e.target.value) || 0)}
                          className="w-full text-right font-mono font-bold rounded border border-zinc-200 p-1 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                          required
                        />
                      </td>

                      {/* Damaged Qty */}
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          value={line.damaged_qty}
                          onChange={(e) => handleLineValueChange(index, "damaged_qty", parseInt(e.target.value) || 0)}
                          className="w-full text-right font-mono font-bold rounded border border-zinc-200 p-1 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white text-rose-500"
                          required
                        />
                      </td>

                      {/* Hold Qty */}
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          max={line.received_qty}
                          value={line.hold_qty}
                          onChange={(e) => handleLineValueChange(index, "hold_qty", parseInt(e.target.value) || 0)}
                          className="w-full text-right font-mono font-bold rounded border border-zinc-200 p-1 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white text-amber-500"
                          required
                        />
                      </td>

                      {/* Variance */}
                      <td className={`px-4 py-3 text-right font-mono ${varianceColor}`}>
                        {variance > 0 ? `+${variance}` : variance}
                      </td>

                      {/* Line Note */}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          placeholder="특이사항..."
                          value={line.line_note}
                          onChange={(e) => handleLineNoteChange(index, e.target.value)}
                          className="w-full rounded border border-zinc-200 p-1 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Internal note */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4 text-xs">
        <label className="font-bold text-zinc-650 dark:text-zinc-400">내부 입고 검수 메모 (Internal Note)</label>
        <textarea
          placeholder="실물 입고 검사 시 발견된 수량 불일치 내역이나 특이사항을 명확히 작성해 주세요..."
          value={internalNote}
          onChange={(e) => setInternalNote(e.target.value)}
          className="w-full rounded border border-zinc-200 p-2.5 text-xs text-zinc-900 bg-zinc-50 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white outline-none min-h-[80px]"
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            if (isEdit) {
              router.push(`/admin/purchasing/receiving/${initialReceiving.id}`);
            } else {
              router.push("/admin/purchasing/receiving");
            }
          }}
          className="px-5 py-2.5 bg-zinc-50 border border-zinc-200 text-zinc-650 hover:bg-zinc-100 dark:bg-zinc-850 dark:border-zinc-800 dark:text-zinc-450 dark:hover:bg-zinc-800 rounded-xl font-bold cursor-pointer transition-all"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2.5 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 rounded-xl font-bold disabled:opacity-50 cursor-pointer shadow-sm transition-all"
        >
          {isSubmitting ? "저장 중..." : isEdit ? "입고 정보 수정" : "임시 저장 (Save as Draft)"}
        </button>
      </div>
    </form>
  );

  function setSupplierIdAndReset(val: string) {
    setShipmentId(val);
  }
}
