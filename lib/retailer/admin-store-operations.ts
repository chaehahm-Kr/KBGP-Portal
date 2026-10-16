import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminSession } from "@/lib/auth/dal";
import { resolveAuthoritativeProductImages } from "@/lib/retailer/product-images";
import { resolveEffectiveSku } from "@/lib/product/types";
import {
  resolveRetailerSalesPolicy,
  normalizeReorderQuantity,
} from "@/lib/product/retailer-policy";

export interface AdminStoreOperationItem {
  id: string;
  name: string;
  storeCode: string | null;
  type: string;
  status: "active" | "inactive" | "closed" | string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  managerName: string | null;
  managerPhone: string | null;
  companyId: string;
  companyName: string;
  companyCode: string | null;
  createdAt: string;
  updatedAt: string;
  // Associated Operational Counts
  ordersCount: number;
  assignedUsersCount: number;
  weeklyChecksCount: number;
  latestWeeklyCheckDate: string | null;
  latestWeeklyCheckStatus: string | null;
}

export interface AdminStoreInventoryItem {
  productId: string;
  productName: string;
  brandName: string;
  sku: string;
  thumbnailUrl: string | null;
  category: string;
  cartonPackQty: number;
  moq: number;
  orderMultiple: number;
  wholesalePrice: number;
  retailPrice: number;

  reportedRemaining: number | null;
  isReportedZero: boolean;
  reportingDate: string | null;
  reportingWeek: string | null;
  submissionStatus: "submitted" | "draft" | "not_reported";

  estimatedSold: number | null;

  reorderNeeded: boolean;
  suggestedReorderQty: number;
  suggestedCases: number;
  reorderReason: string;
  reorderSignal: "reorder_needed" | "sufficient_stock" | "overstock" | "not_available" | "needs_check";

  dataStatus: "reorder_attention" | "zero_stock" | "reported" | "not_reported";
}

export interface AdminStoreInventoryOverview {
  storeId: string;
  storeName: string;
  companyId: string;
  companyName: string;
  latestSubmissionDate: string | null;
  latestReportingWeek: string | null;
  submissionStatus: "submitted" | "in_progress" | "no_submission";
  submissionStatusLabel: string;
  productsWithReportedStockCount: number;
  totalAssortedProductsCount: number;
  reorderAttentionCount: number;
  items: AdminStoreInventoryItem[];
}

export interface AdminStoreOperationsData {
  stores: AdminStoreOperationItem[];
  retailers: Array<{
    id: string;
    name: string;
    companyCode: string | null;
  }>;
  totalStoresCount: number;
  activeStoresCount: number;
  totalRetailersCount: number;
  storeInventoryMap: Record<string, AdminStoreInventoryOverview>;
}

/**
 * Authoritative store-specific inventory and reorder data resolver for Store Operations
 */
