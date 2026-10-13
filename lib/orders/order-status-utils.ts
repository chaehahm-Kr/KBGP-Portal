// lib/orders/order-status-utils.ts
// Pure utility for Canonical Approved Order Status Computation

import { ApprovedOrderStatus } from "@/lib/admin/orders-types";

/**
 * Computes the authoritative ApprovedOrderStatus from unit metrics and raw status
 */
export function computeAuthoritativeOrderStatus(
  rawStatus: string,
  totalOrdered: number,
  totalShipped: number,
  totalCancelled: number
): ApprovedOrderStatus {
  const norm = (rawStatus || "").toLowerCase();
  if (norm === "cancelled") return "cancelled";
  if (norm === "partially_cancelled") return "partially_cancelled";

  const remaining = Math.max(0, totalOrdered - totalShipped - totalCancelled);

  if (totalCancelled > 0 && remaining > 0 && totalShipped > 0) {
    return "partially_cancelled";
  }

  if (remaining === 0 && totalShipped > 0) {
    return "shipped";
  }

  if (totalShipped > 0 && remaining > 0) {
    return "partially_shipped";
  }

  if (norm === "processing" || norm === "confirmed") {
    return "processing";
  }

  return "submitted";
}
