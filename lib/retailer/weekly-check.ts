import "server-only";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEffectiveSku } from "@/lib/product/types";
import {
  getStoreConfirmedDeliveredQty,
  getStoreConfirmedDeliveredQtysBatch,
} from "@/lib/retailer/fulfillment-actions";

import {
  WeeklyCheckItemState,
  WeeklyCheckSession,
  WeeklyCheckHistorySummary,
  getCurrentReportingWeek,
  getWeeklyCheckPath,
} from "./weekly-check-types";
export * from "./weekly-check-types";

/**
 * Fetch assigned / accessible stores for the authenticated user
 */
export async function getRetailerAccessibleStores() {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  const { data: companyUser } = await adminClient
    .from("company_users")
    .select("company_id")
    .eq("id", session.userId)
    .maybeSingle();

  const companyId = companyUser?.company_id;
  if (!companyId) return { companyId: null, userRole: null, stores: [] };

  const { data: userRoleRow } = await adminClient
    .from("retailer_user_roles")
    .select("role, has_all_stores_access")
    .eq("user_id", session.userId)
    .eq("company_id", companyId)
    .maybeSingle();

  const userRole = userRoleRow?.role || "employee";
  const hasAllStoresAccess = userRoleRow?.has_all_stores_access ?? false;

  let storesQuery = adminClient
    .from("stores")
    .select("id, name, address, city, state, zip, phone")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  if (!hasAllStoresAccess && userRole !== "owner" && userRole !== "buyer") {
    const { data: assigned } = await adminClient
      .from("retailer_user_store_access")
      .select("store_id")
      .eq("user_id", session.userId)
      .eq("company_id", companyId);

    const storeIds = (assigned || []).map((a) => a.store_id);
    if (storeIds.length === 0) {
      return { companyId, userRole, stores: [] };
    }
    storesQuery = storesQuery.in("id", storeIds);
  }

  const { data: stores, error } = await storesQuery;
  if (error || !stores) {
    return { companyId, userRole, stores: [] };
  }

  return { companyId, userRole, stores };
}

/**
 * Authoritative Store-Specific Countable SKU Policy:
 * 1. Active assigned store assortment products (retailer_store_products where is_active = true)
 * 2. Confirmed delivered products for this store (retailer_order_fulfillments where status = 'delivered' and quantity_delivered > 0)
 * 3. Delivered orders for this store (retailer_orders where order_status = 'delivered')
 * 4. Previously counted products in submitted checks for this store (continuity)
 *
 * Strict Exclusions:
 * - Orders destined for other stores (never leak across stores)
 * - Cancelled order quantities
 * - In-transit/pending orders that have not yet been delivered to the store (represented as incoming)
 */
export async function getStoreAssortmentProductIds(companyId: string, storeId: string): Promise<string[]> {
  const adminClient = createAdminClient();
  const candidateIds = new Set<string>();

  // 1. Explicit Store Assortment (retailer_store_products)
  try {
    const { data: storeProducts } = await adminClient
      .from("retailer_store_products")
      .select("product_id")
      .eq("store_id", storeId)
      .eq("is_active", true);

    (storeProducts || []).forEach((sp) => {
      if (sp.product_id) candidateIds.add(sp.product_id);
    });
  } catch {
    // ignore
  }

  // 2. Confirmed Delivered Fulfillments for this store
  try {
    const { data: deliveredFulfillments } = await adminClient
      .from("retailer_order_fulfillments")
      .select(`
        id,
        retailer_order_fulfillment_items (
          product_id,
          quantity_delivered
        )
      `)
      .eq("store_id", storeId)
      .eq("status", "delivered")
      .not("delivered_at", "is", null);

    (deliveredFulfillments || []).forEach((f) => {
      const items = (f.retailer_order_fulfillment_items as any[]) || [];
      items.forEach((it) => {
        if (Number(it.quantity_delivered || 0) > 0 && it.product_id) {
          candidateIds.add(it.product_id);
        }
      });
    });
  } catch {
    // ignore
  }

  // 3. Delivered Orders for this store (safety fallback for direct delivered status)
  try {
    const { data: deliveredOrders } = await adminClient
      .from("retailer_orders")
      .select(`
        id,
        retailer_order_items (
          product_id,
          quantity,
          quantity_cancelled
        )
      `)
      .eq("store_id", storeId)
      .eq("order_status", "delivered");

    (deliveredOrders || []).forEach((o) => {
      const items = (o.retailer_order_items as any[]) || [];
      items.forEach((it) => {
        const netQty = Number(it.quantity || 0) - Number(it.quantity_cancelled || 0);
        if (netQty > 0 && it.product_id) {
          candidateIds.add(it.product_id);
        }
      });
    });
  } catch {
    // ignore
  }

  // 4. Previously counted items in submitted weekly checks for this store (continuity)
  try {
    const { data: submittedChecks } = await adminClient
      .from("retailer_weekly_checks")
      .select(`
        id,
        retailer_weekly_check_items (
          product_id,
          is_counted,
          reported_remaining_qty
        )
      `)
      .eq("store_id", storeId)
      .eq("status", "submitted");

    (submittedChecks || []).forEach((c) => {
      const items = (c.retailer_weekly_check_items as any[]) || [];
      items.forEach((it) => {
        if (it.product_id && (it.is_counted || Number(it.reported_remaining_qty || 0) > 0)) {
          candidateIds.add(it.product_id);
        }
      });
    });
  } catch {
    // ignore
  }

  return Array.from(candidateIds);
}

