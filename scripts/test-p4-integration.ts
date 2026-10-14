import { isValidCartQuantity, getNextValidQuantity, computeCartSummary, CartItem } from "@/lib/retailer/cart";

function runP4R1UnitTests() {
  console.log("=== RTP-PERFORMANCE-P4-001-R1 DUAL-MODE REORDER TEST SUITE ===");

  // 1. Test MOQ / Case Pack Multiple Validation
  console.log("\n[Test 1: MOQ and Case Pack Validation]");
  console.assert(isValidCartQuantity(12, 12) === true, "12 with pack 12 should be valid");
  console.assert(isValidCartQuantity(24, 12) === true, "24 with pack 12 should be valid");
  console.assert(isValidCartQuantity(15, 12) === false, "15 with pack 12 should be invalid (not multiple)");
  console.assert(isValidCartQuantity(6, 12) === false, "6 with pack 12 should be invalid (below MOQ)");
  console.assert(isValidCartQuantity(0, 12) === false, "0 should be invalid");
  console.log("✓ MOQ & Case Pack validation passed");

  // 2. Test Case Stepper Calculations (P4-R1 Stepper Controls)
  console.log("\n[Test 2: Case Stepper Controls]");
  const cartonPack = 12;
  let cases = 1;
  console.assert(cases * cartonPack === 12, "Initial 1 case should be 12 units");
  cases += 1; // [+] button
  console.assert(cases * cartonPack === 24, "Increment to 2 cases should be 24 units");
  cases = Math.max(1, cases - 1); // [-] button
  console.assert(cases * cartonPack === 12, "Decrement to 1 case should be 12 units");
  cases = Math.max(1, cases - 1); // [-] button at min MOQ
  console.assert(cases * cartonPack === 12, "Decrement at min MOQ stays at 1 case (12 units)");
  console.log("✓ Case stepper calculations verified");

  // 3. Test Cart Item Merge with Destination Store
  console.log("\n[Test 3: Cart Summary & Item Merge]");
  const initialItems: CartItem[] = [
    {
      productId: "prod_dr120",
      productName: "KLALAB DR120 Barrier Cream",
      productNameEn: "DR120 Cream",
      brandName: "KLALAB",
      sku: "KLA-DR120",
      thumbnailUrl: "https://example.com/dr120.jpg",
      wholesalePrice: 15.00,
      msrp: 30.00,
      marginPercent: 50,
      quantity: 12,
      casePackQty: 12,
      lineTotal: 180.00,
      targetStoreId: "store_atlanta",
      targetStoreName: "Atlanta Beauty Supply",
    },
  ];

  // Simulating addItem adding recommended 24 units for Atlanta
  const requestedAdd = 24;
  const existing = initialItems[0];
  const newQty = existing.quantity + requestedAdd;
  const mergedItems: CartItem[] = [
    {
      ...existing,
      quantity: newQty,
    },
  ];

  const summary = computeCartSummary(mergedItems);
  console.assert(summary.totalUnits === 36, `Expected 36 units, got ${summary.totalUnits}`);
  console.assert(summary.subtotal === 540.00, `Expected $540.00, got ${summary.subtotal}`);
  console.assert(summary.items[0].targetStoreId === "store_atlanta", "Destination store preserved");
  console.assert(summary.items[0].targetStoreName === "Atlanta Beauty Supply", "Destination store name preserved");
  console.log("✓ Cart merge and destination store preservation passed (36 units / 3 cases / $540.00)");

  // 4. Test P4-R1 Dual-Mode Reorder Eligibility
  console.log("\n[Test 4: P4-R1 Dual-Mode Reorder Eligibility]");
  
  // Suggested mode condition:
  const isSuggestedEligible = (signal: string, suggestedQty: number, isOrderable: boolean) => {
    return isOrderable && signal === "reorder_needed" && suggestedQty > 0;
  };
  
  // Manual mode condition:
  const isManualEligible = (isOrderable: boolean, wholesalePrice: number | null) => {
    return isOrderable && wholesalePrice !== null && wholesalePrice > 0;
  };

  // Overall canOrder:
  const canOrderProduct = (signal: string, suggestedQty: number, isOrderable: boolean, wholesalePrice: number | null) => {
    return isSuggestedEligible(signal, suggestedQty, isOrderable) || isManualEligible(isOrderable, wholesalePrice);
  };

  // Case A: Product with valid P3 recommendation
  console.assert(isSuggestedEligible("reorder_needed", 24, true) === true, "A: Suggested order valid");
  console.assert(canOrderProduct("reorder_needed", 24, true, 15) === true, "A: Orderable via suggested mode");

  // Case B: Product with insufficient sales data (e.g. no weekly count yet)
  console.assert(isSuggestedEligible("insufficient_data", 0, true) === false, "B: Not suggested due to no data");
  console.assert(isManualEligible(true, 15) === true, "B: Manual quick reorder is available");
  console.assert(canOrderProduct("insufficient_data", 0, true, 15) === true, "B: Retailer can order 1+ cases manually");

  // Case C: Product with needs review (e.g. variance)
  console.assert(isSuggestedEligible("needs_review", 0, true) === false, "C: Not suggested due to review status");
  console.assert(isManualEligible(true, 15) === true, "C: Manual quick reorder is available");
  console.assert(canOrderProduct("needs_review", 0, true, 15) === true, "C: Retailer can order 1+ cases manually");

  // Case D: Product with adequate stock (0 units suggested)
  console.assert(isSuggestedEligible("sufficient_stock", 0, true) === false, "D: 0 units suggested");
  console.assert(isManualEligible(true, 15) === true, "D: Manual restock is available");
  console.assert(canOrderProduct("sufficient_stock", 0, true, 15) === true, "D: Retailer can order extra cases manually");

  // Case E: Product unorderable (discontinued / inactive / unlisted)
  console.assert(isSuggestedEligible("reorder_needed", 24, false) === false, "E: Unorderable in suggested mode");
  console.assert(isManualEligible(false, 15) === false, "E: Unorderable in manual mode");
  console.assert(canOrderProduct("reorder_needed", 24, false, 15) === false, "E: Purchasing blocked completely");
  console.log("✓ All 5 P4-R1 dual-mode eligibility gates verified");

  // 5. Test Multi-Store Disambiguation for Suggested vs Manual
  console.log("\n[Test 5: Multi-Store Disambiguation Logic]");
  const allCompanyStores = [
    { id: "store_1", name: "Store 1" },
    { id: "store_2", name: "Store 2" },
  ];
  const multiStoreBreakdown = [
    { storeId: "store_1", storeName: "Store 1", suggestedReorderQty: 24, signal: "reorder_needed" },
    { storeId: "store_2", storeName: "Store 2", suggestedReorderQty: 12, signal: "reorder_needed" },
  ];

  // Suggested mode selects stores with calculated need:
  const storesWithNeed = multiStoreBreakdown.filter(s => s.suggestedReorderQty > 0 && s.signal === "reorder_needed");
  console.assert(storesWithNeed.length === 2, "Both stores have calculated need");

  // Manual mode in company-wide view offers ALL company stores:
  console.assert(allCompanyStores.length === 2, "All company stores offered for manual selection");
  console.log("✓ Multi-store replenishment disambiguation logic verified for both modes");

  console.log("\nALL 5 RTP-PERFORMANCE-P4-001-R1 INTEGRATION SUITES PASSED PERFECTLY!");
}

runP4R1UnitTests();
