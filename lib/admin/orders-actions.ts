// lib/admin/orders-actions.ts
// Phase B6 Centralized Admin Server Actions for Retailer Orders & Multi-Box Logistics

"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminSession } from "@/lib/auth/dal";
import { resolveCarrierTrackingUrl } from "@/lib/orders/carrier-resolver";
import {
  AdminRetailerOrderSummary,
  AdminRetailerOrderDetail,
  AdminOrderFilter,
  ApprovedOrderStatus,
  AdminOrderShipment,
  AdminOrderPackage,
  AdminOrderBox,
  AdminOrderLineItem,
  AdminRetailerOrdersResult,
  AdminOrderSummaryCounters,
  AdminOrderDispatchSummary,
} from "./orders-types";
import {
  computeAuthoritativeOrderStatus,
  isOrderOperationallyCompleted,
  calculateDaysOpenNumber,
} from "@/lib/orders/order-status-utils";

/**
 * Fetch all Retailer Orders for Admin Centralized Orders Management
 */
export async function getAdminRetailerOrdersAction(
  filters?: AdminOrderFilter
): Promise<AdminRetailerOrdersResult> {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  // 1. Fetch companies and stores for filter dropdowns in parallel
  const [companiesRes, storesRes] = await Promise.all([
    adminClient.from("companies").select("id, name, company_code").order("name", { ascending: true }),
    adminClient.from("stores").select("id, name, company_id, city, state").order("name", { ascending: true }),
  ]);

  const companies = (companiesRes.data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    companyCode: c.company_code || null,
  }));

  const stores = (storesRes.data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    companyId: s.company_id,
    city: s.city || null,
    state: s.state || null,
  }));

  // 2. Fetch orders with relationships
  let query = adminClient
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
      total_amount,
      discount_amount,
      coupon_code,
      total_items_count,
      total_skus_count,
      shipping_destination_type,
      recipient_name,
      shipping_city,
      shipping_state,
      cancellation_requested,
      refund_amount,
      refund_status,
      is_test,
      created_at,
      updated_at,
      companies (
        id,
        name,
        company_code
      ),
      stores (
        id,
        name,
        address,
        city,
        state,
        zip
      ),
      retailer_order_items (
        id,
        product_id,
        sku,
        product_name,
        quantity,
        quantity_shipped,
        quantity_cancelled,
        unit_wholesale_price,
        line_total
      ),
      retailer_invoices (
        id,
        invoice_number,
        invoice_date,
        due_date,
        total_amount,
        amount_paid,
        balance_due,
        invoice_status,
        payment_status,
        terms_name,
        fulfillment_id,
        fulfillment_number
      ),
      retailer_order_fulfillments (
        id,
        fulfillment_number,
        status,
        carrier,
        tracking_number,
        box_count,
        created_at,
        shipped_at,
        retailer_order_fulfillment_boxes (
          id,
          box_number,
          carrier,
          tracking_number,
          status
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (filters?.companyId && filters.companyId !== "all") {
    query = query.eq("company_id", filters.companyId);
  }
  if (filters?.storeId && filters.storeId !== "all") {
    query = query.eq("store_id", filters.storeId);
  }
  if (filters?.paymentStatus && filters.paymentStatus !== "all") {
    query = query.eq("payment_status", filters.paymentStatus);
  }

  const { data: rawOrders, error } = await query;
  if (error || !rawOrders) {
    console.error("getAdminRetailerOrdersAction error:", error);
    return {
      orders: [],
      totalCount: 0,
      summaryCounters: {
        total: 0,
        newOrders: 0,
        readyToProcess: 0,
        partiallyShipped: 0,
        onHold: 0,
        trackingMissing: 0,
        completed: 0,
      },
      companies,
      stores,
    };
  }

  // Fetch packages for carton tracking popover in one query
  const orderIds = rawOrders.map((o) => o.id);
  const packagesMap = new Map<string, AdminOrderPackage[]>();

  if (orderIds.length > 0) {
    const { data: rawPackages } = await adminClient
      .from("retailer_order_packages")
      .select("*")
      .in("order_id", orderIds)
      .order("box_number", { ascending: true });

    if (rawPackages) {
      rawPackages.forEach((p: any) => {
        const list = packagesMap.get(p.order_id) || [];
        list.push({
          id: p.id,
          fulfillmentId: p.fulfillment_id,
          orderId: p.order_id,
          boxNumber: p.box_number,
          boxTotal: p.box_total,
          carrier: p.carrier,
          trackingNumber: p.tracking_number,
          trackingUrl: resolveCarrierTrackingUrl(p.carrier, p.tracking_number, p.tracking_url),
          weightLbs: p.weight_lbs,
          dimensionsInch: p.dimensions_inch,
          packageItems: p.package_items || [],
          createdAt: p.created_at,
        });
        packagesMap.set(p.order_id, list);
      });
    }
  }

  const mappedOrders: AdminRetailerOrderSummary[] = rawOrders.map((o: any) => {
    const items = o.retailer_order_items || [];
    const totalOrderedUnits =
      items.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0) ||
      Number(o.total_ordered_units || o.total_items_count || 0);
    const totalShippedUnits = ["shipped", "delivered"].includes(o.order_status)
      ? totalOrderedUnits
      : items.reduce((sum: number, it: any) => sum + Number(it.quantity_shipped || 0), 0);
    const totalCancelledUnits = ["cancelled"].includes(o.order_status)
      ? totalOrderedUnits
      : items.reduce((sum: number, it: any) => sum + Number(it.quantity_cancelled || 0), 0);
    const totalRemainingUnits = Math.max(0, totalOrderedUnits - totalShippedUnits - totalCancelledUnits);

    const pkgs = packagesMap.get(o.id) || [];

    const authoritativeStatus = computeAuthoritativeOrderStatus(
      o.order_status,
      totalOrderedUnits,
      totalShippedUnits,
      totalCancelledUnits
    );

    const invoices = (o.retailer_invoices || []).map((inv: any) => ({
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      invoiceDate: inv.invoice_date,
      dueDate: inv.due_date,
      totalAmount: Number(inv.total_amount || 0),
      amountPaid: Number(inv.amount_paid || 0),
      balanceDue: Number(inv.balance_due || 0),
      invoiceStatus: inv.invoice_status,
      paymentStatus: inv.payment_status,
      termsName: inv.terms_name || "Net 30",
      fulfillmentId: inv.fulfillment_id || null,
      fulfillmentNumber: inv.fulfillment_number || null,
      prepaymentAllocatedAmount: Number(inv.prepayment_allocated_amount || 0),
    }));

    const fulfillments = o.retailer_order_fulfillments || [];
    const dispatchCount = fulfillments.length;

    // Map dispatches with canonical multi-box and legacy fallback evaluation
    const dispatches = fulfillments.map((f: any) => {
      const rawBoxes = f.retailer_order_fulfillment_boxes || [];
      const mappedBoxes: AdminOrderBox[] =
        rawBoxes.length > 0
          ? rawBoxes.map((b: any) => ({
              id: b.id,
              fulfillmentId: f.id,
              orderId: o.id,
              boxNumber: b.box_number || 1,
              boxTotal: b.box_total || rawBoxes.length || 1,
              carrier: b.carrier || f.carrier || "ups",
              trackingNumber: b.tracking_number || null,
              trackingUrl: resolveCarrierTrackingUrl(b.carrier || f.carrier, b.tracking_number),
              weightLbs: b.weight_lbs ?? null,
              dimensionsInch: b.dimensions_inch ?? null,
              status: b.status || "active",
              notes: b.notes || null,
              createdAt: b.created_at || f.created_at,
            }))
          : f.tracking_number
          ? [
              {
                id: `legacy-${f.id}`,
                fulfillmentId: f.id,
                orderId: o.id,
                boxNumber: 1,
                boxTotal: 1,
                carrier: f.carrier || "ups",
                trackingNumber: f.tracking_number,
                trackingUrl: resolveCarrierTrackingUrl(f.carrier, f.tracking_number),
                status: "active" as const,
                notes: null,
                createdAt: f.created_at,
              },
            ]
          : [];

      const activeBoxes = mappedBoxes.filter((b) => b.status === "active");
      const isTrackingComplete =
        f.status === "cancelled" ||
        (activeBoxes.length > 0
          ? activeBoxes.every((b) => Boolean(b.trackingNumber && b.trackingNumber.trim()))
          : Boolean(f.tracking_number && f.tracking_number.trim()));

      return {
        id: f.id,
        fulfillmentNumber: f.fulfillment_number,
        status: f.status,
        carrier: f.carrier,
        trackingNumber: f.tracking_number,
        trackingUrl: resolveCarrierTrackingUrl(f.carrier, f.tracking_number),
        boxCount: activeBoxes.length > 0 ? activeBoxes.length : Number(f.box_count || 1),
        shippedAt: f.shipped_at,
        notes: f.notes,
        createdAt: f.created_at,
        boxes: mappedBoxes,
        isTrackingComplete,
      };
    });

    const hasConfirmedDispatch = dispatches.some((d: any) => d.status !== "cancelled");
    const untrackedDispatchesCount = dispatches.filter(
      (d: any) => d.status !== "cancelled" && !d.isTrackingComplete
    ).length;
    const hasMissingTracking = untrackedDispatchesCount > 0;

    // Synthesize fallback packages if packagesMap is empty
    let finalPackages = pkgs;
    if (finalPackages.length === 0 && dispatches.length > 0) {
      const synthPkgs: AdminOrderPackage[] = [];
      dispatches
        .filter((d: any) => d.status !== "cancelled")
        .forEach((d: any) => {
          const activeBoxes = d.boxes.filter((b: any) => b.status === "active");
          if (activeBoxes.length > 0) {
            activeBoxes.forEach((b: any, idx: number, arr: any[]) => {
              synthPkgs.push({
                id: b.id,
                fulfillmentId: d.id,
                orderId: o.id,
                boxNumber: b.boxNumber || idx + 1,
                boxTotal: b.boxTotal || arr.length,
                carrier: b.carrier || d.carrier || "ups",
                trackingNumber: b.trackingNumber || "",
                trackingUrl: b.trackingUrl || resolveCarrierTrackingUrl(b.carrier || d.carrier, b.trackingNumber),
                weightLbs: b.weightLbs ?? null,
                dimensionsInch: b.dimensionsInch ?? null,
                packageItems: [],
                createdAt: b.createdAt || d.createdAt,
              });
            });
          } else if (d.trackingNumber) {
            synthPkgs.push({
              id: `legacy-pkg-${d.id}`,
              fulfillmentId: d.id,
              orderId: o.id,
              boxNumber: 1,
              boxTotal: 1,
              carrier: d.carrier || "ups",
              trackingNumber: d.trackingNumber,
              trackingUrl: d.trackingUrl,
              weightLbs: null,
              dimensionsInch: null,
              packageItems: [],
              createdAt: d.createdAt,
            });
          }
        });
      if (synthPkgs.length > 0) {
        finalPackages = synthPkgs;
      }
    }
    const totalBoxCount = finalPackages.length;

    const isCompleted = isOrderOperationallyCompleted({
      orderStatus: authoritativeStatus,
      totalOrderedUnits,
      totalShippedUnits,
      totalCancelledUnits,
      totalRemainingUnits,
    });
    const daysOpen = isCompleted ? null : calculateDaysOpenNumber(o.created_at);

    // Derive actionable warehouse priority
    let actionRequired: "new_order" | "ready_to_ship" | "hold_cancellation" | "tracking_needed" | "completed" | "none" = "none";
    if (Boolean(o.cancellation_requested)) {
      actionRequired = "hold_cancellation";
    } else if (hasMissingTracking) {
      actionRequired = "tracking_needed";
    } else if (authoritativeStatus === "submitted") {
      actionRequired = "new_order";
    } else if (["submitted", "processing", "partially_shipped"].includes(authoritativeStatus) && totalRemainingUnits > 0) {
      actionRequired = "ready_to_ship";
    } else if (isCompleted) {
      actionRequired = "completed";
    }

    // Determine latest activity timestamp
    const activityTimestamps = [
      o.created_at,
      o.updated_at,
      ...fulfillments.map((f: any) => f.shipped_at || f.created_at).filter(Boolean),
    ];
    const lastActivityAt = activityTimestamps.sort().reverse()[0] || o.updated_at || o.created_at;

    return {
      id: o.id,
      orderNumber: o.order_number,
      companyId: o.company_id,
      companyName: o.companies?.name || "Retailer Partner",
      companyCode: o.companies?.company_code || null,
      storeId: o.store_id,
      storeName: o.stores?.name || "Direct Store",
      destinationLabel: o.stores?.name || o.recipient_name || "Delivery Destination",
      destinationType: o.shipping_destination_type || "store",
      shippingCity: o.shipping_city || o.stores?.city || null,
      shippingState: o.shipping_state || o.stores?.state || null,
      orderStatus: authoritativeStatus,
      paymentStatus: o.payment_status || "unpaid",
      paymentMethod: o.payment_terms ? "terms" : "standard",
      paymentTerms: o.payment_terms || "Net 30",
      totalAmount: Number(o.total_amount || 0),
      subtotalAmount: Number(o.subtotal_amount || 0),
      discountAmount: Number(o.discount_amount || 0),
      couponCode: o.coupon_code || null,
      totalSkusCount: Number(o.total_skus_count || items.length || 0),
      totalOrderedUnits,
      totalShippedUnits,
      totalCancelledUnits,
      totalRemainingUnits,
      totalBoxCount,
      packages: finalPackages,
      dispatches,
      untrackedDispatchesCount,
      hasConfirmedDispatch,
      daysOpen,
      isCompleted,
      invoices,
      dispatchCount,
      hasMissingTracking,
      actionRequired,
      lastActivityAt,
      cancellationRequested: Boolean(o.cancellation_requested),
      refundAmount: Number(o.refund_amount || 0),
      refundStatus: o.refund_status || "none",
      isTest: Boolean(o.is_test),
      createdAt: o.created_at,
      updatedAt: o.updated_at,
    };
  });

  // Calculate live summary counters across all mapped orders
  const summaryCounters: AdminOrderSummaryCounters = {
    total: mappedOrders.length,
    newOrders: 0,
    readyToProcess: 0,
    partiallyShipped: 0,
    onHold: 0,
    trackingMissing: 0,
    completed: 0,
  };

  mappedOrders.forEach((ord) => {
    if (ord.orderStatus === "submitted") summaryCounters.newOrders++;
    if (
      ["submitted", "processing", "partially_shipped"].includes(ord.orderStatus) &&
      ord.totalRemainingUnits > 0 &&
      !ord.cancellationRequested
    ) {
      summaryCounters.readyToProcess++;
    }
    if (ord.orderStatus === "partially_shipped") summaryCounters.partiallyShipped++;
    if (ord.cancellationRequested) summaryCounters.onHold++;
    if (ord.hasMissingTracking) summaryCounters.trackingMissing++;
    if (ord.isCompleted) {
      summaryCounters.completed++;
    }
  });

  // Apply filters
  let filtered = mappedOrders;

  // Test mode filter
  if (filters?.testMode && filters.testMode !== "all") {
    if (filters.testMode === "live") {
      filtered = filtered.filter((o) => !o.isTest);
    } else if (filters.testMode === "test") {
      filtered = filtered.filter((o) => o.isTest);
    }
  }

  // Quick Filter Tabs
  if (filters?.quickFilter && filters.quickFilter !== "all") {
    switch (filters.quickFilter) {
      case "new":
        filtered = filtered.filter((o) => o.orderStatus === "submitted");
        break;
      case "ready":
        filtered = filtered.filter(
          (o) =>
            ["submitted", "processing", "partially_shipped"].includes(o.orderStatus) &&
            o.totalRemainingUnits > 0 &&
            !o.cancellationRequested
        );
        break;
      case "partially_shipped":
        filtered = filtered.filter((o) => o.orderStatus === "partially_shipped");
        break;
      case "on_hold":
        filtered = filtered.filter((o) => o.cancellationRequested);
        break;
      case "tracking_missing":
        filtered = filtered.filter((o) => o.hasMissingTracking);
        break;
      case "completed":
        filtered = filtered.filter((o) => o.isCompleted);
        break;
    }
  }

  // Multi-Select Status Filter
  let filterStatuses: string[] = [];
  if (filters?.status && filters.status !== "all") {
    if (Array.isArray(filters.status)) {
      filterStatuses = filters.status.map((s) => s.trim().toLowerCase());
    } else {
      filterStatuses = filters.status
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    }
  }
  if (filterStatuses.length > 0 && !filterStatuses.includes("all")) {
    filtered = filtered.filter((ord) => filterStatuses.includes(ord.orderStatus.toLowerCase()));
  }

  // Date Presets & Custom Ranges
  if (filters?.startDate || filters?.endDate) {
    if (filters.startDate) {
      const startMs = new Date(`${filters.startDate}T00:00:00.000Z`).getTime();
      filtered = filtered.filter((ord) => new Date(ord.createdAt).getTime() >= startMs);
    }
    if (filters.endDate) {
      const endMs = new Date(`${filters.endDate}T23:59:59.999Z`).getTime();
      filtered = filtered.filter((ord) => new Date(ord.createdAt).getTime() <= endMs);
    }
  } else if (filters?.datePreset && filters.datePreset !== "all") {
    const now = new Date();
    if (filters.datePreset === "today") {
      const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();
      filtered = filtered.filter((ord) => new Date(ord.createdAt).getTime() >= todayStart);
    } else if (filters.datePreset === "7d") {
      const past7d = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((ord) => new Date(ord.createdAt).getTime() >= past7d);
    } else if (filters.datePreset === "30d") {
      const past30d = now.getTime() - 30 * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((ord) => new Date(ord.createdAt).getTime() >= past30d);
    }
  }

  // Free-form Search (Order #, Company, Store, Destination, City, State, Recipient)
  if (filters?.search && filters.search.trim()) {
    const term = filters.search.trim().toLowerCase();
    filtered = filtered.filter((ord) => {
      const basicMatch =
        ord.orderNumber.toLowerCase().includes(term) ||
        ord.companyName.toLowerCase().includes(term) ||
        ord.storeName.toLowerCase().includes(term) ||
        ord.destinationLabel.toLowerCase().includes(term) ||
        (ord.shippingCity && ord.shippingCity.toLowerCase().includes(term)) ||
        (ord.shippingState && ord.shippingState.toLowerCase().includes(term));

      if (basicMatch) return true;

      // Match item SKUs or product names
      const raw = rawOrders.find((r: any) => r.id === ord.id);
      return (raw?.retailer_order_items || []).some(
        (it: any) =>
          it.sku?.toLowerCase().includes(term) ||
          it.product_name?.toLowerCase().includes(term)
      );
    });
  }

  // SKU Filter
  if (filters?.sku && filters.sku.trim()) {
    const sTerm = filters.sku.trim().toLowerCase();
    filtered = filtered.filter((ord) => {
      const raw = rawOrders.find((r: any) => r.id === ord.id);
      return (raw?.retailer_order_items || []).some(
        (it: any) =>
          it.sku?.toLowerCase().includes(sTerm) ||
          it.product_name?.toLowerCase().includes(sTerm)
      );
    });
  }

  // Sorting
  const sortBy = filters?.sortBy || "created_at";
  const sortDirection = filters?.sortDirection || "desc";
  const sortMultiplier = sortDirection === "asc" ? 1 : -1;

  filtered.sort((a, b) => {
    switch (sortBy) {
      case "order_number":
        return a.orderNumber.localeCompare(b.orderNumber) * sortMultiplier;
      case "retailer":
        return a.companyName.localeCompare(b.companyName) * sortMultiplier;
      case "remaining":
        return (a.totalRemainingUnits - b.totalRemainingUnits) * sortMultiplier;
      case "days_open": {
        const aVal = a.daysOpen !== null ? a.daysOpen : -1;
        const bVal = b.daysOpen !== null ? b.daysOpen : -1;
        return (aVal - bVal) * sortMultiplier;
      }
      case "total":
        return (a.totalAmount - b.totalAmount) * sortMultiplier;
      case "updated_at":
        return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * sortMultiplier;
      case "created_at":
      default:
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortMultiplier;
    }
  });

  const totalFilteredCount = filtered.length;

  // Pagination
  let paginatedOrders = filtered;
  if (filters?.pageSize && filters.pageSize > 0) {
    const page = Math.max(1, filters.page || 1);
    const pageSize = filters.pageSize;
    const startIndex = (page - 1) * pageSize;
    paginatedOrders = filtered.slice(startIndex, startIndex + pageSize);
  }

  return {
    orders: paginatedOrders,
    totalCount: totalFilteredCount,
    summaryCounters,
    companies,
    stores,
  };
}

