import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminSession } from "@/lib/auth/dal";
import { resolveAuthoritativeProductImages } from "@/lib/retailer/product-images";
import { resolveEffectiveSku } from "@/lib/product/types";
import {
  resolveRetailerSalesPolicy,
  normalizeReorderQuantity,
} from "@/lib/product/retailer-policy";
import { computeRetailerTrainingAnalytics } from "@/lib/retailer/admin-training-analytics";
import {
  buildStoreSkuFinancialEstimate,
  type SnapshotInput,
  type PricingInput,
} from "./performance-financial-pure";
import type { AnalysisPeriod, ReceiptEvent } from "./performance-financial-types";

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

export interface AdminStoreOrderBox {
  id: string;
  boxNumber: number;
  boxTotal: number;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: string;
}

export interface AdminStoreOrderFulfillment {
  id: string;
  fulfillmentNumber: string;
  orderId: string;
  status: "processing" | "shipped" | "delivered" | string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  boxCount: number;
  notes: string | null;
  boxes: AdminStoreOrderBox[];
}

export interface AdminStoreOrderItemDetail {
  id: string;
  orderId: string;
  productId: string;
  sku: string;
  productName: string;
  brandName: string | null;
  quantity: number;
  quantityShipped: number;
  quantityCancelled: number;
  quantityRemaining: number;
  unitWholesalePrice: number;
  lineTotal: number;
}

export interface AdminStoreOrderItem {
  id: string;
  orderNumber: string;
  companyId: string;
  storeId: string;
  orderStatus: "submitted" | "confirmed" | "processing" | "partially_shipped" | "shipped" | "delivered" | "partially_cancelled" | "cancelled" | string;
  paymentStatus: string;
  paymentTerms: string | null;
  subtotalAmount: number;
  taxAmount: number;
  shippingAmount: number;
  totalAmount: number;
  totalItemsCount: number;
  totalSkusCount: number;
  totalOrderedUnits: number;
  totalShippedUnits: number;
  totalCancelledUnits: number;
  totalRemainingUnits: number;
  totalBoxCount: number;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZip: string | null;
  createdAt: string;
  updatedAt: string;
  items: AdminStoreOrderItemDetail[];
  fulfillments: AdminStoreOrderFulfillment[];
}

export interface AdminStoreOrdersOverview {
  storeId: string;
  storeName: string;
  companyId: string;
  companyName: string;
  totalOrdersCount: number;
  openOrdersCount: number;
  shippedOrdersCount: number;
  ordersWithRemainingUnitsCount: number;
  orders: AdminStoreOrderItem[];
}

export interface AdminStoreStaffItem {
  userId: string;
  userName: string;
  email: string;
  role: string;
  assignmentStatus: "assigned" | "all_stores";
  eligibleProductsCount: number;
  verifiedProductsCompletedCount: number;
  individualCompletionRate: number; // percentage 0-100
  latestVerifiedCompletionDate: string | null;
  status: "certified" | "in_progress" | "not_started";
  completions: Array<{
    productId: string;
    productName: string;
    sku: string;
    completedAt: string | null;
    isVerified: boolean;
  }>;
}

export interface AdminStoreTrainingProductItem {
  productId: string;
  productName: string;
  productNameEn: string | null;
  sku: string;
  brandName: string;
  category: string;
  thumbnailUrl: string | null;
  trainingStatus: "published" | "draft" | "in_review" | "unavailable";
  coverageStatus: "covered" | "needs_training" | "not_available";
  qualifiedEmployees: string[];
  latestPassDate: string | null;
}

export interface AdminStoreTrainingOverview {
  storeId: string;
  storeName: string;
  companyId: string;
  companyName: string;
  assignedStaffCount: number;
  eligibleProductsCount: number;
  coveredProductsCount: number;
  needsTrainingProductsCount: number;
  storeCoveragePercent: number | null; // null if eligibleProductsCount === 0 -> "N/A"
  lastCompletedAt: string | null;
  staff: AdminStoreStaffItem[];
  products: AdminStoreTrainingProductItem[];
  gapProducts: AdminStoreTrainingProductItem[];
}

export type StorePerformanceStatus =
  | "valid_estimate"
  | "baseline_only"
  | "not_reported"
  | "insufficient_data";

export interface AdminStorePerformanceSkuItem {
  productId: string;
  productName: string;
  productNameEn: string | null;
  sku: string;
  brandName: string;
  category: string;
  thumbnailUrl: string | null;
  latestReportedStock: number | null;
  estimatedUnitsSold: number | null; // null if insufficient data or baseline or not reported
  estimatedWeeklyVelocity: number | null; // null if insufficient data
  approxWeeksOfSupply: number | null; // null if no velocity
  performanceStatus: StorePerformanceStatus;
  statusLabel: string;
  statusReason: string;
  stockRisk: "stockout" | "low_stock" | "sufficient" | "overstock" | "unreported" | "insufficient_data";
  stockRiskLabel: string;
  usableSubmissionsCount: number;
  lastReportingDate: string | null;
  lastReportingWeek: string | null;
  incomingQty: number;
}

export interface AdminStorePerformanceOverview {
  storeId: string;
  storeName: string;
  companyId: string;
  companyName: string;
  selectedPeriod: AnalysisPeriod;
  submittedChecksCount: number;
  latestReportDate: string | null;
  latestReportingWeek: string | null;

  // 4 Top Summary KPIs
  totalEstimatedUnitsSold: number | null; // null if 0 comparable intervals
  averageWeeklyVelocity: number | null;   // null if 0 comparable intervals
  productsWithValidDataCount: number;     // SKUs with valid estimates or baseline count
  productsNeedingAttentionCount: number;  // SKUs with stockout risk, low supply, or unreported

  // Counts
  carriedProductsCount: number;
  reportedProductsCount: number;

  // Products Breakdown
  products: AdminStorePerformanceSkuItem[];
}

export type FixtureType =
  | "wall_4ft"
  | "wall_8ft"
  | "wall_12ft"
  | "endcap_3ft"
  | "countertop"
  | "custom";

export type FixtureInstallationStatus =
  | "planned"
  | "shipped"
  | "delivered"
  | "installed"
  | "inspected"
  | "retired";

export type FixtureOperationalStatus =
  | "active"
  | "needs_maintenance"
  | "damaged"
  | "retired";

export type PlacementStatus = "planned" | "active" | "clearance" | "removed";

