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
  photoUrls?: string[];
  upc?: string | null;
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

  // Lightbox state
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const photoUrls = useMemo(() => {
    if (product.photoUrls && product.photoUrls.length > 0) return product.photoUrls;
    if (product.photoUrl) return [product.photoUrl];
    return [];
  }, [product.photoUrls, product.photoUrl]);

  React.useEffect(() => {
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

        // Our Margin
        const oldOurMarginPct = oldW && oldW > 0 ? ((oldW - effectiveCost) / oldW) * 100 : null;
        const newOurMarginPct = newW > 0 ? ((newW - effectiveCost) / newW) * 100 : null;
        const ourMarginDiffPts = (oldOurMarginPct !== null && newOurMarginPct !== null) ? (newOurMarginPct - oldOurMarginPct) : null;

        // Retailer Margin
        const oldRetailerMarginPct = oldS && oldS > 0 && oldW && oldW > 0 ? ((oldS - oldW) / oldS) * 100 : null;
        const newRetailerMarginPct = newS > 0 && newW > 0 ? ((newS - newW) / newS) * 100 : null;

        // Promo Discount % & Promo Margins
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
          // Before/After values
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
          // Calculated Margins
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
      list = list.filter((e) => e.changeType === "PRICING");
    } else if (pricingFilterType === "PROMOTION") {
      list = list.filter((e) => e.changeType === "PROMOTION");
    }

    if (pricingFilterDays !== "ALL") {
      const cutoffDays = parseInt(pricingFilterDays);
      const cutoffTimestamp = Date.now() - cutoffDays * 24 * 60 * 60 * 1000;
      list = list.filter((e) => e.timestamp >= cutoffTimestamp);
    }

    return list;
  }, [pricingTimeline, pricingFilterType, pricingFilterDays]);

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
          
          {/* A. Product Summary Card (Product Identity) */}
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

            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div
                onClick={() => {
                  if (photoUrls.length > 0) {
                    setLightboxIndex(0);
                    setIsLightboxOpen(true);
                  }
                }}
                className={`w-32 h-32 md:w-36 md:h-36 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-50 dark:bg-zinc-950 flex-shrink-0 flex items-center justify-center relative group shadow-sm ${
                  photoUrls.length > 0 ? "cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-all" : ""
                }`}
              >
                {product.photoUrl ? (
                  <>
                    <img src={product.photoUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-0.5">
                      <span>🔍 Enlarge</span>
                      {photoUrls.length > 1 && <span>({photoUrls.length} images)</span>}
                    </div>
                  </>
                ) : (
                  <span className="text-[10px] text-zinc-400 font-bold">NO IMAGE</span>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-900/40">
                    {product.brandName}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-medium">| {product.companyName}</span>
                </div>

                <h2 className="text-sm font-bold text-zinc-900 dark:text-white leading-snug">
                  {product.name}
                </h2>

                {product.display_name && product.display_name !== product.name && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium italic">
                    {product.display_name}
                  </p>
                )}

                {product.category_full_path && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    📂 {product.category_full_path}
                  </p>
                )}

                <div className="flex items-center gap-1.5 pt-1">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                      SALES_COLORS[product.sales_status] || SALES_COLORS.PREPARING
                    }`}
                  >
                    Sales: {SALES_LABELS[product.sales_status] || product.sales_status}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full border bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700">
                    Trading: {product.trading_status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs border-t border-zinc-100 dark:border-zinc-800 pt-3">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Letusto SKU</span>
                <span className="font-mono text-zinc-900 dark:text-zinc-200 font-semibold text-[11px]">{product.letusto_sku || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">제조사 SKU</span>
                <span className="font-mono text-zinc-900 dark:text-zinc-200 font-semibold text-[11px]">{product.manufacture_sku || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">UPC / Barcode</span>
                <span className="font-mono text-zinc-900 dark:text-zinc-200 font-semibold text-[11px]">{product.upc || "-"}</span>
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

          {/* TAB 4: PRICING & PROMOTIONS TIMELINE */}
          {activeTab === "pricing" && (
            <div className="space-y-5">
              {/* 1. Current Active Policy Section */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-zinc-50 to-indigo-50/30 dark:from-zinc-950 dark:to-indigo-950/20 border border-zinc-200 dark:border-zinc-800 space-y-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🏷️ 현재 활성 상업 도매 정책 (Current Active Policy)</span>
                  </span>
                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    Source: {product.hasPricingOverride ? "Trading Operational Override" : "Product Catalog Default"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 block uppercase">Wholesale Price</span>
                    <strong className="text-sm font-extrabold text-zinc-900 dark:text-white">${product.operationalWholesale.toFixed(2)}</strong>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-amber-600 block uppercase">Promo Wholesale</span>
                    <strong className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                      {product.promoWholesale ? `$${product.promoWholesale.toFixed(2)}` : "없음"}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 block uppercase">MAP</span>
                    <strong className="text-sm font-bold text-zinc-800 dark:text-zinc-200">${product.mapPrice.toFixed(2)}</strong>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 block uppercase">SRP</span>
                    <strong className="text-sm font-bold text-zinc-800 dark:text-zinc-200">${product.srpPrice.toFixed(2)}</strong>
                  </div>

                  <div className="p-2.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/40">
                    <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 block uppercase">Effective Cost</span>
                    <strong className="text-sm font-extrabold text-indigo-900 dark:text-indigo-200">${product.effectiveLandedCost.toFixed(2)}</strong>
                  </div>

                  <div className="p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block uppercase">Our Margin</span>
                    <strong className="text-sm font-extrabold text-emerald-800 dark:text-emerald-300">
                      {product.ourMarginPercent.toFixed(1)}% <span className="text-[10px] font-normal">(${product.ourMarginUsd.toFixed(2)})</span>
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40">
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 block uppercase">Retailer Margin</span>
                    <strong className="text-sm font-extrabold text-blue-800 dark:text-blue-300">
                      {product.retailerMarginPercent.toFixed(1)}% <span className="text-[10px] font-normal">(${product.retailerMarginUsd.toFixed(2)})</span>
                    </strong>
                  </div>
                </div>
              </div>

              {/* 2. Chronological Pricing & Promotion History Timeline */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <span>📈 가격 및 프로모션 히스토리 타임라인 (Commercial Pricing Timeline)</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {filteredPricingTimeline.length}건
                      </span>
                    </h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      도매가, MAP, SRP 및 프로모션 변경 이력과 당시 수입원가 기준 마진 변동 추이를 기록합니다.
                    </p>
                  </div>

                  {/* Lightweight Filter Controls */}
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5 bg-zinc-50 dark:bg-zinc-900">
                      <button
                        type="button"
                        onClick={() => setPricingFilterType("ALL")}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                          pricingFilterType === "ALL"
                            ? "bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white shadow-sm"
                            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                        }`}
                      >
                        전체
                      </button>
                      <button
                        type="button"
                        onClick={() => setPricingFilterType("PRICING")}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                          pricingFilterType === "PRICING"
                            ? "bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white shadow-sm"
                            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                        }`}
                      >
                        가격 정책 변경
                      </button>
                      <button
                        type="button"
                        onClick={() => setPricingFilterType("PROMOTION")}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                          pricingFilterType === "PROMOTION"
                            ? "bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white shadow-sm"
                            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                        }`}
                      >
                        프로모션
                      </button>
                    </div>

                    <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5 bg-zinc-50 dark:bg-zinc-900">
                      <button
                        type="button"
                        onClick={() => setPricingFilterDays("ALL")}
                        className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                          pricingFilterDays === "ALL"
                            ? "bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white shadow-sm"
                            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
                        }`}
                      >
                        전체 기간
                      </button>
                      <button
                        type="button"
                        onClick={() => setPricingFilterDays("30")}
                        className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                          pricingFilterDays === "30"
                            ? "bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white shadow-sm"
                            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
                        }`}
                      >
                        30일
                      </button>
                      <button
                        type="button"
                        onClick={() => setPricingFilterDays("90")}
                        className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                          pricingFilterDays === "90"
                            ? "bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white shadow-sm"
                            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
                        }`}
                      >
                        90일
                      </button>
                    </div>
                  </div>
                </div>

                {filteredPricingTimeline.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                    기록된 상업 가격 변경 또는 프로모션 이력이 없습니다.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900">
                    <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-300">
                      <thead className="bg-zinc-50 text-[10px] uppercase font-bold text-zinc-400 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="py-3 px-3.5">일시 및 이벤트</th>
                          <th className="py-3 px-3 text-right">Operational Wholesale</th>
                          <th className="py-3 px-3 text-right">Promo Wholesale</th>
                          <th className="py-3 px-3 text-right">MAP</th>
                          <th className="py-3 px-3 text-right">SRP</th>
                          <th className="py-3 px-3 text-right">Cost Basis</th>
                          <th className="py-3 px-3 text-right">Our Margin</th>
                          <th className="py-3 px-3 text-right">Retailer Margin</th>
                          <th className="py-3 px-3.5">사유 및 작성자</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {filteredPricingTimeline.map((item) => (
                          <tr key={item.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-950/60 transition-colors">
                            {/* Column 1: Date & Event Type Badge */}
                            <td className="py-3 px-3.5 space-y-1">
                              <span className="font-mono text-[11px] text-zinc-500 block">{item.date}</span>
                              <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border ${item.eventBadgeColor}`}>
                                {item.eventTitle}
                              </span>
                            </td>

                            {/* Column 2: Operational Wholesale */}
                            <td className="py-3 px-3 text-right font-mono">
                              {item.isWholesaleChanged ? (
                                <div>
                                  <span className="text-zinc-400 text-[10px] block line-through">
                                    ${item.oldW?.toFixed(2)}
                                  </span>
                                  <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                                    ${item.newW.toFixed(2)}
                                  </strong>
                                </div>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </td>

                            {/* Column 3: Promo Wholesale */}
                            <td className="py-3 px-3 text-right font-mono">
                              {item.changeType === "PROMOTION" && item.newPromo !== null ? (
                                <div>
                                  <strong className="text-amber-600 dark:text-amber-400 font-extrabold text-xs block">
                                    ${item.newPromo.toFixed(2)}
                                  </strong>
                                  {item.promoLabel && (
                                    <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                      {item.promoLabel}
                                    </span>
                                  )}
                                  {item.promoStartDate && item.promoEndDate && (
                                    <span className="text-[9px] text-zinc-400 block font-sans mt-0.5">
                                      {item.promoStartDate} ~ {item.promoEndDate}
                                    </span>
                                  )}
                                </div>
                              ) : item.isPromoChanged && item.newPromo === null ? (
                                <span className="text-xs font-bold text-rose-500">해제됨</span>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </td>

                            {/* Column 4: MAP */}
                            <td className="py-3 px-3 text-right font-mono">
                              {item.isMapChanged ? (
                                <div>
                                  <span className="text-zinc-400 text-[10px] block line-through">
                                    {item.oldM !== null ? `$${item.oldM.toFixed(2)}` : "-"}
                                  </span>
                                  <strong className="text-zinc-800 dark:text-zinc-200 font-bold">
                                    ${item.newM.toFixed(2)}
                                  </strong>
                                </div>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </td>

                            {/* Column 5: SRP */}
                            <td className="py-3 px-3 text-right font-mono">
                              {item.isSrpChanged ? (
                                <div>
                                  <span className="text-zinc-400 text-[10px] block line-through">
                                    {item.oldS !== null ? `$${item.oldS.toFixed(2)}` : "-"}
                                  </span>
                                  <strong className="text-zinc-800 dark:text-zinc-200 font-bold">
                                    ${item.newS.toFixed(2)}
                                  </strong>
                                </div>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </td>

                            {/* Column 6: Cost Basis (Effective Landed Cost at time) */}
                            <td className="py-3 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              ${item.effectiveCost.toFixed(2)}
                            </td>

                            {/* Column 7: Our Margin Impact */}
                            <td className="py-3 px-3 text-right font-mono">
                              {item.changeType === "PROMOTION" && item.promoOurMarginPct !== null ? (
                                <div>
                                  <strong className={`text-xs font-extrabold ${item.promoOurMarginPct <= 0 ? 'text-rose-600' : 'text-amber-600 dark:text-amber-400'}`}>
                                    {item.promoOurMarginPct.toFixed(1)}%
                                  </strong>
                                  <span className="text-[9px] text-zinc-400 block font-sans">Promo Margin</span>
                                </div>
                              ) : item.isWholesaleChanged && item.oldOurMarginPct !== null && item.newOurMarginPct !== null ? (
                                <div>
                                  <span className="text-zinc-400 text-[10px] block line-through">
                                    {item.oldOurMarginPct.toFixed(1)}%
                                  </span>
                                  <strong className={`text-xs font-extrabold ${item.newOurMarginPct <= 0 ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    {item.newOurMarginPct.toFixed(1)}%
                                  </strong>
                                  {item.ourMarginDiffPts !== null && (
                                    <span className={`text-[10px] font-bold block ${item.ourMarginDiffPts >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {item.ourMarginDiffPts >= 0 ? `+${item.ourMarginDiffPts.toFixed(1)}%p` : `${item.ourMarginDiffPts.toFixed(1)}%p`}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <strong className={`text-xs font-bold ${item.newOurMarginPct && item.newOurMarginPct <= 0 ? 'text-rose-600' : 'text-zinc-800 dark:text-zinc-200'}`}>
                                  {item.newOurMarginPct !== null ? `${item.newOurMarginPct.toFixed(1)}%` : "-"}
                                </strong>
                              )}
                            </td>

                            {/* Column 8: Retailer Margin */}
                            <td className="py-3 px-3 text-right font-mono">
                              {item.changeType === "PROMOTION" && item.promoRetailerMarginPct !== null ? (
                                <div>
                                  <strong className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                    {item.promoRetailerMarginPct.toFixed(1)}%
                                  </strong>
                                  <span className="text-[9px] text-zinc-400 block font-sans">Promo Retailer</span>
                                </div>
                              ) : (item.isWholesaleChanged || item.isSrpChanged) && item.oldRetailerMarginPct !== null && item.newRetailerMarginPct !== null ? (
                                <div>
                                  <span className="text-zinc-400 text-[10px] block line-through">
                                    {item.oldRetailerMarginPct.toFixed(1)}%
                                  </span>
                                  <strong className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                    {item.newRetailerMarginPct.toFixed(1)}%
                                  </strong>
                                </div>
                              ) : item.newRetailerMarginPct !== null ? (
                                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                  {item.newRetailerMarginPct.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </td>

                            {/* Column 9: Reason & User */}
                            <td className="py-3 px-3.5 space-y-0.5">
                              <p className="text-xs text-zinc-800 dark:text-zinc-200 font-medium line-clamp-2">
                                {item.reason}
                              </p>
                              <span className="text-[10px] text-zinc-400 font-semibold block">
                                by {item.user}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  운영 도매가 및 가격 정책 설정 (Pricing Policy Edit)
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  운영 도매가, MAP, SRP 기준 가격을 변경합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPricingModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Current State */}
            <div className="grid grid-cols-4 gap-2 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-xs">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Current Wholesale</span>
                <strong className="text-zinc-800 dark:text-zinc-200">${product.operationalWholesale.toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Current MAP</span>
                <strong className="text-zinc-800 dark:text-zinc-200">${product.mapPrice.toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Current SRP</span>
                <strong className="text-zinc-800 dark:text-zinc-200">${product.srpPrice.toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block uppercase">Effective Cost</span>
                <strong className="text-indigo-900 dark:text-indigo-200 font-bold">${product.effectiveLandedCost.toFixed(2)}</strong>
              </div>
            </div>

            {pricingError && <p className="text-xs text-rose-600 font-semibold">{pricingError}</p>}

            <form onSubmit={handlePricingSubmit} className="space-y-4 text-xs">
              {/* Editable Inputs */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-zinc-800 dark:text-zinc-200 block mb-1">New Wholesale ($USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editWholesale}
                    onChange={(e) => setEditWholesale(e.target.value)}
                    required
                    className="w-full p-2.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-bold text-sm text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">MAP ($USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editMap}
                    onChange={(e) => setEditMap(e.target.value)}
                    className="w-full p-2.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">SRP ($USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editSrp}
                    onChange={(e) => setEditSrp(e.target.value)}
                    className="w-full p-2.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Live Impact Preview */}
              {(() => {
                const newW = parseFloat(editWholesale);
                const newS = parseFloat(editSrp);
                const newM = parseFloat(editMap);

                if (isNaN(newW) || newW <= 0) return null;

                const newOurMarginUsd = newW - product.effectiveLandedCost;
                const newOurMarginPct = newW > 0 ? (newOurMarginUsd / newW) * 100 : 0;
                const marginChangePts = newOurMarginPct - product.baseOurMarginPercent;

                const newRetailerMarginUsd = !isNaN(newS) && newS > 0 ? newS - newW : 0;
                const newRetailerMarginPct = !isNaN(newS) && newS > 0 ? (newRetailerMarginUsd / newS) * 100 : 0;

                return (
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] font-bold text-zinc-800 dark:text-zinc-200">
                        <span>Live Pricing Impact Preview (Current → New → Impact)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-2 rounded bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block uppercase">New Our Margin</span>
                          <strong className={`text-xs font-extrabold ${newOurMarginUsd <= 0 ? 'text-rose-600' : 'text-emerald-800 dark:text-emerald-300'}`}>
                            ${newOurMarginUsd.toFixed(2)} ({newOurMarginPct.toFixed(1)}%)
                          </strong>
                          <span className="text-[10px] text-zinc-500 block mt-0.5">
                            Margin Change: {marginChangePts >= 0 ? `+${marginChangePts.toFixed(1)}%p` : `${marginChangePts.toFixed(1)}%p`}
                          </span>
                        </div>

                        <div className="p-2 rounded bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40">
                          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 block uppercase">New Retailer Margin</span>
                          <strong className="text-xs font-extrabold text-blue-800 dark:text-blue-300">
                            ${newRetailerMarginUsd.toFixed(2)} ({newRetailerMarginPct.toFixed(1)}%)
                          </strong>
                          <span className="text-[10px] text-zinc-500 block mt-0.5">
                            SRP (${!isNaN(newS) ? newS.toFixed(2) : '0.00'}) 기준
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Validation Warnings */}
                    {newW <= product.effectiveLandedCost && (
                      <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium">
                        ⚠️ <strong>주의:</strong> 입력한 도매가가 적용 수입원가(${product.effectiveLandedCost.toFixed(2)}) 이하입니다. (자사 마진 0% 이하)
                      </div>
                    )}
                    {!isNaN(newM) && !isNaN(newS) && newM > newS && newS > 0 && (
                      <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium">
                        ⚠️ <strong>주의:</strong> MAP(최저준수가격)가 SRP(권장소비자가)보다 큽니다.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Optional Reason */}
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Pricing Reason <span className="text-zinc-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={editPricingReason}
                  onChange={(e) => setEditPricingReason(e.target.value)}
                  placeholder="Optional pricing change note"
                  className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsPricingModalOpen(false)}
                  className="px-3.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPricingSubmitting}
                  className="px-4 py-1.5 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold transition-colors"
                >
                  {isPricingSubmitting ? "적용 중..." : "Apply Pricing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD PROMOTION */}
      {isPromoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  프로모션 도매가 설정 (Promotion Setup)
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  한시적 프로모션 공급가 및 기간을 지정합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPromoModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Current State Context */}
            <div className="grid grid-cols-4 gap-2 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-xs">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Current Wholesale</span>
                <strong className="text-zinc-800 dark:text-zinc-200">${product.operationalWholesale.toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Current MAP</span>
                <strong className="text-zinc-800 dark:text-zinc-200">${product.mapPrice.toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">Current SRP</span>
                <strong className="text-zinc-800 dark:text-zinc-200">${product.srpPrice.toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block uppercase">Effective Cost</span>
                <strong className="text-indigo-900 dark:text-indigo-200 font-bold">${product.effectiveLandedCost.toFixed(2)}</strong>
              </div>
            </div>

            {promoError && <p className="text-xs text-rose-600 font-semibold">{promoError}</p>}

            <form onSubmit={handlePromoSubmit} className="space-y-4 text-xs">
              {/* Editable Inputs */}
              <div>
                <label className="font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                  Promotional Wholesale Price ($USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editPromoPrice}
                  onChange={(e) => setEditPromoPrice(e.target.value)}
                  placeholder="Leave empty to clear active promotion"
                  className="w-full p-2.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-bold text-sm text-zinc-900 dark:text-white"
                />
              </div>

              {/* Live Calculation Preview */}
              {(() => {
                const promoPrice = parseFloat(editPromoPrice);
                if (isNaN(promoPrice) || promoPrice <= 0) return null;

                const diffUsd = promoPrice - product.operationalWholesale;
                const changePct = product.operationalWholesale > 0 ? (diffUsd / product.operationalWholesale) * 100 : 0;
                const ourMarginUsd = promoPrice - product.effectiveLandedCost;
                const ourMarginPct = promoPrice > 0 ? (ourMarginUsd / promoPrice) * 100 : 0;
                const retailerMarginUsd = product.srpPrice - promoPrice;
                const retailerMarginPct = product.srpPrice > 0 ? (retailerMarginUsd / product.srpPrice) * 100 : 0;

                return (
                  <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-800 dark:text-amber-300">
                      <span>Live Impact Preview (프로모션 마진 및 할인율 계산)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Wholesale Change</span>
                        <strong className={`text-xs font-bold ${diffUsd < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {diffUsd < 0 ? `-$${Math.abs(diffUsd).toFixed(2)} (${changePct.toFixed(1)}%)` : `+$${diffUsd.toFixed(2)} (+${changePct.toFixed(1)}%)`}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Our Margin ($ / %)</span>
                        <strong className={`text-xs font-bold ${ourMarginUsd < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          ${ourMarginUsd.toFixed(2)} ({ourMarginPct.toFixed(1)}%)
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Retailer Margin ($ / %)</span>
                        <strong className="text-xs font-bold text-blue-600">
                          ${retailerMarginUsd.toFixed(2)} ({retailerMarginPct.toFixed(1)}%)
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Date Pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">시작일 (Start Date)</label>
                  <input
                    type="date"
                    value={editPromoStart}
                    onChange={(e) => setEditPromoStart(e.target.value)}
                    className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">종료일 (End Date)</label>
                  <input
                    type="date"
                    value={editPromoEnd}
                    onChange={(e) => setEditPromoEnd(e.target.value)}
                    className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              {editPromoStart && editPromoEnd && new Date(editPromoEnd) < new Date(editPromoStart) && (
                <p className="text-xs font-semibold text-rose-600">⚠️ 종료일은 시작일보다 빠를 수 없습니다.</p>
              )}

              {/* Optional Reason */}
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Promotion Reason <span className="text-zinc-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={editPromoReason}
                  onChange={(e) => setEditPromoReason(e.target.value)}
                  placeholder="Optional promotion note"
                  className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsPromoModalOpen(false)}
                  className="px-3.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPromoSubmitting || (!!editPromoStart && !!editPromoEnd && new Date(editPromoEnd) < new Date(editPromoStart))}
                  className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors disabled:opacity-50"
                >
                  {isPromoSubmitting ? "저장 중..." : "Save Promotion"}
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
            {/* Header */}
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

            {/* Current State */}
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
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block uppercase">Current Effective</span>
                <strong className="text-indigo-900 dark:text-indigo-200 font-bold">${product.effectiveLandedCost.toFixed(2)}</strong>
              </div>
            </div>

            {costOverrideError && <p className="text-xs text-rose-600 font-semibold">{costOverrideError}</p>}

            <form onSubmit={handleCostOverrideSubmit} className="space-y-4 text-xs">
              {/* Editable Input */}
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

              {/* Live Impact Preview */}
              {(() => {
                const parsedVal = parseFloat(editCostOverride);
                const newEffective = !isNaN(parsedVal) && parsedVal > 0 ? parsedVal : product.baseLandedCost;
                const diffUsd = newEffective - product.effectiveLandedCost;
                const diffPct = product.effectiveLandedCost > 0 ? (diffUsd / product.effectiveLandedCost) * 100 : 0;

                return (
                  <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-indigo-800 dark:text-indigo-300">
                      <span>Live Impact Preview (실시간 변경 적용 영향)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                      <div>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">New Effective Cost</span>
                        <strong className="text-indigo-900 dark:text-indigo-200 text-sm font-extrabold">
                          ${newEffective.toFixed(2)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">Difference ($)</span>
                        <strong className={`text-xs font-bold ${diffUsd > 0 ? 'text-rose-600' : diffUsd < 0 ? 'text-emerald-600' : 'text-zinc-600'}`}>
                          {diffUsd > 0 ? `+$${diffUsd.toFixed(2)}` : diffUsd < 0 ? `-$${Math.abs(diffUsd).toFixed(2)}` : '$0.00'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">Difference (%)</span>
                        <strong className={`text-xs font-bold ${diffPct > 0 ? 'text-rose-600' : diffPct < 0 ? 'text-emerald-600' : 'text-zinc-600'}`}>
                          {diffPct > 0 ? `+${diffPct.toFixed(1)}%` : `${diffPct.toFixed(1)}%`}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Optional Reason Note */}
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Override Reason <span className="text-zinc-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  value={editCostReason}
                  onChange={(e) => setEditCostReason(e.target.value)}
                  rows={2}
                  placeholder="Optional note for this override"
                  className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCostOverrideModalOpen(false)}
                  className="px-3.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isCostSubmitting}
                  className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors"
                >
                  {isCostSubmitting ? "저장 중..." : product.hasCostOverride ? "Update Override" : "Save Override"}
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

      {/* MODAL 6: PRODUCT IMAGE LIGHTBOX */}
      {isLightboxOpen && photoUrls.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="absolute top-2 right-2 z-10 rounded-full bg-black/60 text-white p-2 hover:bg-black/90 transition-colors"
              title="Close (ESC)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Main Image Container */}
            <div className="relative flex items-center justify-center max-h-[75vh] w-full overflow-hidden rounded-xl bg-zinc-950/80 p-2 border border-zinc-800">
              <img
                src={photoUrls[lightboxIndex]}
                alt={`${product.name} ${lightboxIndex + 1}`}
                className="max-h-[72vh] max-w-full object-contain rounded-lg shadow-2xl"
              />

              {/* Navigation Controls */}
              {photoUrls.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex((prev) => (prev > 0 ? prev - 1 : photoUrls.length - 1));
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/70 hover:bg-black text-white p-3 transition-colors shadow-lg font-bold"
                    title="Previous (Left Arrow)"
                  >
                    ❮
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex((prev) => (prev < photoUrls.length - 1 ? prev + 1 : 0));
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/70 hover:bg-black text-white p-3 transition-colors shadow-lg font-bold"
                    title="Next (Right Arrow)"
                  >
                    ❯
                  </button>
                </>
              )}
            </div>

            {/* Image Counter & Product Name */}
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs font-semibold text-zinc-200 truncate max-w-md">
                {product.name}
              </span>
              {photoUrls.length > 1 && (
                <span className="text-xs font-mono font-bold text-white bg-zinc-800/90 px-3 py-0.5 rounded-full border border-zinc-700">
                  {lightboxIndex + 1} / {photoUrls.length}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
