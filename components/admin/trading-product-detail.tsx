"use client";

import React, { useState } from "react";
import Link from "next/link";
import { recordOpeningBalance, recordManualAdjustment } from "@/lib/inventory/actions";
import { useRouter } from "next/navigation";

const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

interface ResolvedProduct {
  id: string;
  name: string;
  display_name: string;
  manufacture_sku: string | null;
  letusto_sku: string | null;
  parent_sku: string | null;
  child_sku: string | null;
  category: string;
  brand_id: string;
  company_id: string;
  companyName: string;
  brandName: string;
  photoUrl: string | null;
  selection_status: string;
  sales_status: string;
  trading_status: string;
  category_code: string | null;
  category_full_path: string;
  price_usd_fob: number;
}

interface InventoryBalanceItem {
  id: string;
  product_id: string;
  warehouse_id: string;
  qty_on_hand: number;
  qty_hold: number;
  available: number;
  created_at: string;
  updated_at: string;
  warehouse_name: string;
  warehouse_code: string;
  warehouse_status: string;
}

interface InventoryMovementItem {
  id: string;
  product_id: string;
  warehouse_id: string;
  type: "OPENING_BALANCE" | "MANUAL_ADJUSTMENT" | "RECEIVING" | "SHIPMENT" | "TRANSFER";
  qty_change: number;
  qty_hold_change: number;
  balance_on_hand_after: number;
  balance_hold_after: number;
  reason: string | null;
  note: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  created_by: string | null;
  created_at: string;
  creator_name?: string;
}

interface TradingProductDetailProps {
  product: ResolvedProduct;
  initialBalances: InventoryBalanceItem[];
  initialMovements: InventoryMovementItem[];
  warehouses: any[]; // List of active warehouses
  poHistory?: any[];
  shipmentHistory?: any[];
  receivingHistory?: any[];
  costSummary?: any;
}

const SALES_COLORS: Record<string, string> = {
  PREPARING: "bg-zinc-100 text-zinc-650 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  ON_SALE: "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  PAUSED: "bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
  ENDED: "bg-zinc-250 text-zinc-650 border-zinc-300 dark:bg-zinc-950 dark:text-zinc-500 dark:border-zinc-850",
};

const SALES_LABELS: Record<string, string> = {
  PREPARING: "판매 준비",
  ON_SALE: "판매 중",
  PAUSED: "일시 중지",
  ENDED: "판매 종료",
};

const MOVEMENT_LABELS: Record<string, string> = {
  OPENING_BALANCE: "기초 재고 등록",
  MANUAL_ADJUSTMENT: "수동 조정",
  RECEIVING: "입고 완료",
  SHIPMENT: "출고 완료",
  TRANSFER: "창고 이동",
};

