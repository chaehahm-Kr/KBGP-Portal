"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PRODUCT_CATEGORY_LABEL, type ProductCategory } from "@/lib/product/types";
import { adminUpdateProductOverrides } from "@/lib/product/admin-actions";

interface AdminProductItem {
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
  is_draft: boolean;
  deleted_at: string | null;
  selection_status: string;
  sales_status: string;
  category_code?: string | null;
}

interface AdminProductsListProps {
  initialProducts: AdminProductItem[];
}

// 6. 권장 배지/드롭다운 색상 맵
const SELECTION_COLORS: Record<string, string> = {
  UNREVIEWED: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  UNDER_REVIEW: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  INFO_REQUESTED: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
  SELECTED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  NOT_SELECTED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50",
};

const SELECTION_LABELS: Record<string, string> = {
  UNREVIEWED: "미검토",
  UNDER_REVIEW: "검토 중",
  INFO_REQUESTED: "정보 요청",
  SELECTED: "선정",
  NOT_SELECTED: "미선정",
};

const SALES_COLORS: Record<string, string> = {
  PREPARING: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  ON_SALE: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  PAUSED: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
  ENDED: "bg-zinc-250 text-zinc-650 border-zinc-300 dark:bg-zinc-950 dark:text-zinc-500 dark:border-zinc-850",
};

const SALES_LABELS: Record<string, string> = {
  PREPARING: "판매 준비",
  ON_SALE: "판매 중",
  PAUSED: "일시 중지",
  ENDED: "판매 종료",
};