/**
 * Fetch Full Detail for a single Retailer Order in Admin Interface
 */
export async function getAdminRetailerOrderDetailAction(
  orderId: string
): Promise<AdminRetailerOrderDetail | null> {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  const { data: o, error } = await adminClient
    .from("retailer_orders")
    .select(`
      *,
      companies (
        id,
        name,
        company_code
      ),
      stores (
        id,
        name,
        address,
        city,
        state,
        zip,
        phone
      ),
      retailer_order_items (
        id,
        order_id,
        product_id,
        sku,
        product_name,
        brand_name,
        unit_wholesale_price,
        unit_msrp,
        quantity,
        case_pack_qty,
        line_total
      ),
      retailer_invoices (
        id,
        invoice_number,
        invoice_date,
        due_date,
        total_amount,
        amount_paid,
        balance_due,
        invoice_status,
        payment_status,
        terms_name
      )
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (error || !o) {
    console.error("getAdminRetailerOrderDetailAction error:", error);
    return null;
  }

  // Fetch Fulfillments with items
  const { data: rawFulfillments } = await adminClient
    .from("retailer_order_fulfillments")
    .select(`
      *,
      retailer_order_fulfillment_items (
        id,
        fulfillment_id,
        order_item_id,
        product_id,
        quantity_shipped,
        quantity_delivered
      )
    `)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  // Fetch Boxes from canonical Phase B2 table
  const boxes: AdminOrderBox[] = [];
  try {
    const { data: rawBoxes, error: boxErr } = await adminClient
      .from("retailer_order_fulfillment_boxes")
      .select("*")
      .eq("order_id", orderId)
      .neq("status", "void")
      .order("box_number", { ascending: true });

    if (!boxErr && rawBoxes && rawBoxes.length > 0) {
      rawBoxes.forEach((b: any) => {
        boxes.push({
          id: b.id,
          fulfillmentId: b.fulfillment_id,
          orderId: b.order_id,
          boxNumber: b.box_number,
          boxTotal: b.box_total || 1,
          carrier: b.carrier,
          trackingNumber: b.tracking_number,
          trackingUrl: resolveCarrierTrackingUrl(b.carrier, b.tracking_number, b.tracking_url),
          weightLbs: b.weight_lbs,
          dimensionsInch: b.dimensions_inch,
          status: b.status,
          notes: b.notes,
          createdAt: b.created_at,
        });
      });
    }
  } catch (bEx) {
    console.warn("Could not query fulfillment boxes:", bEx);
  }

  // Fetch Packages (fallback or parallel)
  const { data: rawPackages } = await adminClient
    .from("retailer_order_packages")
    .select("*")
    .eq("order_id", orderId)
    .order("box_number", { ascending: true });

  const packages: AdminOrderPackage[] = (rawPackages || []).map((p: any) => ({
    id: p.id,
    fulfillmentId: p.fulfillment_id,
    orderId: p.order_id,
    boxNumber: p.box_number,
    boxTotal: p.box_total,
    carrier: p.carrier,
    trackingNumber: p.tracking_number,
    trackingUrl: resolveCarrierTrackingUrl(p.carrier, p.tracking_number, p.tracking_url),
    weightLbs: p.weight_lbs,
    dimensionsInch: p.dimensions_inch,
    packageItems: p.package_items || [],
    createdAt: p.created_at,
  }));

  const items: AdminOrderLineItem[] = (o.retailer_order_items || []).map((it: any) => {
    const qtyOrdered = Number(it.quantity || 0);
    const fulfilledShipped = (rawFulfillments || [])
      .filter((f: any) => f.status === "shipped" || f.status === "delivered")
      .reduce((sum: number, f: any) => {
        const fItem = (f.retailer_order_fulfillment_items || []).find((fi: any) => fi.order_item_id === it.id);
        return sum + Number(fItem?.quantity_shipped || 0);
      }, 0);
    const hasFulfillments = (rawFulfillments || []).length > 0;
    const isLegacyShipped = ["shipped", "delivered"].includes((o.order_status || "").toLowerCase());
    const qtyShipped = Number(
      hasFulfillments
        ? fulfilledShipped
        : (it.quantity_shipped || (isLegacyShipped ? qtyOrdered : 0))
    );
    const qtyCancelled = Number(
      it.quantity_cancelled || (["cancelled"].includes(o.order_status) ? qtyOrdered : 0)
    );
    const qtyRemaining = Math.max(0, qtyOrdered - qtyShipped - qtyCancelled);

    return {
      id: it.id,
      orderId: it.order_id,
      productId: it.product_id,
      sku: it.sku,
      productName: it.product_name,
      brandName: it.brand_name || "Brand",
      unitWholesalePrice: Number(it.unit_wholesale_price || 0),
      unitMsrp: it.unit_msrp ? Number(it.unit_msrp) : null,
      quantityOrdered: qtyOrdered,
      quantityShipped: qtyShipped,
      quantityCancelled: qtyCancelled,
      quantityRemaining: qtyRemaining,
      casePackQty: Number(it.case_pack_qty || 1),
      lineTotal: Number(it.line_total || 0),
      cancellationReason: it.cancellation_reason,
      cancelledAt: it.cancelled_at,
    };
  });

  const totalOrderedUnits = items.reduce((sum, it) => sum + it.quantityOrdered, 0);
  const totalShippedUnits = items.reduce((sum, it) => sum + it.quantityShipped, 0);
  const totalCancelledUnits = items.reduce((sum, it) => sum + it.quantityCancelled, 0);
  const totalRemainingUnits = Math.max(0, totalOrderedUnits - totalShippedUnits - totalCancelledUnits);

  const shipments: AdminOrderShipment[] = (rawFulfillments || []).map((f: any) => {
    const fBoxes = boxes.filter((b) => b.fulfillmentId === f.id);
    const fPackages = packages.filter((p) => p.fulfillmentId === f.id);

    const finalBoxes: AdminOrderBox[] = fBoxes.length > 0
      ? fBoxes
      : fPackages.length > 0
      ? fPackages.map((p) => ({
          id: p.id,
          fulfillmentId: p.fulfillmentId,
          orderId: p.orderId,
          boxNumber: p.boxNumber,
          boxTotal: p.boxTotal || 1,
          carrier: p.carrier,
          trackingNumber: p.trackingNumber,
          trackingUrl: p.trackingUrl,
          weightLbs: p.weightLbs,
          dimensionsInch: p.dimensionsInch,
          status: "active" as const,
          notes: null,
          createdAt: p.createdAt,
        }))
      : f.tracking_number
      ? [
          {
            id: `legacy-${f.id}`,
            fulfillmentId: f.id,
            orderId: f.order_id,
            boxNumber: 1,
            boxTotal: 1,
            carrier: f.carrier || "Standard Freight",
            trackingNumber: f.tracking_number,
            trackingUrl: resolveCarrierTrackingUrl(f.carrier, f.tracking_number, f.tracking_url),
            status: "active" as const,
            notes: null,
            createdAt: f.created_at,
          },
        ]
      : [];

    return {
      id: f.id,
      fulfillmentNumber: f.fulfillment_number,
      orderId: f.order_id,
      companyId: f.company_id,
      storeId: f.store_id,
      status: f.status,
      carrier: f.carrier,
      trackingNumber: f.tracking_number,
      trackingUrl: resolveCarrierTrackingUrl(f.carrier, f.tracking_number, f.tracking_url),
      boxCount: finalBoxes.length > 0 ? finalBoxes.length : Number(f.box_count || fPackages.length || 1),
      shippedAt: f.shipped_at,
      deliveredAt: f.delivered_at,
      notes: f.notes,
      createdAt: f.created_at,
      items: (f.retailer_order_fulfillment_items || []).map((fit: any) => {
        const matchItem = items.find((i) => i.id === fit.order_item_id);
        return {
          id: fit.id,
          fulfillmentId: fit.fulfillment_id,
          orderItemId: fit.order_item_id,
          productId: fit.product_id,
          sku: matchItem?.sku || "SKU",
          productName: matchItem?.productName || "Product",
          quantityShipped: Number(fit.quantity_shipped || 0),
          quantityDelivered: Number(fit.quantity_delivered || 0),
        };
      }),
      packages: fPackages,
      boxes: finalBoxes,
    };
  });

  const authoritativeStatus = computeAuthoritativeOrderStatus(
    o.order_status,
    totalOrderedUnits,
    totalShippedUnits,
    totalCancelledUnits
  );

  const invoices = (o.retailer_invoices || []).map((inv: any) => ({
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    invoiceDate: inv.invoice_date,
    dueDate: inv.due_date,
    totalAmount: Number(inv.total_amount || 0),
    amountPaid: Number(inv.amount_paid || 0),
    balanceDue: ["void", "cancelled"].includes((inv.invoice_status || "").toLowerCase()) ? 0.0 : Number(inv.balance_due || 0),
    invoiceStatus: inv.invoice_status,
    paymentStatus: inv.payment_status,
    termsName: inv.terms_name || "Net 30",
    fulfillmentId: inv.fulfillment_id || null,
    fulfillmentNumber: inv.fulfillment_number || null,
    prepaymentAllocatedAmount: Number(inv.prepayment_allocated_amount || 0),
  }));

  const dispatches: AdminOrderDispatchSummary[] = shipments.map((s) => ({
    id: s.id,
    fulfillmentNumber: s.fulfillmentNumber,
    status: s.status,
    carrier: s.carrier,
    trackingNumber: s.trackingNumber,
    trackingUrl: s.trackingUrl,
    boxCount: s.boxCount,
    shippedAt: s.shippedAt,
    notes: s.notes,
    createdAt: s.createdAt,
    boxes: s.boxes,
    isTrackingComplete:
      s.status === "cancelled" ||
      (s.boxes.length > 0
        ? s.boxes.filter((b) => b.status === "active").length > 0 &&
          s.boxes.filter((b) => b.status === "active").every((b) => Boolean(b.trackingNumber && b.trackingNumber.trim()))
        : Boolean(s.trackingNumber && s.trackingNumber.trim())),
  }));
  const hasConfirmedDispatch = dispatches.some((d) => d.status !== "cancelled");
  const untrackedDispatchesCount = dispatches.filter((d) => d.status !== "cancelled" && !d.isTrackingComplete).length;
  const isCompleted = isOrderOperationallyCompleted({
    orderStatus: authoritativeStatus,
    totalOrderedUnits,
    totalShippedUnits,
    totalCancelledUnits,
    totalRemainingUnits,
  });
  const daysOpen = isCompleted ? null : calculateDaysOpenNumber(o.created_at);

  return {
    id: o.id,
    orderNumber: o.order_number,
    companyId: o.company_id,
    companyName: o.companies?.name || "Retailer Partner",
    companyCode: o.companies?.company_code || null,
    storeId: o.store_id,
    storeName: o.stores?.name || "Store Destination",
    destinationLabel: o.stores?.name || o.recipient_name || "Destination",
    destinationType: o.shipping_destination_type || "store",
    orderStatus: authoritativeStatus,
    paymentStatus: o.payment_status || "unpaid",
    paymentMethod: o.payment_terms ? "terms" : "standard",
    paymentTerms: o.payment_terms || "Net 30",
    totalAmount: Number(o.total_amount || 0),
    subtotalAmount: Number(o.subtotal_amount || 0),
    discountAmount: Number(o.discount_amount || 0),
    couponCode: o.coupon_code || null,
    taxAmount: Number(o.tax_amount || 0),
    shippingAmount: Number(o.shipping_amount || 0),
    processingFee: Number(o.processing_fee || 0),
    totalSkusCount: Number(o.total_skus_count || items.length || 0),
    totalOrderedUnits,
    totalShippedUnits,
    totalCancelledUnits,
    totalRemainingUnits,
    totalBoxCount: packages.length || shipments.reduce((s, sh) => s + sh.boxCount, 0),
    shippingAddress: o.shipping_address,
    shippingAddressLine2: o.shipping_address_line2,
    shippingCity: o.shipping_city,
    shippingState: o.shipping_state,
    shippingZip: o.shipping_zip,
    shippingPhone: o.shipping_phone,
    recipientName: o.recipient_name,
    shippingNotes: o.notes,
    cancellationRequested: Boolean(o.cancellation_requested),
    cancellationNotes: o.cancellation_notes,
    refundAmount: Number(o.refund_amount || 0),
    refundStatus: o.refund_status || "none",
    refundedAt: o.refunded_at,
    isTest: Boolean(o.is_test),
    dispatches,
    untrackedDispatchesCount,
    hasConfirmedDispatch,
    daysOpen,
    isCompleted,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    items,
    shipments,
    packages,
    invoices,
  };
}

/**
 * Admin Action: Create a new multi-box dispatch shipment
 */
export async function adminCreateShipmentWithPackagesAction(params: {
  orderId: string;
  carrier: string;
  trackingNumber: string;
  notes?: string;
  markAsShipped: boolean;
  items: Array<{ orderItemId: string; productId: string; quantityShipped: number }>;
  packages?: Array<{
    boxNumber: number;
    carrier: string;
    trackingNumber: string;
    weightLbs?: number;
    dimensionsInch?: string;
    items?: Array<{ orderItemId: string; sku: string; productName: string; quantity: number }>;
  }>;
}): Promise<{ success: boolean; fulfillmentId?: string; error?: string }> {
  try {
    const session = await verifyAdminSession();
    const adminClient = createAdminClient();

    const { data: order, error: orderErr } = await adminClient
      .from("retailer_orders")
      .select("id, company_id, store_id, order_status, cancellation_requested")
      .eq("id", params.orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return { success: false, error: "Order not found." };
    }

    // Guard: Prevent shipment creation if cancellation request is currently pending review
    if (order.cancellation_requested) {
      return {
        success: false,
        error: "Cannot create shipment: A cancellation request is currently pending Admin review for this order. Please resolve the cancellation request before creating shipments.",
      };
    }

    // Guard: Prevent shipment creation if order is terminal (shipped, delivered, or cancelled)
    const orderStatusNorm = (order.order_status || "").toLowerCase();
    if (["cancelled", "shipped", "delivered"].includes(orderStatusNorm)) {
      return {
        success: false,
        error: `Cannot create shipment: Order is already ${order.order_status}.`,
      };
    }

    // Guard: Verify line items exist and calculate remaining shippable units
    const validItems = (params.items || []).filter((it) => it.quantityShipped > 0);
    if (validItems.length === 0) {
      return { success: false, error: "Please specify at least 1 unit to ship." };
    }

    const { data: dbItems, error: itemsErr } = await adminClient
      .from("retailer_order_items")
      .select("id, quantity, quantity_shipped, quantity_cancelled")
      .eq("order_id", params.orderId);

    if (itemsErr || !dbItems || dbItems.length === 0) {
      return { success: false, error: "Order line items not found." };
    }

    const dbItemMap = new Map(dbItems.map((it: any) => [it.id, it]));
    for (const it of validItems) {
      const dbItem = dbItemMap.get(it.orderItemId);
      if (!dbItem) {
        return { success: false, error: `Invalid line item: ${it.orderItemId}` };
      }
      const remainingForLine = Math.max(
        0,
        Number(dbItem.quantity || 0) -
          Number(dbItem.quantity_shipped || 0) -
          Number(dbItem.quantity_cancelled || 0)
      );
      if (it.quantityShipped > remainingForLine) {
        return {
          success: false,
          error: `Cannot ship ${it.quantityShipped} units. Only ${remainingForLine} remaining to ship for line item.`,
        };
      }
    }

    const { data: numData } = await adminClient.rpc("generate_retailer_fulfillment_number");
    const fulfillmentNumber = numData || `KSF-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    const isShipped = Boolean(params.markAsShipped);
    const boxCount = params.packages && params.packages.length > 0 ? params.packages.length : 1;

    // 1. Create fulfillment header
    const { data: newFulfillment, error: fulErr } = await adminClient
      .from("retailer_order_fulfillments")
      .insert({
        fulfillment_number: fulfillmentNumber,
        order_id: params.orderId,
        company_id: order.company_id,
        store_id: order.store_id || "00000000-0000-0000-0000-000000000000",
        status: isShipped ? "shipped" : "processing",
        carrier: params.carrier.trim(),
        tracking_number: params.trackingNumber.trim(),
        tracking_url: resolveCarrierTrackingUrl(params.carrier, params.trackingNumber),
        box_count: boxCount,
        shipped_at: isShipped ? new Date().toISOString() : null,
        shipped_by: isShipped ? session.userId : null,
        notes: params.notes?.trim() || null,
        created_by: session.userId,
      })
      .select("id")
      .single();

    if (fulErr || !newFulfillment) {
      console.error("Insert fulfillment failed:", fulErr);
      return { success: false, error: fulErr?.message || "Failed to create shipment record." };
    }

    // 2. Insert fulfillment line items
    if (validItems.length > 0) {
      await adminClient.from("retailer_order_fulfillment_items").insert(
        validItems.map((it) => ({
          fulfillment_id: newFulfillment.id,
          order_item_id: it.orderItemId,
          product_id: it.productId,
          quantity_shipped: it.quantityShipped,
          quantity_delivered: 0,
        }))
      );

      // Update quantity_shipped on retailer_order_items ONLY when actually marked as shipped (confirmed dispatch)
      if (isShipped) {
        for (const it of validItems) {
          const { data: curItem } = await adminClient
            .from("retailer_order_items")
            .select("quantity_shipped")
            .eq("id", it.orderItemId)
            .single();

          const curShipped = Number(curItem?.quantity_shipped || 0);
          await adminClient
            .from("retailer_order_items")
            .update({ quantity_shipped: curShipped + it.quantityShipped })
            .eq("id", it.orderItemId);
        }
      }
    }

    // 3. Insert individual fulfillment boxes (canonical Phase B2 table)
    const boxesToInsert = (params.packages && params.packages.length > 0)
      ? params.packages.map((pkg, idx) => ({
          fulfillment_id: newFulfillment.id,
          order_id: params.orderId,
          box_number: pkg.boxNumber || idx + 1,
          box_total: boxCount,
          carrier: pkg.carrier || params.carrier,
          tracking_number: pkg.trackingNumber?.trim() || null,
          tracking_url: resolveCarrierTrackingUrl(pkg.carrier || params.carrier, pkg.trackingNumber),
          weight_lbs: pkg.weightLbs || null,
          dimensions_inch: pkg.dimensionsInch || null,
          notes: null,
          status: "active",
        }))
      : [
          {
            fulfillment_id: newFulfillment.id,
            order_id: params.orderId,
            box_number: 1,
            box_total: 1,
            carrier: params.carrier,
            tracking_number: params.trackingNumber?.trim() || null,
            tracking_url: resolveCarrierTrackingUrl(params.carrier, params.trackingNumber),
            weight_lbs: null,
            dimensions_inch: null,
            notes: null,
            status: "active",
          },
        ];

    try {
      await adminClient.from("retailer_order_fulfillment_boxes").insert(boxesToInsert);
    } catch (boxErr) {
      console.warn("Could not insert retailer_order_fulfillment_boxes:", boxErr);
    }

    // Also sync to legacy retailer_order_packages for backwards compatibility
    try {
      const packageRows = boxesToInsert.map((b) => ({
        fulfillment_id: newFulfillment.id,
        order_id: params.orderId,
        box_number: b.box_number,
        box_total: b.box_total,
        carrier: b.carrier,
        tracking_number: b.tracking_number,
        tracking_url: b.tracking_url,
        weight_lbs: b.weight_lbs,
        dimensions_inch: b.dimensions_inch,
        package_items: validItems.map((it) => ({
          orderItemId: it.orderItemId,
          sku: "SKU",
          productName: "Products",
          quantity: it.quantityShipped,
        })),
      }));
      await adminClient.from("retailer_order_packages").insert(packageRows);
    } catch (pkgErr) {
      console.warn("Could not insert retailer_order_packages:", pkgErr);
    }

    // 4. Update parent order status
    if (isShipped) {
      // Re-evaluate remaining
      const detail = await getAdminRetailerOrderDetailAction(params.orderId);
      const nextStatus = detail?.totalRemainingUnits === 0 ? "shipped" : "partially_shipped";
      await adminClient
        .from("retailer_orders")
        .update({
          order_status: nextStatus,
          total_shipped_units: detail?.totalShippedUnits || 0,
          total_remaining_units: detail?.totalRemainingUnits || 0,
          updated_at: new Date().toISOString()
        })
        .eq("id", params.orderId);

      // Phase B3: Issue authoritative dispatch invoice upon confirmed dispatch
      const { createDispatchInvoice } = await import("@/lib/finance/dispatch-invoicing");
      const invRes = await createDispatchInvoice(adminClient, newFulfillment.id);
      if (!invRes.success) {
        console.error("Critical: Dispatch invoice creation failed. Rolling back created shipment:", invRes.error);
        try {
          await adminClient.from("retailer_order_fulfillment_boxes").delete().eq("fulfillment_id", newFulfillment.id);
        } catch (_) {}
        await adminClient.from("retailer_order_packages").delete().eq("fulfillment_id", newFulfillment.id);
        await adminClient.from("retailer_order_fulfillment_items").delete().eq("fulfillment_id", newFulfillment.id);
        await adminClient.from("retailer_order_fulfillments").delete().eq("id", newFulfillment.id);
        for (const it of validItems) {
          const { data: curItem } = await adminClient
            .from("retailer_order_items")
            .select("quantity_shipped")
            .eq("id", it.orderItemId)
            .single();
          const curShipped = Number(curItem?.quantity_shipped || 0);
          await adminClient
            .from("retailer_order_items")
            .update({ quantity_shipped: Math.max(0, curShipped - it.quantityShipped) })
            .eq("id", it.orderItemId);
        }
        await adminClient
          .from("retailer_orders")
          .update({ order_status: order.order_status, updated_at: new Date().toISOString() })
          .eq("id", params.orderId);

        return {
          success: false,
          error: `Shipment dispatch aborted: failed to issue required dispatch invoice (${invRes.error}). Shipment creation was rolled back.`,
        };
      }
    } else {
      await adminClient
        .from("retailer_orders")
        .update({ order_status: "processing", updated_at: new Date().toISOString() })
        .eq("id", params.orderId);
    }

    revalidatePath("/admin/sales/orders");
    revalidatePath(`/admin/sales/orders/${params.orderId}`);
    revalidatePath("/admin/finance/receivables");
    revalidatePath("/orders");
    revalidatePath(`/orders/${params.orderId}`);
    revalidatePath("/bills");

    return { success: true, fulfillmentId: newFulfillment.id };
  } catch (err: any) {
    console.error("adminCreateShipmentWithPackagesAction error:", err);
    return { success: false, error: err.message || "Failed to create shipment." };
  }
}

