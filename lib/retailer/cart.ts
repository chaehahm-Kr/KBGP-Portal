import {
  type ResolvedRetailerSalesPolicy,
  calculateApplicablePrice,
} from "@/lib/product/retailer-policy";

export interface CartItem {
  productId: string;
  productName: string;
  productNameEn: string | null;
  brandName: string;
  sku: string;
  thumbnailUrl: string | null;
  wholesalePrice: number;
  baseWholesalePrice?: number;
  msrp: number;
  marginPercent: number;
  quantity: number;
  casePackQty: number; // MOQ & order multiple
  moq?: number;
  orderMultiple?: number;
  cartonPackQty?: number;
  lineTotal: number;
  availableStock?: number;
  salesPolicy?: ResolvedRetailerSalesPolicy;
  discountPercent?: number;
  appliedReason?: string;
  targetStoreId?: string;
  targetStoreName?: string;
}

export interface CartSummary {
  items: CartItem[];
  subtotal: number;
  totalUnits: number;
  totalSkus: number;
}

/**
 * Validate that a quantity is valid given an MOQ/case pack quantity.
 * Minimum is MOQ (or casePackQty), and quantity must be a multiple of casePackQty/orderMultiple.
 */
export function isValidCartQuantity(quantity: number, casePackQty: number, moq?: number): boolean {
  if (!quantity || quantity <= 0) return false;
  const multiple = Math.max(1, casePackQty || 1);
  const minQty = Math.max(multiple, moq || multiple);
  return quantity >= minQty && quantity % multiple === 0;
}

/**
 * Calculate the next valid quantity step
 */
export function getNextValidQuantity(currentQty: number, casePackQty: number, direction: "up" | "down", moq?: number): number {
  const multiple = Math.max(1, casePackQty || 1);
  const minQty = Math.max(multiple, moq || multiple);
  if (direction === "up") {
    if (currentQty <= 0) return minQty;
    return currentQty + multiple;
  } else {
    return Math.max(minQty, currentQty - multiple);
  }
}

/**
 * Recalculate summary metrics from items with dynamic Tier & Promo price resolution.
 * Automatically aligns quantities and case packs with policy MOQ and orderMultiple.
 */
export function computeCartSummary(items: CartItem[]): CartSummary {
  let subtotal = 0;
  let totalUnits = 0;

  const sanitizedItems = items.map((item) => {
    const policyMoq = item.salesPolicy?.moq ?? item.moq ?? item.casePackQty ?? 1;
    const policyMultiple = item.salesPolicy?.orderMultiple ?? item.orderMultiple ?? policyMoq;
    const safeMoq = Math.max(1, Math.floor(policyMoq || 1));
    const safeMultiple = Math.max(1, Math.floor(policyMultiple || safeMoq || 1));
    const minValidQty = Math.ceil(safeMoq / safeMultiple) * safeMultiple;

    let qty = item.quantity;
    if (qty < minValidQty) {
      qty = minValidQty;
    } else {
      const rem = qty % safeMultiple;
      if (rem !== 0) {
        // Snap to valid multiple (floor non-conforming numbers like 50 -> 48 for KLALAB DR120)
        qty = Math.max(minValidQty, Math.floor(qty / safeMultiple) * safeMultiple);
      }
    }

    let effectivePrice = item.wholesalePrice;
    let discountPercent = item.discountPercent || 0;
    let appliedReason = item.appliedReason || "base_moq";
    let marginPercent = item.marginPercent;

    if (item.salesPolicy && item.salesPolicy.isConfigured) {
      const calc = calculateApplicablePrice(item.salesPolicy, qty);
      effectivePrice = calc.effectiveUnitPrice;
      discountPercent = calc.discountPercent;
      appliedReason = calc.appliedReason;
      if (calc.retailerMarginPercent !== null) {
        marginPercent = calc.retailerMarginPercent;
      }
    }

    const lineTotal = Math.round((qty * effectivePrice + Number.EPSILON) * 100) / 100;
    subtotal += lineTotal;
    totalUnits += qty;

    return {
      ...item,
      quantity: qty,
      casePackQty: safeMultiple,
      moq: safeMoq,
      orderMultiple: safeMultiple,
      wholesalePrice: effectivePrice,
      discountPercent,
      appliedReason,
      marginPercent,
      lineTotal,
    };
  });

  return {
    items: sanitizedItems,
    subtotal: Math.round((subtotal + Number.EPSILON) * 100) / 100,
    totalUnits,
    totalSkus: sanitizedItems.length,
  };
}
