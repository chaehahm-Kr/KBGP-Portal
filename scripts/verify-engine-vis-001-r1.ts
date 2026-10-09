import { evaluateHubVisibility } from "../lib/product/hub-visibility";
import assert from "assert";

console.log("=== [ADM-TRD-VIS-001-R1] Engine & Transition Test Suite Starting ===\n");

const testResults: Array<{ id: string; name: string; pass: boolean; detail?: string }> = [];

function recordTest(id: string, name: string, pass: boolean, detail?: string) {
  testResults.push({ id, name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} [${id}] ${name}`);
  if (detail) console.log(`   ${detail}`);
}

// -------------------------------------------------------------
// Section 2: Automatic Hold & Recovery State Transition Suite
// -------------------------------------------------------------
console.log("--- SECTION 2: 6 State Transitions Verification ---");

// Base product template with valid published settings
const baseProduct = {
  id: "qa-test-vis-001",
  name: "QA Test Beauty Ampoule 50ml",
  manufacture_sku: "QA-AMP-001",
  letusto_sku: "LET-AMP-001",
  trading_status: "active",
  selection_status: "SELECTED",
  retailer_visibility: "visible",
  trading_wholesale_price: 15.0,
  carton_pack_qty: 10,
  price_additional_info: {
    retailer_sales_policy: {
      base_wholesale_price: 15.0,
      moq: 10,
      tiers: [],
    },
    suggested_retail_price_usd: 30.0,
    cost_price_usd: 5.0,
  },
};

// Transition 1: Visible + No Wholesale Price -> ON_HOLD
{
  const p1 = JSON.parse(JSON.stringify(baseProduct));
  p1.trading_wholesale_price = 0;
  p1.price_additional_info.retailer_sales_policy.base_wholesale_price = 0;

  const res1 = evaluateHubVisibility(p1, 50);
  const pass1 =
    res1.adminVisibility === "visible" &&
    res1.effectiveVisibility === "ON_HOLD" &&
    res1.holdReasons.includes("NO_WHOLESALE_PRICE") &&
    res1.isOrderable === false;
  recordTest(
    "TRANS-01",
    "Visible + No Wholesale Price -> ON_HOLD",
    pass1,
    `Admin: ${res1.adminVisibility}, Effective: ${res1.effectiveVisibility}, HoldReasons: ${res1.holdReasons.join(",")}`
  );
}

// Transition 2: Visible + No Retailer MOQ -> ON_HOLD
{
  const p2 = JSON.parse(JSON.stringify(baseProduct));
  p2.carton_pack_qty = 0;
  p2.moq = 0;
  p2.price_additional_info.retailer_sales_policy.moq = 0;

  const res2 = evaluateHubVisibility(p2, 50);
  const pass2 =
    res2.adminVisibility === "visible" &&
    res2.effectiveVisibility === "ON_HOLD" &&
    res2.holdReasons.includes("NO_MOQ") &&
    res2.isOrderable === false;
  recordTest(
    "TRANS-02",
    "Visible + No Retailer MOQ -> ON_HOLD",
    pass2,
    `Admin: ${res2.adminVisibility}, Effective: ${res2.effectiveVisibility}, HoldReasons: ${res2.holdReasons.join(",")}`
  );
}

// Transition 3: Visible + Both Missing -> ON_HOLD with Both Reasons
{
  const p3 = JSON.parse(JSON.stringify(baseProduct));
  p3.trading_wholesale_price = 0;
  p3.price_additional_info.retailer_sales_policy.base_wholesale_price = 0;
  p3.carton_pack_qty = 0;
  p3.moq = 0;
  p3.price_additional_info.retailer_sales_policy.moq = 0;

  const res3 = evaluateHubVisibility(p3, 50);
  const pass3 =
    res3.adminVisibility === "visible" &&
    res3.effectiveVisibility === "ON_HOLD" &&
    res3.holdReasons.includes("NO_WHOLESALE_PRICE") &&
    res3.holdReasons.includes("NO_MOQ") &&
    res3.holdReasons.length === 2;
  recordTest(
    "TRANS-03",
    "Visible + Both Missing -> ON_HOLD (2 reasons displayed)",
    pass3,
    `HoldReasons: ${res3.holdReasonLabels.join(" & ")}`
  );
}

// Transition 4: Valid Wholesale Price + Valid MOQ saved -> Automatic Recovery to PUBLISHED
{
  const p4 = JSON.parse(JSON.stringify(baseProduct));
  const res4 = evaluateHubVisibility(p4, 50);
  const pass4 =
    res4.adminVisibility === "visible" &&
    res4.effectiveVisibility === "PUBLISHED" &&
    res4.holdReasons.length === 0 &&
    res4.isOrderable === true;
  recordTest(
    "TRANS-04",
    "Valid Price + MOQ Saved -> Automatic Recovery to PUBLISHED",
    pass4,
    `Effective: ${res4.effectiveVisibility}, isOrderable: ${res4.isOrderable}`
  );
}

// Transition 5: Manual Hidden with valid info -> Remains HIDDEN (never auto-promoted)
{
  const p5 = JSON.parse(JSON.stringify(baseProduct));
  p5.retailer_visibility = "hidden";

  const res5 = evaluateHubVisibility(p5, 50);
  const pass5 =
    res5.adminVisibility === "hidden" &&
    res5.effectiveVisibility === "HIDDEN" &&
    res5.isOrderable === false;
  recordTest(
    "TRANS-05",
    "Manual Hidden + Valid Info -> Remains HIDDEN",
    pass5,
    `Admin: ${res5.adminVisibility}, Effective: ${res5.effectiveVisibility}`
  );
}

// Transition 6: Published Product loses Wholesale Price or MOQ -> Reverts to ON_HOLD
{
  const p6 = JSON.parse(JSON.stringify(baseProduct));
  // Initially published
  const initRes = evaluateHubVisibility(p6, 50);
  assert.strictEqual(initRes.effectiveVisibility, "PUBLISHED");

  // Remove wholesale price
  p6.trading_wholesale_price = 0;
  p6.price_additional_info.retailer_sales_policy.base_wholesale_price = 0;
  const revertRes = evaluateHubVisibility(p6, 50);
  const pass6 =
    p6.retailer_visibility === "visible" &&
    revertRes.adminVisibility === "visible" &&
    revertRes.effectiveVisibility === "ON_HOLD" &&
    revertRes.holdReasons.includes("NO_WHOLESALE_PRICE");
  recordTest(
    "TRANS-06",
    "Price removed -> Reverts to ON_HOLD (Admin setting preserved as visible)",
    pass6,
    `Admin Visibility: ${revertRes.adminVisibility}, Effective Visibility: ${revertRes.effectiveVisibility}`
  );
}

// -------------------------------------------------------------
// Section 3: Order & Inventory Condition Suite
// -------------------------------------------------------------
console.log("\n--- SECTION 3: Order & Inventory Conditions Verification ---");

// Case A: Stock = 0 -> Visibility PUBLISHED, isSoldOut = true, OUT_OF_STOCK, orderable = false
{
  const pA = JSON.parse(JSON.stringify(baseProduct));
  const resA = evaluateHubVisibility(pA, 0, "2026-11-15");
  const passA =
    resA.effectiveVisibility === "PUBLISHED" &&
    resA.isSoldOut === true &&
    resA.orderabilityStatus === "OUT_OF_STOCK" &&
    resA.isOrderable === false &&
    resA.restockEta === "2026-11-15";
  recordTest(
    "STOCK-01",
    "Stock = 0 -> Visibility PUBLISHED, Sold Out badge, order blocked, ETA preserved",
    passA,
    `Effective: ${resA.effectiveVisibility}, Status: ${resA.orderabilityStatus}, ETA: ${resA.restockEta}`
  );
}

// Case B: Stock > 0 but < MOQ (e.g. stock 5, MOQ 10) -> Visibility PUBLISHED, INSUFFICIENT_STOCK, orderable = false
{
  const pB = JSON.parse(JSON.stringify(baseProduct));
  pB.carton_pack_qty = 10;
  pB.price_additional_info.retailer_sales_policy.moq = 10;
  const resB = evaluateHubVisibility(pB, 5);
  const passB =
    resB.effectiveVisibility === "PUBLISHED" &&
    resB.isSoldOut === false &&
    resB.orderabilityStatus === "INSUFFICIENT_STOCK" &&
    resB.isOrderable === false;
  recordTest(
    "STOCK-02",
    "Stock 5 < MOQ 10 -> Visibility PUBLISHED, INSUFFICIENT_STOCK, order blocked",
    passB,
    `Status: ${resB.orderabilityStatus}, Reason: ${resB.orderabilityReason}`
  );
}

// Case C: Stock >= MOQ (e.g. stock 50, MOQ 10) -> Visibility PUBLISHED, ORDERABLE, orderable = true
{
  const pC = JSON.parse(JSON.stringify(baseProduct));
  pC.carton_pack_qty = 10;
  pC.price_additional_info.retailer_sales_policy.moq = 10;
  const resC = evaluateHubVisibility(pC, 50);
  const passC =
    resC.effectiveVisibility === "PUBLISHED" &&
    resC.isSoldOut === false &&
    resC.orderabilityStatus === "ORDERABLE" &&
    resC.isOrderable === true;
  recordTest(
    "STOCK-03",
    "Stock 50 >= MOQ 10 -> Visibility PUBLISHED, ORDERABLE, order allowed",
    passC,
    `Status: ${resC.orderabilityStatus}, isOrderable: ${resC.isOrderable}`
  );
}

// Case D: Missing SRP or Missing Cost Price alone does NOT block visibility or orderability
{
  const pD = JSON.parse(JSON.stringify(baseProduct));
  pD.price_additional_info.suggested_retail_price_usd = 0;
  pD.estimated_retail_price = 0;
  pD.price_additional_info.cost_price_usd = 0;
  pD.cost_price_usd = 0;

  const resD = evaluateHubVisibility(pD, 50);
  const passD =
    resD.effectiveVisibility === "PUBLISHED" &&
    resD.isOrderable === true &&
    resD.orderabilityStatus === "ORDERABLE";
  recordTest(
    "PRICE-01",
    "Missing SRP & Cost Price -> Hub Visibility & Orderability Maintained",
    passD,
    `Effective: ${resD.effectiveVisibility}, isOrderable: ${resD.isOrderable}`
  );
}

// Case E: Historical / Terminated status blocks visibility
{
  const pE = JSON.parse(JSON.stringify(baseProduct));
  pE.trading_status = "historical";

  const resE = evaluateHubVisibility(pE, 50);
  const passE =
    resE.effectiveVisibility === "ON_HOLD" &&
    resE.holdReasons.includes("INACTIVE_OPERATION") &&
    resE.isOrderable === false;
  recordTest(
    "STATUS-01",
    "Historical Status -> Hub Visibility ON_HOLD (Inactive Operation)",
    passE,
    `HoldReasons: ${resE.holdReasons.join(",")}`
  );
}

// Case F: Undetermined Restock ETA (null)
{
  const pF = JSON.parse(JSON.stringify(baseProduct));
  const resF = evaluateHubVisibility(pF, 0, null);
  const passF =
    resF.isSoldOut === true &&
    resF.restockEta === null;
  recordTest(
    "ETA-01",
    "No confirmed restock date -> restockEta null (일정 미정)",
    passF,
    `ETA: ${resF.restockEta ?? "일정 미정"}`
  );
}

console.log("\n--- SUITE SUMMARY ---");
const total = testResults.length;
const passed = testResults.filter((t) => t.pass).length;
console.log(`Total: ${total}, Passed: ${passed}, Failed: ${total - passed}`);

if (passed !== total) {
  process.exit(1);
} else {
  console.log("\n ALL 12 ENGINE VERIFICATION TESTS PASSED SUCCESSFULLY!");
}
