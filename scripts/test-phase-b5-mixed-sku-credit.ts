// scripts/test-phase-b5-mixed-sku-credit.ts
import { calculateCreditExposure } from "../lib/finance/credit-exposure";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${msg}`);
}

console.log("=== TESTING PHASE B5 MIXED-PRICE SKU CREDIT EXPOSURE ===\n");

// Scenario from Section 9:
// Order:
// Line 1: 10 units @ $5.00 = $50.00
// Line 2: 10 units @ $20.00 = $200.00
// Total = $250.00
// Cancel all 10 units of Line 2 ($20.00 SKU).
// Remaining: 10 units of Line 1 ($50.00).
// Expected Unbilled Reservation: $50.00 (NOT $125.00 from flat unit ratio).

const exposure = calculateCreditExposure({
  creditLimit: 1000,
  invoices: [],
  orders: [
    {
      id: "ord-mixed-1",
      order_number: "KSR-2026-MIXED",
      order_status: "processing",
      payment_method: "terms",
      payment_terms: "NET30",
      total_amount: 250,
      subtotal_amount: 250,
      total_ordered_units: 20,
      total_cancelled_units: 10,
      retailer_order_items: [
        {
          quantity: 10,
          quantity_cancelled: 0,
          line_total: 50,
          unit_wholesale_price: 5,
        },
        {
          quantity: 10,
          quantity_cancelled: 10,
          line_total: 200,
          unit_wholesale_price: 20,
        },
      ],
    },
  ],
});

console.log("Result:", {
  creditLimit: exposure.creditLimit,
  unbilledReservation: exposure.unbilledReservation,
  totalExposure: exposure.totalExposure,
  availableCredit: exposure.availableCredit,
});

assert(
  exposure.unbilledReservation === 50,
  `Unbilled reservation is exactly $50.00 (got $${exposure.unbilledReservation})`
);

assert(
  exposure.availableCredit === 950,
  `Available credit is exactly $950.00 ($1000 - $50) (got $${exposure.availableCredit})`
);

console.log("\nMIXED-PRICE SKU CREDIT INVARIANT VERIFIED 100%!");
