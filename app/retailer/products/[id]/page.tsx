import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerProductDetail } from "@/lib/retailer/products";
import { RetailerProductDetailView } from "@/components/retailer/product-detail-view";

export const dynamic = "force-dynamic";

interface ProductDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const product = await getRetailerProductDetail(id);
    if (!product) {
      return {
        title: "Product Not Found | K SELECT HUB Retailer",
      };
    }
    return {
      title: `${product.name} (${product.brandName}) | K SELECT HUB Retailer`,
      description: `Wholesale B2B pricing: $${product.wholesalePrice.toFixed(2)} | MSRP: $${product.msrp.toFixed(2)} | ${product.marginPercent}% margin.`,
    };
  } catch {
    return {
      title: "Product Detail | K SELECT HUB Retailer",
    };
  }
}

import { createAdminClient } from "@/lib/supabase/admin";
import { getRetailerAccountPurchaseAllowance } from "@/lib/retailer/purchase-limits";

export default async function RetailerProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const session = await verifyRetailerSession();
  const { id } = await params;

  const product = await getRetailerProductDetail(id);

  if (!product) {
    notFound();
  }

  let initialAllowance = undefined;
  if (session?.userId) {
    const adminClient = createAdminClient();
    const { data: compUser } = await adminClient
      .from("company_users")
      .select("company_id")
      .eq("id", session.userId)
      .maybeSingle();

    if (compUser?.company_id) {
      initialAllowance = await getRetailerAccountPurchaseAllowance(
        compUser.company_id,
        product.id,
        product.moq || product.cartonPackQty || 1,
        product.availableStock || 0,
        product.salesPolicy?.purchaseLimit
      );
    }
  }

  return <RetailerProductDetailView product={product} initialAllowance={initialAllowance} />;
}
