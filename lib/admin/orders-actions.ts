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
  AdminOrderLineItem,
} from "./orders-types";
import { computeAuthoritativeOrderStatus } from "@/lib/orders/order-status-utils";

/**
 * Fetch all Retailer Orders for Admin Centralized Orders Management
 */
export async function getAdminRetailerOrdersAction(
  filters?: AdminOrderFilter
): Promise<{ orders: AdminRetailerOrderSummary[]; totalCount: number }> {
  await verifyAdminSession();
  const adminClient = createAdminClient();

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
      total_items_count,
      total_skus_count,
      shipping_destination_type,
      recipient_name,
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
        terms_name
      )
    `, { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters?.search) {
    const term = filters.search.trim();
    query = query.or(`order_number.ilike.%${term}%,recipient_name.ilike.%${term}%`);
  }
  if (filters?.companyId) {
    query = query.eq("company_id", filters.companyId);
  }
  if (filters?.storeId) {
    query = query.eq("store_id", filters.storeId);
  }
  if (filters?.paymentStatus && filters.paymentStatus !== "all") {
    query = query.eq("payment_status", filters.paymentStatus);
  }
  if (filters?.startDate) {
    query = query.gte("created_at", `${filters.startDate}T00:00:00.000Z`);
  }
  if (filters?.endDate) {
    query = query.lte("created_at", `${filters.endDate}T23:59:59.999Z`);
  }

  const { data: rawOrders, error, count } = await query;
  if (error || !rawOrders) {
    console.error("getAdminRetailerOrdersAction error:", error);
    return { orders: [], totalCount: 0 };
  }

  // Fetch packages for these orders in one query
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
    const totalBoxCount = pkgs.length;

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
      packages: pkgs,
      invoices,
      cancellationRequested: Boolean(o.cancellation_requested),
      refundAmount: Number(o.refund_amount || 0),
      refundStatus: o.refund_status || "none",
      isTest: Boolean(o.is_test),
      createdAt: o.created_at,
      updatedAt: o.updated_at,
    };
  });

  // Client-requested status filtering (after canonical resolution)
  let filtered = mappedOrders;
  if (filters?.status && filters.status !== "all") {
    filtered = filtered.filter((ord) => ord.orderStatus === filters.status);
  }
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

  return {
    orders: filtered,
    totalCount: count ?? filtered.length,
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

  // Fetch Packages
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
    const qtyShipped = Number(
      it.quantity_shipped ||
        (fulfilledShipped > 0
          ? fulfilledShipped
          : ["shipped", "delivered"].includes(o.order_status)
          ? qtyOrdered
          : 0)
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
    const fPackages = packages.filter((p) => p.fulfillmentId === f.id);
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
      boxCount: Number(f.box_count || fPackages.length || 1),
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

      // Update quantity_shipped on retailer_order_items
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

    // 3. Insert individual package cartons
    if (params.packages && params.packages.length > 0) {
      const packageRows = params.packages.map((pkg, idx) => ({
        fulfillment_id: newFulfillment.id,
        order_id: params.orderId,
        box_number: pkg.boxNumber || idx + 1,
        box_total: boxCount,
        carrier: pkg.carrier || params.carrier,
        tracking_number: pkg.trackingNumber,
        tracking_url: resolveCarrierTrackingUrl(pkg.carrier || params.carrier, pkg.trackingNumber),
        weight_lbs: pkg.weightLbs || null,
        dimensions_inch: pkg.dimensionsInch || null,
        package_items: pkg.items || [],
      }));

      await adminClient.from("retailer_order_packages").insert(packageRows);
    } else {
      // Create single default package
      await adminClient.from("retailer_order_packages").insert({
        fulfillment_id: newFulfillment.id,
        order_id: params.orderId,
        box_number: 1,
        box_total: 1,
        carrier: params.carrier,
        tracking_number: params.trackingNumber,
        tracking_url: resolveCarrierTrackingUrl(params.carrier, params.trackingNumber),
        package_items: validItems.map((it) => ({
          orderItemId: it.orderItemId,
          sku: "SKU",
          productName: "Products",
          quantity: it.quantityShipped,
        })),
      });
    }

    // 4. Update parent order status
    if (isShipped) {
      // Re-evaluate remaining
      const detail = await getAdminRetailerOrderDetailAction(params.orderId);
      const nextStatus = detail?.totalRemainingUnits === 0 ? "shipped" : "partially_shipped";
      await adminClient
        .from("retailer_orders")
        .update({ order_status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", params.orderId);

      // Phase B3: Issue authoritative dispatch invoice upon confirmed dispatch
      const { createDispatchInvoice } = await import("@/lib/finance/dispatch-invoicing");
      const invRes = await createDispatchInvoice(adminClient, newFulfillment.id);
      if (!invRes.success) {
        console.error("Critical: Dispatch invoice creation failed. Rolling back created shipment:", invRes.error);
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