export function AdminProductsList({ initialProducts }: AdminProductsListProps) {
  const router = useRouter();
  const [products, setProducts] = useState<AdminProductItem[]>(initialProducts);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  // Sync initialProducts props from server to local state
  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  // Refresh server components to fetch fresh database state on page mount
  useEffect(() => {
    router.refresh();
  }, [router]);

  // 1. 제품 등록 상태 (복수 선택 가능, 디폴트: Active + Draft)
  const [selectedRegStatuses, setSelectedRegStatuses] = useState<string[]>(["active", "draft"]);

  // 2. 제품 선정 상태 필터 (디폴트: All)
  const [selectedSelectionStatus, setSelectedSelectionStatus] = useState<string>("all");

  // 3. 판매 상태 필터 (디폴트: All)
  const [selectedSalesStatus, setSelectedSalesStatus] = useState<string>("all");

  // 복수 선택 토글 핸들러
  const handleRegStatusToggle = (status: string) => {
    if (status === "all") {
      if (selectedRegStatuses.length === 3) {
        setSelectedRegStatuses(["active", "draft"]); // 복원
      } else {
        setSelectedRegStatuses(["active", "draft", "deleted"]); // 전체 켜기
      }
      return;
    }

    setSelectedRegStatuses((prev) => {
      const next = prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status];
      return next.length === 0 ? ["active", "draft"] : next; // 최소 하나 이상은 켜두기 보정
    });
  };

  // 인라인 선정/판매 상태 변경 서버 액션 호출
  const handleInlineStatusChange = async (
    productId: string,
    field: "selection_status" | "sales_status",
    value: string
  ) => {
    const original = products.find((p) => p.id === productId);
    if (!original) return;

    // 만약 판매 상태를 변경하려는데 선정되지 않은 상태라면 가드 작동
    if (field === "sales_status" && original.selection_status !== "SELECTED") {
      alert("선정된 제품만 판매 상태를 변경할 수 있습니다.");
      return;
    }

    // 만약 선정 상태를 'SELECTED' 외의 것으로 변경하면 판매 상태는 자동으로 'PREPARING'으로 초기화 적용
    const nextSelectionStatus = field === "selection_status" ? value : original.selection_status;
    const nextSalesStatus = field === "sales_status"
      ? value
      : nextSelectionStatus !== "SELECTED"
      ? "PREPARING"
      : original.sales_status;

    startTransition(async () => {
      try {
        const payload: Record<string, any> = {
          selection_status: nextSelectionStatus,
          sales_status: nextSalesStatus,
        };

        await adminUpdateProductOverrides(productId, payload);

        // 로컬 상태 즉각 동기화 반영
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId
              ? { ...p, selection_status: nextSelectionStatus, sales_status: nextSalesStatus }
              : p
          )
        );
      } catch (err: any) {
        alert(err.message || "상태 변경 실패");
      }
    });
  };

  const filteredProducts = products.filter((product) => {
    // 1. Search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      product.display_name.toLowerCase().includes(searchLower) ||
      (product.display_manufacture_sku || "").toLowerCase().includes(searchLower) ||
      (product.letusto_sku || "").toLowerCase().includes(searchLower) ||
      (product.parent_sku || "").toLowerCase().includes(searchLower) ||
      (product.child_sku || "").toLowerCase().includes(searchLower) ||
      product.companyName.toLowerCase().includes(searchLower) ||
      product.brandName.toLowerCase().includes(searchLower);

    // 2. Category filter
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;

    // 3. 제품 등록 상태 복수 선택 필터링
    const matchesRegStatus = (() => {
      if (selectedRegStatuses.includes("active") && !product.deleted_at && !product.is_draft) return true;
      if (selectedRegStatuses.includes("draft") && !product.deleted_at && product.is_draft) return true;
      if (selectedRegStatuses.includes("deleted") && product.deleted_at) return true;
      return false;
    })();

    // 4. 제품 선정 상태 필터링
    const matchesSelectionStatus =
      selectedSelectionStatus === "all" || product.selection_status === selectedSelectionStatus;

    // 5. 판매 상태 필터링
    const matchesSalesStatus =
      selectedSalesStatus === "all" || product.sales_status === selectedSalesStatus;

    return matchesSearch && matchesCategory && matchesRegStatus && matchesSelectionStatus && matchesSalesStatus;
  });

  return (
    <div className="space-y-6 w-full text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">제품 통합 관리</h1>
          <p className="text-xs text-zinc-550 dark:text-zinc-400">
            모든 브랜드사에서 포털에 등록한 제품 카탈로그 및 선정 상태와 판매 상태를 모니터링하고 제어합니다.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-5">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 dark:text-zinc-550">
              🔍
            </span>
            <input
              type="text"
              placeholder="제품명, 제조사 SKU, 회사명, 브랜드명 등으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 py-2.5 pl-10 pr-4 text-xs outline-none bg-zinc-50/50 focus:border-zinc-950 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-white dark:focus:bg-zinc-900 transition-all"
            />
          </div>

          {/* Category Dropdown */}
          <div className="w-full md:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2.5 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-all"
            >
              <option value="all">모든 카테고리</option>
              <option value="skincare">스킨케어</option>
              <option value="hair_scalp">헤어/두피</option>
              <option value="beauty_tools">뷰티 툴</option>
              <option value="daily_care">데일리 케어</option>
              <option value="wellness_patch">웰니스 패치</option>
            </select>
          </div>
        </div>

        {/* 4. Overhauled Filters Grid (3 Columns) */}
        <div className="border-t border-zinc-150 pt-4 dark:border-zinc-850 grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* ① 제품 등록 상태 필터 */}
          <div className="flex flex-col gap-2 text-xs">
            <span className="font-bold text-zinc-400 dark:text-zinc-500">제품 등록 상태</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleRegStatusToggle("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  selectedRegStatuses.length === 3
                    ? "bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950"
                    : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-850"
                }`}
              >
                All
              </button>
              {[
                { id: "active", label: "Active" },
                { id: "draft", label: "Draft" },
                { id: "deleted", label: "Deleted" },
              ].map((tab) => {
                const isSelected = selectedRegStatuses.includes(tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleRegStatusToggle(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 ${
                      isSelected
                        ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-850"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="mr-1 h-3 w-3 accent-zinc-950 pointer-events-none rounded border-zinc-300"
                    />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ② 제품 선정 상태 필터 */}
          <div className="flex flex-col gap-2 text-xs">
            <span className="font-bold text-zinc-400 dark:text-zinc-500">제품 선정 상태</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedSelectionStatus("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  selectedSelectionStatus === "all"
                    ? "bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950"
                    : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-850"
                }`}
              >
                All
              </button>
              {Object.entries(SELECTION_LABELS).map(([code, label]) => {
                const isSelected = selectedSelectionStatus === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setSelectedSelectionStatus(code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      isSelected
                        ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-850"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ③ 판매 상태 필터 */}
          <div className="flex flex-col gap-2 text-xs">
            <span className="font-bold text-zinc-400 dark:text-zinc-500">판매 상태</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedSalesStatus("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  selectedSalesStatus === "all"
                    ? "bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950"
                    : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-850"
                }`}
              >
                All
              </button>
              {Object.entries(SALES_LABELS).map(([code, label]) => {
                const isSelected = selectedSalesStatus === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setSelectedSalesStatus(code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      isSelected
                        ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-850"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Filter Info */}
        <div className="text-[10px] text-zinc-455 dark:text-zinc-500 flex justify-between items-center pt-2">
          <span>검색 결과: <strong className="text-zinc-800 dark:text-zinc-200 font-bold">{filteredProducts.length}</strong> 건</span>
          {(searchTerm || selectedCategory !== "all" || selectedRegStatuses.length !== 2 || !selectedRegStatuses.includes("active") || !selectedRegStatuses.includes("draft") || selectedSelectionStatus !== "all" || selectedSalesStatus !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
                setSelectedRegStatuses(["active", "draft"]);
                setSelectedSelectionStatus("all");
                setSelectedSalesStatus("all");
              }}
              className="text-zinc-900 hover:underline dark:text-zinc-250 font-semibold"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-500 font-bold dark:border-zinc-800 dark:bg-zinc-900/50">
                <th className="px-6 py-3.5 whitespace-nowrap">사진</th>
                <th className="px-6 py-3.5 whitespace-nowrap">Letusto SKU</th>
                <th className="px-6 py-3.5 whitespace-nowrap">제조사 SKU</th>
                <th className="px-6 py-3.5 whitespace-nowrap">제품명</th>
                <th className="px-6 py-3.5 whitespace-nowrap">회사명</th>
                <th className="px-6 py-3.5 whitespace-nowrap">브랜드</th>
                <th className="px-6 py-3.5 whitespace-nowrap">카테고리</th>
                <th className="px-6 py-3.5 whitespace-nowrap">등록 상태</th>
                <th className="px-6 py-3.5 whitespace-nowrap">선정 상태</th>
                <th className="px-6 py-3.5 whitespace-nowrap">판매 상태</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
              {filteredProducts.map((product) => {
                const isSelected = product.selection_status === "SELECTED";
                return (
                  <tr
                    key={product.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/20 transition-colors"
                  >
                    {/* Photo Column */}
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
                        <span className="text-zinc-350 dark:text-zinc-650 italic font-sans font-normal">지정 대기 중</span>
                      )}
                    </td>

                    {/* Manufacture SKU */}
                    <td className="px-6 py-4 align-middle font-mono font-semibold text-zinc-900 dark:text-white whitespace-nowrap">
                      {product.display_manufacture_sku || (
                        <span className="text-zinc-350 dark:text-zinc-650 italic">미입력</span>
                      )}
                    </td>

                    {/* Product Name */}
                    <td className="px-6 py-4 align-middle font-bold text-zinc-900 dark:text-white min-w-[200px]">
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="hover:text-zinc-950 dark:hover:text-white hover:underline transition-all block text-sm"
                        >
                          {product.display_name}
                        </Link>
                        {!product.category_code && !product.category && (
                          <Link
                            href={`/admin/products/${product.id}?tab=category`}
                            className="inline-flex items-center w-fit rounded bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 px-2 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse transition-colors cursor-pointer"
                          >
                            ⚠️ 카테고리 재분류 필요
                          </Link>
                        )}
                      </div>
                    </td>

                    {/* Company Name */}
                    <td className="px-6 py-4 align-middle text-zinc-600 dark:text-zinc-355 font-medium whitespace-nowrap max-w-[120px] truncate">
                      {product.companyName}
                    </td>

                    {/* Brand Name */}
                    <td className="px-6 py-4 align-middle text-zinc-600 dark:text-zinc-300 font-medium whitespace-nowrap max-w-[120px] truncate">
                      {product.brandName}
                    </td>

                    {/* Category (Redesigned from rounded-full circle to rounded-md card) */}
                    <td className="px-6 py-4 align-middle">
                      <span className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 whitespace-nowrap">
                        {PRODUCT_CATEGORY_LABEL[product.category as ProductCategory] || product.category}
                      </span>
                    </td>

                    {/* ① 제품 등록 상태 배지 */}
                    <td className="px-6 py-4 align-middle">
                      {product.deleted_at ? (
                        <span className="inline-flex items-center rounded bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 px-2 py-0.5 text-[10px] font-bold border border-zinc-200 dark:border-zinc-700 whitespace-nowrap">
                          Deleted (삭제됨)
                        </span>
                      ) : product.is_draft ? (
                        <span className="inline-flex items-center rounded bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold border border-amber-200 dark:border-amber-900/50 whitespace-nowrap">
                          Draft (보완 대기)
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-250 dark:border-emerald-900/50 whitespace-nowrap">
                          Active
                        </span>
                      )}
                    </td>

                    {/* ② 제품 선정 상태 인라인 셀렉터 */}
                    <td className="px-6 py-4 align-middle">
                      <select
                        value={product.selection_status}
                        onChange={(e) => handleInlineStatusChange(product.id, "selection_status", e.target.value)}
                        disabled={isPending}
                        className={`rounded border text-[11px] font-bold px-2 py-1 outline-none transition cursor-pointer select-none whitespace-nowrap ${
                          SELECTION_COLORS[product.selection_status]
                        }`}
                      >
                        {Object.entries(SELECTION_LABELS).map(([code, label]) => (
                          <option key={code} value={code} className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* ③ 제품 판매 상태 인라인 셀렉터 */}
                    <td className="px-6 py-4 align-middle" title={!isSelected ? "선정된 제품만 판매 상태를 변경할 수 있습니다." : undefined}>
                      <select
                        value={product.sales_status}
                        onChange={(e) => handleInlineStatusChange(product.id, "sales_status", e.target.value)}
                        disabled={isPending || !isSelected}
                        className={`rounded border text-[11px] font-bold px-2 py-1 outline-none transition select-none whitespace-nowrap ${
                          !isSelected 
                            ? "bg-zinc-50 text-zinc-350 border-zinc-200 cursor-not-allowed dark:bg-zinc-900 dark:text-zinc-700 dark:border-zinc-800" 
                            : SALES_COLORS[product.sales_status as keyof typeof SALES_COLORS] || "border-zinc-200"
                        }`}
                      >
                        {Object.entries(SALES_LABELS).map(([code, label]) => (
                          <option key={code} value={code} className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Actions (Prevent line wrapping) */}
                    <td className="px-6 py-4 align-middle text-right whitespace-nowrap">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="rounded bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 border border-zinc-900 dark:border-zinc-100 px-3 py-2 font-bold text-xs transition-all"
                      >
                        상세/수정
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-6 py-12 text-center text-zinc-400 dark:text-zinc-500"
                  >
                    일치하는 등록 제품이 존재하지 않습니다.
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
