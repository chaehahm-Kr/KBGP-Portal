"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PRODUCT_CATEGORY_LABEL, type ProductCategory } from "@/lib/product/types";
import { deleteProduct } from "@/lib/product/actions";
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
  } | null;
}

interface PortalProductsListProps {
  initialProducts: PortalProductItem[];
  hasBrand: boolean;
}

export function PortalProductsList({ initialProducts, hasBrand }: PortalProductsListProps) {
  const [products, setProducts] = useState<PortalProductItem[]>(initialProducts);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("active_draft"); // 디폴트 값: 활성/보완 대기

  // Delete modal & Toast states
  const [deletingProduct, setDeletingProduct] = useState<PortalProductItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  React.useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const openDeleteModal = (product: PortalProductItem) => {
    setDeletingProduct(product);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await deleteProduct(deletingProduct.id);
      if (res.success) {
        const now = new Date().toISOString();
        setProducts((prev) =>
          prev.map((p) =>
            p.id === deletingProduct.id
              ? { ...p, deleted_at: now, is_draft: false, selection_status: "NOT_SELECTED", sales_status: "ENDED" }
              : p
          )
        );
        setDeletingProduct(null);
        setToastMessage("제품이 삭제되었습니다.");
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setDeleteError(res.error || "제품 삭제에 실패했습니다.");
      }
    } catch (err: any) {
      setDeleteError(err.message || "제품을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsDeleting(false);
    }
  };

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

        {/* Quick Filter Info */}
        <div className="text-[10px] text-zinc-500 dark:text-zinc-500 flex justify-between items-center">
          <span>검색 결과: <strong className="text-zinc-800 dark:text-zinc-200 font-bold">{filteredProducts.length}</strong> 건</span>
          {(searchTerm || selectedCategory !== "all" || selectedStatus !== "active_draft") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
                setSelectedStatus("active_draft");
              }}
              className="text-indigo-650 hover:underline dark:text-indigo-400 font-semibold"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* Table Container Card */}
      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-500 font-bold dark:border-zinc-800 dark:bg-zinc-900/50">
                <th className="px-4 py-3.5 w-14">사진</th>
                <th className="px-4 py-3.5">Letusto SKU</th>
                <th className="px-4 py-3.5">제조사 SKU</th>
                <th className="px-4 py-3.5">제품명</th>
                <th className="px-4 py-3.5">브랜드</th>
                <th className="px-4 py-3.5">카테고리</th>
                <th className="px-4 py-3.5 whitespace-nowrap">등록 상태</th>
                <th className="px-4 py-3.5 whitespace-nowrap">선정 상태</th>
                <th className="px-4 py-3.5 whitespace-nowrap">판매 상태</th>
                <th className="px-4 py-3.5 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs dark:divide-zinc-800/80">
              {filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/20 transition-colors"
                >
                  {/* Thumbnail */}
                  <td className="px-4 py-4">
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
                  <td className="px-4 py-4 font-mono font-bold text-zinc-950 dark:text-white whitespace-nowrap">
                    {product.letusto_sku || (
                      <span className="text-zinc-350 dark:text-zinc-600 italic font-sans font-normal">지정 대기 중</span>
                    )}
                  </td>

                  {/* Manufacture SKU */}
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300 font-mono font-semibold whitespace-nowrap">
                    {product.manufacture_sku || (
                      <span className="text-zinc-350 dark:text-zinc-500 italic">미입력</span>
                    )}
                  </td>

                  {/* Product Name */}
                  <td className="px-4 py-4 font-bold text-zinc-900 dark:text-white">
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/portal/products/${product.id}`}
                        className="hover:underline hover:text-indigo-650 block text-sm"
                      >
                        {product.display_name}
                      </Link>
                      {product.category_completion?.warningLabel ? (
                        <Link
                          href={`/portal/products/${product.id}?tab=category_attributes${
                            product.category_completion.missingRequiredAttributes?.[0]?.code
                              ? `#attr-${product.category_completion.missingRequiredAttributes[0].code}`
                              : ""
                          }`}
                          className="inline-flex items-center w-fit rounded-md bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 px-2 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-all cursor-pointer shadow-2xs"
                        >
                          ⚠️ {product.category_completion.warningLabel}
                        </Link>
                      ) : !product.category_code ? (
                        <Link
                          href={`/portal/products/${product.id}?tab=category_attributes`}
                          className="inline-flex items-center w-fit rounded-md bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 px-2 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-all cursor-pointer shadow-2xs"
                        >
                          ⚠️ 카테고리 설정 필요
                        </Link>
                      ) : null}
                    </div>
                  </td>

                  {/* Brand */}
                  <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300 font-medium whitespace-nowrap">
                    {product.brandName}
                  </td>

                  {/* Category */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      {PRODUCT_CATEGORY_LABEL[product.category as ProductCategory] || product.category}
                    </span>
                  </td>

                  {/* 1. Registration Status Badge */}
                  <td className="px-4 py-4">
                    {product.deleted_at ? (
                      <span className="inline-flex items-center rounded bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 px-2 py-0.5 text-[10px] font-bold border border-zinc-200 dark:border-zinc-700 whitespace-nowrap">
                        Deleted (삭제됨)
                      </span>
                    ) : product.is_draft ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center rounded bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 px-2 py-0.5 text-[10px] font-bold border border-rose-200 dark:border-rose-900/50 whitespace-nowrap">
                          Draft (보완 대기)
                        </span>
                        {product.missing_fields && product.missing_fields.length > 0 && (
                          <div className="text-[9px] text-rose-600 dark:text-rose-400 leading-tight max-w-[140px]">
                            <span className="font-semibold block">* 누락 항목:</span>
                            <span className="block">{product.missing_fields.join(", ")}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-200 dark:border-emerald-900/50 whitespace-nowrap">
                        등록 완료
                      </span>
                    )}
                  </td>

                  {/* 2. Selection Status Badge (Read Only) */}
                  <td className="px-4 py-4 whitespace-nowrap">
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
                          className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${style.bg} ${style.text} ${style.border}`}
                          title="어드민 검토 상태"
                        >
                          {label}
                        </span>
                      );
                    })()}
                  </td>

                  {/* 3. Sales Status Badge (Read Only) */}
                  <td className="px-4 py-4 whitespace-nowrap">
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
                          className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${style.bg} ${style.text} ${style.border}`}
                          title="어드민 판매 운영 상태"
                        >
                          {label}
                        </span>
                      );
                    })()}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4 text-right whitespace-nowrap">
                    <div className="flex justify-end items-center gap-1.5">
                      <Link
                        href={`/portal/products/${product.id}`}
                        className="rounded bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1.5 font-bold text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700 hover:underline transition-all whitespace-nowrap shrink-0 inline-flex items-center text-[11px]"
                      >
                        수정/상세
                      </Link>
                      {!product.deleted_at && (
                        <button
                          type="button"
                          onClick={() => openDeleteModal(product)}
                          className="rounded bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-455 dark:hover:bg-rose-900/30 px-2.5 py-1.5 font-bold transition-all cursor-pointer border border-rose-100 dark:border-rose-900/50 whitespace-nowrap shrink-0 inline-flex items-center text-[11px]"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredProducts.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
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

      {/* Safe Soft-Delete Confirmation Modal */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                <span className="text-lg">⚠️</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  제품을 삭제하시겠습니까?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  안전한 데이터 보존을 위해 비활성화(Soft Delete) 처리됩니다.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-zinc-50 p-3.5 border border-zinc-200/80 dark:bg-zinc-950/60 dark:border-zinc-800">
              <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                {deletingProduct.display_name}
              </div>
              <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                {deletingProduct.letusto_sku && (
                  <span>Letusto: {deletingProduct.letusto_sku}</span>
                )}
                {deletingProduct.manufacture_sku && (
                  <span>제조사: {deletingProduct.manufacture_sku}</span>
                )}
              </div>
            </div>

            {deleteError && (
              <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                {deleteError}
              </div>
            )}

            <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
              삭제된 제품은 활성 목록에서 제외되며, &apos;삭제됨&apos; 필터에서 조회할 수 있습니다.
            </p>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeletingProduct(null);
                  setDeleteError(null);
                }}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              >
                {isDeleting ? "삭제 처리 중..." : "제품 삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

