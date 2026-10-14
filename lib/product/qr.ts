import QRCode from "qrcode";

export const PUBLIC_SITE_BASE_URL =
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "https://www.kselecthub.com";

/**
 * Returns canonical public product URL
 * Strictly product-level; never encodes retailer, store, price, or weekly check session.
 */
export function getCanonicalPublicProductUrl(productId: string): string {
  const base = PUBLIC_SITE_BASE_URL.replace(/\/+$/, "");
  return `${base}/products/${encodeURIComponent(productId)}`;
}

/**
 * Generate SVG string of product QR code for sharp label printing
 */
export async function generateProductQrSvg(productId: string): Promise<string> {
  const url = getCanonicalPublicProductUrl(productId);
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

/**
 * Generate Data URL (PNG base64) of product QR code for <img> elements
 */
export async function generateProductQrDataUrl(productId: string): Promise<string> {
  const url = getCanonicalPublicProductUrl(productId);
  return QRCode.toDataURL(url, {
    margin: 1,
    errorCorrectionLevel: "M",
    width: 256,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

/**
 * Parse QR payload or URL back to canonical productId for future Weekly Check scanner
 */
export function parseKSelectProductQr(payload: string): {
  productId: string | null;
  sku: string | null;
  rawIdentifier: string | null;
  isValid: boolean;
} {
  if (!payload || typeof payload !== "string") {
    return { productId: null, sku: null, rawIdentifier: null, isValid: false };
  }

  const trimmed = payload.trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // 1. Direct UUID format
  if (uuidRegex.test(trimmed)) {
    return { productId: trimmed, sku: null, rawIdentifier: trimmed, isValid: true };
  }

  // 2. URL format: e.g. https://www.kselecthub.com/products/{productIdOrSku}
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const prodIdx = parts.indexOf("products");
    if (prodIdx !== -1 && parts[prodIdx + 1]) {
      const candidate = decodeURIComponent(parts[prodIdx + 1]).trim();
      if (uuidRegex.test(candidate)) {
        return { productId: candidate, sku: null, rawIdentifier: candidate, isValid: true };
      }
      return { productId: null, sku: candidate, rawIdentifier: candidate, isValid: Boolean(candidate) };
    }
  } catch {
    // If not a standard URL, check regex for /products/ segment
    const match = trimmed.match(/\/products\/([^\/\?#\s]+)/i);
    if (match && match[1]) {
      const candidate = decodeURIComponent(match[1]).trim();
      if (uuidRegex.test(candidate)) {
        return { productId: candidate, sku: null, rawIdentifier: candidate, isValid: true };
      }
      return { productId: null, sku: candidate, rawIdentifier: candidate, isValid: Boolean(candidate) };
    }
  }

  // 3. Fallback: treat clean non-empty string as candidate identifier/SKU
  if (trimmed.length >= 2 && !trimmed.includes("\n") && !trimmed.includes("<")) {
    return { productId: null, sku: trimmed, rawIdentifier: trimmed, isValid: true };
  }

  return { productId: null, sku: null, rawIdentifier: null, isValid: false };
}
