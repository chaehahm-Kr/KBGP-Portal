"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  submitPortalGoodsReady,
  submitPortalHandover,
  submitPortalSupplierArrangedShipment,
  uploadShippingAttachment,
  getShippingAttachmentUrl
} from "@/lib/portal/actions";

interface PoOption {
  id: string;
  po_number: string;
  shipping_responsibility: "LETUSTO_ARRANGED" | "SUPPLIER_ARRANGED";
}

interface ShippingClientProps {
  initialReadinessList: any[];
  initialShipments: any[];
  confirmedPos: PoOption[];
}

export function ShippingClient({
  initialReadinessList,
  initialShipments,
  confirmedPos
}: ShippingClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"readiness" | "shipments">("readiness");
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState("");
  const [poLines, setPoLines] = useState<any[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);

  // Form Fields
  const [goodsReadyDate, setGoodsReadyDate] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [handoverLocation, setHandoverLocation] = useState("");
  const [fobPort, setFobPort] = useState("");
  const [warehouseFactoryAddress, setWarehouseFactoryAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  
  // Attachments
  const [packingListPath, setPackingListPath] = useState<string | null>(null);
  const [packingListFilename, setPackingListFilename] = useState<string | null>(null);
  const [commercialInvoicePath, setCommercialInvoicePath] = useState<string | null>(null);
  const [commercialInvoiceFilename, setCommercialInvoiceFilename] = useState<string | null>(null);

  // Line quantities
  const [lineQuantities, setLineQuantities] = useState<Record<string, {
    readyQty: number;
    cartons: number;
    grossWeight: number;
    cbm: number;
    remainingConfirmed: number;
    availableReadiness: number;
    confirmedQty: number;
    cumulativeShipped: number;
    activeReady: number;
    productName: string;
    letustoSku: string;
    manufactureSku: string;
    productId: string;
  }>>({});

  // Dynamic warning flag
  const [overageWarning, setOverageWarning] = useState(false);

  // Fetch PO Lines when selectedPoId changes
  useEffect(() => {
    if (!selectedPoId) {
      setPoLines([]);
      setLineQuantities({});
      return;
    }

    const loadPoLines = async () => {
      setLoadingLines(true);
      setErrorMessage("");
      try {
        // Query PO details from client side
        const res = await fetch(`/api/portal/purchase-orders/${selectedPoId}`);
        const po = await res.json();
        if (!po || !po.lines) throw new Error("발주 품목 라인을 불러오지 못했습니다.");

        const initialLineQtys: typeof lineQuantities = {};
        
        po.lines.forEach((l: any) => {
          const targetQty = l.confirmed_qty !== null ? l.confirmed_qty : l.qty;
          const cumShipped = l.cumulative_shipped || 0;
          const activeReady = l.active_ready || 0;

          const remainingConfirmed = Math.max(0, targetQty - cumShipped);
          const availableReadiness = Math.max(0, targetQty - cumShipped - activeReady);

          initialLineQtys[l.id] = {
            readyQty: availableReadiness,
            cartons: 0,
            grossWeight: 0,
            cbm: 0,
            remainingConfirmed,
            availableReadiness,
            confirmedQty: targetQty,
            cumulativeShipped: cumShipped,
            activeReady,
            productName: l.product_name,
            letustoSku: l.letusto_sku,
            manufactureSku: l.manufacture_sku,
            productId: l.product_id
          };
        });

        setPoLines(po.lines);
        setLineQuantities(initialLineQtys);
      } catch (err: any) {
        setErrorMessage(err.message || "발주 품목 로드 실패");
      } finally {
        setLoadingLines(false);
      }
    };

    loadPoLines();
  }, [selectedPoId]);

  // Check overage whenever quantities change
  useEffect(() => {
    let hasOverage = false;
    Object.values(lineQuantities).forEach(l => {
      if (l.readyQty > l.availableReadiness) {
        hasOverage = true;
      }
    });
    setOverageWarning(hasOverage);
  }, [lineQuantities]);

  const handleLineFieldChange = (lineId: string, field: "readyQty" | "cartons" | "grossWeight" | "cbm", val: number) => {
    setLineQuantities(prev => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        [field]: val
      }
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "packing" | "invoice") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await uploadShippingAttachment(formData);
      if (res.error) throw new Error(res.error);

      if (type === "packing") {
        setPackingListPath(res.path || null);
        setPackingListFilename(res.filename || null);
      } else {
        setCommercialInvoicePath(res.path || null);
        setCommercialInvoiceFilename(res.filename || null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "파일 업로드 실패");
    }
  };

  const handleSubmitReadiness = async (status: "DRAFT" | "READY_SUBMITTED") => {
    if (!selectedPoId) {
      setErrorMessage("발주서(PO)를 먼저 선택하세요.");
      return;
    }
    if (!goodsReadyDate) {
      setErrorMessage("출고 준비 완료 예정일(Goods Ready Date)을 입력해 주세요.");
      return;
    }

    const linesPayload = Object.entries(lineQuantities).map(([lineId, l]) => ({
      purchaseOrderLineId: lineId,
      productId: l.productId,
      readyQty: l.readyQty,
      cartons: l.cartons,
      grossWeight: l.grossWeight,
      cbm: l.cbm
    }));

    if (linesPayload.some(l => l.readyQty < 0 || l.cartons < 0 || l.grossWeight < 0 || l.cbm < 0)) {
      setErrorMessage("모든 수량 및 카고 정보는 0 이상이어야 합니다.");
      return;
    }

    setIsActionLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await submitPortalGoodsReady({
        purchaseOrderId: selectedPoId,
        goodsReadyDate,
        pickupLocation,
        handoverLocation,
        fobPort,
        warehouseFactoryAddress,
        contactPerson,
        specialInstructions,
        packingListPath,
        packingListFilename,
        commercialInvoicePath,
        commercialInvoiceFilename,
        handoverStatus: status,
        lines: linesPayload
      });

      if (res.success) {
        setSuccessMessage(
          status === "DRAFT"
            ? "출고 준비 정보가 임시저장되었습니다."
            : "출고 준비 정보가 제출되었습니다." + (res.overageDetected ? " (과성적 초과 Warning 감지됨)" : "")
        );
        setIsCreating(false);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "출고 준비 등록 실패");
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-250 text-rose-700 font-bold text-xs">
          ⚠️ {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-250 text-emerald-700 font-bold text-xs">
          ✅ {successMessage}
        </div>
      )}

      {/* Mode Switches */}
      {!isCreating ? (
        <>
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("readiness")}
                className={`text-sm font-bold pb-2 border-b-2 cursor-pointer transition-colors ${
                  activeTab === "readiness"
                    ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-650"
                }`}
              >
                출고 준비 등록 내역 (Goods Readiness)
              </button>
              <button
                onClick={() => setActiveTab("shipments")}
                className={`text-sm font-bold pb-2 border-b-2 cursor-pointer transition-colors ${
                  activeTab === "shipments"
                    ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-650"
                }`}
              >
                선적 추적 내역 (Shipments)
              </button>
            </div>

            <button
              onClick={() => setIsCreating(true)}
              className="px-3.5 py-1.5 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-bold rounded-lg cursor-pointer transition-colors"
            >
              + 새 출고 준비 등록 (New Goods Ready)
            </button>
          </div>

          {/* TAB 1: READINESS LIST */}
          {activeTab === "readiness" && (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="px-4 py-3">PO Number</th>
                    <th className="px-4 py-3">준비 예정일</th>
                    <th className="px-4 py-3">운송 책임</th>
                    <th className="px-4 py-3">인계 상태</th>
                    <th className="px-4 py-3">수량 경고</th>
                    <th className="px-4 py-3 text-right">상세 보기</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {initialReadinessList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                        출고 준비 요청 내역이 존재하지 않습니다.
                      </td>
                    </tr>
                  ) : (
                    initialReadinessList.map((gr) => (
                      <tr key={gr.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                        <td className="px-4 py-3.5 font-bold font-mono text-zinc-900 dark:text-white">
                          {gr.poNumber}
                        </td>
                        <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-300">{gr.goodsReadyDate}</td>
                        <td className="px-4 py-3.5 text-zinc-650 dark:text-zinc-400">
                          {gr.shippingResponsibility === "SUPPLIER_ARRANGED" ? "공급사 배송" : "Letusto 배송"}
                        </td>
                        <td className="px-4 py-3.5">
                          {gr.handoverStatus === "DRAFT" && (
                            <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-700 rounded font-bold">임시저장 (Draft)</span>
                          )}
                          {gr.handoverStatus === "READY_SUBMITTED" && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-bold">출고준비 완료</span>
                          )}
                          {gr.handoverStatus === "HANDOVER_PENDING" && (
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-bold">인계 대기</span>
                          )}
                          {gr.handoverStatus === "HANDED_OVER" && (
                            <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-bold">물품 인계 완료</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {gr.overageReviewRequired ? (
                            <span className="text-rose-600 font-bold">⚠️ 초과 선적 경고</span>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            href={`/portal/orders/shipping/${gr.id}`}
                            className="text-indigo-600 font-bold hover:underline"
                          >
                            상세 정보 →
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: SHIPMENTS LIST */}
          {activeTab === "shipments" && (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="px-4 py-3">Shipment Number</th>
                    <th className="px-4 py-3">운송 주체</th>
                    <th className="px-4 py-3">배송사</th>
                    <th className="px-4 py-3">ETD</th>
                    <th className="px-4 py-3">ETA</th>
                    <th className="px-4 py-3">선적 상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {initialShipments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                        관련 선적 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    initialShipments.map((shp) => (
                      <tr key={shp.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                        <td className="px-4 py-3.5 font-bold font-mono text-zinc-900 dark:text-white">
                          {shp.shipment_number}
                        </td>
                        <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-300">
                          {shp.shipping_responsibility === "SUPPLIER_ARRANGED" ? "공급사 배송" : "Letusto 배송"}
                        </td>
                        <td className="px-4 py-3.5 text-zinc-650 dark:text-zinc-400 font-mono">
                          {shp.carrier || "-"}
                        </td>
                        <td className="px-4 py-3.5 text-zinc-650 dark:text-zinc-400 font-mono">
                          {shp.etd || "-"}
                        </td>
                        <td className="px-4 py-3.5 text-zinc-655 dark:text-zinc-400 font-mono">
                          {shp.eta || "-"}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-1.5 py-0.5 border rounded text-[10px] font-bold bg-zinc-100 text-zinc-650">
                            {shp.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* CREATION FORM CONTAINER */
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-150 pb-3 dark:border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">출고 준비 수량 및 카고 상세 정보 등록</h3>
            <button
              onClick={() => setIsCreating(false)}
              className="text-xs text-zinc-450 hover:text-zinc-800"
            >
              뒤로가기 (Cancel)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Left side: Header Info */}
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-zinc-500 mb-1">대상 발주서 선택 (PO)</label>
                <select
                  value={selectedPoId}
                  onChange={(e) => setSelectedPoId(e.target.value)}
                  className="w-full rounded-md border-zinc-300 text-xs shadow-sm focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                >
                  <option value="">-- 발주서를 선택하세요 --</option>
                  {confirmedPos.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} ({po.shipping_responsibility === "SUPPLIER_ARRANGED" ? "공급사 배송" : "Letusto 배송"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-zinc-500 mb-1">출고 준비 완료 예정일</label>
                  <input
                    type="date"
                    value={goodsReadyDate}
                    onChange={(e) => setGoodsReadyDate(e.target.value)}
                    className="w-full rounded-md border-zinc-300 text-xs shadow-sm focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-500 mb-1">FOB Port / Port of Loading</label>
                  <input
                    type="text"
                    value={fobPort}
                    onChange={(e) => setFobPort(e.target.value)}
                    placeholder="예: Busan, Port of LA"
                    className="w-full rounded-md border-zinc-300 text-xs shadow-sm focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-500 mb-1">상세 픽업 주소 / 공장 출고지</label>
                <input
                  type="text"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  placeholder="공장 또는 창고의 상세 주소를 입력하세요."
                  className="w-full rounded-md border-zinc-300 text-xs shadow-sm focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-500 mb-1">인계 목적지 (Handover Location)</label>
                <input
                  type="text"
                  value={handoverLocation}
                  onChange={(e) => setHandoverLocation(e.target.value)}
                  placeholder="예: Letusto PA warehouse, Busan Port"
                  className="w-full rounded-md border-zinc-300 text-xs shadow-sm focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-zinc-500 mb-1">현장 담당자 연락처</label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="담당자 이름 및 연락처"
                    className="w-full rounded-md border-zinc-300 text-xs shadow-sm focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-500 mb-1">회사명 / 공장 주소</label>
                  <input
                    type="text"
                    value={warehouseFactoryAddress}
                    onChange={(e) => setWarehouseFactoryAddress(e.target.value)}
                    placeholder="제조사명 및 원산지 정보"
                    className="w-full rounded-md border-zinc-300 text-xs shadow-sm focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Right side: Documents & instructions */}
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-zinc-500 mb-1">기타 요청 및 특이사항</label>
                <textarea
                  rows={3}
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="패킹 방식, 취급 주의사항 등 작성"
                  className="w-full rounded-md border-zinc-300 text-xs shadow-sm focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                />
              </div>

              {/* Upload Packing List */}
              <div>
                <label className="block font-bold text-zinc-500 mb-1">패킹 리스트 (Packing List) 첨부</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => handleFileUpload(e, "packing")}
                    className="block w-full text-xs text-zinc-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-300"
                  />
                  {packingListFilename && (
                    <span className="text-[10px] text-green-600 font-semibold truncate block max-w-[150px]">
                      ✓ {packingListFilename}
                    </span>
                  )}
                </div>
              </div>

              {/* Upload Commercial Invoice */}
              <div>
                <label className="block font-bold text-zinc-500 mb-1">상업 송장 (Commercial Invoice) 첨부</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => handleFileUpload(e, "invoice")}
                    className="block w-full text-xs text-zinc-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-300"
                  />
                  {commercialInvoiceFilename && (
                    <span className="text-[10px] text-green-600 font-semibold truncate block max-w-[150px]">
                      ✓ {commercialInvoiceFilename}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* LINE QUANTITIES LIST */}
          {selectedPoId && (
            <div className="space-y-4 pt-4 border-t border-zinc-150 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-zinc-700 dark:text-zinc-350">출고 준비 수량 리스트</h4>
                {overageWarning && (
                  <span className="px-2 py-1 bg-rose-50 text-rose-600 border border-rose-200 rounded font-bold text-[10px]">
                    ⚠️ 경고: 준비 가용 수량을 초과하는 Ready Qty가 존재합니다 (Admin 심사 대기 예정).
                  </span>
                )}
              </div>

              {loadingLines ? (
                <div className="py-4 text-center text-zinc-400">품목을 불러오는 중...</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-400">
                        <th className="px-4 py-2.5">제품명 / SKU</th>
                        <th className="px-4 py-2.5 text-right w-16">확정량</th>
                        <th className="px-4 py-2.5 text-right w-16">선적 완료량</th>
                        <th className="px-4 py-2.5 text-right w-16">미선적 잔량</th>
                        <th className="px-4 py-2.5 text-right w-16">준비 가용 수량</th>
                        <th className="px-4 py-2.5 text-right w-24">금번 준비 완료 등록</th>
                        <th className="px-4 py-2.5 text-right w-16">박스수(Cartons)</th>
                        <th className="px-4 py-2.5 text-right w-16">중량(kg)</th>
                        <th className="px-4 py-2.5 text-right w-16">CBM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {poLines.map((line) => {
                        const l = lineQuantities[line.id];
                        if (!l) return null;
                        const isOverage = l.readyQty > l.availableReadiness;

                        return (
                          <tr key={line.id} className="hover:bg-zinc-50/10 dark:hover:bg-zinc-850/5">
                            <td className="px-4 py-3 font-bold text-zinc-850 dark:text-zinc-200">
                              <div>{l.productName}</div>
                              <div className="text-[10px] text-zinc-400 font-normal">
                                SKU: {l.letustoSku || "-"} | Mfg: {l.manufactureSku || "-"}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold">{l.confirmedQty.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono text-zinc-500">{l.cumulativeShipped.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono text-zinc-500">{l.remainingConfirmed.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-zinc-650">{l.availableReadiness.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                value={l.readyQty}
                                onChange={(e) => handleLineFieldChange(line.id, "readyQty", Number(e.target.value))}
                                className={`w-20 text-right rounded-md text-xs font-mono shadow-sm focus:ring-zinc-500 focus:border-zinc-500 ${
                                  isOverage
                                    ? "border-rose-300 bg-rose-50 text-rose-800 focus:border-rose-500 focus:ring-rose-500"
                                    : "border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900"
                                }`}
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                value={l.cartons}
                                onChange={(e) => handleLineFieldChange(line.id, "cartons", Number(e.target.value))}
                                className="w-14 text-right rounded-md border-zinc-350 text-xs font-mono shadow-sm focus:ring-zinc-500 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                value={l.grossWeight}
                                onChange={(e) => handleLineFieldChange(line.id, "grossWeight", Number(e.target.value))}
                                className="w-14 text-right rounded-md border-zinc-350 text-xs font-mono shadow-sm focus:ring-zinc-500 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                step="0.001"
                                value={l.cbm}
                                onChange={(e) => handleLineFieldChange(line.id, "cbm", Number(e.target.value))}
                                className="w-14 text-right rounded-md border-zinc-300 text-xs font-mono shadow-sm focus:ring-zinc-500 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
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
          )}

          {/* ACTIONS */}
          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-150 dark:border-zinc-800">
            <button
              onClick={() => handleSubmitReadiness("DRAFT")}
              disabled={isActionLoading || loadingLines}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-lg cursor-pointer transition-colors"
            >
              임시 저장 (Save Draft)
            </button>
            <button
              onClick={() => handleSubmitReadiness("READY_SUBMITTED")}
              disabled={isActionLoading || loadingLines}
              className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 text-xs font-bold rounded-lg cursor-pointer transition-colors"
            >
              {isActionLoading ? "제출 중..." : "출고 완료 제출 (Submit)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
