/**
 * Product Performance V2.0 — Canonical Data Adapter
 * Task ID: ADM-SALES-PERF-003-R5
 * Location: lib/product/performance/data-adapter.ts
 *
 * Implements pure, deterministic mapping from canonical Supabase database rows
 * into the strongly-typed inputs required by the Product Performance Calculation Engine.
 */

import type {
  EvaluationPeriod,
  FinancialOrderLine,
  LandedCostRecord,
  ProductCostMaster,
  FifoInventoryLayer,
  RetailerWeeklyReportLine,
  ExchangeClaimRecord,
  StoreCohortEligibilityRecord,
  StoreCoverageTarget,
  ClaimLifecycleStatus,
  RawDbProduct,
  RawDbLandedCostResult,
  RawDbInventoryCostLayer,
  RawDbInventoryBalance,
  RawDbRetailerOrder,
  RawDbRetailerOrderItem,
  RawDbRetailerOrderFulfillment,
  RawDbRetailerOrderFulfillmentItem,
  RawDbRetailerOrderRefundRecord,
  RawDbRetailerWeeklyCheck,
  RawDbRetailerWeeklyCheckItem,
  RawDbRetailerExchangeClaim,
  RawDbRetailerExchangeClaimItem,
  RawDbRetailerProtectedSupplyCohort,
  RawDbStore,
  RawDbRetailerStoreProduct,
} from "./types";
import { safeRound, addDays } from "./helpers";
import type { MasterProductPerformanceInput } from "./index";

// ============================================================================
// 1. PRODUCT MASTER & COST MASTER ADAPTER
// ============================================================================

export function adaptProductCostMaster(product: RawDbProduct): ProductCostMaster {
  const overrideCost =
    product.override_landed_cost !== null && product.override_landed_cost !== undefined
      ? Number(product.override_landed_cost)
      : null;

  const overrideEffectiveDate = product.override_landed_cost_updated_at
    ? product.override_landed_cost_updated_at.slice(0, 10)
    : null;

  return {
    product_id: product.id,
    sku: product.letusto_sku || product.child_sku || product.parent_sku || product.name,
    override_landed_cost: overrideCost,
    override_effective_date: overrideEffectiveDate,
    override_reason: product.override_landed_cost_reason || null,
    base_wholesale_price:
      product.price_usd_fob !== null && product.price_usd_fob !== undefined
        ? Number(product.price_usd_fob)
        : null,
  };
}

// ============================================================================
// 2. LANDED COST RECORDS ADAPTER
// ============================================================================

