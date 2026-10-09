"use client";

import React, { useState, useMemo, useTransition, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateTradingStatusAndVisibility } from "@/lib/product/trading-actions";
import {
  TRADING_STATUS_LABELS as TRADING_LABELS,
  RETAILER_VISIBILITY_LABELS as VISIBILITY_LABELS,
  TRADING_STATUS_STYLES,
  RETAILER_VISIBILITY_STYLES,
} from "@/lib/product/registration-status";

export interface TradingProductItem {
  id: string;
  name: string;
  display_name: string;
  manufacture_sku: string;
  display_manufacture_sku: string | null;
  letusto_sku: string | null;
  parent_sku?: string | null;
  child_sku?: string | null;
  upc: string | null;
  category: string;
  brand_id: string;
  company_id: string;
  companyName: string;
  brandName: string;
  photoUrl: string | null;
  selection_status: string;
  sales_status: string;
  trading_status: "active" | "inactive" | "historical";
  retailer_visibility: "visible" | "hidden";
  is_sold_out: boolean;
  moq: number;
  category_code: string | null;
  category_full_path: string | null;

  wholesalePrice: number | null;
  hasActivePromo: boolean;
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

  restock_eta?: string | null;
  warnings: string[];
}

interface TradingProductsListProps {
  initialProducts: TradingProductItem[];
}

type SortField = "name" | "wholesale" | "retail" | "margin" | "onhand" | "available";
type SortDirection = "asc" | "desc";

const TRADING_COLORS: Record<string, string> = {
  active: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  inactive: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  historical: "bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
};

const VISIBILITY_COLORS: Record<string, string> = {
  visible: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  hidden: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
};

