import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getProductPerformanceDetail, ReportingPeriod } from "@/lib/retailer/performance";
import { ProductPerformanceDetailView } from "@/components/retailer/product-performance-detail-view";

export const dynamic = "force-dynamic";

interface ProductPerformanceDetailPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    period?: string;
  }>;
}

export default async function ProductPerformanceDetailPage({
  params,
  searchParams,
}: ProductPerformanceDetailPageProps) {
  await verifyRetailerSession();
  const { id: productId } = await params;
  const resolvedSearchParams = await searchParams;

  const validPeriods: ReportingPeriod[] = ["7d", "30d", "90d", "all"];
  const rawPeriod = resolvedSearchParams.period as ReportingPeriod;
  const period: ReportingPeriod = validPeriods.includes(rawPeriod) ? rawPeriod : "30d";

  const { product, userRole } = await getProductPerformanceDetail(productId, period);

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-8 text-center space-y-4 shadow-sm my-8">
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl mx-auto">
          🔍
        </div>
        <h2 className="text-base font-bold text-zinc-900 dark:text-white">
          Product Performance Record Not Found
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          This product is not currently part of your store assortment or does not have recorded weekly check counts.
        </p>
        <div className="pt-2">
          <Link
            href="/retailer/sales"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            ← Back to Performance Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <ProductPerformanceDetailView product={product} userRole={userRole} />;
}
