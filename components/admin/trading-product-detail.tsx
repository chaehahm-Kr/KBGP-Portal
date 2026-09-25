"use client";

import React, { useState } from "react";
import Link from "next/link";
import { recordOpeningBalance, recordManualAdjustment } from "@/lib/inventory/actions";
import {
  updateTradingPricing,
  updateTradingPromotion,
  updateTradingCostOverride,
  clearTradingCostOverride,
} from "@/lib/product/trading-actions";
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

interface ResolvedTradingProduct {
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

  // Pricing & Costs
  defaultWholesale: number;
  defaultSrp: number;
  defaultMap: number;
  operationalWholesale: number;
  promoWholesale: number | null;
  promoStartDate: string | null;
  promoEndDate: string | null;
  isPromoActive: boolean;
  mapPrice: number;
  srpPrice: number;
  pricingNote: string | null;
  isPricingActive: boolean;
  hasPricingOverride: boolean;

  baseLandedCost: number;
  overrideLandedCost: number | null;
  overrideReason: string | null;
  overrideUpdatedAt: string | null;
  effectiveLandedCost: number;
  hasCostOverride: boolean;

  ourMarginUsd: number;
  ourMarginPercent: number;
  baseOurMarginUsd: number;
  baseOurMarginPercent: number;
  retailerMarginUsd: number;
  retailerMarginPercent: number;
  baseRetailerMarginUsd: number;
  baseRetailerMarginPercent: number;
}

interface InventoryBalanceItem {
  id: string;
  product_id: string;
  warehouse_id: string;
  qty_on_hand: number;
  qty_hold: number;
  qty_damaged: number;
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
  qty_damaged_change: number;
  balance_on_hand_after: number;
  balance_hold_after: number;
  balance_damaged_after: number;
  reason: string | null;
  note: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  created_by: string | null;
  created_at: string;
  creator_name?: string;
}

