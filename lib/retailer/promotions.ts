import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type PromotionTriggerType,
  type PromotionDiscountType,
  type PromotionStatus,
  type PromotionAppliesToScope,
  type PromotionRetailerScope,
  type PromotionRecord,
  type PromotionSnapshot,
  type EvaluatePromotionResult,
  type CartEvaluationItem,
  generateRandomPromoCode,
  formatPromotionRulePreview,
} from "./promotion-types";

export type {
  PromotionTriggerType,
  PromotionDiscountType,
  PromotionStatus,
  PromotionAppliesToScope,
  PromotionRetailerScope,
  PromotionRecord,
  PromotionSnapshot,
  EvaluatePromotionResult,
  CartEvaluationItem,
};

export { generateRandomPromoCode, formatPromotionRulePreview };

/**
 * Single Authoritative Server-side Promotion & Pricing Evaluator
 */
export async function evaluatePromotionsForCart(
  items: CartEvaluationItem[],
  couponCode: string | null | undefined,
  companyId: string
): Promise<EvaluatePromotionResult> {
  const adminClient = createAdminClient();
  const now = new Date();

  const subtotal = items.reduce((acc, item) => acc + (item.lineTotal || 0), 0);
  const normalizedCode = couponCode?.trim().toUpperCase() || null;

  let appliedCoupon: PromotionSnapshot | null = null;
  let appliedAutomatic: PromotionSnapshot | null = null;
  let totalDiscount = 0;

  if (items.length === 0) {
    return {
      isValid: true,
      totalDiscount: 0,
      finalSubtotal: 0,
    };
  }

  // Fetch product metadata (brand_id, category_code) for scope checks
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const { data: dbProducts } = await adminClient
    .from("products")
    .select("id, brand_id, category, category_code")
    .in("id", productIds);

  const productMetaMap = new Map<string, { brandId: string; categoryCode: string }>();
  for (const p of dbProducts || []) {
    productMetaMap.set(p.id, {
      brandId: p.brand_id,
      categoryCode: p.category_code || p.category || "",
    });
  }

  // Helper to evaluate a single promotion against cart items
  async function evaluateRule(
    promo: PromotionRecord
  ): Promise<{ valid: boolean; reason?: string; discount: number; snapshot?: PromotionSnapshot }> {
    // 1. Status check
    if (promo.status === "paused") {
      return { valid: false, discount: 0, reason: "This promotion is currently paused." };
    }
    if (promo.status === "archived" || promo.status === "draft") {
      return { valid: false, discount: 0, reason: "Invalid promo code." };
    }

    // 2. Schedule check
    if (!promo.no_expiration) {
      if (promo.start_at && new Date(promo.start_at) > now) {
        return { valid: false, discount: 0, reason: "This promotion has not started yet." };
      }
      if (promo.end_at && new Date(promo.end_at) < now) {
        return { valid: false, discount: 0, reason: "This promotion has expired." };
      }
    }

    // 3. Retailer Scope check
    if (promo.retailer_scope === "selected_retailers") {
      const { data: allowedRetailer } = await adminClient
        .from("promotion_retailers")
        .select("company_id")
        .eq("promotion_id", promo.id)
        .eq("company_id", companyId)
        .maybeSingle();

      if (!allowedRetailer) {
        return { valid: false, discount: 0, reason: "This promotion is not available for your store." };
      }
    }

    // 4. Product / Brand / Category Scope check
    let eligibleItems = [...items];

    if (promo.applies_to_scope === "selected_products") {
      const { data: allowedProds } = await adminClient
        .from("promotion_products")
        .select("product_id")
        .eq("promotion_id", promo.id);
      const allowedSet = new Set((allowedProds || []).map((x) => x.product_id));
      eligibleItems = items.filter((i) => allowedSet.has(i.productId));
    } else if (promo.applies_to_scope === "selected_brands") {
      const { data: allowedBrands } = await adminClient
        .from("promotion_brands")
        .select("brand_id")
        .eq("promotion_id", promo.id);
      const allowedSet = new Set((allowedBrands || []).map((x) => x.brand_id));
      eligibleItems = items.filter((i) => {
        const meta = productMetaMap.get(i.productId);
        return meta && allowedSet.has(meta.brandId);
      });
    } else if (promo.applies_to_scope === "selected_categories") {
      const { data: allowedCats } = await adminClient
        .from("promotion_categories")
        .select("category_code")
        .eq("promotion_id", promo.id);
      const allowedSet = new Set((allowedCats || []).map((x) => x.category_code));
      eligibleItems = items.filter((i) => {
        const meta = productMetaMap.get(i.productId);
        return meta && allowedSet.has(meta.categoryCode);
      });
    }

    if (eligibleItems.length === 0) {
      return { valid: false, discount: 0, reason: "This promotion does not apply to the products in your cart." };
    }

    const eligibleSpend = eligibleItems.reduce((acc, i) => acc + (i.lineTotal || 0), 0);
    const eligibleQty = eligibleItems.reduce((acc, i) => acc + (i.quantity || 0), 0);

    // 5. Minimum Requirements
    if (promo.minimum_spend && promo.minimum_spend > 0) {
      if (eligibleSpend < promo.minimum_spend) {
        return {
          valid: false,
          discount: 0,
          reason: `Minimum order of $${promo.minimum_spend.toFixed(2)} is required.`,
        };
      }
    }

    if (promo.minimum_quantity && promo.minimum_quantity > 0) {
      if (eligibleQty < promo.minimum_quantity) {
        return {
          valid: false,
          discount: 0,
          reason: `Minimum quantity of ${promo.minimum_quantity} eligible units is required.`,
        };
      }
    }

    // 6. Quantity Tier Combination check
    if (!promo.combinable_with_quantity_tiers) {
      const hasTierDiscount = eligibleItems.some(
        (i) => (i.discountPercent && i.discountPercent > 0) || i.appliedReason?.includes("tier")
      );
      if (hasTierDiscount) {
        return {
          valid: false,
          discount: 0,
          reason: "This promotion cannot be combined with the current quantity discount.",
        };
      }
    }

    // 7. Usage Limits (excluding cancelled/rejected/voided orders)
    if (promo.total_usage_limit || promo.per_retailer_usage_limit) {
      const { data: usages } = await adminClient
        .from("promotion_usages")
        .select("company_id, retailer_orders!inner(order_status)")
        .eq("promotion_id", promo.id);

      const validUsages = (usages || []).filter((u: any) => {
        const status = u.retailer_orders?.order_status;
        return status && !["cancelled", "rejected", "voided"].includes(status);
      });

      if (promo.total_usage_limit && validUsages.length >= promo.total_usage_limit) {
        return { valid: false, discount: 0, reason: "Usage limit has been reached." };
      }

      if (promo.per_retailer_usage_limit) {
        const storeUsages = validUsages.filter((u: any) => u.company_id === companyId).length;
        if (storeUsages >= promo.per_retailer_usage_limit) {
          return { valid: false, discount: 0, reason: "Usage limit has been reached for your store." };
        }
      }
    }

    // 8. Calculate Discount Value
    let calcDiscount = 0;
    let bogoDetails: PromotionSnapshot["bogo_details"] = null;

    switch (promo.discount_type) {
      case "percentage": {
        calcDiscount = (eligibleSpend * Number(promo.discount_value || 0)) / 100;
        if (promo.maximum_discount && promo.maximum_discount > 0) {
          calcDiscount = Math.min(calcDiscount, Number(promo.maximum_discount));
        }
        break;
      }
      case "fixed_amount": {
        calcDiscount = Math.min(Number(promo.discount_value || 0), eligibleSpend);
        break;
      }
      case "unit_discount": {
        calcDiscount = eligibleQty * Number(promo.discount_value || 0);
        if (promo.maximum_discount && promo.maximum_discount > 0) {
          calcDiscount = Math.min(calcDiscount, Number(promo.maximum_discount));
        }
        break;
      }
      case "bogo": {
        const buyQty = promo.bogo_buy_quantity || 1;
        const getQty = promo.bogo_get_quantity || 1;
        const sets = Math.floor(eligibleQty / buyQty);
        if (sets <= 0) {
          return {
            valid: false,
            discount: 0,
            reason: `Buy at least ${buyQty} units to qualify for this BOGO promotion.`,
          };
        }
        const freeUnits = sets * getQty;
        const unitVal = eligibleItems[0]?.wholesalePrice || 0;
        const pct = (promo.bogo_discount_percent ?? 100) / 100;
        calcDiscount = freeUnits * unitVal * pct;
        if (promo.maximum_discount && promo.maximum_discount > 0) {
          calcDiscount = Math.min(calcDiscount, Number(promo.maximum_discount));
        }
        bogoDetails = {
          buy_quantity: buyQty,
          get_quantity: getQty,
          free_units: freeUnits,
          unit_value: unitVal,
          discount_percent: promo.bogo_discount_percent ?? 100,
        };
        break;
      }
    }

    calcDiscount = Math.min(calcDiscount, subtotal);
    calcDiscount = Math.round((calcDiscount + Number.EPSILON) * 100) / 100;

    const snapshot: PromotionSnapshot = {
      promotion_id: promo.id,
      promotion_name: promo.name,
      coupon_code: promo.code || null,
      trigger_type: promo.trigger_type,
      discount_type: promo.discount_type,
      discount_value: Number(promo.discount_value || 0),
      discount_amount: calcDiscount,
      eligible_subtotal: Math.round(eligibleSpend * 100) / 100,
      original_subtotal: subtotal,
      final_subtotal: Math.max(0, Math.round((subtotal - calcDiscount) * 100) / 100),
      bogo_details: bogoDetails,
      applied_at: new Date().toISOString(),
    };

    return {
      valid: true,
      discount: calcDiscount,
      snapshot,
    };
  }

  // --- Step 1: Check Manual Coupon if provided ---
  if (normalizedCode) {
    const { data: couponPromo } = await adminClient
      .from("promotions")
      .select("*")
      .eq("trigger_type", "coupon")
      .ilike("code", normalizedCode)
      .maybeSingle();

    if (!couponPromo) {
      return {
        isValid: false,
        errorReason: "Invalid promo code.",
        totalDiscount: 0,
        finalSubtotal: subtotal,
      };
    }

    const res = await evaluateRule(couponPromo as PromotionRecord);
    if (!res.valid) {
      return {
        isValid: false,
        errorReason: res.reason || "Invalid promo code.",
        totalDiscount: 0,
        finalSubtotal: subtotal,
      };
    }

    appliedCoupon = res.snapshot || null;
    totalDiscount += res.discount;
  }

  // --- Step 2: Check Automatic Promotions ---
  // If no coupon, or coupon allows automatic combination
  const canCheckAutomatic = !appliedCoupon || (appliedCoupon && (await canCombineAutomatic(appliedCoupon.promotion_id)));

  if (canCheckAutomatic) {
    const { data: autoPromos } = await adminClient
      .from("promotions")
      .select("*")
      .eq("trigger_type", "automatic")
      .eq("status", "active")
      .order("discount_value", { ascending: false });

    for (const ap of autoPromos || []) {
      const aRes = await evaluateRule(ap as PromotionRecord);
      if (aRes.valid && aRes.discount > 0) {
        // Take the best automatic promotion
        appliedAutomatic = aRes.snapshot || null;
        totalDiscount += aRes.discount;
        break; // Phase 1: 1 automatic promotion
      }
    }
  }

  async function canCombineAutomatic(pId: string): Promise<boolean> {
    const { data } = await adminClient
      .from("promotions")
      .select("combinable_with_automatic_promotions")
      .eq("id", pId)
      .maybeSingle();
    return Boolean(data?.combinable_with_automatic_promotions);
  }

  totalDiscount = Math.min(totalDiscount, subtotal);
  totalDiscount = Math.round((totalDiscount + Number.EPSILON) * 100) / 100;
  const finalSubtotal = Math.max(0, Math.round((subtotal - totalDiscount) * 100) / 100);

  return {
    isValid: true,
    appliedCoupon,
    appliedAutomatic,
    totalDiscount,
    finalSubtotal,
  };
}
