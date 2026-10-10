"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { RetailerProductCard } from "./product-card";
import { RetailerProductSummary } from "@/lib/retailer/products";
import {
  type RetailerCollection,
  createRetailerCollection,
  renameRetailerCollection,
  deleteRetailerCollection,
} from "@/lib/retailer/saved-products";
import { useTranslation } from "@/lib/i18n";
import { GridDensity } from "./product-filter-bar";

interface SavedProductsViewProps {
  products: RetailerProductSummary[];
  collections: RetailerCollection[];
  savedProductIds: string[];
  productCollectionsMap: Record<string, string[]>;
}

export function SavedProductsView({
  products: initialProducts,
  collections: initialCollections,
  savedProductIds: initialSavedIds,
  productCollectionsMap: initialMap,
}: SavedProductsViewProps) {
  const { t, locale } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const [products, setProducts] = useState(initialProducts);
  const [collections, setCollections] = useState(initialCollections);
  const [savedIds, setSavedIds] = useState(initialSavedIds);
  const [collectionsMap, setCollectionsMap] = useState(initialMap);

  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [density, setDensity] = useState<GridDensity>(4);

  // Modals / Dialogs for Collection Management
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDesc, setNewCollectionDesc] = useState("");

  const [editingCollection, setEditingCollection] = useState<RetailerCollection | null>(null);
  const [editName, setEditName] = useState("");

  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filter products by collection & search
  const filteredProducts = products.filter((p) => {
    // 1. Must be in savedIds
    if (!savedIds.includes(p.id)) return false;

    // 2. Collection filter
    if (selectedCollectionId !== "all") {
      const pCols = collectionsMap[p.id] || [];
      if (selectedCollectionId === "default") {
        if (!pCols.includes("default") && pCols.length > 0) return false;
      } else {
        if (!pCols.includes(selectedCollectionId)) return false;
      }
    }

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (p.nameEn || p.name).toLowerCase().includes(q);
      const matchBrand = p.brandName.toLowerCase().includes(q);
      const matchSku = p.sku.toLowerCase().includes(q);
      const matchCat = p.categoryLabel.toLowerCase().includes(q);
      if (!matchName && !matchBrand && !matchSku && !matchCat) return false;
    }

    return true;
  });

  const handleSaveToggle = (productId: string, isSaved: boolean, colIds: string[]) => {
    if (isSaved) {
      if (!savedIds.includes(productId)) {
        setSavedIds([...savedIds, productId]);
      }
      setCollectionsMap((prev) => ({ ...prev, [productId]: colIds }));
    } else {
      setSavedIds(savedIds.filter((id) => id !== productId));
      setCollectionsMap((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;

    setActionError(null);
    const res = await createRetailerCollection(newCollectionName.trim(), newCollectionDesc.trim());
    if (res.success && res.collection) {
      setCollections([...collections, res.collection]);
      setSelectedCollectionId(res.collection.id);
      setNewCollectionName("");
      setNewCollectionDesc("");
      setIsCreateModalOpen(false);
    } else {
      setActionError(res.error || "Failed to create collection");
    }
  };

  const handleRenameCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollection || !editName.trim()) return;

    setActionError(null);
    const res = await renameRetailerCollection(editingCollection.id, editName.trim());
    if (res.success) {
      setCollections(
        collections.map((c) =>
          c.id === editingCollection.id ? { ...c, name: editName.trim() } : c
        )
      );
      setEditingCollection(null);
      setEditName("");
    } else {
      setActionError(res.error || "Failed to rename collection");
    }
  };

  const handleDeleteCollection = async (colId: string) => {
    if (!confirm(locale === "ko" ? "이 컬렉션을 삭제하시겠습니까?" : "Delete this collection?")) return;

    setActionError(null);
    const res = await deleteRetailerCollection(colId);
    if (res.success) {
      setCollections(collections.filter((c) => c.id !== colId));
      if (selectedCollectionId === colId) {
        setSelectedCollectionId("all");
      }
    } else {
      setActionError(res.error || "Failed to delete collection");
    }
  };

  const activeCollectionObj = collections.find((c) => c.id === selectedCollectionId);

  return (
    <div className="space-y-4">
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {locale === "ko" ? "관심 상품 및 컬렉션" : "Saved Products & Collections"}
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
              ❤️ {savedIds.length} {locale === "ko" ? "개 저장됨" : "Saved"}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {locale === "ko"
              ? "저장한 관심 상품을 폴더별로 관리하고 바로 발주 수량을 담을 수 있습니다."
              : "Organize saved products across custom collections and quick add to cart."}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/retailer/products"
            className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <span>🔍</span>
            <span>{locale === "ko" ? "전체 상품 탐색" : "Browse All Products"}</span>
          </Link>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
          >
            <span>+</span>
            <span>{locale === "ko" ? "새 컬렉션 만들기" : "New Collection"}</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs">
          {actionError}
        </div>
      )}

      {/* 2. Collection Filter Tabs Bar */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 no-scrollbar border-b border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-1.5 shrink-0">
          {/* All Saved */}
          <button
            type="button"
            onClick={() => setSelectedCollectionId("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedCollectionId === "all"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            {locale === "ko" ? "전체 저장 상품" : "All Saved"} ({savedIds.length})
          </button>

          {/* Default Favorites */}
          <button
            type="button"
            onClick={() => setSelectedCollectionId("default")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              selectedCollectionId === "default"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            <span>⭐</span>
            <span>{locale === "ko" ? "기본 관심 상품" : "My Favorites"}</span>
          </button>

          {/* User Custom Collections */}
          {collections.map((col) => {
            const isSelected = selectedCollectionId === col.id;
            return (
              <div key={col.id} className="relative group/pill flex items-center">
                <button
                  type="button"
                  onClick={() => setSelectedCollectionId(col.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                >
                  <span>📁</span>
                  <span>{col.name}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Collection Actions (Rename/Delete for active custom collection) */}
        {activeCollectionObj && (
          <div className="flex items-center gap-1.5 shrink-0 pl-2">
            <button
              type="button"
              onClick={() => {
                setEditingCollection(activeCollectionObj);
                setEditName(activeCollectionObj.name);
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium transition-colors"
              title={locale === "ko" ? "컬렉션 이름 변경" : "Rename Collection"}
            >
              ✏️
            </button>
            <button
              type="button"
              onClick={() => handleDeleteCollection(activeCollectionObj.id)}
              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950 text-xs font-medium transition-colors"
              title={locale === "ko" ? "컬렉션 삭제" : "Delete Collection"}
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      {/* 3. Search & Grid Density Toolbar */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={locale === "ko" ? "저장한 상품 검색 (이름, SKU, 브랜드)..." : "Search saved products (name, SKU, brand)..."}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-indigo-500"
          />
          <svg
            className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>

        <div className="text-xs text-zinc-500 font-medium">
          {filteredProducts.length} {locale === "ko" ? "개 상품" : "items"}
        </div>
      </div>

      {/* 4. Products Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
          {filteredProducts.map((product) => (
            <RetailerProductCard
              key={product.id}
              product={product}
              isSaved={savedIds.includes(product.id)}
              savedCollectionIds={collectionsMap[product.id] || []}
              allCollections={collections}
              onSaveToggle={handleSaveToggle}
              onCollectionsUpdated={setCollections}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-3xl mx-auto">
            ❤️
          </div>
          <div className="max-w-sm mx-auto space-y-1">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              {locale === "ko" ? "저장된 상품이 없습니다" : "No saved products yet"}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {locale === "ko"
                ? "상품 카드의 하트(❤️) 버튼을 눌러 관심 상품이나 컬렉션에 추가해보세요."
                : "Click the heart icon on any product card in discovery to save products to your collections."}
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/retailer/products"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity"
            >
              {locale === "ko" ? "상품 둘러보기" : "Explore Products"}
            </Link>
          </div>
        </div>
      )}

      {/* Modal: Create Collection */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-2xl text-white space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                {locale === "ko" ? "새 컬렉션 만들기" : "Create New Collection"}
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCollection} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  {locale === "ko" ? "컬렉션 이름" : "Collection Name"}
                </label>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder={locale === "ko" ? "예: 2026 가을 신상 기획" : "e.g. Fall 2026 Selection"}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  {locale === "ko" ? "설명 (선택)" : "Description (Optional)"}
                </label>
                <input
                  type="text"
                  value={newCollectionDesc}
                  onChange={(e) => setNewCollectionDesc(e.target.value)}
                  placeholder={locale === "ko" ? "컬렉션 메모" : "Notes or purpose"}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs font-medium text-zinc-400 hover:text-white"
                >
                  {locale === "ko" ? "취소" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={!newCollectionName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  {locale === "ko" ? "생성" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Rename Collection */}
      {editingCollection && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setEditingCollection(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-2xl text-white space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                {locale === "ko" ? "컬렉션 이름 변경" : "Rename Collection"}
              </h3>
              <button
                type="button"
                onClick={() => setEditingCollection(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRenameCollection} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  {locale === "ko" ? "새 컬렉션 이름" : "New Collection Name"}
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCollection(null)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs font-medium text-zinc-400 hover:text-white"
                >
                  {locale === "ko" ? "취소" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={!editName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  {locale === "ko" ? "변경 완료" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
