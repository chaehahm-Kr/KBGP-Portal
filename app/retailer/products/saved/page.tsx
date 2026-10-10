import React from "react";
import type { Metadata } from "next";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerProducts } from "@/lib/retailer/products";
import { getRetailerCollections, getRetailerSavedProductMap } from "@/lib/retailer/saved-products";
import { SavedProductsView } from "@/components/retailer/saved-products-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved Products & Collections | K SELECT HUB Retailer",
  description: "View and organize your saved products and curated collections.",
};

export default async function RetailerSavedProductsPage() {
  await verifyRetailerSession();

  const [catalog, collections, savedMap] = await Promise.all([
    getRetailerProducts({}),
    getRetailerCollections(),
    getRetailerSavedProductMap(),
  ]);

  return (
    <SavedProductsView
      products={catalog.products}
      collections={collections}
      savedProductIds={savedMap.savedProductIds}
      productCollectionsMap={savedMap.productCollectionsMap}
    />
  );
}
