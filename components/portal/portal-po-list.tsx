"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  OVERALL_STATUS_LABELS,
  OVERALL_STATUS_COLORS,
} from "@/lib/purchase-order/status-helper";
import { formatEasternDateTime } from "@/lib/utils/timezone";

export interface PortalPoItem {
  id: string;
  po_number: string;
  po_status: string;
  fulfillment_status?: string | null;
  supplier_confirmation_status: string;
  order_date: string;
  currency?: string | null;
  revision_no: number;
  cancellation_status?: string | null;
  created_at: string;
  updated_at?: string | null;
  confirmed_at?: string | null;
  lines: any[];
  shipments: any[];
  receivings: any[];
  total_amount: number;
  total_ordered: number;
  total_confirmed: number | null;
  primary_product_name: string;
  primary_sku: string;
  extra_item_count: number;
  search_keywords: string;
  last_status_update: string;
  elapsed_days: number;
  is_finished: boolean;
  overall_status: string;
}

interface PortalPoListProps {
  pos: PortalPoItem[];
}

// Operational active default categories (EXCLUDE Completed & Cancelled by default)
const DEFAULT_ACTIVE_CATEGORIES = [
  "IN_PRODUCTION",
  "READY_TO_SHIP",
  "SHIPPED",
  "RECEIVING",
];

const ALL_CATEGORIES = [
  "IN_PRODUCTION",
  "READY_TO_SHIP",
  "SHIPPED",
  "RECEIVING",
  "COMPLETED",
  "CANCELLED",
];

