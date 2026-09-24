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
  isValid: boolean;
} {
  if (!payload || typeof payload !== "string") {
    return { productId: null, isValid: false };
  }

  const trimmed = payload.trim();

  // 1. Direct UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) {
    return { productId: trimmed, isValid: true };
  }

  // 2. URL format: https://www.kselecthub.com/products/{productId}
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const prodIdx = parts.indexOf("products");
    if (prodIdx !== -1 && parts[prodIdx + 1]) {
      const candidateId = decodeURIComponent(parts[prodIdx + 1]);
      if (uuidRegex.test(candidateId)) {
        return { productId: candidateId, isValid: true };
      }
    }
  } catch {
    // If not a valid standard URL, check regex match on path
    const match = trimmed.match(/\/products\/([0-9a-f-]{36})/i);
    if (match && match[1]) {
      return { productId: match[1], isValid: true };
    }
  }

  return { productId: null, isValid: false };
}