/**
 * Admin Action: Update status directly (e.g. Cancel Order, Mark Processing)
 * If setting to 'cancelled', atomically cancels all remaining unshipped line items.
 */
export async function adminUpdateOrderStatusAction(
  orderId: string,
  newStatus: ApprovedOrderStatus,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    const { data: order, error: orderErr } = await adminClient
      .from("retailer_orders")
      .select("id, total_ordered_units, total_shipped_units, total_cancelled_units, retailer_order_items(id, quantity, quantity_shipped, quantity_cancelled)")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return { success: false, error: "Order not found." };
    }

    const now = new Date().toISOString();

    if (newStatus === "cancelled") {
      // Guard: Cannot cancel if any units were already shipped
      const items = order.retailer_order_items || [];
      const totalShipped = items.reduce((sum: number, it: any) => sum + Number(it.quantity_shipped || 0), 0);
      if (totalShipped > 0) {
        return {
          success: false,
          error: "Cannot cancel order completely because some units have already been shipped. Please cancel remaining units instead.",
        };
      }

      // Mark all items as 100% cancelled
      for (const it of items) {
        await adminClient
          .from("retailer_order_items")
          .update({
            quantity_cancelled: it.quantity,
            cancellation_reason: notes?.trim() || "Cancelled by Admin",
            cancelled_at: now,
          })
          .eq("id", it.id);
      }

      const totalOrdered = items.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0) || order.total_ordered_units;

      await adminClient
        .from("retailer_orders")
        .update({
          order_status: "cancelled",
          total_cancelled_units: totalOrdered,
          total_remaining_units: 0,
          notes: notes ? notes.trim() : undefined,
          updated_at: now,
        })
        .eq("id", orderId);
    } else {
      await adminClient
        .from("retailer_orders")
        .update({
          order_status: newStatus,
          notes: notes ? notes.trim() : undefined,
          updated_at: now,
        })
        .eq("id", orderId);
    }

    revalidatePath("/admin/sales/orders");
    revalidatePath(`/admin/sales/orders/${orderId}`);
    revalidatePath("/orders");
    revalidatePath(`/orders/${orderId}`);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Admin Action: Partially or fully cancel an order line item
 * Atomically updates quantity_cancelled on line item and order header totals.
 */
