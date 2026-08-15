"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getPoLinesForShipment,
  createInboundShipment,
  updateInboundShipment,
} from "@/lib/inbound/actions";

interface PoOption {
  id: string;
  po_number: string;
  supplier_name: string;
  order_date: string;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface ShipmentFormProps {
  initialShipment?: any;
  openPos: PoOption[];
  warehouses: WarehouseOption[];
  defaultWarehouseId: string;
}

interface LineState {
  purchase_order_line_id: string;
  product_id: string;
  product_name: string;
  letusto_sku: string | null;
  manufacture_sku: string | null;
  ordered_qty: number;
  remaining_to_ship: number;
  shipped_qty: number;
  selected: boolean;
  line_note: string;
}

export function ShipmentForm({
  initialShipment,
  openPos,
  warehouses,
  defaultWarehouseId,
}: ShipmentFormProps) {
  const router = useRouter();
  const isEdit = !!initialShipment;

  // Header State
  const [purchaseOrderId, setPurchaseOrderId] = useState(initialShipment?.purchase_order_id || "");
  const [shippingMethod, setShippingMethod] = useState<"Ocean" | "Air" | "Ground" | "Courier" | "Other">(
    initialShipment?.shipping_method || "Ocean"
  );
  const [originPort, setOriginPort] = useState(initialShipment?.origin_port || "");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState(
    initialShipment?.destination_warehouse_id || defaultWarehouseId
  );
  const [etd, setEtd] = useState(initialShipment?.etd || "");
  const [eta, setEta] = useState(initialShipment?.eta || "");
  const [actualDepartureDate, setActualDepartureDate] = useState(initialShipment?.actual_departure_date || "");
  const [actualArrivalDate, setActualArrivalDate] = useState(initialShipment?.actual_arrival_date || "");
  
  const [containerNumber, setContainerNumber] = useState(initialShipment?.container_number || "");
  const [trackingNumber, setTrackingNumber] = useState(initialShipment?.tracking_number || "");
  const [billOfLading, setBillOfLading] = useState(initialShipment?.bill_of_lading || "");
  const [airWaybill, setAirWaybill] = useState(initialShipment?.air_waybill || "");
  const [bookingNumber, setBookingNumber] = useState(initialShipment?.booking_number || "");
  const [internalNote, setInternalNote] = useState(initialShipment?.internal_note || "");

  // Lines State
  const [lines, setLines] = useState<LineState[]>([]);
  const [isLoadingLines, setIsLoadingLines] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch PO Lines when PO changes (or on edit load)
  useEffect(() => {
    if (!purchaseOrderId) {
      setLines([]);
      return;
    }

    const loadPoLines = async () => {
      setIsLoadingLines(true);
      try {
        const poLines = await getPoLinesForShipment(purchaseOrderId);
        
        // Map to local LineState
        const mapped = poLines.map((pol) => {
          // If editing, find current shipment line configuration
          const existingLine = initialShipment?.lines?.find(
            (el: any) => el.purchase_order_line_id === pol.id
          );

          // If editing, adjust remaining_to_ship to include the quantity currently shipped in this shipment
          const adjustedRemaining = pol.remaining_to_ship + (existingLine ? existingLine.shipped_qty : 0);

          return {
            purchase_order_line_id: pol.id,
            product_id: pol.product_id,
            product_name: pol.product_name,
            letusto_sku: pol.letusto_sku,
            manufacture_sku: pol.manufacture_sku,
            ordered_qty: pol.ordered_qty,
            remaining_to_ship: adjustedRemaining,
            shipped_qty: existingLine ? existingLine.shipped_qty : adjustedRemaining,
            selected: !!existingLine || adjustedRemaining > 0,
            line_note: existingLine ? existingLine.line_note || "" : "",
          };
        });

        setLines(mapped);
      } catch (err) {
        console.error("Failed to load PO lines for shipment", err);
      } finally {
        setIsLoadingLines(false);
      }
    };

    loadPoLines();
  }, [purchaseOrderId, initialShipment]);

  // Handle Qty change
  const handleQtyChange = (index: number, val: number) => {
    const updated = [...lines];
    updated[index].shipped_qty = val;
    setLines(updated);
  };

  // Toggle selection
  const handleToggleSelect = (index: number) => {
    const updated = [...lines];
    updated[index].selected = !updated[index].selected;
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
      if (!purchaseOrderId) throw new Error("발주서(Purchase Order)를 선택해 주세요.");
      if (!destinationWarehouseId) throw new Error("도착 목적 창고를 지정해 주세요.");

      const selectedLines = lines.filter((l) => l.selected && l.shipped_qty > 0);
      if (selectedLines.length === 0) {
        throw new Error("선적 품목을 최소 하나 이상 선택하고 수량을 입력해야 합니다.");
      }

      // Check remaining limits
      selectedLines.forEach((l) => {
        if (l.shipped_qty > l.remaining_to_ship) {
          throw new Error(
            `제품 [${l.product_name}]의 선적수량(${l.shipped_qty}개)은 미선적 잔량(${l.remaining_to_ship}개)을 초과할 수 없습니다.`
          );
        }
      });

      const payload = {
        purchase_order_id: purchaseOrderId,
        shipping_method: shippingMethod,
        origin_port: originPort,
        destination_warehouse_id: destinationWarehouseId,
        etd: etd || undefined,
        eta: eta || undefined,
        actual_departure_date: actualDepartureDate || undefined,
        actual_arrival_date: actualArrivalDate || undefined,
        container_number: containerNumber,
        tracking_number: trackingNumber,
        bill_of_lading: billOfLading,
        air_waybill: airWaybill,
        booking_number: bookingNumber,
        internal_note: internalNote,
        lines: selectedLines.map((l) => ({
          purchase_order_line_id: l.purchase_order_line_id,
          product_id: l.product_id,
          shipped_qty: l.shipped_qty,
          line_note: l.line_note,
        })),
      };

      if (isEdit) {
        await updateInboundShipment(initialShipment.id, payload);
        router.push(`/admin/purchasing/shipments/${initialShipment.id}`);
      } else {
        const res = await createInboundShipment(payload);
        router.push(`/admin/purchasing/shipments/${res.id}`);
      }
      router.refresh();
    } catch (err: any) {
      setSubmitError(err.message || "선적문서 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitError && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 font-bold dark:bg-rose-950/10 dark:border-rose-900/50 dark:text-rose-400 text-xs">
          ⚠️ {submitError}
        </div>
      )}

      {/* PO & Logistics Details Panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
          기본 선적 및 스케줄 조건
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* Related PO */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-650 dark:text-zinc-400">발주 번호 (Purchase Order) *</label>
            <select
              value={purchaseOrderId}
              onChange={(e) => setPurchaseOrderId(e.target.value)}
              disabled={isEdit}
              className="w-full rounded border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none disabled:bg-zinc-50 dark:disabled:bg-zinc-800"
              required
            >
              <option value="">-- 선적 대상 발주서를 골라주세요 --</option>
              {openPos.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.po_number} ({po.supplier_name})
                </option>
              ))}
            </select>
          </div>

          {/* Shipping Method */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-650 dark:text-zinc-400">운송 수단 (Shipping Method) *</label>
            <select
              value={shippingMethod}
              onChange={(e) => setShippingMethod(e.target.value as any)}
              className="w-full rounded border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none font-bold"
              required
            >
              <option value="Ocean">해상 (Ocean)</option>
              <option value="Air">항공 (Air)</option>
              <option value="Ground">육상 (Ground)</option>
              <option value="Courier">택배 (Courier)</option>
              <option value="Other">기타 (Other)</option>
            </select>
          </div>

          {/* Destination Warehouse */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-650 dark:text-zinc-400">입고지 물류창고 (Destination) *</label>
            <select
              value={destinationWarehouseId}
              onChange={(e) => setDestinationWarehouseId(e.target.value)}
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

          {/* ETD */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-650 dark:text-zinc-400">출발 예정일 (ETD)</label>
            <input
              type="date"
              value={etd}
              onChange={(e) => setEtd(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none"
            />
          </div>

          {/* ETA */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-650 dark:text-zinc-400">도착 예정일 (ETA)</label>
            <input
              type="date"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none"
            />
          </div>

          {/* Origin Port */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-650 dark:text-zinc-400">선적항 (Origin Port)</label>
            <input
              type="text"
              placeholder="예: Shanghai, Busan"
              value={originPort}
              onChange={(e) => setOriginPort(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Logistics References panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
          물류 추적 및 식별자 정보 (Logistics Identifiers)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-xs">
          <div>
            <label className="font-bold text-zinc-600 block mb-1">컨테이너 번호 (Container No.)</label>
            <input
              type="text"
              placeholder="예: TGBU1234567"
              value={containerNumber}
              onChange={(e) => setContainerNumber(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none font-mono"
            />
          </div>
          <div>
            <label className="font-bold text-zinc-600 block mb-1">선하증권 번호 (Bill of Lading / B/L)</label>
            <input
              type="text"
              placeholder="예: COSU6123456"
              value={billOfLading}
              onChange={(e) => setBillOfLading(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none font-mono"
            />
          </div>
          <div>
            <label className="font-bold text-zinc-600 block mb-1">부킹 번호 (Booking Number)</label>
            <input
              type="text"
              placeholder="예: BKG-998877"
              value={bookingNumber}
              onChange={(e) => setBookingNumber(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none font-mono"
            />
          </div>
          <div>
            <label className="font-bold text-zinc-600 block mb-1">항공화물 운송장 (Air Waybill / AWB)</label>
            <input
              type="text"
              placeholder="예: 180-12345678"
              value={airWaybill}
              onChange={(e) => setAirWaybill(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none font-mono"
            />
          </div>
          <div>
            <label className="font-bold text-zinc-600 block mb-1">트래킹 번호 (Tracking / Courier No.)</label>
            <input
              type="text"
              placeholder="예: 1Z999AA10123456784"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="w-full rounded border border-zinc-200 p-2 bg-white text-zinc-900 dark:border-zinc-850 dark:bg-zinc-955 dark:text-white focus:border-zinc-950 outline-none font-mono"
            />
          </div>
        </div>
      </div>

      {/* Shipment Lines table panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
          선적 대상 품목 및 수량 지정 (Shipment Lines)
        </h3>

        {!purchaseOrderId ? (
          <div className="p-6 rounded border border-dashed border-zinc-200 dark:border-zinc-850 text-center text-zinc-450 font-semibold text-xs">
            상단에서 선적 대상 발주서(PO)를 먼저 선택해 주세요.
          </div>
        ) : isLoadingLines ? (
          <div className="p-6 text-center text-zinc-400 text-xs">발주서 품목 정보를 불러오는 중...</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-150 dark:border-zinc-800/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-150 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-350">
                  <th className="px-4 py-2.5 text-center w-14">선택</th>
                  <th className="px-4 py-2.5">Letusto SKU</th>
                  <th className="px-4 py-2.5">제조사 SKU</th>
                  <th className="px-4 py-2.5">제품명</th>
                  <th className="px-4 py-2.5 text-right w-24">발주량</th>
                  <th className="px-4 py-2.5 text-right w-28">미출하 잔량</th>
                  <th className="px-4 py-2.5 text-right w-28">이번 선적량 *</th>
                  <th className="px-4 py-2.5">품목별 메모</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {lines.map((line, index) => (
                  <tr
                    key={line.purchase_order_line_id}
                    className={`hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5 ${!line.selected ? "opacity-50" : ""}`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={line.selected}
                        onChange={() => handleToggleSelect(index)}
                        disabled={line.remaining_to_ship <= 0 && !isEdit}
                        className="accent-indigo-650 rounded cursor-pointer"
                      />
                    </td>

                    {/* SKU */}
                    <td className="px-4 py-3 font-mono font-bold text-zinc-900 dark:text-white">
                      {line.letusto_sku || "-"}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-700 dark:text-zinc-400">
                      {line.manufacture_sku || "-"}
                    </td>

                    {/* Product Name */}
                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white max-w-xs truncate">
                      {line.product_name}
                    </td>

                    {/* Ordered Qty */}
                    <td className="px-4 py-3 text-right font-mono text-zinc-650 dark:text-zinc-450">
                      {line.ordered_qty.toLocaleString()}
                    </td>

                    {/* Remaining to Ship */}
                    <td className="px-4 py-3 text-right font-mono font-bold text-indigo-650 dark:text-indigo-400">
                      {line.remaining_to_ship.toLocaleString()}
                    </td>

                    {/* Shipped Qty */}
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="1"
                        max={line.remaining_to_ship}
                        value={line.shipped_qty}
                        onChange={(e) => handleQtyChange(index, parseInt(e.target.value) || 0)}
                        disabled={!line.selected}
                        className="w-full text-right font-mono font-bold rounded border border-zinc-200 p-1 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white disabled:bg-zinc-50 dark:disabled:bg-zinc-900"
                        required={line.selected}
                      />
                    </td>

                    {/* Line Note */}
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="메모..."
                        value={line.line_note}
                        onChange={(e) => handleLineNoteChange(index, e.target.value)}
                        disabled={!line.selected}
                        className="w-full rounded border border-zinc-200 p-1 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white disabled:bg-zinc-50 dark:disabled:bg-zinc-900"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Internal note */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4 text-xs">
        <label className="font-bold text-zinc-650 dark:text-zinc-400">내부 물류 전달 메모 (Internal Note)</label>
        <textarea
          placeholder="선적 서류 및 인도 스케줄과 관련된 메모를 남겨주세요..."
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
              router.push(`/admin/purchasing/shipments/${initialShipment.id}`);
            } else {
              router.push("/admin/purchasing/shipments");
            }
          }}
          className="px-5 py-2.5 bg-zinc-50 border border-zinc-200 text-zinc-650 hover:bg-zinc-100 dark:bg-zinc-850 dark:border-zinc-800 dark:text-zinc-450 dark:hover:bg-zinc-800 rounded-xl font-bold cursor-pointer transition-all animate-none"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2.5 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 rounded-xl font-bold disabled:opacity-50 cursor-pointer shadow-sm transition-all animate-none"
        >
          {isSubmitting ? "저장 중..." : isEdit ? "선적 정보 수정" : "선적 초안 저장 (Save Draft)"}
        </button>
      </div>
    </form>
  );
}
