"use server";

import { verifyRetailerSession, verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  evaluatePromotionsForCart,
  type CartEvaluationItem,
  type EvaluatePromotionResult,
  type PromotionRecord,
  type PromotionStatus,
  generateRandomPromoCode,
} from "@/lib/retailer/promotions";

// ----------------------------------------------------------------------
// RETAILER ACTIONS
// ----------------------------------------------------------------------

/**
 * Server action to evaluate coupon code and automatic promotions on cart
 */
export async function evaluateCartPromotionsAction(
  items: CartEvaluationItem[],
  couponCode: string | null | undefined
): Promise<EvaluatePromotionResult> {
  try {
    const session = await verifyRetailerSession();
    if (!session || !session.userId) {
      return {
        isValid: false,
        errorReason: "Session expired. Please sign in again.",
        totalDiscount: 0,
        finalSubtotal: 0,
      };
    }

    const adminClient = createAdminClient();
    const { data: companyUser } = await adminClient
      .from("company_users")
      .select("company_id")
      .eq("id", session.userId)
      .maybeSingle();

    const companyId = companyUser?.company_id;
    if (!companyId) {
      return {
        isValid: false,
        errorReason: "Retailer company not found.",
        totalDiscount: 0,
        finalSubtotal: 0,
      };
    }

    return await evaluatePromotionsForCart(items, couponCode, companyId);
  } catch (err: any) {
    console.error("[evaluateCartPromotionsAction] Error:", err);
    return {
      isValid: false,
      errorReason: err.message || "Failed to evaluate promotion.",
      totalDiscount: 0,
      finalSubtotal: 0,
    };
  }
}

// ----------------------------------------------------------------------
// ADMIN ACTIONS
// ----------------------------------------------------------------------

export interface AdminPromotionListFilters {
  status?: string;
  search?: string;
  triggerType?: string;
}

export interface AdminPromotionSummary extends PromotionRecord {
  usage_count: number;
  orders_count: number;
  total_discount_given: number;
  creator_email?: string | null;
}

/**
 * Fetch promotions list for Admin table
 */
