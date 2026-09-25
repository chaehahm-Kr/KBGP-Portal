"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProductInventory } from "@/lib/inventory/actions";
import { getProductCostSummary } from "@/lib/landed-cost/actions";
import { getSignedFileUrl } from "@/lib/files/storage";
import { resolveEffectiveSku } from "@/lib/product/types";

export interface UpdateTradingPricingInput {
  wholesale_price: number;
  map_price?: number | null;
  srp_price?: number | null;
  note?: string | null;
  reason?: string;
}

export interface UpdateTradingPromotionInput {
  promo_wholesale_price: number | null;
  promo_start_date?: string | null;
  promo_end_date?: string | null;
  note?: string | null;
  reason?: string;
}

export interface UpdateTradingCostOverrideInput {
  override_cost: number | null;
  reason: string;
}

export async function getTradingProductDetailData(productId: string) {
  await verifyAdminSession();
  const adminSupabase = createAdminClient();

  const { data: product, error: prodErr } = await adminSupabase
    .from("products")
    .select(`
      id, name, name_en, category, volume, estimated_retail_price, brand_id, company_id,
      description, bullet_points, origin, lead_time,
      parent_sku, child_sku, manufacture_sku, letusto_sku, upc, ean,
      price_krw_retail, price_krw_wholesale, price_usd_fob, price_additional_info,
      item_width, item_depth, item_height, item_weight,
      package_width, package_depth, package_height, package_weight,
      selection_status, sales_status, category_code, trading_status
    `)
    .eq("id", productId)
    .maybeSingle();

  if (prodErr || !product) {
    return null;
  }

  const { data: brand } = await adminSupabase
    .from("brands")
    .select("name")
    .eq("id", product.brand_id)
    .maybeSingle();

  const { data: company } = await adminSupabase
    .from("companies")
    .select("name")
    .eq("id", product.company_id)
    .maybeSingle();

  const { data: dbCategories } = await adminSupabase
    .from("categories")
    .select("code, name_ko, parent_code, depth");
  const categoryMap = new Map((dbCategories ?? []).map((c) => [c.code, c]));

  const getCategoryFullPath = (code: string | null | undefined): string => {
    if (!code) return "";
    const path: string[] = [];
    let current = categoryMap.get(code);
    while (current) {
      path.unshift(current.name_ko);
      current = current.parent_code ? categoryMap.get(current.parent_code) : undefined;
    }
    return path.join(" > ");
  };

  const categoryFullPath = product.category_code ? getCategoryFullPath(product.category_code) : "";

  const { data: images } = await adminSupabase
    .from("product_images")
    .select("storage_path")
    .eq("product_id", productId)
    .order("position", { ascending: true })
    .limit(1);

  let photoUrl: string | null = null;
  if (images && images.length > 0 && images[0].storage_path) {
    try {
      photoUrl = await getSignedFileUrl(images[0].storage_path);
    } catch {
      // Ignore URL error
    }
  }

  const priceAddInfo = (product.price_additional_info as any) || {};
  const adminOverrides = priceAddInfo.admin_overrides || {};
  const tradingOverrides = priceAddInfo.trading_overrides || {};

  const effectiveManufactureSku = resolveEffectiveSku(adminOverrides.manufacture_sku, product.manufacture_sku);
  const effectiveLetustoSku = resolveEffectiveSku(adminOverrides.letusto_sku, product.letusto_sku);

  // Fetch Inventory breakdown & movements
  const { balances, movements } = await getProductInventory(productId);

  // Fetch active warehouses
  const { data: dbWarehouses } = await adminSupabase
    .from("warehouses")
    .select("id, name, code, status")
    .eq("status", "active")
    .order("name", { ascending: true });

  // Fetch PO history
  const { data: poHistory } = await adminSupabase
    .from("purchase_order_lines")
    .select(`
      id, qty, unit_cost, created_at,
      purchase_orders!inner(id, po_number, order_date, po_status, supplier_id, companies:supplier_id(name))
    `)
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  // Fetch Shipment history
  const { data: shipmentHistory } = await adminSupabase
    .from("inbound_shipment_lines")
    .select(`
      id, shipped_qty, created_at,
      inbound_shipments!inner(id, shipment_number, status, shipping_method, etd, eta, destination_warehouse_id, warehouses:destination_warehouse_id(name, code))
    `)
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  // Fetch Receiving history
  const { data: receivingHistory } = await adminSupabase
    .from("receiving_lines")
    .select(`
      id, received_qty, damaged_qty, hold_qty, created_at,
      receivings!inner(id, receiving_number, status, received_date, warehouse_id, warehouses:warehouse_id(name, code))
    `)
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  // Fetch Cost Summary
  const costSummary = await getProductCostSummary(productId);

  // Fetch History / Change log entries
  let historyLogs: any[] = [];
  try {
    const { data: dbLogs } = await adminSupabase
      .from("trading_product_history")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    
    if (dbLogs && dbLogs.length > 0) {
      historyLogs = dbLogs;
    } else if (priceAddInfo.trading_history) {
      historyLogs = priceAddInfo.trading_history;
    }
  } catch {
    if (priceAddInfo.trading_history) {
      historyLogs = priceAddInfo.trading_history;
    }
  }

  // Cost Snapshot
  const baseLandedCost = costSummary?.latestLandedCost || 0;

  // Read override cost from DB direct column or priceAddInfo fallback
  const directOverrideCost = (product as any).override_landed_cost !== undefined ? (product as any).override_landed_cost : undefined;
  const jsonOverrideCost = tradingOverrides.override_landed_cost;
  
  const overrideLandedCost = directOverrideCost !== undefined && directOverrideCost !== null
    ? Number(directOverrideCost)
    : (jsonOverrideCost !== undefined && jsonOverrideCost !== null ? Number(jsonOverrideCost) : null);

  const overrideReason = (product as any).override_landed_cost_reason || tradingOverrides.override_landed_cost_reason || null;
  const overrideUpdatedAt = (product as any).override_landed_cost_updated_at || tradingOverrides.override_landed_cost_updated_at || null;

  const effectiveLandedCost = overrideLandedCost !== null && overrideLandedCost > 0
    ? overrideLandedCost
    : baseLandedCost;

  // Pricing Snapshot (Priority: Trading Override > Catalog Master)
  const defaultWholesale = adminOverrides.price_usd_fob !== undefined
    ? parseFloat(adminOverrides.price_usd_fob)
    : (product.price_usd_fob || 0);

  const defaultSrp = adminOverrides.estimated_retail_price !== undefined
    ? parseFloat(adminOverrides.estimated_retail_price)
    : (product.estimated_retail_price || 0);

  const defaultMap = defaultSrp > 0 ? defaultSrp : 0;

  const directTradingWholesale = (product as any).trading_wholesale_price;
  const jsonTradingWholesale = tradingOverrides.wholesale_price;
  const operationalWholesale = directTradingWholesale !== undefined && directTradingWholesale !== null
    ? Number(directTradingWholesale)
    : (jsonTradingWholesale !== undefined && jsonTradingWholesale !== null ? Number(jsonTradingWholesale) : defaultWholesale);

  const directPromoWholesale = (product as any).trading_promo_wholesale_price;
  const jsonPromoWholesale = tradingOverrides.promo_wholesale_price;
  const promoWholesale = directPromoWholesale !== undefined && directPromoWholesale !== null
    ? Number(directPromoWholesale)
    : (jsonPromoWholesale !== undefined && jsonPromoWholesale !== null ? Number(jsonPromoWholesale) : null);

  const promoStartDate = (product as any).trading_promo_start_date || tradingOverrides.promo_start_date || null;
  const promoEndDate = (product as any).trading_promo_end_date || tradingOverrides.promo_end_date || null;

  const directTradingMap = (product as any).trading_map_price;
  const jsonTradingMap = tradingOverrides.map_price;
  const mapPrice = directTradingMap !== undefined && directTradingMap !== null
    ? Number(directTradingMap)
    : (jsonTradingMap !== undefined && jsonTradingMap !== null ? Number(jsonTradingMap) : defaultMap);

  const directTradingSrp = (product as any).trading_srp_price;
  const jsonTradingSrp = tradingOverrides.srp_price;
  const srpPrice = directTradingSrp !== undefined && directTradingSrp !== null
    ? Number(directTradingSrp)
    : (jsonTradingSrp !== undefined && jsonTradingSrp !== null ? Number(jsonTradingSrp) : defaultSrp);

  const pricingNote = (product as any).trading_pricing_note || tradingOverrides.pricing_note || null;
  const isPricingActive = (product as any).trading_pricing_active !== undefined ? (product as any).trading_pricing_active : (tradingOverrides.is_active ?? true);

  // Check if promo is currently active
  const now = new Date();
  const isPromoActive = promoWholesale !== null && promoWholesale > 0 && (
    (!promoStartDate || new Date(promoStartDate) <= now) &&
    (!promoEndDate || new Date(promoEndDate) >= now)
  );

  // Calculate Margins
  const effectiveWholesale = isPromoActive ? promoWholesale : operationalWholesale;

  const ourMarginUsd = effectiveWholesale - effectiveLandedCost;
  const ourMarginPercent = effectiveWholesale > 0 ? (ourMarginUsd / effectiveWholesale) * 100 : 0;

  const baseOurMarginUsd = operationalWholesale - effectiveLandedCost;
  const baseOurMarginPercent = operationalWholesale > 0 ? (baseOurMarginUsd / operationalWholesale) * 100 : 0;

  const retailerMarginUsd = srpPrice - effectiveWholesale;
  const retailerMarginPercent = srpPrice > 0 ? (retailerMarginUsd / srpPrice) * 100 : 0;

  const baseRetailerMarginUsd = srpPrice - operationalWholesale;
  const baseRetailerMarginPercent = srpPrice > 0 ? (baseRetailerMarginUsd / srpPrice) * 100 : 0;

  const resolvedProduct = {
    id: product.id,
    name: product.name,
    display_name: adminOverrides.name_en || product.name_en || adminOverrides.name || product.name,
    manufacture_sku: effectiveManufactureSku,
    letusto_sku: effectiveLetustoSku,
    parent_sku: adminOverrides.parent_sku !== undefined ? adminOverrides.parent_sku : product.parent_sku,
    child_sku: adminOverrides.child_sku !== undefined ? adminOverrides.child_sku : product.child_sku,
    category: product.category,
    brand_id: product.brand_id,
    company_id: product.company_id,
    companyName: company?.name || "(미지정 회사)",
    brandName: brand?.name || "(미지정 브랜드)",
    photoUrl,
    selection_status: product.selection_status,
    sales_status: product.sales_status,
    trading_status:
      product.trading_status === "active" || product.trading_status === "historical"
        ? product.trading_status
        : product.selection_status === "SELECTED"
        ? "active"
        : "inactive",
    category_code: product.category_code || null,
    category_full_path: categoryFullPath,
    
    // Default Catalog Pricing
    defaultWholesale,
    defaultSrp,
    defaultMap,

    // Live Operational Pricing
    operationalWholesale,
    promoWholesale,
    promoStartDate,
    promoEndDate,
    isPromoActive,
    mapPrice,
    srpPrice,
    pricingNote,
    isPricingActive,
    hasPricingOverride: (
      (directTradingWholesale !== undefined && directTradingWholesale !== null) ||
      (jsonTradingWholesale !== undefined && jsonTradingWholesale !== null) ||
      (directTradingMap !== undefined && directTradingMap !== null) ||
      (jsonTradingMap !== undefined && jsonTradingMap !== null) ||
      (directTradingSrp !== undefined && directTradingSrp !== null) ||
      (jsonTradingSrp !== undefined && jsonTradingSrp !== null)
    ),

    // Cost Snapshot & 3-Layer Model
    baseLandedCost,
    overrideLandedCost,
    overrideReason,
    overrideUpdatedAt,
    effectiveLandedCost,
    hasCostOverride: overrideLandedCost !== null && overrideLandedCost > 0,

    // Margins
    ourMarginUsd,
    ourMarginPercent,
    baseOurMarginUsd,
    baseOurMarginPercent,
    retailerMarginUsd,
    retailerMarginPercent,
    baseRetailerMarginUsd,
    baseRetailerMarginPercent,
  };

  return {
    product: resolvedProduct,
    balances,
    movements,
    warehouses: dbWarehouses ?? [],
    poHistory: poHistory || [],
    shipmentHistory: shipmentHistory || [],
    receivingHistory: receivingHistory || [],
    costSummary,
    historyLogs,
  };
}

