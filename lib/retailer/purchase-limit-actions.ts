"use server";

import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getRetailerAccountPurchaseAllowances,
  type RetailerPurchaseAllowance,
} from "@/lib/retailer/purchase-limits";

export interface ValidateCartResult {
  success: boolean;
  companyId?: string;
  allowances: Record<string, RetailerPurchaseAllowance>;
  thumbnails?: Record<string, string | null>;
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

    // Fetch authoritative product images for cart items
    const { data: rawImages } = await adminClient
      .from("product_images")
      .select("product_id, storage_path, position, is_representative")
      .in("product_id", uniqueIds);

    const thumbnails: Record<string, string | null> = {};
    const imagesByProd = new Map<string, any[]>();
    for (const img of rawImages || []) {
      const list = imagesByProd.get(img.product_id) || [];
      list.push(img);
      imagesByProd.set(img.product_id, list);
    }

    for (const pid of uniqueIds) {
      const prodImgs = imagesByProd.get(pid) || [];
      if (prodImgs.length === 0) {
        thumbnails[pid] = null;
        continue;
      }
      // Priority 1: Representative Image, Priority 2: Lowest position (Main/Gallery), Priority 3: First valid
      prodImgs.sort((a, b) => {
        if (a.is_representative && !b.is_representative) return -1;
        if (!a.is_representative && b.is_representative) return 1;
        return (a.position ?? 0) - (b.position ?? 0);
      });

      let chosenUrl: string | null = null;
      for (const img of prodImgs) {
        if (!img.storage_path) continue;
        if (img.storage_path.startsWith("http://") || img.storage_path.startsWith("https://")) {
          chosenUrl = img.storage_path;
          break;
        }
        try {
          const { data: signed } = await adminClient.storage
            .from("company-uploads")
            .createSignedUrl(img.storage_path, 86400); // 24hr freshness
          if (signed?.signedUrl) {
            chosenUrl = signed.signedUrl;
            break;
          }
        } catch {
          // ignore
        }
      }
      thumbnails[pid] = chosenUrl;
    }

    return {
      success: true,
      companyId,
      allowances,
      thumbnails,
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
