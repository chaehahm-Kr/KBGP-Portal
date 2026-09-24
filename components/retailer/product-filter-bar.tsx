"use client";

import React, { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface FilterBarProps {
  categories: Array<{ code: string; label: string; count: number }>;
  brands: Array<{ id: string; name: string; count: number }>;
  currentSearch?: string;
  currentCategory?: string;
  currentBrandId?: string;
  totalCount: number;
}

export function RetailerProductFilterBar({
  categories,
  brands,
  currentSearch = "",
  currentCategory = "all",
  currentBrandId = "all",
  totalCount,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSearchChange = (term: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (term.trim()) {
      params.set("search", term.trim());
    } else {
      params.delete("search");
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleCategoryChange = (cat: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (cat && cat !== "all") {
      params.set("category", cat);
    } else {
      params.delete("category");
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleBrandChange = (brandId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (brandId && brandId !== "all") {
      params.set("brand", brandId);
    } else {
      params.delete("brand");
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleResetFilters = () => {
    startTransition(() => {
      router.push(pathname);
    });
  };

  const hasActiveFilters =
    Boolean(currentSearch) ||
    (Boolean(currentCategory) && currentCategory !== "all") ||
    (Boolean(currentBrandId) && currentBrandId !== "all");

  return (
    <div className="space-y-4">
      {/* Search and Dropdowns Row */}
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
            placeholder="Search by product name, brand, SKU, or keywords..."
            defaultValue={currentSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
          />
        </div>

        {/* Brand Selector */}
        {brands.length > 0 && (
          <div className="w-full md:w-56">
            <select
              value={currentBrandId}
              onChange={(e) => handleBrandChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs cursor-pointer"
            >
              <option value="all">All Brands ({brands.reduce((a, b) => a + b.count, 0)})</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.count})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Category Selector */}
        {categories.length > 0 && (
          <div className="w-full md:w-56">
            <select
              value={currentCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs cursor-pointer"
            >
              <option value="all">All Categories ({categories.reduce((a, b) => a + b.count, 0)})</option>
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label} ({c.count})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Category Pills Strip (Quick Filter) */}
      {categories.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => handleCategoryChange("all")}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              currentCategory === "all" || !currentCategory
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            All Products
          </button>
          {categories.map((cat) => {
            const isSelected = currentCategory === cat.code;
            return (
              <button
                key={cat.code}
                type="button"
                onClick={() => handleCategoryChange(cat.code)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  isSelected
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {cat.label} ({cat.count})
              </button>
            );
          })}
        </div>
      )}

      {/* Results & Active Filters Bar */}
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-1">
        <div className="flex items-center gap-2">
          <span>
            Showing <strong className="text-zinc-900 dark:text-white font-semibold">{totalCount}</strong> verified {totalCount === 1 ? "product" : "products"}
          </span>
          {isPending && (
            <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
              Updating...
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            Clear all filters ✕
          </button>
        )}
      </div>
    </div>
  );
}