export async function updateTradingPricing(productId: string, input: UpdateTradingPricingInput) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();

  const wholesale = Number(input.wholesale_price);
  if (isNaN(wholesale) || wholesale < 0) {
    throw new Error("올바른 도매 공급가를 입력해 주세요.");
  }

  const map = input.map_price !== undefined && input.map_price !== null ? Number(input.map_price) : null;
  const srp = input.srp_price !== undefined && input.srp_price !== null ? Number(input.srp_price) : null;
  const note = input.note || null;
  const reason = input.reason || "Operational pricing updated";

  // Get current product
  const { data: currentProd } = await supabase
    .from("products")
    .select("price_additional_info, trading_wholesale_price, trading_map_price, trading_srp_price")
    .eq("id", productId)
    .single();

  if (!currentProd) throw new Error("Product not found.");

  const priceAddInfo = (currentProd.price_additional_info as any) || {};
  const currentOverrides = priceAddInfo.trading_overrides || {};
  const currentHistory = priceAddInfo.trading_history || [];

  const beforeVal = {
    wholesale_price: (currentProd as any).trading_wholesale_price ?? currentOverrides.wholesale_price ?? null,
    map_price: (currentProd as any).trading_map_price ?? currentOverrides.map_price ?? null,
    srp_price: (currentProd as any).trading_srp_price ?? currentOverrides.srp_price ?? null,
  };

  const afterVal = {
    wholesale_price: wholesale,
    map_price: map,
    srp_price: srp,
    note,
  };

  const updatedOverrides = {
    ...currentOverrides,
    wholesale_price: wholesale,
    map_price: map,
    srp_price: srp,
    pricing_note: note,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  const historyEntry = {
    id: crypto.randomUUID(),
    product_id: productId,
    change_type: "PRICING",
    field_name: "trading_pricing",
    before_value: beforeVal,
    after_value: afterVal,
    reason,
    created_by: userId,
    created_at: new Date().toISOString(),
  };

  const updatedHistory = [historyEntry, ...currentHistory];

  const updatedPriceAddInfo = {
    ...priceAddInfo,
    trading_overrides: updatedOverrides,
    trading_history: updatedHistory,
  };

  // Build update object attempting both direct columns & JSONB fallback
  const updatePayload: any = {
    price_additional_info: updatedPriceAddInfo,
  };

  try {
    updatePayload.trading_wholesale_price = wholesale;
    updatePayload.trading_map_price = map;
    updatePayload.trading_srp_price = srp;
    updatePayload.trading_pricing_note = note;
  } catch {
    // Ignore if column doesn't exist
  }

  const { error } = await supabase
    .from("products")
    .update(updatePayload)
    .eq("id", productId);

  if (error) {
    // If direct column update fails due to schema mismatch, fall back to updating JSONB only
    const { error: fallbackErr } = await supabase
      .from("products")
      .update({ price_additional_info: updatedPriceAddInfo })
      .eq("id", productId);
    if (fallbackErr) throw new Error(`도매가 업데이트 실패: ${fallbackErr.message}`);
  }

  // Attempt insert into audit table if present
  try {
    await supabase.from("trading_product_history").insert({
      product_id: productId,
      change_type: "PRICING",
      field_name: "trading_pricing",
      before_value: beforeVal,
      after_value: afterVal,
      reason,
      created_by: userId,
    });
  } catch {
    // Ignore audit table error
  }

  revalidatePath(`/admin/products/trading/${productId}`);
  revalidatePath("/admin/products/trading");
  revalidatePath(`/admin/products/${productId}`);
  return { success: true };
}

