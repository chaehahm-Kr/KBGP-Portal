import React from "react";
import type { Metadata } from "next";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerProducts } from "@/lib/retailer/products";
import { RetailerDiscoveryContainer } from "@/components/retailer/discovery-container";
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

      {/* Discovery Client Container (Filter Bar + Dynamic Density Grid) */}
      <RetailerDiscoveryContainer
        categoryHierarchy={catalog.categoryHierarchy}
        categories={catalog.categories}
        brands={catalog.brands}
        products={catalog.products}
        totalCount={catalog.totalCount}
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
      />
    </div>
  );
}
