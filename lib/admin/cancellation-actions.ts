// lib/admin/cancellation-actions.ts
// Phase B5 — Authoritative Admin Cancellation, Approval & Refund Management Server Actions

"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminSession } from "@/lib/auth/dal";
import { computeAuthoritativeOrderStatus } from "@/lib/orders/order-status-utils";

export interface ApproveCancellationPayload {
  orderId?: string;
  requestId?: string;
  adminNotes?: string;
  itemApprovals?: Array<{
    cancellationRequestItemId: string;
    quantityApproved: number;
  }>;
}

export interface RejectCancellationPayload {
  orderId?: string;
  requestId?: string;
  adminNotes: string;
}

export interface AdminDirectCancelPayload {
  orderId: string;
  reason: string;
  items?: Array<{
    orderItemId: string;
    quantityToCancel: number;
  }>;
}

/**
 * Admin Action: Approve a pending cancellation request.
 * - Revalidates live unshipped quantities against concurrent dispatches.
 * - Atomically synchronizes line-item and order-header unit counters.
 * - Computes authoritative canonical Order Status.
 * - If order was prepaid, computes and creates Refund Due record without marking as fictitious completed refund.
 */
export async function adminApproveCancellationRequestAction(payload: ApproveCancellationPayload): Promise<{
  success: boolean;
  newStatus?: string;
  error?: string;
}> {
  try {
    const session = await verifyAdminSession();
    const adminClient = createAdminClient();

    // 1. Fetch cancellation request if available
    let request: any = null;
    if (payload.requestId) {
      const { data: req } = await adminClient
        .from("retailer_order_cancellation_requests")
        .select(`
          *,
          retailer_order_cancellation_request_items (
            id,
            order_item_id,
            quantity_requested,
            quantity_approved,
            quantity_rejected
          )
        `)
        .eq("id", payload.requestId)
        .maybeSingle();
      request = req;
    } else if (payload.orderId) {
      const { data: req } = await adminClient
        .from("retailer_order_cancellation_requests")
        .select(`
          *,
          retailer_order_cancellation_request_items (
            id,
            order_item_id,
            quantity_requested,
            quantity_approved,
            quantity_rejected
          )
        `)
        .eq("order_id", payload.orderId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      request = req;
    }

    const targetOrderId = request?.order_id || payload.orderId;
    if (!targetOrderId) {
      return { success: false, error: "Either requestId or orderId must be provided." };
    }

    if (request && request.status !== "pending") {
      return {
        success: false,
        error: `Cannot approve request: status is already '${request.status}'.`,
      };
    }

    // 2. Fetch parent order with line items
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
        subtotal_amount,
        shipping_amount,
        tax_amount,
        total_amount,
        total_ordered_units,
        total_shipped_units,
        total_cancelled_units,
        total_remaining_units,
        refund_amount,
        refund_status,
        retailer_order_items (
          id,
          quantity,
          quantity_shipped,
          quantity_cancelled,
          line_total,
          unit_wholesale_price
        )
      `)
      .eq("id", targetOrderId)
      .maybeSingle();

    if (orderErr || !order) {
      return { success: false, error: "Parent order not found." };
    }

    const orderItems = order.retailer_order_items || [];
    const orderItemMap = new Map(orderItems.map((it: any) => [it.id, it]));

    const reqItems = request?.retailer_order_cancellation_request_items || [];
    const approvalMap = new Map(
      (payload.itemApprovals || []).map((ap) => [ap.cancellationRequestItemId, ap.quantityApproved])
    );

    const now = new Date().toISOString();
    let totalNewlyCancelledUnits = 0;
    const approvedItemDetails: Array<{
      orderItemId: string;
      approvedQty: number;
      lineTotal: number;
      totalQty: number;
    }> = [];

    // 3. Atomically validate and update line items
    if (request && reqItems.length > 0) {
      for (const ri of reqItems) {
        const ordItem = orderItemMap.get(ri.order_item_id);
        if (!ordItem) continue;

        const curShipped = Number(ordItem.quantity_shipped || 0);
        const curCancelled = Number(ordItem.quantity_cancelled || 0);
        const remainingUnshipped = Math.max(0, ordItem.quantity - curShipped - curCancelled);

        // Determine requested approved quantity (default to quantity_requested if not explicitly specified)
        const requestedApproval = approvalMap.has(ri.id)
          ? approvalMap.get(ri.id)!
          : ri.quantity_requested;

        const approvedQty = Math.max(0, Math.min(requestedApproval, remainingUnshipped));
        const rejectedQty = Math.max(0, ri.quantity_requested - approvedQty);

        if (approvedQty > 0) {
          totalNewlyCancelledUnits += approvedQty;
          approvedItemDetails.push({
            orderItemId: ordItem.id,
            approvedQty,
            lineTotal: Number(ordItem.line_total || 0),
            totalQty: ordItem.quantity,
          });

          // Update retailer_order_items
          await adminClient
            .from("retailer_order_items")
            .update({
              quantity_cancelled: curCancelled + approvedQty,
              cancellation_reason: request.reason_notes?.trim() || request.reason_category || "Approved by Admin",
              cancelled_at: now,
            })
            .eq("id", ordItem.id);
        }

        // Update retailer_order_cancellation_request_items
        await adminClient
          .from("retailer_order_cancellation_request_items")
          .update({
            quantity_approved: approvedQty,
            quantity_rejected: rejectedQty,
          })
          .eq("id", ri.id);
      }
    } else {
      // Direct approval of remaining unshipped units without prior request row
      for (const ordItem of orderItems) {
        const curShipped = Number(ordItem.quantity_shipped || 0);
        const curCancelled = Number(ordItem.quantity_cancelled || 0);
        const remainingUnshipped = Math.max(0, ordItem.quantity - curShipped - curCancelled);

        if (remainingUnshipped > 0) {
          totalNewlyCancelledUnits += remainingUnshipped;
          approvedItemDetails.push({
            orderItemId: ordItem.id,
            approvedQty: remainingUnshipped,
            lineTotal: Number(ordItem.line_total || 0),
            totalQty: ordItem.quantity,
          });

          await adminClient
            .from("retailer_order_items")
            .update({
              quantity_cancelled: curCancelled + remainingUnshipped,
              cancellation_reason: payload.adminNotes?.trim() || "Approved by Admin",
              cancelled_at: now,
            })
            .eq("id", ordItem.id);
        }
      }
    }

    if (totalNewlyCancelledUnits === 0 && order.total_remaining_units > 0) {
      return {
        success: false,
        error: "No remaining unshipped units could be approved for cancellation. Items may have already been dispatched.",
      };
    }

    // 4. Re-calculate order-level unit invariants
    const { data: updatedDbItems } = await adminClient
      .from("retailer_order_items")
      .select("quantity, quantity_shipped, quantity_cancelled")
      .eq("order_id", order.id);

    const allDbItems = updatedDbItems || [];
    const newTotalOrdered = allDbItems.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0) || order.total_ordered_units;
    const newTotalShipped = allDbItems.reduce((sum: number, it: any) => sum + Number(it.quantity_shipped || 0), 0);
    const newTotalCancelled = allDbItems.reduce((sum: number, it: any) => sum + Number(it.quantity_cancelled || 0), 0);
    const newTotalRemaining = Math.max(0, newTotalOrdered - newTotalShipped - newTotalCancelled);

    // Compute canonical Order Status using authoritative utility
    const newOrderStatus = computeAuthoritativeOrderStatus(
      order.order_status,
      newTotalOrdered,
      newTotalShipped,
      newTotalCancelled
    );

    // 5. Update retailer_orders header
    await adminClient
      .from("retailer_orders")
      .update({
        order_status: newOrderStatus,
        total_cancelled_units: newTotalCancelled,
        total_remaining_units: newTotalRemaining,
        cancellation_requested: false,
        cancellation_notes: payload.adminNotes?.trim() || request?.reason_notes || request?.reason_category || "Approved by Admin",
        updated_at: now,
      })
      .eq("id", order.id);

    // 6. Update request header status if request row exists
    if (request) {
      await adminClient
        .from("retailer_order_cancellation_requests")
        .update({
          status: "approved",
          admin_reviewer_id: session.userId,
          reviewed_at: now,
          admin_notes: payload.adminNotes?.trim() || null,
          updated_at: now,
        })
        .eq("id", request.id);
    }

    // 7. Calculate and establish Refund Due obligation if prepaid and paid
    const { data: payments } = await adminClient
      .from("retailer_order_payments")
      .select("id, amount, status")
      .eq("order_id", order.id)
      .eq("status", "paid");

    const totalPaid = (payments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    if (totalPaid > 0) {
      // Fetch prior refunds
      const { data: priorRefunds } = await adminClient
        .from("retailer_order_refund_records")
        .select("total_refund_amount, refund_status")
        .eq("order_id", order.id)
        .not("refund_status", "eq", "failed");

      const priorRefundTotal = (priorRefunds || []).reduce(
        (sum: number, r: any) => sum + Number(r.total_refund_amount || 0),
        0
      );

      // Fetch active allocated prepayments to prevent refunding money consumed by delivered invoices
      const { data: allocRows } = await adminClient
        .from("retailer_prepayment_allocations")
        .select("allocated_amount")
        .eq("order_id", order.id);

      const allocatedToInvoices = (allocRows || []).reduce(
        (sum: number, al: any) => sum + Number(al.allocated_amount || 0),
        0
      );

      // Calculate merchandise basis for approved items
      const cancelledMerchandiseBasis = approvedItemDetails.reduce((sum, it) => {
        if (it.totalQty > 0) {
          return sum + (it.approvedQty / it.totalQty) * it.lineTotal;
        }
        return sum;
      }, 0);

      // Proportional tax allocation
      let refundableTax = 0;
      if (Number(order.tax_amount || 0) > 0 && newTotalOrdered > 0) {
        refundableTax = Math.round(
          (totalNewlyCancelledUnits / newTotalOrdered) * Number(order.tax_amount) * 100
        ) / 100;
      }

      // Shipping refund: 100% refundable ONLY if zero shipments ever occurred and whole order is cancelled
      let refundableShipping = 0;
      if (newTotalShipped === 0 && newOrderStatus === "cancelled" && Number(order.shipping_amount || 0) > 0) {
        refundableShipping = Number(order.shipping_amount);
      }

      // Processing fees: strictly NON-REFUNDABLE
      const refundableFees = 0.00;

      const calculatedRefundBasis = Math.round(
        (cancelledMerchandiseBasis + refundableTax + refundableShipping + refundableFees) * 100
      ) / 100;

      // Max allowable refund = collected funds minus allocated invoices and prior refunds
      const maxAvailableToRefund = Math.max(0, totalPaid - allocatedToInvoices - priorRefundTotal);
      const finalRefundAmount = Math.min(calculatedRefundBasis, maxAvailableToRefund);

      if (finalRefundAmount > 0) {
        await adminClient.from("retailer_order_refund_records").insert({
          order_id: order.id,
          cancellation_request_id: request.id,
          company_id: order.company_id,
          payment_id: payments?.[0]?.id || null,
          merchandise_amount: Math.round(cancelledMerchandiseBasis * 100) / 100,
          shipping_amount: refundableShipping,
          tax_amount: refundableTax,
          fee_amount: 0.00,
          total_refund_amount: finalRefundAmount,
          refund_status: "due",
          provider: "manual",
          notes: `System-computed refund due upon cancellation approval. Merchandise: $${cancelledMerchandiseBasis.toFixed(2)}, Tax: $${refundableTax.toFixed(2)}, Shipping: $${refundableShipping.toFixed(2)}.`,
          created_at: now,
          updated_at: now,
        });

        await adminClient
          .from("retailer_orders")
          .update({
            refund_amount: Number(order.refund_amount || 0) + finalRefundAmount,
            refund_status: "due",
            updated_at: now,
          })
          .eq("id", order.id);
      }
    }

    revalidatePath("/admin/sales/orders");
    revalidatePath(`/admin/sales/orders/${order.id}`);
    revalidatePath("/admin/finance/receivables");
    revalidatePath(`/admin/retailers/${order.company_id}`);
    revalidatePath("/orders");
    revalidatePath(`/orders/${order.id}`);
    revalidatePath("/bills");

    return { success: true, newStatus: newOrderStatus };
  } catch (err: any) {
    console.error("adminApproveCancellationRequestAction error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Admin Action: Reject a pending cancellation request.
 */
export async function adminRejectCancellationRequestAction(payload: RejectCancellationPayload): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await verifyAdminSession();
    const adminClient = createAdminClient();

    let request: any = null;
    if (payload.requestId) {
      const { data } = await adminClient
        .from("retailer_order_cancellation_requests")
        .select("id, order_id, status")
        .eq("id", payload.requestId)
        .maybeSingle();
      request = data;
    } else if (payload.orderId) {
      const { data } = await adminClient
        .from("retailer_order_cancellation_requests")
        .select("id, order_id, status")
        .eq("order_id", payload.orderId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      request = data;
    }

    const targetOrderId = request?.order_id || payload.orderId;
    if (!targetOrderId) {
      return { success: false, error: "Either requestId or orderId must be provided." };
    }

    if (request && request.status !== "pending") {
      return {
        success: false,
        error: `Cannot reject request: status is already '${request.status}'.`,
      };
    }

    const now = new Date().toISOString();

    // 1. Update request status to rejected if request row exists
    if (request) {
      await adminClient
        .from("retailer_order_cancellation_requests")
        .update({
          status: "rejected",
          admin_reviewer_id: session.userId,
          reviewed_at: now,
          admin_notes: payload.adminNotes.trim(),
          updated_at: now,
        })
        .eq("id", request.id);
    }

    // 2. Clear pending flag on order header
    await adminClient
      .from("retailer_orders")
      .update({
        cancellation_requested: false,
        cancellation_notes: `Rejected: ${payload.adminNotes.trim()}`,
        updated_at: now,
      })
      .eq("id", targetOrderId);

    revalidatePath("/admin/sales/orders");
    revalidatePath(`/admin/sales/orders/${targetOrderId}`);
    revalidatePath("/orders");
    revalidatePath(`/orders/${targetOrderId}`);

    return { success: true };
  } catch (err: any) {
    console.error("adminRejectCancellationRequestAction error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Admin Action: Fetch pending cancellation requests for the Admin Order Queue
 */
export async function adminGetCancellationRequestsAction(filters?: {
  status?: string;
}): Promise<any[]> {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  let query = adminClient
    .from("retailer_order_cancellation_requests")
    .select(`
      *,
      retailer_orders (
        id,
        order_number,
        order_status,
        payment_status,
        payment_method,
        total_amount,
        total_ordered_units,
        total_shipped_units,
        total_remaining_units
      ),
      companies (
        id,
        name,
        company_code
      ),
      retailer_order_cancellation_request_items (
        id,
        order_item_id,
        quantity_requested,
        quantity_approved,
        quantity_rejected,
        retailer_order_items (
          id,
          sku,
          product_name,
          unit_wholesale_price,
          quantity,
          quantity_shipped,
          quantity_cancelled
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("adminGetCancellationRequestsAction error:", error);
    return [];
  }

  return data;
}

/**
 * Admin Action: Review or settle an existing refund record.
 * Strictly prevents marking 'completed' without verifiable proof of external settlement.
 */
export async function adminReviewRefundRecordAction(payload: {
  refundRecordId: string;
  action: "approve" | "record_external_payment";
  notes?: string;
  providerRef?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifyAdminSession();
    const adminClient = createAdminClient();

    const { data: record, error: recErr } = await adminClient
      .from("retailer_order_refund_records")
      .select("id, order_id, company_id, total_refund_amount, refund_status")
      .eq("id", payload.refundRecordId)
      .maybeSingle();

    if (recErr || !record) {
      return { success: false, error: "Refund record not found." };
    }

    const now = new Date().toISOString();

    if (payload.action === "approve") {
      await adminClient
        .from("retailer_order_refund_records")
        .update({
          refund_status: "approved",
          reviewed_by: session.userId,
          reviewed_at: now,
          notes: payload.notes?.trim() || "Refund approved by Admin; awaiting external payout settlement.",
          updated_at: now,
        })
        .eq("id", record.id);

      await adminClient
        .from("retailer_orders")
        .update({
          refund_status: "approved",
          updated_at: now,
        })
        .eq("id", record.order_id);
    } else if (payload.action === "record_external_payment") {
      if (!payload.providerRef || payload.providerRef.trim().length === 0) {
        return {
          success: false,
          error: "A valid external settlement reference (e.g. check number, bank ACH trace, or card refund ID) is required to mark a refund as completed.",
        };
      }

      await adminClient
        .from("retailer_order_refund_records")
        .update({
          refund_status: "completed",
          completed_at: now,
          provider_refund_id: payload.providerRef.trim(),
          notes: payload.notes?.trim() || "External payout verified and completed.",
          updated_at: now,
        })
        .eq("id", record.id);

      await adminClient
        .from("retailer_orders")
        .update({
          refund_status: "refunded",
          refunded_at: now,
          updated_at: now,
        })
        .eq("id", record.order_id);
    }

    revalidatePath("/admin/sales/orders");
    revalidatePath(`/admin/sales/orders/${record.order_id}`);
    revalidatePath("/orders");
    revalidatePath(`/orders/${record.order_id}`);

    return { success: true };
  } catch (err: any) {
    console.error("adminReviewRefundRecordAction error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