export async function updateTradingPromotion(productId: string, input: UpdateTradingPromotionInput) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();

  const promoWholesale = input.promo_wholesale_price !== null && input.promo_wholesale_price !== undefined
    ? Number(input.promo_wholesale_price)
    : null;

  if (promoWholesale !== null && (isNaN(promoWholesale) || promoWholesale < 0)) {
    throw new Error("올바른 프로모션 공급가를 입력해 주세요.");
  }

  const startDate = input.promo_start_date || null;
  const endDate = input.promo_end_date || null;
  const note = input.note || null;
  const reason = input.reason || "Promotion updated";

  const { data: currentProd } = await supabase
    .from("products")
    .select("price_additional_info, trading_promo_wholesale_price")
    .eq("id", productId)
    .single();

  if (!currentProd) throw new Error("Product not found.");

  const priceAddInfo = (currentProd.price_additional_info as any) || {};
  const currentOverrides = priceAddInfo.trading_overrides || {};
  const currentHistory = priceAddInfo.trading_history || [];

  const beforeVal = {
    promo_wholesale_price: (currentProd as any).trading_promo_wholesale_price ?? currentOverrides.promo_wholesale_price ?? null,
    promo_start_date: currentOverrides.promo_start_date ?? null,
    promo_end_date: currentOverrides.promo_end_date ?? null,
  };

  const afterVal = {
    promo_wholesale_price: promoWholesale,
    promo_start_date: startDate,
    promo_end_date: endDate,
    note,
  };

  const updatedOverrides = {
    ...currentOverrides,
    promo_wholesale_price: promoWholesale,
    promo_start_date: startDate,
    promo_end_date: endDate,
    promo_note: note,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  const historyEntry = {
    id: crypto.randomUUID(),
    product_id: productId,
    change_type: "PROMOTION",
    field_name: "promo_pricing",
    before_value: beforeVal,
    after_value: afterVal,
    reason,
    created_by: userId,
    created_at: new Date().toISOString(),
  };

  const updatedHistory = [historyEntry, ...currentHistory];

  const updatedPriceAddInfo = {
    ...priceAddInfo,
    trading_overrides: updatedOverrides,
    trading_history: updatedHistory,
  };

  const updatePayload: any = {
    price_additional_info: updatedPriceAddInfo,
  };

  try {
    updatePayload.trading_promo_wholesale_price = promoWholesale;
    updatePayload.trading_promo_start_date = startDate;
    updatePayload.trading_promo_end_date = endDate;
  } catch {
    // Ignore direct column if missing
  }

  const { error } = await supabase
    .from("products")
    .update(updatePayload)
    .eq("id", productId);

  if (error) {
    const { error: fallbackErr } = await supabase
      .from("products")
      .update({ price_additional_info: updatedPriceAddInfo })
      .eq("id", productId);
    if (fallbackErr) throw new Error(`프로모션 업데이트 실패: ${fallbackErr.message}`);
  }

  try {
    await supabase.from("trading_product_history").insert({
      product_id: productId,
      change_type: "PROMOTION",
      field_name: "promo_pricing",
      before_value: beforeVal,
      after_value: afterVal,
      reason,
      created_by: userId,
    });
  } catch {
    // Ignore audit table error
  }

  revalidatePath(`/admin/products/trading/${productId}`);
  revalidatePath("/admin/products/trading");
  return { success: true };
}

