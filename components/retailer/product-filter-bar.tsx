"use client";

import React, { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import {
  type CategoryHierarchy,
  type CategoryItem,
  getCategoryDisplayName,
} from "@/lib/product/category-taxonomy";

export type GridDensity = 4 | 6 | 8;

interface FilterBarProps {
  categoryHierarchy?: CategoryHierarchy;
  categories: Array<{ code: string; label: string; count: number }>;
  brands: Array<{ id: string; name: string; count: number }>;
  currentSearch?: string;
  currentDepth1?: string;
  currentDepth2?: string;
  currentDepth3?: string;
  currentCategory?: string;
  currentBrandId?: string;
  currentMarginFilter?: string;
  currentPricePreset?: string;
  currentMinPrice?: number;
  currentMaxPrice?: number;
  currentOrderableOnly?: boolean;
  currentSortBy?: string;
  totalCount: number;
  density?: GridDensity;
  onDensityChange?: (density: GridDensity) => void;
}

export function RetailerProductFilterBar({
  categoryHierarchy,
  categories,
  brands,
  currentSearch = "",
  currentDepth1,
  currentDepth2,
  currentDepth3,
  currentCategory = "all",
  currentBrandId = "all",
  currentMarginFilter = "all",
  currentPricePreset = "all",
  currentMinPrice,
  currentMaxPrice,
  currentOrderableOnly = false,
  currentSortBy = "default",
  totalCount,
  density = 4,
  onDensityChange,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { t, locale } = useTranslation();

  // Active depth states
  const activeDepth1 = currentDepth1 || (currentCategory !== "all" ? currentCategory : undefined);
  const activeDepth2 = currentDepth2;
  const activeDepth3 = currentDepth3;

  // Custom price input local state
  const [showCustomPrice, setShowCustomPrice] = useState(
    currentPricePreset === "custom" || Boolean(currentMinPrice) || Boolean(currentMaxPrice)
  );
  const [customMin, setCustomMin] = useState<string>(
    currentMinPrice !== undefined && currentMinPrice > 0 ? String(currentMinPrice) : ""
  );
  const [customMax, setCustomMax] = useState<string>(
    currentMaxPrice !== undefined && currentMaxPrice > 0 ? String(currentMaxPrice) : ""
  );
  const [priceRangeError, setPriceRangeError] = useState<string | null>(null);

  const updateQueryParams = (updates: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === undefined || val === "" || val === "all") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleSearchChange = (term: string) => {
    updateQueryParams({ search: term.trim() || null });
  };

  const handleDepth1Select = (code: string) => {
    if (code === "all" || code === activeDepth1) {
      updateQueryParams({
        depth1: null,
        depth2: null,
        depth3: null,
        category: null,
      });
    } else {
      updateQueryParams({
        depth1: code,
        depth2: null,
        depth3: null,
        category: code,
      });
    }
  };

  const handleDepth2Select = (code: string) => {
    if (code === "all" || code === activeDepth2) {
      updateQueryParams({
        depth2: null,
        depth3: null,
      });
    } else {
      updateQueryParams({
        depth2: code,
        depth3: null,
      });
    }
  };

  const handleDepth3Select = (code: string) => {
    if (code === "all" || code === activeDepth3) {
      updateQueryParams({
        depth3: null,
      });
    } else {
      updateQueryParams({
        depth3: code,
      });
    }
  };

  const handleBrandChange = (brandId: string) => {
    updateQueryParams({ brand: brandId === "all" ? null : brandId });
  };

  const handleSortChange = (sortBy: string) => {
    updateQueryParams({ sort: sortBy === "default" ? null : sortBy });
  };

  const handleMarginChange = (margin: string) => {
    // Re-clicking active margin filter deselects it
    if (margin === currentMarginFilter || margin === "all") {
      updateQueryParams({ margin: null });
    } else {
      updateQueryParams({ margin });
    }
  };

  const handlePricePresetChange = (preset: string) => {
    setPriceRangeError(null);
    // Re-clicking active preset deselects it
    if (preset === currentPricePreset && preset !== "custom") {
      setShowCustomPrice(false);
      setCustomMin("");
      setCustomMax("");
      updateQueryParams({
        price_preset: null,
        min_price: null,
        max_price: null,
      });
      return;
    }

    if (preset === "custom") {
      setShowCustomPrice(true);
      updateQueryParams({ price_preset: "custom" });
    } else {
      setShowCustomPrice(false);
      setCustomMin("");
      setCustomMax("");
      updateQueryParams({
        price_preset: preset === "all" ? null : preset,
        min_price: null,
        max_price: null,
      });
    }
  };

  const handleApplyCustomPrice = () => {
    const min = customMin ? parseFloat(customMin) : undefined;
    const max = customMax ? parseFloat(customMax) : undefined;

    if (min !== undefined && max !== undefined && !isNaN(min) && !isNaN(max) && min > max) {
      setPriceRangeError(t.products.invalidPriceRange);
      return;
    }

    setPriceRangeError(null);
    updateQueryParams({
      price_preset: "custom",
      min_price: min !== undefined && !isNaN(min) && min >= 0 ? String(min) : null,
      max_price: max !== undefined && !isNaN(max) && max >= 0 ? String(max) : null,
    });
  };

  const handleToggleOrderableOnly = () => {
    updateQueryParams({
      orderable_only: currentOrderableOnly ? null : "true",
    });
  };

  const handleResetFilters = () => {
    setShowCustomPrice(false);
    setCustomMin("");
    setCustomMax("");
    setPriceRangeError(null);
    startTransition(() => {
      router.push(pathname);
    });
  };

  // Depth 1 items
  const depth1Items = categoryHierarchy?.depth1 || [];
  const totalCategoryProducts = depth1Items.reduce((acc, cat) => acc + cat.product_count, 0);

  // Depth 2 items for active Depth 1
  const depth2Items =
    activeDepth1 && categoryHierarchy?.depth2ByParent[activeDepth1]
      ? categoryHierarchy.depth2ByParent[activeDepth1]
      : [];

  // Depth 3 items for active Depth 2
  const depth3Items =
    activeDepth2 && categoryHierarchy?.depth3ByParent[activeDepth2]
      ? categoryHierarchy.depth3ByParent[activeDepth2]
      : [];

  const hasActiveFilters =
    Boolean(currentSearch) ||
    Boolean(activeDepth1) ||
    Boolean(activeDepth2) ||
    Boolean(activeDepth3) ||
    (Boolean(currentBrandId) && currentBrandId !== "all") ||
    (Boolean(currentMarginFilter) && currentMarginFilter !== "all") ||
    (Boolean(currentPricePreset) && currentPricePreset !== "all") ||
    Boolean(currentMinPrice) ||
    Boolean(currentMaxPrice) ||
    currentOrderableOnly;

  return (
    <div className="space-y-4">
      {/* 1. Main Search, Brand, and Sort Row */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder={t.products.searchPlaceholder}
            defaultValue={currentSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
          />
        </div>

        {/* Brand Selector */}
        {brands.length > 0 && (
          <div className="w-full md:w-52">
            <select
              value={currentBrandId}
              onChange={(e) => handleBrandChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs cursor-pointer"
            >
              <option value="all">
                {t.products.allBrands} ({brands.reduce((a, b) => a + b.count, 0)})
              </option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.count})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sort Selector */}
        <div className="w-full md:w-48">
          <select
            value={currentSortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs cursor-pointer"
          >
            <option value="default">{t.products.sortBy}: {t.products.sortDefault}</option>
            <option value="margin_desc">{t.products.sortMarginHigh}</option>
            <option value="price_asc">{t.products.sortPriceLow}</option>
            <option value="price_desc">{t.products.sortPriceHigh}</option>
          </select>
        </div>
      </div>

      {/* 2. Category (1-Depth Navigation) - Fixed Title */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
          <span>{t.products.categoryFixedLabel}</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {/* All Button */}
          <button
            type="button"
            onClick={() => handleDepth1Select("all")}
            className={`px-3.5 py-2 rounded-xl font-semibold text-xs whitespace-nowrap transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
              !activeDepth1
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs"
                : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300"
            }`}
          >
            <span>{t.products.allCategories}</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-normal ${
                !activeDepth1
                  ? "bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900"
                  : "bg-zinc-200/80 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
              }`}
            >
              {totalCategoryProducts}
            </span>
          </button>

          {/* Depth 1 Items */}
          {depth1Items.map((cat) => {
            const isSelected = activeDepth1 === cat.code;
            const displayName = getCategoryDisplayName(cat, locale);
            return (
              <button
                key={cat.code}
                type="button"
                onClick={() => handleDepth1Select(cat.code)}
                className={`px-3.5 py-2 rounded-xl font-semibold text-xs whitespace-nowrap transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                  isSelected
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs"
                    : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300"
                }`}
              >
                <span>{displayName}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-normal ${
                    isSelected
                      ? "bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900"
                      : "bg-zinc-200/80 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                  }`}
                >
                  {cat.product_count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Subcategory (2-Depth Navigation) - Fixed Title */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
          <span>{t.products.subcategoryFixedLabel}</span>
        </div>
        {!activeDepth1 ? (
          <div className="py-2 px-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400 dark:text-zinc-500 italic">
            {t.products.selectCategoryPrompt}
          </div>
        ) : depth2Items.length > 0 ? (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => handleDepth2Select("all")}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                !activeDepth2
                  ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 font-semibold"
                  : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {t.common.all}
            </button>
            {depth2Items.map((cat) => {
              const isSelected = activeDepth2 === cat.code;
              const displayName = getCategoryDisplayName(cat, locale);
              return (
                <button
                  key={cat.code}
                  type="button"
                  onClick={() => handleDepth2Select(cat.code)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 font-semibold"
                      : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {displayName} ({cat.product_count})
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* 4. Detail Category (3-Depth Navigation) - Fixed Title */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
          <span>{t.products.detailCategoryFixedLabel}</span>
        </div>
        {!activeDepth2 ? (
          <div className="py-2 px-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400 dark:text-zinc-500 italic">
            {t.products.selectSubcategoryPrompt}
          </div>
        ) : depth3Items.length > 0 ? (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => handleDepth3Select("all")}
              className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors text-[11px] cursor-pointer ${
                !activeDepth3
                  ? "bg-zinc-700 text-white dark:bg-zinc-300 dark:text-zinc-900 font-semibold"
                  : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {t.common.all}
            </button>
            {depth3Items.map((cat) => {
              const isSelected = activeDepth3 === cat.code;
              const displayName = getCategoryDisplayName(cat, locale);
              return (
                <button
                  key={cat.code}
                  type="button"
                  onClick={() => handleDepth3Select(cat.code)}
                  className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors text-[11px] cursor-pointer ${
                    isSelected
                      ? "bg-zinc-700 text-white dark:bg-zinc-300 dark:text-zinc-900 font-semibold"
                      : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {displayName} ({cat.product_count})
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* 5. Commercial Purchasing Filters: Margin, Stock, Price */}
      <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Margin Filter */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
              {t.products.marginFilter}:
            </span>
            <div className="flex items-center gap-1">
              {[
                { key: "all", label: t.products.anyMargin },
                { key: "40", label: "40%+" },
                { key: "50", label: "50%+" },
                { key: "60", label: "60%+" },
              ].map((m) => {
                const isSelected = currentMarginFilter === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => handleMarginChange(m.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-emerald-600 text-white font-semibold shadow-2xs"
                        : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Orderable Stock Only Toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
            <input
              type="checkbox"
              checked={currentOrderableOnly}
              onChange={handleToggleOrderableOnly}
              className="w-4 h-4 text-indigo-600 rounded border-zinc-300 dark:border-zinc-700 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {t.products.orderableStockOnly}
            </span>
          </label>
        </div>

        {/* Price Filter Presets (Under $10, $10-$20, $20-$30, $30-$40, $40-$50, $50+, Custom) */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60 text-xs">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
            {t.products.priceFilter}:
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {[
              { key: "all", label: t.products.anyPrice },
              { key: "under10", label: t.products.under10 },
              { key: "10to20", label: t.products.between10and20 },
              { key: "20to30", label: t.products.between20and30 },
              { key: "30to40", label: t.products.between30and40 },
              { key: "40to50", label: t.products.between40and50 },
              { key: "over50", label: t.products.over50 },
              { key: "custom", label: t.products.customPrice },
            ].map((p) => {
              const isSelected = currentPricePreset === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handlePricePresetChange(p.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-semibold shadow-2xs"
                      : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Custom Price Inputs */}
          {showCustomPrice && (
            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
              <span className="text-zinc-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder={t.products.minPrice}
                value={customMin}
                onChange={(e) => setCustomMin(e.target.value)}
                className="w-16 px-2 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              />
              <span className="text-zinc-400">–</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder={t.products.maxPrice}
                value={customMax}
                onChange={(e) => setCustomMax(e.target.value)}
                className="w-16 px-2 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleApplyCustomPrice}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-2xs cursor-pointer"
              >
                {t.products.apply}
              </button>
            </div>
          )}
        </div>

        {/* Inline price range validation error */}
        {priceRangeError && (
          <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 pt-1">
            ⚠ {priceRangeError}
          </div>
        )}
      </div>

      {/* 6. Results Summary, Active Filters & Products per row Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400 pt-1">
        <div className="flex items-center gap-2">
          <span>
            {locale === "ko" ? (
              <>
                총 <strong className="text-zinc-900 dark:text-white font-semibold">{totalCount}</strong>개의 상품
              </>
            ) : (
              <>
                Showing <strong className="text-zinc-900 dark:text-white font-semibold">{totalCount}</strong> verified {totalCount === 1 ? "product" : "products"}
              </>
            )}
          </span>
          {isPending && (
            <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
              {t.common.loading}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Products per row selector (Grid Density: 4 / 6 / 8) */}
          {onDensityChange && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-[11px]">{t.products.productsPerRow}:</span>
              <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                {([4, 6, 8] as const).map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => onDensityChange(col)}
                    className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      density === col
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    {col}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              {t.products.resetFilters} ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