export async function getAdminStoreInventoryData(
  storeId: string
): Promise<AdminStoreInventoryOverview | null> {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  // 1. Fetch Store and Company
  const { data: store, error: storeErr } = await adminClient
    .from("stores")
    .select(`
      id,
      name,
      company_id,
      companies:companies!stores_company_id_fkey (
        id,
        name,
        company_code
      )
    `)
    .eq("id", storeId)
    .maybeSingle();

  if (storeErr || !store) {
    return null;
  }

  const comp = Array.isArray(store.companies) ? store.companies[0] : store.companies;
  const companyId = store.company_id;
  const companyName = comp?.name || "Retailer Organization";

  // 2. Fetch Weekly Checks for this Store
  const { data: rawChecks } = await adminClient
    .from("retailer_weekly_checks")
    .select(`
      id,
      store_id,
      reporting_week,
      report_date,
      status,
      submitted_at,
      retailer_weekly_check_items (
        id,
        product_id,
        reported_remaining_qty,
        previous_reported_qty,
        delivered_since_previous,
        estimated_movement,
        is_counted
      )
    `)
    .eq("store_id", storeId)
    .order("report_date", { ascending: false });

  const checks = rawChecks || [];
  const submittedChecks = checks.filter((c) => c.status === "submitted");
  const latestSubmittedCheck = submittedChecks[0] || null;
  const latestAnyCheck = checks[0] || null;

  // 3. Collect relevant products for this store
  const relevantProductIds = new Set<string>();

  // A. Assortment from retailer_store_products
  const { data: storeProductRows } = await adminClient
    .from("retailer_store_products")
    .select("product_id")
    .eq("store_id", storeId)
    .eq("is_active", true);

  (storeProductRows || []).forEach((sp: any) => {
    if (sp.product_id) relevantProductIds.add(sp.product_id);
  });

  // B. Products present in any checks for this store
  checks.forEach((c) => {
    (c.retailer_weekly_check_items || []).forEach((it: any) => {
      if (it.product_id) relevantProductIds.add(it.product_id);
    });
  });

  // C. Fallback: If no products found, load active selling products associated with company
  if (relevantProductIds.size === 0) {
    const { data: fallbackProds } = await adminClient
      .from("products")
      .select("id")
      .eq("status", "selling")
      .limit(10);

    (fallbackProds || []).forEach((p) => relevantProductIds.add(p.id));
  }

  if (relevantProductIds.size === 0) {
    return {
      storeId: store.id,
      storeName: store.name,
      companyId,
      companyName,
      latestSubmissionDate: null,
      latestReportingWeek: null,
      submissionStatus: "no_submission",
      submissionStatusLabel: "No Submission",
      productsWithReportedStockCount: 0,
      totalAssortedProductsCount: 0,
      reorderAttentionCount: 0,
      items: [],
    };
  }

  // 4. Fetch Products Catalog & Brands
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
      )
    `)
    .in("id", Array.from(relevantProductIds))
    .order("name", { ascending: true });

  const products = rawProducts || [];

  // 5. Authoritative Images
  let imageMap: Record<string, { primaryUrl: string | null }> = {};
  try {
    imageMap = await resolveAuthoritativeProductImages(
      adminClient,
      products.map((p) => p.id)
    );
  } catch (e) {
    console.warn("[getAdminStoreInventoryData] Error fetching product images:", e);
  }

  // 6. Incoming Orders / Dispatches for this store
  const incomingMap = new Map<string, number>();
  try {
    const { data: openOrders } = await adminClient
      .from("retailer_orders")
      .select(`
        id,
        store_id,
        order_status,
        retailer_order_items (
          product_id,
          quantity
        )
      `)
      .eq("store_id", storeId)
      .in("order_status", ["confirmed", "processing", "partially_shipped", "shipped"]);

    (openOrders || []).forEach((ord: any) => {
      (ord.retailer_order_items || []).forEach((it: any) => {
        if (it.product_id) {
          const prev = incomingMap.get(it.product_id) || 0;
          incomingMap.set(it.product_id, prev + (Number(it.quantity) || 0));
        }
      });
    });
  } catch (e) {
    console.warn("[getAdminStoreInventoryData] Error fetching incoming orders:", e);
  }

  // 7. Build Product Inventory Items
  const items: AdminStoreInventoryItem[] = products.map((prod: any) => {
    const brand = Array.isArray(prod.brands) ? prod.brands[0] : prod.brands;
    const sku = resolveEffectiveSku(prod) || "KS-SKU";
    const primaryImg = imageMap[prod.id]?.primaryUrl || null;

    // Pricing & Policy
    const wholesalePrice = Number(prod.price_additional_info?.wholesale_price) || 15;
    const retailPrice = Number(prod.estimated_retail_price) || wholesalePrice * 2;
    const cartonPackQty = Number(prod.carton_pack_qty) || 12;

    const policy = resolveRetailerSalesPolicy(prod);
    const moq = policy?.moq || 6;
    const orderMultiple = policy?.orderMultiple || 6;

    // Check if counted in latest submitted check
    const chkItem = latestSubmittedCheck?.retailer_weekly_check_items?.find(
      (i: any) => i.product_id === prod.id && i.is_counted
    );

    const isSubmitted = chkItem !== undefined && chkItem.reported_remaining_qty !== null;
    const reportedRemaining = isSubmitted ? Number(chkItem.reported_remaining_qty) : null;
    const isReportedZero = reportedRemaining === 0;

    const reportingDate = isSubmitted ? latestSubmittedCheck.report_date : null;
    const reportingWeek = isSubmitted ? latestSubmittedCheck.reporting_week : null;
    const submissionStatus: AdminStoreInventoryItem["submissionStatus"] = isSubmitted
      ? "submitted"
      : latestAnyCheck?.status === "draft"
      ? "draft"
      : "not_reported";

    const estimatedSold =
      chkItem?.estimated_movement !== null && chkItem?.estimated_movement !== undefined
        ? Number(chkItem.estimated_movement)
        : null;

    // Reorder Recommendation Logic
    let reorderNeeded = false;
    let suggestedReorderQty = 0;
    let suggestedCases = 0;
    let reorderReason = "";
    let reorderSignal: AdminStoreInventoryItem["reorderSignal"] = "not_available";

    const incomingQty = incomingMap.get(prod.id) || 0;

    if (reportedRemaining === null) {
      reorderNeeded = false;
      suggestedReorderQty = 0;
      suggestedCases = 0;
      reorderReason = "Needs Weekly Check — physical inventory not reported";
      reorderSignal = "needs_check";
    } else {
      const projectedStock = reportedRemaining + incomingQty;
      const weeklyVelocity = estimatedSold && estimatedSold > 0 ? estimatedSold : 0;
      const targetDemand =
        weeklyVelocity > 0 ? weeklyVelocity * 4 : Math.max(moq, cartonPackQty);

      if (projectedStock < targetDemand) {
        const rawNeed = targetDemand - projectedStock;
        const norm = normalizeReorderQuantity(rawNeed, moq, orderMultiple, true);
        suggestedReorderQty = norm.normalizedQty;

        if (suggestedReorderQty > 0) {
          reorderNeeded = true;
          suggestedCases = Math.ceil(suggestedReorderQty / Math.max(1, cartonPackQty));
          reorderSignal = "reorder_needed";
          reorderReason =
            projectedStock === 0
              ? "Stockout risk — zero projected inventory"
              : `Below target supply (${projectedStock} available vs ${targetDemand} needed)`;
        }
      } else {
        reorderSignal = "sufficient_stock";
        reorderReason = "Sufficient stock for current demand";
      }
    }

    let dataStatus: AdminStoreInventoryItem["dataStatus"] = "not_reported";
    if (reorderNeeded) {
      dataStatus = "reorder_attention";
    } else if (isReportedZero) {
      dataStatus = "zero_stock";
    } else if (isSubmitted) {
      dataStatus = "reported";
    }

    return {
      productId: prod.id,
      productName: prod.name || "Unnamed Product",
      brandName: brand?.name || "K SELECT Brand",
      sku,
      thumbnailUrl: primaryImg,
      category: prod.category_code || prod.category || "General",
      cartonPackQty,
      moq,
      orderMultiple,
      wholesalePrice,
      retailPrice,
      reportedRemaining,
      isReportedZero,
      reportingDate,
      reportingWeek,
      submissionStatus,
      estimatedSold,
      reorderNeeded,
      suggestedReorderQty,
      suggestedCases,
      reorderReason,
      reorderSignal,
      dataStatus,
    };
  });

  const reportedCount = items.filter((i) => i.reportedRemaining !== null).length;
  const reorderAttentionCount = items.filter((i) => i.reorderNeeded).length;

  let submissionStatus: AdminStoreInventoryOverview["submissionStatus"] = "no_submission";
  let submissionStatusLabel = "No Submission";
  if (latestSubmittedCheck) {
    submissionStatus = "submitted";
    submissionStatusLabel = "Submitted";
  } else if (latestAnyCheck?.status === "draft") {
    submissionStatus = "in_progress";
    submissionStatusLabel = "In Progress (Draft)";
  }

  return {
    storeId: store.id,
    storeName: store.name,
    companyId,
    companyName,
    latestSubmissionDate: latestSubmittedCheck?.report_date || null,
    latestReportingWeek: latestSubmittedCheck?.reporting_week || null,
    submissionStatus,
    submissionStatusLabel,
    productsWithReportedStockCount: reportedCount,
    totalAssortedProductsCount: items.length,
    reorderAttentionCount,
    items,
  };
}

export async function getAdminStoreOperationsData(): Promise<AdminStoreOperationsData> {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  // 1. Fetch all store records with parent retailer company
  // Note: explicit constraint 'companies!stores_company_id_fkey' is required because companies
  // also has 'default_shipping_store_id' FK pointing to stores(id).
  const { data: rawStores, error: storesErr } = await adminClient
    .from("stores")
    .select(`
      id,
      name,
      store_code,
      type,
      status,
      address,
      city,
      state,
      zip,
      phone,
      email,
      manager_name,
      manager_phone,
      company_id,
      created_at,
      updated_at,
      companies:companies!stores_company_id_fkey (
        id,
        name,
        company_code
      )
    `)
    .order("created_at", { ascending: true });

  if (storesErr) {
    console.error("[getAdminStoreOperationsData] Error fetching stores:", storesErr);
    throw new Error(storesErr.message || "Failed to load store operations data.");
  }

  const stores = rawStores || [];
  const storeIds = stores.map((s) => s.id);

  // 2. Fetch associated counts in batch if stores exist
  let ordersCountByStore: Record<string, number> = {};
  let usersCountByStore: Record<string, number> = {};
  let checksCountByStore: Record<string, number> = {};
  let latestCheckByStore: Record<string, { date: string | null; status: string | null }> = {};

  if (storeIds.length > 0) {
    // 2.1 Orders per store
    try {
      const { data: orderRows } = await adminClient
        .from("retailer_orders")
        .select("store_id")
        .in("store_id", storeIds);

      (orderRows || []).forEach((r) => {
        if (r.store_id) {
          ordersCountByStore[r.store_id] = (ordersCountByStore[r.store_id] || 0) + 1;
        }
      });
    } catch (e) {
      console.warn("[getAdminStoreOperationsData] Warning fetching orders per store:", e);
    }

    // 2.2 Assigned staff per store
    try {
      const { data: userAccessRows } = await adminClient
        .from("retailer_user_store_access")
        .select("store_id")
        .in("store_id", storeIds);

      (userAccessRows || []).forEach((r) => {
        if (r.store_id) {
          usersCountByStore[r.store_id] = (usersCountByStore[r.store_id] || 0) + 1;
        }
      });
    } catch (e) {
      console.warn("[getAdminStoreOperationsData] Warning fetching user store access:", e);
    }

    // 2.3 Weekly inventory checks per store
    try {
      const { data: checkRows } = await adminClient
        .from("retailer_weekly_checks")
        .select("id, store_id, report_date, status, created_at")
        .in("store_id", storeIds)
        .order("report_date", { ascending: false });

      (checkRows || []).forEach((c) => {
        if (c.store_id) {
          checksCountByStore[c.store_id] = (checksCountByStore[c.store_id] || 0) + 1;
          if (!latestCheckByStore[c.store_id]) {
            latestCheckByStore[c.store_id] = {
              date: c.report_date || c.created_at || null,
              status: c.status || null,
            };
          }
        }
      });
    } catch (e) {
      console.warn("[getAdminStoreOperationsData] Warning fetching weekly checks:", e);
    }
  }

  // 3. Format store records
  const formattedStores: AdminStoreOperationItem[] = stores.map((s: any) => {
    const comp = Array.isArray(s.companies) ? s.companies[0] : s.companies;
    const latestCheck = latestCheckByStore[s.id] || { date: null, status: null };

    return {
      id: s.id,
      name: s.name || "Unnamed Store",
      storeCode: s.store_code || null,
      type: s.type || "Independent Beauty Supply",
      status: s.status || "active",
      address: s.address || null,
      city: s.city || null,
      state: s.state || null,
      zip: s.zip || null,
      phone: s.phone || null,
      email: s.email || null,
      managerName: s.manager_name || null,
      managerPhone: s.manager_phone || null,
      companyId: s.company_id,
      companyName: comp?.name || "Retailer Organization",
      companyCode: comp?.company_code || null,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      ordersCount: ordersCountByStore[s.id] || 0,
      assignedUsersCount: usersCountByStore[s.id] || 0,
      weeklyChecksCount: checksCountByStore[s.id] || 0,
      latestWeeklyCheckDate: latestCheck.date,
      latestWeeklyCheckStatus: latestCheck.status,
    };
  });

  // 4. Extract unique retailers for filtering
  const retailerMap = new Map<string, { id: string; name: string; companyCode: string | null }>();
  formattedStores.forEach((st) => {
    if (st.companyId && !retailerMap.has(st.companyId)) {
      retailerMap.set(st.companyId, {
        id: st.companyId,
        name: st.companyName,
        companyCode: st.companyCode,
      });
    }
  });

  // 5. Batch resolve store inventory overviews for all stores
  const storeInventoryMap: Record<string, AdminStoreInventoryOverview> = {};
  for (const st of formattedStores) {
    try {
      const inv = await getAdminStoreInventoryData(st.id);
      if (inv) {
        storeInventoryMap[st.id] = inv;
      }
    } catch (e) {
      console.warn(`[getAdminStoreOperationsData] Warning resolving inventory for store ${st.id}:`, e);
    }
  }

  return {
    stores: formattedStores,
    retailers: Array.from(retailerMap.values()),
    totalStoresCount: formattedStores.length,
    activeStoresCount: formattedStores.filter((s) => s.status === "active").length,
    totalRetailersCount: retailerMap.size,
    storeInventoryMap,
  };
}