export function TradingProductDetail({
  product,
  initialBalances,
  initialMovements,
  warehouses,
  poHistory = [],
  shipmentHistory = [],
  receivingHistory = [],
  costSummary = null,
}: TradingProductDetailProps) {
  const router = useRouter();
  
  // Aggregate inventory totals
  const totalOnHand = initialBalances.reduce((sum, b) => sum + b.qty_on_hand, 0);
  const totalHold = initialBalances.reduce((sum, b) => sum + b.qty_hold, 0);
  const totalAvailable = totalOnHand - totalHold;

  // Modals state
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  
  // Opening Balance Form
  const [openWarehouseId, setOpenWarehouseId] = useState("");
  const [openQty, setOpenQty] = useState("0");
  const [openNote, setOpenNote] = useState("");
  const [openError, setOpenError] = useState("");
  const [isOpeningSubmitting, setIsOpeningSubmitting] = useState(false);

  // Manual Adjustment Form
  const [adjWarehouseId, setAdjWarehouseId] = useState("");
  const [adjQtyChange, setAdjQtyChange] = useState("0");
  const [adjQtyHoldChange, setAdjQtyHoldChange] = useState("0");
  const [adjReason, setAdjReason] = useState("Physical Count Difference");
  const [adjNote, setAdjNote] = useState("");
  const [adjError, setAdjError] = useState("");
  const [isAdjustmentSubmitting, setIsAdjustmentSubmitting] = useState(false);

  // Submit Opening Balance
  const handleOpenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpenError("");
    setIsOpeningSubmitting(true);

    try {
      if (!openWarehouseId) {
        throw new Error("물류창고를 선택해 주세요.");
      }
      const qty = parseInt(openQty);
      if (isNaN(qty) || qty < 0) {
        throw new Error("올바른 수량을 입력해 주세요 (0 이상).");
      }

      await recordOpeningBalance(product.id, openWarehouseId, qty, openNote);
      
      // Reset & Close
      setOpenWarehouseId("");
      setOpenQty("0");
      setOpenNote("");
      setIsOpeningModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setOpenError(err.message || "기초 재고 입력 중 오류가 발생했습니다.");
    } finally {
      setIsOpeningSubmitting(false);
    }
  };

  // Submit Manual Adjustment
  const handleAdjSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjError("");
    setIsAdjustmentSubmitting(true);

    try {
      if (!adjWarehouseId) {
        throw new Error("물류창고를 선택해 주세요.");
      }
      const qtyChange = parseInt(adjQtyChange);
      const qtyHoldChange = parseInt(adjQtyHoldChange);

      if (isNaN(qtyChange) || isNaN(qtyHoldChange)) {
        throw new Error("올바른 변동 수량을 입력해 주세요.");
      }
      if (qtyChange === 0 && qtyHoldChange === 0) {
        throw new Error("변동 수량이 최소한 하나는 0이 아니어야 합니다.");
      }

      await recordManualAdjustment(
        product.id,
        adjWarehouseId,
        qtyChange,
        qtyHoldChange,
        adjReason,
        adjNote
      );

      // Reset & Close
      setAdjWarehouseId("");
      setAdjQtyChange("0");
      setAdjQtyHoldChange("0");
      setAdjReason("Physical Count Difference");
      setAdjNote("");
      setIsAdjustmentModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setAdjError(err.message || "재고 조정 중 오류가 발생했습니다.");
    } finally {
      setIsAdjustmentSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/products/trading"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
        >
          <span>← 목록으로 돌아가기</span>
        </Link>
      </div>

      {/* Main Operations 360 View Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Product Summary Card (Read-Only) */}
        <div className="lg:col-span-1 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            {/* Header Title */}
            <div>
              <h2 className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Product Summary (Read-Only)</h2>
            </div>

            {/* Thumbnail */}
            <div className="flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-850 p-4 aspect-square max-w-[200px] mx-auto overflow-hidden shadow-sm">
              {product.photoUrl ? (
                <img
                  src={product.photoUrl}
                  alt={product.display_name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold">대표 이미지 없음</span>
              )}
            </div>

            {/* Fields List */}
            <div className="space-y-3.5 divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
              <div className="pt-3 first:pt-0">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">제품명 (Name)</span>
                <span className="font-bold text-zinc-900 dark:text-white text-sm block">{product.display_name}</span>
                {product.name !== product.display_name && (
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 block">{product.name}</span>
                )}
              </div>

              <div className="pt-3">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">Letusto SKU</span>
                <span className="font-mono font-bold text-zinc-955 dark:text-white">
                  {product.letusto_sku || <span className="text-zinc-350 dark:text-zinc-600 italic font-sans font-normal">지정 대기</span>}
                </span>
              </div>

              <div className="pt-3">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">제조사 SKU (Manufacturer SKU)</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-300">
                  {product.manufacture_sku || <span className="text-zinc-350 dark:text-zinc-600 italic font-sans font-normal">미입력</span>}
                </span>
              </div>

              <div className="pt-3">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">브랜드 & 공급사</span>
                <div className="font-semibold text-zinc-800 dark:text-zinc-300">
                  {product.brandName} <span className="text-zinc-400 dark:text-zinc-500">|</span> {product.companyName}
                </div>
              </div>

              <div className="pt-3">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">카테고리 경로</span>
                <span className="font-semibold text-zinc-650 dark:text-zinc-400">{product.category_full_path || "미지정"}</span>
              </div>

              <div className="pt-3 grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">판매 상태</span>
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${SALES_COLORS[product.sales_status] || SALES_COLORS.PREPARING}`}>
                    {SALES_LABELS[product.sales_status] || SALES_LABELS.PREPARING}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">운영 상태</span>
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${product.trading_status === "active" ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50" : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"}`}>
                    {product.trading_status === "active" ? "운영 대상" : "과거 이력"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1 text-right">FOB 공급가</span>
                  <span className="font-bold text-zinc-900 dark:text-white text-right block">
                    {product.price_usd_fob ? `$${product.price_usd_fob.toFixed(2)}` : "미정"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Link to editable Product Master */}
          <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800">
            <Link
              href={`/admin/products/${product.id}`}
              className="w-full text-center block py-2.5 px-4 bg-zinc-950 hover:bg-zinc-900 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              Product Master 상세 보기
            </Link>
          </div>
        </div>

        {/* Right Side: Operational Information (Future Modules Placeholders) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section: Inventory Summary (Active Connected State) */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">물류창고 재고 현황 (Inventory Summary)</h3>
              
              {/* Actions trigger */}
              <div className="flex items-center gap-2">
                {/* Disable opening balance if already has warehouse records */}
                <button
                  onClick={() => setIsOpeningModalOpen(true)}
                  className="px-2.5 py-1 text-[10px] font-bold bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-850 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded transition-all cursor-pointer"
                >
                  + 기초 재고 등록
                </button>
                {initialBalances.length > 0 && (
                  <button
                    onClick={() => setIsAdjustmentModalOpen(true)}
                    className="px-2.5 py-1 text-[10px] font-bold bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 rounded transition-all cursor-pointer"
                  >
                    ± 수동 재고 조정
                  </button>
                )}
              </div>
            </div>

            {/* Total Balance Stats Card */}
            <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-900 text-center">
              <div>
                <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase block mb-1">Total On Hand (실재고)</span>
                <span className="text-lg font-bold text-zinc-900 dark:text-white">{totalOnHand}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase block mb-1">Available (가용재고)</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{totalAvailable}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase block mb-1">On Hold (보류재고)</span>
                <span className="text-lg font-bold text-rose-500 dark:text-rose-400">{totalHold}</span>
              </div>
            </div>

            {/* Warehouse Breakdowns */}
            {initialBalances.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 flex flex-col items-center justify-center text-center bg-zinc-50/20 dark:bg-zinc-950/5">
                <span className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold">등록된 물류창고 재고가 없습니다.</span>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-650 mt-1 max-w-sm">
                  이 상품에 대해 최초 재고를 입력하려면 상단의 "+ 기초 재고 등록" 버튼을 클릭하여 시작해 주십시오.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-150 dark:border-zinc-800/80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-150 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-350">
                      <th className="px-4 py-2.5">창고 코드</th>
                      <th className="px-4 py-2.5">물류창고명</th>
                      <th className="px-4 py-2.5 text-right">실재고 (On Hand)</th>
                      <th className="px-4 py-2.5 text-right">보류재고 (Hold)</th>
                      <th className="px-4 py-2.5 text-right">가용재고 (Available)</th>
                      <th className="px-4 py-2.5 text-right">최종 업데이트</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {initialBalances.map((b) => (
                      <tr key={b.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                        <td className="px-4 py-3 font-mono font-bold text-zinc-900 dark:text-white">[{b.warehouse_code}]</td>
                        <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-300">{b.warehouse_name}</td>
                        <td className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-white">{b.qty_on_hand}</td>
                        <td className="px-4 py-3 text-right font-semibold text-rose-500 dark:text-rose-455">{b.qty_hold}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{b.available}</td>
                        <td className="px-4 py-3 text-right text-zinc-400 dark:text-zinc-600 font-mono text-[10px]">
                          {new Date(b.updated_at).toLocaleString("ko-KR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section: Inventory Movement Logs (Audit Trail) */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">재고 변동 이력 (Inventory Movement History)</h3>
            {initialMovements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 flex flex-col items-center justify-center text-center bg-zinc-50/20 dark:bg-zinc-950/5 text-zinc-400">
                변동 이력이 아직 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-150 dark:border-zinc-800/80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-150 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-350">
                      <th className="px-4 py-2.5">처리 일시</th>
                      <th className="px-4 py-2.5">변동 유형</th>
                      <th className="px-4 py-2.5 text-right">실재고 변동</th>
                      <th className="px-4 py-2.5 text-right">보류재고 변동</th>
                      <th className="px-4 py-2.5 text-right">처리 후 실재고</th>
                      <th className="px-4 py-2.5 text-right">처리 후 보류</th>
                      <th className="px-4 py-2.5">사유 / 비고</th>
                      <th className="px-4 py-2.5">작업자</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {initialMovements.map((m) => (
                      <tr key={m.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                        <td className="px-4 py-3 font-mono text-[10px] text-zinc-450 dark:text-zinc-500 whitespace-nowrap">
                          {new Date(m.created_at).toLocaleString("ko-KR")}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-bold text-zinc-800 dark:text-zinc-350">{MOVEMENT_LABELS[m.type] || m.type}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                          {m.qty_change > 0 ? (
                            <span className="text-emerald-600">+{m.qty_change}</span>
                          ) : m.qty_change < 0 ? (
                            <span className="text-rose-500">{m.qty_change}</span>
                          ) : (
                            <span className="text-zinc-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                          {m.qty_hold_change > 0 ? (
                            <span className="text-rose-600">+{m.qty_hold_change}</span>
                          ) : m.qty_hold_change < 0 ? (
                            <span className="text-emerald-500">{m.qty_hold_change}</span>
                          ) : (
                            <span className="text-zinc-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-600 dark:text-zinc-400 font-semibold">{m.balance_on_hand_after}</td>
                        <td className="px-4 py-3 text-right font-mono text-rose-500 dark:text-rose-455 font-semibold">{m.balance_hold_after}</td>
                        <td className="px-4 py-3 max-w-[150px] truncate text-zinc-650 dark:text-zinc-400" title={m.note || ""}>
                          {m.reason ? `[${m.reason}] ` : ""}
                          {m.reference_type === "RECEIVING" && m.reference_id ? (
                            <Link href={`/admin/purchasing/receiving/${m.reference_id}`} className="text-indigo-650 hover:underline font-bold">
                              {m.note || "-"}
                            </Link>
                          ) : (
                            m.note || "-"
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap font-medium">{m.creator_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section: Purchase & Receiving History */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">구매 및 입출고 거래 내역 (PO / Receiving History)</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* PO History */}
              <div className="space-y-2.5">
                <h4 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">1. 발주 이력 (PO Lines)</h4>
                {poHistory.length === 0 ? (
                  <p className="text-[10px] text-zinc-400 italic">발주 이력이 없습니다.</p>
                ) : (
                  <div className="overflow-hidden rounded border border-zinc-150 dark:border-zinc-850 text-[10px]">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-950 font-bold border-b border-zinc-150 dark:border-zinc-850">
                          <th className="p-2">PO 번호</th>
                          <th className="p-2 text-right">발주수량</th>
                          <th className="p-2 text-right">FOB 단가</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                        {poHistory.map((po: any) => (
                          <tr key={po.id} className="hover:bg-zinc-50/20">
                            <td className="p-2 font-mono">
                              <Link href={`/admin/purchasing/${po.purchase_orders?.id}`} className="hover:underline font-bold text-indigo-650">
                                {po.purchase_orders?.po_number}
                              </Link>
                              <span className="block text-[8px] text-zinc-400">{po.purchase_orders?.companies?.name}</span>
                            </td>
                            <td className="p-2 text-right font-mono font-semibold">{po.qty?.toLocaleString()}</td>
                            <td className="p-2 text-right font-mono">${po.unit_cost?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Shipment History */}
              <div className="space-y-2.5">
                <h4 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">2. 선적 이력 (Shipment Lines)</h4>
                {shipmentHistory.length === 0 ? (
                  <p className="text-[10px] text-zinc-400 italic">선적 운송 이력이 없습니다.</p>
                ) : (
                  <div className="overflow-hidden rounded border border-zinc-150 dark:border-zinc-850 text-[10px]">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-950 font-bold border-b border-zinc-150 dark:border-zinc-850">
                          <th className="p-2">선적 번호</th>
                          <th className="p-2 text-right">선적수량</th>
                          <th className="p-2">목적지</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                        {shipmentHistory.map((s: any) => (
                          <tr key={s.id} className="hover:bg-zinc-50/20">
                            <td className="p-2 font-mono">
                              <Link href={`/admin/purchasing/shipments/${s.inbound_shipments?.id}`} className="hover:underline font-bold text-indigo-650">
                                {s.inbound_shipments?.shipment_number}
                              </Link>
                              <span className="block text-[8px] text-zinc-400">ETA: {s.inbound_shipments?.eta || "-"}</span>
                            </td>
                            <td className="p-2 text-right font-mono font-semibold">{s.shipped_qty?.toLocaleString()}</td>
                            <td className="p-2 font-semibold">[{s.inbound_shipments?.warehouses?.code}]</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Receiving History */}
              <div className="space-y-2.5">
                <h4 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">3. 입고 이력 (Receivings)</h4>
                {receivingHistory.length === 0 ? (
                  <p className="text-[10px] text-zinc-400 italic">최종 입고 검수 이력이 없습니다.</p>
                ) : (
                  <div className="overflow-hidden rounded border border-zinc-150 dark:border-zinc-850 text-[10px]">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-950 font-bold border-b border-zinc-150 dark:border-zinc-850">
                          <th className="p-2">입고 번호</th>
                          <th className="p-2 text-right">실물입고</th>
                          <th className="p-2 text-right">파손/보류</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                        {receivingHistory.map((r: any) => (
                          <tr key={r.id} className="hover:bg-zinc-50/20">
                            <td className="p-2 font-mono">
                              <Link href={`/admin/purchasing/receiving/${r.receivings?.id}`} className="hover:underline font-bold text-emerald-650">
                                {r.receivings?.receiving_number}
                              </Link>
                              <span className="block text-[8px] text-zinc-400">{r.receivings?.received_date}</span>
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-emerald-600">{r.received_qty?.toLocaleString()}</td>
                            <td className="p-2 text-right font-mono text-rose-500">{r.damaged_qty || r.hold_qty ? `${r.damaged_qty}/${r.hold_qty}` : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Section: Landed Cost Summary */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">재고 및 원가 정보 (Cost & Costing Layer Summary)</h3>
              
              {!costSummary ? (
                <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 flex flex-col items-center justify-center text-center bg-zinc-50/50 dark:bg-zinc-950/20 min-h-[140px]">
                  <span className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold">원가 정보 로드 중...</span>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Three costing dimensions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3.5 bg-zinc-50 dark:bg-zinc-955 border border-zinc-150 dark:border-zinc-850 rounded-xl space-y-1">
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block font-bold uppercase">FIFO 선입선출 원가 (Current FIFO Cost)</span>
                      <span className="text-base font-bold text-indigo-650 font-mono block">
                        USD {Number(costSummary.currentFifoCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </span>
                      <span className="text-[9px] text-zinc-400 block font-medium">다음 출고/판매 시 적용될 선두 재고 원가</span>
                    </div>

                    <div className="p-3.5 bg-zinc-50 dark:bg-zinc-955 border border-zinc-150 dark:border-zinc-850 rounded-xl space-y-1">
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block font-bold uppercase">가중 평균 원가 (Weighted Average Cost)</span>
                      <span className="text-base font-bold text-zinc-800 dark:text-zinc-200 font-mono block">
                        USD {Number(costSummary.weightedAverage).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </span>
                      <span className="text-[9px] text-zinc-400 block font-medium">현재 보유 재고의 평균 가액 (평가용)</span>
                    </div>

                    <div className="p-3.5 bg-zinc-50 dark:bg-zinc-955 border border-zinc-150 dark:border-zinc-850 rounded-xl space-y-1">
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block font-bold uppercase">최근 확정 단가 (Latest Final Landed Cost)</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                          USD {Number(costSummary.latestLandedCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </span>
                        {costSummary.costChangePercent !== 0 && (
                          <span className={`text-[10px] font-bold font-mono ${
                            costSummary.costChangePercent > 0 ? "text-rose-500" : "text-emerald-500"
                          }`}>
                            {costSummary.costChangePercent > 0 ? "↑" : "↓"} {Math.abs(costSummary.costChangePercent)}%
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-zinc-400 block font-medium">가장 최근 확정/입고된 배치(Batch) 단가</span>
                    </div>
                  </div>

                  {/* Costing history table */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block uppercase tracking-wider">
                      배치별 최종 원가 이력 (Landed Cost Run History)
                    </span>
                    <div className="overflow-hidden rounded-lg border border-zinc-150 dark:border-zinc-800/80">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-zinc-150 dark:bg-zinc-900/50 dark:border-zinc-800 text-zinc-500 font-bold dark:text-zinc-350">
                            <th className="px-3 py-2">입고일자</th>
                            <th className="px-3 py-2 w-32">정산 케이스</th>
                            <th className="px-3 py-2 text-right">입고 수량</th>
                            <th className="px-3 py-2 text-right">매입가 (Acq)</th>
                            <th className="px-3 py-2 text-right">제비용 (Ancillary)</th>
                            <th className="px-3 py-2 text-right font-bold">Landed Cost / unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {costSummary.history.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-3 py-6 text-center text-zinc-400 italic">
                                확정된 Landed Cost 정산 이력이 없습니다.
                              </td>
                            </tr>
                          ) : (
                            costSummary.history.map((h: any) => (
                              <tr key={h.id} className="hover:bg-zinc-50/20 dark:hover:bg-zinc-850/5">
                                <td className="px-3 py-2.5 font-mono text-zinc-650">
                                  {h.received_date}
                                </td>
                                <td className="px-3 py-2.5 font-mono font-bold text-indigo-650">
                                  {h.landed_cost_case_id ? (
                                    <Link href={`/admin/finance/landed-cost/${h.landed_cost_case_id}`} className="hover:underline">
                                      {h.case?.landed_cost_number}
                                    </Link>
                                  ) : (
                                    <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                                      {h.case?.landed_cost_number || "LEGACY_OPENING"}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono">
                                  {Number(h.inventory_received_qty).toLocaleString()}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono text-zinc-600 dark:text-zinc-400">
                                  USD {Number(h.supplier_acquisition_cost / h.inventory_received_qty).toFixed(2)}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono text-zinc-600 dark:text-zinc-400">
                                  +USD {Number(h.total_ancillary_cost / h.inventory_received_qty).toFixed(2)}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                  USD {Number(h.unit_landed_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Section: Sales Summary Placeholder */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">판매 실적 요약 (Sales Summary)</h3>
              <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 flex flex-col items-center justify-center text-center bg-zinc-50/50 dark:bg-zinc-950/20 min-h-[140px]">
                <span className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold">Connected from Sales & Performance.</span>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-650 mt-1">
                  최근 30일/90일 판매수량 및 연도별 실적이 연동될 예정입니다.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Modal 1: Opening Balance Form */}
      {isOpeningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-150 pb-2.5 dark:border-zinc-800">
              <h4 className="text-sm font-bold text-zinc-800 dark:text-white">기초 재고 입력 (Opening Balance)</h4>
              <button
                onClick={() => {
                  setIsOpeningModalOpen(false);
                  setOpenError("");
                }}
                className="text-zinc-450 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOpenSubmit} className="space-y-4 text-xs">
              {openError && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-600 font-bold dark:bg-rose-950/10 dark:border-rose-900/50 dark:text-rose-400">
                  {openError}
                </div>
              )}

              {/* Warehouse selector */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-500 dark:text-zinc-400">물류창고 선택</label>
                <select
                  value={openWarehouseId}
                  onChange={(e) => setOpenWarehouseId(e.target.value)}
                  className="w-full rounded border border-zinc-200 p-2.5 text-xs text-zinc-900 bg-zinc-50 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white outline-none"
                  required
                >
                  <option value="">-- 창고를 선택해 주세요 --</option>
                  {warehouses.map((wh) => {
                    // Check if already has balance in this warehouse
                    const alreadyExists = initialBalances.some((b) => b.warehouse_id === wh.id);
                    return (
                      <option key={wh.id} value={wh.id} disabled={alreadyExists}>
                        [{wh.code}] {wh.name} {alreadyExists ? "(이미 재고 있음)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-500 dark:text-zinc-400">실재고 수량 (On Hand)</label>
                <input
                  type="number"
                  min="0"
                  value={openQty}
                  onChange={(e) => setOpenQty(e.target.value)}
                  className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-zinc-50 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white outline-none"
                  required
                />
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-500 dark:text-zinc-400">사유 / 비고 (Reason / Note)</label>
                <textarea
                  placeholder="예: 실사 재고 반영, 신규 입고 등..."
                  value={openNote}
                  onChange={(e) => setOpenNote(e.target.value)}
                  className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-zinc-50 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white outline-none min-h-[60px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpeningModalOpen(false);
                    setOpenError("");
                  }}
                  className="px-4 py-2 bg-zinc-50 border border-zinc-200 text-zinc-650 hover:bg-zinc-100 dark:bg-zinc-850 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isOpeningSubmitting}
                  className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 rounded-lg font-bold disabled:opacity-50"
                >
                  {isOpeningSubmitting ? "처리 중..." : "재고 등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Manual Adjustment Form */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-150 pb-2.5 dark:border-zinc-800">
              <h4 className="text-sm font-bold text-zinc-800 dark:text-white">수동 재고 조정 (Manual Adjustment)</h4>
              <button
                onClick={() => {
                  setIsAdjustmentModalOpen(false);
                  setAdjError("");
                }}
                className="text-zinc-450 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdjSubmit} className="space-y-4 text-xs">
              {adjError && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-600 font-bold dark:bg-rose-950/10 dark:border-rose-900/50 dark:text-rose-400">
                  {adjError}
                </div>
              )}

              {/* Warehouse selector (restricted to existing warehouses in balances) */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-500 dark:text-zinc-400">물류창고 선택</label>
                <select
                  value={adjWarehouseId}
                  onChange={(e) => setAdjWarehouseId(e.target.value)}
                  className="w-full rounded border border-zinc-200 p-2.5 text-xs text-zinc-900 bg-zinc-50 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white outline-none"
                  required
                >
                  <option value="">-- 창고를 선택해 주세요 --</option>
                  {initialBalances.map((b) => (
                    <option key={b.warehouse_id} value={b.warehouse_id}>
                      [{b.warehouse_code}] {b.warehouse_name} (현재 On Hand: {b.qty_on_hand}, Hold: {b.qty_hold})
                    </option>
                  ))}
                </select>
              </div>

              {/* Qty Change */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-500 dark:text-zinc-400">실재고 변동 수량 (Qty Change, 양수/음수 입력 가능)</label>
                <input
                  type="number"
                  value={adjQtyChange}
                  onChange={(e) => setAdjQtyChange(e.target.value)}
                  placeholder="예: 증가 시 +10, 감소 시 -10"
                  className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-zinc-50 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white outline-none"
                  required
                />
              </div>

              {/* Qty Hold Change */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-500 dark:text-zinc-400">보류재고 변동 수량 (Qty Hold Change, 양수/음수 입력 가능)</label>
                <input
                  type="number"
                  value={adjQtyHoldChange}
                  onChange={(e) => setAdjQtyHoldChange(e.target.value)}
                  placeholder="예: 보류 처리 시 +5, 보류 해제 시 -5"
                  className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-zinc-50 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white outline-none"
                  required
                />
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-500 dark:text-zinc-400">조정 대분류 사유 (Reason Category)</label>
                <select
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full rounded border border-zinc-200 p-2.5 text-xs text-zinc-900 bg-zinc-50 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white outline-none"
                  required
                >
                  <option value="Physical Count Difference">재고 실사 차이 (Physical Count Difference)</option>
                  <option value="Damage">손상 / 파손 (Damage)</option>
                  <option value="Loss">분실 / 도난 (Loss)</option>
                  <option value="Data Correction">오입력 정정 (Data Correction)</option>
                  <option value="Other">기타 사유 (Other)</option>
                </select>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-500 dark:text-zinc-400">비고 (Note)</label>
                <textarea
                  placeholder="세부 조정을 진행한 구체적 원인을 작성해 주세요..."
                  value={adjNote}
                  onChange={(e) => setAdjNote(e.target.value)}
                  className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-zinc-50 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white outline-none min-h-[60px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdjustmentModalOpen(false);
                    setAdjError("");
                  }}
                  className="px-4 py-2 bg-zinc-50 border border-zinc-200 text-zinc-650 hover:bg-zinc-100 dark:bg-zinc-850 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isAdjustmentSubmitting}
                  className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 rounded-lg font-bold disabled:opacity-50"
                >
                  {isAdjustmentSubmitting ? "처리 중..." : "재고 조정 반영"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
