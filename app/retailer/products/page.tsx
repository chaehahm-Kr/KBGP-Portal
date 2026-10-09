import React from "react";
import type { Metadata } from "next";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerProducts } from "@/lib/retailer/products";
import { RetailerProductCard } from "@/components/retailer/product-card";
import { RetailerProductFilterBar } from "@/components/retailer/product-filter-bar";
import { getServerTranslations } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Product Discovery | K SELECT HUB Retailer",
  description: "Browse verified K-Beauty brands, check wholesale pricing, and view retail margins.",
};

interface RetailerProductsPageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    depth1?: string;
    depth2?: string;
    depth3?: string;
    brand?: string;
    margin?: string;
    price_preset?: string;
    min_price?: string;
    max_price?: string;
    orderable_only?: string;
    sort?: string;
  }>;
}

export default async function RetailerProductsPage({ searchParams }: RetailerProductsPageProps) {
  await verifyRetailerSession();
  const resolvedParams = await searchParams;
  const { t } = await getServerTranslations();

  const minPrice = resolvedParams.min_price ? parseFloat(resolvedParams.min_price) : undefined;
  const maxPrice = resolvedParams.max_price ? parseFloat(resolvedParams.max_price) : undefined;
  const orderableOnly = resolvedParams.orderable_only === "true";

  const catalog = await getRetailerProducts({
    search: resolvedParams.search,
    category: resolvedParams.category,
    depth1: resolvedParams.depth1,
    depth2: resolvedParams.depth2,
    depth3: resolvedParams.depth3,
    brandId: resolvedParams.brand,
    marginFilter: resolvedParams.margin,
    pricePreset: resolvedParams.price_preset,
    minPrice: !isNaN(minPrice as number) ? minPrice : undefined,
    maxPrice: !isNaN(maxPrice as number) ? maxPrice : undefined,
    orderableOnly,
    sortBy: resolvedParams.sort,
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 mb-2">
          <span>✨</span> {t.products.b2bCatalogBadge}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
          {t.products.title}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
          {t.products.subtitle}
        </p>
      </div>

      {/* Filter and Search Bar */}
      <RetailerProductFilterBar
        categoryHierarchy={catalog.categoryHierarchy}
        categories={catalog.categories}
        brands={catalog.brands}
        currentSearch={resolvedParams.search}
        currentDepth1={resolvedParams.depth1}
        currentDepth2={resolvedParams.depth2}
        currentDepth3={resolvedParams.depth3}
        currentCategory={resolvedParams.category || "all"}
        currentBrandId={resolvedParams.brand || "all"}
        currentMarginFilter={resolvedParams.margin || "all"}
        currentPricePreset={resolvedParams.price_preset || "all"}
        currentMinPrice={minPrice}
        currentMaxPrice={maxPrice}
        currentOrderableOnly={orderableOnly}
        currentSortBy={resolvedParams.sort || "default"}
        totalCount={catalog.totalCount}
      />

      {/* Products Catalog Grid */}
      {catalog.products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
          {catalog.products.map((product) => (
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
