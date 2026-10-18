import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import {
  fetchProductPerformancePageAction,
  fetchPerformanceFilterOptionsAction,
} from "@/lib/product/performance/performance-actions";
import { SkuPerformanceDashboard } from "@/components/admin/sales/sku-performance-dashboard";
import { getSalesOverviewData } from "@/lib/sales-overview";
import { SalesOverviewDashboard } from "@/components/admin/sales/sales-overview-dashboard";

export const metadata: Metadata = {
  title: "Sales & Performance | K SELECT NETWORK Admin",
  description:
    "Product Performance V2.0, B2B Net Sales, Landed Cost Margins, and Retailer Network Evaluation.",
};

export const dynamic = "force-dynamic";

interface AdminSalesPageProps {
  searchParams?: Promise<{
    tab?: string;
    days?: string;
    q?: string;
    page?: string;
    size?: string;
    brand?: string;
    cat?: string;
    readiness?: string;
    sort?: string;
    start?: string;
    end?: string;
  }>;
}

export default async function AdminSalesPage(props: AdminSalesPageProps) {
  await verifyAdminSession();
  const searchParams = props.searchParams ? await props.searchParams : {};
  const activeTab = searchParams.tab || "overview";

  // Tab 1: SKU Performance (V2.0 Canonical Service)
  let skuPerformanceResult = null;
  let filterOptions: any = { brands: [], categories: [] };

  if (activeTab === "sku") {
    const lookbackDays = searchParams.days ? Number(searchParams.days) : 60;
    const page = searchParams.page ? Number(searchParams.page) : 1;

    const [perfRes, filtersRes] = await Promise.all([
      fetchProductPerformancePageAction({
        lookbackDays,
        page,
        pageSize: searchParams.size ? Number(searchParams.size) : 25,
        searchQuery: searchParams.q,
        brandId: searchParams.brand,
        categoryId: searchParams.cat,
        readinessFilter: searchParams.readiness,
        sortBy: searchParams.sort as any,
      }),
      fetchPerformanceFilterOptionsAction(),
    ]);

    if (perfRes.success && perfRes.data) {
      skuPerformanceResult = perfRes.data;
    }
    if (filtersRes.success && filtersRes.data) {
      filterOptions = filtersRes.data;
    }
  }

  // Tab 2: Sales Overview (V1.0 Canonical Service)
  let salesOverviewResult = null;
  let salesOverviewBenchmarkMs = 0;
  let salesOverviewError: string | null = null;

  if (activeTab !== "sku") {
    const lookbackDays = searchParams.days ? Number(searchParams.days) : 30;
    const customRange =
      searchParams.start && searchParams.end
        ? { start: searchParams.start, end: searchParams.end }
        : undefined;

    const overviewRes = await getSalesOverviewData({
      lookbackDays,
      customRange,
    });

    if (overviewRes.success && overviewRes.data) {
      salesOverviewResult = overviewRes.data;
      salesOverviewBenchmarkMs = overviewRes.benchmarkMs || 0;
    } else {
      salesOverviewError = overviewRes.error || "Failed to load Sales Overview metrics.";
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="flex space-x-2">
          <Link
            href="/admin/sales"
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab !== "sku"
                ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            Overview
          </Link>
          <Link
            href="/admin/sales?tab=sku"
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "sku"
                ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            SKU Performance (V2.0)
          </Link>
          <Link
            href="/admin/sales/performance"
            className="border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors"
          >
            Retailer Performance
          </Link>
          <Link
            href="/admin/sales/promotions"
            className="border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors"
          >
            Promotions &amp; Coupons
          </Link>
        </nav>
      </div>

      {/* Render Active View */}
      {activeTab === "sku" ? (
        skuPerformanceResult ? (
          <SkuPerformanceDashboard
            initialResult={skuPerformanceResult}
            brands={filterOptions.brands}
            categories={filterOptions.categories}
          />
        ) : (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-300">
            <h2 className="text-base font-bold text-white mb-1">
              Error Loading Product Performance Data
            </h2>
            <p className="text-xs">
              Unable to load canonical SKU performance metrics from database.
            </p>
          </div>
        )
      ) : salesOverviewResult ? (
        <SalesOverviewDashboard
          initialData={salesOverviewResult}
          initialBenchmarkMs={salesOverviewBenchmarkMs}
        />
      ) : (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-300">
          <h2 className="text-base font-bold text-white mb-1">
            Error Loading Sales Overview Data
          </h2>
          <p className="text-xs">
            {salesOverviewError || "Unable to load canonical Sales Overview metrics from database."}
          </p>
        </div>
      )}
    </div>
  );
}