/**
 * Calculate incoming stock per product for a store (shipped or confirmed orders not yet delivered)
 */
export async function getStoreIncomingQtys(storeId: string): Promise<Map<string, number>> {
  const incomingMap = new Map<string, number>();
  const adminClient = createAdminClient();

  try {
    // In-transit fulfillments (status = 'shipped')
    const { data: inTransit } = await adminClient
      .from("retailer_order_fulfillments")
      .select(`
        retailer_order_fulfillment_items (
          product_id,
          quantity_shipped
        )
      `)
      .eq("store_id", storeId)
      .eq("status", "shipped");

    (inTransit || []).forEach((f) => {
      const items = (f.retailer_order_fulfillment_items as any[]) || [];
      items.forEach((it) => {
        const pId = it.product_id;
        if (pId) {
          const current = incomingMap.get(pId) || 0;
          incomingMap.set(pId, current + Number(it.quantity_shipped || 0));
        }
      });
    });

    // Also check confirmed orders that don't have shipped fulfillments yet
    const { data: pendingOrders } = await adminClient
      .from("retailer_orders")
      .select(`
        id,
        retailer_order_items (
          product_id,
          quantity,
          quantity_shipped,
          quantity_cancelled
        )
      `)
      .eq("store_id", storeId)
      .in("order_status", ["confirmed", "processing", "submitted"]);

    (pendingOrders || []).forEach((o) => {
      const items = (o.retailer_order_items as any[]) || [];
      items.forEach((it) => {
        const netOrdered = Number(it.quantity || 0) - Number(it.quantity_cancelled || 0);
        const shipped = Number(it.quantity_shipped || 0);
        const unfulfilled = Math.max(0, netOrdered - shipped);
        if (unfulfilled > 0 && it.product_id) {
          const current = incomingMap.get(it.product_id) || 0;
          incomingMap.set(it.product_id, current + unfulfilled);
        }
      });
    });
  } catch {
    // ignore
  }

  return incomingMap;
}

/**
 * Fetch or start a Weekly Check Session (Draft or existing submitted check) for a store
 */
