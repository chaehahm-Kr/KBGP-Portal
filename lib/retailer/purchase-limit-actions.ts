"use server";

import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getRetailerAccountPurchaseAllowances,
  type RetailerPurchaseAllowance,
} from "@/lib/retailer/purchase-limits";
import { resolveAuthoritativeProductImages } from "@/lib/retailer/product-images";

export interface ValidateCartResult {
  success: boolean;
  companyId?: string;
  allowances: Record<string, RetailerPurchaseAllowance>;
  thumbnails?: Record<string, string | null>;
  imageGalleries?: Record<string, string[]>;
  error?: string;
}

/**
 * Server action to validate cart items against live available stock, account purchase limits,
 * and resolve fresh authoritative product images.
 */
export async function validateRetailerCartItemsAction(
  productIds: string[]
): Promise<ValidateCartResult> {
  try {
    const session = await verifyRetailerSession();
    if (!session || !session.userId) {
      return { success: false, allowances: {}, error: "Unauthorized session" };
    }

    const adminClient = createAdminClient();
    const { data: companyUser } = await adminClient
      .from("company_users")
      .select("company_id")
      .eq("id", session.userId)
      .maybeSingle();

    const companyId = companyUser?.company_id;
    if (!companyId) {
      return { success: false, allowances: {}, error: "Retailer company not found" };
    }

    const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
    const allowances = await getRetailerAccountPurchaseAllowances(companyId, uniqueIds);

    // Fetch authoritative product images for cart items via shared authoritative resolver
    const imageMap = await resolveAuthoritativeProductImages(adminClient, uniqueIds);
    const thumbnails: Record<string, string | null> = {};
    const imageGalleries: Record<string, string[]> = {};

    for (const pid of uniqueIds) {
      const resolved = imageMap[pid];
      thumbnails[pid] = resolved?.primaryUrl || null;
      imageGalleries[pid] = resolved?.galleryUrls || [];
    }

    return {
      success: true,
      companyId,
      allowances,
      thumbnails,
      imageGalleries,
    };
  } catch (err: any) {
    console.error("[validateRetailerCartItemsAction] Error:", err);
    return {
      success: false,
      allowances: {},
      error: err?.message || "Failed to validate cart items",
    };
  }
}
