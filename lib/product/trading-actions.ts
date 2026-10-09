"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProductInventory } from "@/lib/inventory/actions";
import { getProductCostSummary } from "@/lib/landed-cost/actions";
import { getSignedFileUrl } from "@/lib/files/storage";
import { resolveEffectiveSku } from "@/lib/product/types";
import { resolveProductPricing } from "@/lib/product/pricing-resolver";
import {
  evaluateTradingOrderability,
  evaluateProductRegistrationStatus,
} from "@/lib/product/registration-status";

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
  reason?: string | null;
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
      selection_status, sales_status, category_code, trading_status, retailer_visibility,
      trading_wholesale_price, trading_promo_wholesale_price, trading_promo_start_date, trading_promo_end_date, trading_srp_price, trading_map_price
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
    .order("position", { ascending: true });

  const photoUrls: string[] = [];
  if (images && images.length > 0) {
    for (const img of images) {
      if (img.storage_path) {
        try {
          const url = await getSignedFileUrl(img.storage_path);
          if (url) photoUrls.push(url);
        } catch {
          // Ignore URL error for individual image
        }
      }
    }
  }
  const photoUrl: string | null = photoUrls.length > 0 ? photoUrls[0] : null;

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
      purchase_orders!inner(id, po_number, order_date, po_status, fulfillment_status, supplier_id, companies:supplier_id(name))
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

  // CANONICAL INBOUND CALCULATION LOGIC
  const { data: openShipmentLines } = await adminSupabase
    .from("inbound_shipment_lines")
    .select(`
      id, shipped_qty, product_id, inbound_shipment_id, purchase_order_line_id,
      inbound_shipments!inner(
        id, shipment_number, status, eta, destination_warehouse_id,
        warehouses:destination_warehouse_id(name, code)
      )
    `)
    .eq("product_id", productId)
    .not("inbound_shipments.status", "in", '("CANCELLED", "COMPLETED")');

  const openShipmentLineIds = (openShipmentLines ?? []).map(sl => sl.id);

  let finalizedReceivedByShipmentLine: Record<string, number> = {};
  if (openShipmentLineIds.length > 0) {
    const { data: recLines } = await adminSupabase
      .from("receiving_lines")
      .select(`
        inbound_shipment_line_id, received_qty,
        receivings!inner(status)
      `)
      .in("inbound_shipment_line_id", openShipmentLineIds)
      .eq("receivings.status", "FINALIZED");

    (recLines ?? []).forEach(rl => {
      const lid = rl.inbound_shipment_line_id;
      if (lid) {
        finalizedReceivedByShipmentLine[lid] = (finalizedReceivedByShipmentLine[lid] || 0) + Number(rl.received_qty);
      }
    });
  }

  let totalIncomingFromShipments = 0;
  const activeInboundShipmentIds = new Set<string>();
  const etas: { eta: string; warehouseName: string; warehouseCode: string }[] = [];

  (openShipmentLines ?? []).forEach((sl: any) => {
    const shipment = Array.isArray(sl.inbound_shipments) ? sl.inbound_shipments[0] : sl.inbound_shipments;
    if (!shipment) return;

    const shipped = Number(sl.shipped_qty || 0);
    const finalizedRec = finalizedReceivedByShipmentLine[sl.id] || 0;
    const remaining = Math.max(0, shipped - finalizedRec);

    if (shipment.status !== "RECEIVED" || remaining > 0) {
      totalIncomingFromShipments += remaining;
      activeInboundShipmentIds.add(shipment.id);

      if (shipment.eta) {
        const wh = Array.isArray(shipment.warehouses) ? shipment.warehouses[0] : shipment.warehouses;
        etas.push({
          eta: shipment.eta,
          warehouseName: wh?.name || "-",
          warehouseCode: wh?.code || "-",
        });
      }
    }
  });

  const { data: openPoLines } = await adminSupabase
    .from("purchase_order_lines")
    .select(`
      id, qty, product_id, purchase_order_id,
      purchase_orders!inner(id, po_number, po_status, fulfillment_status, order_date, eta)
    `)
    .eq("product_id", productId)
    .not("purchase_orders.po_status", "in", '("DRAFT", "CANCELLED")')
    .not("purchase_orders.fulfillment_status", "eq", "COMPLETED");

  let totalIncomingFromPos = 0;
  const activePoIds = new Set<string>();

  for (const pol of ((openPoLines as any[]) ?? [])) {
    const po = Array.isArray(pol.purchase_orders) ? pol.purchase_orders[0] : pol.purchase_orders;
    if (!po) continue;

    const poQty = Number(pol.qty || 0);

    const { data: shippedForPo } = await adminSupabase
      .from("inbound_shipment_lines")
      .select("shipped_qty, inbound_shipment_id, inbound_shipments!inner(status)")
      .eq("purchase_order_line_id", pol.id)
      .not("inbound_shipments.status", "eq", "CANCELLED");

    const totalShipped = (shippedForPo ?? []).reduce((sum: number, s: any) => sum + Number(s.shipped_qty || 0), 0);
    const unshipped = Math.max(0, poQty - totalShipped);

    if (unshipped > 0) {
      totalIncomingFromPos += unshipped;
      activePoIds.add(po.id);

      if (po.eta) {
        etas.push({
          eta: po.eta,
          warehouseName: "-",
          warehouseCode: "-",
        });
      }
    }
  }

  const totalIncomingQty = totalIncomingFromShipments + totalIncomingFromPos;
  const openInboundCount = activeInboundShipmentIds.size + activePoIds.size;

  etas.sort((a, b) => new Date(a.eta).getTime() - new Date(b.eta).getTime());
  const nextEta = etas.length > 0 ? etas[0].eta : null;
  const nextEtaWarehouse = etas.length > 0 && etas[0].warehouseName !== "-" ? etas[0].warehouseName : null;

  const inboundSummary = {
    incomingQty: totalIncomingQty,
    openInboundCount,
    nextEta,
    destinationWarehouseName: nextEtaWarehouse,
  };

  // Fetch Cost Summary
  const costSummary = await getProductCostSummary(productId);

  // Fetch History / Change log entries with creator details
  let historyLogs: any[] = [];
  try {
    const { data: dbLogs } = await adminSupabase
      .from("trading_product_history")
      .select("*, creator:profiles!created_by(full_name:display_name)")
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

  const directOverrideCost = (product as any).override_landed_cost !== undefined ? (product as any).override_landed_cost : undefined;
  const jsonOverrideCost = tradingOverrides.override_landed_cost;
  
  const overrideLandedCost = directOverrideCost !== undefined && directOverrideCost !== null
    ? Number(directOverrideCost)
    : (jsonOverrideCost !== undefined && jsonOverrideCost !== null ? Number(jsonOverrideCost) : null);

  const overrideReason = (product as any).override_landed_cost_reason || tradingOverrides.override_landed_cost_reason || null;
  const overrideUpdatedAt = (product as any).override_landed_cost_updated_at || tradingOverrides.override_landed_cost_updated_at || null;
  const overrideUpdatedBy = (product as any).override_landed_cost_updated_by || tradingOverrides.override_landed_cost_updated_by || null;

  const effectiveLandedCost = overrideLandedCost !== null && overrideLandedCost > 0
    ? overrideLandedCost
    : baseLandedCost;

  // Authoritative Pricing Resolution via Pricing Resolver
  const pricing = resolveProductPricing(product);

  const defaultWholesale = pricing.baseWholesalePrice || 0;
  const defaultSrp = pricing.retailPrice || 0;
  const defaultMap = pricing.mapPrice || defaultSrp;

  const operationalWholesale = pricing.baseWholesalePrice || 0;
  const promoWholesale = pricing.promoWholesalePrice;

  const promoStartDate = (product as any).trading_promo_start_date || tradingOverrides.promo_start_date || null;
  const promoEndDate = (product as any).trading_promo_end_date || tradingOverrides.promo_end_date || null;

  const mapPrice = pricing.mapPrice || 0;
  const srpPrice = pricing.retailPrice || 0;

  const pricingNote = (product as any).trading_pricing_note || tradingOverrides.pricing_note || null;
  const isPricingActive = (product as any).trading_pricing_active !== undefined ? (product as any).trading_pricing_active : (tradingOverrides.is_active ?? true);

  const effectiveWholesale = pricing.wholesalePrice || 0;

  const ourMarginUsd = effectiveWholesale > 0 && effectiveLandedCost > 0 ? effectiveWholesale - effectiveLandedCost : null;
  const ourMarginPercent = effectiveWholesale > 0 && ourMarginUsd !== null ? (ourMarginUsd / effectiveWholesale) * 100 : null;

  const baseOurMarginUsd = operationalWholesale > 0 && effectiveLandedCost > 0 ? operationalWholesale - effectiveLandedCost : null;
  const baseOurMarginPercent = operationalWholesale > 0 && baseOurMarginUsd !== null ? (baseOurMarginUsd / operationalWholesale) * 100 : null;

  const retailerMarginUsd = srpPrice > 0 && effectiveWholesale > 0 ? srpPrice - effectiveWholesale : null;
  const retailerMarginPercent = pricing.retailerMarginPercent;

  const baseRetailerMarginUsd = srpPrice > 0 && operationalWholesale > 0 ? srpPrice - operationalWholesale : null;
  const baseRetailerMarginPercent = (srpPrice > 0 && operationalWholesale > 0) ? ((srpPrice - operationalWholesale) / srpPrice) * 100 : null;

  const cartonPackQty = Math.max(1, Number(adminOverrides.carton_pack_qty || (product as any).carton_pack_qty || 1));
  const moq = cartonPackQty;
  const orderMultiple = cartonPackQty;

  const regEval = evaluateProductRegistrationStatus({
    id: product.id,
    name: product.name,
    name_en: product.name_en,
    brand_id: product.brand_id,
    category_code: product.category_code,
    manufacture_sku: product.manufacture_sku,
    origin: product.origin,
    price_krw_retail: product.price_krw_retail,
    price_usd_fob: product.price_usd_fob,
    package_width: product.package_width,
    package_depth: product.package_depth,
    package_height: product.package_height,
    package_weight: product.package_weight,
    carton_pack_qty: cartonPackQty,
    upc: product.upc,
    ean: product.ean,
    deleted_at: priceAddInfo.deleted_at || (product as any).deleted_at,
    hasImages: photoUrls.length > 0,
  });

  const tradingStatus =
    product.trading_status === "active" || product.trading_status === "historical"
      ? product.trading_status
      : product.selection_status === "SELECTED"
      ? "active"
      : "inactive";

  const retailerVisibility = (product as any).retailer_visibility || "hidden";

  const orderability = evaluateTradingOrderability({
    registrationStatus: regEval.status,
    selectionStatus: product.selection_status,
    tradingStatus,
    retailerVisibility,
    isPricingActive,
    wholesalePrice: effectiveWholesale,
    cartonPackQty,
  });

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
    photoUrls,
    upc: product.upc || product.ean || adminOverrides.upc || null,
    selection_status: product.selection_status,
    sales_status: product.sales_status,
    trading_status: tradingStatus,
    retailer_visibility: retailerVisibility,
    category_code: product.category_code || null,
    category_full_path: categoryFullPath,
    registration_status: regEval.status,

    // Case Pack, MOQ & Order Units
    carton_pack_qty: cartonPackQty,
    moq,
    orderMultiple,
    
    // Default Catalog Pricing
    defaultWholesale,
    defaultSrp,
    defaultMap,

    // Live Operational Pricing
    operationalWholesale,
    effectiveWholesale,
    promoWholesale,
    promoStartDate,
    promoEndDate,
    isPromoActive: pricing.hasActivePromo,
    mapPrice,
    srpPrice,
    pricingNote,
    isPricingActive,
    hasPricingOverride: (
      (product as any).trading_wholesale_price !== undefined && (product as any).trading_wholesale_price !== null ||
      tradingOverrides.wholesale_price !== undefined && tradingOverrides.wholesale_price !== null
    ),

    // Cost Snapshot & 3-Layer Model
    baseLandedCost,
    overrideLandedCost,
    overrideReason,
    overrideUpdatedAt,
    overrideUpdatedBy,
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

    // Calculated Orderability
    orderability,
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
    inboundSummary,
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

  const { data: currentProd } = await supabase
    .from("products")
    .select("price_additional_info, trading_wholesale_price, trading_map_price, trading_srp_price, override_landed_cost")
    .eq("id", productId)
    .single();

  if (!currentProd) throw new Error("Product not found.");

  const priceAddInfo = (currentProd.price_additional_info as any) || {};
  const currentOverrides = priceAddInfo.trading_overrides || {};
  const currentHistory = priceAddInfo.trading_history || [];

  const costSummary = await getProductCostSummary(productId);
  const baseCost = costSummary?.latestLandedCost || 0;
  const overrideCost = (currentProd as any).override_landed_cost ?? currentOverrides.override_landed_cost ?? null;
  const effectiveCost = overrideCost !== null && overrideCost > 0 ? Number(overrideCost) : baseCost;

  const beforeVal = {
    wholesale_price: (currentProd as any).trading_wholesale_price ?? currentOverrides.wholesale_price ?? null,
    map_price: (currentProd as any).trading_map_price ?? currentOverrides.map_price ?? null,
    srp_price: (currentProd as any).trading_srp_price ?? currentOverrides.srp_price ?? null,
    effective_landed_cost: effectiveCost,
  };

  const afterVal = {
    wholesale_price: wholesale,
    map_price: map,
    srp_price: srp,
    effective_landed_cost: effectiveCost,
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

  const updatePayload: any = {
    price_additional_info: updatedPriceAddInfo,
  };

  try {
    updatePayload.trading_wholesale_price = wholesale;
    updatePayload.trading_map_price = map;
    updatePayload.trading_srp_price = srp;
    updatePayload.trading_pricing_note = note;
  } catch {
    // Ignore
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
    if (fallbackErr) throw new Error(`도매가 업데이트 실패: ${fallbackErr.message}`);
  }

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
    // Ignore
  }

  try {
    revalidatePath(`/admin/products/trading/${productId}`);
    revalidatePath("/admin/products/trading");
    revalidatePath(`/admin/products/${productId}`);
  } catch {
    // Ignore
  }
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
    .select("price_additional_info, trading_promo_wholesale_price, override_landed_cost")
    .eq("id", productId)
    .single();

  if (!currentProd) throw new Error("Product not found.");

  const priceAddInfo = (currentProd.price_additional_info as any) || {};
  const currentOverrides = priceAddInfo.trading_overrides || {};
  const currentHistory = priceAddInfo.trading_history || [];

  const costSummary = await getProductCostSummary(productId);
  const baseCost = costSummary?.latestLandedCost || 0;
  const overrideCost = (currentProd as any).override_landed_cost ?? currentOverrides.override_landed_cost ?? null;
  const effectiveCost = overrideCost !== null && overrideCost > 0 ? Number(overrideCost) : baseCost;

  const beforeVal = {
    promo_wholesale_price: (currentProd as any).trading_promo_wholesale_price ?? currentOverrides.promo_wholesale_price ?? null,
    promo_start_date: currentOverrides.promo_start_date ?? null,
    promo_end_date: currentOverrides.promo_end_date ?? null,
    effective_landed_cost: effectiveCost,
  };

  const afterVal = {
    promo_wholesale_price: promoWholesale,
    promo_start_date: startDate,
    promo_end_date: endDate,
    effective_landed_cost: effectiveCost,
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
    // Ignore
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
    // Ignore
  }

  try {
    revalidatePath(`/admin/products/trading/${productId}`);
    revalidatePath("/admin/products/trading");
  } catch {
    // Ignore
  }
  return { success: true };
}