export async function getAdminPromotionsAction(
  filters?: AdminPromotionListFilters
): Promise<{ success: boolean; promotions?: AdminPromotionSummary[]; error?: string }> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    let query = adminClient
      .from("promotions")
      .select(`
        *,
        promotion_products(product_id),
        promotion_brands(brand_id),
        promotion_categories(category_code),
        promotion_retailers(company_id),
        promotion_usages(id, discount_amount, order_id)
      `)
      .order("created_at", { ascending: false });

    if (filters?.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }
    if (filters?.triggerType && filters.triggerType !== "all") {
      query = query.eq("trigger_type", filters.triggerType);
    }
    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
    }

    const { data: rawPromos, error } = await query;
    if (error) throw error;

    const promotions: AdminPromotionSummary[] = (rawPromos || []).map((p: any) => {
      const usages = p.promotion_usages || [];
      const totalDisc = usages.reduce((acc: number, u: any) => acc + Number(u.discount_amount || 0), 0);
      const orders = new Set(usages.map((u: any) => u.order_id)).size;

      return {
        ...p,
        discount_value: Number(p.discount_value || 0),
        minimum_spend: Number(p.minimum_spend || 0),
        maximum_discount: p.maximum_discount ? Number(p.maximum_discount) : null,
        product_ids: (p.promotion_products || []).map((x: any) => x.product_id),
        brand_ids: (p.promotion_brands || []).map((x: any) => x.brand_id),
        category_codes: (p.promotion_categories || []).map((x: any) => x.category_code),
        retailer_ids: (p.promotion_retailers || []).map((x: any) => x.company_id),
        usage_count: usages.length,
        orders_count: orders,
        total_discount_given: Math.round(totalDisc * 100) / 100,
      };
    });

    return { success: true, promotions };
  } catch (err: any) {
    console.error("[getAdminPromotionsAction] Error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch single promotion detail with usage history
 */
export async function getAdminPromotionDetailAction(id: string): Promise<{
  success: boolean;
  promotion?: AdminPromotionSummary;
  usages?: Array<{
    id: string;
    order_id: string;
    order_number: string;
    company_name: string;
    discount_amount: number;
    created_at: string;
    order_status: string;
    total_amount: number;
  }>;
  error?: string;
}> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    const { data: p, error } = await adminClient
      .from("promotions")
      .select(`
        *,
        promotion_products(product_id),
        promotion_brands(brand_id),
        promotion_categories(category_code),
        promotion_retailers(company_id)
      `)
      .eq("id", id)
      .single();

    if (error || !p) throw error || new Error("Promotion not found");

    // Fetch detailed usages
    const { data: rawUsages } = await adminClient
      .from("promotion_usages")
      .select(`
        id,
        order_id,
        discount_amount,
        created_at,
        companies(name),
        retailer_orders(order_number, order_status, total_amount)
      `)
      .eq("promotion_id", id)
      .order("created_at", { ascending: false });

    const usages = (rawUsages || []).map((u: any) => ({
      id: u.id,
      order_id: u.order_id,
      order_number: u.retailer_orders?.order_number || "Unknown",
      company_name: u.companies?.name || "Unknown Retailer",
      discount_amount: Number(u.discount_amount || 0),
      created_at: u.created_at,
      order_status: u.retailer_orders?.order_status || "submitted",
      total_amount: Number(u.retailer_orders?.total_amount || 0),
    }));

    const totalDisc = usages.reduce((acc, u) => acc + u.discount_amount, 0);
    const promoSummary: AdminPromotionSummary = {
      ...p,
      discount_value: Number(p.discount_value || 0),
      minimum_spend: Number(p.minimum_spend || 0),
      maximum_discount: p.maximum_discount ? Number(p.maximum_discount) : null,
      product_ids: (p.promotion_products || []).map((x: any) => x.product_id),
      brand_ids: (p.promotion_brands || []).map((x: any) => x.brand_id),
      category_codes: (p.promotion_categories || []).map((x: any) => x.category_code),
      retailer_ids: (p.promotion_retailers || []).map((x: any) => x.company_id),
      usage_count: usages.length,
      orders_count: new Set(usages.map((u) => u.order_id)).size,
      total_discount_given: Math.round(totalDisc * 100) / 100,
    };

    return { success: true, promotion: promoSummary, usages };
  } catch (err: any) {
    console.error("[getAdminPromotionDetailAction] Error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch available products, brands, categories, and retailers for Promotion Form dropdowns
 */
export async function getAdminPromotionFormOptionsAction(): Promise<{
  success: boolean;
  products: Array<{ id: string; name: string; sku: string; brand_name: string }>;
  brands: Array<{ id: string; name: string }>;
  categories: Array<{ code: string; label: string }>;
  retailers: Array<{ id: string; name: string; code?: string }>;
  error?: string;
}> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    const [prodsRes, brandsRes, catsRes, retRes] = await Promise.all([
      adminClient
        .from("products")
        .select("id, name, letusto_sku, manufacture_sku, brands(name)")
        .order("name", { ascending: true }),
      adminClient.from("brands").select("id, name").order("name", { ascending: true }),
      adminClient.from("categories").select("code, name_ko, name_en").order("code", { ascending: true }),
      adminClient
        .from("companies")
        .select("id, name, company_code")
        .eq("company_type", "RETAILER")
        .order("name", { ascending: true }),
    ]);

    const products = (prodsRes.data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      sku: p.letusto_sku || p.manufacture_sku || "SKU",
      brand_name: p.brands?.name || "",
    }));

    const brands = (brandsRes.data || []).map((b: any) => ({
      id: b.id,
      name: b.name,
    }));

    const categories = (catsRes.data || []).map((c: any) => ({
      code: c.code,
      label: c.name_en ? `${c.name_en} (${c.name_ko})` : c.name_ko || c.code,
    }));

    const retailers = (retRes.data || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      code: r.company_code || "",
    }));

    return {
      success: true,
      products,
      brands,
      categories,
      retailers,
    };
  } catch (err: any) {
    console.error("[getAdminPromotionFormOptionsAction] Error:", err);
    return {
      success: false,
      products: [],
      brands: [],
      categories: [],
      retailers: [],
      error: err.message,
    };
  }
}

export interface SavePromotionPayload {
  name: string;
  internal_description?: string;
  trigger_type: "coupon" | "automatic";
  code?: string;
  discount_type: "percentage" | "fixed_amount" | "unit_discount" | "bogo";
  discount_value: number;
  status: PromotionStatus;
  start_at?: string | null;
  end_at?: string | null;
  no_expiration: boolean;
  applies_to_scope: "all" | "selected_products" | "selected_brands" | "selected_categories";
  retailer_scope: "all" | "selected_retailers";
  minimum_spend?: number;
  minimum_quantity?: number;
  maximum_discount?: number | null;
  total_usage_limit?: number | null;
  per_retailer_usage_limit?: number | null;
  combinable_with_quantity_tiers: boolean;
  combinable_with_automatic_promotions: boolean;
  bogo_buy_quantity?: number;
  bogo_get_product_id?: string | null;
  bogo_get_quantity?: number;
  bogo_discount_percent?: number;

  product_ids?: string[];
  brand_ids?: string[];
  category_codes?: string[];
  retailer_ids?: string[];
}

/**
 * Create a new Promotion
 */
