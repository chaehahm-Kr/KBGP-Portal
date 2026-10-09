"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { recordManualAdjustment } from "@/lib/inventory/actions";
import {
  updateTradingPricing,
  updateTradingPromotion,
  updateTradingCostOverride,
  clearTradingCostOverride,
  updateTradingStatusAndVisibility,
  updateLetustoSku,
} from "@/lib/product/trading-actions";
import {
  TRADING_STATUS_LABELS,
  TRADING_STATUS_STYLES,
  RETAILER_VISIBILITY_LABELS,
  RETAILER_VISIBILITY_STYLES,
  TradingStatus,
  RetailerVisibility,
  evaluateTradingOrderability,
} from "@/lib/product/registration-status";
import { safeFormatUsd, safeFormatPercent } from "@/lib/product/pricing-resolver";
import { type ResolvedRetailerSalesPolicy, resolveRetailerSalesPolicy } from "@/lib/product/retailer-policy";
import { evaluateHubVisibility, type HubVisibilityEvaluation } from "@/lib/product/hub-visibility";
import { resolveActiveMarketingBadges } from "@/lib/product/badge-utils";
import { RetailerSalesPolicyCard } from "@/components/admin/retailer-sales-policy-card";
import { HubBadgesCard } from "@/components/admin/hub-badges-card";
import {
  INVENTORY_ADJUSTMENT_REASONS,
  DEFAULT_INVENTORY_ADJUSTMENT_REASON,
  OTHER_INVENTORY_ADJUSTMENT_REASON,
  formatInventoryAdjustmentReason,
} from "@/lib/constants/inventory";

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
  photoUrls?: string[];
  upc?: string | null;
  selection_status: string;
  sales_status?: string;
  trading_status: string;
  retailer_visibility: string;
  category_code: string | null;
  category_full_path: string;
  registration_status?: string;

  // Case Pack & MOQ
  carton_pack_qty: number;
  hasCasePackConfigured?: boolean;
  moq: number;
  orderMultiple: number;

  // Currency & Registration completeness
  price_krw_retail?: number | null;
  price_krw_wholesale?: number | null;
  registration_missing_fields?: string[];

  // Pricing & Costs
  defaultWholesale: number;
  defaultSrp: number;
  defaultMap: number;
  operationalWholesale: number;
  effectiveWholesale: number;
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

  ourMarginUsd: number | null;
  ourMarginPercent: number | null;
  baseOurMarginUsd: number | null;
  baseOurMarginPercent: number | null;
  retailerMarginUsd: number | null;
  retailerMarginPercent: number | null;
  baseRetailerMarginUsd: number | null;
  baseRetailerMarginPercent: number | null;

  orderability?: {
    isOrderable: boolean;
    reason: string | null;
  };
  salesPolicy?: ResolvedRetailerSalesPolicy;

  hubVisibility?: HubVisibilityEvaluation;
  effectiveHubVisibility?: string;
  effectiveHubVisibilityLabel?: string;
  effectiveHubVisibilityDescription?: string;
  holdReasons?: string[];
  holdReasonLabels?: string[];
  isSoldOut?: boolean;
  orderabilityStatus?: string;
  orderabilityLabel?: string;
  orderabilityReason?: string;
  hubBadges?: any;
  price_additional_info?: any;
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

const TRADING_COLORS: Record<string, string> = {
  active: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  inactive: "bg-zinc-100 text-zinc-650 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  historical: "bg-zinc-200 text-zinc-650 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-800",
};

const TRADING_LABELS: Record<string, string> = {
  active: "운영 중 (Active)",
  inactive: "운영 중지 (Inactive)",
  historical: "운영 종료 (Historical)",
};

const VISIBILITY_COLORS: Record<string, string> = {
  visible: "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  hidden: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
};

