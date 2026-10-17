/**
 * Sales Overview V1.0 — Canonical Network Query & Overview Service Layer
 * Task ID: ADM-SALES-PERF-004-R1
 * Location: lib/sales-overview/overview-service.ts
 *
 * Implements batched parallel queries to pull canonical data across:
 * - retailer_orders, retailer_order_items, retailer_order_refund_records
 * - stores, companies
 * - products, brands, categories
 * - landed_cost_results, inventory_cost_layers, inventory_balances
 * - retailer_exchange_claims, retailer_protected_supply_cohorts
 * - retailer_weekly_checks
 *
 * DIRECTIVES:
 * - Batched parallel queries to eliminate N+1 latency.
 * - Injected Supabase client support for deterministic testing.
 * - Strict read-only execution, zero DB mutations.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  aggregateSalesOverviewData,
  getSalesOverviewPeriodET,
  type RawStoreRecord,
  type RawOrderRecord,
  type RawOrderItemRecord,
  type RawRefundRecord,
  type RawCostRecord,
  type RawProductRecord,
  type RawInventoryLayerRecord,
  type RawExchangeClaimRecord,
  type RawWeeklyCheckRecord,
} from "./aggregation-engine";
import type { SalesOverviewDashboardData } from "./types";

export interface SalesOverviewQueryOptions {
  asOfDate?: string | Date;
  lookbackDays?: number;
  customRange?: { start: string; end: string };
  client?: SupabaseClient;
  includeTestOrders?: boolean;
}

/**
 * Authoritative service function to fetch and aggregate Sales Overview V1.0 data
 */