export function PortalPoList({ pos = [] }: PortalPoListProps) {
  const safePos = Array.isArray(pos) ? pos : [];

  // Initial 90 days date range helper
  const initialRange = useMemo(() => {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 90);
    const formatYMD = (d: Date) => d.toISOString().split("T")[0];
    return {
      from: formatYMD(start),
      to: formatYMD(today),
    };
  }, []);

  const [selectedCategories, setSelectedCategories] = useState<string[]>(DEFAULT_ACTIVE_CATEGORIES);
  const [fromDate, setFromDate] = useState<string>(initialRange.from);
  const [toDate, setToDate] = useState<string>(initialRange.to);
  const [activePreset, setActivePreset] = useState<string>("last_90");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("newest");

  // Global KPI Summary Metrics across supplier's POs
  const metrics = useMemo(() => {
    let totalOpen = 0;
    let inProduction = 0;
    let readyToShip = 0;
    let receiving = 0;
    let completed = 0;

    safePos.forEach((po) => {
      const status = po?.overall_status || "";
      if (status === "Completed") {
        completed++;
      } else if (status !== "Cancelled") {
        totalOpen++;
        if (
          status === "Sent to Supplier" ||
          status === "Supplier Confirmed" ||
          status === "In Production" ||
          status === "Change Requested"
        ) {
          inProduction++;
        } else if (status === "Ready to Ship") {
          readyToShip++;
        } else if (
          status === "Shipped" ||
          status === "Arrived" ||
          status === "Receiving"
        ) {
          receiving++;
        }
      }
    });

    return { totalOpen, inProduction, readyToShip, receiving, completed };
  }, [safePos]);

  // Status mapping helper: maps overall_status to category key
  const getStatusCategory = (overallStatus: string): string => {
    switch (overallStatus) {
      case "Sent to Supplier":
      case "Supplier Confirmed":
      case "In Production":
      case "Change Requested":
        return "IN_PRODUCTION";
      case "Ready to Ship":
        return "READY_TO_SHIP";
      case "Shipped":
      case "Arrived":
        return "SHIPPED";
      case "Receiving":
        return "RECEIVING";
      case "Completed":
        return "COMPLETED";
      case "Cancelled":
        return "CANCELLED";
      default:
        return "IN_PRODUCTION";
    }
  };

  // Status Chip Toggle Handler
  const handleStatusChipClick = (catKey: string) => {
    if (catKey === "ALL") {
      setSelectedCategories(ALL_CATEGORIES);
      return;
    }

    const isAllCurrentlySelected = selectedCategories.length === ALL_CATEGORIES.length;

    if (isAllCurrentlySelected) {
      // If currently all selected, clicking a chip isolates that category
      setSelectedCategories([catKey]);
    } else {
      // Toggle category in array
      if (selectedCategories.includes(catKey)) {
        const next = selectedCategories.filter((c) => c !== catKey);
        // Fallback to active defaults if everything is deselected
        setSelectedCategories(next.length === 0 ? DEFAULT_ACTIVE_CATEGORIES : next);
      } else {
        setSelectedCategories([...selectedCategories, catKey]);
      }
    }
  };

  // Date Preset Helpers
  const setPreset = (preset: "this_month" | "last_30" | "last_60" | "last_90" | "all") => {
    setActivePreset(preset);
    const today = new Date();
    const formatYMD = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "all") {
      setFromDate("");
      setToDate("");
      return;
    }

    if (preset === "this_month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(formatYMD(firstDay));
      setToDate(formatYMD(today));
    } else if (preset === "last_30") {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      setFromDate(formatYMD(start));
      setToDate(formatYMD(today));
    } else if (preset === "last_60") {
      const start = new Date();
      start.setDate(today.getDate() - 60);
      setFromDate(formatYMD(start));
      setToDate(formatYMD(today));
    } else if (preset === "last_90") {
      const start = new Date();
      start.setDate(today.getDate() - 90);
      setFromDate(formatYMD(start));
      setToDate(formatYMD(today));
    }
  };

  // Reset Filters to Operational Active Defaults
  const handleReset = () => {
    setSelectedCategories(DEFAULT_ACTIVE_CATEGORIES);
    setFromDate(initialRange.from);
    setToDate(initialRange.to);
    setActivePreset("last_90");
    setSearchTerm("");
    setSortBy("newest");
  };

  // Filter & Sort Logic
  const filteredAndSortedPos = useMemo(() => {
    const isAllSelected = selectedCategories.length === ALL_CATEGORIES.length;

    let result = safePos.filter((po) => {
      if (!po) return false;

      // 1. Status Filter
      if (!isAllSelected) {
        const cat = getStatusCategory(po.overall_status || "");
        if (!selectedCategories.includes(cat)) {
          return false;
        }
      }

      // 2. Search Keyword Filter
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const keywords = po.search_keywords || "";
        if (!keywords.includes(term)) {
          return false;
        }
      }

      // 3. Date Range Filter (based on order_date or created_at)
      const rawDateStr = po.order_date || po.created_at || "";
      const orderDateStr = rawDateStr.split("T")[0];
      if (fromDate && orderDateStr < fromDate) return false;
      if (toDate && orderDateStr > toDate) return false;

      return true;
    });

    // Sort
    result.sort((a, b) => {
      const getTimestamp = (val: any) => {
        if (!val) return 0;
        const t = new Date(val).getTime();
        return isNaN(t) ? 0 : t;
      };

      if (sortBy === "oldest") {
        return getTimestamp(a.order_date || a.created_at) - getTimestamp(b.order_date || b.created_at);
      }
      if (sortBy === "amount_desc") {
        return (Number(b.total_amount) || 0) - (Number(a.total_amount) || 0);
      }
      if (sortBy === "aging_desc") {
        return (Number(b.elapsed_days) || 0) - (Number(a.elapsed_days) || 0);
      }
      if (sortBy === "updated_desc") {
        return getTimestamp(b.last_status_update) - getTimestamp(a.last_status_update);
      }
      // default: newest
      return getTimestamp(b.order_date || b.created_at) - getTimestamp(a.order_date || a.created_at);
    });

    return result;
  }, [safePos, selectedCategories, searchTerm, fromDate, toDate, sortBy]);

  // Formatting Helpers
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const formatCurrency = (amount: number | null | undefined, currencyCode: string = "USD") => {
    if (amount === null || amount === undefined || isNaN(amount)) return "—";
    const symbol = currencyCode === "KRW" ? "₩" : "$";
    return `${symbol}${amount.toLocaleString(undefined, {
      minimumFractionDigits: currencyCode === "KRW" ? 0 : 2,
      maximumFractionDigits: currencyCode === "KRW" ? 0 : 2,
    })}`;
  };

  const getOverallStatusBadge = (overallStatus: string) => {
    const fullLabel = OVERALL_STATUS_LABELS[overallStatus] || overallStatus || "기타";
    const colorClasses =
      OVERALL_STATUS_COLORS[overallStatus] ||
      "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";

    const match = fullLabel.match(/^([^(]+)(?:\(([^)]+)\))?/);
    const koText = match ? match[1].trim() : fullLabel;
    const enText = match && match[2] ? match[2].trim() : "";

    return (
      <span
        className={`inline-flex flex-col items-start rounded-md px-2.5 py-1 text-xs font-semibold border ${colorClasses} leading-tight`}
      >
        <span>{koText}</span>
        {enText && <span className="text-[10px] font-normal opacity-80">{enText}</span>}
      </span>
    );
  };

  const getConfirmationBadge = (status: string) => {
    switch (status) {
      case "PENDING":
      case "UNCONFIRMED":
        return (
          <span className="inline-flex flex-col items-start rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-650/10 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800 leading-tight">
            <span>확인 대기</span>
            <span className="text-[10px] font-normal opacity-75">Pending</span>
          </span>
        );
      case "CHANGE_REQUESTED":
        return (
          <span className="inline-flex flex-col items-start rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10 dark:bg-indigo-950/60 dark:text-indigo-300 dark:ring-indigo-800 leading-tight">
            <span>변경 제안됨</span>
            <span className="text-[10px] font-normal opacity-75">Change Proposed</span>
          </span>
        );
      case "CONFIRMED":
        return (
          <span className="inline-flex flex-col items-start rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800 leading-tight">
            <span>수락/확인 완료</span>
            <span className="text-[10px] font-normal opacity-75">Confirmed</span>
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex flex-col items-start rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-800 leading-tight">
            <span>거절됨</span>
            <span className="text-[10px] font-normal opacity-75">Rejected</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {status}
          </span>
        );
    }
  };

  const getAgingBadge = (po: PortalPoItem) => {
    const days = po.elapsed_days;
    if (po.is_finished) {
      if (po.overall_status === "Completed") {
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
            <span>✓</span> {days}일 만에 완료
          </span>
        );
      }
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
          {days}일 후 취소
        </span>
      );
    }

    // Active PO aging badges
    if (days <= 14) {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
          {days}일 경과
        </span>
      );
    }
    if (days <= 30) {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
          {days}일 경과
        </span>
      );
    }
    if (days <= 44) {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
          {days}일 경과
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800">
        ⚠️ {days}일 경과
      </span>
    );
  };

  const isAllCategoriesSelected = selectedCategories.length === ALL_CATEGORIES.length;

  return (
    <div className="w-full space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
            발주 관리 (Purchase Orders)
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Letusto에서 발행한 발주서(PO) 현황입니다. 기본적으로 최근 90일 이내 진행 중인 4대 운영 상태 발주건이 표시됩니다.
          </p>
        </div>
      </div>

      {/* 1. KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => setSelectedCategories(DEFAULT_ACTIVE_CATEGORIES)}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            selectedCategories.length === DEFAULT_ACTIVE_CATEGORIES.length &&
            DEFAULT_ACTIVE_CATEGORIES.every((c) => selectedCategories.includes(c))
              ? "bg-zinc-900 text-white border-zinc-900 shadow-md dark:bg-white dark:text-zinc-950 dark:border-white"
              : "bg-white text-zinc-900 border-zinc-200 hover:border-zinc-300 dark:bg-zinc-900 dark:text-white dark:border-zinc-800"
          }`}
        >
          <div className="text-xs font-medium opacity-80">전체 진행중 PO</div>
          <div className="text-2xl font-bold mt-1">{metrics.totalOpen}</div>
          <div className="text-[11px] mt-1 opacity-70">미완료/미취소 발주건</div>
        </div>

        <div
          onClick={() => setSelectedCategories(["IN_PRODUCTION"])}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            selectedCategories.length === 1 && selectedCategories.includes("IN_PRODUCTION")
              ? "bg-amber-600 text-white border-amber-600 shadow-md dark:bg-amber-500"
              : "bg-white text-zinc-900 border-zinc-200 hover:border-amber-300 dark:bg-zinc-900 dark:text-white dark:border-zinc-800"
          }`}
        >
          <div className="text-xs font-medium text-amber-700 dark:text-amber-400 opacity-90 group-hover:text-amber-800">
            생산 / 접수 중
          </div>
          <div className="text-2xl font-bold mt-1 text-amber-900 dark:text-amber-300">
            {metrics.inProduction}
          </div>
          <div className="text-[11px] mt-1 text-amber-600 dark:text-amber-400 opacity-80">
            수락 및 생산 진행 단계
          </div>
        </div>

        <div
          onClick={() => setSelectedCategories(["READY_TO_SHIP"])}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            selectedCategories.length === 1 && selectedCategories.includes("READY_TO_SHIP")
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md dark:bg-emerald-500"
              : "bg-white text-zinc-900 border-zinc-200 hover:border-emerald-300 dark:bg-zinc-900 dark:text-white dark:border-zinc-800"
          }`}
        >
          <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 opacity-90">
            선적 준비 완료
          </div>
          <div className="text-2xl font-bold mt-1 text-emerald-900 dark:text-emerald-300">
            {metrics.readyToShip}
          </div>
          <div className="text-[11px] mt-1 text-emerald-600 dark:text-emerald-400 opacity-80">
            출고 / 선적 대기중
          </div>
        </div>

        <div
          onClick={() => setSelectedCategories(["RECEIVING"])}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            selectedCategories.length === 1 && selectedCategories.includes("RECEIVING")
              ? "bg-purple-600 text-white border-purple-600 shadow-md dark:bg-purple-500"
              : "bg-white text-zinc-900 border-zinc-200 hover:border-purple-300 dark:bg-zinc-900 dark:text-white dark:border-zinc-800"
          }`}
        >
          <div className="text-xs font-medium text-purple-700 dark:text-purple-400 opacity-90">
            입고 / 검수 진행
          </div>
          <div className="text-2xl font-bold mt-1 text-purple-900 dark:text-purple-300">
            {metrics.receiving}
          </div>
          <div className="text-[11px] mt-1 text-purple-600 dark:text-purple-400 opacity-80">
            운송 및 실물 입고 단계
          </div>
        </div>

        <div
          onClick={() => {
            setSelectedCategories(["COMPLETED"]);
            setFromDate("");
            setToDate("");
            setActivePreset("all");
          }}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            selectedCategories.length === 1 && selectedCategories.includes("COMPLETED")
              ? "bg-zinc-800 text-white border-zinc-800 shadow-md dark:bg-zinc-200 dark:text-zinc-900"
              : "bg-white text-zinc-900 border-zinc-200 hover:border-zinc-300 dark:bg-zinc-900 dark:text-white dark:border-zinc-800"
          }`}
        >
          <div className="text-xs font-medium opacity-80">입고 종결 (Completed)</div>
          <div className="text-2xl font-bold mt-1">{metrics.completed}</div>
          <div className="text-[11px] mt-1 opacity-70">전체 완료건 조회</div>
        </div>
      </div>

      {/* 2. Controls Area: Search, Filters & Sorting */}
      <div className="p-4 rounded-xl border border-zinc-200 bg-white shadow-sm space-y-4 dark:border-zinc-800 dark:bg-zinc-950">
        {/* Row 1: Search Bar & Sort */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="PO 번호, 상품명, Letusto SKU, 제조사 SKU 검색..."
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 focus:bg-white focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-600"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
              정렬:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            >
              <option value="newest">최신 발주순 (Newest)</option>
              <option value="oldest">오래된 발주순 (Oldest)</option>
              <option value="amount_desc">높은 금액순 (Highest Amount)</option>
              <option value="aging_desc">경과일 긴순 (Longest Aging)</option>
              <option value="updated_desc">최근 상태 변경순 (Latest Update)</option>
            </select>
          </div>
        </div>

        {/* Row 2: Status Filter Chips & Date Range Pickers */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-900">
          {/* Status Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mr-1">
              상태:
            </span>
            <button
              onClick={() => handleStatusChipClick("ALL")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                isAllCategoriesSelected
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              전체 (All)
            </button>

            {[
              { id: "IN_PRODUCTION", label: "생산/접수중" },
              { id: "READY_TO_SHIP", label: "선적대기" },
              { id: "SHIPPED", label: "배송중" },
              { id: "RECEIVING", label: "입고검수" },
              { id: "COMPLETED", label: "완료" },
              { id: "CANCELLED", label: "취소" },
            ].map((chip) => {
              const isSelected = selectedCategories.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  onClick={() => handleStatusChipClick(chip.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 opacity-70"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* Date Filter & Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              조회 기간:
            </span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setActivePreset("custom");
              }}
              className="px-2.5 py-1 rounded-md border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
            <span className="text-xs text-zinc-400">~</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setActivePreset("custom");
              }}
              className="px-2.5 py-1 rounded-md border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />

            {/* Quick Presets */}
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={() => setPreset("this_month")}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                  activePreset === "this_month"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                당월
              </button>
              <button
                onClick={() => setPreset("last_30")}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                  activePreset === "last_30"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                30일
              </button>
              <button
                onClick={() => setPreset("last_60")}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                  activePreset === "last_60"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                60일
              </button>
              <button
                onClick={() => setPreset("last_90")}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                  activePreset === "last_90"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                90일
              </button>
              <button
                onClick={() => setPreset("all")}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                  activePreset === "all"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                전체
              </button>
            </div>

            <button
              onClick={handleReset}
              className="ml-2 text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400"
            >
              초기화
            </button>
          </div>
        </div>
      </div>

      {/* 3. Table Section */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
        <div className="px-6 py-3 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            조회된 발주건: <span className="font-bold text-zinc-900 dark:text-white">{filteredAndSortedPos.length}</span>건 (전체 {safePos.length}건)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <th className="px-4 py-3.5 whitespace-nowrap">발주 번호</th>
                <th className="px-4 py-3.5">상품 요약</th>
                <th className="px-4 py-3.5 text-right whitespace-nowrap">수량</th>
                <th className="px-4 py-3.5 whitespace-nowrap">발주일 / 경과</th>
                <th className="px-4 py-3.5 whitespace-nowrap">진행 상태</th>
                <th className="px-4 py-3.5 whitespace-nowrap">최근 상태 변경</th>
                <th className="px-4 py-3.5 whitespace-nowrap">공급사 확인</th>
                <th className="px-4 py-3.5 text-right whitespace-nowrap">발주 금액</th>
                <th className="px-4 py-3.5 text-center whitespace-nowrap">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredAndSortedPos.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    {safePos.length === 0 ? (
                      <div>
                        <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                          등록된 발주서가 없습니다.
                        </p>
                        <p className="text-xs mt-1 text-zinc-400">
                          Letusto에서 발주서가 발행되면 이곳에 표출됩니다.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                          선택한 필터 조건(운영 상태 / 조회 기간)에 부합하는 발주서가 없습니다.
                        </p>
                        <p className="text-xs mt-1 text-zinc-400">
                          완료 또는 취소된 이전 발주건을 포함하려면 '상태: 전체' 또는 '조회 기간: 전체'를 선택해보세요.
                        </p>
                        <button
                          onClick={() => {
                            setSelectedCategories(ALL_CATEGORIES);
                            setPreset("all");
                          }}
                          className="mt-3 inline-flex items-center px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                        >
                          전체 상태 & 전체 기간 조회
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredAndSortedPos.map((po) => {
                  return (
                    <tr
                      key={po.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors"
                    >
                      {/* PO Number & Revision (Clickable link) */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-mono font-medium flex items-center gap-1.5 whitespace-nowrap break-normal">
                          <Link
                            href={`/portal/orders/purchase-orders/${po.id}`}
                            className="text-zinc-950 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors font-bold"
                          >
                            {po.po_number}
                          </Link>
                          {po.revision_no > 1 && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                              REV {po.revision_no}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Product Summary */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <div
                          className="font-medium text-zinc-900 dark:text-white truncate"
                          title={po.primary_product_name}
                        >
                          {po.primary_product_name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                          <span className="font-mono text-zinc-500 dark:text-zinc-400">
                            {po.primary_sku}
                          </span>
                          {po.extra_item_count > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              +{po.extra_item_count}건
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Ordered Quantity */}
                      <td className="px-4 py-3.5 text-right font-semibold text-zinc-900 dark:text-white font-mono whitespace-nowrap">
                        {(po.total_ordered || 0).toLocaleString()}
                      </td>

                      {/* Merged Order Date + Aging Badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                          {formatDate(po.order_date)}
                        </div>
                        <div className="mt-1">
                          {getAgingBadge(po)}
                        </div>
                      </td>

                      {/* Overall Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getOverallStatusBadge(po.overall_status)}
                      </td>

                      {/* Last Status Update */}
                      <td className="px-4 py-3.5 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {formatEasternDateTime(po.last_status_update)}
                      </td>

                      {/* Supplier Confirmation */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getConfirmationBadge(po.supplier_confirmation_status)}
                      </td>

                      {/* PO Amount */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="font-bold text-zinc-950 dark:text-white font-mono">
                          {formatCurrency(po.total_amount, po.currency || "USD")}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {po.currency || "USD"}
                        </div>
                      </td>

                      {/* Action Button */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <Link
                          href={`/portal/orders/purchase-orders/${po.id}`}
                          className="inline-flex items-center rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-white dark:ring-zinc-700 dark:hover:bg-zinc-800 transition-all"
                        >
                          상세 보기
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
