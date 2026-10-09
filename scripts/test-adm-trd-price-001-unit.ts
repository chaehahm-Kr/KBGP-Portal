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

console.log("=== ADM-TRD-PRICE-001-R1 Comprehensive Verification ===\n");

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

// 3. Scenario A: MOQ 10, Base $3.00, 30개부터 2%, 60개부터 5%
console.log("\n3. Scenario A (MOQ 10, Base $3.00, 30개부터 2%, 60개부터 5%):");
const mockProductA = {
  carton_pack_qty: 10,
  trading_wholesale_price: 3.00,
  trading_srp_price: 5.00,
  price_additional_info: {
    retailer_sales_policy: {
      moq: 10,
      base_wholesale_price: 3.00,
      tiers: [
        { multiple: 1, discount_percent: 0, is_published: true },
        { multiple: 3, discount_percent: 2, is_published: true },
        { multiple: 6, discount_percent: 5, is_published: true },
      ],
    },
  },
};

const policyA = resolveRetailerSalesPolicy(mockProductA);

// 10개: $30.00
const calc10 = calculateApplicablePrice(policyA, 10);
assert(calc10.isOrderable === true && calc10.effectiveUnitPrice === 3.00 && calc10.subtotal === 30.00, "Qty 10: unit $3.00, total $30.00");

// 20개: $60.00
const calc20 = calculateApplicablePrice(policyA, 20);
assert(calc20.isOrderable === true && calc20.effectiveUnitPrice === 3.00 && calc20.subtotal === 60.00, "Qty 20: unit $3.00, total $60.00");

// 30개: $88.20 (2% off $3.00 = $2.94)
const calc30 = calculateApplicablePrice(policyA, 30);
assert(calc30.isOrderable === true && calc30.effectiveUnitPrice === 2.94 && calc30.subtotal === 88.20, "Qty 30: unit $2.94, total $88.20");

// 50개: $147.00 (2% off $3.00 = $2.94)
const calc50 = calculateApplicablePrice(policyA, 50);
assert(calc50.isOrderable === true && calc50.effectiveUnitPrice === 2.94 && calc50.subtotal === 147.00, "Qty 50: unit $2.94, total $147.00");

// 60개: $171.00 (5% off $3.00 = $2.85)
const calc60 = calculateApplicablePrice(policyA, 60);
assert(calc60.isOrderable === true && calc60.effectiveUnitPrice === 2.85 && calc60.subtotal === 171.00, "Qty 60: unit $2.85, total $171.00");

// 70개: $199.50 (5% off $3.00 = $2.85)
const calc70 = calculateApplicablePrice(policyA, 70);
assert(calc70.isOrderable === true && calc70.effectiveUnitPrice === 2.85 && calc70.subtotal === 199.50, "Qty 70: unit $2.85, total $199.50");

// 4. Scenario B: 10개부터 $3.00, 30개부터 $2.75 설정 (8.333% discount)
console.log("\n4. Scenario B (10개부터 $3.00, 30개부터 $2.75):");
// $2.75 / $3.00 = 8.3333% discount
const customDiscount = ((3.00 - 2.75) / 3.00) * 100;
const mockProductB = {
  carton_pack_qty: 10,
  trading_wholesale_price: 3.00,
  price_additional_info: {
    retailer_sales_policy: {
      moq: 10,
      base_wholesale_price: 3.00,
      tiers: [
        { multiple: 1, discount_percent: 0, is_published: true },
        { multiple: 3, discount_percent: customDiscount, is_published: true },
      ],
    },
  },
};
const policyB = resolveRetailerSalesPolicy(mockProductB);

// 20개 단가 $3.00 (합계 $60.00)
const calcB20 = calculateApplicablePrice(policyB, 20);
assert(calcB20.effectiveUnitPrice === 3.00 && calcB20.subtotal === 60.00, "20개 단가 $3.00, 합계 $60.00");

// 40개 단가 $2.75 (합계 $110.00)
const calcB40 = calculateApplicablePrice(policyB, 40);
assert(calcB40.effectiveUnitPrice === 2.75 && calcB40.subtotal === 110.00, "40개 단가 $2.75, 합계 $110.00");

// 5. Scenario C: MOQ 10, 기본 단가 $4.85
console.log("\n5. Scenario C (MOQ 10, Base $4.85, 30개 2% $4.75, 60개 5% $4.61):");
const defaultTiersC = generateDefaultPriceTiers(10, 4.85);
assert(defaultTiersC[0].min_qty === 10 && defaultTiersC[0].unit_price === 4.85, "Base: 10개, 단가 $4.85, 합계 $48.50");
assert(defaultTiersC[1].min_qty === 30 && defaultTiersC[1].unit_price === 4.75, "추가 1: 30개, 할인 2%, 단가 $4.75, 합계 $142.50");
assert(defaultTiersC[2].min_qty === 60 && defaultTiersC[2].unit_price === 4.61, "추가 2: 60개, 할인 5%, 단가 $4.61, 합계 $276.60");

const mockProductC = {
  carton_pack_qty: 10,
  trading_wholesale_price: 4.85,
  price_additional_info: {
    retailer_sales_policy: {
      moq: 10,
      base_wholesale_price: 4.85,
      tiers: defaultTiersC,
    },
  },
};
const policyC = resolveRetailerSalesPolicy(mockProductC);
const calcC10 = calculateApplicablePrice(policyC, 10);
assert(calcC10.subtotal === 48.50, "10개 합계 $48.50");
const calcC30 = calculateApplicablePrice(policyC, 30);
assert(calcC30.subtotal === 142.50, "30개 합계 $142.50");
const calcC60 = calculateApplicablePrice(policyC, 60);
assert(calcC60.subtotal === 276.60, "60개 합계 $276.60");

// 6. Scenario D: Promotion Non-Compounding & Precedence
console.log("\n6. Scenario D (Promotion Non-Compounding):");
const promoProductActive = {
  ...mockProductA,
  trading_promo_wholesale_price: 2.80,
  trading_promo_start_date: "2020-01-01",
  trading_promo_end_date: "2030-12-31",
};
const policyPromo = resolveRetailerSalesPolicy(promoProductActive);
const calcPromo = calculateApplicablePrice(policyPromo, 60);
assert(calcPromo.effectiveUnitPrice === 2.80 && calcPromo.subtotal === 168.00 && calcPromo.appliedReason === "promotion", "Active Promo $2.80 wins over Tier 2 $2.85 (total $168.00)");

console.log("\n🎉 ALL ADM-TRD-PRICE-001-R1 UNIT TESTS PASSED SUCCESSFULLY!");
