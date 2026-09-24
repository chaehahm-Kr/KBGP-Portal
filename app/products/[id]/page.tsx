import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicProductDetail } from "@/lib/product/public";
import { PublicProductView } from "@/components/public/public-product-view";

export const dynamic = "force-dynamic";

interface PublicProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PublicProductPage({ params }: PublicProductPageProps) {
  const { id: productId } = await params;
  const product = await getPublicProductDetail(productId);

  if (!product) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-2xl mx-auto">
            🔍
          </div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">
            Product Information Not Available
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            The product QR code scanned does not correspond to an active published product or is currently unavailable.
          </p>
        </div>
      </div>
    );
  }

  return <PublicProductView product={product} />;
}