export async function updateTradingCostOverride(productId: string, input: UpdateTradingCostOverrideInput) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();

  if (!input.reason || input.reason.trim().length === 0) {
    throw new Error("수입원가 오버라이드 사유(Reason)를 반드시 입력해야 합니다.");
  }

  const overrideCost = input.override_cost !== null && input.override_cost !== undefined
    ? Number(input.override_cost)
    : null;

  if (overrideCost !== null && (isNaN(overrideCost) || overrideCost < 0)) {
    throw new Error("올바른 수입원가 오버라이드 금액을 입력해 주세요 (0 이상).");
  }

  const { data: currentProd } = await supabase
    .from("products")
    .select("price_additional_info, override_landed_cost, override_landed_cost_reason")
    .eq("id", productId)
    .single();

  if (!currentProd) throw new Error("Product not found.");

  const priceAddInfo = (currentProd.price_additional_info as any) || {};
  const currentOverrides = priceAddInfo.trading_overrides || {};
  const currentHistory = priceAddInfo.trading_history || [];

  const beforeVal = {
    override_landed_cost: (currentProd as any).override_landed_cost ?? currentOverrides.override_landed_cost ?? null,
    reason: (currentProd as any).override_landed_cost_reason ?? currentOverrides.override_landed_cost_reason ?? null,
  };

  const afterVal = {
    override_landed_cost: overrideCost,
    reason: input.reason,
    updated_at: new Date().toISOString(),
  };

  const updatedOverrides = {
    ...currentOverrides,
    override_landed_cost: overrideCost,
    override_landed_cost_reason: input.reason,
    override_landed_cost_updated_at: new Date().toISOString(),
    override_landed_cost_updated_by: userId,
  };

  const historyEntry = {
    id: crypto.randomUUID(),
    product_id: productId,
    change_type: "COST_OVERRIDE",
    field_name: "override_landed_cost",
    before_value: beforeVal,
    after_value: afterVal,
    reason: input.reason,
    created_by: userId,
    created_at: new Date().toISOString(),
  };

  const updatedHistory = [historyEntry, ...currentHistory];

  const updatedPriceAddInfo = {
    ...priceAddInfo,
    trading_overrides: updatedOverrides,
    trading_history: updatedHistory,
  };

  const updatePayload: any = {
    price_additional_info: updatedPriceAddInfo,
  };

  try {
    updatePayload.override_landed_cost = overrideCost;
    updatePayload.override_landed_cost_reason = input.reason;
    updatePayload.override_landed_cost_updated_at = new Date().toISOString();
    updatePayload.override_landed_cost_updated_by = userId;
  } catch {
    // Ignore if column missing
  }

  const { error } = await supabase
    .from("products")
    .update(updatePayload)
    .eq("id", productId);

  if (error) {
    const { error: fallbackErr } = await supabase
      .from("products")
      .update({ price_additional_info: updatedPriceAddInfo })
      .eq("id", productId);
    if (fallbackErr) throw new Error(`수입원가 오버라이드 저장 실패: ${fallbackErr.message}`);
  }

  try {
    await supabase.from("trading_product_history").insert({
      product_id: productId,
      change_type: "COST_OVERRIDE",
      field_name: "override_landed_cost",
      before_value: beforeVal,
      after_value: afterVal,
      reason: input.reason,
      created_by: userId,
    });
  } catch {
    // Ignore audit table error
  }

  revalidatePath(`/admin/products/trading/${productId}`);
  revalidatePath("/admin/products/trading");
  return { success: true };
}

