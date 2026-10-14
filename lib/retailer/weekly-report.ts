import "server-only";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEffectiveSku } from "@/lib/product/types";
import { formatCategoryName } from "@/lib/retailer/products";
import { getRetailerAccessibleStores, getCurrentReportingWeek } from "@/lib/retailer/weekly-check";
import { resolveAuthoritativeProductImages } from "@/lib/retailer/product-images";
import { resolveEffectiveSrp } from "./performance-financial-pure";
import {
  resolveRetailerSalesPolicy,
  normalizeReorderQuantity,
} from "@/lib/product/retailer-policy";
import {
  WeeklyReportData,
  WeeklyReportItem,
  WeeklyReportStoreStatus,
  WeeklyReportCoverageStatus,
  AvailableReportingWeek,
} from "./weekly-report-types";

/**
 * Returns date range and human-readable label for an ISO week string (e.g. "2026-W42")
 */
export function getIsoWeekRange(weekStr: string): {
  startDate: string;
  endDate: string;
  label: string;
} {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    const today = new Date().toISOString().split("T")[0];
    return { startDate: today, endDate: today, label: weekStr };
  }

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // ISO week 1 starts on the Monday before or on Jan 4
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4.getTime() - (day - 1) * 86400000);

  const monday = new Date(mondayWeek1.getTime() + (week - 1) * 7 * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);

  const startIso = monday.toISOString().split("T")[0];
  const endIso = sunday.toISOString().split("T")[0];

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const label = `Week ${week} (${monthNames[monday.getUTCMonth()]} ${monday.getUTCDate()} – ${monthNames[sunday.getUTCMonth()]} ${sunday.getUTCDate()}, ${year})`;

  return { startDate: startIso, endDate: endIso, label };
}

/**
 * Generates an array of previous ISO week strings
 */
function getRecentIsoWeeks(count: number = 6): string[] {
  const weeks: string[] = [];
  const current = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(current.getTime() - i * 7 * 86400000);
    weeks.push(getCurrentReportingWeek(d));
  }
  return Array.from(new Set(weeks));
}

/**
 * Main DAL: Fetch Weekly Performance & Reorder Report
 */
