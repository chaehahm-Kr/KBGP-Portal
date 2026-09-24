import React from "react";
import type { Metadata } from "next";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerProducts } from "@/lib/retailer/products";
import { RetailerProductCard } from "@/components/retailer/product-card";
import { RetailerProductFilterBar } from "@/components/retailer/product-filter-bar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Product Discovery | K SELECT HUB Retailer",
  description: "Browse verified K-Beauty brands, check wholesale pricing, and view retail margins.",
};

interface RetailerProductsPageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    brand?: string;
  }>;
}

export default async function RetailerProductsPage({ searchParams }: RetailerProductsPageProps) {
  await verifyRetailerSession();
  const resolvedParams = await searchParams;

  const catalog = await getRetailerProducts({
    search: resolvedParams.search,
    category: resolvedParams.category,
    brandId: resolvedParams.brand,
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 mb-2">
            <span>✨</span> B2B Wholesale Catalog
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Product Discovery
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
            Browse verified Korean beauty brands, analyze retail margins, and explore high-demand SKUs ready for store shelves.
          </p>
        </div>

        {/* Quick Highlights Strip */}
        <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-300">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-zinc-900 dark:text-white">~50%</span> Avg Margin
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span>Case Pack MOQ</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <RetailerProductFilterBar
        categories={catalog.categories}
        brands={catalog.brands}
        currentSearch={resolvedParams.search}
        currentCategory={resolvedParams.category || "all"}
        currentBrandId={resolvedParams.brand || "all"}
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
              No products found
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              We couldn’t find any products matching your search criteria. Try adjusting your search query or clearing filters.
            </p>
          </div>
          <div className="pt-2">
            <a
              href="/products"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity"
            >
              Reset All Filters
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
