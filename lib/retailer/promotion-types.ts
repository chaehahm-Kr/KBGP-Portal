export type PromotionTriggerType = "coupon" | "automatic";
export type PromotionDiscountType = "percentage" | "fixed_amount" | "unit_discount" | "bogo";
export type PromotionStatus = "draft" | "active" | "paused" | "archived";
export type PromotionAppliesToScope = "all" | "selected_products" | "selected_brands" | "selected_categories";
export type PromotionRetailerScope = "all" | "selected_retailers";

export interface PromotionRecord {
  id: string;
  name: string;
  internal_description: string | null;
  trigger_type: PromotionTriggerType;
  code: string | null;
  discount_type: PromotionDiscountType;
  discount_value: number;
  status: PromotionStatus;
  start_at: string | null;
  end_at: string | null;
  no_expiration: boolean;
  applies_to_scope: PromotionAppliesToScope;
  retailer_scope: PromotionRetailerScope;
  minimum_spend: number;
  minimum_quantity: number;
  maximum_discount: number | null;
  total_usage_limit: number | null;
  per_retailer_usage_limit: number | null;
  combinable_with_quantity_tiers: boolean;
  combinable_with_automatic_promotions: boolean;
  bogo_buy_quantity: number | null;
  bogo_get_product_id: string | null;
  bogo_get_quantity: number | null;
  bogo_discount_percent: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Joined scopes
  product_ids?: string[];
  brand_ids?: string[];
  category_codes?: string[];
  retailer_ids?: string[];
}

export interface PromotionSnapshot {
  promotion_id: string;
  promotion_name: string;
  coupon_code: string | null;
  trigger_type: PromotionTriggerType;
  discount_type: PromotionDiscountType;
  discount_value: number;
  discount_amount: number;
  eligible_subtotal: number;
  original_subtotal: number;
  final_subtotal: number;
  bogo_details?: {
    buy_quantity: number;
    get_quantity: number;
    free_units: number;
    unit_value: number;
    discount_percent: number;
  } | null;
  applied_at: string;
}

export interface EvaluatePromotionResult {
  isValid: boolean;
  errorReason?: string;
  appliedCoupon?: PromotionSnapshot | null;
  appliedAutomatic?: PromotionSnapshot | null;
  totalDiscount: number;
  finalSubtotal: number;
}

export interface CartEvaluationItem {
  productId: string;
  productName?: string;
  brandName?: string;
  wholesalePrice: number;
  quantity: number;
  lineTotal: number;
  discountPercent?: number;
  appliedReason?: string;
}

/**
 * Generate a random, human-friendly coupon code (e.g. KS-7H3K9X)
 */
export function generateRandomPromoCode(prefix: string = "KS"): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // excludes confusing 0, 1, I, O
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix ? `${prefix.toUpperCase()}-${code}` : code;
}

/**
 * Human-readable promotion rule preview string generator
 */
export function formatPromotionRulePreview(p: Partial<PromotionRecord>): string {
  const lines: string[] = [];

  // 1. Title / Code
  if (p.trigger_type === "coupon") {
    lines.push(`Code: ${p.code?.trim().toUpperCase() || "[Manual or Random Code]"}`);
  } else {
    lines.push(`Trigger: Automatic Promotion (applies automatically when conditions met)`);
  }

  // 2. Discount
  const val = Number(p.discount_value || 0);
  switch (p.discount_type) {
    case "percentage":
      lines.push(`${val}% OFF eligible items`);
      break;
    case "fixed_amount":
      lines.push(`$${val.toFixed(2)} OFF order`);
      break;
    case "unit_discount":
      lines.push(`$${val.toFixed(2)} OFF per eligible unit`);
      break;
    case "bogo":
      lines.push(`Buy ${p.bogo_buy_quantity || 1} → Get ${p.bogo_get_quantity || 1} at ${p.bogo_discount_percent ?? 100}% OFF`);
      break;
  }

  // 3. Scope
  if (p.applies_to_scope === "all") {
    lines.push("Applies to: All Products");
  } else if (p.applies_to_scope === "selected_products") {
    lines.push(`Applies to: ${p.product_ids?.length || 0} Selected Products`);
  } else if (p.applies_to_scope === "selected_brands") {
    lines.push(`Applies to: ${p.brand_ids?.length || 0} Selected Brands`);
  } else if (p.applies_to_scope === "selected_categories") {
    lines.push(`Applies to: ${p.category_codes?.length || 0} Selected Categories`);
  }

  // 4. Retailers
  if (p.retailer_scope === "all") {
    lines.push("Retailers: All Retailers");
  } else {
    lines.push(`Retailers: ${p.retailer_ids?.length || 0} Selected Retailers`);
  }

  // 5. Requirements
  if (p.minimum_spend && p.minimum_spend > 0) {
    lines.push(`Minimum order spend: $${p.minimum_spend.toFixed(2)}`);
  }
  if (p.minimum_quantity && p.minimum_quantity > 0) {
    lines.push(`Minimum eligible quantity: ${p.minimum_quantity} units`);
  }

  // 6. Max Discount
  if (p.maximum_discount && p.maximum_discount > 0) {
    lines.push(`Maximum discount cap: $${p.maximum_discount.toFixed(2)}`);
  }

  // 7. Limits
  if (p.total_usage_limit && p.total_usage_limit > 0) {
    lines.push(`Total usage limit: ${p.total_usage_limit} uses`);
  }
  if (p.per_retailer_usage_limit && p.per_retailer_usage_limit > 0) {
    lines.push(`Per-retailer limit: ${p.per_retailer_usage_limit} uses per store`);
  }

  // 8. Schedule
  if (p.no_expiration) {
    lines.push("Validity: No Expiration");
  } else if (p.start_at || p.end_at) {
    const s = p.start_at ? new Date(p.start_at).toLocaleDateString() : "Now";
    const e = p.end_at ? new Date(p.end_at).toLocaleDateString() : "Open";
    lines.push(`Validity: ${s} – ${e}`);
  }

  // 9. Combinations
  lines.push(`Quantity Tier Discount: ${p.combinable_with_quantity_tiers !== false ? "Combinable" : "Not Combinable"}`);
  if (p.trigger_type === "coupon") {
    lines.push(`Automatic Promotions: ${p.combinable_with_automatic_promotions ? "Combinable" : "Not Combinable"}`);
  }

  return lines.join(" • ");
}