export async function getOrCreateStoreWeeklyCheck(storeId: string): Promise<WeeklyCheckSession | null> {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();
  const currentWeek = getCurrentReportingWeek();

  // 1. Verify store accessibility
  const { companyId, stores } = await getRetailerAccessibleStores();
  if (!companyId || !stores.some((s) => s.id === storeId)) {
    throw new Error("Store access not authorized.");
  }

  const targetStore = stores.find((s) => s.id === storeId)!;
  const incomingMap = await getStoreIncomingQtys(storeId);

  // 2. Look for an existing check for this week (draft or submitted)
  const { data: existingCheck } = await adminClient
    .from("retailer_weekly_checks")
    .select(`
      id,
      company_id,
      store_id,
      reporting_week,
      report_date,
      status,
      total_products_count,
      total_counted_products,
      total_remaining_units,
      notes,
      is_test,
      started_at,
      submitted_at,
      retailer_weekly_check_items (
        id,
        product_id,
        reported_remaining_qty,
        previous_reported_qty,
        delivered_since_previous,
        estimated_movement,
        is_counted,
        notes,
        products (
          id,
          name,
          name_en,
          letusto_sku,
          manufacture_sku,
          status,
          price_additional_info,
          brands (
            name
          ),
          product_images (
            storage_path,
            position
          )
        )
      )
    `)
    .eq("store_id", storeId)
    .eq("reporting_week", currentWeek)
    .maybeSingle();

  if (existingCheck) {
    let rawItems = (existingCheck.retailer_weekly_check_items as any[]) || [];

    // Draft Self-Healing: If check is still in DRAFT, ensure any newly delivered or eligible countable products are added
    if (existingCheck.status === "draft") {
      const currentCountableIds = await getStoreAssortmentProductIds(companyId, storeId);
      const existingProductIds = new Set(rawItems.map((it: any) => it.product_id));
      const missingProductIds = currentCountableIds.filter((id) => !existingProductIds.has(id));

      if (missingProductIds.length > 0) {
        const { data: missingProducts } = await adminClient
          .from("products")
          .select(`
            id,
            name,
            name_en,
            letusto_sku,
            manufacture_sku,
            status,
            price_additional_info,
            brands (name),
            product_images (storage_path, position)
          `)
          .in("id", missingProductIds)
          .in("status", ["selling", "registered"]);

        const validMissing = (missingProducts || []).filter((p) => {
          const info = (p.price_additional_info as any) || {};
          return !info.deleted_at && !(p as any).deleted_at;
        });

        if (validMissing.length > 0) {
          // Batch fetch delivered quantity since previous check for missing items
          const missingDeliveredMap = await getStoreConfirmedDeliveredQtysBatch(
            storeId,
            validMissing.map((p) => p.id),
            null,
            new Date().toISOString()
          );

          const newItemsToInsert = validMissing.map((p) => ({
            check_id: existingCheck.id,
            product_id: p.id,
            reported_remaining_qty: 0,
            previous_reported_qty: null,
            delivered_since_previous: missingDeliveredMap.get(p.id) ?? null,
            estimated_movement: null,
            is_counted: false,
          }));

          await adminClient.from("retailer_weekly_check_items").insert(newItemsToInsert);

          // Update total_products_count
          const newTotalCount = rawItems.length + validMissing.length;
          await adminClient
            .from("retailer_weekly_checks")
            .update({
              total_products_count: newTotalCount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingCheck.id);

          existingCheck.total_products_count = newTotalCount;

          // Append newly inserted items to rawItems
          validMissing.forEach((p, idx) => {
            rawItems.push({
              id: undefined,
              product_id: p.id,
              reported_remaining_qty: 0,
              previous_reported_qty: null,
              delivered_since_previous: missingDeliveredMap.get(p.id) ?? null,
              estimated_movement: null,
              is_counted: false,
              notes: null,
              products: p,
            });
          });
        }
      }
    }

    // Batch resolve delivered quantities if any draft items need them
    const itemsNeedingDelivered = rawItems.filter(
      (it: any) => it.delivered_since_previous === null && it.previous_reported_qty !== null && existingCheck.status === "draft"
    );
    let batchDeliveredMap = new Map<string, number>();
    if (itemsNeedingDelivered.length > 0) {
      batchDeliveredMap = await getStoreConfirmedDeliveredQtysBatch(
        storeId,
        itemsNeedingDelivered.map((it: any) => it.product_id),
        null,
        new Date().toISOString()
      );
    }

    const items: WeeklyCheckItemState[] = await Promise.all(
      rawItems.map(async (item) => {
        const p = item.products || {};
        const info = (p.price_additional_info as any) || {};
        const overrides = info.admin_overrides || {};
        const sku =
          resolveEffectiveSku(overrides.letusto_sku, p.letusto_sku) ||
          resolveEffectiveSku(overrides.manufacture_sku, p.manufacture_sku) ||
          "KS-SKU";

        // Image signing
        const rawImgs = (p.product_images as any[]) || [];
        const sorted = [...rawImgs].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        let thumb: string | null = null;
        if (sorted.length > 0 && sorted[0].storage_path) {
          try {
            const { data: signed } = await adminClient.storage
              .from("company-uploads")
              .createSignedUrl(sorted[0].storage_path, 3600);
            thumb = signed?.signedUrl || null;
          } catch {
            // ignore
          }
        }

        // Compute honest movement:
        let deliveredSince: number | null = item.delivered_since_previous ?? null;
        if (deliveredSince === null && item.previous_reported_qty !== null && existingCheck.status === "draft") {
          deliveredSince = batchDeliveredMap.get(item.product_id) ?? null;
        }

        let movement: number | null = item.estimated_movement ?? null;
        if (movement === null && item.previous_reported_qty !== null && item.is_counted) {
          const delivered = deliveredSince ?? 0;
          movement = item.previous_reported_qty + delivered - (item.reported_remaining_qty || 0);
        }

        return {
          id: item.id,
          productId: item.product_id,
          productName: overrides.name?.trim() || p.name || "Product",
          productNameEn: overrides.name_en?.trim() || p.name_en || null,
          brandName: p.brands?.name || "K SELECT Brand",
          sku,
          thumbnailUrl: thumb,
          reportedRemainingQty: item.reported_remaining_qty || 0,
          previousReportedQty: item.previous_reported_qty ?? null,
          deliveredSincePrevious: deliveredSince,
          estimatedMovement: movement,
          isCounted: Boolean(item.is_counted),
          notes: item.notes || null,
          incomingQty: incomingMap.get(item.product_id) || 0,
        };
      })
    );

    return {
      id: existingCheck.id,
      companyId: existingCheck.company_id,
      storeId: existingCheck.store_id,
      storeName: targetStore.name,
      reportingWeek: existingCheck.reporting_week,
      reportDate: existingCheck.report_date,
      status: existingCheck.status as any,
      totalProductsCount: existingCheck.total_products_count,
      totalCountedProducts: existingCheck.total_counted_products,
      totalRemainingUnits: existingCheck.total_remaining_units,
      notes: existingCheck.notes,
      isTest: Boolean(existingCheck.is_test),
      startedAt: existingCheck.started_at,
      submittedAt: existingCheck.submitted_at,
      items,
    };
  }

  // 3. No existing check for this week -> Create new Draft Session
  // Fetch store-specific assortment product IDs
  const assortmentIds = await getStoreAssortmentProductIds(companyId, storeId);

  // If store has no products assigned or delivered yet, initialize clean empty draft session
  if (assortmentIds.length === 0) {
    const { data: emptyCheck, error: emptyCheckErr } = await adminClient
      .from("retailer_weekly_checks")
      .insert({
        company_id: companyId,
        store_id: storeId,
        submitted_by: session.userId,
        reporting_week: currentWeek,
        report_date: new Date().toISOString().split("T")[0],
        status: "draft",
        total_products_count: 0,
        total_counted_products: 0,
        total_remaining_units: 0,
        is_test: false,
      })
      .select("id, company_id, store_id, reporting_week, report_date, status, started_at, submitted_at, is_test")
      .single();

    if (emptyCheckErr || !emptyCheck) {
      console.error("Error creating empty weekly check:", emptyCheckErr);
      return null;
    }

    return {
      id: emptyCheck.id,
      companyId,
      storeId,
      storeName: targetStore.name,
      reportingWeek: currentWeek,
      reportDate: emptyCheck.report_date,
      status: "draft",
      totalProductsCount: 0,
      totalCountedProducts: 0,
      totalRemainingUnits: 0,
      notes: null,
      isTest: false,
      startedAt: emptyCheck.started_at,
      submittedAt: null,
      items: [],
    };
  }

  // Fetch candidate products (selling and registered, non-deleted)
  const { data: rawProducts } = await adminClient
    .from("products")
    .select(`
      id,
      name,
      name_en,
      letusto_sku,
      manufacture_sku,
      status,
      price_additional_info,
      brands (
        name
      ),
      product_images (
        storage_path,
        position
      )
    `)
    .in("id", assortmentIds)
    .in("status", ["selling", "registered"])
    .order("created_at", { ascending: false });

  // Filter products that are not soft-deleted
  const candidateProducts = (rawProducts || []).filter((p) => {
    const info = (p.price_additional_info as any) || {};
    return !info.deleted_at && !(p as any).deleted_at;
  });

  // Find previous submitted counts for this store to populate previousReportedQty
  const { data: lastSubmittedCheck } = await adminClient
    .from("retailer_weekly_checks")
    .select(`
      id,
      submitted_at,
      report_date,
      retailer_weekly_check_items (
        product_id,
        reported_remaining_qty
      )
    `)
    .eq("store_id", storeId)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevQtyMap = new Map<string, number>();
  if (lastSubmittedCheck) {
    const prevItems = (lastSubmittedCheck.retailer_weekly_check_items as any[]) || [];
    prevItems.forEach((it) => prevQtyMap.set(it.product_id, it.reported_remaining_qty));
  }

  // Batch query delivered quantities since last submitted check
  const prevSubmittedAt = lastSubmittedCheck?.submitted_at || lastSubmittedCheck?.report_date || null;
  const batchDeliveredMap = await getStoreConfirmedDeliveredQtysBatch(
    storeId,
    candidateProducts.map((p) => p.id),
    prevSubmittedAt,
    new Date().toISOString()
  );

  // Fetch company name for test flag
  const { data: company } = await adminClient
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .single();

  const isTestCompany =
    company?.name.toLowerCase().includes("test") ||
    company?.name.toLowerCase().includes("qa") ||
    company?.name.toLowerCase().includes("demo") ||
    false;

  // Insert Header Draft
  const { data: newCheck, error: checkInsertErr } = await adminClient
    .from("retailer_weekly_checks")
    .insert({
      company_id: companyId,
      store_id: storeId,
      submitted_by: session.userId,
      reporting_week: currentWeek,
      report_date: new Date().toISOString().split("T")[0],
      status: "draft",
      total_products_count: candidateProducts.length,
      total_counted_products: 0,
      total_remaining_units: 0,
      is_test: isTestCompany,
    })
    .select("id, company_id, store_id, reporting_week, report_date, status, started_at, submitted_at, is_test")
    .single();

  if (checkInsertErr || !newCheck) {
    console.error("Error inserting weekly check:", checkInsertErr);
    return null;
  }

  // Insert Items with batch confirmed delivered_since_previous
  const itemsToInsert = candidateProducts.map((p) => {
    const prevQty = prevQtyMap.get(p.id) ?? null;
    const deliveredSince = prevQty !== null ? batchDeliveredMap.get(p.id) ?? null : null;
    return {
      check_id: newCheck.id,
      product_id: p.id,
      reported_remaining_qty: 0,
      previous_reported_qty: prevQty,
      delivered_since_previous: deliveredSince,
      estimated_movement: null,
      is_counted: false,
    };
  });

  if (itemsToInsert.length > 0) {
    await adminClient.from("retailer_weekly_check_items").insert(itemsToInsert);
  }

  return getOrCreateStoreWeeklyCheck(storeId);
}

/**
 * Fetch a weekly check by ID
 */
export async function getWeeklyCheckById(checkId: string): Promise<WeeklyCheckSession | null> {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  const { data: companyUser } = await adminClient
    .from("company_users")
    .select("company_id")
    .eq("id", session.userId)
    .maybeSingle();

  const companyId = companyUser?.company_id;
  if (!companyId) return null;

  const { data: check, error } = await adminClient
    .from("retailer_weekly_checks")
    .select(`
      id,
      company_id,
      store_id,
      reporting_week,
      report_date,
      status,
      total_products_count,
      total_counted_products,
      total_remaining_units,
      notes,
      is_test,
      started_at,
      submitted_at,
      stores (
        name
      ),
      retailer_weekly_check_items (
        id,
        product_id,
        reported_remaining_qty,
        previous_reported_qty,
        delivered_since_previous,
        estimated_movement,
        is_counted,
        notes,
        products (
          id,
          name,
          name_en,
          letusto_sku,
          manufacture_sku,
          price_additional_info,
          brands (
            name
          ),
          product_images (
            storage_path,
            position
          )
        )
      )
    `)
    .eq("id", checkId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !check) return null;

  const incomingMap = await getStoreIncomingQtys(check.store_id);
  const rawItems = (check.retailer_weekly_check_items as any[]) || [];
  const items: WeeklyCheckItemState[] = await Promise.all(
    rawItems.map(async (item) => {
      const p = item.products || {};
      const info = (p.price_additional_info as any) || {};
      const overrides = info.admin_overrides || {};
      const sku =
        resolveEffectiveSku(overrides.letusto_sku, p.letusto_sku) ||
        resolveEffectiveSku(overrides.manufacture_sku, p.manufacture_sku) ||
        "KS-SKU";

      const rawImgs = (p.product_images as any[]) || [];
      const sorted = [...rawImgs].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      let thumb: string | null = null;
      if (sorted.length > 0 && sorted[0].storage_path) {
        try {
          const { data: signed } = await adminClient.storage
            .from("company-uploads")
            .createSignedUrl(sorted[0].storage_path, 3600);
          thumb = signed?.signedUrl || null;
        } catch {
          // ignore
        }
      }

      let movement: number | null = item.estimated_movement ?? null;
      if (movement === null && item.previous_reported_qty !== null && item.is_counted) {
        const delivered = item.delivered_since_previous ?? 0;
        movement = item.previous_reported_qty + delivered - (item.reported_remaining_qty || 0);
      }

      return {
        id: item.id,
        productId: item.product_id,
        productName: overrides.name?.trim() || p.name || "Product",
        productNameEn: overrides.name_en?.trim() || p.name_en || null,
        brandName: p.brands?.name || "K SELECT Brand",
        sku,
        thumbnailUrl: thumb,
        reportedRemainingQty: item.reported_remaining_qty || 0,
        previousReportedQty: item.previous_reported_qty ?? null,
        deliveredSincePrevious: item.delivered_since_previous ?? null,
        estimatedMovement: movement,
        isCounted: Boolean(item.is_counted),
        notes: item.notes || null,
        incomingQty: incomingMap.get(item.product_id) || 0,
      };
    })
  );

  return {
    id: check.id,
    companyId: check.company_id,
    storeId: check.store_id,
    storeName: (check.stores as any)?.name || "Store",
    reportingWeek: check.reporting_week,
    reportDate: check.report_date,
    status: check.status as any,
    totalProductsCount: check.total_products_count,
    totalCountedProducts: check.total_counted_products,
    totalRemainingUnits: check.total_remaining_units,
    notes: check.notes,
    isTest: Boolean(check.is_test),
    startedAt: check.started_at,
    submittedAt: check.submitted_at,
    items,
  };
}

/**
 * Fetch weekly check submission history
 */
export async function getWeeklyCheckHistory(storeId?: string): Promise<WeeklyCheckHistorySummary[]> {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  const { data: companyUser } = await adminClient
    .from("company_users")
    .select("company_id")
    .eq("id", session.userId)
    .maybeSingle();

  const companyId = companyUser?.company_id;
  if (!companyId) return [];

  let query = adminClient
    .from("retailer_weekly_checks")
    .select(`
      id,
      store_id,
      reporting_week,
      report_date,
      status,
      total_products_count,
      total_counted_products,
      total_remaining_units,
      submitted_at,
      stores (
        name
      )
    `)
    .eq("company_id", companyId)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false });

  if (storeId) {
    query = query.eq("store_id", storeId);
  }

  const { data: rows, error } = await query;
  if (error || !rows) return [];

  return rows.map((r) => ({
    id: r.id,
    storeId: r.store_id,
    storeName: (r.stores as any)?.name || "Store",
    reportingWeek: r.reporting_week,
    reportDate: r.report_date,
    status: r.status,
    totalProductsCount: r.total_products_count,
    totalCountedProducts: r.total_counted_products,
    totalRemainingUnits: r.total_remaining_units,
    submittedAt: r.submitted_at,
  }));
}
