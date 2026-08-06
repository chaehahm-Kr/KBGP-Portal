"use server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function adminUpdateProductOverrides(
  productId: string,
  overrides: Record<string, any>
) {
  await verifyAdminSession();
  const supabase = await createClient();

  // 1. Fetch current price_additional_info
  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("price_additional_info")
    .eq("id", productId)
    .single();

  if (fetchError || !product) {
    throw new Error(fetchError?.message || "제품을 찾을 수 없습니다.");
  }

  const currentMeta = (product.price_additional_info as Record<string, any>) || {};
  const currentOverrides = (currentMeta.admin_overrides as Record<string, any>) || {};

  // Extract and clean letusto_sku, brand_id, selection_status, and sales_status from the overrides payload to save them to database columns directly
  const cleanOverrides = { ...overrides };
  const letustoSku = cleanOverrides.letusto_sku;
  const brandId = cleanOverrides.brand_id;
  const selectionStatus = cleanOverrides.selection_status;
  const salesStatus = cleanOverrides.sales_status;

  delete cleanOverrides.letusto_sku;
  delete cleanOverrides.brand_id;
  delete cleanOverrides.selection_status;
  delete cleanOverrides.sales_status;

  if (currentOverrides.letusto_sku !== undefined) {
    delete currentOverrides.letusto_sku;
  }
  if (currentOverrides.brand_id !== undefined) {
    delete currentOverrides.brand_id;
  }
  if (currentOverrides.selection_status !== undefined) {
    delete currentOverrides.selection_status;
  }
  if (currentOverrides.sales_status !== undefined) {
    delete currentOverrides.sales_status;
  }

  // Merge the new overrides into existing admin_overrides
  const updatedMeta = {
    ...currentMeta,
    admin_overrides: {
      ...currentOverrides,
      ...cleanOverrides,
    },
  };

  const updateData: Record<string, any> = {
    price_additional_info: updatedMeta,
  };

  if (letustoSku !== undefined) {
    updateData.letusto_sku = letustoSku && letustoSku.trim() !== "" ? letustoSku.trim() : null;
  }
  if (brandId !== undefined && brandId !== "") {
    updateData.brand_id = brandId;
  }
  if (selectionStatus !== undefined) {
    updateData.selection_status = selectionStatus;
  }
  if (salesStatus !== undefined) {
    updateData.sales_status = salesStatus;
  }

  // 2. Update the product using createAdminClient to bypass UPDATE RLS restrictions (since admins do not have matching company_id)
  const adminSupabase = createAdminClient();
  const { error: updateError } = await adminSupabase
    .from("products")
    .update(updateData)
    .eq("id", productId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products`);
  revalidatePath(`/portal/products/${productId}`);
  revalidatePath(`/portal/products`);
  return { success: true };
}
