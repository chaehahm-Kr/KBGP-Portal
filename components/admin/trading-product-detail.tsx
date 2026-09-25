"use client";

import React, { useState, useMemo } from "react";
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
  overrideUpdatedBy?: string | null;
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

interface InboundSummaryItem {
  incomingQty: number;
  openInboundCount: number;
  nextEta: string | null;
  destinationWarehouseName: string | null;
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
  inboundSummary?: InboundSummaryItem;
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

const FIELD_LABEL_MAP: Record<string, string> = {
  wholesale_price: "Wholesale Price (도매가)",
  trading_wholesale_price: "Wholesale Price (도매가)",
  promo_wholesale_price: "Promo Wholesale Price (프로모션 도매가)",
  trading_promo_wholesale_price: "Promo Wholesale Price (프로모션 도매가)",
  map_price: "MAP Price (최저준수가격)",
  trading_map_price: "MAP Price (최저준수가격)",
  srp_price: "SRP Price (권장소비자가격)",
  trading_srp_price: "SRP Price (권장소비자가격)",
  override_landed_cost: "Override Landed Cost (수동 원가)",
  effective_landed_cost: "Effective Landed Cost (적용 수입원가)",
  pricing_note: "Pricing Note (가격 메모)",
  trading_pricing_note: "Pricing Note (가격 메모)",
  promo_start_date: "Promo Start Date (프로모션 시작일)",
  promo_end_date: "Promo End Date (프로모션 종료일)",
  qty_on_hand: "On Hand Stock (물리 재고)",
  qty_damaged: "Damaged Stock (불량 재고)",
  qty_hold: "Hold Stock (보류 재고)",
  trading_status: "Operating Status (운영 상태)",
  selection_status: "Selection Status (선정 상태)",
};

function formatValue(key: string, val: any): string {
  if (val === null || val === undefined || val === "") return "Not Set (미설정)";
  if (typeof val === "number") {
    if (key.includes("price") || key.includes("cost") || key.includes("wholesale") || key.includes("srp") || key.includes("map")) {
      return `$${val.toFixed(2)}`;
    }
    return val.toString();
  }
  if (typeof val === "boolean") return val ? "Active (활성)" : "Inactive (비활성)";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

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
  inboundSummary = {
    incomingQty: 0,
    openInboundCount: 0,
    nextEta: null,
    destinationWarehouseName: null,
  },
}: TradingProductDetailProps) {
  const router = useRouter();

  // Aggregate inventory totals
  const totalOnHand = initialBalances.reduce((sum, b) => sum + b.qty_on_hand, 0);
  const totalHold = initialBalances.reduce((sum, b) => sum + b.qty_hold, 0);
  const totalDamaged = initialBalances.reduce((sum, b) => sum + (b.qty_damaged || 0), 0);
  const totalAvailable = Math.max(0, totalOnHand - totalHold - totalDamaged);

  // Active Tab for Lower Full-Width Section
  const [activeTab, setActiveTab] = useState<"inventory" | "po" | "cost" | "pricing" | "sales" | "audit">("inventory");

  // Show raw JSON toggle for audit log
  const [showRawJson, setShowRawJson] = useState(false);

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

  // Combine System Landed Cost History + Manual Cost Override History into a single timeline
  const combinedCostTimeline = useMemo(() => {
    const events: any[] = [];

    if (costSummary?.history) {
      costSummary.history.forEach((h: any) => {
        events.push({
          id: `system-${h.id}`,
          date: h.received_date,
          timestamp: new Date(h.received_date).getTime(),
          eventType: "SYSTEM_LANDED_COST",
          title: "Landed Cost Calculated (시스템 정산)",
          caseNumber: h.case?.landed_cost_number || "DIRECT_POSTING",
          receivedQty: h.inventory_received_qty,
          acquisitionCost: h.supplier_acquisition_cost,
          ancillaryCost: h.total_ancillary_cost,
          unitLandedCost: h.unit_landed_cost,
          effectiveCost: h.unit_landed_cost,
          user: "System",
          status: "Calculated",
        });
      });
    }

    historyLogs.forEach((log: any) => {
      if (log.change_type === "COST_OVERRIDE") {
        const after = log.after_value || {};
        const before = log.before_value || {};
        const newOverride = after.override_landed_cost !== undefined ? after.override_landed_cost : null;
        const prevOverride = before.override_landed_cost !== undefined ? before.override_landed_cost : null;

        events.push({
          id: `override-${log.id}`,
          date: new Date(log.created_at).toISOString().split("T")[0],
          timestamp: new Date(log.created_at).getTime(),
          eventType: newOverride !== null ? "MANUAL_OVERRIDE" : "OVERRIDE_CLEARED",
          title: newOverride !== null ? "Manual Cost Override (수동 원가 적용)" : "Cost Override Cleared (오버라이드 해제)",
          caseNumber: "-",
          receivedQty: "-",
          acquisitionCost: "-",
          ancillaryCost: "-",
          unitLandedCost: product.baseLandedCost,
          prevEffectiveCost: prevOverride !== null ? prevOverride : product.baseLandedCost,
          newEffectiveCost: newOverride !== null ? newOverride : product.baseLandedCost,
          overrideCost: newOverride,
          reason: log.reason || after.reason || "Manual adjustment",
          user: log.creator?.full_name || "Admin",
          status: newOverride === product.overrideLandedCost ? "Active" : "Superseded",
        });
      }
    });

    return events.sort((a, b) => b.timestamp - a.timestamp);
  }, [costSummary, historyLogs, product]);

  // Parse audit logs into human-readable field-level change rows
  const parsedAuditRows = useMemo(() => {
    const rows: any[] = [];

    historyLogs.forEach((log: any) => {
      const dateStr = new Date(log.created_at).toLocaleString("ko-KR");
      const user = log.creator?.full_name || "Admin";
      const category = log.change_type || "GENERAL";
      const reason = log.reason || "-";

      const beforeObj = log.before_value || {};
      const afterObj = log.after_value || {};

      const allKeys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]));
      const displayKeys = allKeys.filter(k => !["updated_at", "updated_by", "id"].includes(k));

      if (displayKeys.length === 0) {
        rows.push({
          id: `${log.id}-summary`,
          date: dateStr,
          category,
          field: log.field_name || "General Change",
          prevVal: formatValue("general", beforeObj),
          newVal: formatValue("general", afterObj),
          reason,
          user,
        });
      } else {
        displayKeys.forEach((key) => {
          const fieldLabel = FIELD_LABEL_MAP[key] || key;
          const prevVal = formatValue(key, beforeObj[key]);
          const newVal = formatValue(key, afterObj[key]);

          rows.push({
            id: `${log.id}-${key}`,
            date: dateStr,
            category,
            field: fieldLabel,
            prevVal,
            newVal,
            reason,
            user,
          });
        });
      }
    });

    return rows;
  }, [historyLogs]);

  // Compute active operational alerts
  const activeAlerts = useMemo(() => {
    const alerts = [];
    if (totalAvailable < 10) {
      alerts.push({
        id: "low_stock",
        type: "danger",
        title: "안전 재고 부족",
        message: `현재 판매 가능 재고가 ${totalAvailable}개로 안전 재고(10개) 미만입니다.`,
      });
    }
    if (totalDamaged > 0) {
      alerts.push({
        id: "damaged_stock",
        type: "warning",
        title: "불량 재고 격리",
        message: `불량 재고 ${totalDamaged}개가 감지되어 판매 가능 수량에서 차감되어 있습니다.`,
      });
    }
    if (totalHold > 0) {
      alerts.push({
        id: "hold_stock",
        type: "warning",
        title: "보류 재고 관리",
        message: `검토 보류 재고 ${totalHold}개가 지정되어 있습니다.`,
      });
    }
    if (product.ourMarginPercent < 20) {
      alerts.push({
        id: "low_margin",
        type: "danger",
        title: "자사 마진 임계치 미달",
        message: `현재 적용 마진(${product.ourMarginPercent.toFixed(1)}%)이 목표 최소 기준(20.0%)보다 낮습니다.`,
      });
    }
    if (product.isPromoActive) {
      alerts.push({
        id: "active_promo",
        type: "info",
        title: "프로모션 도매가 적용 중",
        message: `할인 도매가 $${product.promoWholesale?.toFixed(2)}가 진행 중입니다.`,
      });
    }
    if (product.hasCostOverride) {
      alerts.push({
        id: "cost_override",
        type: "info",
        title: "수입원가 오버라이드 활성",
        message: `수동 오버라이드 원가 $${product.overrideLandedCost?.toFixed(2)}가 마진 계산 엔진에 적용되어 있습니다.`,
      });
    }
    return alerts;
  }, [totalAvailable, totalDamaged, totalHold, product]);

  return (
    <div className="space-y-6">
      {/* 1. CLEAN TOP GLOBAL HEADER (NAVIGATION & PRODUCT TITLE ONLY - NO DUPLICATE OPERATIONAL CTAS) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
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
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                SALES_COLORS[product.sales_status] || SALES_COLORS.PREPARING
              }`}
            >
              {SALES_LABELS[product.sales_status] || product.sales_status}
            </span>
          </div>
        </div>
      </div>

      {/* 2. TOP OPERATIONAL SNAPSHOT AREA (FULL-WIDTH RESPONSIVE GRID CARDS) */}
      <div className="space-y-4">
        {/* ROW 1: Product Summary, Inventory Snapshot, Cost Snapshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* A. Product Summary Card (with Catalog Master Reference Button) */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                제품 식별 요약 (Product Identity)
              </h3>
              <Link
                href={`/admin/products/${product.id}`}
                className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white underline transition-colors"
              >
                Catalog Master View →
              </Link>
            </div>

            <div className="flex items-start gap-3.5">
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

          {/* B. Inventory Snapshot Card (with Inbound Mini Panel) */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                실시간 재고 스냅샷 (Inventory Snapshot)
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsOpeningModalOpen(true)}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  + 기초 재고
                </button>
                <button
                  onClick={() => setIsAdjustmentModalOpen(true)}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  수동 조정
                </button>
              </div>
            </div>

            {/* Main Physical Stock KPIs */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block uppercase">Available (판매가능)</span>
                <span className="text-xl font-extrabold text-emerald-800 dark:text-emerald-300">{totalAvailable.toLocaleString()} EA</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-500 block uppercase">On Hand (물리재고)</span>
                <span className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100">{totalOnHand.toLocaleString()} EA</span>
              </div>
              <div className="p-2 rounded bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
                <span className="text-[9px] font-bold text-rose-700 dark:text-rose-400 block uppercase">Damaged (불량)</span>
                <span className="text-xs font-bold text-rose-800 dark:text-rose-300">{totalDamaged.toLocaleString()} EA</span>
              </div>
              <div className="p-2 rounded bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 block uppercase">Hold (보류)</span>
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300">{totalHold.toLocaleString()} EA</span>
              </div>
            </div>

            {/* ENHANCED CANONICAL INBOUND MINI PANEL (Section 5 & 9) */}
            <div className="p-2.5 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 space-y-1.5 text-xs">
              <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/40 pb-1">
                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase flex items-center gap-1">
                  <span>🚢 Canonical Inbound Snapshot (입고 예정)</span>
                </span>
                <button
                  onClick={() => setActiveTab("po")}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 underline"
                >
                  View Open Inbound →
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 text-[10px] block">Incoming Qty:</span>
                  <strong className="text-indigo-900 dark:text-indigo-200 font-bold text-xs">
                    {inboundSummary.incomingQty.toLocaleString()} EA
                  </strong>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 text-[10px] block">Open Inbound:</span>
                  <strong className="text-zinc-800 dark:text-zinc-200 font-bold">
                    {inboundSummary.openInboundCount}건
                  </strong>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 text-[10px] block">Next ETA:</span>
                  <strong className="text-zinc-800 dark:text-zinc-200 font-mono">
                    {inboundSummary.nextEta || "-"}
                  </strong>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 text-[10px] block">Destination:</span>
                  <strong className="text-zinc-800 dark:text-zinc-200 truncate block">
                    {inboundSummary.destinationWarehouseName || "-"}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* C. Cost Snapshot Card (with Contextual Cost Override Actions) */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                3-Layer 원가 스냅샷 (Cost Snapshot)
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsCostOverrideModalOpen(true)}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                >
                  {product.hasCostOverride ? "Edit Override" : "Override Cost"}
                </button>
                {product.hasCostOverride && (
                  <button
                    onClick={handleClearCostOverride}
                    className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 transition-colors"
                  >
                    해제
                  </button>
                )}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase">
                <span>Effective Landed Cost (적용 수입원가)</span>
                <span>Margin Driver</span>
              </div>
              <div className="text-2xl font-black text-indigo-900 dark:text-indigo-200">
                ${product.effectiveLandedCost.toFixed(2)}
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                {product.hasCostOverride ? (
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                    수동 원가 오버라이드 적용 중 (사유: {product.overrideReason || "운영 조정"})
                  </span>
                ) : (
                  <span>Purchasing Landed Cost 수입 정산 기반 실시간 원가</span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-850">
                <span className="text-[9px] font-bold text-zinc-400 block uppercase">Base Landed Cost</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-200">${product.baseLandedCost.toFixed(2)}</span>
              </div>
              <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-850">
                <span className="text-[9px] font-bold text-zinc-400 block uppercase">Override Cost</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-200">
                  {product.overrideLandedCost !== null ? `$${product.overrideLandedCost.toFixed(2)}` : "-"}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Link
                href="/admin/purchasing/landed-cost"
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View Landed Cost Cases →
              </Link>
            </div>
          </div>

        </div>

        {/* ROW 2: Pricing & Margin Snapshot, Operational Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          
          {/* D. Pricing & Margin Snapshot Card (with Contextual Pricing Actions - col-span-8) */}
          <div className="md:col-span-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                가격 및 마진 스냅샷 (Pricing & Margin Snapshot)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPricingModalOpen(true)}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 transition-colors shadow-sm"
                >
                  도매가 설정
                </button>
                <button
                  onClick={() => setIsPromoModalOpen(true)}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm"
                >
                  + 프로모션 등록
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Wholesale Price (도매가)</span>
                <span className="text-base font-extrabold text-zinc-900 dark:text-white">${product.operationalWholesale.toFixed(2)}</span>
              </div>
              <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Promo Wholesale (프로모션가)</span>
                <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                  {product.promoWholesale !== null ? `$${product.promoWholesale.toFixed(2)}` : "-"}
                </span>
              </div>
              <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-850">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">MAP (최저준수가격)</span>
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-200">${product.mapPrice.toFixed(2)}</span>
              </div>
              <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-850">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">SRP (권장소비자가)</span>
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-200">${product.srpPrice.toFixed(2)}</span>
              </div>
            </div>

            {/* Calculated Operating Margins */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block uppercase">Our Margin (자사 마진)</span>
                <div className="text-lg font-extrabold text-emerald-800 dark:text-emerald-300">
                  {product.ourMarginPercent.toFixed(1)}% <span className="text-xs font-normal">(${product.ourMarginUsd.toFixed(2)})</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/40">
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 block uppercase">Retailer Margin (리테일러 마진)</span>
                <div className="text-lg font-extrabold text-blue-800 dark:text-blue-300">
                  {product.retailerMarginPercent.toFixed(1)}% <span className="text-xs font-normal">(${product.retailerMarginUsd.toFixed(2)})</span>
                </div>
              </div>
            </div>
          </div>

          {/* E. Operational Alerts Card (col-span-4) */}
          <div className="md:col-span-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
              운영 감지 & 알림 (Operational Alerts)
            </h3>
            
            <div className="space-y-2 text-xs flex-1">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-2.5 rounded-lg border text-xs ${
                    alert.type === "danger"
                      ? "bg-rose-50/80 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50"
                      : alert.type === "warning"
                      ? "bg-amber-50/80 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50"
                      : "bg-indigo-50/80 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50"
                  }`}
                >
                  <strong className="block text-[11px] font-bold">{alert.title}</strong>
                  <p className="text-[11px] opacity-90 mt-0.5">{alert.message}</p>
                </div>
              ))}

              {activeAlerts.length === 0 && (
                <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 text-xs font-medium">
                  ✅ <strong>정상 운영 상태:</strong> 감지된 예외 사항이 없습니다.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 3. LOWER FULL-WIDTH HISTORY AREA (BILINGUAL 6-TAB HEADER WITH ZERO SCROLLBAR) */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        
        {/* Full-Width Tab Header */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
          {[
            { id: "inventory", en: "Inventory", ko: "재고 변동" },
            { id: "po", en: "PO / Inbound", ko: "입고 이력" },
            { id: "cost", en: "Cost History", ko: "원가 이력" },
            { id: "pricing", en: "Pricing", ko: "가격/프로모션" },
            { id: "sales", en: "Sales", ko: "판매 요약" },
            { id: "audit", en: "Audit Log", ko: "변경 이력" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2.5 px-2 text-center transition-colors border-b-2 flex flex-col items-center justify-center ${
                activeTab === tab.id
                  ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white bg-white dark:bg-zinc-900 font-bold"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <span className="text-xs leading-tight font-semibold">{tab.en}</span>
              <span className="text-[10px] font-normal text-zinc-400 dark:text-zinc-500">{tab.ko}</span>
            </button>
          ))}
        </div>

        {/* Full-Width Tab Content Panels */}
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
                        <th className="py-2.5 px-3 text-right">잔고 (OnHand / Damaged / Hold)</th>
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
                            {m.balance_on_hand_after} / {m.balance_damaged_after || 0} / {m.balance_hold_after || 0}
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

          {/* TAB 3: COST HISTORY (INCLUDES SYSTEM LANDED COST + MANUAL OVERRIDE HISTORY) */}
          {activeTab === "cost" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  수입원가 통합 히스토리 (System Landed Cost + Manual Cost Override - {combinedCostTimeline.length}건)
                </h3>
              </div>

              {combinedCostTimeline.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                  기록된 원가 산정 및 오버라이드 이력이 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-300">
                    <thead className="bg-zinc-50 text-[10px] uppercase font-bold text-zinc-400 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
                      <tr>
                        <th className="py-2.5 px-3">일시</th>
                        <th className="py-2.5 px-3">이벤트 구분</th>
                        <th className="py-2.5 px-3 text-right">이전 적용원가</th>
                        <th className="py-2.5 px-3 text-right">신규 적용원가</th>
                        <th className="py-2.5 px-3 text-right">Base Landed Cost</th>
                        <th className="py-2.5 px-3 text-right">Override Cost</th>
                        <th className="py-2.5 px-3">사유 및 출처</th>
                        <th className="py-2.5 px-3">담당자</th>
                        <th className="py-2.5 px-3">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {combinedCostTimeline.map((item) => (
                        <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/50">
                          <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">{item.date}</td>
                          <td className="py-2.5 px-3">
                            {item.eventType === "SYSTEM_LANDED_COST" ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                System Landed Cost
                              </span>
                            ) : item.eventType === "MANUAL_OVERRIDE" ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                                Manual Cost Override
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                                Override Cleared
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {item.prevEffectiveCost !== undefined ? `$${item.prevEffectiveCost.toFixed(2)}` : "-"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            ${item.newEffectiveCost !== undefined ? item.newEffectiveCost.toFixed(2) : item.unitLandedCost?.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-zinc-500">
                            ${item.unitLandedCost?.toFixed(2) || item.baseLandedCost?.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold">
                            {item.overrideCost !== undefined && item.overrideCost !== null ? `$${item.overrideCost.toFixed(2)}` : "-"}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-300 text-[11px]">
                            {item.reason || item.caseNumber || "-"}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-500 text-[11px]">{item.user}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                              item.status === "Active"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PRICING & PROMOTIONS */}
          {activeTab === "pricing" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                상업용 도매가 및 프로모션 정책
              </h3>

              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">현재 활성 도매 정책 (Active Policy)</span>
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
                판매 실적 및 회전율 요약 (Sales Summary)
              </h3>

              <div className="p-6 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-center space-y-2">
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Sales data is not available yet.
                </p>
                <p className="text-[11px] text-zinc-400">
                  리테일 POS 및 셀러 파트너 주문 실적 데이터 연동 준비 중입니다.
                </p>
              </div>
            </div>
          )}

          {/* TAB 6: AUDIT LOG (HUMAN-READABLE DEFAULT + OPTIONAL RAW JSON TOGGLE) */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Trading Product 변경 감사 로그 (Human-Readable Audit Log - {parsedAuditRows.length}건)
                </h3>
                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 transition-colors"
                >
                  {showRawJson ? "숨기기 (Hide Raw JSON)" : "View Raw JSON"}
                </button>
              </div>

              {parsedAuditRows.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                  기록된 변경 감사 로그가 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-300">
                    <thead className="bg-zinc-50 text-[10px] uppercase font-bold text-zinc-400 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
                      <tr>
                        <th className="py-2.5 px-3">일시</th>
                        <th className="py-2.5 px-3">구분 (Category)</th>
                        <th className="py-2.5 px-3">항목 (Field)</th>
                        <th className="py-2.5 px-3">이전 값 (Previous)</th>
                        <th className="py-2.5 px-3">신규 값 (New)</th>
                        <th className="py-2.5 px-3">변경 사유 (Reason)</th>
                        <th className="py-2.5 px-3">작성자 (User)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {parsedAuditRows.map((row) => (
                        <tr key={row.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/50">
                          <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">{row.date}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/40">
                              {row.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-zinc-100">
                            {row.field}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-500">
                            {row.prevVal}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-zinc-900 dark:text-white">
                            {row.newVal}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-300 text-[11px]">
                            {row.reason}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-500 text-[11px] whitespace-nowrap">
                            {row.user}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Optional Admin Collapsible Raw JSON Viewer */}
              {showRawJson && (
                <div className="mt-4 p-4 rounded-lg bg-zinc-950 text-zinc-200 text-xs font-mono overflow-x-auto space-y-2 border border-zinc-800">
                  <div className="font-bold text-amber-400">Raw Audit History Logs (Admin Debug View)</div>
                  <pre>{JSON.stringify(historyLogs, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

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
                  className="w-full mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-bold"
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
                  placeholder="예: 리테일 도매 정책 조정"
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
