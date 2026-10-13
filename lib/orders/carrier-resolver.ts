// lib/orders/carrier-resolver.ts
// Utility for Carrier Auto-Detection, Authoritative Tracking Deep-Links, and Multi-Carton Copy

export interface CarrierInfo {
  key: string;
  name: string;
  trackingUrl: string | null;
}

/**
 * Automatically detects carrier by pattern if carrier string is ambiguous or generic.
 */
export function detectCarrierByTracking(trackingNumber: string): string {
  const clean = trackingNumber.trim().toUpperCase();

  // UPS: 1Z... (18 characters)
  if (/^1Z[0-9A-Z]{16}$/i.test(clean)) {
    return "ups";
  }

  // USPS: 20-22 digits, or starting with 94, 92, 93, 420
  if (/^(94|92|93|420)\d{18,22}$/.test(clean) || /^\d{20,22}$/.test(clean)) {
    return "usps";
  }

  // FedEx: 12, 14, or 15 digits
  if (/^\d{12}$/.test(clean) || /^\d{15}$/.test(clean)) {
    return "fedex";
  }

  // DHL Express: 10 digits
  if (/^\d{10}$/.test(clean)) {
    return "dhl";
  }

  return "carrier";
}

/**
 * Resolves an authoritative, direct tracking URL for the given carrier and tracking number.
 * Adheres strictly to the Anti-Hallucination Carrier Tracking Policy:
 * Provides only verified carrier tracking URLs. Returns null if carrier cannot be deep-linked.
 */
export function resolveCarrierTrackingUrl(
  carrier?: string | null,
  trackingNumber?: string | null,
  providedUrl?: string | null
): string | null {
  if (providedUrl && providedUrl.trim().startsWith("http")) {
    return providedUrl.trim();
  }

  if (!trackingNumber) return null;
  const cleanTrack = trackingNumber.trim();
  if (!cleanTrack) return null;

  const effectiveCarrier = (carrier || detectCarrierByTracking(cleanTrack)).toLowerCase().trim();

  if (effectiveCarrier.includes("ups")) {
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(cleanTrack)}`;
  }
  if (effectiveCarrier.includes("fedex")) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(cleanTrack)}`;
  }
  if (effectiveCarrier.includes("usps") || effectiveCarrier.includes("postal")) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(cleanTrack)}`;
  }
  if (effectiveCarrier.includes("dhl")) {
    return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(cleanTrack)}`;
  }
  if (effectiveCarrier.includes("estes")) {
    return `https://www.estes-express.com/myestes/tracking/pro-number?proNumber=${encodeURIComponent(cleanTrack)}`;
  }
  if (effectiveCarrier.includes("odfl") || effectiveCarrier.includes("old dominion")) {
    return `https://www.odfl.com/trace/Trace.jsp?PRO=${encodeURIComponent(cleanTrack)}`;
  }
  if (effectiveCarrier.includes("rl") || effectiveCarrier.includes("r+l")) {
    return `https://www.rlcarriers.com/freight/shipping/shipment-tracing?pro=${encodeURIComponent(cleanTrack)}`;
  }

  return null;
}

/**
 * Formats a carrier display name cleanly.
 */
export function formatCarrierName(carrier?: string | null): string {
  if (!carrier) return "Standard Freight";
  const c = carrier.toLowerCase().trim();
  if (c.includes("ups")) return "UPS";
  if (c.includes("fedex")) return "FedEx";
  if (c.includes("usps")) return "USPS";
  if (c.includes("dhl")) return "DHL Express";
  if (c.includes("estes")) return "Estes Express (LTL)";
  if (c.includes("odfl")) return "Old Dominion (LTL)";
  if (c.includes("rl") || c.includes("r+l")) return "R+L Carriers (LTL)";
  return carrier;
}
