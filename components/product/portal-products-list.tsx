"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PRODUCT_CATEGORY_LABEL, type ProductCategory } from "@/lib/product/types";
import { bulkDeleteProducts } from "@/lib/product/actions";
import { useSearchParams } from "next/navigation";
import {
  SELECTION_STATUS_LABELS,
  SELECTION_STATUS_STYLES,
  SALES_STATUS_LABELS,
  SALES_STATUS_STYLES,
  type SelectionStatus,
  type SalesStatus,
} from "@/lib/product/registration-status";

interface PortalProductItem {
  id: string;
  name: string;
  display_name: string;
  letusto_sku: string | null;
  manufacture_sku: string | null;
  category: string;
  brand_id: string;
  brandName: string;
  photoUrl: string | null;
  is_draft: boolean;
  missing_fields?: string[];
  selection_status?: SelectionStatus | string;
  sales_status?: SalesStatus | string;
  deleted_at: string | null;
  category_code?: string | null;
  category_completion?: {
    categoryComplete: boolean;
    requiredAttributesComplete: boolean;
    missingRequiredAttributes?: { code: string; nameKo: string }[];
    missingCount?: number;
    status: string;
    warningLabel: string | null;
    warningType: string;
    totalRequiredCount?: number;
    filledRequiredCount?: number;
    completionPercent?: number;
  } | null;
}

interface PortalProductsListProps {
  initialProducts: PortalProductItem[];
  hasBrand: boolean;
}

