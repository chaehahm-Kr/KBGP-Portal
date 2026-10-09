"use client";

import React, { useState, useEffect } from "react";
import { RetailerProductFilterBar, GridDensity } from "./product-filter-bar";
import { RetailerProductCard } from "./product-card";
import { RetailerProductSummary } from "@/lib/retailer/products";
import { CategoryHierarchy } from "@/lib/product/category-taxonomy";
import { useTranslation } from "@/lib/i18n";

const STORAGE_KEY = "kselect_products_per_row";

const GRID_LAYOUT_CLASSES: Record<GridDensity, string> = {
  4: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6",
  6: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4",
  8: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2.5 sm:gap-3",
};

interface DiscoveryContainerProps {
  categoryHierarchy?: CategoryHierarchy;
  categories: Array<{ code: string; label: string; count: number }>;
  brands: Array<{ id: string; name: string; count: number }>;
  products: RetailerProductSummary[];
  totalCount: number;
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
}

export function RetailerDiscoveryContainer({
  categoryHierarchy,
  categories,
  brands,
  products,
  totalCount,
  currentSearch,
  currentDepth1,
  currentDepth2,
  currentDepth3,
  currentCategory,
  currentBrandId,
  currentMarginFilter,
  currentPricePreset,
  currentMinPrice,
  currentMaxPrice,
  currentOrderableOnly,
  currentSortBy,
}: DiscoveryContainerProps) {
  const { t } = useTranslation();
  const [density, setDensity] = useState<GridDensity>(4);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "4" || saved === "6" || saved === "8") {
        setDensity(Number(saved) as GridDensity);
      }
    } catch {
      // ignore storage access restrictions
    }
  }, []);

  const handleDensityChange = (newDensity: GridDensity) => {
    setDensity(newDensity);
    try {
      localStorage.setItem(STORAGE_KEY, String(newDensity));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 w-full max-w-full overflow-hidden">
      {/* Search, Category Navigation, & Purchasing Filters */}
      <RetailerProductFilterBar
        categoryHierarchy={categoryHierarchy}
        categories={categories}
        brands={brands}
        currentSearch={currentSearch}
        currentDepth1={currentDepth1}
        currentDepth2={currentDepth2}
        currentDepth3={currentDepth3}
        currentCategory={currentCategory || "all"}
        currentBrandId={currentBrandId || "all"}
        currentMarginFilter={currentMarginFilter || "all"}
        currentPricePreset={currentPricePreset || "all"}
        currentMinPrice={currentMinPrice}
        currentMaxPrice={currentMaxPrice}
        currentOrderableOnly={currentOrderableOnly}
        currentSortBy={currentSortBy || "default"}
        totalCount={totalCount}
        density={density}
        onDensityChange={handleDensityChange}
      />

      {/* Product Grid */}
      {products.length > 0 ? (
        <div
          data-testid="products-grid"
          data-density={density}
          className={GRID_LAYOUT_CLASSES[density] || GRID_LAYOUT_CLASSES[4]}
        >
          {products.map((product) => (
            <RetailerProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-3xl mx-auto">
            🔍
          </div>
          <div className="max-w-sm mx-auto space-y-1">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              {t.products.noProductsFound}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t.products.noProductsDesc}
            </p>
          </div>
          <div className="pt-2">
            <a
              href="/products"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity"
            >
              {t.products.resetFilters}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