export async function createAdminPromotionAction(
  payload: SavePromotionPayload
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const session = await verifyAdminSession();
    const adminClient = createAdminClient();

    if (!payload.name?.trim()) {
      return { success: false, error: "Promotion name is required." };
    }

    // Schedule validation
    if (!payload.no_expiration) {
      if (!payload.start_at || !payload.end_at) {
        return { success: false, error: "Start and end dates are required when expiration is enabled." };
      }
      const startTime = new Date(payload.start_at).getTime();
      const endTime = new Date(payload.end_at).getTime();
      if (isNaN(startTime) || isNaN(endTime)) {
        return { success: false, error: "Invalid date format for schedule." };
      }
      if (endTime <= startTime) {
        return { success: false, error: "End date and time must be after start date and time." };
      }
    }

    let code = payload.code?.trim().toUpperCase() || null;
    if (payload.trigger_type === "coupon") {
      if (!code) {
        return { success: false, error: "Coupon code is required for coupon promotions." };
      }
      // Check duplicate code
      const { data: existing } = await adminClient
        .from("promotions")
        .select("id")
        .eq("trigger_type", "coupon")
        .ilike("code", code)
        .neq("status", "archived")
        .maybeSingle();

      if (existing) {
        return { success: false, error: "This coupon code is already in use." };
      }
    } else {
      code = null;
    }

    const { data: inserted, error: insertErr } = await adminClient
      .from("promotions")
      .insert({
        name: payload.name.trim(),
        internal_description: payload.internal_description?.trim() || null,
        trigger_type: payload.trigger_type,
        code,
        discount_type: payload.discount_type,
        discount_value: Number(payload.discount_value || 0),
        status: payload.status || "active",
        start_at: payload.start_at || null,
        end_at: payload.end_at || null,
        no_expiration: payload.no_expiration ?? false,
        applies_to_scope: payload.applies_to_scope || "all",
        retailer_scope: payload.retailer_scope || "all",
        minimum_spend: Number(payload.minimum_spend || 0),
        minimum_quantity: Number(payload.minimum_quantity || 0),
        maximum_discount: payload.maximum_discount ? Number(payload.maximum_discount) : null,
        total_usage_limit: payload.total_usage_limit ? Number(payload.total_usage_limit) : null,
        per_retailer_usage_limit: payload.per_retailer_usage_limit ? Number(payload.per_retailer_usage_limit) : null,
        combinable_with_quantity_tiers: payload.combinable_with_quantity_tiers ?? true,
        combinable_with_automatic_promotions: payload.combinable_with_automatic_promotions ?? false,
        bogo_buy_quantity: payload.bogo_buy_quantity ? Number(payload.bogo_buy_quantity) : 1,
        bogo_get_product_id: payload.bogo_get_product_id || null,
        bogo_get_quantity: payload.bogo_get_quantity ? Number(payload.bogo_get_quantity) : 1,
        bogo_discount_percent: Number(payload.bogo_discount_percent ?? 100),
        created_by: session.userId,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) throw insertErr || new Error("Failed to insert promotion");

    const promoId = inserted.id;

    // Attach scope junctions
    if (payload.applies_to_scope === "selected_products" && payload.product_ids?.length) {
      await adminClient.from("promotion_products").insert(
        payload.product_ids.map((pid) => ({ promotion_id: promoId, product_id: pid }))
      );
    } else if (payload.applies_to_scope === "selected_brands" && payload.brand_ids?.length) {
      await adminClient.from("promotion_brands").insert(
        payload.brand_ids.map((bid) => ({ promotion_id: promoId, brand_id: bid }))
      );
    } else if (payload.applies_to_scope === "selected_categories" && payload.category_codes?.length) {
      await adminClient.from("promotion_categories").insert(
        payload.category_codes.map((cc) => ({ promotion_id: promoId, category_code: cc }))
      );
    }

    if (payload.retailer_scope === "selected_retailers" && payload.retailer_ids?.length) {
      await adminClient.from("promotion_retailers").insert(
        payload.retailer_ids.map((rid) => ({ promotion_id: promoId, company_id: rid }))
      );
    }

    revalidatePath("/admin/sales/promotions");
    return { success: true, id: promoId };
  } catch (err: any) {
    console.error("[createAdminPromotionAction] Error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Update an existing Promotion
 */
export async function updateAdminPromotionAction(
  id: string,
  payload: SavePromotionPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    // Schedule validation
    if (!payload.no_expiration) {
      if (!payload.start_at || !payload.end_at) {
        return { success: false, error: "Start and end dates are required when expiration is enabled." };
      }
      const startTime = new Date(payload.start_at).getTime();
      const endTime = new Date(payload.end_at).getTime();
      if (isNaN(startTime) || isNaN(endTime)) {
        return { success: false, error: "Invalid date format for schedule." };
      }
      if (endTime <= startTime) {
        return { success: false, error: "End date and time must be after start date and time." };
      }
    }

    let code = payload.code?.trim().toUpperCase() || null;
    if (payload.trigger_type === "coupon") {
      if (!code) {
        return { success: false, error: "Coupon code is required for coupon promotions." };
      }
      const { data: existing } = await adminClient
        .from("promotions")
        .select("id")
        .eq("trigger_type", "coupon")
        .ilike("code", code)
        .neq("id", id)
        .neq("status", "archived")
        .maybeSingle();

      if (existing) {
        return { success: false, error: "This coupon code is already in use." };
      }
    } else {
      code = null;
    }

    const { error: updateErr } = await adminClient
      .from("promotions")
      .update({
        name: payload.name.trim(),
        internal_description: payload.internal_description?.trim() || null,
        trigger_type: payload.trigger_type,
        code,
        discount_type: payload.discount_type,
        discount_value: Number(payload.discount_value || 0),
        status: payload.status,
        start_at: payload.start_at || null,
        end_at: payload.end_at || null,
        no_expiration: payload.no_expiration ?? false,
        applies_to_scope: payload.applies_to_scope,
        retailer_scope: payload.retailer_scope,
        minimum_spend: Number(payload.minimum_spend || 0),
        minimum_quantity: Number(payload.minimum_quantity || 0),
        maximum_discount: payload.maximum_discount ? Number(payload.maximum_discount) : null,
        total_usage_limit: payload.total_usage_limit ? Number(payload.total_usage_limit) : null,
        per_retailer_usage_limit: payload.per_retailer_usage_limit ? Number(payload.per_retailer_usage_limit) : null,
        combinable_with_quantity_tiers: payload.combinable_with_quantity_tiers ?? true,
        combinable_with_automatic_promotions: payload.combinable_with_automatic_promotions ?? false,
        bogo_buy_quantity: payload.bogo_buy_quantity ? Number(payload.bogo_buy_quantity) : 1,
        bogo_get_product_id: payload.bogo_get_product_id || null,
        bogo_get_quantity: payload.bogo_get_quantity ? Number(payload.bogo_get_quantity) : 1,
        bogo_discount_percent: Number(payload.bogo_discount_percent ?? 100),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) throw updateErr;

    // Refresh scope junction records
    await Promise.all([
      adminClient.from("promotion_products").delete().eq("promotion_id", id),
      adminClient.from("promotion_brands").delete().eq("promotion_id", id),
      adminClient.from("promotion_categories").delete().eq("promotion_id", id),
      adminClient.from("promotion_retailers").delete().eq("promotion_id", id),
    ]);

    if (payload.applies_to_scope === "selected_products" && payload.product_ids?.length) {
      await adminClient.from("promotion_products").insert(
        payload.product_ids.map((pid) => ({ promotion_id: id, product_id: pid }))
      );
    } else if (payload.applies_to_scope === "selected_brands" && payload.brand_ids?.length) {
      await adminClient.from("promotion_brands").insert(
        payload.brand_ids.map((bid) => ({ promotion_id: id, brand_id: bid }))
      );
    } else if (payload.applies_to_scope === "selected_categories" && payload.category_codes?.length) {
      await adminClient.from("promotion_categories").insert(
        payload.category_codes.map((cc) => ({ promotion_id: id, category_code: cc }))
      );
    }

    if (payload.retailer_scope === "selected_retailers" && payload.retailer_ids?.length) {
      await adminClient.from("promotion_retailers").insert(
        payload.retailer_ids.map((rid) => ({ promotion_id: id, company_id: rid }))
      );
    }

    revalidatePath("/admin/sales/promotions");
    return { success: true };
  } catch (err: any) {
    console.error("[updateAdminPromotionAction] Error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Quick status changer: pause, resume, archive
 */
export async function setAdminPromotionStatusAction(
  id: string,
  status: PromotionStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("promotions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/admin/sales/promotions");
    return { success: true };
  } catch (err: any) {
    console.error("[setAdminPromotionStatusAction] Error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Delete draft promotion with no order usage history
 */
export async function deleteAdminDraftPromotionAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    // Check usage
    const { data: usage } = await adminClient
      .from("promotion_usages")
      .select("id")
      .eq("promotion_id", id)
      .limit(1);

    if (usage && usage.length > 0) {
      return {
        success: false,
        error: "Cannot delete a promotion with order history. Please Archive it instead to protect historical order integrity.",
      };
    }

    const { error } = await adminClient.from("promotions").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/sales/promotions");
    return { success: true };
  } catch (err: any) {
    console.error("[deleteAdminDraftPromotionAction] Error:", err);
    return { success: false, error: err.message };
  }
}
