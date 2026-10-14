// scripts/test-phase-b5-order-status.ts
import { computeAuthoritativeOrderStatus } from "../lib/orders/order-status-utils";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${msg}`);
}

console.log("=== TESTING PHASE B5 CANONICAL ORDER STATUS CALCULATIONS ===\n");

// Case 1: 100 ordered / 100 shipped / 0 cancelled => Shipped
assert(
  computeAuthoritativeOrderStatus("processing", 100, 100, 0) === "shipped",
  "100 ordered / 100 shipped / 0 cancelled => Shipped"
);

// Case 2: 100 ordered / 60 shipped / 40 cancelled => Partially Cancelled
assert(
  computeAuthoritativeOrderStatus("partially_shipped", 100, 60, 40) === "partially_cancelled",
  "100 ordered / 60 shipped / 40 cancelled => Partially Cancelled"
);

// Case 3: 100 ordered / 0 shipped / 100 cancelled => Cancelled
assert(
  computeAuthoritativeOrderStatus("submitted", 100, 0, 100) === "cancelled",
  "100 ordered / 0 shipped / 100 cancelled => Cancelled"
);

// Case 4: 100 ordered / 60 shipped / 0 cancelled (40 remaining) => Partially Shipped
assert(
  computeAuthoritativeOrderStatus("processing", 100, 60, 0) === "partially_shipped",
  "100 ordered / 60 shipped / 0 cancelled => Partially Shipped"
);

// Case 5: 100 ordered / 0 shipped / 20 cancelled / 80 remaining => processing (if processing)
assert(
  computeAuthoritativeOrderStatus("processing", 100, 0, 20) === "processing",
  "100 ordered / 0 shipped / 20 cancelled / 80 remaining => Processing"
);

// Case 5b: 100 ordered / 0 shipped / 20 cancelled / 80 remaining => submitted (if submitted)
assert(
  computeAuthoritativeOrderStatus("submitted", 100, 0, 20) === "submitted",
  "100 ordered / 0 shipped / 20 cancelled / 80 remaining => Submitted"
);

// Case 6: 100 ordered / 60 shipped / 20 cancelled / 20 remaining => Partially Shipped
assert(
  computeAuthoritativeOrderStatus("partially_shipped", 100, 60, 20) === "partially_shipped",
  "100 ordered / 60 shipped / 20 cancelled / 20 remaining => Partially Shipped"
);

console.log("\nALL ORDER STATUS INVARIANTS PASSED 100%!");
