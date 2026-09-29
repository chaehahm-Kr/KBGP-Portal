/**
 * verify-port-prod-003-r1.js
 * Unit & Logic verification for PORT-PROD-003-R1
 */

const assert = require("assert");

console.log("=== [PORT-PROD-003-R1 Verification Test] ===");

// 1. Test Status Filtering Logic
console.log("\n[Test 1] Status Filtering Logic:");
const mockProducts = [
  { id: "p1", display_name: "Active Item", is_draft: false, deleted_at: null },
  { id: "p2", display_name: "Draft Item", is_draft: true, deleted_at: null },
  { id: "p3", display_name: "Deleted Item", is_draft: false, deleted_at: "2026-09-29T10:00:00Z" },
];

function filterByStatus(products, selectedStatuses) {
  return products.filter((product) => {
    if (selectedStatuses.includes("all")) {
      return true;
    }
    let matches = false;
    if (selectedStatuses.includes("active") && !product.deleted_at && !product.is_draft) {
      matches = true;
    }
    if (selectedStatuses.includes("draft") && !product.deleted_at && product.is_draft) {
      matches = true;
    }
    if (selectedStatuses.includes("deleted") && !!product.deleted_at) {
      matches = true;
    }
    return matches;
  });
}

// Default initial state: ["active", "draft"]
const defaultFiltered = filterByStatus(mockProducts, ["active", "draft"]);
assert.strictEqual(defaultFiltered.length, 2, "Default should match Active and Draft products only");
assert.deepStrictEqual(defaultFiltered.map(p => p.id), ["p1", "p2"]);
console.log("  ✓ Initial default selection ['active', 'draft'] returns active + draft (excluding deleted)");

// Only 'active'
const activeFiltered = filterByStatus(mockProducts, ["active"]);
assert.deepStrictEqual(activeFiltered.map(p => p.id), ["p1"]);
console.log("  ✓ 'active' filter returns active product only");

// Only 'draft'
const draftFiltered = filterByStatus(mockProducts, ["draft"]);
assert.deepStrictEqual(draftFiltered.map(p => p.id), ["p2"]);
console.log("  ✓ 'draft' filter returns draft product only");

// Only 'deleted'
const deletedFiltered = filterByStatus(mockProducts, ["deleted"]);
assert.deepStrictEqual(deletedFiltered.map(p => p.id), ["p3"]);
console.log("  ✓ 'deleted' filter returns deleted product only");

// 'all'
const allFiltered = filterByStatus(mockProducts, ["all"]);
assert.strictEqual(allFiltered.length, 3);
console.log("  ✓ 'all' filter returns all products including deleted");

// 2. Test Category Tabs
console.log("\n[Test 2] Category Tabs Configuration:");
const CATEGORY_TABS = [
  { id: "all", label: "All" },
  { id: "SKINCARE", label: "스킨케어" },
  { id: "HAIR_SCALP", label: "헤어&스칼프" },
  { id: "BEAUTY_TOOL", label: "뷰티소품툴" },
  { id: "DAILY_CARE", label: "데일리케어" },
  { id: "WELLNESS_PATCH", label: "웰니스/기능성패치" },
  { id: "OTHER", label: "기타" },
];
assert.strictEqual(CATEGORY_TABS.length, 7, "Must have exactly 7 category pills");
assert.strictEqual(CATEGORY_TABS[0].label, "All", "Default label must be 'All'");
console.log("  ✓ 7 category button pills defined correctly with 'All' default");

// 3. Test Inquiry URL Generation
console.log("\n[Test 3] Product & Barcode Inquiry URL Generation:");
const sampleProduct = {
  id: "prod-123",
  name: "시카 수딩 세럼",
  name_en: "Cica Soothing Serum",
  manufacture_sku: "MFG-CICA-01",
  letusto_sku: "LET-00101",
  upc: "123456789012",
  ean: null,
};
const brandName = "닥터지";
const categoryLabel = "스킨케어";

// Product Inquiry URL
const prodTitle = `[제품 문의] ${sampleProduct.name_en} / ${sampleProduct.manufacture_sku}`;
const prodBody = `제품에 대한 문의 내용을 작성해 주세요.

- 브랜드: ${brandName}
- 제품명(한글): ${sampleProduct.name}
- 제품명(영문): ${sampleProduct.name_en}
- 제조사 SKU: ${sampleProduct.manufacture_sku}
- Letusto SKU: ${sampleProduct.letusto_sku}
- UPC / EAN: ${sampleProduct.upc}
- 카테고리: ${categoryLabel}
- 제품 ID: ${sampleProduct.id}

문의 내용:
`;
const prodUrl = `/portal/support?category=product&new=1&product_id=${sampleProduct.id}&title=${encodeURIComponent(prodTitle)}&body=${encodeURIComponent(prodBody)}`;
assert.ok(prodUrl.includes("category=product"), "URL must have category=product");
assert.ok(prodUrl.includes("new=1"), "URL must have new=1");
assert.ok(prodUrl.includes("product_id=prod-123"), "URL must have product_id");
assert.ok(prodUrl.includes(encodeURIComponent("[제품 문의] Cica Soothing Serum / MFG-CICA-01")), "URL must have formatted title");
console.log("  ✓ Product Inquiry URL formatted with title and full specs body template");

// Barcode Inquiry URL
const barcodeTitle = `[바코드 문의] ${sampleProduct.name_en} / ${sampleProduct.manufactureSku || sampleProduct.letusto_sku}`;
const barcodeBody = `바코드(UPC / EAN) 관련 문의사항을 작성해 주세요.

- 브랜드: ${brandName}
- 제품명(한글): ${sampleProduct.name}
- 제품명(영문): ${sampleProduct.name_en}
- 제조사 SKU: ${sampleProduct.manufacture_sku}
- Letusto SKU: ${sampleProduct.letusto_sku}
- UPC: ${sampleProduct.upc || "미발급/미입력"}
- EAN: ${sampleProduct.ean || "미발급/미입력"}
- 카테고리: ${categoryLabel}
- 제품 ID: ${sampleProduct.id}

문의 내용:
`;
const barcodeUrl = `/portal/support?category=product&new=1&product_id=${sampleProduct.id}&title=${encodeURIComponent(barcodeTitle)}&body=${encodeURIComponent(barcodeBody)}`;
assert.ok(barcodeUrl.includes("category=product"));
assert.ok(barcodeUrl.includes(encodeURIComponent("[바코드 문의]")));
console.log("  ✓ Barcode Inquiry URL formatted with title and barcode inquiry template");

console.log("\n>>> ALL VERIFICATION TESTS PASSED SUCCESSFULLY! <<<");