export async function getSalesOverviewData(
  options: SalesOverviewQueryOptions = {}
): Promise<{
  success: boolean;
  data?: SalesOverviewDashboardData;
  error?: string;
  benchmarkMs?: number;
}> {
  const startTime = Date.now();

  try {
    const supabase = options.client || createAdminClient();
    const period = getSalesOverviewPeriodET(
      options.asOfDate,
      options.lookbackDays,
      options.customRange
    );
    const includeTestOrders = options.includeTestOrders ?? false;

    // 1. Execute batched parallel queries across authoritative tables
    const [
      storesRes,
      ordersRes,
      orderItemsRes,
      refundsRes,
      costsRes,
      productsRes,
      inventoryRes,
      claimsRes,
      weeklyChecksRes,
      cohortsRes,
    ] = await Promise.all([
      // A. Stores & Companies
      supabase
        .from("stores")
        .select(`
          id,
          name,
          store_code,
          city,
          state,
          status,
          company_id,
          created_at,
          companies:companies!stores_company_id_fkey (
            id,
            name
          )
        `)
        .order("name", { ascending: true }),

      // B. Orders in trailing 60-day window (to capture Current 30D and Previous 30D)
      (() => {
        let q = supabase
          .from("retailer_orders")
          .select(`
            id,
            order_number,
            company_id,
            store_id,
            order_status,
            payment_status,
            subtotal_amount,
            discount_amount,
            total_amount,
            is_test,
            created_at
          `)
          .gte("created_at", `${period.previousPeriodStart}T00:00:00Z`);

        if (!includeTestOrders) {
          q = q.eq("is_test", false);
        }
        return q;
      })(),

      // C. Order items for orders in period
      supabase
        .from("retailer_order_items")
        .select(`
          id,
          order_id,
          product_id,
          quantity,
          unit_price,
          subtotal,
          discount_amount
        `),

      // D. Completed merchandise refunds
      supabase
        .from("retailer_order_refund_records")
        .select(`
          id,
          order_id,
          merchandise_amount,
          status,
          created_at
        `)
        .eq("status", "completed"),

      // E. Landed cost results
      supabase
        .from("landed_cost_results")
        .select(`
          product_id,
          received_date,
          unit_landed_cost
        `),

      // F. Products, Brands, Categories
      supabase
        .from("products")
        .select(`
          id,
          name,
          letusto_sku,
          brand_id,
          category_id,
          override_landed_cost,
          override_landed_cost_updated_at,
          brands:brands ( id, name ),
          categories:categories ( id, name )
        `),

      // G. Active inventory balances / cost layers
      supabase
        .from("inventory_cost_layers")
        .select(`
          product_id,
          remaining_qty,
          unit_landed_cost,
          status
        `)
        .gt("remaining_qty", 0)
        .neq("status", "DEPLETED"),

      // H. Retailer exchange claims
      supabase
        .from("retailer_exchange_claims")
        .select(`
          id,
          claim_number,
          store_id,
          total_claim_amount,
          status,
          claimed_at,
          stores:stores ( name )
        `),

      // I. Weekly checks in trailing 30 days
      supabase
        .from("retailer_weekly_checks")
        .select(`
          id,
          store_id,
          status,
          reporting_week,
          submitted_at
        `)
        .eq("status", "submitted")
        .gte("submitted_at", `${period.currentPeriodStart}T00:00:00Z`),

      // J. Protected supply cohorts
      supabase
        .from("retailer_protected_supply_cohorts")
        .select("store_id")
        .eq("is_active", true),
    ]);

    // Handle potential queries errors gracefully
    if (ordersRes.error) {
      console.error("[getSalesOverviewData] Orders query error:", ordersRes.error);
      return { success: false, error: `Orders query failed: ${ordersRes.error.message}` };
    }

    // 2. Map Supabase rows to pure engine inputs
    const rawStores: RawStoreRecord[] = (storesRes.data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      storeCode: s.store_code,
      companyId: s.company_id,
      companyName: s.companies?.name || "Unknown Company",
      city: s.city,
      state: s.state,
      status: s.status,
      createdAt: s.created_at,
    }));

    const rawOrders: RawOrderRecord[] = (ordersRes.data || []).map((o: any) => ({
      id: o.id,
      orderNumber: o.order_number,
      companyId: o.company_id,
      storeId: o.store_id,
      orderStatus: o.order_status,
      paymentStatus: o.payment_status,
      subtotalAmount: Number(o.subtotal_amount) || 0,
      discountAmount: Number(o.discount_amount) || 0,
      totalAmount: Number(o.total_amount) || 0,
      isTest: Boolean(o.is_test),
      createdAt: o.created_at,
    }));

    const rawOrderItems: RawOrderItemRecord[] = (orderItemsRes.data || []).map((it: any) => ({
      id: it.id,
      orderId: it.order_id,
      productId: it.product_id,
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unit_price) || 0,
      subtotal: Number(it.subtotal) || 0,
      discountAmount: Number(it.discount_amount) || 0,
    }));

    const rawRefunds: RawRefundRecord[] = (refundsRes.data || []).map((r: any) => ({
      id: r.id,
      orderId: r.order_id,
      merchandiseAmount: Number(r.merchandise_amount) || 0,
      status: r.status,
      createdAt: r.created_at,
    }));

    const rawCosts: RawCostRecord[] = (costsRes.data || []).map((c: any) => ({
      productId: c.product_id,
      effectiveDate: c.received_date,
      unitLandedCost: Number(c.unit_landed_cost) || 0,
    }));

    const rawProducts: RawProductRecord[] = (productsRes.data || []).map((p: any) => ({
      id: p.id,
      sku: p.letusto_sku || p.name,
      name: p.name,
      brandId: p.brand_id,
      brandName: p.brands?.name || null,
      categoryId: p.category_id,
      categoryName: p.categories?.name || null,
      overrideLandedCost: p.override_landed_cost ? Number(p.override_landed_cost) : null,
      overrideEffectiveDate: p.override_landed_cost_updated_at
        ? p.override_landed_cost_updated_at.slice(0, 10)
        : null,
    }));

    const rawLayers: RawInventoryLayerRecord[] = (inventoryRes.data || []).map((l: any) => ({
      productId: l.product_id,
      remainingQty: Number(l.remaining_qty) || 0,
      unitLandedCost: Number(l.unit_landed_cost) || 0,
      status: l.status,
    }));

    const rawClaims: RawExchangeClaimRecord[] = (claimsRes.data || []).map((cl: any) => ({
      id: cl.id,
      claimNumber: cl.claim_number,
      storeId: cl.store_id,
      storeName: cl.stores?.name || "Unknown Store",
      productId: cl.product_id || "",
      claimAmount: Number(cl.total_claim_amount) || 0,
      status: cl.status,
      claimedAt: cl.claimed_at,
    }));

    const rawWeeklyChecks: RawWeeklyCheckRecord[] = (weeklyChecksRes.data || []).map((w: any) => ({
      id: w.id,
      storeId: w.store_id,
      status: w.status,
      reportingWeek: w.reporting_week,
      submittedAt: w.submitted_at,
    }));

    const protectedStoreIds = Array.from(
      new Set((cohortsRes.data || []).map((c: any) => c.store_id).filter(Boolean))
    ) as string[];

    // 3. Execute pure aggregation
    const data = aggregateSalesOverviewData({
      period,
      stores: rawStores,
      orders: rawOrders,
      orderItems: rawOrderItems,
      refunds: rawRefunds,
      costs: rawCosts,
      products: rawProducts,
      inventoryLayers: rawLayers,
      claims: rawClaims,
      weeklyChecks: rawWeeklyChecks,
      protectedStoreIds,
    });

    const benchmarkMs = Date.now() - startTime;
    return { success: true, data, benchmarkMs };
  } catch (err: any) {
    console.error("[getSalesOverviewData] Unexpected error:", err);
    return { success: false, error: err?.message || "Failed to load Sales Overview data." };
  }
}