export function TradingProductsList({ initialProducts }: TradingProductsListProps) {
  const router = useRouter();
  const [products, setProducts] = useState<TradingProductItem[]>(initialProducts);

  // Filter states
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
    const active = products.filter((p) => p.trading_status === "active").length;
    const inactive = products.filter((p) => p.trading_status === "inactive").length;
    const historical = products.filter((p) => p.trading_status === "historical").length;

    const visible = products.filter((p) => p.retailer_visibility === "visible").length;
    const hidden = products.filter((p) => p.retailer_visibility === "hidden").length;

    const inStock = products.filter((p) => p.qty_available > 0).length;
    const outOfStock = products.filter((p) => p.qty_available <= 0).length;

    return {
      total,
      active,
      inactive,
      historical,
      visible,
      hidden,
      inStock,
      outOfStock,
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
    if (quickFilter === "active") matchesQuick = p.trading_status === "active";
    else if (quickFilter === "inactive") matchesQuick = p.trading_status === "inactive";
    else if (quickFilter === "historical") matchesQuick = p.trading_status === "historical";
    else if (quickFilter === "visible") matchesQuick = p.retailer_visibility === "visible";
    else if (quickFilter === "hidden") matchesQuick = p.retailer_visibility === "hidden";
    else if (quickFilter === "in_stock") matchesQuick = p.qty_available > 0;
    else if (quickFilter === "out_of_stock") matchesQuick = p.qty_available <= 0;
    else if (quickFilter === "missing_wholesale") matchesQuick = !p.wholesalePrice || p.wholesalePrice <= 0;
    else if (quickFilter === "missing_retail") matchesQuick = !p.retailPrice || p.retailPrice <= 0;
    else if (quickFilter === "missing_moq") matchesQuick = p.moq <= 0;
    else if (quickFilter === "margin_warning") matchesQuick = p.retailerMarginStatus === "warning";

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
      valA = a.retailerMarginPercent ?? -1;
      valB = b.retailerMarginPercent ?? -1;
    } else if (sortField === "onhand") {
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
          reason: "Listing screen status update",
        });

        if (res.success && res.trading_status && res.retailer_visibility) {
          const updatedTrading = res.trading_status;
          const updatedVis = res.retailer_visibility;

          setProducts((prev) =>
            prev.map((p) => {
              if (p.id !== productId) return p;
              return {
                ...p,
                trading_status: updatedTrading,
                retailer_visibility: updatedVis,
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
        text: "운영 중지 또는 운영 종료 상태인 제품은 Hub에 노출할 수 없습니다. (운영 중 상태 필요)",
      });
      return;
    }

    if (newVis === "visible") {
      const missingReasons: string[] = [];
      if (!product.wholesalePrice || product.wholesalePrice <= 0) {
        missingReasons.push("Wholesale Price를 먼저 설정하세요.");
      }
      if (!product.retailPrice || product.retailPrice <= 0) {
        missingReasons.push("Retail Price를 먼저 설정하세요.");
      }
      if (!product.moq || product.moq <= 0) {
        missingReasons.push("Retailer MOQ를 먼저 설정하세요.");
      }

      if (missingReasons.length > 0) {
        setStatusMessage({
          type: "error",
          text: missingReasons.join(" "),
        });
        return;
      }
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

      {/* 0. Summary Stat Metrics Bar (4 Authoritative Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">전체 관리 대상</div>
          <div className="text-xl font-extrabold text-zinc-900 dark:text-white mt-1">
            {summaryStats.total} <span className="text-xs font-medium text-zinc-400">개 품목</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">운영 상태 현황</div>
          <div className="text-base font-bold text-zinc-800 dark:text-zinc-200 mt-1 flex items-baseline gap-2">
            <span className="text-blue-600 dark:text-blue-400 font-extrabold text-lg">{summaryStats.active}</span>
            <span className="text-xs text-zinc-400">운영 중 / 중지 {summaryStats.inactive} · 종료 {summaryStats.historical}</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">노출 상태 현황</div>
          <div className="text-base font-bold text-zinc-800 dark:text-zinc-200 mt-1 flex items-baseline gap-2">
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-lg">{summaryStats.visible}</span>
            <span className="text-xs text-zinc-400">노출 / 비노출 {summaryStats.hidden}</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">가용 재고 현황</div>
          <div className="text-base font-bold text-zinc-800 dark:text-zinc-200 mt-1 flex items-baseline gap-2">
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-lg">{summaryStats.inStock}</span>
            <span className="text-xs text-zinc-400">보유 중 / 품절 {summaryStats.outOfStock}</span>
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
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Company Filter */}
          <div className="flex flex-col gap-1.5 select-none">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">공급사 (Company)</span>
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
          <div className="flex flex-col gap-1.5 select-none">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">브랜드 (Brand)</span>
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
          <div className="flex flex-col gap-1.5 select-none">
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
          <div className="flex flex-col gap-1.5 select-none">
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
              { id: "active", label: `운영 중 (${summaryStats.active})` },
              { id: "inactive", label: `운영 중지 (${summaryStats.inactive})` },
              { id: "historical", label: `운영 종료 (${summaryStats.historical})` },
              { id: "visible", label: `노출 (${summaryStats.visible})` },
              { id: "hidden", label: `비노출 (${summaryStats.hidden})` },
              { id: "in_stock", label: `가용재고 있음 (${summaryStats.inStock})` },
              { id: "out_of_stock", label: `품절 (${summaryStats.outOfStock})` },
              { id: "missing_wholesale", label: "⚠️ 도매가 미입력" },
              { id: "missing_retail", label: "⚠️ 소비자가 미입력" },
              { id: "missing_moq", label: "⚠️ MOQ 미입력" },
              { id: "margin_warning", label: "🚨 마진 경고 (<40%)" },
            ].map((chip) => {
              const isSelected = quickFilter === chip.id;
              const isProblemChip = chip.id.includes("missing") || chip.id.includes("warning");
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

      {/* Products Table (Cleaned 12 Columns - Removed Middle Effective Visibility & Orderability Columns) */}
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
                    <span>Margin %</span>
                    {sortField === "margin" && (
                      <span className="text-[10px] font-bold text-zinc-900 dark:text-white">
                        {sortDirection === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("onhand")}
                  className="px-4 py-3.5 whitespace-nowrap text-right cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>OnHand</span>
                    {sortField === "onhand" && (
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
                    <span>Available</span>
                    {sortField === "available" && (
                      <span className="text-[10px] font-bold text-zinc-900 dark:text-white">
                        {sortDirection === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3.5 whitespace-nowrap text-center">운영 상태</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-center">노출 상태</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sortedProducts.map((product) => {
                const isUpdating = updatingId === product.id;
                return (
                  <tr
                    key={product.id}
                    className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors ${
                      isUpdating ? "opacity-60 pointer-events-none" : ""
                    }`}
                  >
                    {/* 1. Photo */}
                    <td className="px-4 py-3 align-middle">
                      <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 shrink-0">
                        {product.photoUrl ? (
                          <Image
                            src={product.photoUrl}
                            alt={product.display_name}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-zinc-400">
                            No Pic
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 2. Letusto SKU */}
                    <td className="px-4 py-3 align-middle font-mono font-bold text-xs whitespace-nowrap text-zinc-900 dark:text-white">
                      {product.letusto_sku || "—"}
                    </td>

                    {/* 3. Mfg SKU */}
                    <td className="px-4 py-3 align-middle font-mono text-xs whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                      {product.display_manufacture_sku || product.manufacture_sku || "—"}
                    </td>

                    {/* 4. Product Name */}
                    <td className="px-4 py-3 align-middle">
                      <Link
                        href={`/admin/products/trading/${product.id}`}
                        className="font-bold text-zinc-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-1"
                      >
                        {product.display_name}
                      </Link>
                      <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium line-clamp-1 mt-0.5">
                        {product.name}
                      </div>
                    </td>

                    {/* 5. Brand & Company */}
                    <td className="px-4 py-3 align-middle whitespace-nowrap">
                      <div className="font-bold text-zinc-900 dark:text-white text-xs">
                        {product.brandName}
                      </div>
                      <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
                        {product.companyName}
                      </div>
                    </td>

                    {/* 6. Wholesale Price */}
                    <td className="px-4 py-3 align-middle text-right font-mono text-xs whitespace-nowrap">
                      {product.formattedWholesale !== "—" ? (
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            {product.formattedWholesale}
                          </span>
                          {product.hasActivePromo && (
                            <span className="text-[10px] font-sans font-bold text-rose-500">🔥 Promo</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500 font-sans font-medium text-[11px]">
                          —
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

                    {/* 8. Retailer Margin */}
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

                    {/* 10. Qty Available (Out of Stock indicator) */}
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

                    {/* 13. Action CTA */}
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
                  <td colSpan={13} className="py-12 text-center text-zinc-400 dark:text-zinc-500 text-xs">
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
    </div>
  );
}
