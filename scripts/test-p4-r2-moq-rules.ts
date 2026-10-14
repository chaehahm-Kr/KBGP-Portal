import { normalizeReorderQuantity, isValidMoqOrderQuantity } from "../lib/product/retailer-policy";

console.log("=== Testing P4-R2 MOQ Normalization Rules ===");

const testCases = [
  { name: "Example 1: KLALAB DR120 0 suggested", suggested: 0, moq: 24, multiple: 24, expected: 24 },
  { name: "Example 2: KLALAB DR120 12 suggested (< MOQ)", suggested: 12, moq: 24, multiple: 24, expected: 24 },
  { name: "Example 3: KLALAB DR120 28 suggested (between 24 and 48)", suggested: 28, moq: 24, multiple: 24, expected: 24 },
  { name: "Example 4: KLALAB DR120 50 suggested (between 48 and 72)", suggested: 50, moq: 24, multiple: 24, expected: 48 },
  { name: "Example 5: KLALAB DR120 55 suggested (between 48 and 72)", suggested: 55, moq: 24, multiple: 24, expected: 48 },
  { name: "Extra: MOQ 12, Multiple 6, suggested 15", suggested: 15, moq: 12, multiple: 6, expected: 12 },
  { name: "Extra: MOQ 12, Multiple 6, suggested 20", suggested: 20, moq: 12, multiple: 6, expected: 18 },
  { name: "Extra: MOQ 10, Multiple 5, suggested 0", suggested: 0, moq: 10, multiple: 5, expected: 10 },
  { name: "Extra: MOQ 1, Multiple 1, suggested 3", suggested: 3, moq: 1, multiple: 1, expected: 3 },
  { name: "Extra: Unorderable SKU", suggested: 50, moq: 24, multiple: 24, orderable: false, expected: 0 },
];

let failed = 0;
for (const tc of testCases) {
  const res = normalizeReorderQuantity(tc.suggested, tc.moq, tc.multiple, tc.orderable ?? true);
  const actual = res.normalizedQty;
  const isValid = actual === 0 && tc.orderable === false ? true : isValidMoqOrderQuantity(actual, tc.moq, tc.multiple);
  const pass = actual === tc.expected && isValid;

  if (pass) {
    console.log(`PASS: ${tc.name} -> actual=${actual}, valid=${isValid}`);
  } else {
    console.error(`FAIL: ${tc.name} -> actual=${actual}, expected=${tc.expected}, valid=${isValid}`);
    failed++;
  }
}

if (failed === 0) {
  console.log("\nALL P4-R2 UNIT TESTS PASSED!");
  process.exit(0);
} else {
  console.error(`\n${failed} TESTS FAILED!`);
  process.exit(1);
}
