"use server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  RetailerPerformanceOverview,
  StorePerformanceRecord,
  StoreSalesMetrics,
  UnallocatedCompanyOrder,
  PerformanceFilterOptions,
} from "./performance-types";
import {
  getEvaluationPeriodET,
  isTimestampInEtWindow,
  calculateOrderNetProductSales,
  calculateSalesGrowth,
  evaluateStoreAgeAndGrade,
  evaluateDisplayCompliance,
  evaluateWeeklyInventoryCompliance,
  evaluateProductTrainingCompliance,
  evaluateHqFollowUpStatus,
  evaluateDataConfidence,
  diagnoseSupportRecommendations,
  deriveSupportStatus,
  aggregateStoresToCompany,
  computeKpiSummary,
} from "./performance-engine";

/**
 * Authoritative Server Action for Retailer Performance V2.0
 * Task ID: ADM-SALES-PERF-002
 *
 * Implements batched queries to prevent N+1 query loops.
 * Scalable for 2,000+ stores.
 */
export async function getRetailerPerformanceData(
  options: PerformanceFilterOptions = {}
): Promise<{
  success: boolean;
  data?: RetailerPerformanceOverview;
  error?: string;
  benchmarkMs?: number;
}> {
  const startTime = Date.now();

  try {
    const session = await verifyAdminSession();
    if (!session || !session.userId || session.role !== "admin") {
      return { success: false, error: "Unauthorized: Administrator session required." };
    }

    const adminClient = createAdminClient();
    const period = getEvaluationPeriodET();
    const includeTestOrders = options.includeTestOrders ?? false;

    // 1. Fetch Stores & Companies in parallel
    const [
      storesRes,
      ordersRes,
      fulfillmentsRes,
      weeklyChecksRes,
      activitiesRes,
      trainingProgRes,
      storeAccessRes,
      orderItemsRes,
      fixturesRes,
      placementsRes,
      refundsRes,
    ] = await Promise.all([
      // A. Stores with company details
      adminClient
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
            name,
            company_code
          )
        `)
        .order("name", { ascending: true }),

      // B. Orders (filter is_test based on QA mode)
      (() => {
        let q = adminClient
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
            shipping_amount,
            tax_amount,
            total_amount,
            is_test,
            created_at
          `);
        if (!includeTestOrders) {
          q = q.eq("is_test", false);
        }
        return q;
      })(),

      // C. Fulfillments (to identify first shipment)
      adminClient
        .from("retailer_order_fulfillments")
        .select("id, store_id, order_id, status, shipped_at, delivered_at, created_at")
        .in("status", ["shipped", "delivered"]),

      // D. Weekly Checks
      adminClient
        .from("retailer_weekly_checks")
        .select("id, store_id, company_id, reporting_week, report_date, status, submitted_at")
        .eq("status", "submitted"),

      // E. Store Activities (safe schema fallback)
      adminClient
        .from("store_activities")
        .select("id, store_id, company_id, activity_type, title, description, activity_date, responsible_admin_name, has_follow_up, follow_up_date, follow_up_status")
        .order("activity_date", { ascending: false }),

      // F. Product Training Progress
      adminClient
        .from("retailer_product_training_progress")
        .select("id, company_id, user_id, product_id, status, completed_at")
        .eq("status", "completed"),

      // G. User Store Access (maps staff user_id to store_id)
      adminClient
        .from("retailer_user_store_access")
        .select("user_id, store_id, company_id"),

      // H. Order Items (to determine which products each store purchased)
      adminClient
        .from("retailer_order_items")
        .select("order_id, product_id, quantity"),

      // I. Store Fixtures
      adminClient
        .from("store_fixtures")
        .select("id, store_id, company_id, installation_status, operational_status, last_inspected_at, notes"),

      // J. Fixture Placements
      adminClient
        .from("store_fixture_placements")
        .select("id, store_id, store_fixture_id, product_id, placement_status"),

      // K. Merchandise Refunds
      adminClient
        .from("retailer_order_refund_records")
        .select("id, order_id, company_id, merchandise_amount, status")
        .eq("status", "completed"),
    ]);

    if (storesRes.error) {
      console.error("[getRetailerPerformanceData] Stores query failed:", storesRes.error);
      return { success: false, error: storesRes.error.message };
    }

    const storesRaw = storesRes.data || [];
    const ordersRaw = ordersRes.data || [];
    const fulfillmentsRaw = fulfillmentsRes.data || [];
    const weeklyChecksRaw = weeklyChecksRes.data || [];
    const activitiesRaw = activitiesRes.data || [];
    const trainingProgRaw = trainingProgRes.data || [];
    const storeAccessRaw = storeAccessRes.data || [];
    const orderItemsRaw = orderItemsRes.data || [];
    const fixturesRaw = fixturesRes.data || [];
    const placementsRaw = placementsRes.data || [];
    const refundsRaw = refundsRes.data || [];

    // --- Index Data by Store ID / Order ID in Linear Time O(N) ---
    const ordersByStoreId = new Map<string, typeof ordersRaw>();
    const unallocatedOrders: UnallocatedCompanyOrder[] = [];

    // Order ID to Store ID map
    const orderStoreIdMap = new Map<string, string>();

    // Order ID to Refunds map
    const refundsByOrderId = new Map<string, number>();
    for (const ref of refundsRaw) {
      if (ref.order_id) {
        const cur = refundsByOrderId.get(ref.order_id) || 0;
        refundsByOrderId.set(ref.order_id, cur + (Number(ref.merchandise_amount) || 0));
      }
    }

    for (const ord of ordersRaw) {
      if (ord.store_id) {
        orderStoreIdMap.set(ord.id, ord.store_id);
        const list = ordersByStoreId.get(ord.store_id) || [];
        list.push(ord);
        ordersByStoreId.set(ord.store_id, list);
      } else {
        // Unallocated company-level order
        unallocatedOrders.push({
          orderId: ord.id,
          orderNumber: ord.order_number,
          companyId: ord.company_id,
          orderStatus: ord.order_status,
          paymentStatus: ord.payment_status,
          subtotalAmount: Number(ord.subtotal_amount) || 0,
          discountAmount: Number(ord.discount_amount) || 0,
          totalAmount: Number(ord.total_amount) || 0,
          createdAt: ord.created_at,
        });
      }
    }

    // Products purchased per store
    const productsByStoreId = new Map<string, Set<string>>();
    for (const itm of orderItemsRaw) {
      const storeId = orderStoreIdMap.get(itm.order_id);
      if (storeId && itm.product_id) {
        const set = productsByStoreId.get(storeId) || new Set<string>();
        set.add(itm.product_id);
        productsByStoreId.set(storeId, set);
      }
    }

    // Staff assigned per store
    const staffByStoreId = new Map<string, Set<string>>();
    for (const acc of storeAccessRaw) {
      if (acc.store_id && acc.user_id) {
        const set = staffByStoreId.get(acc.store_id) || new Set<string>();
        set.add(acc.user_id);
        staffByStoreId.set(acc.store_id, set);
      }
    }

    // First shipment per store
    const firstShipmentByStoreId = new Map<string, string>();
    for (const ful of fulfillmentsRaw) {
      if (ful.store_id) {
        const date = ful.shipped_at || ful.delivered_at || ful.created_at;
        if (date) {
          const prev = firstShipmentByStoreId.get(ful.store_id);
          if (!prev || date < prev) {
            firstShipmentByStoreId.set(ful.store_id, date);
          }
        }
      }
    }

    // Weekly checks per store
    const checksByStoreId = new Map<string, typeof weeklyChecksRaw>();
    for (const wc of weeklyChecksRaw) {
      if (wc.store_id) {
        const list = checksByStoreId.get(wc.store_id) || [];
        list.push(wc);
        checksByStoreId.set(wc.store_id, list);
      }
    }

    // Activities per store
    const activitiesByStoreId = new Map<string, typeof activitiesRaw>();
    for (const act of activitiesRaw) {
      if (act.store_id) {
        const list = activitiesByStoreId.get(act.store_id) || [];
        list.push(act);
        activitiesByStoreId.set(act.store_id, list);
      }
    }

    // Fixtures per store
    const fixturesByStoreId = new Map<string, typeof fixturesRaw>();
    for (const fix of fixturesRaw) {
      if (fix.store_id) {
        const list = fixturesByStoreId.get(fix.store_id) || [];
        list.push(fix);
        fixturesByStoreId.set(fix.store_id, list);
      }
    }

    // Placements per store
    const placementsCountByStoreId = new Map<string, number>();
    for (const pl of placementsRaw) {
      if (pl.store_id && pl.placement_status === "active") {
        placementsCountByStoreId.set(pl.store_id, (placementsCountByStoreId.get(pl.store_id) || 0) + 1);
      }
    }

    // --- Build Store Performance Records ---
    const storeRecords: StorePerformanceRecord[] = [];

    for (const st of storesRaw) {
      const company = Array.isArray(st.companies) ? st.companies[0] : st.companies;
      const companyName = company?.name || "Unknown Retailer";
      const companyCode = company?.company_code || null;

      // 1. Sales & Orders
      const storeOrders = ordersByStoreId.get(st.id) || [];
      // Sort oldest to newest to identify lifetime first order
      const validOrdersSorted = storeOrders
        .filter((o) => (o.order_status || "").toLowerCase() !== "cancelled" && (o.order_status || "").toLowerCase() !== "draft")
        .sort((a, b) => a.created_at.localeCompare(b.created_at));

      const firstOrderId = validOrdersSorted.length > 0 ? validOrdersSorted[0].id : null;

      let currentNetSales = 0;
      let previousNetSales = 0;
      let currentValidOrders = 0;
      let previousValidOrders = 0;
      let confirmedReorders = 0;
      let grossSubtotal = 0;
      let totalDiscounts = 0;
      let totalRefunds = 0;

      for (const ord of storeOrders) {
        const orderRefund = refundsByOrderId.get(ord.id) || 0;
        const netOrder = Math.max(0, calculateOrderNetProductSales(ord) - orderRefund);

        const inCurrent = isTimestampInEtWindow(ord.created_at, period.currentPeriodStart, period.currentPeriodEnd);
        const inPrevious = isTimestampInEtWindow(ord.created_at, period.previousPeriodStart, period.previousPeriodEnd);

        if (inCurrent) {
          currentNetSales += netOrder;
          currentValidOrders++;
          grossSubtotal += Number(ord.subtotal_amount) || 0;
          totalDiscounts += Number(ord.discount_amount) || 0;
          totalRefunds += orderRefund;

          // Reorder: if this order is not the store's lifetime first order
          if (firstOrderId && ord.id !== firstOrderId) {
            confirmedReorders++;
          }
        } else if (inPrevious) {
          previousNetSales += netOrder;
          previousValidOrders++;
        }
      }

      // First shipment & Store age
      const firstShipmentDate = firstShipmentByStoreId.get(st.id) || null;
      const ageEvaluation = evaluateStoreAgeAndGrade(firstShipmentDate, st.created_at, period.asOfDate);

      // Growth
      const growth = calculateSalesGrowth(currentNetSales, previousNetSales, ageEvaluation.storeAgeDays);

      const salesMetrics: StoreSalesMetrics = {
        currentNetSalesDollars: Math.round(currentNetSales * 100) / 100,
        previousNetSalesDollars: Math.round(previousNetSales * 100) / 100,
        salesGrowthPercent: growth.percent,
        salesGrowthLabel: growth.label,
        currentValidOrdersCount: currentValidOrders,
        previousValidOrdersCount: previousValidOrders,
        confirmedReordersCount: confirmedReorders,
        grossSubtotalDollars: Math.round(grossSubtotal * 100) / 100,
        discountsDollars: Math.round(totalDiscounts * 100) / 100,
        refundsDollars: Math.round(totalRefunds * 100) / 100,
        firstShipmentDate,
        storeAgeDays: ageEvaluation.storeAgeDays,
        isNewStore: ageEvaluation.isNewStore,
      };

      // 2. Compliance
      const storeFixtures = fixturesByStoreId.get(st.id) || [];
      const storePlacementsCount = placementsCountByStoreId.get(st.id) || 0;
      const storeActivities = activitiesByStoreId.get(st.id) || [];
      const displayCompliance = evaluateDisplayCompliance(storeFixtures, storePlacementsCount, storeActivities);

      const storeChecks = checksByStoreId.get(st.id) || [];
      const weeklyCompliance = evaluateWeeklyInventoryCompliance(storeChecks, st.created_at, period);

      const purchasedProductIds = Array.from(productsByStoreId.get(st.id) || []);
      const storeStaffIds = Array.from(staffByStoreId.get(st.id) || []);
      const trainingCompliance = evaluateProductTrainingCompliance(purchasedProductIds, storeStaffIds, trainingProgRaw);

      const complianceMetrics = {
        display: displayCompliance,
        weeklyInventory: weeklyCompliance,
        productTraining: trainingCompliance,
      };

      // 3. HQ Follow-up
      const followUpMetrics = evaluateHqFollowUpStatus(storeActivities, period.asOfDate);

      // 4. Data Confidence & Support Status
      const dataConfidence = evaluateDataConfidence(salesMetrics, complianceMetrics, followUpMetrics);
      const supportStatus = deriveSupportStatus(salesMetrics, complianceMetrics, followUpMetrics);

      // 5. Recommended Programs
      const recommendedPrograms = diagnoseSupportRecommendations(
        st.name,
        salesMetrics,
        complianceMetrics,
        followUpMetrics
      );

      storeRecords.push({
        storeId: st.id,
        storeName: st.name,
        storeCode: st.store_code,
        companyId: st.company_id,
        companyName,
        companyCode,
        city: st.city,
        state: st.state,
        status: st.status,
        createdAt: st.created_at,

        evaluationStatus: ageEvaluation.evaluationStatus,
        performanceGrade: ageEvaluation.performanceGrade,
        gradeReason: ageEvaluation.gradeReason,

        supportStatus,
        dataConfidence,

        sales: salesMetrics,
        compliance: complianceMetrics,
        followUp: followUpMetrics,
        recommendedPrograms,
      });
    }

    // --- Build Company Records ---
    const companyRecords = aggregateStoresToCompany(storeRecords, unallocatedOrders);

    // --- Compute KPI Summary ---
    const kpis = computeKpiSummary(storeRecords, companyRecords, period);

    const benchmarkMs = Date.now() - startTime;

    return {
      success: true,
      data: {
        kpis,
        stores: storeRecords,
        companies: companyRecords,
        isTestModeActive: includeTestOrders,
      },
      benchmarkMs,
    };
  } catch (err: any) {
    console.error("[getRetailerPerformanceData] Unhandled server error:", err);
    return {
      success: false,
      error: err?.message || "Failed to load Retailer Performance data.",
      benchmarkMs: Date.now() - startTime,
    };
  }
}
