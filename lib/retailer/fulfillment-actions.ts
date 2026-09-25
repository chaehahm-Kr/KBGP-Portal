"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRetailerSession, verifyAdminSession } from "@/lib/auth/dal";
import { revalidatePath } from "next/cache";
import {
  RetailerFulfillment,
  RetailerFulfillmentStatus,
  OrderFulfillmentProgress,
} from "./fulfillment-types";

/**
 * Fetch all fulfillments and items for a specific Retailer Order
 */
export async function getOrderFulfillments(orderId: string): Promise<RetailerFulfillment[]> {
  const adminClient = createAdminClient();

  const { data: rawFulfillments, error } = await adminClient
    .from("retailer_order_fulfillments")
    .select(`
      *,
      retailer_order_fulfillment_items (
        id,
        fulfillment_id,
        order_item_id,
        product_id,
        quantity_shipped,
        quantity_delivered,
        created_at,
        products (
          id,
          name,
          letusto_sku,
          manufacture_sku
        )
      )
    `)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error || !rawFulfillments) {
    return [];
  }

  return rawFulfillments.map((f: any) => ({
    id: f.id,
    fulfillmentNumber: f.fulfillment_number,
    orderId: f.order_id,
    companyId: f.company_id,
    storeId: f.store_id,
    status: f.status as RetailerFulfillmentStatus,
    carrier: f.carrier,
    trackingNumber: f.tracking_number,
    trackingUrl: f.tracking_url,
    shippedAt: f.shipped_at,
    deliveredAt: f.delivered_at,
    shippedBy: f.shipped_by,
    deliveredBy: f.delivered_by,
    notes: f.notes,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
    items: (f.retailer_order_fulfillment_items || []).map((it: any) => ({
      id: it.id,
      fulfillmentId: it.fulfillment_id,
      orderItemId: it.order_item_id,
      productId: it.product_id,
      sku: it.products?.letusto_sku || it.products?.manufacture_sku || "KS-SKU",
      productName: it.products?.name || "Product",
      quantityShipped: Number(it.quantity_shipped || 0),
      quantityDelivered: Number(it.quantity_delivered || 0),
      createdAt: it.created_at,
    })),
  }));
}

/**
 * Fetch Confirmed Delivered Quantity for a Store & Product within an interval
 */
export async function getStoreConfirmedDeliveredQty(
  storeId: string,
  productId: string,
  startTime?: string | null,
  endTime?: string | null
): Promise<number> {
  const adminClient = createAdminClient();

  let query = adminClient
    .from("retailer_order_fulfillment_items")
    .select(`
      quantity_delivered,
      retailer_order_fulfillments!inner (
        store_id,
        status,
        delivered_at
      )
    `)
    .eq("product_id", productId)
    .eq("retailer_order_fulfillments.store_id", storeId)
    .eq("retailer_order_fulfillments.status", "delivered")
    .not("retailer_order_fulfillments.delivered_at", "is", null);

  if (startTime) {
    query = query.gt("retailer_order_fulfillments.delivered_at", startTime);
  }
  if (endTime) {
    query = query.lte("retailer_order_fulfillments.delivered_at", endTime);
  }

  const { data, error } = await query;
  if (error || !data) {
    return 0;
  }

  return data.reduce((acc, row: any) => acc + Number(row.quantity_delivered || 0), 0);
}

/**
 * Admin Action: Create / Record a new Shipment Fulfillment for a Retailer Order
 */
