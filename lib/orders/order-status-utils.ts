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
