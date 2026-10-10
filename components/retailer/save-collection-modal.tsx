"use client";

import React, { useState, useEffect } from "react";
import {
  createRetailerCollection,
  setProductCollectionsAction,
  type RetailerCollection,
} from "@/lib/retailer/saved-products";
import { useTranslation } from "@/lib/i18n";

interface SaveCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  brandName?: string;
  thumbnailUrl?: string | null;
  initialCollectionIds?: string[];
  allCollections: RetailerCollection[];
  onCollectionsUpdated?: (allCols: RetailerCollection[]) => void;
  onSaveStateChanged?: (productId: string, isSaved: boolean, collectionIds: string[]) => void;
}

export function SaveCollectionModal({
  isOpen,
  onClose,
  productId,
  productName,
  brandName,
  thumbnailUrl,
  initialCollectionIds = [],
  allCollections,
  onCollectionsUpdated,
  onSaveStateChanged,
}: SaveCollectionModalProps) {
  const { t, locale } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>(initialCollectionIds);
  const [collections, setCollections] = useState<RetailerCollection[]>(allCollections);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedIds(initialCollectionIds);
  }, [initialCollectionIds]);

  useEffect(() => {
    setCollections(allCollections);
  }, [allCollections]);

  if (!isOpen) return null;

  const toggleCollection = (colId: string) => {
    setSelectedIds((prev) =>
      prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]
    );
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim() || isCreating) return;

    setIsCreating(true);
    setError(null);

    const res = await createRetailerCollection(newCollectionName.trim());
    if (res.success && res.collection) {
      const updated = [...collections, res.collection];
      setCollections(updated);
      setSelectedIds((prev) => [...prev, res.collection!.id]);
      setNewCollectionName("");
      if (onCollectionsUpdated) onCollectionsUpdated(updated);
    } else {
      setError(res.error || "Failed to create collection");
    }
    setIsCreating(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    const res = await setProductCollectionsAction(productId, selectedIds);
    if (res.success) {
      const isSaved = selectedIds.length > 0;
      if (onSaveStateChanged) {
        onSaveStateChanged(productId, isSaved, selectedIds);
      }
      onClose();
    } else {
      setError(res.error || "Failed to save collections");
    }
    setIsSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-2xl text-white space-y-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-3">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={productName}
                className="w-12 h-12 rounded-lg object-contain bg-zinc-800 border border-zinc-700/60 p-1 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                📦
              </div>
            )}
            <div className="min-w-0">
              {brandName && (
                <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider truncate">
                  {brandName}
                </div>
              )}
              <h3 className="text-sm font-semibold text-zinc-100 truncate">{productName}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Title */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            {locale === "ko" ? "저장할 컬렉션 선택" : "Save to Collections"}
          </h4>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {locale === "ko"
              ? "상품을 분류할 컬렉션을 선택하거나 새 컬렉션을 만드세요."
              : "Select one or more collections to organize your saved products."}
          </p>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Collection List */}
        <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
          {/* Default My Favorites option */}
          <label
            className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
              selectedIds.includes("default")
                ? "bg-indigo-950/60 border-indigo-500/80 text-white"
                : "bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">⭐</span>
              <span className="text-xs font-semibold">
                {locale === "ko" ? "기본 관심 상품 (My Favorites)" : "My Favorites"}
              </span>
            </div>
            <input
              type="checkbox"
              checked={selectedIds.includes("default")}
              onChange={() => toggleCollection("default")}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-zinc-900 border-zinc-700"
            />
          </label>

          {/* User Custom Collections */}
          {collections.map((col) => {
            const isChecked = selectedIds.includes(col.id);
            return (
              <label
                key={col.id}
                className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                  isChecked
                    ? "bg-indigo-950/60 border-indigo-500/80 text-white"
                    : "bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate pr-2">
                  <span className="text-base">📁</span>
                  <span className="text-xs font-semibold truncate">{col.name}</span>
                </div>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleCollection(col.id)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-zinc-900 border-zinc-700 shrink-0"
                />
              </label>
            );
          })}
        </div>

        {/* Create New Collection Inline Form */}
        <form onSubmit={handleCreateCollection} className="flex gap-2 pt-2 border-t border-zinc-800">
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder={locale === "ko" ? "+ 새 컬렉션 이름 (예: 가을 신상)" : "+ New collection (e.g. Fall 2026)"}
            className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-800/90 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!newCollectionName.trim() || isCreating}
            className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-colors"
          >
            {isCreating ? "..." : locale === "ko" ? "추가" : "Add"}
          </button>
        </form>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
          >
            {locale === "ko" ? "취소" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? "..." : locale === "ko" ? "저장 완료" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
