"use client";

import React, { useState } from "react";
import Link from "next/link";

interface OverviewItem {
  id: string;
  product_id: string;
  name: string;
  display_name: string;
  letusto_sku: string | null;
  manufacture_sku: string | null;
  brand_name: string;
  company_name: string;
  photoUrl: string | null;
  warehouse_id: string | null;
  warehouse_name: string;
  warehouse_code: string;
  warehouse_status: string;
  qty_on_hand: number;
  qty_hold: number;
  available: number;
  trading_status: string;
  last_activity: string;
}

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
  initialOverview: OverviewItem[];
  warehouses: WarehouseOption[];
  brands: BrandOption[];
}

const TRADING_COLORS: Record<string, string> = {
  active: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  historical: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
};

const TRADING_LABELS: Record<string, string> = {
  active: "운영 대상",
  historical: "과거 이력",
};

export function InventoryOverviewList({
  initialOverview,
  warehouses,
  brands,
}: InventoryOverviewListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("all");
  const [selectedBrandName, setSelectedBrandName] = useState("all");
  const [selectedTradingStatus, setSelectedTradingStatus] = useState("all");
  const [selectedStockStatus, setSelectedStockStatus] = useState("all");

  // Filtering Logic
  const filteredItems = initialOverview.filter((item) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      !s ||
      item.display_name.toLowerCase().includes(s) ||
      item.name.toLowerCase().includes(s) ||
      (item.letusto_sku || "").toLowerCase().includes(s) ||
      (item.manufacture_sku || "").toLowerCase().includes(s);

    const matchesWarehouse =
      selectedWarehouseId === "all" || item.warehouse_id === selectedWarehouseId;

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
    }

    return matchesSearch && matchesWarehouse && matchesBrand && matchesTrading && matchesStock;
  });

  return (
    <div className="space-y-4">
      {/* Search and Filters panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="flex flex-col gap-1.5 col-span-1 sm:col-span-2 md:col-span-1">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">검색어</span>
            <input
              type="text"
              placeholder="제품명, SKU, 제조사..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700"
            />
          </div>

          {/* Warehouse filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">물류창고</span>
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
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-955 dark:text-white"
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
              <option value="out_of_stock">품절 / 재고 없음 (Out of Stock)</option>
              <option value="on_hold">보류 재고 보유 (On Hold)</option>
            </select>
          </div>
        </div>

        {/* Results Info & Reset */}
        <div className="flex justify-between items-center text-[10px] text-zinc-450 dark:text-zinc-500 pt-1">
          <span>검색 결과: <strong className="text-zinc-900 dark:text-zinc-200 font-bold">{filteredItems.length}</strong> 건</span>
          {(searchTerm || selectedWarehouseId !== "all" || selectedBrandName !== "all" || selectedTradingStatus !== "all" || selectedStockStatus !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedWarehouseId("all");
                setSelectedBrandName("all");
                setSelectedTradingStatus("all");
                setSelectedStockStatus("all");
              }}
              className="text-zinc-900 hover:underline dark:text-zinc-250 font-semibold cursor-pointer"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* Grid List Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-550 font-bold dark:border-zinc-850 dark:bg-zinc-900/50 dark:text-white">
                <th className="px-6 py-3.5 whitespace-nowrap">사진</th>
                <th className="px-6 py-3.5 whitespace-nowrap">Letusto SKU</th>
                <th className="px-6 py-3.5 whitespace-nowrap">제조사 SKU</th>
                <th className="px-6 py-3.5 whitespace-nowrap">제품명</th>
                <th className="px-6 py-3.5 whitespace-nowrap">회사명</th>
                <th className="px-6 py-3.5 whitespace-nowrap">브랜드</th>
                <th className="px-6 py-3.5 whitespace-nowrap">물류창고</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-right">실재고 (On Hand)</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-right">보류재고 (Hold)</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-right">가용재고 (Available)</th>
                <th className="px-6 py-3.5 whitespace-nowrap">운영 상태</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
              {filteredItems.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/10 transition-colors"
                >
                  {/* Photo */}
                  <td className="px-6 py-4 align-middle">
                    {item.photoUrl ? (
                      <div className="h-12 w-12 rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center p-1 shadow-sm overflow-hidden">
                        <img
                          src={item.photoUrl}
                          alt={item.display_name}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-md bg-zinc-100 flex items-center justify-center text-zinc-400 dark:bg-zinc-800 text-[10px] font-bold border border-dashed border-zinc-200 dark:border-zinc-700">
                        No Pic
                      </div>
                    )}
                  </td>

                  {/* Letusto SKU */}
                  <td className="px-6 py-4 align-middle font-mono font-bold text-zinc-955 dark:text-white whitespace-nowrap">
                    {item.letusto_sku || (
                      <span className="text-zinc-350 dark:text-zinc-650 italic font-sans font-normal">지정 대기</span>
                    )}
                  </td>

                  {/* Manufacture SKU */}
                  <td className="px-6 py-4 align-middle font-mono font-semibold text-zinc-800 dark:text-zinc-350 whitespace-nowrap">
                    {item.manufacture_sku || (
                      <span className="text-zinc-350 dark:text-zinc-650 italic font-sans font-normal">미입력</span>
                    )}
                  </td>

                  {/* Product Name */}
                  <td className="px-6 py-4 align-middle font-bold text-zinc-900 dark:text-white min-w-[180px]">
                    <Link
                      href={`/admin/products/trading/${item.product_id}`}
                      className="hover:text-zinc-950 dark:hover:text-white hover:underline transition-all block text-sm"
                    >
                      {item.display_name}
                    </Link>
                  </td>

                  {/* Company */}
                  <td className="px-6 py-4 align-middle text-zinc-600 dark:text-zinc-355 font-medium whitespace-nowrap max-w-[120px] truncate">
                    {item.company_name}
                  </td>

                  {/* Brand */}
                  <td className="px-6 py-4 align-middle text-zinc-600 dark:text-zinc-300 font-medium whitespace-nowrap max-w-[120px] truncate">
                    {item.brand_name}
                  </td>

                  {/* Warehouse */}
                  <td className="px-6 py-4 align-middle font-semibold text-zinc-800 dark:text-zinc-300 whitespace-nowrap">
                    {item.warehouse_code !== "-" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-mono text-zinc-500">[{item.warehouse_code}]</span>
                        <span>{item.warehouse_name}</span>
                      </span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-600 italic font-normal">지정 대기</span>
                    )}
                  </td>

                  {/* On Hand */}
                  <td className="px-6 py-4 align-middle text-right font-mono font-bold text-zinc-900 dark:text-white">
                    {item.qty_on_hand}
                  </td>

                  {/* Hold */}
                  <td className="px-6 py-4 align-middle text-right font-mono font-bold text-rose-500 dark:text-rose-455">
                    {item.qty_hold}
                  </td>

                  {/* Available */}
                  <td className="px-6 py-4 align-middle text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {item.available}
                  </td>

                  {/* Trading Status */}
                  <td className="px-6 py-4 align-middle">
                    <span className={`inline-flex items-center rounded px-2.5 py-0.5 text-[10px] font-bold border ${TRADING_COLORS[item.trading_status] || TRADING_COLORS.active}`}>
                      {TRADING_LABELS[item.trading_status] || TRADING_LABELS.active}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-6 py-4 align-middle text-right">
                    <Link
                      href={`/admin/products/trading/${item.product_id}`}
                      className="inline-flex items-center px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      운영 관리 (360°)
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-zinc-400 dark:text-zinc-500">
                    조회 조건에 맞는 재고 항목이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
