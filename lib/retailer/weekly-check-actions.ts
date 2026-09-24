"use server";

import { revalidatePath } from "next/cache";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSalePriceActive } from "@/lib/retailer/store-pricing-types";

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

    const isSubmitting = actionType === "submit";
    const storeId = check.store_id;

    // Fetch store prices and product MSRP for snapshot resolution
    const productIds = items.map((i) => i.productId);
    let storePricesMap = new Map<string, any>();
    let productMsrpMap = new Map<string, number>();

    if (isSubmitting && productIds.length > 0) {
      const { data: storePrices } = await adminClient
        .from("retailer_store_product_prices")
        .select("*")
        .eq("store_id", storeId)
        .in("product_id", productIds);

      (storePrices || []).forEach((sp) => storePricesMap.set(sp.product_id, sp));

      const { data: prods } = await adminClient
        .from("products")
        .select(`
          id,
          estimated_retail_price,
          product_curations (
            wholesale_price,
            suggest_retail_price
          )
        `)
        .in("id", productIds);

      (prods || []).forEach((p) => {
        const curation = Array.isArray(p.product_curations)
          ? p.product_curations[0]
          : p.product_curations;
        let msrp = 0;
        if (curation?.suggest_retail_price && Number(curation.suggest_retail_price) > 0) {
          msrp = Number(curation.suggest_retail_price);
        } else if (p.estimated_retail_price && Number(p.estimated_retail_price) > 0) {
          msrp = Number(p.estimated_retail_price);
        } else if (curation?.wholesale_price && Number(curation.wholesale_price) > 0) {
          msrp = Number((Number(curation.wholesale_price) * 2.0).toFixed(2));
        }
        productMsrpMap.set(p.id, msrp);
      });
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

      // Calculate snapshot values on submit
      let priceSnapshot: number | null = null;
      let priceBasis: string | null = null;

      if (isSubmitting) {
        const priceRow = storePricesMap.get(it.productId);
        const msrp = productMsrpMap.get(it.productId) || 0;

        if (priceRow) {
          const regularPrice = Number(priceRow.regular_price) || 0;
          const salePrice = priceRow.sale_price ? Number(priceRow.sale_price) : null;
          const isActiveSale = isSalePriceActive(
            salePrice,
            priceRow.sale_start_date,
            priceRow.sale_end_date
          );

          if (isActiveSale && salePrice && salePrice > 0) {
            priceSnapshot = salePrice;
            priceBasis = "store_sale";
          } else if (regularPrice > 0) {
            priceSnapshot = regularPrice;
            priceBasis = "store_regular";
          } else if (msrp > 0) {
            priceSnapshot = msrp;
            priceBasis = "msrp";
          }
        } else if (msrp > 0) {
          priceSnapshot = msrp;
          priceBasis = "msrp";
        }
      }

      const updatePayload: Record<string, any> = {
        reported_remaining_qty: remaining,
        is_counted: isCounted,
        notes: it.notes || null,
        updated_at: new Date().toISOString(),
      };

      if (isSubmitting && priceSnapshot !== null) {
        updatePayload.retail_price_snapshot = priceSnapshot;
        updatePayload.retail_price_basis = priceBasis;
      }

      await adminClient
        .from("retailer_weekly_check_items")
        .update(updatePayload)
        .eq("check_id", checkId)
        .eq("product_id", it.productId);
    }

    // Update Header
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
    revalidatePath("/sales");

    return { success: true };
  } catch (err: any) {
    console.error("updateWeeklyCheckItemsAction error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