export interface AdminStoreFixturePlacementItem {
  id: string;
  storeFixtureId: string;
  storeId: string;
  productId: string;
  productName: string;
  productNameEn: string | null;
  brandName: string | null;
  sku: string;
  category: string | null;
  thumbnailUrl: string | null;
  bayNumber: number;
  shelfLevel: number;
  positionSlot: number;
  facingCount: number;
  capacityUnits: number;
  placementStatus: PlacementStatus;
  placementStatusLabel: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreAssortmentProductItem {
  id: string;
  name: string;
  nameEn: string | null;
  brandName: string | null;
  sku: string;
  category: string | null;
  thumbnailUrl: string | null;
  status: string;
}

export interface AdminStoreFixtureItem {
  id: string;
  storeId: string;
  companyId: string;
  fixtureCode: string;
  fixtureName: string;
  fixtureType: FixtureType;
  fixtureTypeLabel: string;
  bayCount: number;
  shelfCount: number;
  hasHeaderSignage: boolean;
  inStoreLocation: string | null;
  installationStatus: FixtureInstallationStatus;
  installationStatusLabel: string;
  operationalStatus: FixtureOperationalStatus;
  operationalStatusLabel: string;
  installationDate: string | null;
  installedBy: string | null;
  primaryPhotoUrl: string | null;
  lastInspectedAt: string | null;
  notes: string | null;
  placementsCount: number;
  placements: AdminStoreFixturePlacementItem[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminStoreFixturesOverview {
  storeId: string;
  storeName: string;
  companyId: string;
  companyName: string;
  totalFixturesCount: number;
  activeFixturesCount: number;
  installedFixturesCount: number;
  plannedFixturesCount: number;
  maintenanceNeededCount: number;
  totalPlacementsCount: number;
  activePlacementsCount: number;
  eligibleProducts: StoreAssortmentProductItem[];
  fixtures: AdminStoreFixtureItem[];
}

export function formatPlacementStatus(status: string): string {
  switch (status) {
    case "active":
      return "Active";
    case "planned":
      return "Planned";
    case "clearance":
      return "Clearance";
    case "removed":
      return "Removed";
    default:
      return status;
  }
}

export function formatFixtureType(type: string): string {
  switch (type) {
    case "wall_4ft":
      return "4ft Modular Wall (1 Bay)";
    case "wall_8ft":
      return "8ft Modular Wall (2 Bays)";
    case "wall_12ft":
      return "12ft Modular Wall (3 Bays)";
    case "endcap_3ft":
      return "3ft Feature Endcap";
    case "countertop":
      return "Countertop Display";
    case "custom":
      return "Custom Display";
    default:
      return type;
  }
}

export function formatInstallationStatus(status: string): string {
  switch (status) {
    case "planned":
      return "Planned";
    case "shipped":
      return "Shipped";
    case "delivered":
      return "Delivered";
    case "installed":
      return "Installed";
    case "inspected":
      return "Inspected";
    case "retired":
      return "Retired";
    default:
      return status;
  }
}

export function formatOperationalStatus(status: string): string {
  switch (status) {
    case "active":
      return "Active / Operational";
    case "needs_maintenance":
      return "Needs Maintenance";
    case "damaged":
      return "Damaged";
    case "retired":
      return "Retired";
    default:
      return status;
  }
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
  storeOrdersMap: Record<string, AdminStoreOrdersOverview>;
  storeTrainingMap: Record<string, AdminStoreTrainingOverview>;
  storePerformanceMap: Record<string, AdminStorePerformanceOverview>;
  storeFixturesMap: Record<string, AdminStoreFixturesOverview>;
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
    const sku =
      resolveEffectiveSku(prod.letusto_sku, prod.manufacture_sku) ||
      prod.letusto_sku ||
      prod.manufacture_sku ||
      "KS-SKU";
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

/**
 * Authoritative store-specific orders and fulfillments resolver for Store Operations
 */
export async function getAdminStoreOrdersData(
  storeId: string
): Promise<AdminStoreOrdersOverview | null> {
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
        name
      )
    `)
    .eq("id", storeId)
    .maybeSingle();

  if (storeErr || !store) {
    return null;
  }

  const companyId = store.company_id;
  const company = Array.isArray(store.companies) ? store.companies[0] : store.companies;
  const companyName = company?.name || "Unknown Retailer";

  // 2. Fetch Orders strictly belonging to this physical Store ID
  const { data: rawOrders, error: ordersErr } = await adminClient
    .from("retailer_orders")
    .select(`
      id,
      order_number,
      company_id,
      store_id,
      order_status,
      payment_status,
      payment_terms,
      subtotal_amount,
      tax_amount,
      shipping_amount,
      total_amount,
      total_items_count,
      total_skus_count,
      total_ordered_units,
      total_shipped_units,
      total_cancelled_units,
      total_remaining_units,
      total_box_count,
      shipping_address,
      shipping_city,
      shipping_state,
      shipping_zip,
      created_at,
      updated_at
    `)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (ordersErr) {
    console.error("[getAdminStoreOrdersData] Error fetching store orders:", ordersErr);
    return null;
  }

  const orders = rawOrders || [];
  const orderIds = orders.map((o) => o.id);

  let itemsByOrderId: Record<string, AdminStoreOrderItemDetail[]> = {};
  let fulfillmentsByOrderId: Record<string, AdminStoreOrderFulfillment[]> = {};

  if (orderIds.length > 0) {
    // 3. Fetch Items
    try {
      const { data: itemRows } = await adminClient
        .from("retailer_order_items")
        .select(`
          id,
          order_id,
          product_id,
          sku,
          product_name,
          brand_name,
          quantity,
          quantity_shipped,
          quantity_cancelled,
          unit_wholesale_price,
          line_total
        `)
        .in("order_id", orderIds);

      (itemRows || []).forEach((r) => {
        const remaining = Math.max(0, (r.quantity || 0) - (r.quantity_shipped || 0) - (r.quantity_cancelled || 0));
        const itemDetail: AdminStoreOrderItemDetail = {
          id: r.id,
          orderId: r.order_id,
          productId: r.product_id,
          sku: r.sku || "N/A",
          productName: r.product_name || "Unknown Product",
          brandName: r.brand_name || null,
          quantity: Number(r.quantity) || 0,
          quantityShipped: Number(r.quantity_shipped) || 0,
          quantityCancelled: Number(r.quantity_cancelled) || 0,
          quantityRemaining: remaining,
          unitWholesalePrice: Number(r.unit_wholesale_price) || 0,
          lineTotal: Number(r.line_total) || 0,
        };
        if (!itemsByOrderId[r.order_id]) itemsByOrderId[r.order_id] = [];
        itemsByOrderId[r.order_id].push(itemDetail);
      });
    } catch (e) {
      console.warn("[getAdminStoreOrdersData] Warning fetching order items:", e);
    }

    // 4. Fetch Fulfillments
    try {
      const { data: fulfillmentRows } = await adminClient
        .from("retailer_order_fulfillments")
        .select(`
          id,
          fulfillment_number,
          order_id,
          status,
          carrier,
          tracking_number,
          tracking_url,
          shipped_at,
          delivered_at,
          box_count,
          notes
        `)
        .in("order_id", orderIds);

      const fulIds = (fulfillmentRows || []).map((f) => f.id);
      let boxesByFulfillmentId: Record<string, AdminStoreOrderBox[]> = {};

      if (fulIds.length > 0) {
        try {
          const { data: boxRows } = await adminClient
            .from("retailer_order_fulfillment_boxes")
            .select(`
              id,
              fulfillment_id,
              order_id,
              box_number,
              box_total,
              carrier,
              tracking_number,
              tracking_url,
              status
            `)
            .in("fulfillment_id", fulIds);

          (boxRows || []).forEach((b) => {
            const box: AdminStoreOrderBox = {
              id: b.id,
              boxNumber: Number(b.box_number) || 1,
              boxTotal: Number(b.box_total) || 1,
              carrier: b.carrier || null,
              trackingNumber: b.tracking_number || null,
              trackingUrl: b.tracking_url || null,
              status: b.status || "active",
            };
            if (!boxesByFulfillmentId[b.fulfillment_id]) boxesByFulfillmentId[b.fulfillment_id] = [];
            boxesByFulfillmentId[b.fulfillment_id].push(box);
          });
        } catch (e) {
          console.warn("[getAdminStoreOrdersData] Warning fetching boxes:", e);
        }
      }

      (fulfillmentRows || []).forEach((f) => {
        const ful: AdminStoreOrderFulfillment = {
          id: f.id,
          fulfillmentNumber: f.fulfillment_number || "N/A",
          orderId: f.order_id,
          status: f.status || "processing",
          carrier: f.carrier || null,
          trackingNumber: f.tracking_number || null,
          trackingUrl: f.tracking_url || null,
          shippedAt: f.shipped_at || null,
          deliveredAt: f.delivered_at || null,
          boxCount: Number(f.box_count) || (boxesByFulfillmentId[f.id]?.length || 0),
          notes: f.notes || null,
          boxes: boxesByFulfillmentId[f.id] || [],
        };
        if (!fulfillmentsByOrderId[f.order_id]) fulfillmentsByOrderId[f.order_id] = [];
        fulfillmentsByOrderId[f.order_id].push(ful);
      });
    } catch (e) {
      console.warn("[getAdminStoreOrdersData] Warning fetching fulfillments:", e);
    }
  }

  // 5. Construct AdminStoreOrderItem array
  const orderItems: AdminStoreOrderItem[] = orders.map((o) => {
    const orderFulfillments = fulfillmentsByOrderId[o.id] || [];
    const calculatedBoxes = orderFulfillments.reduce(
      (acc, f) => acc + (f.boxes && f.boxes.length > 0 ? f.boxes.length : (f.boxCount || 0)),
      0
    );
    return {
      id: o.id,
      orderNumber: o.order_number,
      companyId: o.company_id,
      storeId: o.store_id,
      orderStatus: o.order_status,
      paymentStatus: o.payment_status || "unpaid",
      paymentTerms: o.payment_terms || null,
      subtotalAmount: Number(o.subtotal_amount) || 0,
      taxAmount: Number(o.tax_amount) || 0,
      shippingAmount: Number(o.shipping_amount) || 0,
      totalAmount: Number(o.total_amount) || 0,
      totalItemsCount: Number(o.total_items_count) || (itemsByOrderId[o.id]?.length || 0),
      totalSkusCount: Number(o.total_skus_count) || 0,
      totalOrderedUnits: Number(o.total_ordered_units) || 0,
      totalShippedUnits: Number(o.total_shipped_units) || 0,
      totalCancelledUnits: Number(o.total_cancelled_units) || 0,
      totalRemainingUnits: Number(o.total_remaining_units) || 0,
      totalBoxCount: Number(o.total_box_count) || calculatedBoxes,
      shippingAddress: o.shipping_address || null,
      shippingCity: o.shipping_city || null,
      shippingState: o.shipping_state || null,
      shippingZip: o.shipping_zip || null,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      items: itemsByOrderId[o.id] || [],
      fulfillments: orderFulfillments,
    };
  });

  // 6. Aggregate KPIs
  const totalOrdersCount = orderItems.length;
  const openOrdersCount = orderItems.filter((o) =>
    ["submitted", "confirmed", "processing", "partially_shipped"].includes(o.orderStatus.toLowerCase())
  ).length;
  const shippedOrdersCount = orderItems.filter((o) =>
    ["shipped", "delivered"].includes(o.orderStatus.toLowerCase())
  ).length;
  const ordersWithRemainingUnitsCount = orderItems.filter((o) =>
    o.totalRemainingUnits > 0 && o.orderStatus.toLowerCase() !== "cancelled"
  ).length;

  return {
    storeId: store.id,
    storeName: store.name,
    companyId,
    companyName,
    totalOrdersCount,
    openOrdersCount,
    shippedOrdersCount,
    ordersWithRemainingUnitsCount,
    orders: orderItems,
  };
}

/**
 * Authoritative store-specific staff and training coverage resolver for Store Operations (ADM-STORE-OPS-P2-003)
 */
export async function getAdminStoreTrainingData(
  storeId: string
): Promise<AdminStoreTrainingOverview | null> {
  const adminClient = createAdminClient();

  // 1. Fetch store with parent company
  const { data: store, error: storeErr } = await adminClient
    .from("stores")
    .select(`
      id,
      name,
      city,
      state,
      company_id,
      companies:companies!stores_company_id_fkey (
        id,
        name
      )
    `)
    .eq("id", storeId)
    .single();

  if (storeErr || !store) {
    console.error("[getAdminStoreTrainingData] Error fetching store:", storeErr);
    return null;
  }

  const companyId = store.company_id;
  const companyName = (store.companies as any)?.name || "Retailer Company";

  // 2. Fetch all stores for this company
  const { data: companyStoresRaw } = await adminClient
    .from("stores")
    .select("id, name, city, state")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  const companyStores = companyStoresRaw || [];

  // 3. Fetch company users
  const { data: companyUsers } = await adminClient
    .from("company_users")
    .select("id, name, email, company_role, status")
    .eq("company_id", companyId);

  const userIds = (companyUsers || []).map((cu) => cu.id);
  const userRolesMap = new Map<string, any>();
  const userStoresMap = new Map<string, any[]>();

  if (userIds.length > 0) {
    const { data: roles } = await adminClient
      .from("retailer_user_roles")
      .select("user_id, role, has_all_stores_access")
      .in("user_id", userIds)
      .eq("company_id", companyId);
    (roles || []).forEach((r) => userRolesMap.set(r.user_id, r));

    const { data: storeAccess } = await adminClient
      .from("retailer_user_store_access")
      .select("user_id, store_id, stores(id, name, city)")
      .in("user_id", userIds)
      .eq("company_id", companyId);

    (storeAccess || []).forEach((sa: any) => {
      if (!userStoresMap.has(sa.user_id)) userStoresMap.set(sa.user_id, []);
      if (sa.stores) userStoresMap.get(sa.user_id)!.push(sa.stores);
    });
  }

  const members = (companyUsers || []).map((cu) => {
    const r = userRolesMap.get(cu.id);
    const hasAllStoresAccess = r?.has_all_stores_access === true;
    const assignedStores = hasAllStoresAccess
      ? companyStores.map((s) => ({ id: s.id, name: s.name }))
      : userStoresMap.get(cu.id) || [];
    return {
      id: cu.id,
      fullName: cu.name,
      email: cu.email,
      role: r?.role || cu.company_role || "employee",
      hasAllStoresAccess,
      assignedStores,
    };
  });

  const trainingAnalytics = await computeRetailerTrainingAnalytics({
    companyId,
    stores: companyStores,
    members,
    adminClient,
  });

  const storeCoverage = trainingAnalytics.stores.find((s) => s.storeId === storeId);

  const storeStaff: AdminStoreStaffItem[] = trainingAnalytics.employees
    .filter((emp) => {
      const hasExplicit = (userStoresMap.get(emp.userId) || []).some((s: any) => s.id === storeId);
      const hasAll = emp.hasAllStoresAccess;
      return hasExplicit || hasAll;
    })
    .map((emp) => {
      const hasExplicit = (userStoresMap.get(emp.userId) || []).some((s: any) => s.id === storeId);
      return {
        userId: emp.userId,
        userName: emp.userName,
        email: emp.email,
        role: emp.role,
        assignmentStatus: hasExplicit ? "assigned" : "all_stores",
        eligibleProductsCount: emp.availablePublishedCount,
        verifiedProductsCompletedCount: emp.productsCompletedCount,
        individualCompletionRate: emp.completionPercent,
        latestVerifiedCompletionDate: emp.latestCompletionAt,
        status: emp.status,
        completions: emp.completions.map((c) => ({
          productId: c.productId,
          productName: c.productName,
          sku: c.sku,
          completedAt: c.completedAt,
          isVerified: c.isVerifiedQuiz,
        })),
      };
    });

  const storeProducts: AdminStoreTrainingProductItem[] = (storeCoverage?.products || []).map((p) => ({
    productId: p.productId,
    productName: p.productName,
    productNameEn: p.productNameEn || null,
    sku: p.sku,
    brandName: p.brandName,
    category: p.category,
    thumbnailUrl: p.thumbnailUrl || null,
    trainingStatus: p.trainingStatus,
    coverageStatus: p.coverageStatus,
    qualifiedEmployees: p.qualifiedEmployees || [],
    latestPassDate: p.latestPassDate || null,
  }));

  const gapProducts = storeProducts.filter((p) => p.coverageStatus !== "covered");

  return {
    storeId: store.id,
    storeName: store.name,
    companyId,
    companyName,
    assignedStaffCount: storeStaff.length,
    eligibleProductsCount: storeCoverage?.publishedProductsCount || 0,
    coveredProductsCount: storeCoverage?.coveredProductsCount || 0,
    needsTrainingProductsCount: storeCoverage?.needsTrainingCount || 0,
    storeCoveragePercent: storeCoverage?.coveragePercent ?? null,
    lastCompletedAt: storeCoverage?.lastCompletedAt || null,
    staff: storeStaff,
    products: storeProducts,
    gapProducts,
  };
}

/**
 * Authoritative store-specific sales velocity and estimated movement resolver for Store Operations
 * ADM-STORE-OPS-P2-004
 */
export async function getAdminStorePerformanceData(
  storeId: string,
  period: AnalysisPeriod = "all"
): Promise<AdminStorePerformanceOverview | null> {
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

  // 2. Fetch Weekly Checks for this Store (Submitted only)
  let checksQuery = adminClient
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
    .eq("store_id", storeId)
    .eq("status", "submitted")
    .order("report_date", { ascending: true });

  if (period !== "all") {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
    checksQuery = checksQuery.gte("report_date", cutoff);
  }

  const { data: rawChecks } = await checksQuery;
  const submittedChecks = rawChecks || [];

  // Also query latest check of any status to determine overall activity
  const { data: latestAnyCheckRows } = await adminClient
    .from("retailer_weekly_checks")
    .select("id, report_date, reporting_week, status")
    .eq("store_id", storeId)
    .order("report_date", { ascending: false })
    .limit(1);

  const latestAnyCheck = latestAnyCheckRows?.[0] || null;
  const latestSubmittedCheck = submittedChecks.length > 0 ? submittedChecks[submittedChecks.length - 1] : null;

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
  const { data: allStoreChecks } = await adminClient
    .from("retailer_weekly_checks")
    .select("retailer_weekly_check_items ( product_id )")
    .eq("store_id", storeId);

  (allStoreChecks || []).forEach((c: any) => {
    (c.retailer_weekly_check_items || []).forEach((it: any) => {
      if (it.product_id) relevantProductIds.add(it.product_id);
    });
  });

  // C. Products present in store-scoped orders
  const { data: orderItemRows } = await adminClient
    .from("retailer_orders")
    .select("retailer_order_items ( product_id )")
    .eq("store_id", storeId);

  (orderItemRows || []).forEach((ord: any) => {
    (ord.retailer_order_items || []).forEach((it: any) => {
      if (it.product_id) relevantProductIds.add(it.product_id);
    });
  });

  // D. Fallback if empty: active selling products
  if (relevantProductIds.size === 0) {
    const { data: fallbackProds } = await adminClient
      .from("products")
      .select("id")
      .eq("status", "selling")
      .limit(10);

    (fallbackProds || []).forEach((p) => relevantProductIds.add(p.id));
  }

  // 4. Fetch Products Catalog Details
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

  // 5. Authoritative Product Images
  let imageMap: Record<string, { primaryUrl: string | null }> = {};
  try {
    imageMap = await resolveAuthoritativeProductImages(
      adminClient,
      products.map((p) => p.id)
    );
  } catch (e) {
    console.warn("[getAdminStorePerformanceData] Error fetching product images:", e);
  }

  // 6. Confirmed Fulfillments for Delivery Events
  const { data: rawFulfillments } = await adminClient
    .from("retailer_order_fulfillments")
    .select(`
      id,
      fulfillment_number,
      status,
      delivered_at,
      shipped_at,
      created_at,
      retailer_order_fulfillment_items (
        product_id,
        quantity_shipped,
        quantity_delivered
      )
    `)
    .eq("store_id", storeId)
    .in("status", ["shipped", "delivered"]);

  const productReceiptsMap = new Map<string, ReceiptEvent[]>();
  (rawFulfillments || []).forEach((ff: any) => {
    const dateStr = ff.delivered_at || ff.shipped_at || ff.created_at;
    if (!dateStr) return;
    const receiptDate = dateStr.split("T")[0];
    (ff.retailer_order_fulfillment_items || []).forEach((it: any) => {
      if (!it.product_id) return;
      const qty = Number(it.quantity_delivered || it.quantity_shipped || 0);
      if (qty <= 0) return;
      if (!productReceiptsMap.has(it.product_id)) {
        productReceiptsMap.set(it.product_id, []);
      }
      productReceiptsMap.get(it.product_id)!.push({
        id: it.id || ff.id,
        orderId: ff.order_id,
        storeId,
        productId: it.product_id,
        quantity: qty,
        receiptDate,
        receiptTimestamp: new Date(receiptDate + "T00:00:00Z").getTime(),
        isEstimated: !ff.delivered_at,
        deliveryStatus: ff.delivered_at ? "delivered" : "estimated_in_transit",
      });
    });
  });

  // 7. Open Incoming Order Quantities
  const incomingMap = new Map<string, number>();
  try {
    const { data: openOrders } = await adminClient
      .from("retailer_orders")
      .select(`
        id,
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
    console.warn("[getAdminStorePerformanceData] Error fetching open orders:", e);
  }

  // 8. Build Store Sku Performance Items
  let totalEstimatedUnitsSoldSum = 0;
  let totalWeeklyVelocitySum = 0;
  let productsWithComparableIntervalsCount = 0;
  let productsWithCountedDataCount = 0;
  let productsNeedingAttentionCount = 0;

  const skuItems: AdminStorePerformanceSkuItem[] = products.map((prod: any) => {
    const brand = Array.isArray(prod.brands) ? prod.brands[0] : prod.brands;
    const sku =
      resolveEffectiveSku(prod.letusto_sku, prod.manufacture_sku) ||
      prod.letusto_sku ||
      prod.manufacture_sku ||
      "KS-SKU";
    const primaryImg = imageMap[prod.id]?.primaryUrl || null;
    const incomingQty = incomingMap.get(prod.id) || 0;

    // Pricing
    const wholesalePrice = Number(prod.price_additional_info?.wholesale_price) || 15;
    const srpPrice = Number(prod.estimated_retail_price) || wholesalePrice * 2;
    const pricingInput: PricingInput = {
      wholesalePrice,
      catalogErp: srpPrice,
    };

    // Collect snapshots from submitted checks
    const snapshots: SnapshotInput[] = [];
    let lastReportingDate: string | null = null;
    let lastReportingWeek: string | null = null;

    submittedChecks.forEach((c) => {
      const it = (c.retailer_weekly_check_items || []).find(
        (item: any) => item.product_id === prod.id && item.is_counted
      );
      if (it && it.reported_remaining_qty !== null && it.reported_remaining_qty !== undefined) {
        snapshots.push({
          checkId: c.id,
          storeId: store.id,
          reportDate: c.report_date,
          reportedRemaining: Number(it.reported_remaining_qty),
          retailPriceSnapshot: it.retail_price_snapshot ? Number(it.retail_price_snapshot) : null,
          retailPriceBasis: it.retail_price_basis || null,
        });
        lastReportingDate = c.report_date;
        lastReportingWeek = c.reporting_week;
      }
    });

    const receipts = productReceiptsMap.get(prod.id) || [];
    const usableSubmissionsCount = snapshots.length;

    let latestReportedStock: number | null = null;
    let estimatedUnitsSold: number | null = null;
    let estimatedWeeklyVelocity: number | null = null;
    let approxWeeksOfSupply: number | null = null;
    let performanceStatus: StorePerformanceStatus = "not_reported";
    let statusLabel = "Not Reported";
    let statusReason = "No submitted physical inventory reports";
    let stockRisk: AdminStorePerformanceSkuItem["stockRisk"] = "unreported";
    let stockRiskLabel = "Unreported";

    if (usableSubmissionsCount === 0) {
      performanceStatus = "not_reported";
      statusLabel = "Not Reported";
      statusReason = "No submitted physical counts for this product";
      stockRisk = "unreported";
      stockRiskLabel = "Unreported";
      productsNeedingAttentionCount++;
    } else if (usableSubmissionsCount === 1) {
      productsWithCountedDataCount++;
      latestReportedStock = snapshots[0].reportedRemaining;
      performanceStatus = "baseline_only";
      statusLabel = "Baseline Count";
      statusReason = "Initial physical count recorded; requires 2nd submission to calculate movement";

      if (latestReportedStock === 0) {
        stockRisk = "stockout";
        stockRiskLabel = "Out of Stock";
        productsNeedingAttentionCount++;
      } else if (latestReportedStock <= 5) {
        stockRisk = "low_stock";
        stockRiskLabel = "Low Stock (≤ 5 units)";
        productsNeedingAttentionCount++;
      } else {
        stockRisk = "sufficient";
        stockRiskLabel = "In Stock";
      }
    } else {
      // 2 or more submitted checks: pure calculation engine
      productsWithCountedDataCount++;
      productsWithComparableIntervalsCount++;
      latestReportedStock = snapshots[snapshots.length - 1].reportedRemaining;

      const storeSkuEstimate = buildStoreSkuFinancialEstimate({
        storeId: store.id,
        storeName: store.name,
        productId: prod.id,
        sku,
        selectedPeriod: period as any,
        snapshots,
        receipts,
        pricing: pricingInput,
      });

      const metrics = storeSkuEstimate.periodMetrics;
      estimatedUnitsSold = metrics.estimatedUnitsSold !== null ? Math.round(metrics.estimatedUnitsSold) : null;
      estimatedWeeklyVelocity = metrics.estimatedWeeklySalesRate !== null ? Math.round(metrics.estimatedWeeklySalesRate * 10) / 10 : null;

      if (estimatedUnitsSold !== null) {
        totalEstimatedUnitsSoldSum += estimatedUnitsSold;
      }
      if (estimatedWeeklyVelocity !== null) {
        totalWeeklyVelocitySum += estimatedWeeklyVelocity;
      }

      if (estimatedWeeklyVelocity !== null && estimatedWeeklyVelocity > 0 && latestReportedStock !== null) {
        approxWeeksOfSupply = Math.round((latestReportedStock / estimatedWeeklyVelocity) * 10) / 10;
      }

      performanceStatus = "valid_estimate";
      statusLabel = "Valid Estimate";
      statusReason = `${usableSubmissionsCount} submissions across ${metrics.observedDays} days`;

      if (latestReportedStock === 0) {
        stockRisk = "stockout";
        stockRiskLabel = "Out of Stock";
        productsNeedingAttentionCount++;
      } else if (approxWeeksOfSupply !== null && approxWeeksOfSupply < 2) {
        stockRisk = "low_stock";
        stockRiskLabel = "Low Stock (< 2 wks)";
        productsNeedingAttentionCount++;
      } else if (approxWeeksOfSupply !== null && approxWeeksOfSupply > 6) {
        stockRisk = "overstock";
        stockRiskLabel = "Overstock (> 6 wks)";
      } else {
        stockRisk = "sufficient";
        stockRiskLabel = "Optimal Stock";
      }
    }

    return {
      productId: prod.id,
      productName: prod.name,
      productNameEn: prod.name_en || null,
      sku,
      brandName: brand?.name || "K SELECT Brand",
      category: prod.category || "Skincare",
      thumbnailUrl: primaryImg,
      latestReportedStock,
      estimatedUnitsSold,
      estimatedWeeklyVelocity,
      approxWeeksOfSupply,
      performanceStatus,
      statusLabel,
      statusReason,
      stockRisk,
      stockRiskLabel,
      usableSubmissionsCount,
      lastReportingDate,
      lastReportingWeek,
      incomingQty,
    };
  });

  return {
    storeId: store.id,
    storeName: store.name,
    companyId,
    companyName,
    selectedPeriod: period,
    submittedChecksCount: submittedChecks.length,
    latestReportDate: latestSubmittedCheck?.report_date || latestAnyCheck?.report_date || null,
    latestReportingWeek: latestSubmittedCheck?.reporting_week || latestAnyCheck?.reporting_week || null,
    totalEstimatedUnitsSold: productsWithComparableIntervalsCount > 0 ? totalEstimatedUnitsSoldSum : null,
    averageWeeklyVelocity: productsWithComparableIntervalsCount > 0 ? Math.round(totalWeeklyVelocitySum * 10) / 10 : null,
    productsWithValidDataCount: productsWithCountedDataCount,
    productsNeedingAttentionCount,
    carriedProductsCount: skuItems.length,
    reportedProductsCount: productsWithCountedDataCount,
    products: skuItems,
  };
}

/**
 * Authoritative store-specific fixtures and placements overview resolver for Store Operations
 * ADM-STORE-OPS-P3-002
 */
export async function getAdminStoreFixturesData(
  storeId: string
): Promise<AdminStoreFixturesOverview | null> {
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

  // 2. Fetch Store Eligible Assortment
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

  // B. Weekly check items for this store
  const { data: checkItems } = await adminClient
    .from("retailer_weekly_checks")
    .select("retailer_weekly_check_items ( product_id )")
    .eq("store_id", storeId);

  (checkItems || []).forEach((c: any) => {
    (c.retailer_weekly_check_items || []).forEach((it: any) => {
      if (it.product_id) relevantProductIds.add(it.product_id);
    });
  });

  // C. Order items for this store
  const { data: storeOrders } = await adminClient
    .from("retailer_orders")
    .select("retailer_order_items ( product_id )")
    .eq("store_id", storeId);

  (storeOrders || []).forEach((o: any) => {
    (o.retailer_order_items || []).forEach((it: any) => {
      if (it.product_id) relevantProductIds.add(it.product_id);
    });
  });

  // D. Fallback: If no products found, load active selling products
  if (relevantProductIds.size === 0) {
    const { data: fallbackProds } = await adminClient
      .from("products")
      .select("id")
      .eq("status", "selling")
      .limit(20);

    (fallbackProds || []).forEach((p) => relevantProductIds.add(p.id));
  }

  // 3. Fetch Full Product Details for Assortment
  const { data: rawAssortmentProducts } = await adminClient
    .from("products")
    .select(`
      id,
      name,
      name_en,
      category,
      letusto_sku,
      manufacture_sku,
      status,
      brands (
        id,
        name
      )
    `)
    .in("id", Array.from(relevantProductIds))
    .order("name", { ascending: true });

  // 4. Fetch Fixtures with Placements and Placed Products
  const { data: rawFixtures, error: fixErr } = await adminClient
    .from("store_fixtures")
    .select(`
      id,
      store_id,
      company_id,
      fixture_code,
      fixture_name,
      fixture_type,
      bay_count,
      shelf_count,
      has_header_signage,
      in_store_location,
      installation_status,
      operational_status,
      installation_date,
      installed_by,
      primary_photo_url,
      last_inspected_at,
      notes,
      created_at,
      updated_at,
      store_fixture_placements (
        id,
        store_fixture_id,
        store_id,
        product_id,
        bay_number,
        shelf_level,
        position_slot,
        facing_count,
        capacity_units,
        placement_status,
        notes,
        created_at,
        updated_at,
        products:products!store_fixture_placements_product_id_fkey (
          id,
          name,
          name_en,
          letusto_sku,
          manufacture_sku,
          category,
          status,
          brands (
            id,
            name
          )
        )
      )
    `)
    .eq("store_id", storeId)
    .order("created_at", { ascending: true });

  if (fixErr) {
    console.error("[getAdminStoreFixturesData] Error fetching store fixtures:", fixErr);
    return null;
  }

  // 5. Gather all product IDs to resolve authoritative images
  const allImageProductIds = new Set<string>();
  (rawAssortmentProducts || []).forEach((p) => allImageProductIds.add(p.id));

  (rawFixtures || []).forEach((f: any) => {
    (f.store_fixture_placements || []).forEach((plc: any) => {
      if (plc.product_id) allImageProductIds.add(plc.product_id);
    });
  });

  let imageMap: Record<string, { primaryUrl: string | null }> = {};
  if (allImageProductIds.size > 0) {
    try {
      imageMap = await resolveAuthoritativeProductImages(
        adminClient,
        Array.from(allImageProductIds)
      );
    } catch (e) {
      console.warn("[getAdminStoreFixturesData] Error fetching product images:", e);
    }
  }

  // Map Eligible Assortment
  const eligibleProducts: StoreAssortmentProductItem[] = (rawAssortmentProducts || []).map((p: any) => {
    const brandName = Array.isArray(p.brands) ? p.brands[0]?.name : p.brands?.name;
    const effectiveSku = resolveEffectiveSku(p) || p.letusto_sku || p.manufacture_sku || "N/A";
    return {
      id: p.id,
      name: p.name,
      nameEn: p.name_en || null,
      brandName: brandName || null,
      sku: effectiveSku,
      category: p.category || null,
      thumbnailUrl: imageMap[p.id]?.primaryUrl || null,
      status: p.status,
    };
  });

  // Map Fixtures & Placements
  let totalPlacementsSum = 0;
  let activePlacementsSum = 0;

  const fixtures: AdminStoreFixtureItem[] = (rawFixtures || []).map((f: any) => {
    const rawPlacements = Array.isArray(f.store_fixture_placements) ? f.store_fixture_placements : [];

    const placements: AdminStoreFixturePlacementItem[] = rawPlacements.map((plc: any) => {
      const prod = Array.isArray(plc.products) ? plc.products[0] : plc.products;
      const brandName = prod?.brands ? (Array.isArray(prod.brands) ? prod.brands[0]?.name : prod.brands?.name) : null;
      const sku = prod ? (resolveEffectiveSku(prod) || prod.letusto_sku || prod.manufacture_sku || "N/A") : "N/A";

      return {
        id: plc.id,
        storeFixtureId: plc.store_fixture_id,
        storeId: plc.store_id,
        productId: plc.product_id,
        productName: prod?.name || "Unknown Product",
        productNameEn: prod?.name_en || null,
        brandName: brandName || null,
        sku,
        category: prod?.category || null,
        thumbnailUrl: imageMap[plc.product_id]?.primaryUrl || null,
        bayNumber: plc.bay_number || 1,
        shelfLevel: plc.shelf_level,
        positionSlot: plc.position_slot,
        facingCount: plc.facing_count || 1,
        capacityUnits: plc.capacity_units ?? 6,
        placementStatus: (plc.placement_status || "active") as PlacementStatus,
        placementStatusLabel: formatPlacementStatus(plc.placement_status || "active"),
        notes: plc.notes || null,
        createdAt: plc.created_at,
        updatedAt: plc.updated_at,
      };
    });

    // Sort placements by bay_number ASC, shelf_level ASC, position_slot ASC
    placements.sort((a, b) => {
      if (a.bayNumber !== b.bayNumber) return a.bayNumber - b.bayNumber;
      if (a.shelfLevel !== b.shelfLevel) return a.shelfLevel - b.shelfLevel;
      return a.positionSlot - b.positionSlot;
    });

    const activePlacements = placements.filter((p) => p.placementStatus !== "removed");
    totalPlacementsSum += placements.length;
    activePlacementsSum += activePlacements.length;

    return {
      id: f.id,
      storeId: f.store_id,
      companyId: f.company_id,
      fixtureCode: f.fixture_code,
      fixtureName: f.fixture_name,
      fixtureType: f.fixture_type as FixtureType,
      fixtureTypeLabel: formatFixtureType(f.fixture_type),
      bayCount: f.bay_count || 1,
      shelfCount: f.shelf_count || 5,
      hasHeaderSignage: Boolean(f.has_header_signage),
      inStoreLocation: f.in_store_location || null,
      installationStatus: f.installation_status as FixtureInstallationStatus,
      installationStatusLabel: formatInstallationStatus(f.installation_status),
      operationalStatus: f.operational_status as FixtureOperationalStatus,
      operationalStatusLabel: formatOperationalStatus(f.operational_status),
      installationDate: f.installation_date || null,
      installedBy: f.installed_by || null,
      primaryPhotoUrl: f.primary_photo_url || null,
      lastInspectedAt: f.last_inspected_at || null,
      notes: f.notes || null,
      placementsCount: activePlacements.length,
      placements,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    };
  });

  const activeFixturesCount = fixtures.filter((f) => f.operationalStatus === "active").length;
  const installedFixturesCount = fixtures.filter((f) => ["installed", "inspected"].includes(f.installationStatus)).length;
  const plannedFixturesCount = fixtures.filter((f) => f.installationStatus === "planned").length;
  const maintenanceNeededCount = fixtures.filter((f) => ["needs_maintenance", "damaged"].includes(f.operationalStatus)).length;

  return {
    storeId: store.id,
    storeName: store.name,
    companyId,
    companyName,
    totalFixturesCount: fixtures.length,
    activeFixturesCount,
    installedFixturesCount,
    plannedFixturesCount,
    maintenanceNeededCount,
    totalPlacementsCount: totalPlacementsSum,
    activePlacementsCount: activePlacementsSum,
    eligibleProducts,
    fixtures,
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

  // 6. Batch resolve store orders overviews for all stores
  const storeOrdersMap: Record<string, AdminStoreOrdersOverview> = {};
  for (const st of formattedStores) {
    try {
      const ordOverview = await getAdminStoreOrdersData(st.id);
      if (ordOverview) {
        storeOrdersMap[st.id] = ordOverview;
      }
    } catch (e) {
      console.warn(`[getAdminStoreOperationsData] Warning resolving orders for store ${st.id}:`, e);
    }
  }

  // 7. Batch resolve store training analytics overviews for all stores (ADM-STORE-OPS-P2-003)
  const storeTrainingMap: Record<string, AdminStoreTrainingOverview> = {};
  const storesByCompany = new Map<string, typeof formattedStores>();
  for (const st of formattedStores) {
    if (!storesByCompany.has(st.companyId)) {
      storesByCompany.set(st.companyId, []);
    }
    storesByCompany.get(st.companyId)!.push(st);
  }

  for (const [companyId, companyStores] of storesByCompany.entries()) {
    try {
      const { data: companyUsers } = await adminClient
        .from("company_users")
        .select("id, name, email, company_role, status")
        .eq("company_id", companyId);

      const userIds = (companyUsers || []).map((cu) => cu.id);
      let userRolesMap = new Map<string, any>();
      let userStoresMap = new Map<string, any[]>();

      if (userIds.length > 0) {
        const { data: roles } = await adminClient
          .from("retailer_user_roles")
          .select("user_id, role, has_all_stores_access")
          .in("user_id", userIds)
          .eq("company_id", companyId);
        (roles || []).forEach((r) => userRolesMap.set(r.user_id, r));

        const { data: storeAccess } = await adminClient
          .from("retailer_user_store_access")
          .select("user_id, store_id, stores(id, name, city)")
          .in("user_id", userIds)
          .eq("company_id", companyId);

        (storeAccess || []).forEach((sa: any) => {
          if (!userStoresMap.has(sa.user_id)) userStoresMap.set(sa.user_id, []);
          if (sa.stores) userStoresMap.get(sa.user_id)!.push(sa.stores);
        });
      }

      const members = (companyUsers || []).map((cu) => {
        const r = userRolesMap.get(cu.id);
        const hasAllStoresAccess = r?.has_all_stores_access === true;
        const assignedStores = hasAllStoresAccess
          ? companyStores.map((s) => ({ id: s.id, name: s.name }))
          : userStoresMap.get(cu.id) || [];
        return {
          id: cu.id,
          fullName: cu.name,
          email: cu.email,
          role: r?.role || cu.company_role || "employee",
          hasAllStoresAccess,
          assignedStores,
        };
      });

      const trainingAnalytics = await computeRetailerTrainingAnalytics({
        companyId,
        stores: companyStores.map((s) => ({
          id: s.id,
          name: s.name,
          city: s.city,
          state: s.state,
        })),
        members,
        adminClient,
      });

      for (const st of companyStores) {
        const storeCoverage = trainingAnalytics.stores.find((s) => s.storeId === st.id);

        const storeStaff: AdminStoreStaffItem[] = trainingAnalytics.employees
          .filter((emp) => {
            const hasExplicit = (userStoresMap.get(emp.userId) || []).some((s: any) => s.id === st.id);
            const hasAll = emp.hasAllStoresAccess;
            return hasExplicit || hasAll;
          })
          .map((emp) => {
            const hasExplicit = (userStoresMap.get(emp.userId) || []).some((s: any) => s.id === st.id);
            return {
              userId: emp.userId,
              userName: emp.userName,
              email: emp.email,
              role: emp.role,
              assignmentStatus: hasExplicit ? "assigned" : "all_stores",
              eligibleProductsCount: emp.availablePublishedCount,
              verifiedProductsCompletedCount: emp.productsCompletedCount,
              individualCompletionRate: emp.completionPercent,
              latestVerifiedCompletionDate: emp.latestCompletionAt,
              status: emp.status,
              completions: emp.completions.map((c) => ({
                productId: c.productId,
                productName: c.productName,
                sku: c.sku,
                completedAt: c.completedAt,
                isVerified: c.isVerifiedQuiz,
              })),
            };
          });

        const storeProducts: AdminStoreTrainingProductItem[] = (storeCoverage?.products || []).map((p) => ({
          productId: p.productId,
          productName: p.productName,
          productNameEn: p.productNameEn || null,
          sku: p.sku,
          brandName: p.brandName,
          category: p.category,
          thumbnailUrl: p.thumbnailUrl || null,
          trainingStatus: p.trainingStatus,
          coverageStatus: p.coverageStatus,
          qualifiedEmployees: p.qualifiedEmployees || [],
          latestPassDate: p.latestPassDate || null,
        }));

        const gapProducts = storeProducts.filter((p) => p.coverageStatus !== "covered");

        storeTrainingMap[st.id] = {
          storeId: st.id,
          storeName: st.name,
          companyId: st.companyId,
          companyName: st.companyName,
          assignedStaffCount: storeStaff.length,
          eligibleProductsCount: storeCoverage?.publishedProductsCount || 0,
          coveredProductsCount: storeCoverage?.coveredProductsCount || 0,
          needsTrainingProductsCount: storeCoverage?.needsTrainingCount || 0,
          storeCoveragePercent: storeCoverage?.coveragePercent ?? null,
          lastCompletedAt: storeCoverage?.lastCompletedAt || null,
          staff: storeStaff,
          products: storeProducts,
          gapProducts,
        };
      }
    } catch (e) {
      console.warn(`[getAdminStoreOperationsData] Warning computing training analytics for company ${companyId}:`, e);
    }
  }

  // 8. Batch resolve store performance overviews for all stores (ADM-STORE-OPS-P2-004)
  const storePerformanceMap: Record<string, AdminStorePerformanceOverview> = {};
  for (const st of formattedStores) {
    try {
      const perfOverview = await getAdminStorePerformanceData(st.id, "all");
      if (perfOverview) storePerformanceMap[st.id] = perfOverview;
    } catch (e) {
      console.warn(`[getAdminStoreOperationsData] Warning resolving performance for store ${st.id}:`, e);
    }
  }

  // 9. Batch resolve store fixtures for all stores (ADM-STORE-OPS-P3-002)
  const storeFixturesMap: Record<string, AdminStoreFixturesOverview> = {};
  for (const st of formattedStores) {
    try {
      const fixOverview = await getAdminStoreFixturesData(st.id);
      if (fixOverview) storeFixturesMap[st.id] = fixOverview;
    } catch (e) {
      console.warn(`[getAdminStoreOperationsData] Warning resolving fixtures for store ${st.id}:`, e);
    }
  }

  return {
    stores: formattedStores,
    retailers: Array.from(retailerMap.values()),
    totalStoresCount: formattedStores.length,
    activeStoresCount: formattedStores.filter((s) => s.status === "active").length,
    totalRetailersCount: retailerMap.size,
    storeInventoryMap,
    storeOrdersMap,
    storeTrainingMap,
    storePerformanceMap,
    storeFixturesMap,
  };
}

