"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { updateTradingStatusAndVisibility } from "@/lib/product/trading-actions";

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
  qty_on_hand: number;
  qty_hold: number;
  qty_damaged: number;
  qty_available: number;
  warnings: string[];
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

const MARGIN_STATUS_COLORS: Record<string, string> = {
  normal: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
  caution: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  warning: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800",
  none: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
};

const MARGIN_STATUS_LABELS: Record<string, string> = {
  normal: "정상",
  caution: "주의",
  warning: "경고",
  none: "미산정",
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
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [, startTransition] = useTransition();

  // Confirmation Modal state
  const [confirmationModal, setConfirmationModal] = useState<{
    open: boolean;
    product: TradingProductItem | null;
    newTradingStatus: "active" | "inactive" | "historical";
    newVisibility: "visible" | "hidden";
  } | null>(null);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

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
    if (quickFilter === "in_stock") matchesQuick = p.qty_available > 0;
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

        if (res.success) {
          setProducts((prev) =>
            prev.map((p) => {
              if (p.id !== productId) return p;
              const updatedTrading = res.trading_status;
              const updatedVis = res.retailer_visibility;
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
          setStatusMessage({ type: "success", text: "상태 및 노출 여부가 업데이트되었습니다." });
        }
      } catch (err: any) {
        setStatusMessage({ type: "error", text: err.message || "상태 변경 중 오류가 발생했습니다." });
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
      alert("운영 중지 또는 운영 종료 상태인 제품은 Hub에 노출할 수 없습니다. 먼저 운영 상태를 '운영 중'으로 변경해 주세요.");
      return;
    }

    executeStatusUpdate(product.id, product.trading_status as any, newVis as any);
  };

  const formatPrice = (val: number | null) => {
    if (val === null || val === undefined) return null;
    return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification Banner */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
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
              { id: "all", label: "전체" },
              { id: "in_stock", label: "입고/재고 있음" },
              { id: "out_of_stock", label: "품절 (OOS)" },
              { id: "hidden", label: "비노출" },
              { id: "historical", label: "운영 종료" },
              { id: "low_stock", label: "재고 부족 (≤5)" },
              { id: "missing_wholesale", label: "⚠️ 도매가 미입력" },
              { id: "missing_retail", label: "⚠️ 소비자가 미입력" },
              { id: "margin_warning", label: "🚨 마진 경고 (<40%)" },
              { id: "visible_not_orderable", label: "🚨 노출 중이나 주문 불가" },
            ].map((chip) => {
              const isSelected = quickFilter === chip.id;
              const isProblemChip = chip.id.includes("missing") || chip.id.includes("warning") || chip.id.includes("visible");
              return (
                <button
                  key={chip.id}
                  onClick={() => setQuickFilter(chip.id)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer border ${
                    isSelected
                      ? isProblemChip
                        ? "bg-rose-600 text-white border-rose-600 dark:bg-rose-600 dark:border-rose-600 shadow-xs"
                        : "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white shadow-xs"
                      : isProblemChip
                      ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50"
                      : "bg-zinc-100 text-zinc-650 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  {chip.label}
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
                <th className="px-4 py-3.5 whitespace-nowrap">회사 / 브랜드</th>
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
                <th className="px-4 py-3.5 whitespace-nowrap text-center">노출 상태</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
              {sortedProducts.map((product) => {
                const isUpdating = updatingId === product.id;
                const formattedWholesale = formatPrice(product.wholesalePrice);
                const formattedRetail = formatPrice(product.retailPrice);

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
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                🚨 노출 중이나 주문 불가
                              </span>
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

                    {/* 5. Company / Brand Stacked 2 lines */}
                    <td className="px-4 py-3 align-middle text-xs whitespace-nowrap max-w-[140px]">
                      <div className="flex flex-col">
                        <Link
                          href={`/admin/companies/${product.company_id}`}
                          className="font-semibold text-zinc-800 dark:text-zinc-200 hover:underline hover:text-zinc-950 dark:hover:text-white truncate"
                        >
                          {product.companyName}
                        </Link>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                          {product.brandName}
                        </span>
                      </div>
                    </td>

                    {/* 6. Wholesale */}
                    <td className="px-4 py-3 align-middle text-right font-mono text-xs whitespace-nowrap">
                      {formattedWholesale ? (
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-zinc-900 dark:text-white">
                            {formattedWholesale}
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
                      {formattedRetail ? (
                        <span className="font-bold text-zinc-900 dark:text-white">
                          {formattedRetail}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-sans font-semibold text-[11px]">
                          Price Missing
                        </span>
                      )}
                    </td>

                    {/* 8. Retailer Margin */}
                    <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
                      {product.retailerMarginPercent !== null ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-mono font-bold text-xs text-zinc-900 dark:text-white">
                            {product.retailerMarginPercent.toFixed(1)}%
                          </span>
                          <span
                            className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                              MARGIN_STATUS_COLORS[product.retailerMarginStatus] || MARGIN_STATUS_COLORS.none
                            }`}
                          >
                            {MARGIN_STATUS_LABELS[product.retailerMarginStatus]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600 text-[11px]">
                          미산정
                        </span>
                      )}
                    </td>

                    {/* 9. Qty On Hand */}
                    <td className="px-4 py-3 align-middle text-right font-mono font-bold text-zinc-900 dark:text-white">
                      {product.qty_on_hand}
                    </td>

                    {/* 10. Qty Available */}
                    <td className="px-4 py-3 align-middle text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {product.qty_available}
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

                    {/* 12. Visibility Status Inline Select */}
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
