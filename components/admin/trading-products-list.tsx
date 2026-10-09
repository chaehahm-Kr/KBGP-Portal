"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import Link from "next/link";
import { updateTradingStatusAndVisibility } from "@/lib/product/trading-actions";
import { type MissingFieldItem } from "@/lib/product/registration-status";

export interface TradingProductItem {
  id: string;
  name: string;
  display_name: string;
  manufacture_sku: string | null;
  display_manufacture_sku: string | null;
  letusto_sku: string | null;
  parent_sku: string | null;
  child_sku: string | null;
  upc: string | null;
  category: string;
  brand_id: string;
  company_id: string;
  companyName: string;
  brandName: string;
  photoUrl: string | null;
  selection_status: string;
  sales_status: string;
  trading_status: string;
  retailer_visibility: string;
  category_code?: string | null;
  category_full_path?: string | null;
  wholesalePrice: number | null;
  hasActivePromo?: boolean;
  retailPrice: number | null;
  retailerMarginPercent: number | null;
  retailerMarginStatus: "normal" | "caution" | "warning" | "none";
  formattedWholesale: string;
  formattedRetail: string;
  formattedMargin: string;
  qty_on_hand: number;
  qty_hold: number;
  qty_damaged: number;
  qty_available: number;
  warnings: string[];
  isOrderable?: boolean;
  orderabilityReasons?: string[];
  orderabilityPrimaryReason?: string | null;
  missingFields?: string[];
  missingFieldItems?: MissingFieldItem[];
  effective_visibility?: "PUBLISHED" | "ON_HOLD" | "HIDDEN";
  effective_visibility_label?: string;
  effective_visibility_description?: string;
  hold_reasons?: string[];
  hold_reason_labels?: string[];
  holdReasons?: string[];
  holdReasonLabels?: string[];
  orderability_status?: "ORDERABLE" | "OUT_OF_STOCK" | "INSUFFICIENT_STOCK" | "NOT_ORDERABLE";
  orderability_label?: string;
  orderability_reason?: string;
  is_sold_out?: boolean;
  restock_eta?: string | null;
  moq?: number;
}

interface TradingProductsListProps {
  initialProducts: TradingProductItem[];
}

const TRADING_COLORS: Record<string, string> = {
  active: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
  inactive: "bg-zinc-100 text-zinc-650 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  historical: "bg-zinc-200 text-zinc-650 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-800",
};

const TRADING_LABELS: Record<string, string> = {
  active: "운영 중",
  inactive: "운영 중지",
  historical: "운영 종료",
};

const VISIBILITY_COLORS: Record<string, string> = {
  visible: "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  hidden: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
};

const VISIBILITY_LABELS: Record<string, string> = {
  visible: "노출",
  hidden: "비노출",
};

type SortField = "name" | "wholesale" | "retail" | "margin" | "on_hand" | "available";
type SortDirection = "asc" | "desc";