interface TradingProductDetailProps {
  product: ResolvedTradingProduct;
  initialBalances: InventoryBalanceItem[];
  initialMovements: InventoryMovementItem[];
  warehouses: any[];
  poHistory?: any[];
  shipmentHistory?: any[];
  receivingHistory?: any[];
  costSummary?: any;
  historyLogs?: any[];
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
  historyLogs = [],
}: TradingProductDetailProps) {
  const router = useRouter();

  // Aggregate inventory totals
  const totalOnHand = initialBalances.reduce((sum, b) => sum + b.qty_on_hand, 0);
  const totalHold = initialBalances.reduce((sum, b) => sum + b.qty_hold, 0);
  const totalDamaged = initialBalances.reduce((sum, b) => sum + (b.qty_damaged || 0), 0);
  const totalAvailable = Math.max(0, totalOnHand - totalHold - totalDamaged);

  // Incoming Qty calculation
  const totalIncoming = poHistory.reduce((sum, po) => {
    if (["IN_PRODUCTION", "READY_TO_SHIP", "SHIPPED"].includes(po.purchase_orders?.po_status)) {
      return sum + (po.qty || 0);
    }
    return sum;
  }, 0);

  const lastReceivingDate = receivingHistory.length > 0 ? receivingHistory[0].created_at : null;

  // Active Tab for Right Column
  const [activeTab, setActiveTab] = useState<"inventory" | "po" | "cost" | "pricing" | "sales" | "audit">("inventory");

  // Modals state
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isCostOverrideModalOpen, setIsCostOverrideModalOpen] = useState(false);

  // Opening Balance Form State
  const [openWarehouseId, setOpenWarehouseId] = useState("");
  const [openQty, setOpenQty] = useState("0");
  const [openNote, setOpenNote] = useState("");
  const [openError, setOpenError] = useState("");
  const [isOpeningSubmitting, setIsOpeningSubmitting] = useState(false);

  // Manual Adjustment Form State
  const [adjWarehouseId, setAdjWarehouseId] = useState("");
  const [adjQtyChange, setAdjQtyChange] = useState("0");
  const [adjQtyHoldChange, setAdjQtyHoldChange] = useState("0");
  const [adjReason, setAdjReason] = useState("Physical Count Difference");
  const [adjNote, setAdjNote] = useState("");
  const [adjError, setAdjError] = useState("");
  const [isAdjustmentSubmitting, setIsAdjustmentSubmitting] = useState(false);

  // Pricing Form State
  const [editWholesale, setEditWholesale] = useState(product.operationalWholesale.toString());
  const [editMap, setEditMap] = useState(product.mapPrice.toString());
  const [editSrp, setEditSrp] = useState(product.srpPrice.toString());
  const [editPricingNote, setEditPricingNote] = useState(product.pricingNote || "");
  const [editPricingReason, setEditPricingReason] = useState("");
  const [pricingError, setPricingError] = useState("");
  const [isPricingSubmitting, setIsPricingSubmitting] = useState(false);

  // Promotion Form State
  const [editPromoPrice, setEditPromoPrice] = useState(product.promoWholesale ? product.promoWholesale.toString() : "");
  const [editPromoStart, setEditPromoStart] = useState(product.promoStartDate || "");
  const [editPromoEnd, setEditPromoEnd] = useState(product.promoEndDate || "");
  const [editPromoReason, setEditPromoReason] = useState("");
  const [promoError, setPromoError] = useState("");
  const [isPromoSubmitting, setIsPromoSubmitting] = useState(false);

  // Cost Override Form State
  const [editCostOverride, setEditCostOverride] = useState(product.overrideLandedCost ? product.overrideLandedCost.toString() : product.baseLandedCost.toString());
  const [editCostReason, setEditCostReason] = useState("");
  const [costOverrideError, setCostOverrideError] = useState("");
  const [isCostSubmitting, setIsCostSubmitting] = useState(false);

  // Handlers
  const handleOpenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpenError("");
    setIsOpeningSubmitting(true);
    try {
      if (!openWarehouseId) throw new Error("물류창고를 선택해 주세요.");
      const qty = parseInt(openQty);
      if (isNaN(qty) || qty < 0) throw new Error("올바른 수량을 입력해 주세요 (0 이상).");

      await recordOpeningBalance(product.id, openWarehouseId, qty, openNote);
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

  const handleAdjSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjError("");
    setIsAdjustmentSubmitting(true);
    try {
      if (!adjWarehouseId) throw new Error("물류창고를 선택해 주세요.");
      const qtyChange = parseInt(adjQtyChange);
      const qtyHoldChange = parseInt(adjQtyHoldChange);

      if (isNaN(qtyChange) || isNaN(qtyHoldChange)) throw new Error("올바른 변동 수량을 입력해 주세요.");
      if (qtyChange === 0 && qtyHoldChange === 0) throw new Error("최소 하나의 수량 변동이 있어야 합니다.");

      await recordManualAdjustment(product.id, adjWarehouseId, qtyChange, qtyHoldChange, adjReason, adjNote);
      setAdjWarehouseId("");
      setAdjQtyChange("0");
      setAdjQtyHoldChange("0");
      setAdjNote("");
      setIsAdjustmentModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setAdjError(err.message || "수동 조정 중 오류가 발생했습니다.");
    } finally {
      setIsAdjustmentSubmitting(false);
    }
  };

  const handlePricingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPricingError("");
    setIsPricingSubmitting(true);
    try {
      const wholesale = parseFloat(editWholesale);
      const map = editMap ? parseFloat(editMap) : null;
      const srp = editSrp ? parseFloat(editSrp) : null;

      if (isNaN(wholesale) || wholesale < 0) throw new Error("올바른 도매 공급가를 입력해 주세요.");

      await updateTradingPricing(product.id, {
        wholesale_price: wholesale,
        map_price: map,
        srp_price: srp,
        note: editPricingNote,
        reason: editPricingReason || "Trading Product pricing updated",
      });

      setIsPricingModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setPricingError(err.message || "도매가 업데이트 실패");
    } finally {
      setIsPricingSubmitting(false);
    }
  };

  const handlePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError("");
    setIsPromoSubmitting(true);
    try {
      const promoPrice = editPromoPrice ? parseFloat(editPromoPrice) : null;
      if (promoPrice !== null && (isNaN(promoPrice) || promoPrice < 0)) {
        throw new Error("올바른 프로모션 공급가를 입력해 주세요.");
      }

      await updateTradingPromotion(product.id, {
        promo_wholesale_price: promoPrice,
        promo_start_date: editPromoStart || null,
        promo_end_date: editPromoEnd || null,
        reason: editPromoReason || "Promotion settings updated",
      });

      setIsPromoModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setPromoError(err.message || "프로모션 업데이트 실패");
    } finally {
      setIsPromoSubmitting(false);
    }
  };

  const handleCostOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCostOverrideError("");
    setIsCostSubmitting(true);
    try {
      if (!editCostReason || editCostReason.trim().length === 0) {
        throw new Error("수입원가 오버라이드 변경 사유를 입력해야 합니다.");
      }
      const overrideVal = editCostOverride ? parseFloat(editCostOverride) : null;

      await updateTradingCostOverride(product.id, {
        override_cost: overrideVal,
        reason: editCostReason,
      });

      setIsCostOverrideModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setCostOverrideError(err.message || "원가 오버라이드 저장 실패");
    } finally {
      setIsCostSubmitting(false);
    }
  };

  const handleClearCostOverride = async () => {
    if (!confirm("설정된 수입원가 오버라이드를 해제하고 시스템 계산 원가(Base Landed Cost)로 복원하시겠습니까?")) return;
    try {
      await clearTradingCostOverride(product.id, "Operational cost override cleared by admin");
      router.refresh();
    } catch (err: any) {
      alert(err.message || "오버라이드 해제 실패");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Navigation & Action Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <Link
              href="/admin/products/trading"
              className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" />
              Trading Products 목록
            </Link>
            <span>/</span>
            <span className="text-zinc-900 dark:text-white font-medium">360° Management Hub</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {product.display_name}
            </h1>
            <span
              className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                SALES_COLORS[product.sales_status] || SALES_COLORS.PREPARING
              }`}
            >
              {SALES_LABELS[product.sales_status] || product.sales_status}
            </span>
          </div>
        </div>

        {/* Global Operational Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPricingModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 shadow-sm transition-colors"
          >
            도매가 설정
          </button>
          <button
            onClick={() => setIsPromoModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 shadow-sm transition-colors"
          >
            + 프로모션 등록
          </button>
          <button
            onClick={() => setIsCostOverrideModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 shadow-sm transition-colors"
          >
            원가 오버라이드
          </button>
          <Link
            href={`/admin/products/${product.id}`}
            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            Product Catalog Master
          </Link>
        </div>
      </div>

      {/* 2-COLUMN MAIN OPERATIONAL LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: OPERATIONAL SNAPSHOT (~35% width, lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-6">

          {/* A. Product Identity */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-50 dark:bg-zinc-950 flex-shrink-0 flex items-center justify-center">
                {product.photoUrl ? (
                  <img src={product.photoUrl} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] text-zinc-400 font-bold">NO IMAGE</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  {product.brandName} • {product.companyName}
                </span>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                  {product.name}
                </h2>
                {product.category_full_path && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                    {product.category_full_path}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs border-t border-zinc-100 dark:border-zinc-800 pt-3">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Letusto SKU</span>
                <span className="font-mono text-zinc-900 dark:text-zinc-200 font-semibold">{product.letusto_sku || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">제조사 SKU</span>
                <span className="font-mono text-zinc-900 dark:text-zinc-200 font-semibold">{product.manufacture_sku || "-"}</span>
              </div>
            </div>
          </div>

          {/* B. Inventory Snapshot */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                실시간 재고 스냅샷 (Inventory Snapshot)
              </h3>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/50">
                Parity Verified
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block uppercase">Available (판매가능)</span>
                <span className="text-xl font-extrabold text-emerald-800 dark:text-emerald-300">{totalAvailable.toLocaleString()} EA</span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-500 block uppercase">On Hand (총 물리재고)</span>
                <span className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100">{totalOnHand.toLocaleString()} EA</span>
              </div>
              <div className="p-2.5 rounded-lg bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 block uppercase">Damaged (불량)</span>
                <span className="text-sm font-bold text-rose-800 dark:text-rose-300">{totalDamaged.toLocaleString()} EA</span>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block uppercase">Hold (보류)</span>
                <span className="text-sm font-bold text-amber-800 dark:text-amber-300">{totalHold.toLocaleString()} EA</span>
              </div>
            </div>

            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950/50 p-2 rounded border border-zinc-150 dark:border-zinc-850 flex items-center justify-between">
              <span>Formula: Available = On Hand - Damaged - Hold</span>
              <span>Incoming: <strong className="text-zinc-700 dark:text-zinc-300">{totalIncoming} EA</strong></span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setIsOpeningModalOpen(true)}
                className="flex-1 py-1.5 text-[11px] font-semibold rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
              >
                + 기초 재고 등록
              </button>
              <button
                onClick={() => setIsAdjustmentModalOpen(true)}
                className="flex-1 py-1.5 text-[11px] font-semibold rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
              >
                수동 재고 조정
              </button>
            </div>
          </div>

          {/* C. Cost Snapshot (3-Layer Landed Cost Model) */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                3-Layer 원가 스냅샷 (Cost Snapshot)
              </h3>
              {product.hasCostOverride && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Manual Override Active
                </span>
              )}
            </div>

            {/* Effective Landed Cost (Primary Metric) */}
            <div className="p-3.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase">
                <span>Effective Landed Cost (적용 수입원가)</span>
                <span>Margin Driver</span>
              </div>
              <div className="text-2xl font-black text-indigo-900 dark:text-indigo-200">
                ${product.effectiveLandedCost.toFixed(2)}
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {product.hasCostOverride ? (
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                    수동 오버라이드 원가 적용 중 (사유: {product.overrideReason || "운영 조정"})
                  </span>
                ) : (
                  <span>Purchasing / Landed Cost 수입 정산 기반 실시간 원가</span>
                )}
              </p>
            </div>

            {/* Base vs Override Cost Breakdown */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-850">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Base Landed Cost (시스템 원가)</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-200">${product.baseLandedCost.toFixed(2)}</span>
              </div>
              <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-850">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Override Cost (오버라이드 원가)</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-200">
                  {product.overrideLandedCost !== null ? `$${product.overrideLandedCost.toFixed(2)}` : "-"}
                </span>
              </div>
            </div>

            {/* Extended Cost Layers */}
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="flex justify-between p-1.5 rounded bg-zinc-50 dark:bg-zinc-950/40">
                <span className="text-zinc-500">Weighted Average:</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                  ${(costSummary?.weightedAverage || product.baseLandedCost).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between p-1.5 rounded bg-zinc-50 dark:bg-zinc-950/40">
                <span className="text-zinc-500">FIFO Cost:</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                  ${(costSummary?.currentFifoCost || product.baseLandedCost).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsCostOverrideModalOpen(true)}
                className="flex-1 py-1.5 text-[11px] font-semibold rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
              >
                원가 오버라이드 변경
              </button>
              {product.hasCostOverride && (
                <button
                  onClick={handleClearCostOverride}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors border border-rose-200 dark:border-rose-900/50"
                >
                  오버라이드 해제
                </button>
              )}
            </div>
          </div>

          {/* D. Pricing & Margin Snapshot */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                가격 및 마진 스냅샷 (Pricing & Margin)
              </h3>
              {product.isPromoActive && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  PROMO ACTIVE
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Wholesale Price (도매가)</span>
                <span className="text-lg font-bold text-zinc-900 dark:text-white">${product.operationalWholesale.toFixed(2)}</span>
              </div>
              <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Promo Wholesale (프로모션가)</span>
                <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  {product.promoWholesale !== null ? `$${product.promoWholesale.toFixed(2)}` : "-"}
                </span>
              </div>
              <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-850">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">MAP (최저준수가격)</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-200">${product.mapPrice.toFixed(2)}</span>
              </div>
              <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-850">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">SRP (권장소비자가)</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-200">${product.srpPrice.toFixed(2)}</span>
              </div>
            </div>

            {/* MARGIN CALCULATOR ENGINE DISPLAY */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Calculated Operating Margins
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block uppercase">Our Margin (자사 마진)</span>
                  <div className="text-base font-extrabold text-emerald-800 dark:text-emerald-300">
                    {product.ourMarginPercent.toFixed(1)}% <span className="text-xs font-normal">(${product.ourMarginUsd.toFixed(2)})</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 block uppercase">Retailer Margin (리테일러 마진)</span>
                  <div className="text-base font-extrabold text-blue-800 dark:text-blue-300">
                    {product.retailerMarginPercent.toFixed(1)}% <span className="text-xs font-normal">(${product.retailerMarginUsd.toFixed(2)})</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsPricingModalOpen(true)}
                className="flex-1 py-1.5 text-[11px] font-semibold rounded bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 transition-colors"
              >
                도매가 / MAP / SRP 수정
              </button>
              <button
                onClick={() => setIsPromoModalOpen(true)}
                className="px-3 py-1.5 text-[11px] font-semibold rounded bg-amber-500 hover:bg-amber-600 text-white transition-colors"
              >
                프로모션 설정
              </button>
            </div>
          </div>

          {/* E. Alerts & Exceptions */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
              운영 감지 & 상태 알림 (Alerts & Exceptions)
            </h3>
            <div className="space-y-2 text-xs">
              {totalAvailable < 10 && (
                <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 font-medium">
                  ⚠️ <strong>안전 재고 부족:</strong> 판매 가능 재고가 {totalAvailable}개로 10개 미만입니다.
                </div>
              )}
              {totalDamaged > 0 && (
                <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 font-medium">
                  📦 <strong>불량 재고 격리 중:</strong> 불량 재고 {totalDamaged}개가 가용 재고에서 차감되었습니다.
                </div>
              )}
              {product.ourMarginPercent < 20 && (
                <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 font-medium">
                  📉 <strong>마진 임계치 하회:</strong> 자사 마진({product.ourMarginPercent.toFixed(1)}%)이 목표 임계치(20%) 미만입니다.
                </div>
              )}
              {product.isPromoActive && (
                <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 font-medium">
                  🏷️ <strong>프로모션 진행 중:</strong> 할인 도매가 ${product.promoWholesale?.toFixed(2)}가 적용되어 있습니다.
                </div>
              )}
              {totalAvailable >= 10 && totalDamaged === 0 && product.ourMarginPercent >= 20 && !product.isPromoActive && (
                <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 font-medium">
                  ✅ <strong>정상 운영 상태:</strong> 예외 감지 사항이 없습니다.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: TAB-BASED OPERATIONAL HISTORY (~65% width, lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            
            {/* Tab Navigation Header */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 overflow-x-auto">
              {[
                { id: "inventory", label: "Inventory Activity (재고 변동)" },
                { id: "po", label: "PO / Inbound History (입고 이력)" },
                { id: "cost", label: "Cost History (원가 이력)" },
                { id: "pricing", label: "Pricing & Promotions (가격/프로모션)" },
                { id: "sales", label: "Sales Summary (판매 요약)" },
                { id: "audit", label: "Audit / Change Log (변경 이력)" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-3 text-xs font-bold whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white bg-white dark:bg-zinc-900"
                      : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content Panels */}
            <div className="p-6">
              
              {/* TAB 1: INVENTORY ACTIVITY */}
              {activeTab === "inventory" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      재고 수불 및 변동 히스토리 ({initialMovements.length}건)
                    </h3>
                  </div>

                  {initialMovements.length === 0 ? (
                    <div className="p-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                      기록된 재고 변동 내역이 없습니다.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-300">
                        <thead className="bg-zinc-50 text-[10px] uppercase font-bold text-zinc-400 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
                          <tr>
                            <th className="py-2.5 px-3">일시</th>
                            <th className="py-2.5 px-3">구분</th>
                            <th className="py-2.5 px-3 text-right">OnHand 변동</th>
                            <th className="py-2.5 px-3 text-right">Damaged 변동</th>
                            <th className="py-2.5 px-3 text-right">Hold 변동</th>
                            <th className="py-2.5 px-3 text-right">잔고 (OnHand/Damaged)</th>
                            <th className="py-2.5 px-3">사유 및 메모</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {initialMovements.map((m) => (
                            <tr key={m.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/50">
                              <td className="py-2.5 px-3 font-mono text-[11px]">
                                {new Date(m.created_at).toLocaleString("ko-KR")}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-zinc-100">
                                {MOVEMENT_LABELS[m.type] || m.type}
                              </td>
                              <td className={`py-2.5 px-3 text-right font-bold ${m.qty_change > 0 ? "text-emerald-600" : m.qty_change < 0 ? "text-rose-600" : ""}`}>
                                {m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}
                              </td>
                              <td className={`py-2.5 px-3 text-right font-bold ${m.qty_damaged_change > 0 ? "text-rose-600" : ""}`}>
                                {m.qty_damaged_change > 0 ? `+${m.qty_damaged_change}` : m.qty_damaged_change || 0}
                              </td>
                              <td className={`py-2.5 px-3 text-right font-bold ${m.qty_hold_change > 0 ? "text-amber-600" : ""}`}>
                                {m.qty_hold_change > 0 ? `+${m.qty_hold_change}` : m.qty_hold_change || 0}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-medium text-zinc-700 dark:text-zinc-300">
                                {m.balance_on_hand_after} / {m.balance_damaged_after || 0}
                              </td>
                              <td className="py-2.5 px-3 text-zinc-500 text-[11px]">
                                {[m.reason, m.note].filter(Boolean).join(" - ") || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PO / INBOUND HISTORY */}
              {activeTab === "po" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">
                      발주 내역 (Purchase Orders - {poHistory.length}건)
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-300">
                        <thead className="bg-zinc-50 text-[10px] uppercase font-bold text-zinc-400 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
                          <tr>
                            <th className="py-2.5 px-3">PO 번호</th>
                            <th className="py-2.5 px-3">공급사</th>
                            <th className="py-2.5 px-3">발주일</th>
                            <th className="py-2.5 px-3 text-right">발주 수량</th>
                            <th className="py-2.5 px-3 text-right">단가</th>
                            <th className="py-2.5 px-3">상태</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {poHistory.map((po) => (
                            <tr key={po.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/50">
                              <td className="py-2.5 px-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                <Link href={`/admin/purchasing/orders/${po.purchase_orders?.id}`}>
                                  {po.purchase_orders?.po_number || "-"}
                                </Link>
                              </td>
                              <td className="py-2.5 px-3">{po.purchase_orders?.companies?.name || "-"}</td>
                              <td className="py-2.5 px-3 font-mono">{po.purchase_orders?.order_date || "-"}</td>
                              <td className="py-2.5 px-3 text-right font-bold">{po.qty} EA</td>
                              <td className="py-2.5 px-3 text-right font-mono">${po.unit_cost?.toFixed(2)}</td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                  {po.purchase_orders?.po_status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">
                      입고 내역 (Receiving History - {receivingHistory.length}건)
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-300">
                        <thead className="bg-zinc-50 text-[10px] uppercase font-bold text-zinc-400 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
                          <tr>
                            <th className="py-2.5 px-3">입고 번호</th>
                            <th className="py-2.5 px-3">입고일</th>
                            <th className="py-2.5 px-3">창고</th>
                            <th className="py-2.5 px-3 text-right">입고 수량</th>
                            <th className="py-2.5 px-3 text-right">불량 수량</th>
                            <th className="py-2.5 px-3 text-right">보류 수량</th>
                            <th className="py-2.5 px-3">상태</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {receivingHistory.map((rec) => (
                            <tr key={rec.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/50">
                              <td className="py-2.5 px-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                {rec.receivings?.receiving_number || "-"}
                              </td>
                              <td className="py-2.5 px-3 font-mono">{rec.receivings?.received_date || "-"}</td>
                              <td className="py-2.5 px-3">{rec.receivings?.warehouses?.name || "-"}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{rec.received_qty} EA</td>
                              <td className="py-2.5 px-3 text-right font-bold text-rose-600">{rec.damaged_qty || 0} EA</td>
                              <td className="py-2.5 px-3 text-right font-bold text-amber-600">{rec.hold_qty || 0} EA</td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                  {rec.receivings?.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: COST HISTORY */}
              {activeTab === "cost" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    수입원가 계산 및 오버라이드 히스토리
                  </h3>
                  
                  {costSummary?.history && costSummary.history.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-300">
                        <thead className="bg-zinc-50 text-[10px] uppercase font-bold text-zinc-400 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
                          <tr>
                            <th className="py-2.5 px-3">입고/정산일</th>
                            <th className="py-2.5 px-3">Landed Cost Case</th>
                            <th className="py-2.5 px-3 text-right">입고 수량</th>
                            <th className="py-2.5 px-3 text-right">매입가 (Acquisition)</th>
                            <th className="py-2.5 px-3 text-right">부대비용 (Ancillary)</th>
                            <th className="py-2.5 px-3 text-right">단가 (Unit Landed)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {costSummary.history.map((h: any) => (
                            <tr key={h.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/50">
                              <td className="py-2.5 px-3 font-mono">{h.received_date}</td>
                              <td className="py-2.5 px-3 font-mono text-indigo-600 dark:text-indigo-400">
                                {h.case?.landed_cost_number || "DIRECT_POSTING"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold">{h.inventory_received_qty} EA</td>
                              <td className="py-2.5 px-3 text-right font-mono">${h.supplier_acquisition_cost.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-right font-mono">${h.total_ancillary_cost.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                ${h.unit_landed_cost.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                      완료된 Landed Cost 정산 케이스 이력이 없습니다.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: PRICING & PROMOTIONS */}
              {activeTab === "pricing" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    상업용 도매가 및 프로모션 이력
                  </h3>

                  <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">현재 활성 도매 정책</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-zinc-400 block font-sans">Operational Wholesale:</span>
                        <strong className="text-sm text-zinc-900 dark:text-white">${product.operationalWholesale.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block font-sans">Promo Wholesale:</span>
                        <strong className="text-sm text-amber-600">{product.promoWholesale ? `$${product.promoWholesale.toFixed(2)}` : "없음"}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block font-sans">MAP:</span>
                        <strong className="text-sm text-zinc-900 dark:text-white">${product.mapPrice.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block font-sans">SRP:</span>
                        <strong className="text-sm text-zinc-900 dark:text-white">${product.srpPrice.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: SALES SUMMARY */}
              {activeTab === "sales" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    판매 실적 및 회전율 요약 (Sales & Turnover)
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <span className="text-[10px] font-bold text-zinc-400 block uppercase">Lifetime Sales</span>
                      <span className="text-lg font-bold text-zinc-900 dark:text-white">Integration Pending</span>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <span className="text-[10px] font-bold text-zinc-400 block uppercase">Last 30 Days</span>
                      <span className="text-lg font-bold text-zinc-900 dark:text-white">0 EA</span>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <span className="text-[10px] font-bold text-zinc-400 block uppercase">Sell-Through Rate</span>
                      <span className="text-lg font-bold text-zinc-900 dark:text-white">0%</span>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <span className="text-[10px] font-bold text-zinc-400 block uppercase">Days of Inventory</span>
                      <span className="text-lg font-bold text-zinc-900 dark:text-white">90+ Days</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 text-center">
                    리테일 POS 및 셀러 파트너 주문 데이터 연동 준비 중입니다.
                  </div>
                </div>
              )}

              {/* TAB 6: AUDIT / CHANGE LOG */}
              {activeTab === "audit" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    Trading Product 통합 추적 감사 로그 (Audit Trail - {historyLogs.length}건)
                  </h3>

                  {historyLogs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                      기록된 변경 감사 로그가 없습니다.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-300">
                        <thead className="bg-zinc-50 text-[10px] uppercase font-bold text-zinc-400 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
                          <tr>
                            <th className="py-2.5 px-3">일시</th>
                            <th className="py-2.5 px-3">변경 구분</th>
                            <th className="py-2.5 px-3">이전 값</th>
                            <th className="py-2.5 px-3">변경 값</th>
                            <th className="py-2.5 px-3">변경 사유</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {historyLogs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/50">
                              <td className="py-2.5 px-3 font-mono text-[11px]">
                                {new Date(log.created_at).toLocaleString("ko-KR")}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-indigo-600 dark:text-indigo-400">
                                {log.change_type}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-500">
                                {JSON.stringify(log.before_value)}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-zinc-900 dark:text-white">
                                {JSON.stringify(log.after_value)}
                              </td>
                              <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-300">
                                {log.reason || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

      </div>

      {/* MODAL 1: EDIT PRICING */}
      {isPricingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Trading Product 도매가 / MAP / SRP 수정
            </h3>
            {pricingError && <p className="text-xs text-rose-600">{pricingError}</p>}
            <form onSubmit={handlePricingSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300">Operational Wholesale Price ($USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={editWholesale}
                  onChange={(e) => setEditWholesale(e.target.value)}
                  required
                  className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">MAP ($USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editMap}
                    onChange={(e) => setEditMap(e.target.value)}
                    className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">SRP ($USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editSrp}
                    onChange={(e) => setEditSrp(e.target.value)}
                    className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300">변경 사유 (Reason) *</label>
                <input
                  type="text"
                  value={editPricingReason}
                  onChange={(e) => setEditPricingReason(e.target.value)}
                  placeholder="예: 리테일 프로모션 정책 조정"
                  required
                  className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPricingModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPricingSubmitting}
                  className="px-3 py-1.5 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold"
                >
                  {isPricingSubmitting ? "저장 중..." : "도매가 적용"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD PROMOTION */}
      {isPromoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              프로모션 도매가 등록
            </h3>
            {promoError && <p className="text-xs text-rose-600">{promoError}</p>}
            <form onSubmit={handlePromoSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300">Promotional Wholesale Price ($USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editPromoPrice}
                  onChange={(e) => setEditPromoPrice(e.target.value)}
                  placeholder="비워둘 경우 프로모션 해제"
                  className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">시작일</label>
                  <input
                    type="date"
                    value={editPromoStart}
                    onChange={(e) => setEditPromoStart(e.target.value)}
                    className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">종료일</label>
                  <input
                    type="date"
                    value={editPromoEnd}
                    onChange={(e) => setEditPromoEnd(e.target.value)}
                    className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300">프로모션 사유 *</label>
                <input
                  type="text"
                  value={editPromoReason}
                  onChange={(e) => setEditPromoReason(e.target.value)}
                  placeholder="예: Q4 블랙프라이데이 할인"
                  required
                  className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPromoModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPromoSubmitting}
                  className="px-3 py-1.5 rounded bg-amber-600 text-white font-bold"
                >
                  {isPromoSubmitting ? "저장 중..." : "프로모션 저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: COST OVERRIDE */}
      {isCostOverrideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              수입원가 수동 오버라이드 (Manual Landed Cost Override)
            </h3>
            <p className="text-xs text-zinc-500">
              현재 시스템 원가(Base Landed Cost): <strong>${product.baseLandedCost.toFixed(2)}</strong>
            </p>
            {costOverrideError && <p className="text-xs text-rose-600">{costOverrideError}</p>}
            <form onSubmit={handleCostOverrideSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300">오버라이드 적용 원가 ($USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={editCostOverride}
                  onChange={(e) => setEditCostOverride(e.target.value)}
                  required
                  className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300">오버라이드 변경 사유 (Reason) *</label>
                <textarea
                  value={editCostReason}
                  onChange={(e) => setEditCostReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="원가 오버라이드 사유를 입력하세요 (예: 관세 환급 반영 또는 특별 부대비용 보정)"
                  className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCostOverrideModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isCostSubmitting}
                  className="px-3 py-1.5 rounded bg-indigo-600 text-white font-bold"
                >
                  {isCostSubmitting ? "저장 중..." : "오버라이드 저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: OPENING BALANCE */}
      {isOpeningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">기초 재고 등록</h3>
            {openError && <p className="text-xs text-rose-600">{openError}</p>}
            <form onSubmit={handleOpenSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300">물류창고 선택 *</label>
                <select
                  value={openWarehouseId}
                  onChange={(e) => setOpenWarehouseId(e.target.value)}
                  required
                  className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                >
                  <option value="">-- 창고 선택 --</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300">기초 재고 수량 (EA) *</label>
                <input
                  type="number"
                  value={openQty}
                  onChange={(e) => setOpenQty(e.target.value)}
                  required
                  min="0"
                  className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                />
              </div>
              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300">메모</label>
                <input
                  type="text"
                  value={openNote}
                  onChange={(e) => setOpenNote(e.target.value)}
                  placeholder="예: 최초 입고 실사 재고 등록"
                  className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpeningModalOpen(false)}
                  className="px-3 py-1.5 rounded border text-zinc-700 dark:text-zinc-300"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isOpeningSubmitting}
                  className="px-3 py-1.5 rounded bg-emerald-600 text-white font-bold"
                >
                  {isOpeningSubmitting ? "등록 중..." : "등록 완료"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: MANUAL ADJUSTMENT */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">수동 재고 조정</h3>
            {adjError && <p className="text-xs text-rose-600">{adjError}</p>}
            <form onSubmit={handleAdjSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300">물류창고 선택 *</label>
                <select
                  value={adjWarehouseId}
                  onChange={(e) => setAdjWarehouseId(e.target.value)}
                  required
                  className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                >
                  <option value="">-- 창고 선택 --</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">On Hand 변동 (+/-)</label>
                  <input
                    type="number"
                    value={adjQtyChange}
                    onChange={(e) => setAdjQtyChange(e.target.value)}
                    required
                    className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">Hold 변동 (+/-)</label>
                  <input
                    type="number"
                    value={adjQtyHoldChange}
                    onChange={(e) => setAdjQtyHoldChange(e.target.value)}
                    required
                    className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300">조정 사유 *</label>
                <input
                  type="text"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  required
                  className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                />
              </div>
              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300">메모</label>
                <input
                  type="text"
                  value={adjNote}
                  onChange={(e) => setAdjNote(e.target.value)}
                  className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustmentModalOpen(false)}
                  className="px-3 py-1.5 rounded border text-zinc-700 dark:text-zinc-300"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isAdjustmentSubmitting}
                  className="px-3 py-1.5 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold"
                >
                  {isAdjustmentSubmitting ? "조정 중..." : "조정 완료"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