export function adaptLandedCostRecords(
  productId: string,
  landedCostResults: RawDbLandedCostResult[] = [],
  inventoryCostLayers: RawDbInventoryCostLayer[] = [],
  product?: RawDbProduct
): LandedCostRecord[] {
  const records: LandedCostRecord[] = [];
  const seenKeys = new Set<string>();

  // A. From landed_cost_results
  for (const r of landedCostResults) {
    if (r.product_id !== productId) continue;
    const cost = Number(r.unit_landed_cost);
    if (!Number.isFinite(cost) || cost <= 0) continue;

    const key = `result:${r.received_date}:${cost}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    records.push({
      product_id: productId,
      effective_date: r.received_date,
      unit_landed_cost: cost,
      cost_status: r.cost_status === "FINAL" ? "FINAL" : "ESTIMATED",
      source: "landed_cost_results",
      supplier_cost_per_unit:
        r.supplier_acquisition_cost !== undefined && r.supplier_acquisition_cost !== null
          ? Number(r.supplier_acquisition_cost)
          : undefined,
      freight_cost_per_unit:
        r.freight_cost !== undefined && r.freight_cost !== null ? Number(r.freight_cost) : undefined,
      duty_cost_per_unit:
        r.duty_cost !== undefined && r.duty_cost !== null ? Number(r.duty_cost) : undefined,
    });
  }

  // B. From inventory_cost_layers
  for (const l of inventoryCostLayers) {
    if (l.product_id !== productId) continue;
    const cost = Number(l.unit_landed_cost);
    if (!Number.isFinite(cost) || cost <= 0) continue;

    const key = `layer:${l.received_date}:${cost}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    records.push({
      product_id: productId,
      effective_date: l.received_date,
      unit_landed_cost: cost,
      cost_status: "FINAL",
      source: "inventory_cost_layers",
    });
  }

  // C. From product override landed cost (if effective date is known)
  if (
    product &&
    product.id === productId &&
    product.override_landed_cost !== null &&
    product.override_landed_cost !== undefined &&
    Number(product.override_landed_cost) > 0 &&
    product.override_landed_cost_updated_at
  ) {
    const effectiveDate = product.override_landed_cost_updated_at.slice(0, 10);
    const cost = Number(product.override_landed_cost);
    const key = `override:${effectiveDate}:${cost}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      records.push({
        product_id: productId,
        effective_date: effectiveDate,
        unit_landed_cost: cost,
        cost_status: "OVERRIDE",
        source: "override_landed_cost",
      });
    }
  }

  // Sort descending by effective_date so the most recent historical cost is selected first
  return records.sort((a, b) => b.effective_date.localeCompare(a.effective_date));
}

// ============================================================================
// 3. HQ INVENTORY ADAPTER
// ============================================================================

export function adaptFifoInventoryLayers(
  productId: string,
  layers: RawDbInventoryCostLayer[] = []
): FifoInventoryLayer[] {
  return layers
    .filter(
      (l) =>
        l.product_id === productId &&
        l.status.toUpperCase() === "ACTIVE" &&
        Number(l.remaining_qty) > 0
    )
    .map((l) => ({
      id: l.id,
      product_id: l.product_id,
      warehouse_id: l.warehouse_id,
      received_date: l.received_date,
      original_qty: Number(l.original_qty),
      remaining_qty: Number(l.remaining_qty),
      unit_landed_cost: Number(l.unit_landed_cost),
      status: l.status,
    }))
    .sort((a, b) => a.received_date.localeCompare(b.received_date)); // FIFO order
}

export function adaptHqInventoryBalances(
  productId: string,
  balances: RawDbInventoryBalance[] = []
): { currentAvailableUnits: number; totalOnHand: number; totalHold: number; totalDamaged: number } {
  let totalOnHand = 0;
  let totalHold = 0;
  let totalDamaged = 0;

  for (const b of balances) {
    if (b.product_id !== productId) continue;
    totalOnHand += Number(b.qty_on_hand || 0);
    totalHold += Number(b.qty_hold || 0);
    totalDamaged += Number(b.qty_damaged || 0);
  }

  const currentAvailableUnits = Math.max(0, totalOnHand - totalHold - totalDamaged);

  return {
    currentAvailableUnits,
    totalOnHand,
    totalHold,
    totalDamaged,
  };
}

// ============================================================================
// 4. B2B SALES & FULFILLMENT ADAPTER
// ============================================================================

export interface AdaptOrderLinesInput {
  productId: string;
  orderItems: RawDbRetailerOrderItem[];
  ordersMap: Map<string, RawDbRetailerOrder>;
  fulfillmentItems?: RawDbRetailerOrderFulfillmentItem[];
  fulfillmentsMap?: Map<string, RawDbRetailerOrderFulfillment>;
  refunds?: RawDbRetailerOrderRefundRecord[];
  includeTestOrders?: boolean;
}

export function adaptFinancialOrderLines(input: AdaptOrderLinesInput): FinancialOrderLine[] {
  const {
    productId,
    orderItems,
    ordersMap,
    fulfillmentItems = [],
    fulfillmentsMap = new Map(),
    refunds = [],
  } = input;

  // 1. Map shipped quantities by order_item_id
  const shippedQtyByOrderItem = new Map<string, number>();
  for (const fi of fulfillmentItems) {
    if (fi.product_id !== productId) continue;
    const curr = shippedQtyByOrderItem.get(fi.order_item_id) || 0;
    shippedQtyByOrderItem.set(fi.order_item_id, curr + Number(fi.quantity_shipped || 0));
  }

  // 2. Map refunds by order_id
  const refundsByOrder = new Map<string, number>();
  for (const ref of refunds) {
    const status = (ref.refund_status || "").toLowerCase();
    if (status === "failed") continue;
    const amount = Number(ref.merchandise_amount || 0);
    if (amount > 0) {
      const curr = refundsByOrder.get(ref.order_id) || 0;
      refundsByOrder.set(ref.order_id, curr + amount);
    }
  }

  const lines: FinancialOrderLine[] = [];

  for (const item of orderItems) {
    if (item.product_id !== productId) continue;

    const order = ordersMap.get(item.order_id);
    if (!order) continue;

    // Filter test orders unless explicitly authorized
    if (order.is_test && !input.includeTestOrders) continue;

    const orderStatus = (order.order_status || "").toUpperCase();
    const orderedQty = Math.max(0, Number(item.quantity || 0));
    const unitPrice = Math.max(0, Number(item.unit_wholesale_price || 0));
    const lineTotal = Number(item.line_total || orderedQty * unitPrice);

    // Compute effective shipped quantity:
    // If explicit fulfillment items exist, use exact quantity shipped.
    // Otherwise, if order status is SHIPPED or DELIVERED, assume fulfilled as ordered.
    let shippedQty = 0;
    if (shippedQtyByOrderItem.has(item.id)) {
      shippedQty = shippedQtyByOrderItem.get(item.id)!;
    } else if (orderStatus === "SHIPPED" || orderStatus === "DELIVERED") {
      shippedQty = orderedQty;
    }

    // Proportionate allocation of order-level discounts and outbound charges
    const subtotal = Number(order.subtotal_amount || 0);
    const lineRatio = subtotal > 0 ? lineTotal / subtotal : 0;

    const orderDiscount = Number(order.discount_amount || 0);
    const allocatedDiscount = orderDiscount > 0 ? safeRound(orderDiscount * lineRatio, 2) || 0 : 0;

    const orderShipping = Number(order.shipping_amount || 0);
    const allocatedShipping = orderShipping > 0 ? safeRound(orderShipping * lineRatio, 2) || 0 : 0;

    const orderTax = Number(order.tax_amount || 0);
    const allocatedTax = orderTax > 0 ? safeRound(orderTax * lineRatio, 2) || 0 : 0;

    // Allocate refund if present
    const orderRefund = refundsByOrder.get(order.id) || 0;
    const allocatedRefundAmount = orderRefund > 0 ? safeRound(orderRefund * lineRatio, 2) || 0 : 0;
    const refundedQty =
      unitPrice > 0 && allocatedRefundAmount > 0
        ? Math.min(shippedQty > 0 ? shippedQty : orderedQty, Math.round(allocatedRefundAmount / unitPrice))
        : 0;

    lines.push({
      id: item.id,
      order_id: order.id,
      order_number: order.order_number,
      product_id: item.product_id,
      sku: item.sku,
      order_date: order.created_at.slice(0, 10),
      order_status: orderStatus,
      ordered_qty: orderedQty,
      shipped_qty: shippedQty,
      unit_price: unitPrice,
      merchandise_discount: allocatedDiscount,
      shipping_fee_allocated: allocatedShipping,
      tax_allocated: allocatedTax,
      refunded_qty: refundedQty,
      refunded_amount: allocatedRefundAmount,
      credit_redeemed_allocated: 0, // In K Select, credit redemptions are tracked at checkout payments
    });
  }

  return lines;
}

// ============================================================================
// 5. RETAILER WEEKLY CHECKS ADAPTER
// ============================================================================

export function adaptRetailerWeeklyReports(
  productId: string,
  checkItems: RawDbRetailerWeeklyCheckItem[] = [],
  checksMap: Map<string, RawDbRetailerWeeklyCheck> = new Map()
): RetailerWeeklyReportLine[] {
  const lines: RetailerWeeklyReportLine[] = [];

  for (const item of checkItems) {
    if (item.product_id !== productId) continue;

    const check = checksMap.get(item.check_id);
    if (!check) continue;
    if (check.is_test) continue;
    if ((check.status || "").toLowerCase() !== "submitted") continue;

    const reportDate = check.report_date;
    const weekStartDate = addDays(reportDate, -6);

    lines.push({
      id: item.id,
      report_id: check.id,
      store_id: check.store_id,
      product_id: item.product_id,
      week_start_date: weekStartDate,
      week_end_date: reportDate,
      beginning_stock: item.previous_reported_qty ?? null,
      received_units: item.delivered_since_previous ?? null,
      sales_units: item.estimated_movement ?? null,
      ending_stock: item.reported_remaining_qty,
    });
  }

  return lines;
}

// ============================================================================
// 6. EXCHANGE CLAIMS & SUPPLY COHORTS ADAPTER
// ============================================================================

export function mapClaimLifecycleStatus(dbStatus: string, selectedOption?: string): ClaimLifecycleStatus {
  const s = (dbStatus || "").toLowerCase();
  switch (s) {
    case "draft":
    case "submitted":
      return "SUBMITTED";
    case "under_review":
    case "information_requested":
      return "UNDER_REVIEW";
    case "approved":
      return selectedOption === "A" ? "APPROVED_OPTION_A" : "APPROVED_OPTION_B";
    case "awaiting_return":
    case "inspection_pending":
      return "RMA_INSPECTED";
    case "resolved":
      return "SETTLED";
    case "rejected":
      return "REJECTED";
    case "cancelled":
      return "CANCELLED";
    default:
      return "SUBMITTED";
  }
}

export function adaptExchangeClaims(
  productId: string,
  claimsMap: Map<string, RawDbRetailerExchangeClaim>,
  claimItems: RawDbRetailerExchangeClaimItem[] = []
): ExchangeClaimRecord[] {
  const records: ExchangeClaimRecord[] = [];

  for (const item of claimItems) {
    if (item.product_id !== productId) continue;

    const claim = claimsMap.get(item.claim_id);
    if (!claim) continue;

    const status = mapClaimLifecycleStatus(item.status || claim.status, item.selected_option);
    const unitPrice = Number(item.frozen_unit_wholesale_price || 0);
    const qty = Number(item.selected_quantity || 0);
    const dollarVal = safeRound(unitPrice * qty, 2) ?? 0;

    records.push({
      id: item.id,
      claim_id: claim.id,
      company_id: item.company_id || claim.company_id,
      store_id: item.store_id || claim.store_id,
      product_id: item.product_id,
      cohort_id: item.cohort_id,
      claim_date: (claim.submitted_at || claim.created_at).slice(0, 10),
      status,
      requested_units: qty,
      approved_units: ["APPROVED_OPTION_A", "APPROVED_OPTION_B", "RMA_INSPECTED", "SETTLED"].includes(status) ? qty : null,
      settled_units: status === "SETTLED" ? qty : null,
      unit_wholesale_price: unitPrice,
      claimed_dollar_value: dollarVal,
      settled_credit_amount: item.final_credit_amount ? Number(item.final_credit_amount) : null,
    });
  }

  return records;
}

export function adaptStoreCohortEligibilityRecords(
  productId: string,
  cohorts: RawDbRetailerProtectedSupplyCohort[] = [],
  period: EvaluationPeriod
): StoreCohortEligibilityRecord[] {
  const records: StoreCohortEligibilityRecord[] = [];

  for (const c of cohorts) {
    if (c.product_id !== productId) continue;

    const cohortDate = c.first_shipment_date || c.created_at.slice(0, 10);
    const protectionEndDate = c.trial_end_date || addDays(cohortDate, 90);
    const claimEligibilityDate = c.evaluation_date || addDays(cohortDate, 100);

    // Active 90-day protection check (as of evaluation date)
    const statusLower = (c.status || "").toLowerCase();
    const isInActiveProtection =
      statusLower === "active_protection" ||
      (cohortDate <= period.asOfDate && protectionEndDate >= period.asOfDate);

    // Day-100 maturity check (reaches claim window on or before periodEnd)
    const isMatured =
      ["claim_window_open", "claim_submitted", "claim_resolved"].includes(statusLower) ||
      (claimEligibilityDate !== null && claimEligibilityDate <= period.periodEnd);

    records.push({
      store_id: c.store_id,
      product_id: c.product_id,
      cohort_id: c.id,
      cohort_date: cohortDate,
      initial_order_date: cohortDate,
      protection_end_date: protectionEndDate,
      claim_eligibility_date: claimEligibilityDate,
      is_in_active_protection_window: isInActiveProtection,
      is_matured_day_100: isMatured,
      is_eligible: isMatured,
      cohort_units: Number(c.total_protected_quantity || 0),
    });
  }

  return records;
}

// ============================================================================
// 7. STORE COVERAGE TARGETS ADAPTER
// ============================================================================

export function adaptStoreCoverageTargets(
  productId: string,
  stores: RawDbStore[] = [],
  storeProducts: RawDbRetailerStoreProduct[] = []
): StoreCoverageTarget[] {
  const activeProductStoreIds = new Set<string>();

  for (const sp of storeProducts) {
    if (sp.product_id === productId && sp.is_active !== false) {
      activeProductStoreIds.add(sp.store_id);
    }
  }

  return stores.map((s) => ({
    store_id: s.id,
    is_active: (s.status || "").toLowerCase() === "active",
    carries_sku: activeProductStoreIds.has(s.id),
  }));
}

// ============================================================================
// 8. MASTER CALCULATION INPUT BUILDER
// ============================================================================

export interface BuildEngineInputParams {
  period: EvaluationPeriod;
  product: RawDbProduct;
  landedCostResults?: RawDbLandedCostResult[];
  inventoryCostLayers?: RawDbInventoryCostLayer[];
  inventoryBalances?: RawDbInventoryBalance[];
  orderItems?: RawDbRetailerOrderItem[];
  ordersMap?: Map<string, RawDbRetailerOrder>;
  fulfillmentItems?: RawDbRetailerOrderFulfillmentItem[];
  fulfillmentsMap?: Map<string, RawDbRetailerOrderFulfillment>;
  refunds?: RawDbRetailerOrderRefundRecord[];
  weeklyCheckItems?: RawDbRetailerWeeklyCheckItem[];
  checksMap?: Map<string, RawDbRetailerWeeklyCheck>;
  claimsMap?: Map<string, RawDbRetailerExchangeClaim>;
  claimItems?: RawDbRetailerExchangeClaimItem[];
  cohorts?: RawDbRetailerProtectedSupplyCohort[];
  stores?: RawDbStore[];
  storeProducts?: RawDbRetailerStoreProduct[];
  includeTestOrders?: boolean;
}

export function buildMasterProductPerformanceInput(
  params: BuildEngineInputParams
): MasterProductPerformanceInput {
  const {
    period,
    product,
    landedCostResults = [],
    inventoryCostLayers = [],
    inventoryBalances = [],
    orderItems = [],
    ordersMap = new Map(),
    fulfillmentItems = [],
    fulfillmentsMap = new Map(),
    refunds = [],
    weeklyCheckItems = [],
    checksMap = new Map(),
    claimsMap = new Map(),
    claimItems = [],
    cohorts = [],
    stores = [],
    storeProducts = [],
    includeTestOrders = false,
  } = params;

  const costMaster = adaptProductCostMaster(product);
  const costRecords = adaptLandedCostRecords(
    product.id,
    landedCostResults,
    inventoryCostLayers,
    product
  );

  const activeLayers = adaptFifoInventoryLayers(product.id, inventoryCostLayers);
  const { currentAvailableUnits } = adaptHqInventoryBalances(product.id, inventoryBalances);

  const financialOrderLines = adaptFinancialOrderLines({
    productId: product.id,
    orderItems,
    ordersMap,
    fulfillmentItems,
    fulfillmentsMap,
    refunds,
    includeTestOrders,
  });

  const weeklyReports = adaptRetailerWeeklyReports(product.id, weeklyCheckItems, checksMap);
  const storesTarget = adaptStoreCoverageTargets(product.id, stores, storeProducts);

  const claimRecords = adaptExchangeClaims(product.id, claimsMap, claimItems);
  const eligibilityRecords = adaptStoreCohortEligibilityRecords(product.id, cohorts, period);

  return {
    period,
    product_id: product.id,
    financial: {
      orderLines: financialOrderLines,
      costRecords,
      costMaster,
    },
    inventory: {
      activeLayers,
      currentAvailableUnits,
    },
    velocity: {
      weeklyReports,
      storesTarget,
    },
    exchange: {
      claimRecords,
      eligibilityRecords,
    },
  };
}
