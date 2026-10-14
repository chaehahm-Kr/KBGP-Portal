"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRetailerSession, verifyAdminSession } from "@/lib/auth/dal";
import { revalidatePath } from "next/cache";
import {
  RetailerFulfillment,
  RetailerFulfillmentStatus,
  RetailerFulfillmentBox,
  OrderFulfillmentProgress,
} from "./fulfillment-types";
import { resolveCarrierTrackingUrl } from "@/lib/orders/carrier-resolver";

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

  // Batch load boxes for these fulfillments
  const fulfillmentIds = rawFulfillments.map((f: any) => f.id);
  const boxesMap = new Map<string, RetailerFulfillmentBox[]>();

  if (fulfillmentIds.length > 0) {
    try {
      const { data: rawBoxes, error: boxErr } = await adminClient
        .from("retailer_order_fulfillment_boxes")
        .select("*")
        .in("fulfillment_id", fulfillmentIds)
        .neq("status", "void")
        .order("box_number", { ascending: true });

      if (!boxErr && rawBoxes && rawBoxes.length > 0) {
        rawBoxes.forEach((b: any) => {
          const arr = boxesMap.get(b.fulfillment_id) || [];
          arr.push({
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
          boxesMap.set(b.fulfillment_id, arr);
        });
      } else {
        // Fallback to retailer_order_packages if box table not populated
        const { data: rawPkgs } = await adminClient
          .from("retailer_order_packages")
          .select("*")
          .in("fulfillment_id", fulfillmentIds)
          .order("box_number", { ascending: true });

        if (rawPkgs && rawPkgs.length > 0) {
          rawPkgs.forEach((p: any) => {
            const arr = boxesMap.get(p.fulfillment_id) || [];
            arr.push({
              id: p.id,
              fulfillmentId: p.fulfillment_id,
              orderId: p.order_id,
              boxNumber: p.box_number,
              boxTotal: p.box_total || 1,
              carrier: p.carrier,
              trackingNumber: p.tracking_number,
              trackingUrl: resolveCarrierTrackingUrl(p.carrier, p.tracking_number, p.tracking_url),
              weightLbs: p.weight_lbs,
              dimensionsInch: p.dimensions_inch,
              status: "active",
              createdAt: p.created_at,
            });
            boxesMap.set(p.fulfillment_id, arr);
          });
        }
      }
    } catch (bEx) {
      console.warn("Could not query fulfillment boxes:", bEx);
    }
  }

  return rawFulfillments.map((f: any) => {
    const directBoxes = boxesMap.get(f.id) || [];
    // Safe legacy fallback: if no dedicated boxes recorded but fulfillment has tracking, synthesize 1 box
    const boxes = directBoxes.length > 0
      ? directBoxes
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
      status: f.status as RetailerFulfillmentStatus,
      carrier: f.carrier,
      trackingNumber: f.tracking_number,
      trackingUrl: f.tracking_url,
      boxCount: boxes.length > 0 ? boxes.length : Number(f.box_count || 1),
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
      boxes,
    };
  });
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
  boxes?: Array<{
    boxNumber?: number;
    carrier?: string;
    trackingNumber?: string;
    weightLbs?: number;
    dimensionsInch?: string;
    notes?: string;
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

    // Guard: Prevent fulfillment on terminal orders (shipped, delivered, cancelled)
    const orderStatusNorm = (order.order_status || "").toLowerCase();
    if (["cancelled", "shipped", "delivered"].includes(orderStatusNorm)) {
      return {
        success: false,
        error: `Cannot create fulfillment: Order is already ${order.order_status}.`,
      };
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

    // 6.5. Insert Fulfillment Boxes (Phase B2 Canonical)
    const rawInputBoxes = params.boxes && params.boxes.length > 0
      ? params.boxes
      : (params.trackingNumber || params.carrier)
      ? [
          {
            boxNumber: 1,
            carrier: params.carrier || "ups",
            trackingNumber: params.trackingNumber,
          },
        ]
      : [];

    if (rawInputBoxes.length > 0) {
      const boxTotal = rawInputBoxes.length;
      const boxRows = rawInputBoxes.map((b, idx) => {
        const c = (b.carrier || params.carrier || "ups").trim();
        const t = b.trackingNumber?.trim() || null;
        return {
          fulfillment_id: newFulfillment.id,
          order_id: params.orderId,
          box_number: b.boxNumber || idx + 1,
          box_total: boxTotal,
          carrier: c,
          tracking_number: t,
          tracking_url: resolveCarrierTrackingUrl(c, t),
          weight_lbs: b.weightLbs || null,
          dimensions_inch: b.dimensionsInch?.trim() || null,
          notes: b.notes?.trim() || null,
          status: "active",
        };
      });

      try {
        await adminClient.from("retailer_order_fulfillment_boxes").insert(boxRows);
      } catch (boxInsErr) {
        console.warn("Could not insert retailer_order_fulfillment_boxes:", boxInsErr);
      }

      // Sync to retailer_order_packages for legacy compatibility
      try {
        const pkgRows = boxRows.map((b) => ({
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
            orderItemId: it.order_item_id,
            sku: "SKU",
            productName: "Products",
            quantity: it.quantity_shipped,
          })),
        }));
        await adminClient.from("retailer_order_packages").insert(pkgRows);
      } catch (pkgInsErr) {
        console.warn("Could not insert retailer_order_packages fallback:", pkgInsErr);
      }
    }

    // 7. Update Retailer Order Status appropriately to 'processing'
    // Phase B1: Creating a shipment package puts order into processing; dispatching marks it as shipped/partially_shipped
    if (order.order_status === "submitted" || order.order_status === "confirmed") {
      await adminClient
        .from("retailer_orders")
        .update({ order_status: "processing", updated_at: new Date().toISOString() })
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
  boxes?: Array<{
    id?: string;
    boxNumber?: number;
    carrier?: string;
    trackingNumber?: string;
    weightLbs?: number;
    dimensionsInch?: string;
    notes?: string;
    status?: "active" | "void";
  }>;
  shippedAt?: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifyAdminSession();
    const adminClient = createAdminClient();

    const { data: fulfillment, error: fulErr } = await adminClient
      .from("retailer_order_fulfillments")
      .select("id, order_id, company_id, status, carrier, tracking_number, tracking_url, box_count")
      .eq("id", params.fulfillmentId)
      .maybeSingle();

    if (fulErr || !fulfillment) {
      return { success: false, error: "Fulfillment record not found." };
    }

    if (fulfillment.status === "delivered") {
      return { success: false, error: "Cannot modify a shipment that is already delivered." };
    }

    const shippedTime = params.shippedAt || new Date().toISOString();

    // Determine carrier & tracking from boxes if provided
    let primaryCarrier = params.carrier !== undefined ? params.carrier?.trim() || null : fulfillment.carrier;
    let primaryTracking = params.trackingNumber !== undefined ? params.trackingNumber?.trim() || null : fulfillment.tracking_number;
    let primaryTrackingUrl = params.trackingUrl !== undefined ? params.trackingUrl?.trim() || null : fulfillment.tracking_url;

    if (params.boxes && params.boxes.length > 0) {
      const activeBoxes = params.boxes.filter((b) => b.status !== "void");
      if (activeBoxes.length > 0) {
        const first = activeBoxes[0];
        primaryCarrier = (first.carrier || primaryCarrier || "ups").trim();
        primaryTracking = first.trackingNumber?.trim() || null;
        primaryTrackingUrl = resolveCarrierTrackingUrl(primaryCarrier, primaryTracking);
      }
    }

    const updatePayload: Record<string, any> = {
      status: "shipped",
      shipped_at: shippedTime,
      shipped_by: session.userId,
      carrier: primaryCarrier,
      tracking_number: primaryTracking,
      tracking_url: primaryTrackingUrl || resolveCarrierTrackingUrl(primaryCarrier, primaryTracking),
      updated_at: new Date().toISOString(),
    };
    if (params.notes !== undefined) {
      updatePayload.notes = params.notes?.trim() || null;
    }

    // Save/update boxes if supplied
    if (params.boxes && params.boxes.length > 0) {
      const activeBoxes = params.boxes.filter((b) => b.status !== "void");
      const boxTotal = activeBoxes.length > 0 ? activeBoxes.length : 1;
      updatePayload.box_count = boxTotal;

      let activeIndex = 1;
      for (const b of params.boxes) {
        const isVoid = b.status === "void";
        const bNum = isVoid ? (b.boxNumber || 99) : activeIndex++;
        const c = (b.carrier || primaryCarrier || "ups").trim();
        const t = b.trackingNumber?.trim() || null;
        const u = resolveCarrierTrackingUrl(c, t);

        if (b.id && !b.id.startsWith("legacy-")) {
          try {
            await adminClient
              .from("retailer_order_fulfillment_boxes")
              .update({
                box_number: bNum,
                box_total: boxTotal,
                carrier: c,
                tracking_number: t,
                tracking_url: u,
                weight_lbs: b.weightLbs ?? null,
                dimensions_inch: b.dimensionsInch?.trim() || null,
                notes: b.notes?.trim() || null,
                status: isVoid ? "void" : "active",
                updated_at: new Date().toISOString(),
              })
              .eq("id", b.id);
          } catch (_) {}
        } else if (!isVoid) {
          try {
            await adminClient
              .from("retailer_order_fulfillment_boxes")
              .insert({
                fulfillment_id: params.fulfillmentId,
                order_id: fulfillment.order_id,
                box_number: bNum,
                box_total: boxTotal,
                carrier: c,
                tracking_number: t,
                tracking_url: u,
                weight_lbs: b.weightLbs ?? null,
                dimensions_inch: b.dimensionsInch?.trim() || null,
                notes: b.notes?.trim() || null,
                status: "active",
              });
          } catch (_) {}
        }
      }
    } else if (primaryTracking) {
      // If single tracking supplied, ensure at least Box 1 exists in retailer_order_fulfillment_boxes
      try {
        const { data: existingBoxes } = await adminClient
          .from("retailer_order_fulfillment_boxes")
          .select("id")
          .eq("fulfillment_id", params.fulfillmentId)
          .limit(1);

        if (!existingBoxes || existingBoxes.length === 0) {
          await adminClient.from("retailer_order_fulfillment_boxes").insert({
            fulfillment_id: params.fulfillmentId,
            order_id: fulfillment.order_id,
            box_number: 1,
            box_total: 1,
            carrier: primaryCarrier || "ups",
            tracking_number: primaryTracking,
            tracking_url: primaryTrackingUrl || resolveCarrierTrackingUrl(primaryCarrier, primaryTracking),
            status: "active",
          });
        } else {
          await adminClient
            .from("retailer_order_fulfillment_boxes")
            .update({
              carrier: primaryCarrier || "ups",
              tracking_number: primaryTracking,
              tracking_url: primaryTrackingUrl || resolveCarrierTrackingUrl(primaryCarrier, primaryTracking),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingBoxes[0].id);
        }
      } catch (_) {}
    }

    const { error: updateErr } = await adminClient
      .from("retailer_order_fulfillments")
      .update(updatePayload)
      .eq("id", params.fulfillmentId);

    if (updateErr) {
      return { success: false, error: "Failed to update shipment status to shipped." };
    }

    // Increment quantity_shipped on retailer_order_items for this confirmed fulfillment
    const { data: fItems } = await adminClient
      .from("retailer_order_fulfillment_items")
      .select("order_item_id, quantity_shipped")
      .eq("fulfillment_id", params.fulfillmentId);

    if (fItems && fItems.length > 0) {
      for (const fi of fItems) {
        if (!fi.order_item_id || !fi.quantity_shipped) continue;
        const { data: curItem } = await adminClient
          .from("retailer_order_items")
          .select("quantity_shipped")
          .eq("id", fi.order_item_id)
          .single();
        const curShipped = Number(curItem?.quantity_shipped || 0);
        await adminClient
          .from("retailer_order_items")
          .update({ quantity_shipped: curShipped + Number(fi.quantity_shipped) })
          .eq("id", fi.order_item_id);
      }
    }

    // Phase B1: Calculate Partially Shipped using actual shipped units vs ordered units
    const { data: orderData } = await adminClient
      .from("retailer_orders")
      .select("id, total_items_count, order_status, retailer_order_items(id, quantity)")
      .eq("id", fulfillment.order_id)
      .maybeSingle();

    const totalOrdered = (orderData?.retailer_order_items as any[])?.reduce(
      (sum, it) => sum + Number(it.quantity || 0),
      0
    ) || Number(orderData?.total_items_count || 0);

    const allFulfillments = await getOrderFulfillments(fulfillment.order_id);
    const totalShipped = allFulfillments
      .filter((f) => f.id === fulfillment.id || f.status === "shipped" || f.status === "delivered")
      .reduce(
        (sum, f) =>
          sum + f.items.reduce((iSum, it) => iSum + Number(it.quantityShipped || 0), 0),
        0
      );

    const nextOrderStatus =
      totalShipped >= totalOrdered && totalOrdered > 0
        ? "shipped"
        : totalShipped > 0
        ? "partially_shipped"
        : "processing";

    await adminClient
      .from("retailer_orders")
      .update({
        order_status: nextOrderStatus,
        total_shipped_units: totalShipped,
        total_remaining_units: Math.max(0, totalOrdered - totalShipped),
        updated_at: new Date().toISOString()
      })
      .eq("id", fulfillment.order_id);

    // Phase B3: Authoritative Dispatch-Based Invoicing
    const { createDispatchInvoice } = await import("@/lib/finance/dispatch-invoicing");
    const invResult = await createDispatchInvoice(adminClient, params.fulfillmentId);
    if (!invResult.success) {
      console.error("Critical: Dispatch invoice creation failed. Rolling back fulfillment status:", invResult.error);
      // Rollback fulfillment status to previous
      await adminClient
        .from("retailer_order_fulfillments")
        .update({
          status: fulfillment.status,
          shipped_at: null,
          shipped_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.fulfillmentId);

      // Rollback item shipped quantities
      if (fItems && fItems.length > 0) {
        for (const fi of fItems) {
          if (!fi.order_item_id || !fi.quantity_shipped) continue;
          const { data: curItem } = await adminClient
            .from("retailer_order_items")
            .select("quantity_shipped")
            .eq("id", fi.order_item_id)
            .single();
          const curShipped = Number(curItem?.quantity_shipped || 0);
          await adminClient
            .from("retailer_order_items")
            .update({ quantity_shipped: Math.max(0, curShipped - Number(fi.quantity_shipped)) })
            .eq("id", fi.order_item_id);
        }
      }

      // Rollback order status
      await adminClient
        .from("retailer_orders")
        .update({ order_status: orderData?.order_status || "processing", updated_at: new Date().toISOString() })
        .eq("id", fulfillment.order_id);

      return {
        success: false,
        error: `Dispatch confirmation aborted: failed to generate required dispatch invoice (${invResult.error}). Shipment was not marked as shipped.`,
      };
    }

    revalidatePath(`/admin/retailers/${fulfillment.company_id}`);
    revalidatePath("/admin/sales/orders");
    revalidatePath(`/admin/sales/orders/${fulfillment.order_id}`);
    revalidatePath("/admin/finance/receivables");
    revalidatePath("/orders");
    revalidatePath(`/orders/${fulfillment.order_id}`);
    revalidatePath("/bills");

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

    // Phase B1: Deliveries establish confirmed delivered quantities, but operational order status remains Shipped or Partially Shipped
    const totalShippedAcrossOrder = allFulfillments
      .filter((f) => f.status === "shipped" || f.status === "delivered")
      .reduce(
        (sum, f) =>
          sum + f.items.reduce((iSum, it) => iSum + Number(it.quantityShipped || 0), 0),
        0
      );

    const nextOrderStatus =
      totalShippedAcrossOrder >= totalOrdered && totalOrdered > 0
        ? "shipped"
        : totalShippedAcrossOrder > 0
        ? "partially_shipped"
        : "processing";

    await adminClient
      .from("retailer_orders")
      .update({
        order_status: nextOrderStatus,
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

/**
 * Admin Action: Update, add, or void tracking boxes on an existing fulfillment dispatch
 * Invariant: Modifies carton/tracking logistics ONLY.
 * Never alters retailer_order_items.quantity_shipped and never creates/mutates invoices.
 */
export async function adminUpdateFulfillmentBoxesAction(params: {
  fulfillmentId: string;
  boxes: Array<{
    id?: string;
    boxNumber?: number;
    carrier: string;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    weightLbs?: number | null;
    dimensionsInch?: string | null;
    notes?: string | null;
    status?: "active" | "void";
  }>;
  notes?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifyAdminSession();
    const adminClient = createAdminClient();

    const { data: fulfillment, error: fulErr } = await adminClient
      .from("retailer_order_fulfillments")
      .select("id, order_id, company_id, status, carrier, tracking_number, tracking_url, box_count")
      .eq("id", params.fulfillmentId)
      .maybeSingle();

    if (fulErr || !fulfillment) {
      return { success: false, error: "Fulfillment record not found." };
    }

    const activeBoxes = params.boxes.filter((b) => b.status !== "void");
    const boxTotal = activeBoxes.length > 0 ? activeBoxes.length : 1;

    // Process each box
    let activeBoxIndex = 1;
    for (const b of params.boxes) {
      const isVoid = b.status === "void";
      const boxNumber = isVoid ? (b.boxNumber || 99) : activeBoxIndex++;
      const carrier = (b.carrier || fulfillment.carrier || "ups").trim();
      const trackingNumber = b.trackingNumber?.trim() || null;
      const trackingUrl = resolveCarrierTrackingUrl(carrier, trackingNumber, b.trackingUrl);

      if (b.id && !b.id.startsWith("legacy-")) {
        try {
          await adminClient
            .from("retailer_order_fulfillment_boxes")
            .update({
              box_number: boxNumber,
              box_total: boxTotal,
              carrier,
              tracking_number: trackingNumber,
              tracking_url: trackingUrl,
              weight_lbs: b.weightLbs ?? null,
              dimensions_inch: b.dimensionsInch?.trim() || null,
              notes: b.notes?.trim() || null,
              status: isVoid ? "void" : "active",
              updated_at: new Date().toISOString(),
            })
            .eq("id", b.id);
        } catch (updErr) {
          console.warn("Could not update box:", updErr);
        }
      } else if (!isVoid) {
        try {
          await adminClient
            .from("retailer_order_fulfillment_boxes")
            .insert({
              fulfillment_id: params.fulfillmentId,
              order_id: fulfillment.order_id,
              box_number: boxNumber,
              box_total: boxTotal,
              carrier,
              tracking_number: trackingNumber,
              tracking_url: trackingUrl,
              weight_lbs: b.weightLbs ?? null,
              dimensions_inch: b.dimensionsInch?.trim() || null,
              notes: b.notes?.trim() || null,
              status: "active",
            });
        } catch (insErr) {
          console.warn("Could not insert box:", insErr);
        }
      }
    }

    // Update fulfillment header with primary box tracking and box_count
    const firstActive = activeBoxes[0];
    const headerCarrier = firstActive ? (firstActive.carrier || "ups").trim() : fulfillment.carrier;
    const headerTracking = firstActive ? (firstActive.trackingNumber?.trim() || null) : null;
    const headerTrackingUrl = resolveCarrierTrackingUrl(headerCarrier, headerTracking);

    const updateHeaderPayload: Record<string, any> = {
      carrier: headerCarrier,
      tracking_number: headerTracking,
      tracking_url: headerTrackingUrl,
      box_count: activeBoxes.length,
      updated_at: new Date().toISOString(),
    };
    if (params.notes !== undefined) {
      updateHeaderPayload.notes = params.notes?.trim() || null;
    }

    await adminClient
      .from("retailer_order_fulfillments")
      .update(updateHeaderPayload)
      .eq("id", params.fulfillmentId);

    // Sync to legacy retailer_order_packages
    try {
      await adminClient.from("retailer_order_packages").delete().eq("fulfillment_id", params.fulfillmentId);
      if (activeBoxes.length > 0) {
        const pkgRows = activeBoxes.map((b, idx) => ({
          fulfillment_id: params.fulfillmentId,
          order_id: fulfillment.order_id,
          box_number: idx + 1,
          box_total: activeBoxes.length,
          carrier: (b.carrier || "ups").trim(),
          tracking_number: b.trackingNumber?.trim() || null,
          tracking_url: resolveCarrierTrackingUrl(b.carrier || "ups", b.trackingNumber),
          weight_lbs: b.weightLbs ?? null,
          dimensions_inch: b.dimensionsInch?.trim() || null,
          package_items: [],
        }));
        await adminClient.from("retailer_order_packages").insert(pkgRows);
      }
    } catch (syncErr) {
      console.warn("Could not sync retailer_order_packages:", syncErr);
    }

    revalidatePath(`/admin/retailers/${fulfillment.company_id}`);
    revalidatePath("/admin/sales/orders");
    revalidatePath(`/admin/sales/orders/${fulfillment.order_id}`);
    revalidatePath("/orders");
    revalidatePath(`/orders/${fulfillment.order_id}`);

    return { success: true };
  } catch (err: any) {
    console.error("adminUpdateFulfillmentBoxesAction error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

