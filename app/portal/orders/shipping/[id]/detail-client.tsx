"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { submitPortalHandover, submitPortalSupplierArrangedShipment } from "@/lib/portal/actions";

interface DetailClientProps {
  readiness: any;
  packingListUrl: string | null;
  invoiceUrl: string | null;
}

export function DetailClient({ readiness, packingListUrl, invoiceUrl }: DetailClientProps) {
  const router = useRouter();
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Supplier Arranged Shipping fields
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [billOfLading, setBillOfLading] = useState("");
  const [etd, setEtd] = useState("");
  const [eta, setEta] = useState("");

  const handleHandover = async () => {
    if (!confirm("물류 담당사(또는 Letusto 지정 운송사)에 물품 인계를 완료했습니까?")) return;

    setIsActionLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const res = await submitPortalHandover(readiness.id);
      if (res.success) {
        setSuccessMessage("물품 인계 완료 상태로 변경되었습니다.");
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "인계 처리 실패");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSupplierShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carrier) {
      setErrorMessage("배송사/운송 주체를 입력하세요.");
      return;
    }
    if (!trackingNumber && !billOfLading) {
      setErrorMessage("송장 번호(Tracking Number) 또는 선하증권(B/L) 중 최소 하나는 입력해야 합니다.");
      return;
    }

    if (!confirm("선적 출발 처리를 완료하고 이 선적 정보를 등록하시겠습니까?")) return;

    setIsActionLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const res = await submitPortalSupplierArrangedShipment(readiness.id, {
        carrier,
        trackingNumber,
        billOfLading,
        etd,
        eta
      });
      if (res.success) {
        setSuccessMessage("선적이 성공적으로 등록되었으며 배송 출발 상태로 설정되었습니다.");
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "선적 등록 실패");
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-xs">
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-250 text-rose-700 font-bold">
          ⚠️ {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-250 text-emerald-700 font-bold">
          {successMessage}
        </div>
      )}

      {/* Grid overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* PO & Readiness Header Info */}
        <div className="md:col-span-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <h3 className="text-sm font-bold text-zinc-800 dark:text-white border-b border-zinc-150 pb-2 dark:border-zinc-850">
            카고 & 픽업 정보 (Cargo & Pickup Details)
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block font-bold text-zinc-400 uppercase tracking-wide mb-0.5">인계 상태</span>
              <span className="inline-block px-2 py-0.5 font-bold rounded bg-zinc-100 text-zinc-750">
                {readiness.handoverStatus}
              </span>
            </div>
            <div>
              <span className="block font-bold text-zinc-400 uppercase tracking-wide mb-0.5">운송 주체</span>
              <span className="inline-block px-2 py-0.5 font-bold rounded bg-indigo-50 text-indigo-700">
                {readiness.shippingResponsibility === "SUPPLIER_ARRANGED" ? "공급사 배송 (Supplier Arranged)" : "Letusto 배송 (Letusto Arranged)"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block font-bold text-zinc-400 mb-0.5">출고 준비 완료일</span>
              <p className="font-bold text-zinc-700 dark:text-zinc-300">{readiness.goodsReadyDate}</p>
            </div>
            <div>
              <span className="block font-bold text-zinc-400 mb-0.5">FOB Point / Port</span>
              <p className="font-bold text-zinc-700 dark:text-zinc-300">{readiness.fobPort || "-"}</p>
            </div>
          </div>

          <div>
            <span className="block font-bold text-zinc-400 mb-0.5">픽업 상세 주소</span>
            <p className="font-bold text-zinc-700 dark:text-zinc-300">{readiness.pickupLocation || "-"}</p>
          </div>

          <div>
            <span className="block font-bold text-zinc-400 mb-0.5">인계 목적지</span>
            <p className="font-bold text-zinc-700 dark:text-zinc-300">{readiness.handoverLocation || "-"}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block font-bold text-zinc-400 mb-0.5">출고 공장 및 제조사</span>
              <p className="font-bold text-zinc-700 dark:text-zinc-300">{readiness.warehouseFactoryAddress || "-"}</p>
            </div>
            <div>
              <span className="block font-bold text-zinc-400 mb-0.5">현장 연락처/담당자</span>
              <p className="font-bold text-zinc-700 dark:text-zinc-300">{readiness.contactPerson || "-"}</p>
            </div>
          </div>

          <div>
            <span className="block font-bold text-zinc-400 mb-0.5">요청 사항</span>
            <p className="text-zinc-600 dark:text-zinc-400 italic">{readiness.specialInstructions || "특이사항 없음"}</p>
          </div>
        </div>

        {/* Right side: Attachments & Handover action panel */}
        <div className="space-y-6">
          {/* Documents Box */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">첨부 문서</h3>
            <div className="space-y-2">
              <div>
                <span className="block font-bold text-zinc-400 mb-1">Packing List</span>
                {packingListUrl ? (
                  <a
                    href={packingListUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-indigo-600 hover:underline flex items-center gap-1.5"
                  >
                    📎 {readiness.packingListFilename || "다운로드"}
                  </a>
                ) : (
                  <span className="text-zinc-400 italic">등록 안 됨</span>
                )}
              </div>

              <div>
                <span className="block font-bold text-zinc-400 mb-1">Commercial Invoice</span>
                {invoiceUrl ? (
                  <a
                    href={invoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-indigo-600 hover:underline flex items-center gap-1.5"
                  >
                    📎 {readiness.commercialInvoiceFilename || "다운로드"}
                  </a>
                ) : (
                  <span className="text-zinc-400 italic">등록 안 됨</span>
                )}
              </div>
            </div>
          </div>

          {/* Workflow Action Panel */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">물류 액션 패널</h3>
            
            {readiness.handoverStatus !== "HANDED_OVER" ? (
              readiness.shippingResponsibility === "SUPPLIER_ARRANGED" ? (
                /* SUPPLIER ARRANGED SHIPPED DISPATCH FORM */
                <form onSubmit={handleSupplierShipment} className="space-y-3">
                  <p className="text-[11px] text-zinc-500 font-semibold mb-2">
                    공급사 책임 배송입니다. 배송 정보를 입력하여 선적 등록을 진행해 주세요.
                  </p>
                  <div>
                    <label className="block font-bold text-zinc-400 mb-1">배송사 (Carrier)</label>
                    <input
                      type="text"
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      placeholder="예: DHL, FedEx, CJ대한통운"
                      className="w-full rounded-md border-zinc-300 text-xs shadow-sm focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-400 mb-1">송장번호 (Tracking Number)</label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="송장번호 입력"
                      className="w-full rounded-md border-zinc-300 text-xs shadow-sm focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-400 mb-1">B/L 또는 AWB 번호</label>
                    <input
                      type="text"
                      value={billOfLading}
                      onChange={(e) => setBillOfLading(e.target.value)}
                      placeholder="B/L 또는 Air Waybill 번호"
                      className="w-full rounded-md border-zinc-300 text-xs shadow-sm focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-zinc-400 mb-1">ETD (출발일)</label>
                      <input
                        type="date"
                        value={etd}
                        onChange={(e) => setEtd(e.target.value)}
                        className="w-full rounded-md border-zinc-300 text-xs shadow-sm focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-400 mb-1">ETA (도착예정일)</label>
                      <input
                        type="date"
                        value={eta}
                        onChange={(e) => setEta(e.target.value)}
                        className="w-full rounded-md border-zinc-300 text-xs shadow-sm focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isActionLoading}
                    className="w-full py-2 bg-zinc-950 hover:bg-zinc-900 text-white font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    {isActionLoading ? "선적 정보 등록 중..." : "배송 출발 및 선적 등록"}
                  </button>
                </form>
              ) : (
                /* LETUSTO ARRANGED HANDOVER BUTTON */
                <div className="space-y-2">
                  <p className="text-[11px] text-zinc-500 font-semibold mb-2">
                    Letusto가 수거/운송을 주관합니다. 지정 차량이나 운송사에 물품 인계가 완료되면 아래 버튼을 눌러 상태를 변경해 주세요.
                  </p>
                  <button
                    onClick={handleHandover}
                    disabled={isActionLoading}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    {isActionLoading ? "상태 업데이트 중..." : "물품 인계 완료 (Handed Over)"}
                  </button>
                </div>
              )
            ) : (
              <div className="p-3 text-center bg-zinc-50 border border-zinc-200 text-zinc-500 rounded font-semibold dark:bg-zinc-800 dark:border-zinc-700">
                ✓ 물류 인계 및 발송 처리가 종료된 건입니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PO LINE ITEMS TABLE */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
        <h3 className="text-sm font-bold text-zinc-800 dark:text-white">준비 품목 정보</h3>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-850">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-4 py-2.5">제품명 / SKU</th>
                <th className="px-4 py-2.5 text-right w-28">출고 준비 완료 수량</th>
                <th className="px-4 py-2.5 text-right w-24">박스수(Cartons)</th>
                <th className="px-4 py-2.5 text-right w-24">중량(kg)</th>
                <th className="px-4 py-2.5 text-right w-24">CBM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {readiness.lines.map((line: any) => (
                <tr key={line.id} className="hover:bg-zinc-50/10 dark:hover:bg-zinc-850/5">
                  <td className="px-4 py-3 font-bold text-zinc-850 dark:text-zinc-200">
                    <div>{line.productName}</div>
                    <div className="text-[10px] text-zinc-400 font-normal">
                      SKU: {line.letustoSku || "-"} | Mfg: {line.manufactureSku || "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{line.readyQty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-600 dark:text-zinc-400">{line.cartons}</td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-600 dark:text-zinc-400">{line.grossWeight}</td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-600 dark:text-zinc-400">{line.cbm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
