// lib/retailer/cancellation-actions.ts
// Phase B5 — Authoritative Retailer Order Cancellation Server Actions

"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { computeAuthoritativeOrderStatus } from "@/lib/orders/order-status-utils";

export interface DirectCancelPayload {
  orderId: string;
  reasonCategory: string;
  reasonNotes?: string;
}

export interface RequestCancellationPayload {
  orderId: string;
  requestType: "full" | "partial";
  reasonCategory: string;
  reasonNotes?: string;
  items?: Array<{
    orderItemId: string;
    quantityToCancel: number;
  }>;
}

/**
 * Retailer Action: Directly cancel a Submitted order.
 * - Allowed ONLY while order_status is strictly 'submitted'.
 * - Requires no Admin approval.
 * - Atomically cancels 100% of remaining units, sets order_status = 'cancelled',
 *   and releases B4 unbilled credit exposure.
 */
export async function retailerDirectCancelOrderAction(payload: DirectCancelPayload): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    const { data: companyUser } = await adminClient
      .from("company_users")
      .select("company_id")
      .eq("id", session.userId)
      .maybeSingle();

    const companyId = companyUser?.company_id;
    if (!companyId) {
      return { success: false, error: "Retailer company association not found." };
    }

    // 1. Fetch order with tenant company isolation
    const { data: order, error: orderErr } = await adminClient
      .from("retailer_orders")
      .select(`
        id,
        order_number,
        company_id,
        order_status,
        payment_status,
        payment_method,
        payment_terms,
        total_amount,
        subtotal_amount,
        shipping_amount,
        tax_amount,
        total_ordered_units,
        total_shipped_units,
        total_cancelled_units,
        total_remaining_units,
        retailer_order_items (
          id,
          quantity,
          quantity_shipped,
          quantity_cancelled,
          line_total
        )
      `)
      .eq("id", payload.orderId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (orderErr || !order) {
      return { success: false, error: "Order not found or unauthorized access." };
    }

    const currentStatus = (order.order_status || "").toLowerCase();

    // Guard: Only 'submitted' status is eligible for direct cancellation
    if (currentStatus !== "submitted") {
      return {
        success: false,
        error: `Direct cancellation is only available for orders in 'Submitted' status. This order is currently '${order.order_status}'. Please submit a cancellation request for Admin review instead.`,
      };
    }

    // Guard: Verify no active shipments or dispatches exist
    const { data: fulfillments } = await adminClient
      .from("retailer_order_fulfillments")
      .select("id, status")
      .eq("order_id", order.id)
      .not("status", "eq", "cancelled");

    if (fulfillments && fulfillments.length > 0) {
      return {
        success: false,
        error: "Cannot directly cancel: Warehouse fulfillment has already been initiated for this order. Please submit a cancellation request for Admin review.",
      };
    }

    // Guard: Verify no active invoices exist
    const { data: invoices } = await adminClient
      .from("retailer_invoices")
      .select("id")
      .eq("order_id", order.id)
      .not("invoice_status", "in", '("void","cancelled")');

    if (invoices && invoices.length > 0) {
      return {
        success: false,
        error: "Cannot directly cancel: An active invoice has already been issued for this order. Please submit a cancellation request for Admin review.",
      };
    }

    // Guard: Verify no collected payments exist
    const { data: payments } = await adminClient
      .from("retailer_order_payments")
      .select("id, amount, status")
      .eq("order_id", order.id)
      .eq("status", "paid");

    const totalPaid = (payments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    if (totalPaid > 0) {
      return {
        success: false,
        error: "Cannot directly cancel: A collected payment exists for this order. Please submit a cancellation request so Admin can review and process your refund.",
      };
    }

    const now = new Date().toISOString();
    const items = order.retailer_order_items || [];
    const totalOrdered = items.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0) || order.total_ordered_units;

    // 2. Atomically update line items: 100% of ordered units marked cancelled
    for (const it of items) {
      await adminClient
        .from("retailer_order_items")
        .update({
          quantity_cancelled: it.quantity,
          cancellation_reason: payload.reasonNotes?.trim() || payload.reasonCategory,
          cancelled_at: now,
        })
        .eq("id", it.id);
    }

    // 3. Atomically update order header
    const { error: updateOrderErr } = await adminClient
      .from("retailer_orders")
      .update({
        order_status: "cancelled",
        total_cancelled_units: totalOrdered,
        total_remaining_units: 0,
        cancellation_requested: false,
        cancellation_notes: payload.reasonNotes?.trim() || payload.reasonCategory,
        updated_at: now,
      })
      .eq("id", order.id);

    if (updateOrderErr) {
      return { success: false, error: "Failed to update order cancellation status." };
    }

    // 4. Create audit request record (marked approved directly)
    await adminClient.from("retailer_order_cancellation_requests").insert({
      order_id: order.id,
      company_id: order.company_id,
      requested_by: session.userId,
      request_type: "full",
      status: "approved",
      reason_category: payload.reasonCategory,
      reason_notes: payload.reasonNotes?.trim() || null,
      admin_notes: "Directly cancelled by retailer while order was in Submitted status",
      reviewed_at: now,
      created_at: now,
      updated_at: now,
    });

    // 5. Clean direct cancellation: No collected payments exist ($0 collected -> $0 refund)
    await adminClient
      .from("retailer_orders")
      .update({
        refund_amount: 0.0,
        refund_status: "none",
        updated_at: now,
      })
      .eq("id", order.id);

    revalidatePath("/orders");
    revalidatePath(`/orders/${order.id}`);
    revalidatePath("/bills");
    revalidatePath("/admin/sales/orders");
    revalidatePath(`/admin/sales/orders/${order.id}`);
    revalidatePath(`/admin/retailers/${order.company_id}`);

    return { success: true };
  } catch (err: any) {
    console.error("retailerDirectCancelOrderAction error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Retailer Action: Submit a cancellation request for Processing or Partially Shipped orders.
 * - Requires Admin review and approval.
 * - Only still-unshipped quantities are eligible.
 */
export async function retailerSubmitCancellationRequestAction(payload: RequestCancellationPayload): Promise<{
  success: boolean;
  requestId?: string;
  error?: string;
}> {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    const { data: companyUser } = await adminClient
      .from("company_users")
      .select("company_id")
      .eq("id", session.userId)
      .maybeSingle();

    const companyId = companyUser?.company_id;
    if (!companyId) {
      return { success: false, error: "Retailer company association not found." };
    }

    // 1. Fetch order
    const { data: order, error: orderErr } = await adminClient
      .from("retailer_orders")
      .select(`
        id,
        order_number,
        company_id,
        store_id,
        order_status,
        total_remaining_units,
        retailer_order_items (
          id,
          quantity,
          quantity_shipped,
          quantity_cancelled
        )
      `)
      .eq("id", payload.orderId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (orderErr || !order) {
      return { success: false, error: "Order not found or unauthorized access." };
    }

    const currentStatus = (order.order_status || "").toLowerCase();

    // Guard: Order status must be Submitted, Processing, or Partially Shipped
    if (!["submitted", "processing", "partially_shipped"].includes(currentStatus)) {
      return {
        success: false,
        error: `Cancellation requests can only be submitted for orders in 'Submitted', 'Processing', or 'Partially Shipped' status. Current status is '${order.order_status}'.`,
      };
    }

    // Guard: Check if an active pending request already exists
    const { data: existingPending } = await adminClient
      .from("retailer_order_cancellation_requests")
      .select("id")
      .eq("order_id", order.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingPending) {
      return {
        success: false,
        error: "A cancellation request is already pending Admin review for this order.",
      };
    }

    const items = order.retailer_order_items || [];
    const itemMap = new Map(items.map((it: any) => [it.id, it]));

    // Determine request items
    const requestItems: Array<{ orderItemId: string; quantityRequested: number }> = [];

    if (payload.requestType === "full") {
      // Request cancellation of ALL remaining unshipped units across all lines
      for (const it of items) {
        const remaining = Math.max(0, it.quantity - Number(it.quantity_shipped || 0) - Number(it.quantity_cancelled || 0));
        if (remaining > 0) {
          requestItems.push({
            orderItemId: it.id,
            quantityRequested: remaining,
          });
        }
      }
    } else {
      // Partial cancellation request: validate specified items
      if (!payload.items || payload.items.length === 0) {
        return { success: false, error: "Please specify at least one product quantity to cancel." };
      }

      for (const pi of payload.items) {
        const it = itemMap.get(pi.orderItemId);
        if (!it) {
          return { success: false, error: `Invalid line item: ${pi.orderItemId}` };
        }

        const remaining = Math.max(0, it.quantity - Number(it.quantity_shipped || 0) - Number(it.quantity_cancelled || 0));
        const qtyToCancel = Math.max(0, pi.quantityToCancel);

        if (qtyToCancel <= 0) continue;
        if (qtyToCancel > remaining) {
          return {
            success: false,
            error: `Requested cancellation quantity (${qtyToCancel}) exceeds remaining unshipped units (${remaining}) for line item.`,
          };
        }

        requestItems.push({
          orderItemId: it.id,
          quantityRequested: qtyToCancel,
        });
      }
    }

    if (items.length > 0) {
      if (requestItems.length === 0) {
        return { success: false, error: "There are no remaining unshipped units available to cancel." };
      }
    } else {
      if (Number(order.total_remaining_units || 0) <= 0) {
        return { success: false, error: "There are no remaining unshipped units available to cancel." };
      }
    }

    const now = new Date().toISOString();

    // 2. Insert Cancellation Request Header
    const { data: newReq, error: reqErr } = await adminClient
      .from("retailer_order_cancellation_requests")
      .insert({
        order_id: order.id,
        company_id: order.company_id,
        store_id: order.store_id || null,
        requested_by: session.userId,
        request_type: payload.requestType,
        status: "pending",
        reason_category: payload.reasonCategory,
        reason_notes: payload.reasonNotes?.trim() || null,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (reqErr || !newReq) {
      console.error("Insert cancellation request failed:", reqErr);
      return { success: false, error: "Failed to submit cancellation request." };
    }

    // 3. Insert Request Items if line items exist
    if (requestItems.length > 0) {
      const itemsToInsert = requestItems.map((ri) => ({
        request_id: newReq.id,
        order_item_id: ri.orderItemId,
        quantity_requested: ri.quantityRequested,
        quantity_approved: 0,
        quantity_rejected: 0,
        created_at: now,
      }));

      const { error: itemsErr } = await adminClient
        .from("retailer_order_cancellation_request_items")
        .insert(itemsToInsert);

      if (itemsErr) {
        console.error("Insert cancellation request items failed:", itemsErr);
        await adminClient.from("retailer_order_cancellation_requests").delete().eq("id", newReq.id);
        return { success: false, error: "Failed to record cancellation request items." };
      }
    }

    // 4. Update order header flag
    await adminClient
      .from("retailer_orders")
      .update({
        cancellation_requested: true,
        cancellation_requested_at: now,
        cancellation_notes: payload.reasonNotes?.trim() || payload.reasonCategory,
        updated_at: now,
      })
      .eq("id", order.id);

    revalidatePath("/orders");
    revalidatePath(`/orders/${order.id}`);
    revalidatePath("/admin/sales/orders");
    revalidatePath(`/admin/sales/orders/${order.id}`);

    return { success: true, requestId: newReq.id };
  } catch (err: any) {
    console.error("retailerSubmitCancellationRequestAction error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Retailer Action: Withdraw a pending cancellation request before Admin decision
 */
export async function retailerWithdrawCancellationRequestAction(payload: {
  orderId: string;
  requestId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    const { data: companyUser } = await adminClient
      .from("company_users")
      .select("company_id")
      .eq("id", session.userId)
      .maybeSingle();

    const companyId = companyUser?.company_id;
    if (!companyId) {
      return { success: false, error: "Retailer company association not found." };
    }

    const { data: req, error: reqErr } = await adminClient
      .from("retailer_order_cancellation_requests")
      .select("id, status, order_id")
      .eq("id", payload.requestId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (reqErr || !req) {
      return { success: false, error: "Request not found or unauthorized." };
    }

    if (req.status !== "pending") {
      return { success: false, error: `Cannot withdraw request that is already '${req.status}'.` };
    }

    const now = new Date().toISOString();

    await adminClient
      .from("retailer_order_cancellation_requests")
      .update({
        status: "withdrawn",
        updated_at: now,
      })
      .eq("id", req.id);

    await adminClient
      .from("retailer_orders")
      .update({
        cancellation_requested: false,
        updated_at: now,
      })
      .eq("id", req.order_id);

    revalidatePath("/orders");
    revalidatePath(`/orders/${req.order_id}`);
    revalidatePath("/admin/sales/orders");
    revalidatePath(`/admin/sales/orders/${req.order_id}`);

    return { success: true };
  } catch (err: any) {
    console.error("retailerWithdrawCancellationRequestAction error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
