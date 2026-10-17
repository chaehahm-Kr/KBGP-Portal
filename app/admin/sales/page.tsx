import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { mockProducts, mockSalesData } from "@/lib/data/mockData";
import {
  fetchProductPerformancePageAction,
  fetchPerformanceFilterOptionsAction,
} from "@/lib/product/performance/performance-actions";
import { SkuPerformanceDashboard } from "@/components/admin/sales/sku-performance-dashboard";

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
    brand?: string;
    cat?: string;
  }>;
}

export default async function AdminSalesPage(props: AdminSalesPageProps) {
  await verifyAdminSession();
  const searchParams = props.searchParams ? await props.searchParams : {};
  const activeTab = searchParams.tab || "overview";

  // If tab is SKU Performance, fetch live data from V2.0 Canonical Service
  let skuPerformanceResult = null;
  let filterOptions: any = { brands: [], categories: [] };

  if (activeTab === "sku") {
    const lookbackDays = searchParams.days ? Number(searchParams.days) : 60;
    const page = searchParams.page ? Number(searchParams.page) : 1;

    const [perfRes, filtersRes] = await Promise.all([
      fetchProductPerformancePageAction({
        lookbackDays,
        page,
        pageSize: 25,
        searchQuery: searchParams.q,
        brandId: searchParams.brand,
        categoryId: searchParams.cat,
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

  // Preserved Overview mock SKU sales calculation
  const skuSales = mockProducts
    .map((product) => {
      const unitsSold = Math.floor(Math.random() * 300) + 50;
      const grossSales = unitsSold * product.msrp;
      const costOfGoods = unitsSold * product.cost;
      const margin = grossSales - costOfGoods;
      const marginPercentage = ((margin / grossSales) * 100).toFixed(0);

      return {
        ...product,
        unitsSold,
        grossSales,
        costOfGoods,
        margin,
        marginPercentage,
      };
    })
    .sort((a, b) => b.grossSales - a.grossSales);

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
      ) : (
        /* Preserved Sales Overview Section */
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white">
              매출 및 성과 (Sales &amp; Performance Overview)
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              오프라인 리테일과 아마존 판매 실적, 제품 마진율 및 베스트셀러 SKU 성과를 모니터링합니다.
            </p>
          </div>

          {/* Sales trend bar chart */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">
              월간 매출 추이 (Monthly Sales Trend)
            </h2>
            <div className="flex h-48 items-end gap-3 px-2 pb-2 pt-6">
              {mockSalesData.monthlyNetSales.map((data, idx) => {
                const maxVal = 70000;
                const retailHeight = (data.retail / maxVal) * 100;
                const amazonHeight = (data.amazon / maxVal) * 100;

                return (
                  <div key={idx} className="group relative flex flex-1 flex-col items-center gap-1">
                    <div className="relative flex w-full flex-col justify-end gap-1 h-36">
                      <div
                        style={{ height: `${retailHeight}%` }}
                        className="w-full rounded bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-300 dark:hover:bg-zinc-200 transition-all duration-300"
                      />
                      <div
                        style={{ height: `${amazonHeight}%` }}
                        className="w-full rounded bg-zinc-400 hover:bg-zinc-300 dark:bg-zinc-600 dark:hover:bg-zinc-500 transition-all duration-300"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400">{data.month}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex gap-6 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 justify-center">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-zinc-900 dark:bg-white" />
                <span>리테일 매출 (Retail Sales)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-zinc-400 dark:bg-zinc-600" />
                <span>아마존 매출 (Amazon Sales)</span>
              </div>
            </div>
          </div>

          {/* SKU Performance Quick Link Banner */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-5 dark:border-blue-900/40 dark:bg-blue-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-blue-950 dark:text-blue-200">
                Product Performance V2.0 Engine Live
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Verifiable Landed Cost FIFO margins, HQ Available inventory positions, and 90-Day Exchange protection metrics are available in the SKU Performance tab.
              </p>
            </div>
            <Link
              href="/admin/sales?tab=sku"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap self-start sm:self-auto shadow-sm"
            >
              Open SKU Performance (V2.0) →
            </Link>
          </div>

          {/* SKU Performance Table (Preserved Overview View) */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">
              SKU 성과 지표 (SKU Overview)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
                <thead>
                  <tr className="border-b border-zinc-150 font-bold text-zinc-950 dark:border-zinc-800 dark:text-white">
                    <th className="py-2.5">제품명</th>
                    <th className="py-2.5">SKU</th>
                    <th className="py-2.5">브랜드</th>
                    <th className="py-2.5 text-center">판매수량</th>
                    <th className="py-2.5 text-right">총 매출 (MSRP)</th>
                    <th className="py-2.5 text-right">매출 원가 (Cost)</th>
                    <th className="py-2.5 text-right">순이익 (Margin)</th>
                    <th className="py-2.5 text-right">마진율 (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                  {skuSales.map((sku) => (
                    <tr key={sku.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                      <td className="py-3 font-semibold text-zinc-900 dark:text-white">{sku.name}</td>
                      <td className="py-3 font-mono">{sku.sku}</td>
                      <td className="py-3">{sku.brand}</td>
                      <td className="py-3 text-center font-bold text-zinc-900 dark:text-white">{sku.unitsSold}</td>
                      <td className="py-3 text-right">${sku.grossSales.toLocaleString()}</td>
                      <td className="py-3 text-right">${sku.costOfGoods.toLocaleString()}</td>
                      <td className="py-3 text-right font-bold text-emerald-600">${sku.margin.toLocaleString()}</td>
                      <td className="py-3 text-right font-bold text-zinc-950 dark:text-white">{sku.marginPercentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