export async function clearTradingCostOverride(productId: string, reason: string) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();

  if (!reason || reason.trim().length === 0) {
    throw new Error("오버라이드 해제 사유를 입력해야 합니다.");
  }

  const { data: currentProd } = await supabase
    .from("products")
    .select("price_additional_info, override_landed_cost")
    .eq("id", productId)
    .single();

  if (!currentProd) throw new Error("Product not found.");

  const priceAddInfo = (currentProd.price_additional_info as any) || {};
  const currentOverrides = priceAddInfo.trading_overrides || {};
  const currentHistory = priceAddInfo.trading_history || [];

  const beforeVal = {
    override_landed_cost: (currentProd as any).override_landed_cost ?? currentOverrides.override_landed_cost ?? null,
  };

  const afterVal = {
    override_landed_cost: null,
    cleared_at: new Date().toISOString(),
  };

  const updatedOverrides = {
    ...currentOverrides,
    override_landed_cost: null,
    override_landed_cost_reason: null,
    override_landed_cost_updated_at: new Date().toISOString(),
    override_landed_cost_updated_by: userId,
  };

  const historyEntry = {
    id: crypto.randomUUID(),
    product_id: productId,
    change_type: "COST_OVERRIDE",
    field_name: "override_landed_cost",
    before_value: beforeVal,
    after_value: afterVal,
    reason: `Cleared override: ${reason}`,
    created_by: userId,
    created_at: new Date().toISOString(),
  };

  const updatedHistory = [historyEntry, ...currentHistory];

  const updatedPriceAddInfo = {
    ...priceAddInfo,
    trading_overrides: updatedOverrides,
    trading_history: updatedHistory,
  };

  const updatePayload: any = {
    price_additional_info: updatedPriceAddInfo,
  };

  try {
    updatePayload.override_landed_cost = null;
    updatePayload.override_landed_cost_reason = null;
    updatePayload.override_landed_cost_updated_at = new Date().toISOString();
    updatePayload.override_landed_cost_updated_by = userId;
  } catch {
    // Ignore
  }

  const { error } = await supabase
    .from("products")
    .update(updatePayload)
    .eq("id", productId);

  if (error) {
    await supabase
      .from("products")
      .update({ price_additional_info: updatedPriceAddInfo })
      .eq("id", productId);
  }

  revalidatePath(`/admin/products/trading/${productId}`);
  revalidatePath("/admin/products/trading");
  return { success: true };
}