const VISIBILITY_LABELS: Record<string, string> = {
  visible: "노출 (Visible)",
  hidden: "비노출 (Hidden)",
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

export type BusinessTab = "summary" | "inventory" | "price" | "hub" | "history";

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
  const searchParams = useSearchParams();

  // Aggregate inventory totals
  const totalOnHand = initialBalances.reduce((sum, b) => sum + b.qty_on_hand, 0);
  const totalHold = initialBalances.reduce((sum, b) => sum + b.qty_hold, 0);
  const totalDamaged = initialBalances.reduce((sum, b) => sum + (b.qty_damaged || 0), 0);
  const totalAvailable = Math.max(0, totalOnHand - totalHold - totalDamaged);

  // Active Tab state synced with URL ?tab=...
  const [activeTab, setActiveTab] = useState<BusinessTab>("summary");
  const [holdHighlight, setHoldHighlight] = useState(false);

  useEffect(() => {
    const tabParam = searchParams?.get("tab");
    if (tabParam && ["summary", "inventory", "price", "hub", "history"].includes(tabParam)) {
      setActiveTab(tabParam as BusinessTab);
    }
    if (typeof window !== "undefined" && window.location.hash === "#hold-alerts") {
      setActiveTab("hub");
      setTimeout(() => {
        const el = document.getElementById("hold-alerts");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setHoldHighlight(true);
          setTimeout(() => setHoldHighlight(false), 3000);
        }
      }, 250);
    }
  }, [searchParams]);

  const handleTabChange = (newTab: BusinessTab) => {
    setActiveTab(newTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", newTab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const navigateToHoldAlerts = () => {
    setActiveTab("hub");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "hub");
      url.hash = "hold-alerts";
      window.history.replaceState({}, "", url.toString());
      setTimeout(() => {
        const el = document.getElementById("hold-alerts");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setHoldHighlight(true);
          setTimeout(() => setHoldHighlight(false), 3000);
        }
      }, 150);
    }
  };

  // Audit Log Filters
  const [showRawJson, setShowRawJson] = useState(false);
  const [historyFilterType, setHistoryFilterType] = useState<"ALL" | "INV" | "PRICE" | "COST" | "HUB" | "SALES">("ALL");

  // Letusto SKU Editing State
  const [letustoSku, setLetustoSku] = useState<string>(product.letusto_sku || "");
  const [isEditingSku, setIsEditingSku] = useState(false);
  const [skuInput, setSkuInput] = useState<string>(product.letusto_sku || "");
  const [skuReason, setSkuReason] = useState<string>("");
  const [skuError, setSkuError] = useState<string>("");
  const [isSkuSubmitting, setIsSkuSubmitting] = useState(false);

  const handleStartEditSku = () => {
    setSkuInput(letustoSku);
    setSkuReason("");
    setSkuError("");
    setIsEditingSku(true);
  };

  const handleCancelEditSku = () => {
    setSkuInput(letustoSku);
    setSkuError("");
    setIsEditingSku(false);
  };

  const handleSaveSku = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSkuError("");
    const trimmed = skuInput.trim();
    if (trimmed.length > 64) {
      setSkuError("Letusto SKU는 최대 64자까지 입력할 수 있습니다.");
      return;
    }
    setIsSkuSubmitting(true);
    try {
      const res = await updateLetustoSku(product.id, {
        letusto_sku: trimmed.length > 0 ? trimmed : null,
        reason: skuReason.trim() || "Letusto SKU updated via Trading Product Detail",
      });
      if (res?.success) {
        setLetustoSku(res.letusto_sku || "");
        setIsEditingSku(false);
        router.refresh();
      }
    } catch (err: any) {
      setSkuError(err.message || "Letusto SKU 저장 실패");
    } finally {
      setIsSkuSubmitting(false);
    }
  };

  // Location selection for Inventory Snapshot
  const [selectedLocationId, setSelectedLocationId] = useState<string>("ALL");

  const activeLocationBalance = useMemo(() => {
    if (selectedLocationId === "ALL") {
      return {
        isAll: true,
        warehouseName: "전체 로케이션 (ALL Locations)",
        warehouseCode: "ALL",
        onHand: totalOnHand,
        damaged: totalDamaged,
        hold: totalHold,
        available: totalAvailable,
      };
    }
    const found = initialBalances.find((b) => b.warehouse_id === selectedLocationId);
    const onHand = found ? found.qty_on_hand : 0;
    const damaged = found ? (found.qty_damaged || 0) : 0;
    const hold = found ? found.qty_hold : 0;
    const available = Math.max(0, onHand - damaged - hold);
    const whObj = warehouses.find((w) => w.id === selectedLocationId);
    return {
      isAll: false,
      warehouseName: whObj ? `${whObj.name} (${whObj.code})` : "선택된 창고",
      warehouseCode: whObj?.code || "",
      onHand,
      damaged,
      hold,
      available,
    };
  }, [selectedLocationId, initialBalances, warehouses, totalOnHand, totalDamaged, totalHold, totalAvailable]);

  // Unified Inventory Adjustment Modal State
  const [isInvAdjustModalOpen, setIsInvAdjustModalOpen] = useState(false);
  const [invAdjWarehouseId, setInvAdjWarehouseId] = useState("");
  const [invAdjMode, setInvAdjMode] = useState<"DELTA" | "TARGET">("DELTA");
  const [invAdjMovementType, setInvAdjMovementType] = useState<"MANUAL_ADJUSTMENT" | "OPENING_BALANCE">("MANUAL_ADJUSTMENT");

  const [invDeltaOnHand, setInvDeltaOnHand] = useState("0");
  const [invDeltaDamaged, setInvDeltaDamaged] = useState("0");
  const [invDeltaHold, setInvDeltaHold] = useState("0");

  const [invTargetOnHand, setInvTargetOnHand] = useState("0");
  const [invTargetDamaged, setInvTargetDamaged] = useState("0");
  const [invTargetHold, setInvTargetHold] = useState("0");

  const [invAdjReason, setInvAdjReason] = useState<string>(DEFAULT_INVENTORY_ADJUSTMENT_REASON);
  const [invAdjCustomReason, setInvAdjCustomReason] = useState("");
  const [invAdjNote, setInvAdjNote] = useState("");
  const [invAdjError, setInvAdjError] = useState("");
  const [isInvAdjSubmitting, setIsInvAdjSubmitting] = useState(false);

  // Modals state
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isCostOverrideModalOpen, setIsCostOverrideModalOpen] = useState(false);

  const handleOpenInvAdjustModal = (whId?: string, defaultMode: "DELTA" | "TARGET" = "DELTA") => {
    const targetWhId = whId || (selectedLocationId !== "ALL" ? selectedLocationId : (warehouses[0]?.id || ""));
    setInvAdjWarehouseId(targetWhId);
    setInvAdjMode(defaultMode);

    const existing = initialBalances.find((b) => b.warehouse_id === targetWhId);
    const curOnHand = existing?.qty_on_hand || 0;
    const curDamaged = existing?.qty_damaged || 0;
    const curHold = existing?.qty_hold || 0;

    setInvDeltaOnHand("0");
    setInvDeltaDamaged("0");
    setInvDeltaHold("0");

    setInvTargetOnHand(curOnHand.toString());
    setInvTargetDamaged(curDamaged.toString());
    setInvTargetHold(curHold.toString());

    setInvAdjReason(DEFAULT_INVENTORY_ADJUSTMENT_REASON);
    setInvAdjCustomReason("");
    setInvAdjNote("");
    setInvAdjError("");
    setInvAdjMovementType(curOnHand === 0 && (!initialBalances || initialBalances.length === 0) ? "OPENING_BALANCE" : "MANUAL_ADJUSTMENT");
    setIsInvAdjustModalOpen(true);
  };

  const handleModalWarehouseChange = (newWhId: string) => {
    setInvAdjWarehouseId(newWhId);
    const existing = initialBalances.find((b) => b.warehouse_id === newWhId);
    const curOnHand = existing?.qty_on_hand || 0;
    const curDamaged = existing?.qty_damaged || 0;
    const curHold = existing?.qty_hold || 0;

    setInvDeltaOnHand("0");
    setInvDeltaDamaged("0");
    setInvDeltaHold("0");

    setInvTargetOnHand(curOnHand.toString());
    setInvTargetDamaged(curDamaged.toString());
    setInvTargetHold(curHold.toString());
  };

  const currentModalWhBalance = useMemo(() => {
    const existing = initialBalances.find((b) => b.warehouse_id === invAdjWarehouseId);
    const onHand = existing?.qty_on_hand || 0;
    const damaged = existing?.qty_damaged || 0;
    const hold = existing?.qty_hold || 0;
    const available = Math.max(0, onHand - damaged - hold);
    return { onHand, damaged, hold, available };
  }, [invAdjWarehouseId, initialBalances]);

  const modalLiveCalculations = useMemo(() => {
    let dOnHand = 0;
    let dDamaged = 0;
    let dHold = 0;

    if (invAdjMode === "DELTA") {
      dOnHand = parseInt(invDeltaOnHand) || 0;
      dDamaged = parseInt(invDeltaDamaged) || 0;
      dHold = parseInt(invDeltaHold) || 0;
    } else {
      const tOnHand = parseInt(invTargetOnHand) || 0;
      const tDamaged = parseInt(invTargetDamaged) || 0;
      const tHold = parseInt(invTargetHold) || 0;
      dOnHand = tOnHand - currentModalWhBalance.onHand;
      dDamaged = tDamaged - currentModalWhBalance.damaged;
      dHold = tHold - currentModalWhBalance.hold;
    }

    const resOnHand = currentModalWhBalance.onHand + dOnHand;
    const resDamaged = currentModalWhBalance.damaged + dDamaged;
    const resHold = currentModalWhBalance.hold + dHold;
    const resAvailable = Math.max(0, resOnHand - resDamaged - resHold);

    return {
      dOnHand,
      dDamaged,
      dHold,
      resOnHand,
      resDamaged,
      resHold,
      resAvailable,
      hasZeroDelta: dOnHand === 0 && dDamaged === 0 && dHold === 0,
      hasNegativeResult: resOnHand < 0 || resDamaged < 0 || resHold < 0,
    };
  }, [invAdjMode, invDeltaOnHand, invDeltaDamaged, invDeltaHold, invTargetOnHand, invTargetDamaged, invTargetHold, currentModalWhBalance]);

  const handleInvAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvAdjError("");
    if (!invAdjWarehouseId) {
      setInvAdjError("물류창고를 선택해 주세요.");
      return;
    }
    if (modalLiveCalculations.hasZeroDelta) {
      setInvAdjError("최소 하나의 수량(보유, 불량, 보류) 변동이 있어야 합니다.");
      return;
    }
    if (modalLiveCalculations.hasNegativeResult) {
      setInvAdjError("조정 후 수량은 0 미만(음수)이 될 수 없습니다.");
      return;
    }
    if (invAdjReason === OTHER_INVENTORY_ADJUSTMENT_REASON && !invAdjCustomReason.trim()) {
      setInvAdjError("기타 사유를 직접 입력해 주세요 (Please enter the custom reason).");
      return;
    }
    const effectiveReason = formatInventoryAdjustmentReason(invAdjReason, invAdjCustomReason);
    if (!effectiveReason) {
      setInvAdjError("조정 사유를 선택하거나 입력해 주세요.");
      return;
    }

    setIsInvAdjSubmitting(true);
    try {
      await recordManualAdjustment(
        product.id,
        invAdjWarehouseId,
        modalLiveCalculations.dOnHand,
        modalLiveCalculations.dHold,
        effectiveReason,
        invAdjNote.trim(),
        modalLiveCalculations.dDamaged,
        invAdjMovementType
      );
      setIsInvAdjustModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setInvAdjError(err.message || "재고 조정 실패");
    } finally {
      setIsInvAdjSubmitting(false);
    }
  };

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

  // Operational Status & Visibility Management State
  const [currentTradingStatus, setCurrentTradingStatus] = useState<string>(product.trading_status || "inactive");
  const [currentVisibility, setCurrentVisibility] = useState<string>(product.retailer_visibility || "hidden");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetTradingStatus, setTargetTradingStatus] = useState<string>(product.trading_status || "inactive");
  const [targetVisibility, setTargetVisibility] = useState<string>(product.retailer_visibility || "hidden");
  const [statusReason, setStatusReason] = useState("");
  const [statusError, setStatusError] = useState("");
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);

  const handleOpenStatusModal = () => {
    setTargetTradingStatus(currentTradingStatus);
    setTargetVisibility(currentVisibility);
    setStatusReason("");
    setStatusError("");
    setIsStatusModalOpen(true);
  };

  const handleTargetTradingStatusChange = (val: string) => {
    setTargetTradingStatus(val);
    if (val !== "active") {
      setTargetVisibility("hidden");
    }
  };

  const handleSaveStatusVisibility = async () => {
    setStatusError("");
    if (targetTradingStatus !== "active" && targetVisibility === "visible") {
      setStatusError("운영 중(Active) 상품만 Retailer Hub에 '노출'될 수 있습니다.");
      return;
    }

    setIsStatusSubmitting(true);
    try {
      const res = await updateTradingStatusAndVisibility(product.id, {
        trading_status: targetTradingStatus as "active" | "inactive" | "historical",
        retailer_visibility: targetVisibility as "visible" | "hidden",
        reason: statusReason.trim() || "Operational status and visibility updated",
      });

      if (res?.success && res.trading_status && res.retailer_visibility) {
        setCurrentTradingStatus(res.trading_status as TradingStatus);
        setCurrentVisibility(res.retailer_visibility as RetailerVisibility);
        setIsStatusModalOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      setStatusError(err.message || "상태 변경 실패");
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  // Lightbox state
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const photoUrls = useMemo(() => {
    if (product.photoUrls && product.photoUrls.length > 0) return product.photoUrls;
    if (product.photoUrl) return [product.photoUrl];
    return [];
  }, [product.photoUrls, product.photoUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLightboxOpen) return;
      if (e.key === "Escape") {
        setIsLightboxOpen(false);
      } else if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev > 0 ? prev - 1 : photoUrls.length - 1));
      } else if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev < photoUrls.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, photoUrls.length]);

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

    if (editPromoStart && editPromoEnd && new Date(editPromoEnd) < new Date(editPromoStart)) {
      setPromoError("종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }

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
      const overrideVal = editCostOverride ? parseFloat(editCostOverride) : null;

      await updateTradingCostOverride(product.id, {
        override_cost: overrideVal,
        reason: editCostReason || "Manual cost override updated",
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

  // Warehouse Map for fast name/code resolution in history logs
  const warehouseMap = useMemo(() => {
    const map = new Map<string, string>();
    (warehouses || []).forEach((w: any) => {
      map.set(w.id, w.code ? `${w.name} (${w.code})` : w.name);
    });
    return map;
  }, [warehouses]);

  // Parse audit logs into human-readable field-level change rows combining historyLogs, inventory movements & receiving history
  const parsedAuditRows = useMemo(() => {
    const rows: Array<{
      id: string;
      timestamp: number;
      date: string;
      category: string;
      categoryBadgeLabel: string;
      filterGroup: "INV" | "PRICE" | "COST" | "HUB" | "SALES" | "GENERAL";
      field: string;
      prevVal: string;
      newVal: string;
      reason: string;
      user: string;
      operatorReason: string;
    }> = [];

    // 1. Process trading product history logs
    (historyLogs || []).forEach((log: any) => {
      const createdDate = new Date(log.created_at);
      const dateStr = createdDate.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      const timestamp = createdDate.getTime();
      const user = log.creator?.full_name || "Admin";
      const category = log.change_type || "GENERAL";
      const reason = log.reason || "-";

      let filterGroup: "INV" | "PRICE" | "COST" | "HUB" | "SALES" | "GENERAL" = "GENERAL";
      if (["STOCK", "INVENTORY", "MANUAL_ADJUSTMENT", "RECEIVING", "SHIPMENT", "OPENING_BALANCE"].includes(category)) {
        filterGroup = "INV";
      } else if (["PRICING", "PROMOTION"].includes(category)) {
        filterGroup = "PRICE";
      } else if (["COST", "COST_OVERRIDE"].includes(category)) {
        filterGroup = "COST";
      } else if (["STATUS", "VISIBILITY", "HUB_BADGE"].includes(category)) {
        filterGroup = "HUB";
      } else if (["ORDER", "PO", "SALES"].includes(category)) {
        filterGroup = "SALES";
      }

      const beforeObj = log.before_value || {};
      const afterObj = log.after_value || {};

      const allKeys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]));
      const displayKeys = allKeys.filter((k) => !["updated_at", "updated_by", "id"].includes(k));

      if (displayKeys.length === 0) {
        rows.push({
          id: `log-${log.id}-summary`,
          timestamp,
          date: dateStr,
          category,
          categoryBadgeLabel: category,
          filterGroup,
          field: log.field_name || "일반 변경 (General Change)",
          prevVal: formatValue("general", beforeObj),
          newVal: formatValue("general", afterObj),
          reason,
          user,
          operatorReason: `${user} · ${reason}`,
        });
      } else {
        displayKeys.forEach((key) => {
          const fieldLabel = FIELD_LABEL_MAP[key] || key;
          const prevVal = formatValue(key, beforeObj[key]);
          const newVal = formatValue(key, afterObj[key]);

          rows.push({
            id: `log-${log.id}-${key}`,
            timestamp,
            date: dateStr,
            category,
            categoryBadgeLabel: category,
            filterGroup,
            field: fieldLabel,
            prevVal,
            newVal,
            reason,
            user,
            operatorReason: `${user} · ${reason}`,
          });
        });
      }
    });

    // 2. Authoritative Inventory Movements (Manual adjustments, Opening balance, Transfers, Receivings)
    (initialMovements || []).forEach((m: any) => {
      const createdDate = new Date(m.created_at);
      const dateStr = createdDate.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      const timestamp = createdDate.getTime();
      const user = m.profiles?.full_name || m.creator_name || "Admin";
      const whName = warehouseMap.get(m.warehouse_id) || m.warehouse_id || "기본물류창고";
      const reasonText = m.reason || m.note || MOVEMENT_LABELS[m.type] || "재고 수동 조정";
      const catLabel = MOVEMENT_LABELS[m.type] || m.type;
      const opReason = `${user} · ${reasonText} · ${whName}`;

      const deltaOnHand = Number(m.qty_change || 0);
      const deltaDamaged = Number(m.qty_damaged_change || 0);
      const deltaHold = Number(m.qty_hold_change || 0);

      let hasSpecificEntry = false;

      // On-Hand Balance Entry
      if (
        deltaOnHand !== 0 ||
        (m.type === "OPENING_BALANCE" && m.balance_on_hand_after !== undefined && m.balance_on_hand_after !== null)
      ) {
        hasSpecificEntry = true;
        const afterOnHand =
          m.balance_on_hand_after !== undefined && m.balance_on_hand_after !== null
            ? Number(m.balance_on_hand_after)
            : null;
        const beforeOnHand = afterOnHand !== null ? afterOnHand - deltaOnHand : null;

        rows.push({
          id: `mov-${m.id}-onhand`,
          timestamp,
          date: dateStr,
          category: m.type,
          categoryBadgeLabel: catLabel,
          filterGroup: "INV",
          field: `On Hand 재고 (${whName})`,
          prevVal: beforeOnHand !== null ? `${beforeOnHand} EA` : "-",
          newVal:
            afterOnHand !== null
              ? `${afterOnHand} EA (${deltaOnHand > 0 ? `+${deltaOnHand}` : deltaOnHand} EA)`
              : `${deltaOnHand > 0 ? `+${deltaOnHand}` : deltaOnHand} EA`,
          reason: reasonText,
          user,
          operatorReason: opReason,
        });
      }

      // Damaged Balance Entry
      if (deltaDamaged !== 0) {
        hasSpecificEntry = true;
        const afterDamaged =
          m.balance_damaged_after !== undefined && m.balance_damaged_after !== null
            ? Number(m.balance_damaged_after)
            : null;
        const beforeDamaged = afterDamaged !== null ? afterDamaged - deltaDamaged : null;

        rows.push({
          id: `mov-${m.id}-damaged`,
          timestamp,
          date: dateStr,
          category: m.type,
          categoryBadgeLabel: catLabel,
          filterGroup: "INV",
          field: `Damaged 불량 재고 (${whName})`,
          prevVal: beforeDamaged !== null ? `${beforeDamaged} EA` : "-",
          newVal:
            afterDamaged !== null
              ? `${afterDamaged} EA (${deltaDamaged > 0 ? `+${deltaDamaged}` : deltaDamaged} EA)`
              : `${deltaDamaged > 0 ? `+${deltaDamaged}` : deltaDamaged} EA`,
          reason: reasonText,
          user,
          operatorReason: opReason,
        });
      }

      // Hold Balance Entry
      if (deltaHold !== 0) {
        hasSpecificEntry = true;
        const afterHold =
          m.balance_hold_after !== undefined && m.balance_hold_after !== null
            ? Number(m.balance_hold_after)
            : null;
        const beforeHold = afterHold !== null ? afterHold - deltaHold : null;

        rows.push({
          id: `mov-${m.id}-hold`,
          timestamp,
          date: dateStr,
          category: m.type,
          categoryBadgeLabel: catLabel,
          filterGroup: "INV",
          field: `Hold 보류 재고 (${whName})`,
          prevVal: beforeHold !== null ? `${beforeHold} EA` : "-",
          newVal:
            afterHold !== null
              ? `${afterHold} EA (${deltaHold > 0 ? `+${deltaHold}` : deltaHold} EA)`
              : `${deltaHold > 0 ? `+${deltaHold}` : deltaHold} EA`,
          reason: reasonText,
          user,
          operatorReason: opReason,
        });
      }

      // Fallback if delta is zero but row is logged
      if (!hasSpecificEntry) {
        rows.push({
          id: `mov-${m.id}-general`,
          timestamp,
          date: dateStr,
          category: m.type,
          categoryBadgeLabel: catLabel,
          filterGroup: "INV",
          field: `재고 변동 내역 (${whName})`,
          prevVal: "-",
          newVal: `${m.balance_on_hand_after ?? 0} EA`,
          reason: reasonText,
          user,
          operatorReason: opReason,
        });
      }
    });

    // 3. PO Receiving Lines Integration (if not already logged via inventory movements)
    (receivingHistory || []).forEach((r: any) => {
      const receiving = r.receivings;
      const wh = receiving?.warehouses;
      const whName = wh ? (wh.code ? `${wh.name} (${wh.code})` : wh.name) : "입고물류창고";
      const recNumber = receiving?.receiving_number || "RECEIVING";
      const createdDate = new Date(r.created_at);
      const dateStr = createdDate.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      const timestamp = createdDate.getTime();

      const alreadyInMovements = (initialMovements || []).some(
        (m: any) => m.type === "RECEIVING" && (m.reference_id === r.id || m.reference_id === receiving?.id)
      );

      if (!alreadyInMovements && (r.received_qty > 0 || r.damaged_qty > 0 || r.hold_qty > 0)) {
        rows.push({
          id: `rec-${r.id}`,
          timestamp,
          date: dateStr,
          category: "RECEIVING",
          categoryBadgeLabel: "입고 완료",
          filterGroup: "INV",
          field: `입고 완료 (${whName})`,
          prevVal: "-",
          newVal: `+${r.received_qty || 0} EA${r.damaged_qty ? ` (불량 ${r.damaged_qty} EA)` : ""}`,
          reason: `PO 입고 처리 (${recNumber})`,
          user: "Warehouse Manager",
          operatorReason: `Warehouse Manager · PO 입고 (${recNumber}) · ${whName}`,
        });
      }
    });

    return rows.sort((a, b) => b.timestamp - a.timestamp);
  }, [historyLogs, initialMovements, receivingHistory, warehouseMap]);

  // Filtered Audit Rows based on historyFilterType
  const filteredAuditRows = useMemo(() => {
    if (historyFilterType === "ALL") return parsedAuditRows;
    if (historyFilterType === "INV") return parsedAuditRows.filter((r) => r.filterGroup === "INV");
    if (historyFilterType === "PRICE") return parsedAuditRows.filter((r) => r.filterGroup === "PRICE");
    if (historyFilterType === "COST") return parsedAuditRows.filter((r) => r.filterGroup === "COST");
    if (historyFilterType === "HUB") return parsedAuditRows.filter((r) => r.filterGroup === "HUB");
    if (historyFilterType === "SALES") return parsedAuditRows.filter((r) => r.filterGroup === "SALES");
    return parsedAuditRows;
  }, [parsedAuditRows, historyFilterType]);

  // History Pagination State
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(20);

  // Reset pagination when filter changes
  useEffect(() => {
    setHistoryPage(1);
  }, [historyFilterType]);

  const totalHistoryCount = filteredAuditRows.length;
  const totalHistoryPages = Math.max(1, Math.ceil(totalHistoryCount / historyPageSize));
  const paginatedAuditRows = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredAuditRows.slice(start, start + historyPageSize);
  }, [filteredAuditRows, historyPage, historyPageSize]);

  // Pricing Tab Filter State
  const [pricingFilterType, setPricingFilterType] = useState<"ALL" | "PRICING" | "PROMOTION">("ALL");
  const [pricingFilterDays, setPricingFilterDays] = useState<"ALL" | "30" | "90">("ALL");

  // Chronological Pricing & Promotion Timeline Memo
  const pricingTimeline = useMemo(() => {
    const events: any[] = [];

    (historyLogs || []).forEach((log: any) => {
      if (["PRICING", "PROMOTION"].includes(log.change_type)) {
        const createdDate = new Date(log.created_at);
        const dateStr = createdDate.toLocaleString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
        const timestamp = createdDate.getTime();
        const user = log.creator?.full_name || "Admin";
        const reason = log.reason || log.after_value?.note || "Operational change";

        const before = log.before_value || {};
        const after = log.after_value || {};

        const effectiveCost = after.effective_landed_cost ?? before.effective_landed_cost ?? product.effectiveLandedCost;

        let eventTitle = "Pricing Event";
        let eventBadgeColor = "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700";

        if (log.change_type === "PRICING") {
          const oldW = before.wholesale_price;
          const newW = after.wholesale_price;
          const oldM = before.map_price;
          const newM = after.map_price;
          const oldS = before.srp_price;
          const newS = after.srp_price;

          if (oldW !== undefined && oldW !== null && newW !== undefined && newW !== null && Number(oldW) !== Number(newW)) {
            eventTitle = "도매가 변경 (Wholesale Price Changed)";
            eventBadgeColor = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
          } else if (oldM !== undefined && oldM !== null && newM !== undefined && newM !== null && Number(oldM) !== Number(newM)) {
            eventTitle = "MAP 변경 (MAP Changed)";
            eventBadgeColor = "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800";
          } else if (oldS !== undefined && oldS !== null && newS !== undefined && newS !== null && Number(oldS) !== Number(newS)) {
            eventTitle = "SRP 변경 (SRP Changed)";
            eventBadgeColor = "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
          } else {
            eventTitle = "가격 정책 설정 (Pricing Policy Updated)";
            eventBadgeColor = "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700";
          }
        } else if (log.change_type === "PROMOTION") {
          const oldPromo = before.promo_wholesale_price;
          const newPromo = after.promo_wholesale_price;

          if ((oldPromo === null || oldPromo === undefined) && newPromo !== null && newPromo !== undefined) {
            eventTitle = "프로모션 등록 (Promotion Created)";
            eventBadgeColor = "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800";
          } else if (newPromo === null || newPromo === undefined) {
            eventTitle = "프로모션 종료 (Promotion Ended)";
            eventBadgeColor = "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800";
          } else {
            eventTitle = "프로모션 수정 (Promotion Updated)";
            eventBadgeColor = "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800";
          }
        }

        const oldW = before.wholesale_price !== undefined && before.wholesale_price !== null ? Number(before.wholesale_price) : null;
        const newW = after.wholesale_price !== undefined && after.wholesale_price !== null ? Number(after.wholesale_price) : product.operationalWholesale;

        const oldM = before.map_price !== undefined && before.map_price !== null ? Number(before.map_price) : null;
        const newM = after.map_price !== undefined && after.map_price !== null ? Number(after.map_price) : product.mapPrice;

        const oldS = before.srp_price !== undefined && before.srp_price !== null ? Number(before.srp_price) : null;
        const newS = after.srp_price !== undefined && after.srp_price !== null ? Number(after.srp_price) : product.srpPrice;

        const oldPromo = before.promo_wholesale_price !== undefined && before.promo_wholesale_price !== null ? Number(before.promo_wholesale_price) : null;
        const newPromo = after.promo_wholesale_price !== undefined && after.promo_wholesale_price !== null ? Number(after.promo_wholesale_price) : null;

        const oldOurMarginPct = oldW && oldW > 0 ? ((oldW - effectiveCost) / oldW) * 100 : null;
        const newOurMarginPct = newW > 0 ? ((newW - effectiveCost) / newW) * 100 : null;
        const ourMarginDiffPts = (oldOurMarginPct !== null && newOurMarginPct !== null) ? (newOurMarginPct - oldOurMarginPct) : null;

        const oldRetailerMarginPct = oldS && oldS > 0 && oldW && oldW > 0 ? ((oldS - oldW) / oldS) * 100 : null;
        const newRetailerMarginPct = newS > 0 && newW > 0 ? ((newS - newW) / newS) * 100 : null;

        let promoDiscountPct: number | null = null;
        let promoLabel: string | null = null;
        let promoOurMarginPct: number | null = null;
        let promoRetailerMarginPct: number | null = null;

        if (log.change_type === "PROMOTION" && newPromo !== null && newPromo > 0) {
          const baseW = product.operationalWholesale;
          promoDiscountPct = baseW > 0 ? ((newPromo - baseW) / baseW) * 100 : 0;
          promoLabel = promoDiscountPct < 0 ? `Discount ${Math.abs(promoDiscountPct).toFixed(1)}%` : `Increase +${promoDiscountPct.toFixed(1)}%`;
          promoOurMarginPct = ((newPromo - effectiveCost) / newPromo) * 100;
          promoRetailerMarginPct = newS > 0 ? ((newS - newPromo) / newS) * 100 : null;
        }

        events.push({
          id: log.id,
          date: dateStr,
          timestamp,
          changeType: log.change_type,
          eventTitle,
          eventBadgeColor,
          user,
          reason,
          effectiveCost,
          oldW,
          newW,
          isWholesaleChanged: oldW !== null && oldW !== newW,
          oldM,
          newM,
          isMapChanged: oldM !== null && oldM !== newM,
          oldS,
          newS,
          isSrpChanged: oldS !== null && oldS !== newS,
          oldPromo,
          newPromo,
          isPromoChanged: oldPromo !== newPromo,
          promoStartDate: after.promo_start_date || before.promo_start_date || null,
          promoEndDate: after.promo_end_date || before.promo_end_date || null,
          promoDiscountPct,
          promoLabel,
          promoOurMarginPct,
          promoRetailerMarginPct,
          oldOurMarginPct,
          newOurMarginPct,
          ourMarginDiffPts,
          oldRetailerMarginPct,
          newRetailerMarginPct,
        });
      }
    });

    return events.sort((a, b) => b.timestamp - a.timestamp);
  }, [historyLogs, product]);

  // Filtered Pricing Timeline Memo
  const filteredPricingTimeline = useMemo(() => {
    let list = pricingTimeline;
    if (pricingFilterType === "PRICING") {
      list = list.filter((e) => !e.isPromoChanged);
    } else if (pricingFilterType === "PROMOTION") {
      list = list.filter((e) => e.isPromoChanged);
    }
    if (pricingFilterDays !== "ALL") {
      const cutoff = Date.now() - parseInt(pricingFilterDays) * 24 * 60 * 60 * 1000;
      list = list.filter((e) => e.timestamp >= cutoff);
    }
    return list;
  }, [pricingTimeline, pricingFilterType, pricingFilterDays]);

  // Live Authoritative Hub Visibility Memo
  const liveHubVisibility = useMemo(() => {
    return evaluateHubVisibility(
      {
        ...product,
        trading_status: currentTradingStatus,
        retailer_visibility: currentVisibility,
        trading_wholesale_price: product.operationalWholesale,
        moq: product.moq,
        carton_pack_qty: product.carton_pack_qty,
      },
      totalAvailable,
      inboundSummary?.nextEta || null
    );
  }, [product, currentTradingStatus, currentVisibility, totalAvailable, inboundSummary]);

  // Dynamic Orderability Memo
  const dynamicOrderability = useMemo(() => {
    return evaluateTradingOrderability({
      registrationStatus: product.registration_status,
      selectionStatus: product.selection_status,
      tradingStatus: currentTradingStatus,
      retailerVisibility: currentVisibility,
      isPricingActive: product.isPricingActive,
      wholesalePrice: product.operationalWholesale,
      cartonPackQty: product.carton_pack_qty,
    });
  }, [currentTradingStatus, currentVisibility, product]);

  // Active Marketing Badges (Resolved by priority order)
  const activeMarketingBadges = useMemo(() => {
    return resolveActiveMarketingBadges(product, "ko");
  }, [product]);

  // Compute active operational alerts
  const activeAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      type: "danger" | "warning" | "info";
      title: string;
      message: string;
      target?: string;
      actionLabel?: string;
    }> = [];

    if (currentVisibility === "visible" && liveHubVisibility.effectiveVisibility === "HIDDEN") {
      alerts.push({
        id: "hub_hidden",
        type: "warning",
        title: "Retailer Hub 미노출",
        message: "필수 조건(도매가, 소비자가, MOQ) 미충족으로 Hub에 노출되지 않습니다.",
        target: "price",
        actionLabel: "가격/MOQ 설정 →",
      });
    }

    if (product.registration_status && product.registration_status !== "COMPLETE") {
      const missingList = product.registration_missing_fields && product.registration_missing_fields.length > 0
        ? ` (누락: ${product.registration_missing_fields.join(", ")})`
        : "";
      alerts.push({
        id: "draft_registration",
        type: "danger",
        title: "상품 등록 미완료 (Draft)",
        message: `마스터 상품 기본 정보 또는 필수 항목이 완성되지 않았습니다.${missingList}`,
        target: "catalog_master",
        actionLabel: "물류/마스터 수정 →",
      });
    }

    if (totalAvailable === 0) {
      alerts.push({
        id: "out_of_stock",
        type: "danger",
        title: "판매 가능 재고 소진 (0 EA)",
        message: "현재 판매 가능 재고가 0개입니다. 리테일러 주문 접수가 불가합니다.",
        target: "inventory_tab",
        actionLabel: "재고 입고/조정 →",
      });
    } else if (totalAvailable < 10) {
      alerts.push({
        id: "low_stock",
        type: "warning",
        title: `안전 재고 부족 (${totalAvailable} EA)`,
        message: `현재 판매 가능 재고가 ${totalAvailable}개로 안전 재고(10개) 미만입니다.`,
        target: "inventory_tab",
        actionLabel: "재고 확인 →",
      });
    }

    if (!product.operationalWholesale || product.operationalWholesale <= 0) {
      alerts.push({
        id: "missing_wholesale",
        type: "danger",
        title: "도매가 미설정",
        message: "도매 공급가가 설정되지 않아 리테일러 주문이 불가능합니다.",
        target: "pricing_modal",
        actionLabel: "가격 설정 →",
      });
    }

    if (!product.srpPrice || product.srpPrice <= 0) {
      alerts.push({
        id: "missing_srp",
        type: "warning",
        title: "권장소비자가(SRP) 미등록",
        message: product.price_krw_retail
          ? `미국 SRP가 미설정되어 있습니다. (원화 기준가: ₩${product.price_krw_retail.toLocaleString()})`
          : "권장소비자가가 미등록되어 리테일러 마진이 산정되지 않습니다.",
        target: "pricing_modal",
        actionLabel: "SRP 입력 →",
      });
    }

    if (product.operationalWholesale > 0 && product.effectiveLandedCost > 0 && product.ourMarginPercent !== null && product.ourMarginPercent < 20) {
      alerts.push({
        id: "low_our_margin",
        type: "danger",
        title: `자사 마진 임계치 미달 (${product.ourMarginPercent.toFixed(1)}%)`,
        message: `현재 자사 마진(${product.ourMarginPercent.toFixed(1)}%)이 목표 최소 기준(20.0%)보다 낮습니다.`,
        target: "pricing_modal",
        actionLabel: "도매가/원가 조정 →",
      });
    }

    if (currentTradingStatus === "active" && currentVisibility === "hidden") {
      alerts.push({
        id: "active_hidden",
        type: "warning",
        title: "운영 중이나 Hub 비노출",
        message: "상품이 '운영 중' 상태이나 Retailer Hub에 '비노출'되어 주문이 유입되지 않습니다.",
        target: "status_modal",
        actionLabel: "Hub 노출 변경 →",
      });
    }

    if (product.isPromoActive) {
      alerts.push({
        id: "active_promo",
        type: "info",
        title: "프로모션 도매가 적용 중",
        message: `할인 도매가 $${product.promoWholesale?.toFixed(2)}가 프로모션 기간 동안 적용 중입니다.`,
        target: "promo_modal",
        actionLabel: "프로모션 관리 →",
      });
    }

    return alerts;
  }, [totalAvailable, product, currentTradingStatus, currentVisibility, liveHubVisibility]);

  const handleAlertAction = (target?: string) => {
    if (!target) return;
    if (target === "hold_alerts") {
      navigateToHoldAlerts();
    } else if (target === "inventory_tab") {
      handleTabChange("inventory");
    } else if (target === "pricing_modal") {
      setIsPricingModalOpen(true);
    } else if (target === "promo_modal") {
      setIsPromoModalOpen(true);
    } else if (target === "cost_override") {
      setIsCostOverrideModalOpen(true);
    } else if (target === "status_modal") {
      handleOpenStatusModal();
    } else if (target === "catalog_master") {
      router.push(`/admin/products/${product.id}`);
    }
  };

  return (
    <div className="w-full max-w-7xl space-y-6 pb-12">
      {/* Top Breadcrumb & Page Identifier */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            <Link
              href="/admin/products/trading"
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              어드민
            </Link>
            <span>/</span>
            <Link
              href="/admin/products/trading"
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              상품 관리
            </Link>
            <span>/</span>
            <span className="font-bold text-zinc-900 dark:text-white">
              상품 운영 (Product Operations)
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <span>⚙️</span> {product.display_name || product.name}
          </h1>
        </div>

        {/* Global Action Header Links */}
        <div className="flex items-center gap-2">
          <a
            href={`https://portal.kselecthub.com/products/${product.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs inline-flex items-center gap-1.5"
          >
            <span>🌐</span> Retailer Hub에서 미리보기 ↗
          </a>
          <Link
            href="/admin/products/trading"
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            목록으로 돌아가기
          </Link>
        </div>
      </div>

      {/* 1. PERSISTENT COMPACT HEADER & PRODUCT IDENTITY */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Product Image & Key Information */}
          <div className="flex items-start gap-4 min-w-0 flex-1">
            {/* Thumbnail Viewer with Lightbox */}
            <div
              onClick={() => {
                if (photoUrls.length > 0) {
                  setLightboxIndex(0);
                  setIsLightboxOpen(true);
                }
              }}
              className={`w-24 h-24 sm:w-28 sm:h-28 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-50 dark:bg-zinc-950 shrink-0 flex items-center justify-center relative group shadow-2xs ${
                photoUrls.length > 0 ? "cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-all" : ""
              }`}
            >
              {product.photoUrl ? (
                <>
                  <img
                    src={product.photoUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-0.5">
                    <span>🔍 확대</span>
                    {photoUrls.length > 1 && <span>({photoUrls.length}장)</span>}
                  </div>
                </>
              ) : (
                <span className="text-[10px] text-zinc-400 font-bold">NO IMAGE</span>
              )}
            </div>

            {/* Title, Brand, Category, SKUs */}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                  {product.brandName}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                  공급사: {product.companyName}
                </span>
                <Link
                  href={`/admin/products/${product.id}`}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline ml-auto"
                >
                  Catalog Master 상세 →
                </Link>
              </div>

              <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white truncate" title={product.name}>
                {product.name}
              </h2>

              {product.category_full_path && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  📂 {product.category_full_path}
                </p>
              )}

              {/* SKU Strip */}
              <div className="flex items-center gap-x-4 gap-y-1 flex-wrap pt-1 text-xs border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-zinc-500">Catalog SKU:</span>
                  <span className="font-mono text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    {product.manufacture_sku || "미설정"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-zinc-500">Letusto SKU:</span>
                  {isEditingSku ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={skuInput}
                        onChange={(e) => setSkuInput(e.target.value)}
                        placeholder="LET-PROD-001"
                        maxLength={64}
                        className="px-2 py-0.5 text-xs font-mono rounded border border-indigo-400 dark:border-indigo-500 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none w-32"
                        autoFocus
                      />
                      <button
                        type="button"
                        disabled={isSkuSubmitting}
                        onClick={() => handleSaveSku()}
                        className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditSku}
                        className="px-1.5 py-0.5 text-[10px] text-zinc-500"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {letustoSku || <span className="text-zinc-400 font-normal italic">미설정</span>}
                      </span>
                      <button
                        type="button"
                        onClick={handleStartEditSku}
                        className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline ml-1"
                      >
                        ✏️ 편집
                      </button>
                    </div>
                  )}
                </div>

                {product.upc && (
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-semibold text-zinc-500">UPC:</span>
                    <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{product.upc}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Status Controls & Active Marketing Badges */}
          <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
            {/* Status Badges Row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Trading Status */}
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${TRADING_COLORS[currentTradingStatus] || TRADING_COLORS.inactive}`}>
                {TRADING_LABELS[currentTradingStatus] || currentTradingStatus}
              </span>

              {/* Visibility */}
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${VISIBILITY_COLORS[currentVisibility] || VISIBILITY_COLORS.hidden}`}>
                {VISIBILITY_LABELS[currentVisibility] || currentVisibility}
              </span>

              {/* Status Change Button */}
              <button
                onClick={handleOpenStatusModal}
                className="px-3 py-1 text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1 ml-1"
              >
                <span>⚙️</span> 상태 관리
              </button>
            </div>

            {/* Active Marketing Badges (Top 3 + +N Overflow counter) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-zinc-400">마케팅 배지:</span>
              {activeMarketingBadges.length === 0 ? (
                <span className="text-[11px] text-zinc-400 italic">설정된 배지 없음</span>
              ) : (
                <>
                  {activeMarketingBadges.slice(0, 3).map((badge) => (
                    <span
                      key={badge.type}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${badge.badgeStyle}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                  {activeMarketingBadges.length > 3 && (
                    <span
                      onClick={() => handleTabChange("hub")}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 cursor-pointer hover:bg-zinc-300"
                      title={activeMarketingBadges.slice(3).map((b) => b.label).join(", ")}
                    >
                      +{activeMarketingBadges.length - 3}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. THE 5 MAIN BUSINESS TABS (5개 업무 탭 NAVIGATION) */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl px-2 shadow-2xs">
        <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2">
          {[
            { id: "summary", label: "운영개요", icon: "📊", desc: "핵심 KPI & Diagnositcs" },
            { id: "inventory", label: "Inventory", icon: "📦", desc: "창고별 재고 및 수동 조정" },
            { id: "price", label: "Price", icon: "💲", desc: "도매가·프로모션·수입원가" },
            { id: "hub", label: "Hub", icon: "🌐", desc: "노출 관리·차단 사유·마케팅 배지" },
            { id: "history", label: "History", icon: "📜", desc: "통합 감사 및 활동 이력" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as BusinessTab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-zinc-900 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800/60"
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB CONTENT AREAS */}

      {/* ========================================================================= */}
      {/* TAB 1: 운영개요 (SUMMARY) */}
      {/* ========================================================================= */}
      {activeTab === "summary" && (
        <div className="space-y-6">
          {/* Quick KPI Overview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Inventory */}
            <div className="p-4 rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                판매 가능 재고 (Available Stock)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-zinc-900 dark:text-white">
                  {totalAvailable.toLocaleString()} EA
                </span>
                <span className="text-xs text-zinc-500 font-mono">OnHand: {totalOnHand}</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                보류: {totalHold} | 불량: {totalDamaged}
              </p>
            </div>

            {/* KPI 2: Pricing */}
            <div className="p-4 rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                적용 도매가 (Wholesale Price)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-zinc-900 dark:text-white">
                  ${product.effectiveWholesale.toFixed(2)}
                </span>
                <span className="text-xs text-zinc-500">MOQ {product.moq || 1}</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {product.isPromoActive ? `🔥 프로모션 적용 중 ($${product.promoWholesale?.toFixed(2)})` : `SRP: $${product.srpPrice.toFixed(2)}`}
              </p>
            </div>

            {/* KPI 3: Retailer Margin */}
            <div className="p-4 rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                리테일러 마진율 (Retailer Margin)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {safeFormatPercent(product.retailerMarginPercent)}
                </span>
                <span className="text-xs text-zinc-500">
                  {product.retailerMarginUsd !== null ? `$${product.retailerMarginUsd.toFixed(2)}` : "—"}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                권장 기준: 50% 이상 (SRP 대비)
              </p>
            </div>

            {/* KPI 4: Landed Cost & Our Margin */}
            <div className="p-4 rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                수입원가 & 자사 마진 (Landed & Our Margin)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  ${product.effectiveLandedCost.toFixed(2)}
                </span>
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  {safeFormatPercent(product.ourMarginPercent)}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {product.hasCostOverride ? "수동 오버라이드 원가 적용 중" : "시스템 자동 계산 원가"}
              </p>
            </div>
          </div>

          {/* Operational Alerts & Diagnositcs Shelf */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>📡</span> 운영 진단 및 즉시 조치 사항 (Operational Diagnostics)
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  재고, 가격, 마진, 물류, 노출 기준을 실시간으로 점검한 진단 결과입니다.
                </p>
              </div>
              <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {activeAlerts.length}건 감지됨
              </span>
            </div>

            {activeAlerts.filter((a) => a.type !== "info").length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40 text-xs font-medium flex items-center gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <strong className="block text-sm font-bold">정상 운영 상태 (All Clear)</strong>
                  모든 재고, 가격, 마진, 상태 및 노출 기준이 정상적으로 충족되어 있습니다.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => handleAlertAction(alert.target)}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all hover:border-zinc-400 dark:hover:border-zinc-500 flex flex-col justify-between ${
                      alert.type === "danger"
                        ? "bg-rose-50/90 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900/60"
                        : alert.type === "warning"
                        ? "bg-amber-50/90 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/60"
                        : "bg-zinc-50 text-zinc-800 border-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    <div>
                      <strong className="text-xs font-bold flex items-center gap-1.5 mb-1">
                        <span>{alert.type === "danger" ? "🚨" : alert.type === "warning" ? "⚠️" : "ℹ️"}</span>
                        <span>{alert.title}</span>
                      </strong>
                      <p className="text-[11px] leading-snug opacity-90">{alert.message}</p>
                    </div>
                    {alert.actionLabel && (
                      <div className="pt-2 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 text-right">
                        {alert.actionLabel}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INVENTORY (재고) */}
      {/* ========================================================================= */}
      {activeTab === "inventory" && (
        <div className="space-y-6">
          {/* Location Breakdown & Stock Snapshot Card */}
          <div id="inventory-snapshot-card" className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>📦</span> 창고 로케이션별 재고 현황 (Warehouse Balances)
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  물류 창고별 보유(OnHand), 검수보류(Hold), 불량(Damaged), 판매가능(Available) 수량입니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                >
                  <option value="ALL">전체 로케이션 (ALL)</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => handleOpenInvAdjustModal()}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xs"
                >
                  + 수동 재고 조정
                </button>
              </div>
            </div>

            {/* Warehouse Balances Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-50/60 dark:bg-zinc-950/40">
                    <th className="p-3">물류 창고 (Location)</th>
                    <th className="p-3 text-right">OnHand (물리보유)</th>
                    <th className="p-3 text-right">Damaged (불량격리)</th>
                    <th className="p-3 text-right">Hold (검토보류)</th>
                    <th className="p-3 text-right">Available (판매가능)</th>
                    <th className="p-3 text-center">조정</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                  {initialBalances.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-zinc-400 font-sans text-xs">
                        등록된 창고 재고가 없습니다. '+ 수동 재고 조정'을 통해 기초 재고를 등록해 주세요.
                      </td>
                    </tr>
                  ) : (
                    initialBalances.map((b) => {
                      const avail = Math.max(0, b.qty_on_hand - (b.qty_damaged || 0) - b.qty_hold);
                      return (
                        <tr key={b.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                          <td className="p-3 font-sans font-bold text-zinc-900 dark:text-zinc-100">
                            {b.warehouse_name} ({b.warehouse_code})
                          </td>
                          <td className="p-3 text-right font-bold">{b.qty_on_hand} EA</td>
                          <td className="p-3 text-right text-rose-600 dark:text-rose-400">{b.qty_damaged || 0} EA</td>
                          <td className="p-3 text-right text-amber-600 dark:text-amber-400">{b.qty_hold} EA</td>
                          <td className="p-3 text-right font-black text-indigo-600 dark:text-indigo-400">{avail} EA</td>
                          <td className="p-3 text-center font-sans">
                            <button
                              type="button"
                              onClick={() => handleOpenInvAdjustModal(b.warehouse_id)}
                              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                              조정 →
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inbound PO Status & Stock Movement Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Inbound PO List */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>🚚</span> 입고 예정 및 진행 PO (Inbound PO History)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-400 uppercase">
                      <th className="py-2">PO 번호</th>
                      <th className="py-2">공급사</th>
                      <th className="py-2 text-right">발주 수량</th>
                      <th className="py-2 text-center">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                    {poHistory.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-zinc-400 text-[11px]">
                          입고 예정 PO 이력이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      poHistory.slice(0, 5).map((po: any) => (
                        <tr key={po.id}>
                          <td className="py-2 font-mono font-bold text-zinc-808 dark:text-zinc-200">
                            {po.purchase_orders?.po_number || po.id.slice(0, 8)}
                          </td>
                          <td className="py-2 text-zinc-600 dark:text-zinc-400 truncate max-w-[120px]">
                            {po.purchase_orders?.companies?.name || "Supplier"}
                          </td>
                          <td className="py-2 text-right font-mono font-bold">{po.qty} EA</td>
                          <td className="py-2 text-center">
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {po.purchase_orders?.po_status || "OPEN"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Inventory Movement History */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>🔄</span> 최근 재고 변동 내역 (Recent Inventory Changes)
                </h4>
                <span className="text-[11px] font-semibold text-zinc-400">최신 5건</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs table-fixed">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-400 uppercase bg-zinc-50/50 dark:bg-zinc-950/30">
                      <th className="py-2.5 px-3 w-[105px]">일시</th>
                      <th className="py-2.5 px-3 w-[115px]">구분</th>
                      <th className="py-2.5 px-3 w-[95px] text-right">변동 수량</th>
                      <th className="py-2.5 pl-6 pr-3">사유</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                    {initialMovements.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-zinc-400 text-[11px]">
                          재고 변동 이력이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      initialMovements.slice(0, 5).map((m) => (
                        <tr key={m.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                          <td className="py-2.5 px-3 text-zinc-500 text-[11px] whitespace-nowrap">
                            {new Date(m.created_at).toLocaleDateString("ko-KR", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 whitespace-nowrap inline-block">
                              {MOVEMENT_LABELS[m.type] || m.type}
                            </span>
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                            m.qty_change > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : m.qty_change < 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-zinc-600 dark:text-zinc-400"
                          }`}>
                            {m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change} EA
                          </td>
                          <td className="py-2.5 pl-6 pr-3 text-zinc-700 dark:text-zinc-300 text-xs font-medium">
                            <span className="truncate block max-w-full" title={m.reason || m.note || "-"}>
                              {m.reason || m.note || "-"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PRICE (가격) */}
      {/* ========================================================================= */}
      {activeTab === "price" && (
        <div className="space-y-6">
          {/* Pricing Overview & Modals Trigger Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>💲</span> 거래 가격 및 단가 정책 (Trading Pricing Structure)
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  도매가(Wholesale), 프로모션가, 최저준수가격(MAP), 권장소비자가(SRP) 및 수입원가를 통합 관리합니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPricingModalOpen(true)}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xs"
                >
                  ⚙️ 도매가/가격 수정
                </button>
                <button
                  type="button"
                  onClick={() => setIsPromoModalOpen(true)}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-xs"
                >
                  🔥 프로모션 설정
                </button>
              </div>
            </div>

            {/* Price Structure Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Wholesale & MOQ */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 space-y-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Default Wholesale Price</span>
                <div className="text-2xl font-black text-zinc-900 dark:text-white">
                  ${product.operationalWholesale.toFixed(2)}
                </div>
                <div className="text-xs text-zinc-500 space-y-0.5">
                  <p>MOQ: <strong className="text-zinc-800 dark:text-zinc-200">{product.moq || 1} EA</strong></p>
                  <p>Case Pack: <strong className="text-zinc-800 dark:text-zinc-200">{product.carton_pack_qty || 1} EA</strong></p>
                </div>
              </div>

              {/* MAP & SRP */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 space-y-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">MAP & Retail Price</span>
                <div className="flex items-baseline gap-3">
                  <div>
                    <span className="text-[10px] text-zinc-400 block">SRP (소비자가)</span>
                    <strong className="text-lg font-bold text-zinc-900 dark:text-white">
                      ${product.srpPrice.toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block">MAP (최저가)</span>
                    <strong className="text-lg font-bold text-zinc-700 dark:text-zinc-300">
                      ${product.mapPrice.toFixed(2)}
                    </strong>
                  </div>
                </div>
                {product.price_krw_retail && (
                  <p className="text-[11px] text-zinc-500">
                    원화 기준 MSRP: ₩{product.price_krw_retail.toLocaleString()}
                  </p>
                )}
              </div>

              {/* Landed Cost & Margin */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Landed Cost & Margins</span>
                  <button
                    type="button"
                    onClick={() => setIsCostOverrideModalOpen(true)}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    원가 관리 →
                  </button>
                </div>
                <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                  ${product.effectiveLandedCost.toFixed(2)}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-zinc-200 dark:border-zinc-800">
                  <div>
                    <span className="text-[10px] text-zinc-400 block">자사 마진</span>
                    <strong className="text-indigo-900 dark:text-indigo-200">
                      {safeFormatPercent(product.ourMarginPercent)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block">리테일러 마진</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {safeFormatPercent(product.retailerMarginPercent)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Promotion History Timeline */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>📜</span> 가격 및 프로모션 변동 히스토리 (Pricing Timeline)
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-400 uppercase">
                    <th className="py-2">일시</th>
                    <th className="py-2">이벤트</th>
                    <th className="py-2 text-right">적용 도매가</th>
                    <th className="py-2 text-right">자사 마진</th>
                    <th className="py-2 text-right">리테일러 마진</th>
                    <th className="py-2">작업자 & 사유</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {filteredPricingTimeline.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-zinc-400 text-[11px]">
                        가격 변동 이력이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredPricingTimeline.map((item: any) => (
                      <tr key={item.id}>
                        <td className="py-2 text-[10px] text-zinc-500">{item.date}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.eventBadgeColor}`}>
                            {item.eventTitle}
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono font-bold">${item.newW.toFixed(2)}</td>
                        <td className="py-2 text-right font-mono text-indigo-600 font-bold">
                          {item.newOurMarginPct !== null ? `${item.newOurMarginPct.toFixed(1)}%` : "—"}
                        </td>
                        <td className="py-2 text-right font-mono text-emerald-600 font-bold">
                          {item.newRetailerMarginPct !== null ? `${item.newRetailerMarginPct.toFixed(1)}%` : "—"}
                        </td>
                        <td className="py-2 text-zinc-500 text-[11px]">
                          {item.user} ({item.reason})
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

      {/* ========================================================================= */}
      {/* TAB 4: HUB (HUB 노출 및 마케팅) */}
      {/* ========================================================================= */}
      {activeTab === "hub" && (
        <div className="space-y-6">
          {/* Admin Visibility & Effective Hub Visibility Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>⚙️</span> Retailer Hub 운영 상태 및 노출 제어 (Visibility & Operating Status)
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  운영 상태(active/inactive/historical)와 관리자 노출 설정(visible/hidden)을 변경합니다.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenStatusModal}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
              >
                ⚙️ 상태 및 노출 변경
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Operational Status</span>
                <strong className="text-sm font-bold text-zinc-900 dark:text-white mt-1 block">
                  {TRADING_LABELS[currentTradingStatus] || currentTradingStatus}
                </strong>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Admin Visibility</span>
                <strong className="text-sm font-bold text-zinc-900 dark:text-white mt-1 block">
                  {VISIBILITY_LABELS[currentVisibility] || currentVisibility}
                </strong>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Effective Hub Visibility</span>
                <strong className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-1 block">
                  {liveHubVisibility.effectiveVisibilityLabel}
                </strong>
              </div>
            </div>
          </div>

          {/* ORDER HOLD & BLOCK REASONS CHECKLIST CARD */}
          <div
            id="hold-alerts"
            className={`rounded-xl border p-5 transition-all shadow-sm ${
              holdHighlight
                ? "border-amber-500 ring-4 ring-amber-500/30 bg-amber-50/50 dark:bg-amber-950/40"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>⚠️</span> Hub 노출 보류 및 주문 차단 사유 (Order Hold & Block Reasons)
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  상품이 Hub에서 비노출되거나 주문이 불가능한 상세 사유 목록입니다.
                </p>
              </div>

              <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${liveHubVisibility.isOrderable ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                {liveHubVisibility.isOrderable ? "주문 가능 (Orderable)" : "주문 차단됨 (Blocked)"}
              </span>
            </div>

            {liveHubVisibility.holdReasonLabels.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-2">
                <span>✅</span> 주문 차단 및 노출 보류 사유가 전혀 없습니다. 상품이 정상 거래 가능합니다.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-900 dark:text-rose-200">
                  <strong className="block font-bold mb-1">감지된 주문 차단 / 노출 보류 항목:</strong>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    {liveHubVisibility.holdReasonLabels.map((reason, i) => (
                      <li key={i} className="font-semibold">{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Retailer Sales Policy Card */}
          <RetailerSalesPolicyCard
            productId={product.id}
            productName={product.name}
            cartonPackQty={product.carton_pack_qty || 0}
            salesPolicy={product.salesPolicy || resolveRetailerSalesPolicy(product)}
            srpPrice={product.srpPrice ?? null}
            mapPrice={product.mapPrice ?? null}
          />

          {/* Hub Marketing Badges Configuration Card */}
          <HubBadgesCard
            productId={product.id}
            isPromoActive={product.isPromoActive}
            hubBadges={product.hubBadges || product.price_additional_info?.hub_badges || {}}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: HISTORY (이력관리) */}
      {/* ========================================================================= */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            {/* Filter Bar Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>📜</span> 상품 통합 감사 및 변경 이력 (Audit History Logs)
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  재고 변동(수동 조정·실사·입고), 가격, 원가, 상태 및 Hub 노출 변경 기록을 실시간 카테고리별로 통합 조회합니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  총 <span className="text-zinc-900 dark:text-white font-black">{totalHistoryCount}</span>건
                </span>
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-750 transition-colors"
                >
                  {showRawJson ? "표준 보기" : "Raw JSON 보기"}
                </button>
              </div>
            </div>

            {/* History Sub-Filter Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { id: "ALL", label: "전체", count: parsedAuditRows.length },
                { id: "INV", label: "재고·입고", count: parsedAuditRows.filter((r) => r.filterGroup === "INV").length },
                { id: "PRICE", label: "가격·프로모션", count: parsedAuditRows.filter((r) => r.filterGroup === "PRICE").length },
                { id: "COST", label: "원가", count: parsedAuditRows.filter((r) => r.filterGroup === "COST").length },
                { id: "HUB", label: "Hub·운영 상태", count: parsedAuditRows.filter((r) => r.filterGroup === "HUB").length },
                { id: "SALES", label: "판매·주문", count: parsedAuditRows.filter((r) => r.filterGroup === "SALES").length },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setHistoryFilterType(f.id as any)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                    historyFilterType === f.id
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    historyFilterType === f.id
                      ? "bg-zinc-700 text-zinc-200 dark:bg-zinc-300 dark:text-zinc-800"
                      : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Raw JSON View */}
            {showRawJson ? (
              <div className="p-4 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-xs overflow-x-auto max-h-[600px] border border-zinc-800">
                <pre>{JSON.stringify(filteredAuditRows, null, 2)}</pre>
              </div>
            ) : (
              <>
                {/* Audit Logs Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-400 uppercase bg-zinc-50/60 dark:bg-zinc-950/40">
                        <th className="p-3 w-36">일시</th>
                        <th className="p-3 w-32">구분</th>
                        <th className="p-3 min-w-[180px]">변경 항목</th>
                        <th className="p-3 w-36">변경 전 (Before)</th>
                        <th className="p-3 w-44">변경 후 (After)</th>
                        <th className="p-3 min-w-[220px]">작업자 & 사유</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                      {paginatedAuditRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-zinc-400 text-xs font-sans">
                            조회된 변경 이력이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        paginatedAuditRows.map((row) => (
                          <tr key={row.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                            <td className="p-3 text-[11px] text-zinc-500 font-sans whitespace-nowrap">{row.date}</td>
                            <td className="p-3 font-sans">
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 whitespace-nowrap inline-block">
                                {row.categoryBadgeLabel || row.category}
                              </span>
                            </td>
                            <td className="p-3 font-sans font-bold text-zinc-900 dark:text-zinc-100">{row.field}</td>
                            <td className="p-3 text-zinc-500 text-[11px]">{row.prevVal}</td>
                            <td className="p-3 text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">{row.newVal}</td>
                            <td className="p-3 font-sans text-zinc-700 dark:text-zinc-300 text-[11px] leading-relaxed">
                              {row.operatorReason}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalHistoryCount > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
                    <div className="flex items-center gap-2">
                      <span>페이지 당 항목:</span>
                      <select
                        value={historyPageSize}
                        onChange={(e) => {
                          setHistoryPageSize(Number(e.target.value));
                          setHistoryPage(1);
                        }}
                        className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold"
                      >
                        <option value={10}>10건</option>
                        <option value={20}>20건</option>
                        <option value={50}>50건</option>
                        <option value={100}>100건</option>
                      </select>
                      <span className="text-[11px] text-zinc-400 ml-2">
                        {(historyPage - 1) * historyPageSize + 1} - {Math.min(historyPage * historyPageSize, totalHistoryCount)} / 총 {totalHistoryCount}건
                      </span>
                    </div>

                    {totalHistoryPages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={historyPage <= 1}
                          onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 font-semibold"
                        >
                          이전
                        </button>
                        <span className="px-2 font-mono font-bold text-zinc-800 dark:text-zinc-200">
                          {historyPage} / {totalHistoryPages}
                        </span>
                        <button
                          type="button"
                          disabled={historyPage >= totalHistoryPages}
                          onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                          className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 font-semibold"
                        >
                          다음
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS SECTION */}
      {/* ========================================================================= */}

      {/* MODAL 1: PRICING EDIT */}
      {isPricingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                도매 공급가 및 가격 구조 변경
              </h3>
              <button
                type="button"
                onClick={() => setIsPricingModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {pricingError && <p className="text-xs text-rose-600 font-semibold">{pricingError}</p>}

            <form onSubmit={handlePricingSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                  Default Wholesale Price ($USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editWholesale}
                  onChange={(e) => setEditWholesale(e.target.value)}
                  required
                  className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-bold text-zinc-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    MAP ($USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editMap}
                    onChange={(e) => setEditMap(e.target.value)}
                    className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    SRP ($USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editSrp}
                    onChange={(e) => setEditSrp(e.target.value)}
                    className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  변경 사유 (Reason)
                </label>
                <input
                  type="text"
                  value={editPricingReason}
                  onChange={(e) => setEditPricingReason(e.target.value)}
                  placeholder="예: 공급 계약 단가 조정"
                  className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsPricingModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPricingSubmitting}
                  className="px-4 py-1.5 rounded bg-zinc-900 text-white font-bold hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
                >
                  {isPricingSubmitting ? "저장 중..." : "도매가 저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PROMOTION EDIT */}
      {isPromoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                프로모션 도매가 설정
              </h3>
              <button
                type="button"
                onClick={() => setIsPromoModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {promoError && <p className="text-xs text-rose-600 font-semibold">{promoError}</p>}

            <form onSubmit={handlePromoSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                  Promo Wholesale Price ($USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editPromoPrice}
                  onChange={(e) => setEditPromoPrice(e.target.value)}
                  placeholder="비워둘 경우 프로모션 해제"
                  className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-bold text-zinc-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    시작일 (Start Date)
                  </label>
                  <input
                    type="date"
                    value={editPromoStart}
                    onChange={(e) => setEditPromoStart(e.target.value)}
                    className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white dark:[color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    종료일 (End Date)
                  </label>
                  <input
                    type="date"
                    value={editPromoEnd}
                    onChange={(e) => setEditPromoEnd(e.target.value)}
                    className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white dark:[color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  프로모션 사유
                </label>
                <input
                  type="text"
                  value={editPromoReason}
                  onChange={(e) => setEditPromoReason(e.target.value)}
                  placeholder="예: 블랙프라이데이 특별 할인가 적용"
                  className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsPromoModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPromoSubmitting}
                  className="px-4 py-1.5 rounded bg-amber-500 text-white font-bold hover:bg-amber-600"
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
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  수입원가 수동 오버라이드 (Manual Landed Cost Override)
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  실제 운영 수입원가를 수동으로 지정하거나 갱신합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCostOverrideModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-xs">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Base Landed Cost</span>
                <strong className="text-zinc-800 dark:text-zinc-200">${product.baseLandedCost.toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Current Override</span>
                <strong className="text-zinc-800 dark:text-zinc-200">
                  {product.overrideLandedCost !== null ? `$${product.overrideLandedCost.toFixed(2)}` : "None"}
                </strong>
              </div>
              <div>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block uppercase">Effective Cost</span>
                <strong className="text-indigo-900 dark:text-indigo-300 font-bold">${product.effectiveLandedCost.toFixed(2)}</strong>
              </div>
            </div>

            {costOverrideError && <p className="text-xs text-rose-600 font-semibold">{costOverrideError}</p>}

            <form onSubmit={handleCostOverrideSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                  New Override Cost ($USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editCostOverride}
                  onChange={(e) => setEditCostOverride(e.target.value)}
                  placeholder="e.g. 4.25"
                  className="w-full p-2.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-bold text-sm text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Override Reason
                </label>
                <textarea
                  value={editCostReason}
                  onChange={(e) => setEditCostReason(e.target.value)}
                  rows={2}
                  placeholder="사유를 입력하세요"
                  className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCostOverrideModalOpen(false)}
                  className="px-3.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isCostSubmitting}
                  className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  {isCostSubmitting ? "저장 중..." : "오버라이드 저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: INVENTORY ADJUSTMENT */}
      {isInvAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>📦</span> 재고 수동 조정 (Inventory Adjustment)
              </h3>
              <button
                onClick={() => setIsInvAdjustModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 transition-colors"
              >
                ✕
              </button>
            </div>

            {invAdjError && (
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-semibold">
                ⚠️ {invAdjError}
              </div>
            )}

            <form onSubmit={handleInvAdjustSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                  대상 물류창고 *
                </label>
                <select
                  value={invAdjWarehouseId}
                  onChange={(e) => handleModalWarehouseChange(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">
                    -- 창고 선택 --
                  </option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInvAdjMode("DELTA")}
                  className={`p-2.5 text-left rounded-xl border text-xs font-bold transition-all ${
                    invAdjMode === "DELTA"
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-200 dark:border-indigo-500 shadow-xs"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  증감 수량 조정 (Delta)
                </button>
                <button
                  type="button"
                  onClick={() => setInvAdjMode("TARGET")}
                  className={`p-2.5 text-left rounded-xl border text-xs font-bold transition-all ${
                    invAdjMode === "TARGET"
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-200 dark:border-indigo-500 shadow-xs"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  목표 수량 설정 (Target)
                </button>
              </div>

              {invAdjMode === "DELTA" ? (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-bold block mb-1 text-[11px] text-zinc-700 dark:text-zinc-300">
                      OnHand (+/-)
                    </label>
                    <input
                      type="number"
                      value={invDeltaOnHand}
                      onChange={(e) => setInvDeltaOnHand(e.target.value)}
                      className="w-full p-2 font-mono text-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-[11px] text-zinc-700 dark:text-zinc-300">
                      Damaged (+/-)
                    </label>
                    <input
                      type="number"
                      value={invDeltaDamaged}
                      onChange={(e) => setInvDeltaDamaged(e.target.value)}
                      className="w-full p-2 font-mono text-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-[11px] text-zinc-700 dark:text-zinc-300">
                      Hold (+/-)
                    </label>
                    <input
                      type="number"
                      value={invDeltaHold}
                      onChange={(e) => setInvDeltaHold(e.target.value)}
                      className="w-full p-2 font-mono text-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-bold block mb-1 text-[11px] text-zinc-700 dark:text-zinc-300">
                      목표 OnHand
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={invTargetOnHand}
                      onChange={(e) => setInvTargetOnHand(e.target.value)}
                      className="w-full p-2 font-mono text-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-[11px] text-zinc-700 dark:text-zinc-300">
                      목표 Damaged
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={invTargetDamaged}
                      onChange={(e) => setInvTargetDamaged(e.target.value)}
                      className="w-full p-2 font-mono text-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-[11px] text-zinc-700 dark:text-zinc-300">
                      목표 Hold
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={invTargetHold}
                      onChange={(e) => setInvTargetHold(e.target.value)}
                      className="w-full p-2 font-mono text-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="font-bold block text-zinc-800 dark:text-zinc-200">
                  조정 사유 (Adjustment Reason) *
                </label>
                <select
                  value={invAdjReason}
                  onChange={(e) => {
                    setInvAdjReason(e.target.value);
                    if (e.target.value !== OTHER_INVENTORY_ADJUSTMENT_REASON) {
                      setInvAdjCustomReason("");
                    }
                  }}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  {INVENTORY_ADJUSTMENT_REASONS.map((r) => (
                    <option key={r} value={r} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">
                      {r}
                    </option>
                  ))}
                </select>

                {invAdjReason === OTHER_INVENTORY_ADJUSTMENT_REASON && (
                  <div className="pt-1">
                    <label className="font-semibold block mb-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                      기타 상세 사유 직접 입력 (Custom Reason) *
                    </label>
                    <input
                      type="text"
                      value={invAdjCustomReason}
                      onChange={(e) => setInvAdjCustomReason(e.target.value)}
                      required
                      placeholder="상세 사유를 구체적으로 입력하세요 (e.g. 샘플 테스트 출고, 마케팅 협찬 등)"
                      className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsInvAdjustModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isInvAdjSubmitting}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isInvAdjSubmitting ? "저장 중..." : "조정 완료"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: STATUS & VISIBILITY CONTROL */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>⚙️</span> 운영 상태 및 Hub 노출 관리
              </h3>
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 transition-colors"
              >
                ✕
              </button>
            </div>

            {statusError && (
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-semibold">
                ⚠️ {statusError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1.5">
                  운영 상태 (Trading Status)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: "active", label: "운영 중" },
                    { val: "inactive", label: "운영 중지" },
                    { val: "historical", label: "운영 종료" },
                  ].map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => handleTargetTradingStatusChange(s.val)}
                      className={`p-2.5 text-center text-xs rounded-xl border transition-all ${
                        targetTradingStatus === s.val
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-200 dark:border-indigo-500 font-bold shadow-xs"
                          : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1.5">
                  Hub 노출 (Visibility)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={targetTradingStatus !== "active"}
                    onClick={() => setTargetVisibility("visible")}
                    className={`p-2.5 text-center text-xs rounded-xl border transition-all ${
                      targetTradingStatus !== "active"
                        ? "opacity-40 cursor-not-allowed border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 text-zinc-400 dark:text-zinc-500"
                        : targetVisibility === "visible"
                        ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-950 dark:text-emerald-200 dark:border-emerald-500 font-bold shadow-xs"
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    노출 (Visible)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetVisibility("hidden")}
                    className={`p-2.5 text-center text-xs rounded-xl border transition-all ${
                      targetVisibility === "hidden"
                        ? "border-zinc-700 dark:border-zinc-500 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold shadow-xs"
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    비노출 (Hidden)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                  사유 (Reason)
                </label>
                <input
                  type="text"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="변경 사유 입력"
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isStatusSubmitting}
                onClick={handleSaveStatusVisibility}
                className="rounded-xl bg-indigo-600 dark:bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isStatusSubmitting ? "저장 중..." : "상태 저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {isLightboxOpen && photoUrls.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="absolute top-2 right-2 text-white p-2 text-xl font-bold"
            >
              ✕
            </button>
            <img
              src={photoUrls[lightboxIndex]}
              alt={product.name}
              className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
