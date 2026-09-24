export interface CartItem {
  productId: string;
  productName: string;
  productNameEn: string | null;
  brandName: string;
  sku: string;
  thumbnailUrl: string | null;
  wholesalePrice: number;
  msrp: number;
  marginPercent: number;
  quantity: number;
  casePackQty: number; // MOQ & order multiple
  lineTotal: number;
}

export interface CartSummary {
  items: CartItem[];
  subtotal: number;
  totalUnits: number;
  totalSkus: number;
}

/**
 * Validate that a quantity is valid given a case pack quantity.
 * Minimum is casePackQty, and quantity must be a multiple of casePackQty.
 */
export function isValidCartQuantity(quantity: number, casePackQty: number): boolean {
  if (!quantity || quantity <= 0) return false;
  const pack = Math.max(1, casePackQty || 1);
  return quantity >= pack && quantity % pack === 0;
}

/**
 * Calculate the next valid quantity step
 */
export function getNextValidQuantity(currentQty: number, casePackQty: number, direction: "up" | "down"): number {
  const pack = Math.max(1, casePackQty || 1);
  if (direction === "up") {
    if (currentQty <= 0) return pack;
    return currentQty + pack;
  } else {
    return Math.max(pack, currentQty - pack);
  }
}

/**
 * Recalculate summary metrics from items
 */
export function computeCartSummary(items: CartItem[]): CartSummary {
  let subtotal = 0;
  let totalUnits = 0;

  const sanitizedItems = items.map((item) => {
    const pack = Math.max(1, item.casePackQty || 1);
    let qty = item.quantity;
    if (qty < pack) qty = pack;
    const lineTotal = Number((qty * item.wholesalePrice).toFixed(2));
    subtotal += lineTotal;
    totalUnits += qty;

    return {
      ...item,
      quantity: qty,
      casePackQty: pack,
      lineTotal,
    };
  });

  return {
    items: sanitizedItems,
    subtotal: Number(subtotal.toFixed(2)),
    totalUnits,
    totalSkus: sanitizedItems.length,
  };
}
