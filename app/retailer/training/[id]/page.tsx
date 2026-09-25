import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerTrainingDetail } from "@/lib/retailer/training";
import { TrainingDetailView } from "@/components/retailer/training-detail-view";

export const dynamic = "force-dynamic";

interface RetailerTrainingDetailPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    storeId?: string;
  }>;
}

export default async function RetailerTrainingDetailPage({
  params,
  searchParams,
}: RetailerTrainingDetailPageProps) {
  await verifyRetailerSession();
  const { id: productId } = await params;
  const { storeId } = await searchParams;

  const product = await getRetailerTrainingDetail(productId, storeId);

  if (!product) {
    return (
      <div className="max-w-md mx-auto my-12 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-2xl mx-auto">
          📦
        </div>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-white">
          Product Training Not Found
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          The requested product training module is not available or has been discontinued.
        </p>
        <div className="pt-2">
          <Link
            href="/training"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            ← Back to Training List
          </Link>
        </div>
      </div>
    );
  }

  return <TrainingDetailView product={product} storeId={storeId} />;
}
