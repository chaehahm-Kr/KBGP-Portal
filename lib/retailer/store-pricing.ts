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
  StorePricingDashboardData,
  calculateDiscountPercent,
  isSalePriceActive,
} from "@/lib/retailer/store-pricing-types";

export * from "@/lib/retailer/store-pricing-types";

/**
 * Fetch Store Pricing & Assortment for Price Tag Management
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

  // Auto-select store if valid
  let activeStore = stores[0];
  if (targetStoreId) {
    const found = stores.find((s) => s.id === targetStoreId);
    if (found) activeStore = found;
  }

  const storeId = activeStore.id;

  // 2. Fetch Store Assortment from retailer_store_products
  const { data: storeProductRows } = await adminClient
    .from("retailer_store_products")
    .select("product_id")
    .eq("store_id", storeId)
    .eq("is_active", true);

  const assortmentProductIds = (storeProductRows || []).map((sp) => sp.product_id);

  // If no store products assigned yet, also check retailer_orders for this store
  if (assortmentProductIds.length === 0) {
    const { data: orderItems } = await adminClient
      .from("retailer_orders")
      .select(`
        id,
        retailer_order_items (
          product_id
        )
      `)
      .eq("store_id", storeId);

    if (orderItems && orderItems.length > 0) {
      orderItems.forEach((o) => {
        const items = (o.retailer_order_items as any[]) || [];
        items.forEach((it) => {
          if (!assortmentProductIds.includes(it.product_id)) {
            assortmentProductIds.push(it.product_id);
          }
        });
      });
    }
  }

  if (assortmentProductIds.length === 0) {
    return {
      companyId,
      userRole: userRole || "employee",
      canEditPrice,
      selectedStoreId: storeId,
      selectedStoreName: activeStore.name,
      stores: stores.map((s) => ({ id: s.id, name: s.name })),
      products: [],
      totalAssortmentCount: 0,
      pricedProductsCount: 0,
      onSaleProductsCount: 0,
    };
  }

  // 3. Fetch Store-specific Prices from retailer_store_product_prices
  let priceRecordsMap = new Map<string, any>();
  try {
    const { data: prices, error: priceErr } = await adminClient
      .from("retailer_store_product_prices")
      .select("*")
      .eq("store_id", storeId);

    if (!priceErr && prices) {
      prices.forEach((p) => priceRecordsMap.set(p.product_id, p));
    }
  } catch {
    // Migration might be pending
  }

  // 4. Fetch Products Catalog, Curations & Images
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

  // 5. Construct Tag Items with QR codes
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

      // Wholesale Price & MSRP
      let wholesalePrice = 0;
      if (curation?.wholesale_price && Number(curation.wholesale_price) > 0) {
        wholesalePrice = Number(curation.wholesale_price);
      }

      let msrp = 0;
      if (curation?.suggest_retail_price && Number(curation.suggest_retail_price) > 0) {
        msrp = Number(curation.suggest_retail_price);
      } else if (p.estimated_retail_price && Number(p.estimated_retail_price) > 0) {
        msrp = Number(p.estimated_retail_price);
      } else if (wholesalePrice > 0) {
        msrp = Number((wholesalePrice * 2.0).toFixed(2));
      }

      const cartonPackQty = Math.max(1, overrides.carton_pack_qty || p.carton_pack_qty || 1);

      // Image
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

      // Store Price resolution
      const priceRow = priceRecordsMap.get(pId);
      const hasStorePrice = !!priceRow && Number(priceRow.regular_price) > 0;
      const regularPrice = hasStorePrice ? Number(priceRow.regular_price) : null;
      const salePrice = priceRow?.sale_price ? Number(priceRow.sale_price) : null;
      const saleStartDate = priceRow?.sale_start_date || null;
      const saleEndDate = priceRow?.sale_end_date || null;

      const isSaleActive = isSalePriceActive(salePrice, saleStartDate, saleEndDate);
      const discountPercent =
        regularPrice && isSaleActive ? calculateDiscountPercent(regularPrice, salePrice) : null;

      let effectivePrice = msrp;
      let priceBasis: StoreProductTagItem["priceBasis"] = "msrp";

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
        msrp,
        hasStorePrice,
        regularPrice,
        salePrice,
        saleStartDate,
        saleEndDate,
        discountPercent,
        isSaleActive,
        effectivePrice,
        priceBasis,
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
    selectedStoreId: storeId,
    selectedStoreName: activeStore.name,
    stores: stores.map((s) => ({ id: s.id, name: s.name })),
    products: cleanTagItems,
    totalAssortmentCount: cleanTagItems.length,
    pricedProductsCount: pricedCount,
    onSaleProductsCount: onSaleCount,
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