export function TradingProductsList({ initialProducts }: TradingProductsListProps) {
  const [products, setProducts] = useState<TradingProductItem[]>(initialProducts);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCompanyId, setSelectedCompanyId] = useState("all");
  const [selectedBrandId, setSelectedBrandId] = useState("all");
  const [selectedTradingStatus, setSelectedTradingStatus] = useState("all");
  const [selectedVisibility, setSelectedVisibility] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [, startTransition] = useTransition();

  // Confirmation Modal state
  const [confirmationModal, setConfirmationModal] = useState<{
    open: boolean;
    product: TradingProductItem | null;
    newTradingStatus: "active" | "inactive" | "historical";
    newVisibility: "visible" | "hidden";
  } | null>(null);

  // Orderability Detail Modal state
  const [orderabilityModalProduct, setOrderabilityModalProduct] = useState<TradingProductItem | null>(null);

  // Hold Detail Modal state
  const [holdDetailModalProduct, setHoldDetailModalProduct] = useState<TradingProductItem | null>(null);

  const handleQuickFilterClick = (filterId: string) => {
    if (filterId === "all") {
      setQuickFilter("all");
    } else {
      setQuickFilter((prev) => (prev === filterId ? "all" : filterId));
    }
  };

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  // Aggregate Summary Stats
  const summaryStats = useMemo(() => {
    const total = products.length;
    const adminVisible = products.filter((p) => p.retailer_visibility === "visible").length;
    const adminHidden = products.filter((p) => p.retailer_visibility === "hidden").length;

    const hubPublished = products.filter((p) => p.effective_visibility === "PUBLISHED").length;
    const hubOnHold = products.filter((p) => p.effective_visibility === "ON_HOLD").length;
    const hubHidden = products.filter(
      (p) => p.effective_visibility === "HIDDEN" || p.retailer_visibility === "hidden"
    ).length;

    const orderable = products.filter((p) => p.isOrderable).length;
    const outOfStock = products.filter(
      (p) => p.is_sold_out && p.effective_visibility === "PUBLISHED"
    ).length;
    const notOrderable = products.filter((p) => !p.isOrderable && !p.is_sold_out).length;

    return {
      total,
      adminVisible,
      adminHidden,
      hubPublished,
      hubOnHold,
      hubHidden,
      orderable,
      outOfStock,
      notOrderable,
    };
  }, [products]);

  // Extract unique filter options from initialProducts
  const uniqueCategories = Array.from(new Set(initialProducts.map((p) => p.category))).filter(Boolean);
  
  const uniqueCompanies = Array.from(
    new Map(initialProducts.map((p) => [p.company_id, p.companyName])).entries()
  );

  const uniqueBrands = Array.from(
    new Map(initialProducts.map((p) => [p.brand_id, p.brandName])).entries()
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    const s = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !s ||
      p.display_name.toLowerCase().includes(s) ||
      p.name.toLowerCase().includes(s) ||
      (p.letusto_sku || "").toLowerCase().includes(s) ||
      (p.display_manufacture_sku || p.manufacture_sku || "").toLowerCase().includes(s) ||
      (p.upc || "").toLowerCase().includes(s) ||
      p.companyName.toLowerCase().includes(s) ||
      p.brandName.toLowerCase().includes(s);

    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
    const matchesCompany = selectedCompanyId === "all" || p.company_id === selectedCompanyId;
    const matchesBrand = selectedBrandId === "all" || p.brand_id === selectedBrandId;
    const matchesTradingStatus = selectedTradingStatus === "all" || p.trading_status === selectedTradingStatus;
    const matchesVisibility = selectedVisibility === "all" || p.retailer_visibility === selectedVisibility;

    // Quick Filter Chips
    let matchesQuick = true;
    if (quickFilter === "hub_published") matchesQuick = p.effective_visibility === "PUBLISHED";
    else if (quickFilter === "hub_on_hold") matchesQuick = p.effective_visibility === "ON_HOLD";
    else if (quickFilter === "hub_hidden") matchesQuick = p.effective_visibility === "HIDDEN" || p.retailer_visibility === "hidden";
    else if (quickFilter === "in_stock") matchesQuick = p.qty_available > 0;
    else if (quickFilter === "out_of_stock") matchesQuick = p.qty_available <= 0;
    else if (quickFilter === "hidden") matchesQuick = p.retailer_visibility === "hidden";
    else if (quickFilter === "historical") matchesQuick = p.trading_status === "historical";
    else if (quickFilter === "low_stock") matchesQuick = p.qty_available > 0 && p.qty_available <= 5;
    else if (quickFilter === "missing_wholesale") matchesQuick = p.warnings.includes("missing_wholesale");
    else if (quickFilter === "missing_retail") matchesQuick = p.warnings.includes("missing_retail");
    else if (quickFilter === "margin_warning") matchesQuick = p.warnings.includes("margin_warning");
    else if (quickFilter === "visible_not_orderable") matchesQuick = p.warnings.includes("visible_not_orderable");

    return (
      matchesSearch &&
      matchesCategory &&
      matchesCompany &&
      matchesBrand &&
      matchesTradingStatus &&
      matchesVisibility &&
      matchesQuick
    );
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortField) return 0;
    let valA: any = null;
    let valB: any = null;

    if (sortField === "name") {
      valA = a.display_name;
      valB = b.display_name;
      return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    if (sortField === "wholesale") {
      valA = a.wholesalePrice ?? -1;
      valB = b.wholesalePrice ?? -1;
    } else if (sortField === "retail") {
      valA = a.retailPrice ?? -1;
      valB = b.retailPrice ?? -1;
    } else if (sortField === "margin") {
      valA = a.retailerMarginPercent ?? -999;
      valB = b.retailerMarginPercent ?? -999;
    } else if (sortField === "on_hand") {
      valA = a.qty_on_hand;
      valB = b.qty_on_hand;
    } else if (sortField === "available") {
      valA = a.qty_available;
      valB = b.qty_available;
    }

    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const executeStatusUpdate = async (
    productId: string,
    newTradingStatus: "active" | "inactive" | "historical",
    newVisibility: "visible" | "hidden"
  ) => {
    setUpdatingId(productId);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const res = await updateTradingStatusAndVisibility(productId, {
          trading_status: newTradingStatus,
          retailer_visibility: newVisibility,
          reason: "Listing screen inline status change",
        });

        if (res.success && res.trading_status && res.retailer_visibility) {
          const updatedTrading = res.trading_status;
          const updatedVis = res.retailer_visibility;

          setProducts((prev) =>
            prev.map((p) => {
              if (p.id !== productId) return p;
              const updatedWarnings = [...p.warnings];
              
              // Recompute visible_not_orderable warning
              const visIndex = updatedWarnings.indexOf("visible_not_orderable");
              if (updatedVis === "visible" && (p.qty_available <= 0 || updatedTrading !== "active")) {
                if (visIndex === -1) updatedWarnings.push("visible_not_orderable");
              } else {
                if (visIndex !== -1) updatedWarnings.splice(visIndex, 1);
              }

              return {
                ...p,
                trading_status: updatedTrading,
                retailer_visibility: updatedVis,
                warnings: updatedWarnings,
              };
            })
          );

          if (res.notice) {
            setStatusMessage({ type: "info", text: res.notice });
          } else {
            setStatusMessage({ type: "success", text: "상태 및 노출 여부가 성공적으로 업데이트되었습니다." });
          }
        } else if (res.error) {
          setStatusMessage({ type: "error", text: res.error });
        }
      } catch (err: any) {
        setStatusMessage({ type: "error", text: err?.message || "상태 변경 중 오류가 발생했습니다." });
      } finally {
        setUpdatingId(null);
        setConfirmationModal(null);
      }
    });
  };

  const handleTradingStatusSelect = (product: TradingProductItem, newStatus: string) => {
    if (newStatus === "historical") {
      setConfirmationModal({
        open: true,
        product,
        newTradingStatus: "historical",
        newVisibility: "hidden",
      });
      return;
    }

    let targetVis = product.retailer_visibility as "visible" | "hidden";
    if (newStatus !== "active") {
      targetVis = "hidden";
    }

    executeStatusUpdate(product.id, newStatus as any, targetVis);
  };

  const handleVisibilitySelect = (product: TradingProductItem, newVis: string) => {
    if (product.trading_status !== "active" && newVis === "visible") {
      setStatusMessage({
        type: "error",
        text: "운영 중지 또는 운영 종료 상태인 제품은 Hub에 노출할 수 없습니다.",
      });
      return;
    }

    executeStatusUpdate(product.id, product.trading_status as any, newVis as any);
  };

  return (
    <div className="space-y-4">
      {/* Feedback Banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : statusMessage.type === "info"
              ? "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
              : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-bold underline opacity-70 hover:opacity-100 cursor-pointer ml-4"
          >
            닫기
          </button>
        </div>
      )}

      {/* 0. Summary Stat Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">전체 관리 대상</div>
          <div className="text-xl font-extrabold text-zinc-900 dark:text-white mt-1">
            {summaryStats.total} <span className="text-xs font-medium text-zinc-400">개 품목</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">관리자 노출 설정</div>
          <div className="text-base font-bold text-zinc-800 dark:text-zinc-200 mt-1 flex items-baseline gap-2">
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-lg">{summaryStats.adminVisible}</span>
            <span className="text-xs text-zinc-400">노출 / 비노출 {summaryStats.adminHidden}</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">실제 Hub 노출 현황</div>
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
              노출 {summaryStats.hubPublished}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300">
              보류 {summaryStats.hubOnHold}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400">
              비노출 {summaryStats.hubHidden}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">주문 가능 상태</div>
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
              주문 가능 {summaryStats.orderable}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400">
              품절 {summaryStats.outOfStock}
            </span>
            {summaryStats.notOrderable > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400">
                주문 불가 {summaryStats.notOrderable}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filters Panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        {/* Primary Row: Search & Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          {/* Search Input */}
          <div className="flex flex-col gap-1.5 col-span-1 sm:col-span-2 md:col-span-1">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">통합 검색</span>
            <input
              type="text"
              placeholder="제품명, SKU, UPC, 브랜드, 공급사..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-col gap-1.5 select-none">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">카테고리</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              <option value="all">전체 카테고리</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Company Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">공급사 (회사)</span>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              <option value="all">전체 공급사</option>
              {uniqueCompanies.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Brand Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">브랜드</span>
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              <option value="all">전체 브랜드</option>
              {uniqueBrands.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Trading Status Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">운영 상태</span>
            <select
              value={selectedTradingStatus}
              onChange={(e) => setSelectedTradingStatus(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              <option value="all">전체 운영 상태</option>
              {Object.entries(TRADING_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Visibility Status Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">노출 상태</span>
            <select
              value={selectedVisibility}
              onChange={(e) => setSelectedVisibility(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              <option value="all">전체 노출 상태</option>
              {Object.entries(VISIBILITY_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Operational Quick Filter Chips Bar */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60 space-y-2">
          <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">운영 퀵 필터 (Quick Filter)</div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {[
              { id: "all", label: `전체 (${summaryStats.total})` },
              { id: "hub_published", label: `Hub 노출 (${summaryStats.hubPublished})` },
              { id: "hub_on_hold", label: `⚠️ Hub 노출 보류 (${summaryStats.hubOnHold})` },
              { id: "hub_hidden", label: `Hub 비노출 (${summaryStats.hubHidden})` },
              { id: "in_stock", label: "가용재고 있음" },
              { id: "out_of_stock", label: "품절 (0 EA)" },
              { id: "low_stock", label: "재고 부족 (≤5)" },
              { id: "missing_wholesale", label: "⚠️ 도매가 미입력" },
              { id: "missing_retail", label: "⚠️ 소비자가 미입력" },
              { id: "margin_warning", label: "🚨 마진 경고 (<40%)" },
            ].map((chip) => {
              const isSelected = quickFilter === chip.id;
              const isProblemChip = chip.id.includes("missing") || chip.id.includes("warning") || chip.id.includes("hold");
              return (
                <button
                  key={chip.id}
                  type="button"
                  role="button"
                  aria-pressed={isSelected}
                  onClick={() => handleQuickFilterClick(chip.id)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer border flex items-center gap-1 ${
                    isSelected
                      ? isProblemChip
                        ? "bg-amber-600 text-white border-amber-600 dark:bg-amber-600 dark:border-amber-600 shadow-xs"
                        : "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white shadow-xs"
                      : isProblemChip
                      ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50"
                      : "bg-zinc-100 text-zinc-650 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  <span>{chip.label}</span>
                  {isSelected && chip.id !== "all" && <span className="text-[10px] opacity-80">✕</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results Info & Reset */}
        <div className="flex justify-between items-center text-[11px] text-zinc-450 dark:text-zinc-500 pt-1">
          <span>
            검색 결과: <strong className="text-zinc-900 dark:text-zinc-200 font-bold">{sortedProducts.length}</strong> 건 / 전체 {products.length} 건
          </span>
          {(searchTerm ||
            selectedCategory !== "all" ||
            selectedCompanyId !== "all" ||
            selectedBrandId !== "all" ||
            selectedTradingStatus !== "all" ||
            selectedVisibility !== "all" ||
            quickFilter !== "all" ||
            sortField !== null) && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
                setSelectedCompanyId("all");
                setSelectedBrandId("all");
                setSelectedTradingStatus("all");
                setSelectedVisibility("all");
                setQuickFilter("all");
                setSortField(null);
                setSortDirection("asc");
              }}
              className="text-zinc-900 hover:underline dark:text-zinc-200 font-semibold cursor-pointer"
            >
              필터 & 정렬 초기화
            </button>
          )}
        </div>
      </div>

      {/* Products Table (13 Columns) */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/70 text-zinc-600 font-bold dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300">
                <th className="px-4 py-3.5 whitespace-nowrap w-[60px]">사진</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Letusto SKU</th>
                <th className="px-4 py-3.5 whitespace-nowrap">제조사 SKU</th>
                <th
                  onClick={() => handleSort("name")}
                  className="px-4 py-3.5 whitespace-nowrap cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>제품명</span>
                    {sortField === "name" && (
                      <span className="text-[10px] font-bold text-zinc-900 dark:text-white">
                        {sortDirection === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </div>
                </th>
                {/* Brand Primary Column */}
                <th className="px-4 py-3.5 whitespace-nowrap">브랜드 / 회사</th>
                <th
                  onClick={() => handleSort("wholesale")}
                  className="px-4 py-3.5 whitespace-nowrap text-right cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Wholesale</span>
                    {sortField === "wholesale" && (
                      <span className="text-[10px] font-bold text-zinc-900 dark:text-white">
                        {sortDirection === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("retail")}
                  className="px-4 py-3.5 whitespace-nowrap text-right cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Retail Price</span>
                    {sortField === "retail" && (
                      <span className="text-[10px] font-bold text-zinc-900 dark:text-white">
                        {sortDirection === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("margin")}
                  className="px-4 py-3.5 whitespace-nowrap text-center cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Retailer Margin</span>
                    {sortField === "margin" && (
                      <span className="text-[10px] font-bold text-zinc-900 dark:text-white">
                        {sortDirection === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("on_hand")}
                  className="px-4 py-3.5 whitespace-nowrap text-right cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>실재고</span>
                    {sortField === "on_hand" && (
                      <span className="text-[10px] font-bold text-zinc-900 dark:text-white">
                        {sortDirection === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("available")}
                  className="px-4 py-3.5 whitespace-nowrap text-right cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>가용재고</span>
                    {sortField === "available" && (
                      <span className="text-[10px] font-bold text-zinc-900 dark:text-white">
                        {sortDirection === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3.5 whitespace-nowrap text-center">운영 상태</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-center">관리자 설정</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-center">실제 Hub 상태</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-center">주문 가능 상태</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
              {sortedProducts.map((product) => {
                const isUpdating = updatingId === product.id;

                return (
                  <tr
                    key={product.id}
                    className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-850/20 transition-colors ${
                      isUpdating ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    {/* 1. Photo */}
                    <td className="px-4 py-3 align-middle">
                      {product.photoUrl ? (
                        <div className="h-10 w-10 rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center p-0.5 shadow-xs overflow-hidden">
                          <img
                            src={product.photoUrl}
                            alt={product.display_name}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-zinc-100 flex items-center justify-center text-zinc-400 dark:bg-zinc-800 text-[9px] font-bold border border-dashed border-zinc-200 dark:border-zinc-700">
                          No Pic
                        </div>
                      )}
                    </td>

                    {/* 2. Letusto SKU */}
                    <td className="px-4 py-3 align-middle font-mono font-bold text-zinc-950 dark:text-white whitespace-nowrap">
                      {product.letusto_sku || (
                        <span className="text-zinc-400 dark:text-zinc-600 italic font-sans font-normal text-[11px]">
                          지정 대기 중
                        </span>
                      )}
                    </td>

                    {/* 3. Manufacture SKU */}
                    <td className="px-4 py-3 align-middle font-mono font-medium text-zinc-700 dark:text-zinc-350 whitespace-nowrap">
                      {product.display_manufacture_sku || product.manufacture_sku || (
                        <span className="text-zinc-400 dark:text-zinc-600 italic font-sans font-normal text-[11px]">
                          미입력
                        </span>
                      )}
                    </td>

                    {/* 4. Product Name */}
                    <td className="px-4 py-3 align-middle font-bold text-zinc-900 dark:text-white min-w-[220px]">
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/admin/products/trading/${product.id}`}
                          className="hover:text-zinc-950 dark:hover:text-white hover:underline transition-all block text-xs leading-snug"
                        >
                          {product.display_name}
                        </Link>
                        {product.category_full_path && (
                          <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 block">
                            {product.category_full_path}
                          </span>
                        )}
                        {/* Warning Indicators */}
                        {product.warnings.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {product.warnings.includes("visible_not_orderable") && (
                              <div className="flex flex-col gap-0.5 pt-0.5">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                    🚨 노출 중이나 주문 불가
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setOrderabilityModalProduct(product)}
                                    className="text-[10px] font-bold text-rose-700 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1"
                                  >
                                    <span>사유: {product.orderabilityPrimaryReason || "차단 조건 충족"}</span>
                                    {product.orderabilityReasons && product.orderabilityReasons.length > 1 ? (
                                      <span className="bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-200 px-1 rounded-full text-[9px]">
                                        외 {product.orderabilityReasons.length - 1}건
                                      </span>
                                    ) : (
                                      <span className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-1 rounded text-[9px] hover:bg-rose-200">
                                        해결 →
                                      </span>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                            {product.warnings.includes("missing_wholesale") && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                ⚠️ 도매가 미입력
                              </span>
                            )}
                            {product.warnings.includes("missing_retail") && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                ⚠️ 소비자가 미입력
                              </span>
                            )}
                            {product.warnings.includes("margin_warning") && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                🚨 마진 경고 (&lt;40%)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 5. Brand (Primary) / Company (Secondary) Stacked 2 lines */}
                    <td className="px-4 py-3 align-middle text-xs whitespace-nowrap max-w-[140px]">
                      <div className="flex flex-col">
                        {/* 1st Line: Brand (Bold, Primary) */}
                        <span className="font-bold text-zinc-900 dark:text-white truncate">
                          {product.brandName}
                        </span>
                        {/* 2nd Line: Company (Smaller, Muted Link) */}
                        <Link
                          href={`/admin/companies/${product.company_id}`}
                          className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:underline hover:text-zinc-800 dark:hover:text-zinc-200 truncate"
                        >
                          {product.companyName}
                        </Link>
                      </div>
                    </td>

                    {/* 6. Wholesale */}
                    <td className="px-4 py-3 align-middle text-right font-mono text-xs whitespace-nowrap">
                      {product.formattedWholesale !== "Price Missing" ? (
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-zinc-900 dark:text-white">
                            {product.formattedWholesale}
                          </span>
                          {product.hasActivePromo && (
                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                              PROMO
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-sans font-semibold text-[11px]">
                          Price Missing
                        </span>
                      )}
                    </td>

                    {/* 7. Retail Price */}
                    <td className="px-4 py-3 align-middle text-right font-mono text-xs whitespace-nowrap">
                      {product.formattedRetail !== "—" ? (
                        <span className="font-bold text-zinc-900 dark:text-white">
                          {product.formattedRetail}
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500 font-sans font-medium text-[11px]">
                          —
                        </span>
                      )}
                    </td>

                    {/* 8. Retailer Margin UI Cleanup: Number only if >=50%, Orange if 40-49.9%, Red if <40%, — if invalid */}
                    <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
                      {product.formattedMargin !== "—" ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-mono font-bold text-xs text-zinc-900 dark:text-white">
                            {product.formattedMargin}
                          </span>
                          {product.retailerMarginStatus === "caution" && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                              주의
                            </span>
                          )}
                          {product.retailerMarginStatus === "warning" && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
                              경고
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500 font-medium text-[11px]">
                          —
                        </span>
                      )}
                    </td>

                    {/* 9. Qty On Hand */}
                    <td className="px-4 py-3 align-middle text-right font-mono font-bold text-zinc-900 dark:text-white">
                      {product.qty_on_hand} EA
                    </td>

                    {/* 10. Qty Available */}
                    <td className="px-4 py-3 align-middle text-right font-mono text-xs whitespace-nowrap">
                      {product.qty_available > 0 ? (
                        product.qty_available <= 5 ? (
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {product.qty_available} EA <span className="text-[10px] font-sans font-normal">(부족)</span>
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {product.qty_available} EA
                          </span>
                        )
                      ) : product.qty_on_hand > 0 ? (
                        <span
                          className="font-bold text-amber-700 dark:text-amber-400"
                          title={`실재고 ${product.qty_on_hand} EA 중 보류/불량 ${product.qty_hold + product.qty_damaged} EA`}
                        >
                          0 EA <span className="text-[10px] font-sans font-normal">(가용 0 · 홀드)</span>
                        </span>
                      ) : (
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          0 EA <span className="text-[10px] font-sans font-normal">(품절)</span>
                        </span>
                      )}
                    </td>

                    {/* 11. Operational Status Inline Select */}
                    <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
                      <select
                        value={product.trading_status}
                        onChange={(e) => handleTradingStatusSelect(product, e.target.value)}
                        className={`rounded-lg px-2 py-1 text-[11px] font-bold border outline-none cursor-pointer ${
                          TRADING_COLORS[product.trading_status] || TRADING_COLORS.inactive
                        }`}
                      >
                        <option value="active">운영 중 (Active)</option>
                        <option value="inactive">운영 중지 (Inactive)</option>
                        <option value="historical">운영 종료 (Historical)</option>
                      </select>
                    </td>

                    {/* 12. Admin Visibility Setting Inline Select */}
                    <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
                      <select
                        value={product.retailer_visibility}
                        onChange={(e) => handleVisibilitySelect(product, e.target.value)}
                        disabled={product.trading_status !== "active"}
                        className={`rounded-lg px-2 py-1 text-[11px] font-bold border outline-none ${
                          product.trading_status !== "active"
                            ? "opacity-50 cursor-not-allowed bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-600 dark:border-zinc-700"
                            : VISIBILITY_COLORS[product.retailer_visibility] || VISIBILITY_COLORS.hidden
                        }`}
                      >
                        <option value="visible">노출 (Visible)</option>
                        <option value="hidden">비노출 (Hidden)</option>
                      </select>
                    </td>

                    {/* 13. Effective Hub Status Badge */}
                    <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
                      {product.effective_visibility === "PUBLISHED" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                          Hub 노출
                        </span>
                      ) : product.effective_visibility === "ON_HOLD" ? (
                        <button
                          type="button"
                          onClick={() => setHoldDetailModalProduct(product)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer shadow-2xs transition-colors"
                          title="노출 보류 사유 확인 및 원클릭 해결"
                        >
                          <span>⚠️ Hub 노출 보류</span>
                          <span className="text-[9px] bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 px-1 rounded-full">
                            {product.holdReasons?.length || 1}
                          </span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                          Hub 비노출
                        </span>
                      )}
                    </td>

                    {/* 14. Orderability Status Badge */}
                    <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
                      {product.isOrderable ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                          주문 가능
                        </span>
                      ) : product.is_sold_out && product.effective_visibility === "PUBLISHED" ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                          title={product.restock_eta ? `재입고 예정: ${product.restock_eta}` : "재입고 일정 미정"}
                        >
                          품절 (0 EA)
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setOrderabilityModalProduct(product)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900 hover:bg-rose-100 cursor-pointer"
                        >
                          <span>주문 불가</span>
                          <span className="text-[9px] underline">
                            {product.orderabilityPrimaryReason || "사유"}
                          </span>
                        </button>
                      )}
                    </td>

                    {/* 15. Action CTA */}
                    <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                      <Link
                        href={`/admin/products/trading/${product.id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                      >
                        상품 운영
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {sortedProducts.length === 0 && (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                    조건에 해당하는 거래 대상 제품이 존재하지 않습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Status Confirmation Modal */}
      {confirmationModal?.open && confirmationModal.product && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                운영 종료 (Historical) 상태 변경 확인
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                <strong className="text-zinc-900 dark:text-white">{confirmationModal.product.display_name}</strong> 제품을 &apos;운영 종료 (Historical)&apos; 상태로 변경하시겠습니까?
              </p>
              <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-bold">⚠️ 주의 사항:</p>
                <ul className="list-disc list-inside space-y-0.5 opacity-90">
                  <li>운영 종료 상태 제품은 Hub 노출이 즉시 &apos;비노출 (Hidden)&apos;로 강제 변경됩니다.</li>
                  <li>리테일 포털 등 외부 바이어에게 더 이상 노출되거나 주문될 수 없습니다.</li>
                </ul>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmationModal(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={() =>
                  executeStatusUpdate(
                    confirmationModal.product!.id,
                    confirmationModal.newTradingStatus,
                    confirmationModal.newVisibility
                  )
                }
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                운영 종료로 변경
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orderability Reasons Modal */}
      {orderabilityModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>🚨 주문 차단 사유 상세</span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
                  {orderabilityModalProduct.display_name} ({orderabilityModalProduct.letusto_sku || orderabilityModalProduct.display_manufacture_sku || "SKU 미지정"})
                </p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-semibold mt-0.5">
                  {orderabilityModalProduct.brandName} · {orderabilityModalProduct.companyName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOrderabilityModalProduct(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                해당 상품은 현재 Retailer Hub에 <strong>노출(Visible)</strong> 상태이나 아래 <strong>{(orderabilityModalProduct.orderabilityReasons?.length || 1)}개 차단 원인</strong>으로 인해 가맹점 주문이 불가능합니다:
              </p>

              {/* Reasons Cards */}
              <div className="space-y-3">
                {(orderabilityModalProduct.orderabilityReasons || ["주문 차단 조건 충족"]).map((reason, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 space-y-3">
                    <div className="flex items-center justify-between font-bold text-rose-800 dark:text-rose-300">
                      <span className="text-xs">{idx + 1}. {reason}</span>
                    </div>

                    {/* Reason Details */}
                    {reason === "등록 미완료" && (
                      <div className="space-y-2.5">
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">
                          필수 정보가 완성되지 않은 Draft 상태입니다. 아래 누락 항목을 수정한 후 승인 처리해야 최종 등록 완료됩니다:
                        </p>

                        {/* Grouped Missing Fields */}
                        {orderabilityModalProduct.missingFieldItems && orderabilityModalProduct.missingFieldItems.length > 0 ? (
                          <div className="space-y-2">
                            {Object.entries(
                              orderabilityModalProduct.missingFieldItems.reduce((acc, item) => {
                                const sec = item.section || "기타 정보";
                                if (!acc[sec]) acc[sec] = [];
                                acc[sec].push(item);
                                return acc;
                              }, {} as Record<string, MissingFieldItem[]>)
                            ).map(([section, items]) => (
                              <div key={section} className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/40 space-y-1.5 shadow-2xs">
                                <div className="font-bold text-[11px] text-rose-900 dark:text-rose-200 flex items-center justify-between">
                                  <span>{section} ({items.length}개 항목 누락)</span>
                                  {/* Action Button Per Section */}
                                  {section.includes("물류") && (
                                    <Link
                                      href={`/admin/products/trading/${orderabilityModalProduct.id}?tab=logistics&highlight=itemWidth-field`}
                                      onClick={() => setOrderabilityModalProduct(null)}
                                      className="px-2.5 py-1 rounded text-[10px] font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-2xs"
                                    >
                                      물류 정보 수정 →
                                    </Link>
                                  )}
                                  {section.includes("가격") && (
                                    <Link
                                      href={`/admin/products/trading/${orderabilityModalProduct.id}?tab=price&highlight=priceUsdFob-field`}
                                      onClick={() => setOrderabilityModalProduct(null)}
                                      className="px-2.5 py-1 rounded text-[10px] font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-2xs"
                                    >
                                      가격 정보 수정 →
                                    </Link>
                                  )}
                                  {section.includes("기본") && (
                                    <Link
                                      href={`/admin/products/trading/${orderabilityModalProduct.id}?tab=basic&highlight=brandId-field`}
                                      onClick={() => setOrderabilityModalProduct(null)}
                                      className="px-2.5 py-1 rounded text-[10px] font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-2xs"
                                    >
                                      기본 정보 수정 →
                                    </Link>
                                  )}
                                  {section.includes("카테고리") && (
                                    <Link
                                      href={`/admin/products/trading/${orderabilityModalProduct.id}?tab=category_attributes`}
                                      onClick={() => setOrderabilityModalProduct(null)}
                                      className="px-2.5 py-1 rounded text-[10px] font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-2xs"
                                    >
                                      카테고리 수정 →
                                    </Link>
                                  )}
                                  {section.includes("미디어") && (
                                    <Link
                                      href={`/admin/products/trading/${orderabilityModalProduct.id}?tab=media`}
                                      onClick={() => setOrderabilityModalProduct(null)}
                                      className="px-2.5 py-1 rounded text-[10px] font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-2xs"
                                    >
                                      미디어 등록 →
                                    </Link>
                                  )}
                                </div>
                                <ul className="text-[11px] text-zinc-700 dark:text-zinc-300 space-y-0.5 pl-1">
                                  {items.map((it) => (
                                    <li key={it.key} className="flex items-center gap-1.5">
                                      <span className="text-rose-500 font-bold">·</span>
                                      <span>{it.label}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        ) : orderabilityModalProduct.missingFields && orderabilityModalProduct.missingFields.length > 0 ? (
                          <p className="text-[11px] text-rose-700 dark:text-rose-400">
                            누락 필수 항목: <strong className="underline">{orderabilityModalProduct.missingFields.join(", ")}</strong>
                          </p>
                        ) : null}
                      </div>
                    )}

                    {reason === "판매 가능 재고 없음" && (
                      <div className="space-y-2">
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          {orderabilityModalProduct.qty_on_hand > 0 ? (
                            <span>
                              실재고(<strong>{orderabilityModalProduct.qty_on_hand} EA</strong>)가 등록되어 있으나, 보류/예약(<strong>{orderabilityModalProduct.qty_hold} EA</strong>) 및 불량(<strong>{orderabilityModalProduct.qty_damaged} EA</strong>) 차감으로 인해 실제 판매 가능 재고(Available Stock)가 <strong>0 EA</strong>입니다.
                            </span>
                          ) : (
                            <span>실재고 및 가용 재고가 모두 0 EA로 현재 완전 품절(Out of Stock) 상태입니다.</span>
                          )}
                        </p>
                        <Link
                          href={`/admin/products/trading/${orderabilityModalProduct.id}?tab=inventory&highlight=inventory-snapshot-card`}
                          onClick={() => setOrderabilityModalProduct(null)}
                          className="inline-block px-2.5 py-1 rounded text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-2xs"
                        >
                          재고 확인 →
                        </Link>
                      </div>
                    )}

                    {reason === "도매가 미입력" && (
                      <div className="space-y-2">
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          미국 수출 FOB 공급가(도매가)가 0달러이거나 미입력 상태입니다. 유효한 도매가를 입력해야 가맹점 카탈로그에서 주문할 수 있습니다.
                        </p>
                        <Link
                          href={`/admin/products/trading/${orderabilityModalProduct.id}?tab=price&highlight=pricing-snapshot-card`}
                          onClick={() => setOrderabilityModalProduct(null)}
                          className="inline-block px-2.5 py-1 rounded text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-2xs"
                        >
                          가격 설정 →
                        </Link>
                      </div>
                    )}

                    {reason === "Hub 비노출" && (
                      <div className="space-y-2">
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          Retailer Hub 노출 상태가 &apos;비노출&apos;로 설정되어 가맹점 카탈로그에 노출되지 않습니다. 목록 화면의 노출 상태 선택기에서 &apos;노출&apos;로 변경할 수 있습니다.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <Link
                href={`/admin/products/trading/${orderabilityModalProduct.id}`}
                onClick={() => setOrderabilityModalProduct(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 shadow-2xs"
              >
                상품 운영으로 이동 →
              </Link>
              <button
                type="button"
                onClick={() => setOrderabilityModalProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hold Detail Modal */}
      {holdDetailModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
                  <span>⚠️ Retailer Hub 노출 보류 사유</span>
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5 font-medium">
                  {holdDetailModalProduct.display_name} ({holdDetailModalProduct.letusto_sku || holdDetailModalProduct.display_manufacture_sku || "SKU 미지정"})
                </p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-semibold mt-0.5">
                  {holdDetailModalProduct.brandName} · {holdDetailModalProduct.companyName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHoldDetailModalProduct(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 space-y-1.5 leading-relaxed">
                <p className="font-bold text-xs flex items-center gap-1.5">
                  <span>ℹ️</span> 관리자 노출 설정은 &apos;노출 (Visible)&apos;이나, 아래 필수 상업 조건이 미충족되었습니다.
                </p>
                <p className="text-[11px] opacity-90">
                  해당 항목을 설정하시면 별도의 수동 전환 없이 Retailer Hub 카탈로그에 <strong>자동 즉시 노출 (Published)</strong>로 복구됩니다.
                </p>
              </div>

              {/* Reasons Breakdown */}
              <div className="space-y-3">
                {(holdDetailModalProduct.holdReasons && holdDetailModalProduct.holdReasons.length > 0
                  ? holdDetailModalProduct.holdReasons
                  : ["도매가 미입력"]
                ).map((reasonCode: string, idx: number) => {
                  let reasonTitle = "도매 공급가 미설정";
                  let reasonDesc = "미국 수출 FOB 공급가(도매가)가 0달러이거나 미입력 상태입니다. 유효한 도매가를 입력해야 리테일러 카탈로그에 노출됩니다.";
                  let actionUrl = `/admin/products/trading/${holdDetailModalProduct.id}?tab=price&highlight=pricing-snapshot-card`;
                  let actionText = "가격 설정 바로가기 →";

                  if (reasonCode === "missing_moq") {
                    reasonTitle = "최소 주문 수량 (MOQ) 미설정";
                    reasonDesc = "주문 최소 단위(MOQ)가 1개 이상으로 설정되지 않았습니다. 박스 입수량(Carton Pack Qty) 또는 최소 주문 수량을 설정해 주세요.";
                    actionUrl = `/admin/products/trading/${holdDetailModalProduct.id}?tab=price`;
                    actionText = "MOQ / 입수량 설정 →";
                  } else if (reasonCode === "missing_identification") {
                    reasonTitle = "기본 식별정보 미입력";
                    reasonDesc = "상품명, 브랜드, SKU 등 카탈로그 식별 필수 정보가 누락되어 있습니다.";
                    actionUrl = `/admin/products/trading/${holdDetailModalProduct.id}?tab=basic`;
                    actionText = "기본 정보 수정 →";
                  } else if (reasonCode === "not_active_trading") {
                    reasonTitle = "운영 상태 비활성";
                    reasonDesc = "상품의 운영 상태가 '운영 중(Active)'이 아닙니다.";
                    actionUrl = `/admin/products/trading/${holdDetailModalProduct.id}`;
                    actionText = "운영 상태 확인 →";
                  }

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between font-bold text-zinc-900 dark:text-zinc-100">
                        <span className="text-xs flex items-center gap-1.5">
                          <span className="text-amber-500 font-bold">#{idx + 1}</span>
                          <span>{reasonTitle}</span>
                        </span>
                        <Link
                          href={actionUrl}
                          onClick={() => setHoldDetailModalProduct(null)}
                          className="px-3 py-1 rounded-lg text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-2xs"
                        >
                          {actionText}
                        </Link>
                      </div>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {reasonDesc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <Link
                href={`/admin/products/trading/${holdDetailModalProduct.id}`}
                onClick={() => setHoldDetailModalProduct(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 shadow-2xs"
              >
                상품 운영 상세로 이동 →
              </Link>
              <button
                type="button"
                onClick={() => setHoldDetailModalProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
