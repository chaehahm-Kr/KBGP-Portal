// lib/orders/order-status-utils.ts
// Pure utility for Canonical Approved Order Status Computation

import { ApprovedOrderStatus } from "@/lib/admin/orders-types";

/**
 * Computes the authoritative ApprovedOrderStatus from unit metrics and raw status
 * Strictly adheres to Phase B1 & Phase B5 approved business policy:
 * 1. Cancelled: All units cancelled (totalCancelled >= totalOrdered, or 0 shipped & 0 remaining).
 * 2. Partially Cancelled: Some units shipped, ALL remaining units cancelled (remaining === 0 && totalShipped > 0 && totalCancelled > 0).
 * 3. Shipped: All units shipped (totalShipped >= totalOrdered && remaining === 0 && totalCancelled === 0).
 * 4. Partially Shipped: Some units shipped, remaining units pending fulfillment (totalShipped > 0 && remaining > 0).
 * 5. Processing / Submitted: Zero shipped, remaining units pending fulfillment.
 */
export function computeAuthoritativeOrderStatus(
  rawStatus: string,
  totalOrdered: number,
  totalShipped: number,
  totalCancelled: number
): ApprovedOrderStatus {
  const norm = (rawStatus || "").toLowerCase();
  const remaining = Math.max(0, totalOrdered - totalShipped - totalCancelled);

  // 1. Entire order cancelled (or 0 shipped and all ordered units cancelled)
  if (totalCancelled >= totalOrdered && totalOrdered > 0) {
    return "cancelled";
  }
  if (norm === "cancelled" && totalShipped === 0) {
    return "cancelled";
  }

  // 2. Partial shipment with ALL remaining units cancelled (no further dispatch expected)
  if (totalShipped > 0 && remaining === 0 && totalCancelled > 0) {
    return "partially_cancelled";
  }
  if (norm === "partially_cancelled" && remaining === 0) {
    return "partially_cancelled";
  }

  // 3. All ordered units successfully shipped (0 cancelled, 0 remaining)
  if (totalShipped >= totalOrdered && totalOrdered > 0 && totalCancelled === 0) {
    return "shipped";
  }
  if (remaining === 0 && totalShipped > 0 && totalCancelled === 0) {
    return "shipped";
  }

  // 4. Some units shipped, but remaining units are still pending fulfillment
  if (totalShipped > 0 && remaining > 0) {
    return "partially_shipped";
  }

  // 5. Zero units shipped, remaining units pending fulfillment
  if (norm === "processing" || norm === "confirmed") {
    return "processing";
  }

  return "submitted";
}

/**
 * Checks whether an order is operationally completed according to the 4-way quantity invariant:
 * Ordered = Shipped + Cancelled + Remaining (where Remaining === 0).
 * Zero-unit orders are only completed if cancelled, preventing 0/0 arithmetic from marking processing orders as completed.
 */
export function isOrderOperationallyCompleted(ord: {
  orderStatus: ApprovedOrderStatus;
  totalOrderedUnits: number;
  totalShippedUnits: number;
  totalCancelledUnits: number;
  totalRemainingUnits: number;
}): boolean {
  if (ord.totalOrderedUnits === 0) {
    return ord.orderStatus === "cancelled";
  }
  if (ord.totalRemainingUnits > 0) {
    return false;
  }
  if (ord.totalShippedUnits + ord.totalCancelledUnits !== ord.totalOrderedUnits) {
    return false;
  }
  return ["shipped", "cancelled", "partially_cancelled"].includes(ord.orderStatus);
}

/**
 * Calculates whole calendar days open in UTC since order submission.
 */
export function calculateDaysOpenNumber(createdAt: string): number {
  const createdDate = new Date(createdAt);
  const now = new Date();
  const utcCreated = Date.UTC(createdDate.getUTCFullYear(), createdDate.getUTCMonth(), createdDate.getUTCDate());
  const utcNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diff = Math.floor((utcNow - utcCreated) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

