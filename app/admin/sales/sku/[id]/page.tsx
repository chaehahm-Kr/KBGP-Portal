import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProductPerformanceById } from "@/lib/product/performance";
import { SkuDetailView } from "@/components/admin/sales/sku-detail-view";

export const metadata: Metadata = {
  title: "SKU Performance Details | K SELECT NETWORK Admin",
  description:
    "SKU-level B2B Net Sales, Landed Cost Profitability, Inventory Positions, and Exchange Claim Risk.",
};

export const dynamic = "force-dynamic";

interface SkuDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ days?: string }>;
}

export default async function AdminSkuDetailPage(props: SkuDetailPageProps) {
  await verifyAdminSession();
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const productId = params.id;
  const lookbackDays = searchParams.days ? Number(searchParams.days) : 60;

  const admin = createAdminClient();
  const summary = await getProductPerformanceById(
    productId,
    {
      lookbackDays,
      isRetailerView: false, // Full admin financial visibility
    },
    admin
  );

  if (!summary) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <nav className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <Link href="/admin/sales" className="hover:text-zinc-900 dark:hover:text-white">
            Sales &amp; Performance
          </Link>
          <span>/</span>
          <Link href="/admin/sales?tab=sku" className="hover:text-zinc-900 dark:hover:text-white">
            SKU Performance
          </Link>
          <span>/</span>
          <span className="font-semibold text-zinc-900 dark:text-white">Not Found</span>
        </nav>

        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            Product Not Found
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            No product matching ID &ldquo;{productId}&rdquo; was found in the database.
          </p>
          <div className="mt-4">
            <Link
              href="/admin/sales?tab=sku"
              className="inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors"
            >
              ← Back to SKU Performance
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SkuDetailView summary={summary} lookbackDays={lookbackDays} />
  );
}
