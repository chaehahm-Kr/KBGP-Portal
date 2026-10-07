import { describe, expect, it } from "vitest";
import {
  computeCartSummary,
  getNextValidQuantity,
  isValidCartQuantity,
  type CartItem,
} from "@/lib/retailer/cart";

function item(overrides: Partial<CartItem>): CartItem {
  return {
    productId: "p1",
    productName: "상품",
    productNameEn: null,
    brandName: "Brand",
    sku: "SKU-1",
    thumbnailUrl: null,
    wholesalePrice: 10,
    msrp: 20,
    marginPercent: 50,
    quantity: 12,
    casePackQty: 6,
    lineTotal: 0,
    ...overrides,
  };
}

describe("isValidCartQuantity", () => {
  it("requires a positive multiple of the case pack", () => {
    expect(isValidCartQuantity(12, 6)).toBe(true);
    expect(isValidCartQuantity(9, 6)).toBe(false);
    expect(isValidCartQuantity(3, 6)).toBe(false);
    expect(isValidCartQuantity(0, 6)).toBe(false);
  });

  it("treats a missing case pack as 1", () => {
    expect(isValidCartQuantity(5, 0)).toBe(true);
  });
});

describe("getNextValidQuantity", () => {
  it("steps by case pack and never drops below one pack", () => {
    expect(getNextValidQuantity(0, 6, "up")).toBe(6);
    expect(getNextValidQuantity(6, 6, "up")).toBe(12);
    expect(getNextValidQuantity(6, 6, "down")).toBe(6);
    expect(getNextValidQuantity(18, 6, "down")).toBe(12);
  });
});

describe("computeCartSummary", () => {
  it("raises quantities below MOQ and totals line amounts", () => {
    const summary = computeCartSummary([
      item({ quantity: 2, casePackQty: 6, wholesalePrice: 3.33 }),
      item({ productId: "p2", quantity: 24, casePackQty: 12, wholesalePrice: 1.1 }),
    ]);
    expect(summary.items[0].quantity).toBe(6);
    expect(summary.items[0].lineTotal).toBe(19.98);
    expect(summary.items[1].lineTotal).toBe(26.4);
    expect(summary.subtotal).toBe(46.38);
    expect(summary.totalUnits).toBe(30);
    expect(summary.totalSkus).toBe(2);
  });
});
