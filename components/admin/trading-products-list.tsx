"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface TradingProductItem {
  id: string;
  name: string;
  display_name: string;
  manufacture_sku: string | null;
  display_manufacture_sku: string | null;
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
  category_code?: string | null;
  category_full_path?: string | null;
  qty_on_hand: number;
  qty_available: number;
}

interface TradingProductsListProps {
  initialProducts: TradingProductItem[];
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

const TRADING_COLORS: Record<string, string> = {
  active: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  historical: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
};

const TRADING_LABELS: Record<string, string> = {
  active: "운영 대상 (Active)",
  historical: "과거 이력 (Historical)",
};

export function TradingProductsList({ initialProducts }: TradingProductsListProps) {
  const [products, setProducts] = useState<TradingProductItem[]>(initialProducts);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCompanyId, setSelectedCompanyId] = useState("all");
  const [selectedBrandId, setSelectedBrandId] = useState("all");
  const [selectedSalesStatus, setSelectedSalesStatus] = useState("all");
  const [selectedTradingStatus, setSelectedTradingStatus] = useState("all");

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

  // Filter products based on search and selected options
  const filteredProducts = products.filter((p) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      !s ||
      p.display_name.toLowerCase().includes(s) ||
      p.name.toLowerCase().includes(s) ||
      (p.letusto_sku || "").toLowerCase().includes(s) ||
      (p.display_manufacture_sku || "").toLowerCase().includes(s) ||
      p.companyName.toLowerCase().includes(s) ||
      p.brandName.toLowerCase().includes(s);

    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
    const matchesCompany = selectedCompanyId === "all" || p.company_id === selectedCompanyId;
    const matchesBrand = selectedBrandId === "all" || p.brand_id === selectedBrandId;
    const matchesSalesStatus = selectedSalesStatus === "all" || p.sales_status === selectedSalesStatus;
    const matchesTradingStatus = selectedTradingStatus === "all" || p.trading_status === selectedTradingStatus;

    return matchesSearch && matchesCategory && matchesCompany && matchesBrand && matchesSalesStatus && matchesTradingStatus;
  });

  return (
    <div className="space-y-4">
      {/* Search and Filters Panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          {/* Search Input */}
          <div className="flex flex-col gap-1.5 col-span-1 sm:col-span-2 md:col-span-1">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">검색어</span>
            <input
              type="text"
              placeholder="제품명, SKU, 제조사, 브랜드..."
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
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-955 dark:text-white"
            >
              <option value="all">전체 브랜드</option>
              {uniqueBrands.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Sales Status Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">판매 상태</span>
            <select
              value={selectedSalesStatus}
              onChange={(e) => setSelectedSalesStatus(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              <option value="all">전체 판매 상태</option>
              {Object.entries(SALES_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Trading Status Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">운영 관리 상태</span>
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
        </div>

        {/* Results Info & Reset */}
        <div className="flex justify-between items-center text-[10px] text-zinc-450 dark:text-zinc-500 pt-1">
          <span>검색 결과: <strong className="text-zinc-900 dark:text-zinc-200 font-bold">{filteredProducts.length}</strong> 건</span>
          {(searchTerm || selectedCategory !== "all" || selectedCompanyId !== "all" || selectedBrandId !== "all" || selectedSalesStatus !== "all" || selectedTradingStatus !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
                setSelectedCompanyId("all");
                setSelectedBrandId("all");
                setSelectedSalesStatus("all");
                setSelectedTradingStatus("all");
              }}
              className="text-zinc-900 hover:underline dark:text-zinc-250 font-semibold cursor-pointer"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* Products Table */}
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
                <th className="px-6 py-3.5 whitespace-nowrap text-right">실재고 (On Hand)</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-right">가용재고 (Available)</th>
                <th className="px-6 py-3.5 whitespace-nowrap">판매 상태</th>
                <th className="px-6 py-3.5 whitespace-nowrap">운영 상태</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
              {filteredProducts.map((product) => {
                return (
                  <tr
                    key={product.id}
                    className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/10 transition-colors"
                  >
                    {/* Photo */}
                    <td className="px-6 py-4 align-middle">
                      {product.photoUrl ? (
                        <div className="h-12 w-12 rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center p-1 shadow-sm overflow-hidden">
                          <img
                            src={product.photoUrl}
                            alt={product.display_name}
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
                      {product.letusto_sku || (
                        <span className="text-zinc-350 dark:text-zinc-650 italic font-sans font-normal">지정 대기</span>
                      )}
                    </td>

                    {/* Manufacture SKU */}
                    <td className="px-6 py-4 align-middle font-mono font-semibold text-zinc-800 dark:text-zinc-350 whitespace-nowrap">
                      {product.display_manufacture_sku || (
                        <span className="text-zinc-350 dark:text-zinc-650 italic font-sans font-normal">미입력</span>
                      )}
                    </td>

                    {/* Name */}
                    <td className="px-6 py-4 align-middle font-bold text-zinc-900 dark:text-white min-w-[200px]">
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/admin/products/trading/${product.id}`}
                          className="hover:text-zinc-950 dark:hover:text-white hover:underline transition-all block text-sm"
                        >
                          {product.display_name}
                        </Link>
                        {product.category_full_path && (
                          <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block pt-0.5">
                            {product.category_full_path}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Company */}
                    <td className="px-6 py-4 align-middle text-zinc-600 dark:text-zinc-355 font-medium whitespace-nowrap max-w-[120px] truncate">
                      <Link
                        href={`/admin/companies/${product.company_id}`}
                        className="hover:underline hover:text-zinc-950 dark:hover:text-white cursor-pointer transition-colors"
                      >
                        {product.companyName}
                      </Link>
                    </td>

                    {/* Brand */}
                    <td className="px-6 py-4 align-middle text-zinc-600 dark:text-zinc-300 font-medium whitespace-nowrap max-w-[120px] truncate">
                      {product.brandName}
                    </td>

                    {/* Qty On Hand */}
                    <td className="px-6 py-4 align-middle text-right font-mono font-bold text-zinc-900 dark:text-white">
                      {product.qty_on_hand}
                    </td>

                    {/* Qty Available */}
                    <td className="px-6 py-4 align-middle text-right font-mono font-bold text-emerald-600 dark:text-emerald-450">
                      {product.qty_available}
                    </td>

                    {/* Sales Status */}
                    <td className="px-6 py-4 align-middle">
                      <span className={`inline-flex items-center rounded px-2.5 py-0.5 text-[10px] font-bold border ${SALES_COLORS[product.sales_status] || SALES_COLORS.PREPARING}`}>
                        {SALES_LABELS[product.sales_status] || SALES_LABELS.PREPARING}
                      </span>
                    </td>

                    {/* Trading Status */}
                    <td className="px-6 py-4 align-middle">
                      <span className={`inline-flex items-center rounded px-2.5 py-0.5 text-[10px] font-bold border ${TRADING_COLORS[product.trading_status] || TRADING_COLORS.active}`}>
                        {TRADING_LABELS[product.trading_status] || TRADING_LABELS.active}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-6 py-4 align-middle text-right">
                      <Link
                        href={`/admin/products/trading/${product.id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        운영 관리 (360°)
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-zinc-400 dark:text-zinc-500">
                    거래 대상 제품이 존재하지 않습니다.
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
