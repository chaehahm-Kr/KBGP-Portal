"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  InventoryOverviewItem,
  recordOpeningBalance,
  recordManualAdjustment,
} from "@/lib/inventory/actions";

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface BrandOption {
  id: string;
  name: string;
}

interface InventoryOverviewListProps {
  initialOverview: InventoryOverviewItem[];
  warehouses: WarehouseOption[];
  brands: BrandOption[];
}

const TRADING_COLORS: Record<string, string> = {
  active: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  historical: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  inactive: "bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500",
};

const TRADING_LABELS: Record<string, string> = {
  active: "운영 대상",
  historical: "과거 이력",
  inactive: "비대상",
};

const SALES_COLORS: Record<string, string> = {
  PREPARING: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  ON_SALE: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
  TEMPORARY_OUT_OF_STOCK: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
  DISCONTINUED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900",
};

const SALES_LABELS: Record<string, string> = {
  PREPARING: "준비중",
  ON_SALE: "판매중",
  TEMPORARY_OUT_OF_STOCK: "일시품절",
  DISCONTINUED: "단종",
};

export function InventoryOverviewList({
  initialOverview,
  warehouses,
  brands,
}: InventoryOverviewListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("all");
  const [selectedBrandName, setSelectedBrandName] = useState("all");
  const [selectedTradingStatus, setSelectedTradingStatus] = useState("all");
  const [selectedStockStatus, setSelectedStockStatus] = useState("all");

  // Accordion expanded rows state
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  // Opening Balance Modal State
  const [openingModalProduct, setOpeningModalProduct] = useState<InventoryOverviewItem | null>(null);
  const [openingWarehouseId, setOpeningWarehouseId] = useState("");
  const [openingQty, setOpeningQty] = useState<number>(0);
  const [openingNote, setOpeningNote] = useState("");
  const [isSubmittingOpening, setIsSubmittingOpening] = useState(false);

  // Manual Adjustment Modal State
  const [adjustModalProduct, setAdjustModalProduct] = useState<InventoryOverviewItem | null>(null);
  const [adjustWarehouseId, setAdjustWarehouseId] = useState("");
  const [adjustQtyChange, setAdjustQtyChange] = useState<number>(0);
  const [adjustHoldChange, setAdjustHoldChange] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("실물 재물조사 차이 조정");
  const [adjustNote, setAdjustNote] = useState("");
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Error / Success feedback
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedRowIds(new Set(initialOverview.map((item) => item.id)));
  };

  const collapseAll = () => {
    setExpandedRowIds(new Set());
  };

  // Open Opening Balance Modal
  const openOpeningModal = (item: InventoryOverviewItem, defaultWhId?: string) => {
    setOpeningModalProduct(item);
    const existingWhIds = new Set(item.warehouse_balances.map((w) => w.warehouse_id));
    const availableWh = warehouses.find((w) => !existingWhIds.has(w.id));
    setOpeningWarehouseId(defaultWhId || availableWh?.id || warehouses[0]?.id || "");
    setOpeningQty(0);
    setOpeningNote("기초 재고 입력");
    setActionError(null);
    setActionSuccess(null);
  };

  // Submit Opening Balance
  const handleOpeningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openingModalProduct || !openingWarehouseId) return;

    setIsSubmittingOpening(true);
    setActionError(null);
    try {
      await recordOpeningBalance(
        openingModalProduct.product_id,
        openingWarehouseId,
        Number(openingQty),
        openingNote.trim()
      );
      setActionSuccess("기초 재고가 성공적으로 등록되었습니다.");
      setOpeningModalProduct(null);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setActionError(err.message || "기초 재고 등록 실패");
    } finally {
      setIsSubmittingOpening(false);
    }
  };

  // Open Adjust Modal
  const openAdjustModal = (item: InventoryOverviewItem, defaultWhId?: string) => {
    setAdjustModalProduct(item);
    setAdjustWarehouseId(defaultWhId || item.warehouse_balances[0]?.warehouse_id || warehouses[0]?.id || "");
    setAdjustQtyChange(0);
    setAdjustHoldChange(0);
    setAdjustReason("실물 재물조사 차이 조정");
    setAdjustNote("");
    setActionError(null);
    setActionSuccess(null);
  };

  // Submit Adjust
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalProduct || !adjustWarehouseId) return;

    if (adjustQtyChange === 0 && adjustHoldChange === 0) {
      setActionError("재고 변동 수량 또는 보류 변동 수량을 입력해주세요.");
      return;
    }

    setIsSubmittingAdjust(true);
    setActionError(null);
    try {
      await recordManualAdjustment(
        adjustModalProduct.product_id,
        adjustWarehouseId,
        Number(adjustQtyChange),
        Number(adjustHoldChange),
        adjustReason,
        adjustNote.trim()
      );
      setActionSuccess("재고 조정 내역이 성공적으로 반영되었습니다.");
      setAdjustModalProduct(null);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setActionError(err.message || "재고 조정 실패");
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // Filtering Logic
  const filteredItems = initialOverview.filter((item) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      !s ||
      item.display_name.toLowerCase().includes(s) ||
      item.name.toLowerCase().includes(s) ||
      (item.letusto_sku || "").toLowerCase().includes(s) ||
      (item.manufacture_sku || "").toLowerCase().includes(s) ||
      item.company_name.toLowerCase().includes(s) ||
      item.brand_name.toLowerCase().includes(s);

    const matchesWarehouse =
      selectedWarehouseId === "all" ||
      item.warehouse_balances.some((w) => w.warehouse_id === selectedWarehouseId);

    const matchesBrand =
      selectedBrandName === "all" || item.brand_name === selectedBrandName;

    const matchesTrading =
      selectedTradingStatus === "all" || item.trading_status === selectedTradingStatus;

    let matchesStock = true;
    if (selectedStockStatus === "in_stock") {
      matchesStock = item.qty_on_hand > 0;
    } else if (selectedStockStatus === "out_of_stock") {
      matchesStock = item.qty_on_hand === 0;
    } else if (selectedStockStatus === "on_hold") {
      matchesStock = item.qty_hold > 0;
    } else if (selectedStockStatus === "has_incoming") {
      matchesStock = item.incoming > 0;
    }

    return matchesSearch && matchesWarehouse && matchesBrand && matchesTrading && matchesStock;
  });

  // Global Stat Calculations
  const totalSkus = filteredItems.length;
  const totalOnHand = filteredItems.reduce((sum, i) => sum + i.qty_on_hand, 0);
  const totalHold = filteredItems.reduce((sum, i) => sum + i.qty_hold, 0);
  const totalAvailable = filteredItems.reduce((sum, i) => sum + i.available, 0);
  const totalIncoming = filteredItems.reduce((sum, i) => sum + i.incoming, 0);

  return (
    <div className="space-y-5">
      {/* Action Toast Notifications */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex justify-between items-center dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200">
          <span>✓ {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="cursor-pointer text-emerald-700 dark:text-emerald-300 font-normal">
            ✕
          </button>
        </div>
      )}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex justify-between items-center dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200">
          <span>⚠️ {actionError}</span>
          <button onClick={() => setActionError(null)} className="cursor-pointer text-rose-700 dark:text-rose-300 font-normal">
            ✕
          </button>
        </div>
      )}

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">
            총 운영 품목 (SKU)
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-zinc-900 dark:text-white">{totalSkus}</span>
            <span className="text-xs text-zinc-500">개</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">
            총 실재고 (On Hand)
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
              {totalOnHand.toLocaleString()}
            </span>
            <span className="text-xs text-zinc-500">PCS</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
            총 가용 재고 (Available)
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {totalAvailable.toLocaleString()}
            </span>
            <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70">PCS</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block mb-1">
            입고 예정 (Incoming)
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
              {totalIncoming.toLocaleString()}
            </span>
            <span className="text-xs text-indigo-600/70 dark:text-indigo-400/70">PCS</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider block mb-1">
            보류/불량 (Hold)
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-rose-500 dark:text-rose-400">
              {totalHold.toLocaleString()}
            </span>
            <span className="text-xs text-rose-500/70">PCS</span>
          </div>
        </div>
      </div>

      {/* Search and Filters panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="flex flex-col gap-1.5 col-span-1 sm:col-span-2 lg:col-span-1">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">검색어</span>
            <input
              type="text"
              placeholder="제품명, Letusto SKU, 제조사..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700"
            />
          </div>

          {/* Warehouse filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">소속 물류창고</span>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              <option value="all">전체 물류창고</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  [{wh.code}] {wh.name}
                </option>
              ))}
            </select>
          </div>

          {/* Brand filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">브랜드</span>
            <select
              value={selectedBrandName}
              onChange={(e) => setSelectedBrandName(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              <option value="all">전체 브랜드</option>
              {brands.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Trading status filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">거래 운영 상태</span>
            <select
              value={selectedTradingStatus}
              onChange={(e) => setSelectedTradingStatus(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              <option value="all">전체 운영 상태</option>
              <option value="active">운영 대상 (Active)</option>
              <option value="historical">과거 이력 (Historical)</option>
            </select>
          </div>

          {/* Stock status filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">재고 유무 상태</span>
            <select
              value={selectedStockStatus}
              onChange={(e) => setSelectedStockStatus(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              <option value="all">전체 재고 상태</option>
              <option value="in_stock">재고 보유 (In Stock)</option>
              <option value="out_of_stock">품절 / 재고 0 (Out of Stock)</option>
              <option value="on_hold">보류 재고 보유 (On Hold)</option>
              <option value="has_incoming">입고 예정 있음 (Incoming)</option>
            </select>
          </div>
        </div>

        {/* Results Bar & Expand/Collapse All Buttons */}
        <div className="flex flex-wrap justify-between items-center text-xs text-zinc-500 pt-1 border-t border-zinc-150 dark:border-zinc-800 gap-2">
          <div className="flex items-center gap-3">
            <span>
              검색 결과: <strong className="text-zinc-900 dark:text-white font-bold">{filteredItems.length}</strong>개 품목
            </span>
            {(searchTerm || selectedWarehouseId !== "all" || selectedBrandName !== "all" || selectedTradingStatus !== "all" || selectedStockStatus !== "all") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedWarehouseId("all");
                  setSelectedBrandName("all");
                  setSelectedTradingStatus("all");
                  setSelectedStockStatus("all");
                }}
                className="text-indigo-600 hover:underline font-semibold cursor-pointer"
              >
                필터 초기화
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <button
              onClick={expandAll}
              className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded cursor-pointer"
            >
              + 창고 상세 전체 펼치기
            </button>
            <button
              onClick={collapseAll}
              className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded cursor-pointer"
            >
              - 전체 접기
            </button>
          </div>
        </div>
      </div>

      {/* Unified Master-Detail Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/70 text-zinc-550 font-bold dark:border-zinc-850 dark:bg-zinc-900/70 dark:text-zinc-300">
                <th className="w-8 px-3 py-3.5 text-center"></th>
                <th className="px-4 py-3.5 whitespace-nowrap">사진</th>
                <th className="px-4 py-3.5 whitespace-nowrap font-mono">Letusto SKU</th>
                <th className="px-4 py-3.5 whitespace-nowrap">제조사 SKU</th>
                <th className="px-4 py-3.5 whitespace-nowrap">제품명</th>
                <th className="px-4 py-3.5 whitespace-nowrap">회사 / 브랜드</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-right">보유재고</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-right">보류</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-right">가용재고</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-right">입고예정</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-center">판매상태</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-center">운영</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
              {filteredItems.map((item) => {
                const isExpanded = expandedRowIds.has(item.id);
                const hasWarehouse = item.warehouse_balances.length > 0;

                return (
                  <React.Fragment key={item.id}>
                    {/* Master Product Row */}
                    <tr
                      className={`hover:bg-zinc-50/40 dark:hover:bg-zinc-850/10 transition-colors ${
                        isExpanded ? "bg-zinc-50/60 dark:bg-zinc-950/40" : ""
                      }`}
                    >
                      {/* Accordion Toggle Chevron */}
                      <td className="px-3 py-3.5 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => toggleExpand(item.id)}
                          className="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer font-bold transition-transform"
                          title={isExpanded ? "창고별 상세 접기" : "창고별 상세 펼치기"}
                        >
                          <span className={`text-[10px] transform transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                            ▶
                          </span>
                        </button>
                      </td>

                      {/* Photo */}
                      <td className="px-4 py-3.5 align-middle">
                        {item.photoUrl ? (
                          <div className="h-10 w-10 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center p-0.5 shadow-xs overflow-hidden">
                            <img
                              src={item.photoUrl}
                              alt={item.display_name}
                              className="h-full w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400 dark:bg-zinc-800 text-[9px] font-bold border border-dashed border-zinc-200 dark:border-zinc-700">
                            No Pic
                          </div>
                        )}
                      </td>

                      {/* Letusto SKU */}
                      <td className="px-4 py-3.5 align-middle font-mono font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                        {item.letusto_sku || (
                          <span className="text-zinc-400 italic font-sans font-normal">지정 대기</span>
                        )}
                      </td>

                      {/* Manufacture SKU */}
                      <td className="px-4 py-3.5 align-middle font-mono text-zinc-700 dark:text-zinc-400 whitespace-nowrap">
                        {item.manufacture_sku || (
                          <span className="text-zinc-400 italic font-sans font-normal">미입력</span>
                        )}
                      </td>

                      {/* Product Name */}
                      <td className="px-4 py-3.5 align-middle font-bold text-zinc-900 dark:text-white min-w-[180px]">
                        <Link
                          href={`/admin/products/${item.product_id}`}
                          className="hover:text-indigo-600 hover:underline transition-all block text-xs"
                        >
                          {item.display_name}
                        </Link>
                        {item.name !== item.display_name && (
                          <span className="text-[10px] text-zinc-400 font-normal block truncate">
                            {item.name}
                          </span>
                        )}
                      </td>

                      {/* Company / Brand */}
                      <td className="px-4 py-3.5 align-middle text-zinc-650 dark:text-zinc-400 whitespace-nowrap">
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200">{item.brand_name}</div>
                        <div className="text-[10px] text-zinc-400 truncate max-w-[130px]">{item.company_name}</div>
                      </td>

                      {/* On Hand */}
                      <td className="px-4 py-3.5 align-middle text-right font-mono font-bold text-zinc-900 dark:text-white">
                        {item.qty_on_hand.toLocaleString()}
                      </td>

                      {/* Hold */}
                      <td className="px-4 py-3.5 align-middle text-right font-mono font-bold text-rose-500 dark:text-rose-400">
                        {item.qty_hold > 0 ? item.qty_hold.toLocaleString() : "-"}
                      </td>

                      {/* Available */}
                      <td className="px-4 py-3.5 align-middle text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {item.available.toLocaleString()}
                      </td>

                      {/* Incoming */}
                      <td className="px-4 py-3.5 align-middle text-right font-mono font-bold">
                        {item.incoming > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900 text-[10px]">
                            +{item.incoming.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-zinc-400 font-normal">-</span>
                        )}
                      </td>

                      {/* Sales Status */}
                      <td className="px-4 py-3.5 align-middle text-center whitespace-nowrap">
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${SALES_COLORS[item.sales_status] || SALES_COLORS.PREPARING}`}>
                          {SALES_LABELS[item.sales_status] || item.sales_status}
                        </span>
                      </td>

                      {/* Trading Status */}
                      <td className="px-4 py-3.5 align-middle text-center whitespace-nowrap">
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${TRADING_COLORS[item.trading_status] || TRADING_COLORS.active}`}>
                          {TRADING_LABELS[item.trading_status] || TRADING_LABELS.active}
                        </span>
                      </td>

                      {/* Manage Actions */}
                      <td className="px-4 py-3.5 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openOpeningModal(item)}
                            className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 text-[10px] font-bold rounded-md transition-colors cursor-pointer"
                            title="물류창고 기초 재고 등록"
                          >
                            + 기초재고
                          </button>
                          <button
                            type="button"
                            onClick={() => openAdjustModal(item)}
                            disabled={!hasWarehouse}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800 text-[10px] font-bold rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title="재고 수동 조정"
                          >
                            ± 조정
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Accordion: Warehouse Breakdown */}
                    {isExpanded && (
                      <tr className="bg-zinc-50/80 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800">
                        <td colSpan={13} className="px-8 py-4">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs font-bold text-zinc-700 dark:text-zinc-300 pb-1 border-b border-zinc-200 dark:border-zinc-800">
                              <span>🏢 물류창고별 재고 세부 내역 (Warehouse Breakdown)</span>
                              <button
                                type="button"
                                onClick={() => openOpeningModal(item)}
                                className="text-[11px] text-indigo-600 hover:underline font-bold cursor-pointer"
                              >
                                + 새 창고 기초재고 등록
                              </button>
                            </div>

                            {!hasWarehouse ? (
                              <div className="py-4 text-center text-zinc-400 text-xs italic bg-white dark:bg-zinc-900 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
                                아직 등록된 물류창고 재고가 없습니다. [기초재고]를 등록해 주세요.
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-zinc-100/60 text-zinc-500 font-bold border-b border-zinc-200 dark:bg-zinc-850/50 dark:border-zinc-800 dark:text-zinc-400">
                                      <th className="px-4 py-2">물류창고명</th>
                                      <th className="px-4 py-2">창고 코드</th>
                                      <th className="px-4 py-2">창고 상태</th>
                                      <th className="px-4 py-2 text-right">실재고 (On Hand)</th>
                                      <th className="px-4 py-2 text-right">보류 (Hold)</th>
                                      <th className="px-4 py-2 text-right">가용 (Available)</th>
                                      <th className="px-4 py-2 text-right">최근 변동일</th>
                                      <th className="px-4 py-2 text-right">창고별 액션</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                                    {item.warehouse_balances.map((wh) => (
                                      <tr key={wh.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/20">
                                        <td className="px-4 py-2.5 font-bold text-zinc-900 dark:text-white">
                                          {wh.warehouse_name}
                                        </td>
                                        <td className="px-4 py-2.5 font-mono text-zinc-600 dark:text-zinc-400">
                                          [{wh.warehouse_code}]
                                        </td>
                                        <td className="px-4 py-2.5">
                                          <span className="px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded text-[10px] font-bold dark:bg-zinc-800 dark:text-zinc-300">
                                            {wh.warehouse_status}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono font-bold text-zinc-900 dark:text-white">
                                          {wh.qty_on_hand.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono font-bold text-rose-500 dark:text-rose-400">
                                          {wh.qty_hold > 0 ? wh.qty_hold.toLocaleString() : "-"}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                          {wh.available.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono text-zinc-500 text-[11px]">
                                          {wh.last_activity ? wh.last_activity.split("T")[0] : "-"}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                          <button
                                            type="button"
                                            onClick={() => openAdjustModal(item, wh.warehouse_id)}
                                            className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold rounded cursor-pointer dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                                          >
                                            ± 조정
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-zinc-400 dark:text-zinc-500">
                    조회 조건에 일치하는 상품 재고 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Opening Balance Modal */}
      {openingModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-150 pb-3 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">+ 기초 재고 등록 (Opening Balance)</h3>
                <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{openingModalProduct.display_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpeningModalProduct(null)}
                className="text-zinc-400 hover:text-zinc-650 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOpeningSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  대상 물류창고 *
                </label>
                <select
                  required
                  value={openingWarehouseId}
                  onChange={(e) => setOpeningWarehouseId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="">물류창고 선택</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      [{wh.code}] {wh.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  기초 수량 (PCS) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={openingQty}
                  onChange={(e) => setOpeningQty(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-lg border border-zinc-300 p-2 font-mono font-bold text-right dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  메모 / 비고
                </label>
                <input
                  type="text"
                  placeholder="예: 초기 기초 재고 실사 등록"
                  value={openingNote}
                  onChange={(e) => setOpeningNote(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-150 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setOpeningModalProduct(null)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-lg cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOpening}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingOpening ? "등록 중..." : "기초 재고 등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Adjustment Modal */}
      {adjustModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-150 pb-3 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">± 재고 수동 조정 (Manual Adjustment)</h3>
                <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{adjustModalProduct.display_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustModalProduct(null)}
                className="text-zinc-400 hover:text-zinc-650 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  대상 물류창고 *
                </label>
                <select
                  required
                  value={adjustWarehouseId}
                  onChange={(e) => setAdjustWarehouseId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  {adjustModalProduct.warehouse_balances.map((wh) => (
                    <option key={wh.warehouse_id} value={wh.warehouse_id}>
                      [{wh.warehouse_code}] {wh.warehouse_name} (현재 On Hand: {wh.qty_on_hand} PCS)
                    </option>
                  ))}
                  {warehouses
                    .filter((w) => !adjustModalProduct.warehouse_balances.some((wb) => wb.warehouse_id === w.id))
                    .map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        [{wh.code}] {wh.name} (신규 창고)
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    실재고 증감 (± PCS) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="예: +10 또는 -5"
                    value={adjustQtyChange}
                    onChange={(e) => setAdjustQtyChange(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-zinc-300 p-2 font-mono font-bold text-right dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">증가: 양수(+), 감소: 음수(-)</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    보류 수량 증감 (± PCS)
                  </label>
                  <input
                    type="number"
                    value={adjustHoldChange}
                    onChange={(e) => setAdjustHoldChange(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-zinc-300 p-2 font-mono font-bold text-right dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">불량/보류 전환: (+)</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  조정 사유 (Reason) *
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="실물 재물조사 차이 조정">실물 재물조사 차이 조정 (Cycle Count Variance)</option>
                  <option value="파손/불량 재고 전환">파손/불량 재고 전환 (Damaged Goods Hold)</option>
                  <option value="샘플 출고 및 마케팅 사용">샘플 출고 및 마케팅 사용 (Sample/Marketing Out)</option>
                  <option value="입고 검수 오류 수정">입고 검수 오류 수정 (Inbound Inspection Correction)</option>
                  <option value="기타 재고 조정">기타 재고 조정 (Other Adjustment)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  상세 사유 메모
                </label>
                <input
                  type="text"
                  placeholder="조정 사유를 구체적으로 기재해주세요."
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-150 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setAdjustModalProduct(null)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-lg cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjust}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingAdjust ? "반영 중..." : "재고 조정 반영"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