export async function adminCreateOrderFulfillmentAction(params: {
  orderId: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  notes?: string;
  items: Array<{
    orderItemId: string;
    productId: string;
    quantityShipped: number;
  }>;
  markAsShipped?: boolean;
}): Promise<{ success: boolean; fulfillmentId?: string; error?: string }> {
  try {
    const session = await verifyAdminSession();
    const adminClient = createAdminClient();

    // 1. Fetch Order and items
    const { data: order, error: orderErr } = await adminClient
      .from("retailer_orders")
      .select(`
        id,
        company_id,
        store_id,
        order_status,
        retailer_order_items (
          id,
          product_id,
          quantity
        )
      `)
      .eq("id", params.orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return { success: false, error: "Retailer order not found." };
    }

    if (!order.store_id) {
      return { success: false, error: "Order does not have a destination store assigned." };
    }

    const orderItems = (order.retailer_order_items as any[]) || [];
    const orderItemMap = new Map(orderItems.map((it) => [it.id, it]));

    // 2. Fetch existing active fulfillments to check cumulative quantities
    const existingFulfillments = await getOrderFulfillments(params.orderId);
    const cumulativeShippedMap = new Map<string, number>();

    existingFulfillments
      .filter((f) => f.status !== "cancelled")
      .forEach((f) => {
        f.items.forEach((it) => {
          const prev = cumulativeShippedMap.get(it.orderItemId) || 0;
          cumulativeShippedMap.set(it.orderItemId, prev + it.quantityShipped);
        });
      });

    // 3. Validate items to ship
    const validItems: Array<{
      order_item_id: string;
      product_id: string;
      quantity_shipped: number;
      quantity_delivered: number;
    }> = [];

    for (const item of params.items) {
      const orderItem = orderItemMap.get(item.orderItemId);
      if (!orderItem) {
        return { success: false, error: `Order line ${item.orderItemId} does not belong to this order.` };
      }

      const qtyToShip = Math.max(0, item.quantityShipped);
      if (qtyToShip <= 0) continue;

      const previouslyShipped = cumulativeShippedMap.get(item.orderItemId) || 0;
      const maxAllowed = orderItem.quantity - previouslyShipped;

      if (qtyToShip > maxAllowed) {
        return {
          success: false,
          error: `Quantity to ship (${qtyToShip}) exceeds remaining quantity (${maxAllowed}) for line item.`,
        };
      }

      validItems.push({
        order_item_id: item.orderItemId,
        product_id: item.productId,
        quantity_shipped: qtyToShip,
        quantity_delivered: 0,
      });
    }

    if (validItems.length === 0) {
      return { success: false, error: "Please specify at least one product quantity to fulfill." };
    }

    // 4. Generate Fulfillment Number
    const { data: numData } = await adminClient.rpc("generate_retailer_fulfillment_number");
    const fulfillmentNumber = numData || `KSF-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    const isShipped = Boolean(params.markAsShipped);

    // 5. Insert Fulfillment Header
    const { data: newFulfillment, error: fulErr } = await adminClient
      .from("retailer_order_fulfillments")
      .insert({
        fulfillment_number: fulfillmentNumber,
        order_id: params.orderId,
        company_id: order.company_id,
        store_id: order.store_id,
        status: isShipped ? "shipped" : "processing",
        carrier: params.carrier?.trim() || null,
        tracking_number: params.trackingNumber?.trim() || null,
        tracking_url: params.trackingUrl?.trim() || null,
        shipped_at: isShipped ? new Date().toISOString() : null,
        shipped_by: isShipped ? session.userId : null,
        notes: params.notes?.trim() || null,
        created_by: session.userId,
      })
      .select("id")
      .single();

    if (fulErr || !newFulfillment) {
      console.error("Error inserting fulfillment:", fulErr);
      return { success: false, error: "Failed to create fulfillment record." };
    }

    // 6. Insert Fulfillment Items
    const itemsToInsert = validItems.map((it) => ({
      fulfillment_id: newFulfillment.id,
      order_item_id: it.order_item_id,
      product_id: it.product_id,
      quantity_shipped: it.quantity_shipped,
      quantity_delivered: 0,
    }));

    const { error: itemsErr } = await adminClient
      .from("retailer_order_fulfillment_items")
      .insert(itemsToInsert);

    if (itemsErr) {
      console.error("Error inserting fulfillment items:", itemsErr);
      return { success: false, error: "Failed to create fulfillment line items." };
    }

    // 7. Update Retailer Order Status appropriately (processing or shipped)
    let nextOrderStatus = isShipped ? "shipped" : "processing";
    if (order.order_status === "submitted" || order.order_status === "confirmed") {
      await adminClient
        .from("retailer_orders")
        .update({ order_status: nextOrderStatus, updated_at: new Date().toISOString() })
        .eq("id", params.orderId);
    } else if (isShipped && order.order_status === "processing") {
      await adminClient
        .from("retailer_orders")
        .update({ order_status: "shipped", updated_at: new Date().toISOString() })
        .eq("id", params.orderId);
    }

    revalidatePath("/admin/retailers");
    revalidatePath(`/admin/retailers/${order.company_id}`);
    revalidatePath("/orders");
    revalidatePath(`/orders/${params.orderId}`);

    return { success: true, fulfillmentId: newFulfillment.id };
  } catch (err: any) {
    console.error("adminCreateOrderFulfillmentAction error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Admin Action: Mark an existing fulfillment as Shipped with carrier & tracking
 */
export async function adminMarkFulfillmentShippedAction(params: {
  fulfillmentId: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifyAdminSession();
    const adminClient = createAdminClient();

    const { data: fulfillment, error: fulErr } = await adminClient
      .from("retailer_order_fulfillments")
      .select("id, order_id, company_id, status")
      .eq("id", params.fulfillmentId)
      .maybeSingle();

    if (fulErr || !fulfillment) {
      return { success: false, error: "Fulfillment record not found." };
    }

    if (fulfillment.status === "delivered") {
      return { success: false, error: "Cannot modify a shipment that is already delivered." };
    }

    const shippedTime = params.shippedAt || new Date().toISOString();

    const { error: updateErr } = await adminClient
      .from("retailer_order_fulfillments")
      .update({
        status: "shipped",
        carrier: params.carrier?.trim() || null,
        tracking_number: params.trackingNumber?.trim() || null,
        tracking_url: params.trackingUrl?.trim() || null,
        shipped_at: shippedTime,
        shipped_by: session.userId,
        notes: params.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.fulfillmentId);

    if (updateErr) {
      return { success: false, error: "Failed to update shipment status to shipped." };
    }

    // Update Order Status to shipped
    await adminClient
      .from("retailer_orders")
      .update({ order_status: "shipped", updated_at: new Date().toISOString() })
      .eq("id", fulfillment.order_id);

    revalidatePath(`/admin/retailers/${fulfillment.company_id}`);
    revalidatePath("/orders");
    revalidatePath(`/orders/${fulfillment.order_id}`);

    return { success: true };
  } catch (err: any) {
    console.error("adminMarkFulfillmentShippedAction error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Admin Action: Confirm Delivery of a Fulfillment (Establishes Confirmed Delivered Quantities)
 */
export async function adminConfirmFulfillmentDeliveryAction(params: {
  fulfillmentId: string;
  deliveredAt?: string;
  deliveredQuantities?: Array<{
    fulfillmentItemId: string;
    quantityDelivered: number;
  }>;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifyAdminSession();
    const adminClient = createAdminClient();

    // 1. Fetch fulfillment & items
    const { data: fulfillment, error: fulErr } = await adminClient
      .from("retailer_order_fulfillments")
      .select(`
        id,
        order_id,
        company_id,
        store_id,
        status,
        retailer_order_fulfillment_items (
          id,
          product_id,
          quantity_shipped,
          quantity_delivered
        )
      `)
      .eq("id", params.fulfillmentId)
      .maybeSingle();

    if (fulErr || !fulfillment) {
      return { success: false, error: "Fulfillment record not found." };
    }

    const items = (fulfillment.retailer_order_fulfillment_items as any[]) || [];
    const itemMap = new Map(items.map((it) => [it.id, it]));

    // 2. Update delivered quantity per fulfillment item
    const deliveredTime = params.deliveredAt || new Date().toISOString();

    if (params.deliveredQuantities && params.deliveredQuantities.length > 0) {
      for (const dq of params.deliveredQuantities) {
        const item = itemMap.get(dq.fulfillmentItemId);
        if (!item) continue;

        const deliveredQty = Math.min(item.quantity_shipped, Math.max(0, dq.quantityDelivered));
        await adminClient
          .from("retailer_order_fulfillment_items")
          .update({
            quantity_delivered: deliveredQty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", dq.fulfillmentItemId);
      }
    } else {
      // Default: full delivered quantity equals shipped quantity
      for (const item of items) {
        await adminClient
          .from("retailer_order_fulfillment_items")
          .update({
            quantity_delivered: item.quantity_shipped,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      }
    }

    // 3. Update Fulfillment Header Status to 'delivered'
    const { error: updateHeaderErr } = await adminClient
      .from("retailer_order_fulfillments")
      .update({
        status: "delivered",
        delivered_at: deliveredTime,
        delivered_by: session.userId,
        notes: params.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.fulfillmentId);

    if (updateHeaderErr) {
      return { success: false, error: "Failed to mark fulfillment as delivered." };
    }

    // 4. Check if all order items across all fulfillments are fully delivered
    const { data: order } = await adminClient
      .from("retailer_orders")
      .select(`
        id,
        total_items_count,
        retailer_order_items (
          id,
          quantity
        )
      `)
      .eq("id", fulfillment.order_id)
      .maybeSingle();

    const allFulfillments = await getOrderFulfillments(fulfillment.order_id);
    const totalOrdered = (order?.retailer_order_items as any[])?.reduce(
      (sum, it) => sum + Number(it.quantity || 0),
      0
    ) || 0;

    const totalDeliveredAcrossOrder = allFulfillments
      .filter((f) => f.status === "delivered")
      .reduce(
        (sum, f) =>
          sum + f.items.reduce((iSum, it) => iSum + Number(it.quantityDelivered || 0), 0),
        0
      );

    const isFullyDelivered = totalDeliveredAcrossOrder >= totalOrdered && totalOrdered > 0;

    await adminClient
      .from("retailer_orders")
      .update({
        order_status: isFullyDelivered ? "delivered" : "shipped",
        updated_at: new Date().toISOString(),
      })
      .eq("id", fulfillment.order_id);

    revalidatePath(`/admin/retailers/${fulfillment.company_id}`);
    revalidatePath("/orders");
    revalidatePath(`/orders/${fulfillment.order_id}`);
    revalidatePath("/check");
    revalidatePath("/sales");

    return { success: true };
  } catch (err: any) {
    console.error("adminConfirmFulfillmentDeliveryAction error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
