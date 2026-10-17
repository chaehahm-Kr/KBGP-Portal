import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getRetailerPerformanceData } from "@/lib/retailer/sales-performance/performance-actions";
import { RetailerPerformanceView } from "@/components/admin/sales/performance/retailer-performance-view";

export const metadata: Metadata = {
  title: "Retailer Performance | K SELECT NETWORK Admin",
  description:
    "Store-First Retailer Performance Evaluation V2.0, Partnership Compliance, and HQ Support Diagnosis",
};

export const dynamic = "force-dynamic";

export default async function AdminRetailerPerformancePage() {
  await verifyAdminSession();
  const res = await getRetailerPerformanceData();

  if (!res.success || !res.data) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-300">
          <h2 className="text-lg font-bold text-white mb-2">
            Error Loading Retailer Performance Data
          </h2>
          <p className="text-sm">
            {res.error || "Failed to load retailer performance metrics from database."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <RetailerPerformanceView
        initialData={res.data}
        initialBenchmarkMs={res.benchmarkMs}
      />
    </div>
  );
}
