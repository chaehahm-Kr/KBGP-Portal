import {
  calculateTierUnitPrice,
  isValidMoqOrderQuantity,
  generateDefaultPriceTiers,
  resolveRetailerSalesPolicy,
  calculateApplicablePrice,
} from "../lib/product/retailer-policy";
import { validateLetustoSku, isValidLetustoSkuFormat } from "../lib/product/sku-utils";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

console.log("=== ADM-TRD-PRICE-001 Verification Test ===\n");

// 1. SKU Normalization & Validation
console.log("1. Letusto SKU Validation & Normalization:");
assert(isValidLetustoSkuFormat("LET-KSM-001") === true, "Valid SKU with hyphens");
assert(isValidLetustoSkuFormat("ABC123XYZ") === true, "Valid alphanumeric SKU");
assert(isValidLetustoSkuFormat("abc-123") === false, "Lowercase SKU raw format check");
assert(validateLetustoSku(" let-ksm-001 ").normalizedSku === "LET-KSM-001", "Normalized lowercase and trimmed");
assert(validateLetustoSku("INVALID_CHAR!").isValid === false, "Special character rejected");
assert(validateLetustoSku("한글SKU").isValid === false, "Non-ASCII rejected");

// 2. MOQ & Multiple Validation
console.log("\n2. MOQ & Order Multiple Batch Rules (MOQ = 10):");
assert(isValidMoqOrderQuantity(10, 10) === true, "Qty 10 with MOQ 10 is valid");
assert(isValidMoqOrderQuantity(20, 10) === true, "Qty 20 with MOQ 10 is valid");
assert(isValidMoqOrderQuantity(30, 10) === true, "Qty 30 with MOQ 10 is valid");
assert(isValidMoqOrderQuantity(5, 10) === false, "Qty 5 with MOQ 10 is rejected (below MOQ)");
assert(isValidMoqOrderQuantity(14, 10) === false, "Qty 14 with MOQ 10 is rejected (not multiple)");
assert(isValidMoqOrderQuantity(25, 10) === false, "Qty 25 with MOQ 10 is rejected (not multiple)");

// 3. Default Tier Generation (MOQ = 10, Base = $30.00)
console.log("\n3. Tier Price Generation (MOQ = 10, Base = $30.00):");
const tiers = generateDefaultPriceTiers(10, 30.00);
assert(tiers.length === 3, "Generates 3 default tiers");
assert(tiers[0].min_qty === 10 && tiers[0].discount_percent === 0 && tiers[0].unit_price === 30.00, "Tier Base: 10 qty, 0%, $30.00");
assert(tiers[1].min_qty === 30 && tiers[1].discount_percent === 2 && tiers[1].unit_price === 29.40, "Tier 1: 30 qty, 2%, $29.40");
assert(tiers[2].min_qty === 60 && tiers[2].discount_percent === 5 && tiers[2].unit_price === 28.50, "Tier 2: 60 qty, 5%, $28.50");

// 4. Policy Resolution & Authoritative Price Calculations
console.log("\n4. Applicable Price Calculations across Quantities:");
const mockProduct = {
  carton_pack_qty: 10,
  trading_wholesale_price: 30.00,
  trading_srp_price: 50.00,
  price_additional_info: {
    retailer_sales_policy: {
      moq: 10,
      base_wholesale_price: 30.00,
      tiers: [
        { multiple: 1, discount_percent: 0, is_published: true },
        { multiple: 3, discount_percent: 2, is_published: true },
        { multiple: 6, discount_percent: 5, is_published: true },
      ],
    },
  },
};

const policy = resolveRetailerSalesPolicy(mockProduct);

// Test Quantity 10: 10 * 30.00 = 300.00
const calc10 = calculateApplicablePrice(policy, 10);
assert(calc10.isOrderable === true && calc10.effectiveUnitPrice === 30.00 && calc10.subtotal === 300.00, "Qty 10: unit $30.00, total $300.00");

// Test Quantity 20: 20 * 30.00 = 600.00
const calc20 = calculateApplicablePrice(policy, 20);
assert(calc20.isOrderable === true && calc20.effectiveUnitPrice === 30.00 && calc20.subtotal === 600.00, "Qty 20: unit $30.00, total $600.00");

// Test Quantity 30: 30 * 29.40 = 882.00 (2% discount)
const calc30 = calculateApplicablePrice(policy, 30);
assert(calc30.isOrderable === true && calc30.effectiveUnitPrice === 29.40 && calc30.subtotal === 882.00, "Qty 30: unit $29.40, total $882.00");

// Test Quantity 50: 50 * 29.40 = 1470.00 (2% discount)
const calc50 = calculateApplicablePrice(policy, 50);
assert(calc50.isOrderable === true && calc50.effectiveUnitPrice === 29.40 && calc50.subtotal === 1470.00, "Qty 50: unit $29.40, total $1,470.00");

// Test Quantity 60: 60 * 28.50 = 1710.00 (5% discount)
const calc60 = calculateApplicablePrice(policy, 60);
assert(calc60.isOrderable === true && calc60.effectiveUnitPrice === 28.50 && calc60.subtotal === 1710.00, "Qty 60: unit $28.50, total $1,710.00");

// Test Quantity 70: 70 * 28.50 = 1995.00 (5% discount)
const calc70 = calculateApplicablePrice(policy, 70);
assert(calc70.isOrderable === true && calc70.effectiveUnitPrice === 28.50 && calc70.subtotal === 1995.00, "Qty 70: unit $28.50, total $1,995.00");

// 5. Promotion Non-Compounding Rules
console.log("\n5. Promotion Non-Compounding & Precedence:");
// Case A: Active promo $28.00 (lower than Tier 2 $28.50) -> Promo wins
const promoProductA = {
  ...mockProduct,
  trading_promo_wholesale_price: 28.00,
  trading_promo_start_date: "2020-01-01",
  trading_promo_end_date: "2030-12-31",
};
const policyPromoA = resolveRetailerSalesPolicy(promoProductA);
const calcPromoA = calculateApplicablePrice(policyPromoA, 60);
assert(calcPromoA.effectiveUnitPrice === 28.00 && calcPromoA.appliedReason === "promotion", "Promo $28.00 wins over Tier 2 $28.50");

// Case B: Active promo $29.00 (higher than Tier 2 $28.50) -> Tier 2 wins
const promoProductB = {
  ...mockProduct,
  trading_promo_wholesale_price: 29.00,
  trading_promo_start_date: "2020-01-01",
  trading_promo_end_date: "2030-12-31",
};
const policyPromoB = resolveRetailerSalesPolicy(promoProductB);
const calcPromoB = calculateApplicablePrice(policyPromoB, 60);
assert(calcPromoB.effectiveUnitPrice === 28.50 && calcPromoB.appliedReason === "tier_quantity", "Tier 2 $28.50 wins over Promo $29.00 (lowest price)");

console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");
