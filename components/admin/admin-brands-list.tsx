"use client";

import React, { useState } from "react";
import Link from "next/link";

export interface AdminBrandItem {
  id: string;
  brandCode: string;
  name: string;
  logoUrl: string | null;
  companyName: string;
  companyId: string;
  hasKr: boolean;
  hasUs: boolean;
  isActive: boolean;
  productCount: number;
  lastUpdated: string;
}

interface AdminBrandsListProps {
  initialBrands: AdminBrandItem[];
}

export function AdminBrandsList({ initialBrands }: AdminBrandsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [krFilter, setKrFilter] = useState<"all" | "registered" | "unregistered">("all");
  const [usFilter, setUsFilter] = useState<"all" | "registered" | "unregistered">("all");

  const filteredBrands = initialBrands.filter((brand) => {
    // 1. Unified Text Search (Brand Code, Brand Name, Company Name)
    const searchLower = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !searchLower ||
      brand.brandCode.toLowerCase().includes(searchLower) ||
      brand.name.toLowerCase().includes(searchLower) ||
      brand.companyName.toLowerCase().includes(searchLower);

    // 2. Status Filter
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? brand.isActive : !brand.isActive);

    // 3. KR Trademark Filter
    const matchesKr =
      krFilter === "all" ||
      (krFilter === "registered" ? brand.hasKr : !brand.hasKr);

    // 4. US Trademark Filter
    const matchesUs =
      usFilter === "all" ||
      (usFilter === "registered" ? brand.hasUs : !brand.hasUs);

    return matchesSearch && matchesStatus && matchesKr && matchesUs;
  });

  const isFiltered =
    searchTerm !== "" ||
    statusFilter !== "all" ||
    krFilter !== "all" ||
    usFilter !== "all";

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setKrFilter("all");
    setUsFilter("all");
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        {/* Search Bar */}
        <div className="relative w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400 dark:text-zinc-550 select-none">
            🔍
          </span>
          <input
            type="text"
            placeholder="브랜드 코드, 브랜드명 또는 회사명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 py-2.5 pl-10 pr-4 text-xs outline-none bg-zinc-50/50 focus:border-zinc-950 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-white dark:focus:bg-zinc-900 transition-all"
          />
        </div>

        {/* Filters and Stats Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-zinc-150 pt-4 dark:border-zinc-850 flex-wrap">
          {/* Status Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 mr-1 select-none">
              상태:
            </span>
            {[
              { key: "all", label: "전체" },
              { key: "active", label: "사용 중" },
              { key: "inactive", label: "사용 중단" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  statusFilter === tab.key
                    ? "bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950"
                    : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-850"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Trademark Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 select-none">
                KR 상표권:
              </span>
              <select
                value={krFilter}
                onChange={(e) => setKrFilter(e.target.value as any)}
                className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-all font-medium"
              >
                <option value="all">전체</option>
                <option value="registered">보유</option>
                <option value="unregistered">미보유</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 select-none">
                US USPTO:
              </span>
              <select
                value={usFilter}
                onChange={(e) => setUsFilter(e.target.value as any)}
                className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-all font-medium"
              >
                <option value="all">전체</option>
                <option value="registered">보유</option>
                <option value="unregistered">미보유</option>
              </select>
            </div>
          </div>
        </div>

        {/* Result Counter & Clear Filter Link */}
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex justify-between items-center pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
          <span>
            조회 결과:{" "}
            <strong className="text-zinc-900 dark:text-zinc-100 font-bold">
              {filteredBrands.length}
            </strong>
            개 브랜드 (전체 {initialBrands.length}개)
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-zinc-800 dark:text-zinc-200 font-bold hover:underline cursor-pointer"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* Brands Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
            <thead>
              <tr className="border-b border-zinc-150 bg-zinc-50/50 font-bold text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white">
                <th className="px-6 py-3.5 font-semibold w-16">로고</th>
                <th className="px-6 py-3.5 font-semibold">브랜드 코드</th>
                <th className="px-6 py-3.5 font-semibold">브랜드명</th>
                <th className="px-6 py-3.5 font-semibold">보유 회사</th>
                <th className="px-6 py-3.5 font-semibold text-center">상태</th>
                <th className="px-6 py-3.5 font-semibold text-center">대한민국 상표권</th>
                <th className="px-6 py-3.5 font-semibold text-center">미국 USPTO</th>
                <th className="px-6 py-3.5 font-semibold text-center">등록 상품 수</th>
                <th className="px-6 py-3.5 font-semibold">최근 업데이트일</th>
                <th className="px-6 py-3.5 font-semibold text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredBrands.map((brand) => (
                <tr
                  key={brand.id}
                  className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors"
                >
                  {/* Logo */}
                  <td className="px-6 py-3">
                    {brand.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={brand.logoUrl}
                        alt=""
                        className="h-8 w-8 rounded-md border border-zinc-200 object-cover bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-[9px] font-bold text-zinc-400 select-none">
                        LOGO
                      </div>
                    )}
                  </td>

                  {/* Brand Code */}
                  <td className="px-6 py-3.5 font-mono font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                    <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700">
                      {brand.brandCode || "-"}
                    </span>
                  </td>

                  {/* Brand Name */}
                  <td className="px-6 py-3.5 font-bold text-zinc-950 dark:text-white">
                    <Link
                      href={`/admin/companies/${brand.companyId}`}
                      className="hover:underline hover:text-zinc-900 dark:hover:text-zinc-300"
                    >
                      {brand.name}
                    </Link>
                  </td>

                  {/* Company Name */}
                  <td className="px-6 py-3.5 text-zinc-700 dark:text-zinc-300">
                    <Link
                      href={`/admin/companies/${brand.companyId}`}
                      className="hover:underline text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                    >
                      {brand.companyName}
                    </Link>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-3.5 text-center">
                    {brand.isActive ? (
                      <span className="inline-block rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-705 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/50">
                        사용 중
                      </span>
                    ) : (
                      <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                        사용 중단
                      </span>
                    )}
                  </td>

                  {/* KR Trademark */}
                  <td className="px-6 py-3.5 text-center">
                    {brand.hasKr ? (
                      <span className="inline-block rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-705 dark:bg-emerald-950/40 dark:text-emerald-300">
                        보유
                      </span>
                    ) : (
                      <span className="inline-block rounded bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-400 dark:bg-zinc-850 dark:text-zinc-600">
                        미보유
                      </span>
                    )}
                  </td>

                  {/* US Trademark */}
                  <td className="px-6 py-3.5 text-center">
                    {brand.hasUs ? (
                      <span className="inline-block rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-705 dark:bg-emerald-950/40 dark:text-emerald-300">
                        보유
                      </span>
                    ) : (
                      <span className="inline-block rounded bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-400 dark:bg-zinc-850 dark:text-zinc-600">
                        미보유
                      </span>
                    )}
                  </td>

                  {/* Product Count (Clickable to /admin/products?search=BrandName) */}
                  <td className="px-6 py-3.5 text-center font-mono">
                    <Link
                      href={`/admin/products?search=${encodeURIComponent(brand.name)}`}
                      className={`inline-block rounded-md px-2.5 py-0.5 text-xs font-bold transition-colors ${
                        brand.productCount > 0
                          ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50 border border-indigo-200/70 dark:border-indigo-800/60"
                          : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      }`}
                      title={`${brand.name} 제품 카탈로그 목록 조회`}
                    >
                      {brand.productCount}개
                    </Link>
                  </td>

                  {/* Last Updated */}
                  <td className="px-6 py-3.5 text-zinc-400">
                    {brand.lastUpdated}
                  </td>

                  {/* Management Action */}
                  <td className="px-6 py-3.5 text-right font-semibold text-zinc-900 dark:text-white">
                    <Link
                      href={`/admin/companies/${brand.companyId}`}
                      className="hover:underline"
                    >
                      상세보기
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredBrands.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="py-12 text-center text-sm text-zinc-400"
                  >
                    일치하는 브랜드 정보가 존재하지 않습니다.
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
