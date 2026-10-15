import "server-only";

import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEffectiveSku } from "@/lib/product/types";
import { formatCategoryName } from "@/lib/retailer/products";
import { getRetailerAccessibleStores } from "@/lib/retailer/weekly-check";
import { generateProductQrDataUrl, generateProductQrSvg, getCanonicalPublicProductUrl } from "@/lib/product/qr";
import {
  PHYSICAL_PRICE_TAG_DIMENSIONS,
  StoreProductPriceRecord,
  StoreProductTagItem,
  StorePriceBreakdownItem,
  StorePricingDashboardData,
  calculateDiscountPercent,
  isSalePriceActive,
  calculateGrossProfitMetrics,
} from "@/lib/retailer/store-pricing-types";

export * from "@/lib/retailer/store-pricing-types";

interface CostResolutionEntry {
  unitPrice: number;
  source: "invoice" | "order";
  referenceId: string;
  referenceNumber: string;
  storeId?: string | null;
  createdAt: string;
}

/**
 * Fetch Store Pricing & Assortment for Price Tag Management
 * Supports both Single Store and All Stores overview modes.
 */
export async function getStorePricingDashboardData(
  targetStoreId?: string
): Promise<StorePricingDashboardData> {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  // 1. Resolve store accessibility & permissions
  const { companyId, userRole, stores } = await getRetailerAccessibleStores();
  if (!companyId || stores.length === 0) {
    throw new Error("No authorized store locations found for this account.");
  }

  const canEditPrice = ["owner", "buyer", "store_manager"].includes(userRole || "");
  const canAccessCost = ["owner", "buyer", "store_manager"].includes(userRole || "");

  // Determine All Stores mode vs Single Store mode
  const isAllStores = targetStoreId === "all";
  let activeStore = stores[0];
  if (!isAllStores && targetStoreId) {
    const found = stores.find((s) => s.id === targetStoreId);
    if (found) activeStore = found;
  }

  const selectedStoreId = isAllStores ? "all" : activeStore.id;
  const selectedStoreName = isAllStores ? "All Stores (Company Overview)" : activeStore.name;
  const targetStoreIds = isAllStores ? stores.map((s) => s.id) : [activeStore.id];

  // 2. Unify Store Assortment: active store products + valid ordered/in-transit/delivered products
  const { data: storeProductRows } = await adminClient
    .from("retailer_store_products")
    .select("product_id, store_id")
    .in("store_id", targetStoreIds)
    .eq("is_active", true);

  // Map product to stores it belongs to
  const productStoreAvailabilityMap = new Map<string, Set<string>>();
  const productStatusMap = new Map<string, "in_stock" | "incoming">();

  (storeProductRows || []).forEach((sp) => {
    if (!sp.product_id) return;
    if (!productStoreAvailabilityMap.has(sp.product_id)) {
      productStoreAvailabilityMap.set(sp.product_id, new Set());
    }
    productStoreAvailabilityMap.get(sp.product_id)!.add(sp.store_id);
    productStatusMap.set(sp.product_id, "in_stock");
  });

  // Query valid non-cancelled orders for these target stores
  const { data: storeOrders } = await adminClient
    .from("retailer_orders")
    .select(`
      id,
      store_id,
      order_status,
      retailer_order_items (
        product_id
      )
    `)
    .in("store_id", targetStoreIds)
    .in("order_status", ["confirmed", "processing", "partially_shipped", "shipped", "delivered"]);

  (storeOrders || []).forEach((order) => {
    const items = (order.retailer_order_items as any[]) || [];
    const isDelivered = order.order_status === "delivered";

    items.forEach((it) => {
      if (!it.product_id) return;
      if (!productStoreAvailabilityMap.has(it.product_id)) {
        productStoreAvailabilityMap.set(it.product_id, new Set());
      }
      if (order.store_id) {
        productStoreAvailabilityMap.get(it.product_id)!.add(order.store_id);
      }

      const current = productStatusMap.get(it.product_id);
      if (isDelivered || current === "in_stock") {
        productStatusMap.set(it.product_id, "in_stock");
      } else if (!current) {
        productStatusMap.set(it.product_id, "incoming");
      }
    });
  });

  const assortmentProductIds = Array.from(productStoreAvailabilityMap.keys());

  if (assortmentProductIds.length === 0) {
    return {
      companyId,
      userRole: userRole || "employee",
      canEditPrice,
      isAllStores,
      selectedStoreId,
      selectedStoreName,
      stores: stores.map((s) => ({ id: s.id, name: s.name })),
      products: [],
      totalAssortmentCount: 0,
      pricedProductsCount: 0,
      onSaleProductsCount: 0,
      incomingProductsCount: 0,
      unpricedProductsCount: 0,
    };
  }

  // 3. Fetch Store-specific Prices from retailer_store_product_prices
  // Structure: Map<productId, Map<storeId, PriceRecord>>
  const storeProductPriceMap = new Map<string, Map<string, any>>();
  try {
    const { data: prices, error: priceErr } = await adminClient
      .from("retailer_store_product_prices")
      .select("*")
      .in("store_id", targetStoreIds);

    if (!priceErr && prices) {
      prices.forEach((p) => {
        if (!storeProductPriceMap.has(p.product_id)) {
          storeProductPriceMap.set(p.product_id, new Map());
        }
        storeProductPriceMap.get(p.product_id)!.set(p.store_id, p);
      });
    }
  } catch (err) {
    console.warn("Error fetching store prices:", err);
  }

  // 4. Authoritative Purchase Cost Resolution
  // Priority:
  // 1. Most recent valid non-voided invoice line (retailer_invoice_items) for this company
  // 2. Most recent valid confirmed order line (retailer_order_items) for this company
  // 3. Curation catalog wholesale price
  // Suppressed completely for employee roles to protect wholesale pricing
  const invoiceCostByProduct = new Map<string, CostResolutionEntry>();
  const invoiceCostBySku = new Map<string, CostResolutionEntry>();

  const orderCostByProduct = new Map<string, CostResolutionEntry[]>();
  const orderCostBySku = new Map<string, CostResolutionEntry[]>();

  if (canAccessCost) {
    try {
      // 4A. Query recent valid non-voided invoice items for this company
      const { data: invLines } = await adminClient
        .from("retailer_invoice_items")
        .select(`
          product_id,
          sku,
          unit_wholesale_price,
          created_at,
          retailer_invoices!inner (
            id,
            invoice_number,
            invoice_status,
            retailer_company_id,
            created_at
          )
        `)
        .eq("retailer_invoices.retailer_company_id", companyId)
        .not("retailer_invoices.invoice_status", "in", '("void","cancelled")')
        .gt("unit_wholesale_price", 0)
        .order("created_at", { ascending: false });

      (invLines || []).forEach((item: any) => {
        const inv = item.retailer_invoices;
        const entry: CostResolutionEntry = {
          unitPrice: Number(item.unit_wholesale_price),
          source: "invoice",
          referenceId: inv?.id || item.invoice_id,
          referenceNumber: inv?.invoice_number || "Invoice",
          createdAt: item.created_at || inv?.created_at,
        };

        if (item.product_id && !invoiceCostByProduct.has(item.product_id)) {
          invoiceCostByProduct.set(item.product_id, entry);
        }
        if (item.sku) {
          const cleanSku = item.sku.trim().toLowerCase();
          if (!invoiceCostBySku.has(cleanSku)) {
            invoiceCostBySku.set(cleanSku, entry);
          }
        }
      });
    } catch (err) {
      console.warn("Could not query retailer_invoice_items for cost resolution:", err);
    }

    try {
      // 4B. Query recent valid non-cancelled orders for this company
      const { data: ordLines } = await adminClient
        .from("retailer_order_items")
        .select(`
          product_id,
          sku,
          unit_wholesale_price,
          created_at,
          retailer_orders!inner (
            id,
            order_number,
            order_status,
            store_id,
            retailer_company_id,
            created_at
          )
        `)
        .eq("retailer_orders.retailer_company_id", companyId)
        .not("retailer_orders.order_status", "in", '("cancelled","draft")')
        .gt("unit_wholesale_price", 0)
        .order("created_at", { ascending: false });

      (ordLines || []).forEach((item: any) => {
        const ord = item.retailer_orders;
        const entry: CostResolutionEntry = {
          unitPrice: Number(item.unit_wholesale_price),
          source: "order",
          referenceId: ord?.id || item.order_id,
          referenceNumber: ord?.order_number || "Order",
          storeId: ord?.store_id || null,
          createdAt: item.created_at || ord?.created_at,
        };

        if (item.product_id) {
          if (!orderCostByProduct.has(item.product_id)) {
            orderCostByProduct.set(item.product_id, []);
          }
          orderCostByProduct.get(item.product_id)!.push(entry);
        }
        if (item.sku) {
          const cleanSku = item.sku.trim().toLowerCase();
          if (!orderCostBySku.has(cleanSku)) {
            orderCostBySku.set(cleanSku, []);
          }
          orderCostBySku.get(cleanSku)!.push(entry);
        }
      });
    } catch (err) {
      console.warn("Could not query retailer_order_items for cost resolution:", err);
    }
  }

  // 5. Fetch Products Catalog, Curations & Images
  const { data: rawProducts } = await adminClient
    .from("products")
    .select(`
      id,
      name,
      name_en,
      category,
      category_code,
      brand_id,
      letusto_sku,
      manufacture_sku,
      status,
      estimated_retail_price,
      carton_pack_qty,
      price_additional_info,
      brands (
        id,
        name
      ),
      product_curations (
        wholesale_price,
        suggest_retail_price,
        status
      ),
      product_images (
        id,
        storage_path,
        position
      )
    `)
    .in("id", assortmentProductIds);

  const productMap = new Map<string, any>();
  (rawProducts || []).forEach((p) => productMap.set(p.id, p));

  // 6. Construct Tag Items with QR codes and Profitability
  let pricedCount = 0;
  let onSaleCount = 0;

  const tagItems: StoreProductTagItem[] = await Promise.all(
    assortmentProductIds.map(async (pId) => {
      const p = productMap.get(pId);
      if (!p) return null as any;

      const info = (p.price_additional_info as any) || {};
      const overrides = info.admin_overrides || {};
      const curation = Array.isArray(p.product_curations)
        ? p.product_curations[0]
        : p.product_curations;

      const brand = (p.brands as any) || {};
      const brandId = p.brand_id || brand.id || "unassigned";
      const brandName = brand.name || "K SELECT Brand";

      const categoryLabel = formatCategoryName(p.category || p.category_code);

      const effectiveSku =
        resolveEffectiveSku(overrides.letusto_sku, p.letusto_sku) ||
        resolveEffectiveSku(overrides.manufacture_sku, p.manufacture_sku) ||
        "KS-PROD";

      const cleanSkuLower = effectiveSku.trim().toLowerCase();

      // Resolve Authoritative Wholesale Cost
      let wholesalePrice: number | null = null;
      let wholesaleCostSource: StoreProductTagItem["wholesaleCostSource"] = "none";
      let wholesaleCostLabel: string | null = null;

      if (canAccessCost) {
        // Priority 1: Recent valid invoice line
        const invEntry = invoiceCostByProduct.get(p.id) || invoiceCostBySku.get(cleanSkuLower);
        if (invEntry && invEntry.unitPrice > 0) {
          wholesalePrice = invEntry.unitPrice;
          wholesaleCostSource = "invoice";
          wholesaleCostLabel = `Last Purchase: $${invEntry.unitPrice.toFixed(2)} (Invoice #${invEntry.referenceNumber})`;
        } else {
          // Priority 2: Recent confirmed order line (prefer current store if applicable)
          const ordEntries = orderCostByProduct.get(p.id) || orderCostBySku.get(cleanSkuLower);
          if (ordEntries && ordEntries.length > 0) {
            let matched = ordEntries[0];
            if (!isAllStores && targetStoreId) {
              const storeMatch = ordEntries.find((e) => e.storeId === targetStoreId);
              if (storeMatch) matched = storeMatch;
            }
            if (matched.unitPrice > 0) {
              wholesalePrice = matched.unitPrice;
              wholesaleCostSource = "order";
              wholesaleCostLabel = `Last Purchase: $${matched.unitPrice.toFixed(2)} (Order #${matched.referenceNumber})`;
            }
          }
        }

        // Priority 3: Product curation catalog wholesale price
        if (wholesalePrice === null && curation?.wholesale_price && Number(curation.wholesale_price) > 0) {
          wholesalePrice = Number(curation.wholesale_price);
          wholesaleCostSource = "curation";
          wholesaleCostLabel = `Catalog Wholesale: $${wholesalePrice.toFixed(2)}`;
        }

        if (wholesalePrice === null) {
          wholesaleCostSource = "none";
          wholesaleCostLabel = "Cost Not Available";
        }
      }

      // Suggested MSRP Resolution
      let rawMsrp = 0;
      if (curation?.suggest_retail_price && Number(curation.suggest_retail_price) > 0) {
        rawMsrp = Number(curation.suggest_retail_price);
      } else if (p.estimated_retail_price && Number(p.estimated_retail_price) > 0) {
        rawMsrp = Number(p.estimated_retail_price);
      } else if (wholesalePrice && wholesalePrice > 0) {
        rawMsrp = Number((wholesalePrice * 2.0).toFixed(2));
      }

      const hasMsrp = rawMsrp > 0;
      const msrp = hasMsrp ? rawMsrp : 0;

      const cartonPackQty = Math.max(1, overrides.carton_pack_qty || p.carton_pack_qty || 1);

      // Thumbnail Image
      const rawImages = (p.product_images as any[]) || [];
      const sortedImages = [...rawImages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      let thumbnailUrl: string | null = null;
      if (sortedImages.length > 0 && sortedImages[0].storage_path) {
        try {
          const { data: signed } = await adminClient.storage
            .from("company-uploads")
            .createSignedUrl(sortedImages[0].storage_path, 3600);
          thumbnailUrl = signed?.signedUrl || null;
        } catch {
          // ignore
        }
      }

      // 7. Store Pricing Resolution
      const pStorePrices = storeProductPriceMap.get(pId) || new Map<string, any>();
      const assignedStoreIds = Array.from(productStoreAvailabilityMap.get(p.id) || []);

      // Build Store-by-Store price breakdown for All Stores mode
      const storeBreakdowns: StorePriceBreakdownItem[] = stores
        .filter((st) => assignedStoreIds.includes(st.id))
        .map((st) => {
          const pRow = pStorePrices.get(st.id);
          const hasPrice = !!pRow && Number(pRow.regular_price) > 0;
          const regPrice = hasPrice ? Number(pRow.regular_price) : null;
          const sPrice = pRow?.sale_price ? Number(pRow.sale_price) : null;
          const sStart = pRow?.sale_start_date || null;
          const sEnd = pRow?.sale_end_date || null;
          const isSActive = isSalePriceActive(sPrice, sStart, sEnd);
          const discPercent = regPrice && isSActive ? calculateDiscountPercent(regPrice, sPrice) : null;
          const effPrice = isSActive && sPrice ? sPrice : (regPrice || msrp);
          const pBasis: StoreProductTagItem["priceBasis"] = isSActive && sPrice
            ? "store_sale"
            : hasPrice
            ? "store_regular"
            : "msrp";

          const regMetrics = calculateGrossProfitMetrics(regPrice, wholesalePrice);
          const saleMetrics = calculateGrossProfitMetrics(sPrice, wholesalePrice);

          return {
            storeId: st.id,
            storeName: st.name,
            regularPrice: regPrice,
            salePrice: sPrice,
            discountPercent: discPercent,
            isSaleActive: isSActive,
            hasStorePrice: hasPrice,
            effectivePrice: effPrice,
            priceBasis: pBasis,
            regularGrossProfit: regMetrics.grossProfit,
            regularGrossMarginPercent: regMetrics.grossMarginPercent,
            saleGrossProfit: saleMetrics.grossProfit,
            saleGrossMarginPercent: saleMetrics.grossMarginPercent,
          };
        });

      // Determine single-store active values vs overview values
      let hasStorePrice = false;
      let regularPrice: number | null = null;
      let salePrice: number | null = null;
      let saleStartDate: string | null = null;
      let saleEndDate: string | null = null;
      let discountPercent: number | null = null;
      let isSaleActive = false;
      let effectivePrice = msrp;
      let priceBasis: StoreProductTagItem["priceBasis"] = "msrp";

      if (!isAllStores) {
        // Single Store Mode
        const priceRow = pStorePrices.get(activeStore.id);
        hasStorePrice = !!priceRow && Number(priceRow.regular_price) > 0;
        regularPrice = hasStorePrice ? Number(priceRow.regular_price) : null;
        salePrice = priceRow?.sale_price ? Number(priceRow.sale_price) : null;
        saleStartDate = priceRow?.sale_start_date || null;
        saleEndDate = priceRow?.sale_end_date || null;

        isSaleActive = isSalePriceActive(salePrice, saleStartDate, saleEndDate);
        discountPercent = regularPrice && isSaleActive ? calculateDiscountPercent(regularPrice, salePrice) : null;

        if (hasStorePrice && regularPrice) {
          pricedCount += 1;
          if (isSaleActive && salePrice) {
            onSaleCount += 1;
            effectivePrice = salePrice;
            priceBasis = "store_sale";
          } else {
            effectivePrice = regularPrice;
            priceBasis = "store_regular";
          }
        }
      } else {
        // All Stores Mode: summarize across breakdowns
        const pricedBreakdowns = storeBreakdowns.filter((b) => b.hasStorePrice && b.regularPrice);
        hasStorePrice = pricedBreakdowns.length > 0;
        if (hasStorePrice) pricedCount += 1;

        const onSaleBreakdowns = storeBreakdowns.filter((b) => b.isSaleActive && b.salePrice);
        isSaleActive = onSaleBreakdowns.length > 0;
        if (isSaleActive) onSaleCount += 1;

        // If all stores with prices have identical regular price, display that price
        if (pricedBreakdowns.length > 0) {
          const firstPrice = pricedBreakdowns[0].regularPrice;
          const allSame = pricedBreakdowns.every((b) => b.regularPrice === firstPrice);
          if (allSame) {
            regularPrice = firstPrice;
            effectivePrice = firstPrice || msrp;
            priceBasis = "store_regular";
          }
        }
      }

      // Calculate unit-level merchandise profitability for primary displayed prices
      const regProfitMetrics = calculateGrossProfitMetrics(regularPrice, wholesalePrice);
      const saleProfitMetrics = calculateGrossProfitMetrics(salePrice, wholesalePrice);

      // Product fulfillment / assortment status
      const tagStatus = productStatusMap.get(p.id) || "in_stock";

      // Common Canonical QR
      const canonicalProductUrl = getCanonicalPublicProductUrl(p.id);
      let qrDataUrl: string | null = null;
      let qrSvg: string | null = null;

      try {
        qrDataUrl = await generateProductQrDataUrl(p.id);
        qrSvg = await generateProductQrSvg(p.id);
      } catch (qrErr) {
        console.error("Error generating QR code:", qrErr);
      }

      const item: StoreProductTagItem = {
        productId: p.id,
        productName: overrides.name?.trim() || p.name,
        productNameEn: overrides.name_en?.trim() || p.name_en || null,
        brandName,
        brandId,
        sku: effectiveSku,
        thumbnailUrl,
        category: p.category || "skincare",
        categoryLabel,
        cartonPackQty,
        wholesalePrice,
        wholesaleCostSource,
        wholesaleCostLabel,
        msrp,
        hasMsrp,
        hasStorePrice,
        regularPrice,
        salePrice,
        saleStartDate,
        saleEndDate,
        discountPercent,
        isSaleActive,
        effectivePrice,
        priceBasis,
        regularGrossProfit: regProfitMetrics.grossProfit,
        regularGrossMarginPercent: regProfitMetrics.grossMarginPercent,
        saleGrossProfit: saleProfitMetrics.grossProfit,
        saleGrossMarginPercent: saleProfitMetrics.grossMarginPercent,
        storeBreakdowns,
        storesAvailableCount: assignedStoreIds.length,
        tagStatus,
        canonicalProductUrl,
        qrDataUrl,
        qrSvg,
      };

      return item;
    })
  );

  const cleanTagItems = tagItems.filter(Boolean);

  return {
    companyId,
    userRole: userRole || "employee",
    canEditPrice,
    isAllStores,
    selectedStoreId,
    selectedStoreName,
    stores: stores.map((s) => ({ id: s.id, name: s.name })),
    products: cleanTagItems,
    totalAssortmentCount: cleanTagItems.length,
    pricedProductsCount: pricedCount,
    onSaleProductsCount: onSaleCount,
    incomingProductsCount: cleanTagItems.filter((p) => p.tagStatus === "incoming").length,
    unpricedProductsCount: cleanTagItems.filter((p) => !p.hasStorePrice).length,
  };
}

/**
 * Fetch a single product's tag data for preview
 */
export async function getStoreProductTagDetail(
  storeId: string,
  productId: string
): Promise<StoreProductTagItem | null> {
  const data = await getStorePricingDashboardData(storeId);
  return data.products.find((p) => p.productId === productId) || null;
}