export async function getRetailerWeeklyReportData(params?: {
  reportingWeek?: string;
  storeId?: string;
}): Promise<WeeklyReportData> {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  // 1. Resolve store accessibility & role
  const { companyId, userRole, stores } = await getRetailerAccessibleStores();
  if (!companyId) {
    throw new Error("Retailer company not found.");
  }

  // Fetch company name
  const { data: companyRow } = await adminClient
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();

  const companyName = companyRow?.name || "Retail Partner";
  const isFinancialsHidden = userRole === "employee";
  const validStoreIds = stores.map((s) => s.id);

  // 2. Resolve selected store filter
  let selectedStoreId: string | "all" = "all";
  if (params?.storeId && validStoreIds.includes(params.storeId)) {
    selectedStoreId = params.storeId;
  } else if (validStoreIds.length === 1) {
    selectedStoreId = validStoreIds[0];
  }

  const selectedStore = stores.find((s) => s.id === selectedStoreId);
  const selectedStoreName = selectedStore ? selectedStore.name : "All Stores (Company Overview)";

  // 3. Resolve available reporting weeks
  const { data: checkWeeksRows } = await adminClient
    .from("retailer_weekly_checks")
    .select("reporting_week, status")
    .eq("company_id", companyId)
    .eq("status", "submitted");

  const submittedWeeks = new Set((checkWeeksRows || []).map((r) => r.reporting_week));
  const currentWeek = getCurrentReportingWeek();
  const candidateWeeks = Array.from(new Set([currentWeek, ...submittedWeeks, ...getRecentIsoWeeks(6)]));

  candidateWeeks.sort((a, b) => b.localeCompare(a));

  const availableWeeks: AvailableReportingWeek[] = candidateWeeks.map((w) => {
    const range = getIsoWeekRange(w);
    return {
      week: w,
      label: range.label,
      startDate: range.startDate,
      endDate: range.endDate,
      isCurrent: w === currentWeek,
      hasSubmissions: submittedWeeks.has(w),
    };
  });

  // Selected reporting week
  const reportingWeek = params?.reportingWeek && candidateWeeks.includes(params.reportingWeek)
    ? params.reportingWeek
    : candidateWeeks[0] || currentWeek;

  const weekRange = getIsoWeekRange(reportingWeek);
  const formattedWeekLabel = weekRange.label;
  const isCurrentWeek = reportingWeek === currentWeek;

  // 4. Fetch Weekly Checks for this reporting week
  const { data: checksThisWeek, error: checksError } = await adminClient
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
        is_counted,
        retail_price_snapshot,
        retail_price_basis
      )
    `)
    .eq("company_id", companyId)
    .eq("reporting_week", reportingWeek);

  if (checksError) {
    console.error("Error fetching weekly checks for report:", checksError);
  }

  const checks = checksThisWeek || [];
  const checkByStoreId = new Map<string, any>();
  checks.forEach((c) => checkByStoreId.set(c.store_id, c));

  // 5. Build Store Statuses and Coverage
  const storeStatuses: WeeklyReportStoreStatus[] = stores.map((s) => {
    const chk = checkByStoreId.get(s.id);
    const hasSubmitted = chk?.status === "submitted";
    const items = (chk?.retailer_weekly_check_items as any[]) || [];
    const counted = items.filter((i) => i.is_counted).length;
    const remaining = items.reduce((acc, i) => acc + (Number(i.reported_remaining_qty) || 0), 0);

    return {
      storeId: s.id,
      storeName: s.name,
      hasSubmitted,
      status: (chk?.status as any) || "not_started",
      checkId: chk?.id || null,
      submittedAt: chk?.submitted_at || null,
      countedProducts: counted,
      totalProducts: items.length,
      remainingUnits: remaining,
    };
  });

  const totalStores = stores.length;
  const submittedStoresCount = storeStatuses.filter((s) => s.hasSubmitted).length;
  let coverageStatus: WeeklyReportCoverageStatus = "none";
  if (submittedStoresCount === totalStores && totalStores > 0) {
    coverageStatus = "full";
  } else if (submittedStoresCount > 0) {
    coverageStatus = "partial";
  }

  // 6. Filter checks based on selectedStoreId
  const relevantChecks = checks.filter((c) => {
    if (selectedStoreId === "all") {
      return validStoreIds.includes(c.store_id);
    }
    return c.store_id === selectedStoreId;
  });

  const submittedRelevantChecks = relevantChecks.filter((c) => c.status === "submitted");

  // 7. Fetch Product Catalog, Curations & Images
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
      selection_status,
      trading_status,
      sales_status,
      retailer_visibility,
      trading_pricing_active,
      trading_wholesale_price,
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
      )
    `);

  const productMap = new Map<string, any>();
  (rawProducts || []).forEach((p) => productMap.set(p.id, p));

  // 8. Fetch Incoming Quantities (Pending + In-Transit Orders)
  let orderQuery = adminClient
    .from("retailer_orders")
    .select(`
      id,
      store_id,
      order_status,
      retailer_order_items (
        product_id,
        quantity,
        quantity_shipped,
        quantity_cancelled
      )
    `)
    .eq("company_id", companyId)
    .in("order_status", ["confirmed", "processing", "shipped", "partially_shipped"]);

  if (selectedStoreId !== "all") {
    orderQuery = orderQuery.eq("store_id", selectedStoreId);
  }

  const { data: activeOrders } = await orderQuery;

  const productIncomingMap = new Map<string, { pending: number; inTransit: number }>();
  (activeOrders || []).forEach((ord: any) => {
    const isShipped = ord.order_status === "shipped" || ord.order_status === "partially_shipped";
    (ord.retailer_order_items || []).forEach((item: any) => {
      const pId = item.product_id;
      const ordered = Number(item.quantity) || 0;
      const shipped = Number(item.quantity_shipped) || 0;
      const cancelled = Number(item.quantity_cancelled) || 0;

      const unfulfilled = Math.max(0, ordered - shipped - cancelled);
      const inTransit = isShipped ? Math.max(0, shipped - cancelled) : 0;

      if (!productIncomingMap.has(pId)) {
        productIncomingMap.set(pId, { pending: 0, inTransit: 0 });
      }
      const cur = productIncomingMap.get(pId)!;
      cur.pending += unfulfilled;
      cur.inTransit += inTransit;
    });
  });

  // 9. Collect all unique products in the submitted checks
  const productCheckItemsMap = new Map<string, any[]>();
  submittedRelevantChecks.forEach((chk) => {
    (chk.retailer_weekly_check_items || []).forEach((item: any) => {
      if (!productCheckItemsMap.has(item.product_id)) {
        productCheckItemsMap.set(item.product_id, []);
      }
      productCheckItemsMap.get(item.product_id)!.push({
        ...item,
        storeId: chk.store_id,
        storeName: stores.find((s) => s.id === chk.store_id)?.name || "Store",
      });
    });
  });

  const allRelevantProductIds = Array.from(productCheckItemsMap.keys());
  const imageMap = await resolveAuthoritativeProductImages(adminClient, allRelevantProductIds);

  // 10. Compute Product Items
  const items: WeeklyReportItem[] = [];
  let totalEstimatedRetailSales = 0;
  let totalEstimatedGrossProfit = 0;
  let totalEstimatedUnitsSold = 0;
  let totalRemainingUnits = 0;
  let productsNeedingReorderCount = 0;
  let totalSuggestedReorderUnits = 0;
  let totalIncomingUnits = 0;
  let hasValidSalesData = false;
  let hasBaselineOnlyOverall = false;

  for (const productId of allRelevantProductIds) {
    const rawProd = productMap.get(productId);
    if (!rawProd) continue;

    const brand = (rawProd.brands as any) || {};
    const curation = Array.isArray(rawProd.product_curations)
      ? rawProd.product_curations[0]
      : rawProd.product_curations;

    const policy = resolveRetailerSalesPolicy(rawProd);
    const overrides = (rawProd.price_additional_info as any)?.admin_overrides || {};

    const effectiveSku =
      resolveEffectiveSku(overrides.letusto_sku, rawProd.letusto_sku) ||
      resolveEffectiveSku(overrides.manufacture_sku, rawProd.manufacture_sku) ||
      "KS-PROD";

    // Pricing
    let wholesalePrice = policy.baseWholesalePrice || 0;
    if (curation?.wholesale_price && Number(curation.wholesale_price) > 0) {
      wholesalePrice = Number(curation.wholesale_price);
    } else if (policy.promoWholesalePrice && policy.promoWholesalePrice > 0) {
      wholesalePrice = policy.promoWholesalePrice;
    }

    const checkItems = productCheckItemsMap.get(productId) || [];

    // Resolve SRP from check snapshot or curation
    const firstSnapshot = checkItems.find((i) => i.retail_price_snapshot > 0);
    const srpResolution = resolveEffectiveSrp(firstSnapshot?.retail_price_snapshot, {
      wholesalePrice,
      curationSrp: curation?.suggest_retail_price ? Number(curation.suggest_retail_price) : null,
      catalogErp: rawProd.estimated_retail_price ? Number(rawProd.estimated_retail_price) : null,
    });
    const retailPrice = srpResolution.srp || wholesalePrice * 2.0;

    // Aggregate reported remaining, previous remaining, and movement across checks
    let reportedRemaining: number | null = null;
    let previousRemaining: number | null = null;
    let deliveredSincePrevious: number | null = null;
    let productUnitsSold: number | null = null;
    let isBaseline = false;

    const storeCounts: Array<{
      storeId: string;
      storeName: string;
      remaining: number | null;
      unitsSold: number | null;
      status: "submitted" | "not_submitted";
    }> = [];

    // Track per store
    stores.forEach((store) => {
      const storeItem = checkItems.find((ci) => ci.storeId === store.id);
      if (storeItem) {
        const rem = Number(storeItem.reported_remaining_qty) || 0;
        reportedRemaining = (reportedRemaining ?? 0) + rem;

        if (storeItem.previous_reported_qty !== null && storeItem.previous_reported_qty !== undefined) {
          const prev = Number(storeItem.previous_reported_qty) || 0;
          const deliv = Number(storeItem.delivered_since_previous) || 0;
          previousRemaining = (previousRemaining ?? 0) + prev;
          deliveredSincePrevious = (deliveredSincePrevious ?? 0) + deliv;

          const sold = Math.max(0, prev + deliv - rem);
          productUnitsSold = (productUnitsSold ?? 0) + sold;

          storeCounts.push({
            storeId: store.id,
            storeName: store.name,
            remaining: rem,
            unitsSold: sold,
            status: "submitted",
          });
        } else {
          isBaseline = true;
          storeCounts.push({
            storeId: store.id,
            storeName: store.name,
            remaining: rem,
            unitsSold: null,
            status: "submitted",
          });
        }
      } else {
        storeCounts.push({
          storeId: store.id,
          storeName: store.name,
          remaining: null,
          unitsSold: null,
          status: "not_submitted",
        });
      }
    });

    if (isBaseline && productUnitsSold === null) {
      hasBaselineOnlyOverall = true;
    }

    // Financial calculations
    let estimatedRetailSales: number | null = null;
    let estimatedGrossProfit: number | null = null;
    let grossMarginPercent: number | null = null;

    if (productUnitsSold !== null) {
      hasValidSalesData = true;
      estimatedRetailSales = Number((productUnitsSold * retailPrice).toFixed(2));
      const cost = Number((productUnitsSold * wholesalePrice).toFixed(2));
      estimatedGrossProfit = Math.max(0, Number((estimatedRetailSales - cost).toFixed(2)));
      grossMarginPercent = estimatedRetailSales > 0
        ? Number(((estimatedGrossProfit / estimatedRetailSales) * 100).toFixed(1))
        : 0;

      totalEstimatedRetailSales += estimatedRetailSales;
      totalEstimatedGrossProfit += estimatedGrossProfit;
      totalEstimatedUnitsSold += productUnitsSold;
    }

    if (reportedRemaining !== null) {
      totalRemainingUnits += reportedRemaining;
    }

    // Incoming stock
    const incomingData = productIncomingMap.get(productId) || { pending: 0, inTransit: 0 };
    const incomingQty = incomingData.pending + incomingData.inTransit;
    totalIncomingUnits += incomingQty;

    // Reorder recommendation logic
    const moq = policy.moq || 6;
    const orderMultiple = policy.orderMultiple || 6;
    const cartonPackQty = Number(rawProd.carton_pack_qty) || 12;

    const projectedStock = (reportedRemaining ?? 0) + incomingQty;
    const weeklyVelocity = productUnitsSold ?? 0;
    // 4 weeks target supply based on weekly movement (or MOQ safety stock)
    const targetDemand = weeklyVelocity > 0 ? weeklyVelocity * 4 : Math.max(moq, cartonPackQty);

    let reorderNeeded = false;
    let suggestedReorderQty = 0;
    let suggestedCases = 0;
    let reorderReason = "";

    if (projectedStock < targetDemand) {
      const rawNeed = targetDemand - projectedStock;
      const normResult = normalizeReorderQuantity(rawNeed, moq, orderMultiple, true);
      suggestedReorderQty = normResult.normalizedQty;
      if (suggestedReorderQty > 0) {
        reorderNeeded = true;
        suggestedCases = Math.ceil(suggestedReorderQty / Math.max(1, cartonPackQty));
        productsNeedingReorderCount += 1;
        totalSuggestedReorderUnits += suggestedReorderQty;
        reorderReason = projectedStock === 0
          ? "Stockout risk — zero projected inventory"
          : `Below target supply (${projectedStock} available vs ${targetDemand} needed)`;
      }
    }

    items.push({
      productId,
      productName: rawProd.name,
      productNameEn: rawProd.name_en || null,
      brandName: brand.name || "K SELECT Brand",
      brandId: brand.id || rawProd.brand_id || "unassigned",
      sku: effectiveSku,
      thumbnailUrl: imageMap[productId]?.primaryUrl || null,
      category: rawProd.category_code || rawProd.category || "skincare",
      categoryLabel: formatCategoryName(rawProd.category || rawProd.category_code),
      cartonPackQty,
      moq,
      orderMultiple,
      wholesalePrice,
      retailPrice,
      priceSource: srpResolution.source || "catalog_srp",

      reportedRemaining,
      previousRemaining,
      deliveredSincePrevious,
      estimatedUnitsSold: productUnitsSold,
      estimatedRetailSales,
      estimatedGrossProfit,
      grossMarginPercent,
      hasBaselineOnly: isBaseline && productUnitsSold === null,
      movementStatus: isBaseline && productUnitsSold === null ? "baseline" : "normal",

      incomingQty,
      inTransitQty: incomingData.inTransit,
      pendingQty: incomingData.pending,
      reorderNeeded,
      suggestedReorderQty,
      suggestedCases,
      reorderReason,
      storeCounts,
    });
  }

  // Sort items: products needing reorder first, then by sales descending
  items.sort((a, b) => {
    if (a.reorderNeeded && !b.reorderNeeded) return -1;
    if (!a.reorderNeeded && b.reorderNeeded) return 1;
    return (b.estimatedRetailSales || 0) - (a.estimatedRetailSales || 0);
  });

  const averageGrossMargin = totalEstimatedRetailSales > 0
    ? Number(((totalEstimatedGrossProfit / totalEstimatedRetailSales) * 100).toFixed(1))
    : null;

  let coverageNotice: string | undefined;
  if (coverageStatus === "partial") {
    coverageNotice = `Partial Coverage: ${submittedStoresCount} of ${totalStores} stores submitted for ${reportingWeek}. Metrics include submitted stores only.`;
  } else if (coverageStatus === "none") {
    coverageNotice = `No checks have been submitted for ${reportingWeek} yet. Submit a Weekly Inventory check to generate your report.`;
  }

  return {
    companyId,
    companyName,
    userRole,
    isFinancialsHidden,

    reportingWeek,
    formattedWeekLabel,
    isCurrentWeek,
    availableWeeks,

    selectedStoreId,
    selectedStoreName,
    accessibleStores: stores.map((s) => ({ id: s.id, name: s.name })),

    coverageStatus,
    totalStores,
    submittedStoresCount,
    storeStatuses,

    summary: {
      totalEstimatedRetailSales: hasValidSalesData ? Number(totalEstimatedRetailSales.toFixed(2)) : null,
      totalEstimatedGrossProfit: hasValidSalesData ? Number(totalEstimatedGrossProfit.toFixed(2)) : null,
      averageGrossMargin,
      totalEstimatedUnitsSold: hasValidSalesData ? totalEstimatedUnitsSold : null,
      totalRemainingUnits: submittedStoresCount > 0 ? totalRemainingUnits : null,
      productsNeedingReorderCount,
      totalSuggestedReorderUnits,
      totalIncomingUnits,
      hasBaselineOnlyOverall,
      coverageNotice,
      priceBasisNotice: "Estimates derived from physical shelf stock observations and store SRP. Not live POS transaction totals.",
    },

    items,
  };
}
