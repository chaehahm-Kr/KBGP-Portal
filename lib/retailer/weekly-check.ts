import "server-only";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEffectiveSku } from "@/lib/product/types";

export interface WeeklyCheckItemState {
  id?: string;
  productId: string;
  productName: string;
  productNameEn: string | null;
  brandName: string;
  sku: string;
  thumbnailUrl: string | null;
  reportedRemainingQty: number;
  previousReportedQty: number | null;
  deliveredSincePrevious: number | null;
  estimatedMovement: number | null;
  isCounted: boolean;
  notes: string | null;
}

export interface WeeklyCheckSession {
  id: string;
  companyId: string;
  storeId: string;
  storeName: string;
  reportingWeek: string;
  reportDate: string;
  status: "draft" | "submitted" | "cancelled";
  totalProductsCount: number;
  totalCountedProducts: number;
  totalRemainingUnits: number;
  notes: string | null;
  isTest: boolean;
  startedAt: string;
  submittedAt: string | null;
  items: WeeklyCheckItemState[];
}

export interface WeeklyCheckHistorySummary {
  id: string;
  storeId: string;
  storeName: string;
  reportingWeek: string;
  reportDate: string;
  status: string;
  totalProductsCount: number;
  totalCountedProducts: number;
  totalRemainingUnits: number;
  submittedAt: string | null;
}

/**
 * Returns current ISO week format string, e.g. "2026-W39"
 */
export function getCurrentReportingWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

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
 * Fetch Store-specific eligible products (Store Assortment)
 * Preference order:
 * 1. Explicitly assigned products in retailer_store_products
 * 2. Products ordered for that store in retailer_orders/items
 * 3. Fallback active curated products if store has no assortment or order history yet
 */
async function getStoreAssortmentProductIds(companyId: string, storeId: string): Promise<string[]> {
  const adminClient = createAdminClient();

  // 1. Check retailer_store_products table (if table exists)
  try {
    const { data: storeProducts } = await adminClient
      .from("retailer_store_products")
      .select("product_id")
      .eq("store_id", storeId)
      .eq("is_active", true);

    if (storeProducts && storeProducts.length > 0) {
      return storeProducts.map((sp) => sp.product_id);
    }
  } catch {
    // table might be pending migration
  }

  // 2. Check retailer_orders for this store
  try {
    const { data: storeOrders } = await adminClient
      .from("retailer_orders")
      .select(`
        id,
        retailer_order_items (
          product_id
        )
      `)
      .eq("store_id", storeId);

    if (storeOrders && storeOrders.length > 0) {
      const pIds = new Set<string>();
      storeOrders.forEach((o) => {
        const items = (o.retailer_order_items as any[]) || [];
        items.forEach((it) => pIds.add(it.product_id));
      });
      if (pIds.size > 0) {
        return Array.from(pIds);
      }
    }
  } catch {
    // ignore
  }

  // 3. Fallback for brand new store without prior orders: Return active curated products
  return [];
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
    const rawItems = (existingCheck.retailer_weekly_check_items as any[]) || [];
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
        // If delivered_since_previous is null and previousReportedQty exists -> provisional movement
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

  // Fetch candidate products
  let productsQuery = adminClient
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
      product_curations (
        wholesale_price
      ),
      product_images (
        storage_path,
        position
      )
    `)
    .eq("status", "selling")
    .order("created_at", { ascending: false });

  if (assortmentIds.length > 0) {
    productsQuery = productsQuery.in("id", assortmentIds);
  }

  const { data: rawProducts } = await productsQuery;

  // Filter products that are active and curated
  const candidateProducts = (rawProducts || []).filter((p) => {
    const info = (p.price_additional_info as any) || {};
    if (info.deleted_at || (p as any).deleted_at) return false;
    const curation = Array.isArray(p.product_curations) ? p.product_curations[0] : p.product_curations;
    return curation && Number(curation.wholesale_price) > 0;
  });

  // Find previous submitted counts for this store to populate previousReportedQty
  const { data: lastSubmittedCheck } = await adminClient
    .from("retailer_weekly_checks")
    .select(`
      id,
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
    console.error("Error creating weekly check draft:", checkInsertErr);
    throw new Error("Failed to start weekly product check session.");
  }

  // Insert Items with NULL delivered_since_previous (Pending Delivery Tracking)
  const itemsToInsert = candidateProducts.map((p) => ({
    check_id: newCheck.id,
    product_id: p.id,
    reported_remaining_qty: 0,
    previous_reported_qty: prevQtyMap.get(p.id) ?? null,
    delivered_since_previous: null,
    estimated_movement: null,
    is_counted: false,
  }));

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
