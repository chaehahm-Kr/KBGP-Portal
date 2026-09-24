"use server";

import { revalidatePath } from "next/cache";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateWeeklyCheckItemsAction(
  checkId: string,
  items: Array<{
    productId: string;
    remainingQty: number;
    isCounted: boolean;
    notes?: string;
  }>,
  actionType: "draft" | "submit",
  checkNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    // Verify draft ownership
    const { data: check } = await adminClient
      .from("retailer_weekly_checks")
      .select("id, status, company_id, store_id")
      .eq("id", checkId)
      .maybeSingle();

    if (!check) {
      return { success: false, error: "Weekly check session not found." };
    }

    if (check.status !== "draft") {
      return { success: false, error: "This weekly check has already been submitted and cannot be modified." };
    }

    let totalCounted = 0;
    let totalUnits = 0;

    for (const it of items) {
      const remaining = Math.max(0, it.remainingQty || 0);
      const isCounted = Boolean(it.isCounted);
      if (isCounted) {
        totalCounted += 1;
        totalUnits += remaining;
      }

      await adminClient
        .from("retailer_weekly_check_items")
        .update({
          reported_remaining_qty: remaining,
          is_counted: isCounted,
          notes: it.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("check_id", checkId)
        .eq("product_id", it.productId);
    }

    // Update Header
    const isSubmitting = actionType === "submit";
    const { error: headerErr } = await adminClient
      .from("retailer_weekly_checks")
      .update({
        status: isSubmitting ? "submitted" : "draft",
        total_counted_products: totalCounted,
        total_remaining_units: totalUnits,
        notes: checkNotes || null,
        submitted_at: isSubmitting ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", checkId);

    if (headerErr) {
      return { success: false, error: "Failed to update weekly check session header." };
    }

    revalidatePath("/check");
    revalidatePath("/check/history");
    revalidatePath(`/check/${checkId}`);
    revalidatePath("/retailer");

    return { success: true };
  } catch (err: any) {
    console.error("updateWeeklyCheckItemsAction error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