export async function adminCancelOrderLineAction(params: {
  orderId: string;
  orderItemId: string;
  quantityToCancel: number;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    const { data: item, error: itemErr } = await adminClient
      .from("retailer_order_items")
      .select("id, order_id, quantity, quantity_shipped, quantity_cancelled")
      .eq("id", params.orderItemId)
      .maybeSingle();

    if (itemErr || !item) {
      return { success: false, error: "Order item not found." };
    }

    const curShipped = Number(item.quantity_shipped || 0);
    const curCancelled = Number(item.quantity_cancelled || 0);
    const maxCancellable = item.quantity - curShipped - curCancelled;

    if (params.quantityToCancel > maxCancellable) {
      return {
        success: false,
        error: `Cannot cancel ${params.quantityToCancel} units. Only ${maxCancellable} active unshipped units remain.`,
      };
    }

    const now = new Date().toISOString();

    // 1. Update line item cancelled quantity
    await adminClient
      .from("retailer_order_items")
      .update({
        quantity_cancelled: curCancelled + params.quantityToCancel,
        cancellation_reason: params.reason?.trim() || "Item out of stock / shortened by Admin",
        cancelled_at: now,
      })
      .eq("id", params.orderItemId);

    // 2. Fetch all items to recompute header unit accounting
    const { data: allItems } = await adminClient
      .from("retailer_order_items")
      .select("quantity, quantity_shipped, quantity_cancelled")
      .eq("order_id", params.orderId);

    const items = allItems || [];
    const totalOrdered = items.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0);
    const totalShipped = items.reduce((sum: number, it: any) => sum + Number(it.quantity_shipped || 0), 0);
    const totalCancelled = items.reduce((sum: number, it: any) => sum + Number(it.quantity_cancelled || 0), 0);
    const totalRemaining = Math.max(0, totalOrdered - totalShipped - totalCancelled);

    // 3. Fetch parent order to get current raw status
    const { data: parentOrder } = await adminClient
      .from("retailer_orders")
      .select("order_status")
      .eq("id", params.orderId)
      .single();

    const newStatus = computeAuthoritativeOrderStatus(
      parentOrder?.order_status || "processing",
      totalOrdered,
      totalShipped,
      totalCancelled
    );

    // 4. Update retailer_orders header totals and status
    await adminClient
      .from("retailer_orders")
      .update({
        order_status: newStatus,
        total_cancelled_units: totalCancelled,
        total_remaining_units: totalRemaining,
        updated_at: now,
      })
      .eq("id", params.orderId);

    revalidatePath("/admin/sales/orders");
    revalidatePath(`/admin/sales/orders/${params.orderId}`);
    revalidatePath("/admin/finance/receivables");
    revalidatePath("/orders");
    revalidatePath(`/orders/${params.orderId}`);
    revalidatePath("/bills");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Admin Action: Record refund amount on order with payment verification
 * Strictly enforces that refund amount cannot exceed verified collected funds.
 */
export async function adminProcessOrderRefundAction(params: {
  orderId: string;
  refundAmount: number;
  notes?: string;
  providerRef?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifyAdminSession();
    const adminClient = createAdminClient();

    // 1. Fetch order and collected payments
    const { data: order, error: ordErr } = await adminClient
      .from("retailer_orders")
      .select("id, company_id, total_amount, payment_status, refund_amount")
      .eq("id", params.orderId)
      .maybeSingle();

    if (ordErr || !order) {
      return { success: false, error: "Order not found." };
    }

    const { data: payments } = await adminClient
      .from("retailer_order_payments")
      .select("amount, status")
      .eq("order_id", params.orderId)
      .eq("status", "paid");

    const totalPaid = (payments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    if (totalPaid <= 0 && params.refundAmount > 0) {
      return {
        success: false,
        error: "Cannot process refund: No collected payments exist for this order (payment status is unpaid). Refund amount must be $0.00.",
      };
    }

    const maxRefundable = Math.max(0, totalPaid - Number(order.refund_amount || 0));
    if (params.refundAmount > maxRefundable) {
      return {
        success: false,
        error: `Refund amount ($${params.refundAmount.toFixed(2)}) exceeds available collected funds ($${maxRefundable.toFixed(2)}).`,
      };
    }

    const now = new Date().toISOString();

    // 2. Create refund record in retailer_order_refund_records
    await adminClient.from("retailer_order_refund_records").insert({
      order_id: order.id,
      company_id: order.company_id,
      total_refund_amount: params.refundAmount,
      refund_status: params.providerRef ? "completed" : "approved",
      provider: "manual",
      provider_refund_id: params.providerRef?.trim() || null,
      reviewed_by: session.userId,
      reviewed_at: now,
      completed_at: params.providerRef ? now : null,
      notes: params.notes?.trim() || "Manual refund recorded by Admin",
      created_at: now,
      updated_at: now,
    });

    // 3. Update retailer_orders
    const newRefundStatus = params.providerRef ? "refunded" : "approved";
    const { error } = await adminClient
      .from("retailer_orders")
      .update({
        refund_amount: Number(order.refund_amount || 0) + params.refundAmount,
        refund_status: newRefundStatus,
        refunded_at: params.providerRef ? now : null,
        cancellation_notes: params.notes?.trim() || "Refund updated",
        updated_at: now,
      })
      .eq("id", params.orderId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/sales/orders");
    revalidatePath(`/admin/sales/orders/${params.orderId}`);
    revalidatePath("/orders");
    revalidatePath(`/orders/${params.orderId}`);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
