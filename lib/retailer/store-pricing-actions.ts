"use server";

import { revalidatePath } from "next/cache";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRetailerAccessibleStores } from "@/lib/retailer/weekly-check";

export interface SaveStorePriceInput {
  storeId: string;
  productId: string;
  regularPrice: number;
  salePrice?: number | null;
  saleStartDate?: string | null;
  saleEndDate?: string | null;
}

export interface SaveStorePriceResult {
  success: boolean;
  error?: string;
}

export async function saveStoreProductPriceAction(
  input: SaveStorePriceInput
): Promise<SaveStorePriceResult> {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    const { storeId, productId, regularPrice, salePrice, saleStartDate, saleEndDate } = input;

    // 1. Validation
    if (!storeId || !productId) {
      return { success: false, error: "Store and Product are required." };
    }

    if (!regularPrice || regularPrice <= 0 || isNaN(regularPrice)) {
      return { success: false, error: "Regular Price must be greater than 0." };
    }

    let cleanSalePrice: number | null = null;
    if (salePrice !== undefined && salePrice !== null && salePrice !== 0) {
      const numSale = Number(salePrice);
      if (isNaN(numSale) || numSale <= 0) {
        return { success: false, error: "Sale Price must be greater than 0 if provided." };
      }
      if (numSale >= regularPrice) {
        return { success: false, error: "Sale Price must be lower than Regular Price." };
      }
      cleanSalePrice = Number(numSale.toFixed(2));
    }

    // 2. Authorize store access & permissions
    const { companyId, userRole, stores } = await getRetailerAccessibleStores();
    if (!companyId || !stores.some((s) => s.id === storeId)) {
      return { success: false, error: "Unauthorized store location." };
    }

    if (!["owner", "buyer", "store_manager"].includes(userRole || "")) {
      return { success: false, error: "Insufficient permissions to edit store prices." };
    }

    // 3. Upsert price into retailer_store_product_prices
    const { error: upsertErr } = await adminClient
      .from("retailer_store_product_prices")
      .upsert(
        {
          company_id: companyId,
          store_id: storeId,
          product_id: productId,
          regular_price: Number(regularPrice.toFixed(2)),
          sale_price: cleanSalePrice,
          sale_start_date: saleStartDate || null,
          sale_end_date: saleEndDate || null,
          currency: "USD",
          updated_by: session.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id,product_id" }
      );

    if (upsertErr) {
      console.error("Error saving store price:", upsertErr);
      return { success: false, error: upsertErr.message };
    }

    revalidatePath("/retailer/tags");
    revalidatePath("/retailer/sales");
    revalidatePath("/retailer/products");
    revalidatePath(`/retailer/sales/${productId}`);

    return { success: true };
  } catch (err: any) {
    console.error("saveStoreProductPriceAction error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

export async function clearStoreProductPriceAction(
  storeId: string,
  productId: string
): Promise<SaveStorePriceResult> {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    const { companyId, userRole, stores } = await getRetailerAccessibleStores();
    if (!companyId || !stores.some((s) => s.id === storeId)) {
      return { success: false, error: "Unauthorized store location." };
    }

    if (!["owner", "buyer", "store_manager"].includes(userRole || "")) {
      return { success: false, error: "Insufficient permissions to clear store prices." };
    }

    const { error: delErr } = await adminClient
      .from("retailer_store_product_prices")
      .delete()
      .eq("store_id", storeId)
      .eq("product_id", productId);

    if (delErr) {
      console.error("Error clearing store price:", delErr);
      return { success: false, error: delErr.message };
    }

    revalidatePath("/retailer/tags");
    revalidatePath("/retailer/sales");
    revalidatePath("/retailer/products");
    revalidatePath(`/retailer/sales/${productId}`);

    return { success: true };
  } catch (err: any) {
    console.error("clearStoreProductPriceAction error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
