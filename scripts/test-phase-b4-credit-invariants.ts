import { calculateCreditExposure } from "../lib/finance/credit-exposure";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${message}`);
}

function runTests() {
  console.log("=== PHASE B4 AUTHORITATIVE CREDIT INVARIANT & SCENARIO TESTS ===\n");

  const LIMIT = 10000;

  // -------------------------------------------------------------
  // Scenario A: $10,000 limit, $1,000 submitted order -> Available = $9,000
  // -------------------------------------------------------------
  console.log("--- Scenario A: New Submitted Order ($1,000) ---");
  const expA = calculateCreditExposure({
    creditLimit: LIMIT,
    invoices: [],
    orders: [
      {
        id: "ord-1",
        order_number: "KSR-2026-000101",
        order_status: "submitted",
        payment_method: "terms",
        payment_terms: "net30",
        total_amount: 1000,
      },
    ],
  });

  assert(expA.creditLimit === 10000, "Scenario A: Credit limit is $10,000");
  assert(expA.openAR === 0, "Scenario A: Open AR is $0");
  assert(expA.unbilledReservation === 1000, "Scenario A: Unbilled reservation is $1,000");
  assert(expA.totalExposure === 1000, "Scenario A: Total exposure is $1,000");
  assert(expA.availableCredit === 9000, "Scenario A: Available credit is $9,000");
  assert(expA.overLimitAmount === 0, "Scenario A: Over-limit amount is $0");

  // -------------------------------------------------------------
  // Scenario B: $600 partial dispatch -> Open AR = $600, Reserved = $400, Available = $9,000
  // -------------------------------------------------------------
  console.log("\n--- Scenario B: Partial Dispatch ($600) ---");
  const expB = calculateCreditExposure({
    creditLimit: LIMIT,
    invoices: [
      {
        id: "inv-1",
        order_id: "ord-1",
        total_amount: 600,
        balance_due: 600,
        due_date: "2026-11-13",
        invoice_status: "open",
      },
    ],
    orders: [
      {
        id: "ord-1",
        order_number: "KSR-2026-000101",
        order_status: "partially_shipped",
        payment_method: "terms",
        payment_terms: "net30",
        total_amount: 1000,
      },
    ],
  });

  assert(expB.openAR === 600, "Scenario B: Open AR is $600");
  assert(expB.unbilledReservation === 400, "Scenario B: Unbilled reservation is $400");
  assert(expB.totalExposure === 1000, "Scenario B: Total exposure is $1,000");
  assert(expB.availableCredit === 9000, "Scenario B: Available credit remains $9,000 (no double-counting)");

  // -------------------------------------------------------------
  // Scenario C: Remaining $400 dispatch -> Open AR = $1,000, Reserved = $0, Available = $9,000
  // -------------------------------------------------------------
  console.log("\n--- Scenario C: Second Dispatch ($400) ---");
  const expC = calculateCreditExposure({
    creditLimit: LIMIT,
    invoices: [
      {
        id: "inv-1",
        order_id: "ord-1",
        total_amount: 600,
        balance_due: 600,
        due_date: "2026-11-13",
        invoice_status: "open",
      },
      {
        id: "inv-2",
        order_id: "ord-1",
        total_amount: 400,
        balance_due: 400,
        due_date: "2026-11-20",
        invoice_status: "open",
      },
    ],
    orders: [
      {
        id: "ord-1",
        order_number: "KSR-2026-000101",
        order_status: "shipped",
        payment_method: "terms",
        payment_terms: "net30",
        total_amount: 1000,
      },
    ],
  });

  assert(expC.openAR === 1000, "Scenario C: Open AR is $1,000");
  assert(expC.unbilledReservation === 0, "Scenario C: Unbilled reservation is $0");
  assert(expC.totalExposure === 1000, "Scenario C: Total exposure is $1,000");
  assert(expC.availableCredit === 9000, "Scenario C: Available credit is $9,000");

  // -------------------------------------------------------------
  // Scenario D: Full invoice payment -> Exposure reduced by $1,000, Available = $10,000
  // -------------------------------------------------------------
  console.log("\n--- Scenario D: Full Invoice Payment ($1,000 settled) ---");
  const expD = calculateCreditExposure({
    creditLimit: LIMIT,
    invoices: [
      {
        id: "inv-1",
        order_id: "ord-1",
        total_amount: 600,
        balance_due: 0, // Settled
        due_date: "2026-11-13",
        invoice_status: "paid",
      },
      {
        id: "inv-2",
        order_id: "ord-1",
        total_amount: 400,
        balance_due: 0, // Settled
        due_date: "2026-11-20",
        invoice_status: "paid",
      },
    ],
    orders: [
      {
        id: "ord-1",
        order_number: "KSR-2026-000101",
        order_status: "delivered",
        payment_method: "terms",
        payment_terms: "net30",
        total_amount: 1000,
      },
    ],
  });

  assert(expD.openAR === 0, "Scenario D: Open AR is $0");
  assert(expD.unbilledReservation === 0, "Scenario D: Unbilled reservation is $0");
  assert(expD.totalExposure === 0, "Scenario D: Total exposure is $0");
  assert(expD.availableCredit === 10000, "Scenario D: Available credit is fully restored to $10,000");

  // -------------------------------------------------------------
  // Scenario E: $400 unshipped cancellation -> Remaining reservation released
  // -------------------------------------------------------------
  console.log("\n--- Scenario E: Partial Dispatch ($600) + Cancellation ($400) ---");
  const expE = calculateCreditExposure({
    creditLimit: LIMIT,
    invoices: [
      {
        id: "inv-1",
        order_id: "ord-1",
        total_amount: 600,
        balance_due: 600,
        due_date: "2026-11-13",
        invoice_status: "open",
      },
    ],
    orders: [
      {
        id: "ord-1",
        order_number: "KSR-2026-000101",
        order_status: "partially_cancelled",
        payment_method: "terms",
        payment_terms: "net30",
        total_amount: 1000,
        total_ordered_units: 100,
        total_cancelled_units: 40,
        retailer_order_items: [
          {
            quantity: 100,
            quantity_cancelled: 40,
            line_total: 1000,
          },
        ],
      },
    ],
  });

  assert(expE.openAR === 600, "Scenario E: Open AR is $600");
  assert(expE.unbilledReservation === 0, "Scenario E: Remaining $400 reservation released upon cancellation");
  assert(expE.totalExposure === 600, "Scenario E: Total exposure is $600");
  assert(expE.availableCredit === 9400, "Scenario E: Available credit is $9,400");

  // -------------------------------------------------------------
  // Scenario H: Void invoice -> Removed from Open AR, legitimate liability preserved
  // -------------------------------------------------------------
  console.log("\n--- Scenario H: Void Invoice Handling ---");
  const expH = calculateCreditExposure({
    creditLimit: LIMIT,
    invoices: [
      {
        id: "inv-void",
        order_id: "ord-1",
        total_amount: 500,
        balance_due: 500,
        invoice_status: "void", // Voided!
      },
    ],
    orders: [
      {
        id: "ord-1",
        order_number: "KSR-2026-000101",
        order_status: "submitted",
        payment_method: "terms",
        payment_terms: "net30",
        total_amount: 1000,
      },
    ],
  });

  assert(expH.openAR === 0, "Scenario H: Void invoice is excluded from Open AR");
  assert(expH.unbilledReservation === 1000, "Scenario H: Unbilled reservation preserves full order obligation");
  assert(expH.totalExposure === 1000, "Scenario H: Total exposure is $1,000");
  assert(expH.availableCredit === 9000, "Scenario H: Available credit is $9,000");

  // -------------------------------------------------------------
  // Scenario J: Card / ACH orders -> No Net Terms reservation
  // -------------------------------------------------------------
  console.log("\n--- Scenario J: Card / ACH Prepaid Orders (Zero Reservation) ---");
  const expJ = calculateCreditExposure({
    creditLimit: LIMIT,
    invoices: [],
    orders: [
      {
        id: "ord-card",
        order_number: "KSR-2026-000201",
        order_status: "submitted",
        payment_method: "card",
        payment_terms: "PREPAID_CARD",
        total_amount: 2500,
      },
      {
        id: "ord-ach",
        order_number: "KSR-2026-000202",
        order_status: "processing",
        payment_method: "ach",
        payment_terms: "PREPAID_ACH",
        total_amount: 1500,
      },
    ],
  });

  assert(expJ.unbilledReservation === 0, "Scenario J: Card & ACH orders have strictly $0 unbilled reservation");
  assert(expJ.totalExposure === 0, "Scenario J: Total exposure is $0");
  assert(expJ.availableCredit === 10000, "Scenario J: Available credit remains full $10,000");

  // -------------------------------------------------------------
  // Scenario K: Multiple active dispatch invoices -> Sum all valid balances
  // -------------------------------------------------------------
  console.log("\n--- Scenario K: Multiple Active Dispatch Invoices ---");
  const expK = calculateCreditExposure({
    creditLimit: LIMIT,
    invoices: [
      {
        id: "inv-a",
        order_id: "ord-1",
        total_amount: 300,
        balance_due: 300,
        invoice_status: "open",
      },
      {
        id: "inv-b",
        order_id: "ord-1",
        total_amount: 200,
        balance_due: 150, // Partially paid
        invoice_status: "open",
      },
      {
        id: "inv-c",
        order_id: "ord-2",
        total_amount: 500,
        balance_due: 500,
        invoice_status: "open",
      },
    ],
    orders: [
      {
        id: "ord-1",
        order_number: "KSR-2026-000101",
        order_status: "partially_shipped",
        payment_method: "terms",
        payment_terms: "net30",
        total_amount: 1000, // Invoiced: 300 + 200 = 500 -> remaining unbilled = 500
      },
      {
        id: "ord-2",
        order_number: "KSR-2026-000102",
        order_status: "shipped",
        payment_method: "terms",
        payment_terms: "net30",
        total_amount: 500, // Invoiced: 500 -> remaining unbilled = 0
      },
    ],
  });

  assert(expK.openAR === 950, "Scenario K: Open AR is 300 + 150 + 500 = $950");
  assert(expK.unbilledReservation === 500, "Scenario K: Unbilled reservation is $500 (1000 - 500)");
  assert(expK.totalExposure === 1450, "Scenario K: Total exposure is $1,450");
  assert(expK.availableCredit === 8550, "Scenario K: Available credit is $8,550 (10000 - 1450)");

  // -------------------------------------------------------------
  // Scenario M: Contractual Discounts, Fees, Freight
  // -------------------------------------------------------------
  console.log("\n--- Scenario M: Contractual Discounts, Taxes & Fees ---");
  const expM = calculateCreditExposure({
    creditLimit: LIMIT,
    invoices: [
      {
        id: "inv-m1",
        order_id: "ord-promo",
        total_amount: 450, // Dispatched portion after $50 discount
        balance_due: 450,
        invoice_status: "open",
      },
    ],
    orders: [
      {
        id: "ord-promo",
        order_number: "KSR-2026-000301",
        order_status: "partially_shipped",
        payment_method: "terms",
        payment_terms: "net45",
        total_amount: 900, // Subtotal 1000 - Promo 100 = 900
      },
    ],
  });

  assert(expM.openAR === 450, "Scenario M: Open AR reflects post-discount invoice total ($450)");
  assert(expM.unbilledReservation === 450, "Scenario M: Unbilled reservation reflects remaining post-discount obligation ($450)");
  assert(expM.totalExposure === 900, "Scenario M: Total exposure matches contractual order total ($900)");
  assert(expM.availableCredit === 9100, "Scenario M: Available credit is $9,100");

  // -------------------------------------------------------------
  // Over-limit Edge Case: Total exposure exceeds credit limit
  // -------------------------------------------------------------
  console.log("\n--- Edge Case: Over-Limit Exposure ---");
  const expOver = calculateCreditExposure({
    creditLimit: 5000,
    invoices: [
      {
        id: "inv-big",
        balance_due: 4000,
        total_amount: 4000,
        invoice_status: "open",
      },
    ],
    orders: [
      {
        id: "ord-big",
        order_number: "KSR-2026-000401",
        order_status: "submitted",
        payment_method: "terms",
        payment_terms: "net30",
        total_amount: 2500,
      },
    ],
  });

  assert(expOver.openAR === 4000, "Over-limit: Open AR is $4,000");
  assert(expOver.unbilledReservation === 2500, "Over-limit: Unbilled reservation is $2,500");
  assert(expOver.totalExposure === 6500, "Over-limit: Total exposure is $6,500");
  assert(expOver.availableCredit === 0, "Over-limit: Available credit floored at $0");
  assert(expOver.overLimitAmount === 1500, "Over-limit: Over-limit amount is $1,500 (6500 - 5000)");

  console.log("\n=== ALL AUTHORITATIVE CREDIT INVARIANT TESTS PASSED CLEANLY! ===");
}

runTests();