export async function updateTradingCostOverride(productId: string, input: UpdateTradingCostOverrideInput) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();

  const reason = input.reason?.trim() || "Cost override updated";

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
    reason: reason,
    updated_at: new Date().toISOString(),
  };

  const updatedOverrides = {
    ...currentOverrides,
    override_landed_cost: overrideCost,
    override_landed_cost_reason: reason,
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
    // Ignore
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
    // Ignore
  }

  try {
    revalidatePath(`/admin/products/trading/${productId}`);
    revalidatePath("/admin/products/trading");
  } catch {
    // Ignore
  }
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

  try {
    revalidatePath(`/admin/products/trading/${productId}`);
    revalidatePath("/admin/products/trading");
  } catch {
    // Ignore
  }
  return { success: true };
}

export interface UpdateTradingStatusAndVisibilityInput {
  trading_status: "active" | "inactive" | "historical";
  retailer_visibility: "visible" | "hidden";
  reason?: string;
}

export async function updateTradingStatusAndVisibility(
  productId: string,
  input: UpdateTradingStatusAndVisibilityInput
) {
  try {
    const { userId } = await verifyAdminSession();
    const supabase = createAdminClient();

    let tradingStatus = input.trading_status;
    let visibility = input.retailer_visibility;
    let notice: string | undefined = undefined;

    const { data: currentProd } = await supabase
      .from("products")
      .select("trading_status, retailer_visibility, price_additional_info")
      .eq("id", productId)
      .maybeSingle();

    if (!currentProd) {
      return { success: false, error: "제품 정보를 찾을 수 없습니다." };
    }

    // Enforce status and visibility combination rules:
    // - active + visible -> allowed
    // - active + hidden -> allowed
    // - inactive/historical + visible -> NOT ALLOWED -> force hidden + friendly notice
    if (tradingStatus !== "active" && (visibility === "visible" || currentProd.retailer_visibility === "visible")) {
      visibility = "hidden";
      notice = "운영 상태 변경에 따라 Hub 노출도 비노출로 변경되었습니다.";
    }

    const beforeVal = {
      trading_status: currentProd.trading_status || "inactive",
      retailer_visibility: (currentProd as any).retailer_visibility || "hidden",
    };

    const afterVal = {
      trading_status: tradingStatus,
      retailer_visibility: visibility,
    };

    const { error: updateErr } = await supabase
      .from("products")
      .update({
        trading_status: tradingStatus,
        retailer_visibility: visibility,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId);

    if (updateErr) {
      return { success: false, error: `상태 업데이트 실패: ${updateErr.message}` };
    }

    try {
      await supabase.from("trading_product_history").insert({
        product_id: productId,
        change_type: "STATUS",
        field_name: "trading_status_visibility",
        before_value: beforeVal,
        after_value: afterVal,
        reason: input.reason || "Operational status and visibility updated",
        created_by: userId,
      });
    } catch {
      // Ignore history logging error
    }

    try {
      revalidatePath(`/admin/products/trading/${productId}`);
      revalidatePath("/admin/products/trading");
      revalidatePath(`/admin/products/${productId}`);
      revalidatePath("/admin/products");
      revalidatePath("/products");
      revalidatePath(`/products/${productId}`);
    } catch {
      // Ignore revalidation path exceptions
    }

    return {
      success: true,
      trading_status: tradingStatus,
      retailer_visibility: visibility,
      notice,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "상태 변경 중 오류가 발생했습니다.",
    };
  }
}