export function PortalProductsList({ initialProducts, hasBrand }: PortalProductsListProps) {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<PortalProductItem[]>(initialProducts);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("active_draft"); // 디폴트: 활성/보완 대기

  // Selection & Bulk Delete state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (searchParams.get("saved") === "draft") {
      setToastMessage("임시 저장되었습니다. 나중에 이어서 등록할 수 있습니다.");
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  React.useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const filteredProducts = products.filter((product) => {
    // 1. Search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      product.display_name.toLowerCase().includes(searchLower) ||
      (product.manufacture_sku || "").toLowerCase().includes(searchLower) ||
      (product.letusto_sku || "").toLowerCase().includes(searchLower) ||
      product.brandName.toLowerCase().includes(searchLower);

    // 2. Category filter
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;

    // 3. Status filter (Active vs Draft vs Deleted vs Active+Draft)
    const matchesStatus = (() => {
      if (selectedStatus === "active_draft") {
        return !product.deleted_at; // 삭제되지 않은 활성 + 보완대기 전체
      }
      if (selectedStatus === "active") {
        return !product.deleted_at && !product.is_draft;
      }
      if (selectedStatus === "draft") {
        return !product.deleted_at && product.is_draft;
      }
      if (selectedStatus === "deleted") {
        return !!product.deleted_at;
      }
      if (selectedStatus === "all") {
        return true; // 전체 (삭제 포함)
      }
      return true;
    })();

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Selectable products (non-deleted products in the current filtered view)
  const selectableProducts = filteredProducts.filter((p) => !p.deleted_at);
  const selectableIds = selectableProducts.map((p) => p.id);

  const isAllSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));
  const isSomeSelected =
    selectableIds.some((id) => selectedIds.includes(id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all currently visible selectable items
      setSelectedIds((prev) => prev.filter((id) => !selectableIds.includes(id)));
    } else {
      // Select all currently visible selectable items
      setSelectedIds((prev) => Array.from(new Set([...prev, ...selectableIds])));
    }
  };

  const handleToggleSelect = (productId: string) => {
    setSelectedIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    setBulkDeleteError(null);

    try {
      const res = await bulkDeleteProducts(selectedIds);
      if (res.success) {
        const now = new Date().toISOString();
        const deletedSet = new Set(selectedIds);
        setProducts((prev) =>
          prev.map((p) =>
            deletedSet.has(p.id)
              ? {
                  ...p,
                  deleted_at: now,
                  is_draft: false,
                  selection_status: "NOT_SELECTED",
                  sales_status: "ENDED",
                }
              : p
          )
        );
        const count = res.deletedCount ?? selectedIds.length;
        setSelectedIds([]);
        setIsBulkDeleteModalOpen(false);
        setToastMessage(`${count}개의 제품이 삭제(비활성화)되었습니다.`);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setBulkDeleteError(res.error || "제품 삭제 처리에 실패했습니다.");
      }
    } catch (err: any) {
      setBulkDeleteError(err.message || "제품 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const selectedProductList = products.filter((p) => selectedIds.includes(p.id));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">제품 관리</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            입점 신청서에 등록할 제품군 카탈로그를 관리합니다.
          </p>
        </div>
        {hasBrand ? (
          <Link
            href="/portal/products/new"
            className="w-full sm:w-auto text-center rounded-md bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
          >
            새 제품 추가
          </Link>
        ) : (
          <Link
            href="/portal/brands/new"
            className="text-xs font-semibold text-amber-600 hover:text-amber-700 underline underline-offset-2"
          >
            ⚠️ 새 제품 추가를 위해 먼저 브랜드를 등록해주세요.
          </Link>
        )}
      </div>

      {/* Filter and Search Bar Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 dark:text-zinc-500">
              🔍
            </span>
            <input
              type="text"
              placeholder="제품명, Letusto SKU, 제조사 SKU, 브랜드명 등으로 검색..."
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
              className="w-full rounded-lg border border-zinc-200 p-2.5 text-xs outline-none bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-all"
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

        {/* Exposed Status Tab Filters */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-150 pt-4 dark:border-zinc-800">
          <span className="text-xs font-bold text-zinc-500 mr-2">등록 상태 필터:</span>
          {[
            { id: "active_draft", label: "활성/보완 대기 (기본)" },
            { id: "active", label: "등록 완료" },
            { id: "draft", label: "보완 대기 (Draft)" },
            { id: "deleted", label: "삭제됨" },
            { id: "all", label: "전체" },
          ].map((tab) => {
            const isActive = selectedStatus === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedStatus(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  isActive
                    ? "bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white shadow-sm"
                    : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-850 dark:hover:bg-zinc-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Bulk Action & Results Info Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-850">
          <div className="flex items-center gap-3">
            {selectedIds.length > 0 ? (
              <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-lg border border-indigo-200 dark:border-indigo-900/60 text-xs font-bold">
                <span>✓ {selectedIds.length}개 선택됨</span>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline ml-1 cursor-pointer"
                >
                  선택 해제
                </button>
              </div>
            ) : (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                검색 결과: <strong className="text-zinc-800 dark:text-zinc-200 font-bold">{filteredProducts.length}</strong> 건
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => {
                setBulkDeleteError(null);
                setIsBulkDeleteModalOpen(true);
              }}
              className="rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-900/50 px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-rose-200 dark:border-rose-900/60 cursor-pointer flex items-center gap-1.5"
            >
              <span>🗑️</span>
              <span>선택 삭제 {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}</span>
            </button>
            {(searchTerm || selectedCategory !== "all" || selectedStatus !== "active_draft") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("all");
                  setSelectedStatus("active_draft");
                }}
                className="text-indigo-650 hover:underline dark:text-indigo-400 font-semibold text-xs ml-2 cursor-pointer"
              >
                필터 초기화
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Container Card */}
      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/60 text-zinc-600 font-bold dark:border-zinc-800 dark:bg-zinc-900/60">
                {/* Checkbox Header */}
                <th className="w-10 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={handleToggleSelectAll}
                    disabled={selectableIds.length === 0}
                    className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 cursor-pointer disabled:opacity-30 align-middle"
                    aria-label="전체 제품 선택"
                  />
                </th>
                <th className="px-2 py-3 w-12 text-center whitespace-nowrap">사진</th>
                <th className="px-2.5 py-3 whitespace-nowrap">Letusto SKU</th>
                <th className="px-2.5 py-3 whitespace-nowrap">제조사 SKU</th>
                <th className="px-3.5 py-3 min-w-[240px]">제품명</th>
                <th className="px-2.5 py-3 whitespace-nowrap max-w-[100px]">브랜드</th>
                <th className="px-3 py-3 min-w-[140px] max-w-[180px]">카테고리 / 속성</th>
                <th className="px-2.5 py-3 min-w-[110px] max-w-[150px]">등록 상태</th>
                <th className="px-2 py-3 whitespace-nowrap text-center">선정 상태</th>
                <th className="px-2 py-3 whitespace-nowrap text-center">판매 상태</th>
                <th className="px-3 py-3 text-right whitespace-nowrap w-24">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs dark:divide-zinc-800/80">
              {filteredProducts.map((product) => {
                const isSelected = selectedIds.includes(product.id);
                const categoryLabel =
                  PRODUCT_CATEGORY_LABEL[product.category as ProductCategory] || product.category || "-";

                return (
                  <tr
                    key={product.id}
                    className={`transition-colors ${
                      isSelected
                        ? "bg-indigo-50/40 dark:bg-indigo-950/20"
                        : "hover:bg-zinc-50/50 dark:hover:bg-zinc-850/20"
                    }`}
                  >
                    {/* Row Checkbox */}
                    <td className="w-10 px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(product.id)}
                        disabled={!!product.deleted_at}
                        className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 cursor-pointer disabled:opacity-20 align-middle"
                        aria-label={`${product.display_name} 선택`}
                      />
                    </td>

                    {/* Thumbnail */}
                    <td className="px-2 py-3 text-center">
                      {product.photoUrl ? (
                        <div className="h-10 w-10 mx-auto rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center p-0.5 shadow-sm overflow-hidden">
                          <img
                            src={product.photoUrl}
                            alt={product.display_name}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 mx-auto rounded-md bg-zinc-100 flex items-center justify-center text-zinc-400 dark:bg-zinc-800 text-[9px] font-bold border border-dashed border-zinc-200 dark:border-zinc-700">
                          No Pic
                        </div>
                      )}
                    </td>

                    {/* Letusto SKU */}
                    <td className="px-2.5 py-3 font-mono font-bold text-[11px] text-zinc-950 dark:text-white whitespace-nowrap">
                      {product.letusto_sku || (
                        <span className="text-zinc-350 dark:text-zinc-600 italic font-sans font-normal text-[10px]">지정 대기 중</span>
                      )}
                    </td>

                    {/* Manufacture SKU */}
                    <td className="px-2.5 py-3 text-zinc-700 dark:text-zinc-300 font-mono font-semibold text-[11px] whitespace-nowrap">
                      {product.manufacture_sku || (
                        <span className="text-zinc-350 dark:text-zinc-500 italic text-[10px]">미입력</span>
                      )}
                    </td>

                    {/* Product Name (Priority Expanded Column) */}
                    <td className="px-3.5 py-3 font-bold text-zinc-900 dark:text-white min-w-[240px]">
                      <Link
                        href={`/portal/products/${product.id}`}
                        className="hover:underline hover:text-indigo-650 dark:hover:text-indigo-400 block text-xs md:text-sm font-bold leading-snug line-clamp-2"
                        title={product.display_name}
                      >
                        {product.display_name}
                      </Link>
                    </td>

                    {/* Brand */}
                    <td className="px-2.5 py-3 text-zinc-600 dark:text-zinc-300 font-medium text-xs whitespace-nowrap max-w-[100px] truncate" title={product.brandName}>
                      {product.brandName}
                    </td>

                    {/* Merged Category / Attribute Completion */}
                    <td className="px-3 py-3 min-w-[140px] max-w-[180px]">
                      <div className="space-y-1">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs leading-tight truncate" title={categoryLabel}>
                          {categoryLabel}
                        </div>
                        {product.category_completion ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-14 bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    product.category_completion.completionPercent === 100
                                      ? "bg-emerald-500"
                                      : (product.category_completion.completionPercent ?? 0) >= 50
                                      ? "bg-indigo-500"
                                      : "bg-amber-500"
                                  }`}
                                  style={{ width: `${product.category_completion.completionPercent ?? 0}%` }}
                                />
                              </div>
                              <span className={`text-[10px] font-bold font-mono ${
                                product.category_completion.completionPercent === 100
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : "text-zinc-700 dark:text-zinc-300"
                              }`}>
                                {product.category_completion.completionPercent ?? 0}%
                              </span>
                            </div>
                            {product.category_completion.warningLabel && (
                              <Link
                                href={`/portal/products/${product.id}?tab=category_attributes${
                                  product.category_completion.missingRequiredAttributes?.[0]?.code
                                    ? `#attr-${product.category_completion.missingRequiredAttributes[0].code}`
                                    : ""
                                }`}
                                className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold hover:underline leading-tight block line-clamp-1"
                                title={product.category_completion.warningLabel}
                              >
                                ⚠️ {product.category_completion.warningLabel}
                              </Link>
                            )}
                          </div>
                        ) : (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold leading-tight">
                            ⚠️ 속성 입력 필요
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Registration Status Badge */}
                    <td className="px-2.5 py-3 min-w-[110px] max-w-[150px]">
                      {product.deleted_at ? (
                        <span className="inline-flex items-center rounded bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 px-1.5 py-0.5 text-[10px] font-bold border border-zinc-200 dark:border-zinc-700 whitespace-nowrap">
                          Deleted (삭제됨)
                        </span>
                      ) : product.is_draft ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center rounded bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 px-1.5 py-0.5 text-[10px] font-bold border border-rose-200 dark:border-rose-900/50 whitespace-nowrap">
                            Draft (보완 대기)
                          </span>
                          {product.missing_fields && product.missing_fields.length > 0 && (
                            <div className="text-[9px] text-rose-600 dark:text-rose-400 leading-tight line-clamp-2">
                              <span className="font-semibold">* 누락: </span>
                              <span>{product.missing_fields.join(", ")}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 px-1.5 py-0.5 text-[10px] font-bold border border-emerald-200 dark:border-emerald-900/50 whitespace-nowrap">
                          등록 완료
                        </span>
                      )}
                    </td>

                    {/* Selection Status Badge */}
                    <td className="px-2 py-3 text-center whitespace-nowrap">
                      {(() => {
                        const selKey = (product.selection_status || "UNREVIEWED") as SelectionStatus;
                        const label = SELECTION_STATUS_LABELS[selKey] || product.selection_status;
                        const style = SELECTION_STATUS_STYLES[selKey] || {
                          bg: "bg-zinc-100 dark:bg-zinc-800",
                          text: "text-zinc-700 dark:text-zinc-300",
                          border: "border-zinc-200 dark:border-zinc-700",
                        };
                        return (
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold border ${style.bg} ${style.text} ${style.border}`}
                            title="어드민 검토 상태"
                          >
                            {label}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Sales Status Badge */}
                    <td className="px-2 py-3 text-center whitespace-nowrap">
                      {(() => {
                        const salesKey = (product.sales_status || "PREPARING") as SalesStatus;
                        const label = SALES_STATUS_LABELS[salesKey] || product.sales_status;
                        const style = SALES_STATUS_STYLES[salesKey] || {
                          bg: "bg-zinc-100 dark:bg-zinc-800",
                          text: "text-zinc-700 dark:text-zinc-300",
                          border: "border-zinc-200 dark:border-zinc-700",
                        };
                        return (
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold border ${style.bg} ${style.text} ${style.border}`}
                            title="어드민 판매 운영 상태"
                          >
                            {label}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Actions (수정/상세 only) */}
                    <td className="px-3 py-3 text-right whitespace-nowrap w-24">
                      <Link
                        href={`/portal/products/${product.id}`}
                        className="rounded bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 font-bold text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-all whitespace-nowrap inline-flex items-center text-[11px]"
                      >
                        수정/상세
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

      {/* Top Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-xs font-semibold text-white shadow-xl dark:bg-white dark:text-zinc-900 animate-in fade-in slide-in-from-bottom-2">
          <span>✅</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Custom Bulk Soft-Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 shrink-0">
                <span className="text-lg">⚠️</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  선택한 {selectedIds.length}개 제품을 삭제하시겠습니까?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  안전한 데이터 보존을 위해 비활성화(Soft Delete) 처리됩니다.
                </p>
              </div>
            </div>

            {/* Selected Products Preview Box */}
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 p-2.5 max-h-48 overflow-y-auto divide-y divide-zinc-150 dark:divide-zinc-850 text-xs">
              {selectedProductList.slice(0, 4).map((p) => (
                <div key={p.id} className="py-1.5 px-1.5 flex items-center justify-between gap-2">
                  <span className="font-bold text-zinc-900 dark:text-white truncate max-w-[230px]" title={p.display_name}>
                    {p.display_name}
                  </span>
                  <span className="text-[10px] text-zinc-450 dark:text-zinc-500 font-mono shrink-0">
                    {p.letusto_sku || p.manufacture_sku || "SKU 미지정"}
                  </span>
                </div>
              ))}
              {selectedProductList.length > 4 && (
                <div className="py-2 text-center text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100/50 dark:bg-zinc-900/50 rounded mt-1">
                  ... 외 {selectedProductList.length - 4}개 제품
                </div>
              )}
            </div>

            {bulkDeleteError && (
              <div className="rounded-md bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                {bulkDeleteError}
              </div>
            )}

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              삭제된 제품은 활성 목록에서 제외되며, 상단 &apos;삭제됨&apos; 필터에서 언제든 조회할 수 있습니다.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => {
                  setIsBulkDeleteModalOpen(false);
                  setBulkDeleteError(null);
                }}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleConfirmBulkDelete}
                className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              >
                {isBulkDeleting ? "삭제 처리 중..." : `선택 제품 ${selectedIds.length}개 삭제`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
