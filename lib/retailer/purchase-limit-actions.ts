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
  error?: string;
}

/**
 * Server action to validate cart items against live available stock and account purchase limits
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

    return {
      success: true,
      companyId,
      allowances,
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
